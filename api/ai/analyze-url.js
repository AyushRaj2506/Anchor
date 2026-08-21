import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_CONTENT_TEXT_CHARS = 80000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5 MB max html size

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url, title, description, category, tags } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL is required.' });
  }

  // 1. Check env config
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ success: false, error: 'AI analysis is temporarily unavailable.' });
  }

  try {
    // 2. Fetch the URL (with timeout and basic safety checks)
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), FETCH_TIMEOUT_MS);
    
    let htmlContent = '';
    
    try {
      // Basic validation to prevent internal network requests
      const parsedUrl = new URL(url);
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname) || parsedUrl.hostname.endsWith('.internal')) {
        throw new Error('Internal URLs are not allowed.');
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTP/HTTPS URLs are allowed.');
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Anchor-Knowledge-Bot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: fetchController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL. Status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_HTML_SIZE) {
        throw new Error('Page size is too large to process.');
      }

      htmlContent = await response.text();
      
      if (htmlContent.length > MAX_HTML_SIZE) {
        htmlContent = htmlContent.substring(0, MAX_HTML_SIZE); // Truncate if no content-length was provided
      }
      
    } catch (fetchErr) {
      console.error('URL Fetch Error:', fetchErr.message);
      // If fetching fails, we return a graceful fallback rather than crashing
      return res.status(200).json({
        success: true,
        data: {
          summary: null,
          category: null,
          tags: [],
          importantInformation: [],
          deadlines: [],
          actionItems: [],
          contentText: null, // This signals that content is unavailable
          contentTruncated: false
        }
      });
    }

    // 3. Extract readable text using Regex (stripping scripts, styles, nav, etc.)
    let cleanedText = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');

    // Strip remaining HTML tags
    cleanedText = cleanedText.replace(/<[^>]+>/g, ' ');
    
    // Decode basic HTML entities
    cleanedText = cleanedText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Remove excessive whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

    if (cleanedText.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: null,
          category: null,
          tags: [],
          importantInformation: [],
          deadlines: [],
          actionItems: [],
          contentText: null,
          contentTruncated: false
        }
      });
    }

    // Prepend any user-provided metadata
    let textToAnalyze = `
URL: ${url}
Title: ${title || 'Unknown'}
Description: ${description || 'None'}
Category: ${category || 'Unknown'}
Tags: ${Array.isArray(tags) ? tags.join(', ') : 'None'}

--- WEBPAGE CONTENT ---
${cleanedText}
    `.trim();

    if (textToAnalyze.length > MAX_CONTENT_TEXT_CHARS) {
      textToAnalyze = textToAnalyze.substring(0, MAX_CONTENT_TEXT_CHARS);
    }

    // 4. Build Gemini prompt (exactly matching analyze-resource.js schema)
    const systemInstruction = `
You are a document analysis assistant for a student knowledge management app called Anchor.
Analyze the provided webpage text and extract structured information.

CRITICAL RULES:
1. Only use information EXPLICITLY present in the text.
2. Do NOT invent facts, dates, deadlines, names, requirements, or action items.
3. If a deadline is mentioned, extract it EXACTLY as stated (e.g., 'August 25'). Do NOT discard it just because the year is missing.
4. If information is unavailable for a field, return null (strings) or [] (arrays).
5. contentText should capture the most useful raw content for future Q&A, up to ~2000 words.
6. Only add actionItems when the document explicitly asks someone to DO something with a clear deliverable.
7. deadlines[] entries must only be populated when there is an explicit date, event, or submission mentioned.
    `.trim();

    const userPrompt = `
Analyze this webpage text and return structured JSON only (no markdown, no backticks).

Return ONLY valid JSON matching this EXACT schema:
{
  "summary": "Concise 2-4 sentence summary of what this webpage is about. (string or null)",
  "category": "A single subject/topic category, e.g. 'Operating Systems', 'DBMS', 'Computer Networks'. (string or null)",
  "tags": ["keyword1", "keyword2"],
  "importantInformation": ["important fact 1", "important fact 2"],
  "deadlines": [
    {
      "title": "Name of the deliverable or event",
      "description": "Additional context",
      "deadline": "YYYY-MM-DD or extracted date string (e.g. 'August 25') if determinable, otherwise null",
      "sourceText": "Exact quote from the document"
    }
  ],
  "actionItems": [
    {
      "title": "Short action title",
      "description": "What needs to be done",
      "deadline": "YYYY-MM-DD or extracted date string (e.g. 'August 25') if determinable, otherwise null"
    }
  ],
  "contentText": "The most useful extracted text content from this webpage for later Q&A, approximately 1000-2000 words. Must be actual webpage text, not your summary."
}

Text to analyze:
"""
${textToAnalyze}
"""
    `.trim();

    // 5. Call Gemini
    const fetchPromise = ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string', nullable: true },
            category: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            importantInformation: { type: 'array', items: { type: 'string' } },
            deadlines: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  deadline: { type: 'string', nullable: true },
                  sourceText: { type: 'string', nullable: true },
                },
                required: ['title']
              }
            },
            actionItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  deadline: { type: 'string', nullable: true },
                },
                required: ['title']
              }
            },
            contentText: { type: 'string', nullable: true },
          },
          required: ['summary', 'category', 'tags', 'importantInformation', 'deadlines', 'actionItems', 'contentText']
        },
        temperature: 0.1,
      }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timed out.')), 25000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // 6. Parse response
    let resultJson;
    try {
      resultJson = JSON.parse(response.text);
    } catch {
      console.error('Failed to parse Gemini response:', response.text?.substring(0, 500));
      return res.status(502).json({ success: false, error: 'AI returned malformed data.' });
    }

    // 7. Validate and sanitize
    let contentText = typeof resultJson.contentText === 'string' ? resultJson.contentText : '';
    let contentTruncated = false;
    if (contentText.length > MAX_CONTENT_TEXT_CHARS) {
      contentText = contentText.substring(0, MAX_CONTENT_TEXT_CHARS);
      contentTruncated = true;
    }

    const validatedData = {
      summary: typeof resultJson.summary === 'string' ? resultJson.summary.trim() : null,
      category: typeof resultJson.category === 'string' ? resultJson.category.trim() : null,
      tags: Array.isArray(resultJson.tags)
        ? resultJson.tags.filter(t => typeof t === 'string').slice(0, 20)
        : [],
      importantInformation: Array.isArray(resultJson.importantInformation)
        ? resultJson.importantInformation.filter(f => typeof f === 'string').slice(0, 30)
        : [],
      deadlines: Array.isArray(resultJson.deadlines)
        ? resultJson.deadlines
            .filter(d => d && typeof d.title === 'string')
            .map(d => ({
              title: d.title,
              description: d.description || null,
              deadline: typeof d.deadline === 'string' ? d.deadline : null,
              sourceText: d.sourceText || null,
            }))
            .slice(0, 20)
        : [],
      actionItems: Array.isArray(resultJson.actionItems)
        ? resultJson.actionItems
            .filter(a => a && typeof a.title === 'string')
            .map(a => ({
              title: a.title,
              description: a.description || null,
              deadline: typeof a.deadline === 'string' ? a.deadline : null,
            }))
            .slice(0, 20)
        : [],
      contentText: contentText || null,
      contentTruncated,
    };

    return res.status(200).json({ success: true, data: validatedData });

  } catch (err) {
    console.error('analyze-url error:', err);
    return res.status(500).json({
      success: false,
      error: 'URL analysis failed.'
    });
  }
}
