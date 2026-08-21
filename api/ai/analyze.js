import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK with the server-side environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_INPUT_LENGTH = 50000; // 50k chars reasonable limit

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let textToAnalyze = '';

    // 1. Parse and Validate Input
    if (req.body.resource) {
      const { resource } = req.body;
      if (!resource || typeof resource !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid resource object provided.' });
      }

      const { title, description, notes, category, tags, content } = resource;
      
      // Combine fields to construct a usable text block
      const parts = [];
      if (title) parts.push(`Title: ${title}`);
      if (description) parts.push(`Description: ${description}`);
      if (notes) parts.push(`Notes: ${notes}`);
      if (category) parts.push(`Category: ${category}`);
      if (tags && Array.isArray(tags) && tags.length > 0) {
        parts.push(`Tags: ${tags.join(', ')}`);
      }
      if (content) parts.push(`Content:\n${content}`);

      textToAnalyze = parts.join('\n\n');

      if (textToAnalyze.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Resource does not contain enough text data (title, description, or notes) to analyze.' 
        });
      }
    } else if (req.body.text !== undefined && req.body.text !== null) {
      const { text } = req.body;
      if (typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'Text must be a string.' });
      }
      textToAnalyze = text;
    } else {
      return res.status(400).json({ success: false, error: 'Either resource or text is required.' });
    }

    // Common character length check
    if (textToAnalyze.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text cannot be empty.' });
    }

    if (textToAnalyze.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: `Input exceeds the maximum length of ${MAX_INPUT_LENGTH} characters.` 
      });
    }

    // 2. Validate Configuration
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is missing from environment variables.');
      return res.status(503).json({ 
        success: false, 
        error: 'AI analysis is temporarily unavailable. (Missing configuration)' 
      });
    }

    // 3. Construct the prompt with strict guidelines
    const prompt = `
Analyze the following text and return a structured JSON response.
Do NOT include markdown formatting or backticks around the JSON.
Return ONLY valid JSON matching this exact structure:
{
  "summary": "A concise summary based ONLY on the supplied text. (string or null)",
  "category": "A single, broad academic/professional category this belongs to (e.g. DBMS, Operating Systems). (string or null)",
  "tags": ["tag1", "tag2"], // Array of relevant short keywords (strings).
  "importantInformation": ["fact1", "fact2"], // Array of important facts explicitly present.
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
  "contentText": "The most useful extracted text content from this document for later Q&A, approximately 1000-2000 words. Must be actual text, not your summary."
}

CRITICAL RULES:
1. You are analyzing a user's saved college resource.
2. Use ONLY the supplied resource content.
3. Extract structured information from the content.
4. If the content contains a deadline (e.g., 'August 25' or 'Tomorrow'), return it EXACTLY as stated. Do NOT discard it just because the year is missing.
5. If the content contains an action/task, return it.
6. Never invent information.
7. If information is genuinely absent, return null (for strings) or [] (for arrays). Do not guess.

Text to analyze:
"""
${textToAnalyze}
"""
    `.trim();

    // 4. Call Gemini
    const fetchPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string", nullable: true },
              category: { type: "string", nullable: true },
              tags: { type: "array", items: { type: "string" } },
              importantInformation: { type: "array", items: { type: "string" } },
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
              contentText: { type: "string", nullable: true }
            },
            required: ["summary", "category", "tags", "importantInformation", "deadlines", "actionItems", "contentText"]
          },
          temperature: 0.1
        }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI Request timed out.')), 15000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    let resultJson;
    try {
      resultJson = JSON.parse(response.text);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', response.text);
      return res.status(502).json({
        success: false,
        error: 'AI returned malformed data. Please try again.'
      });
    }

    // 5. Schema Validation
    let contentText = typeof resultJson.contentText === 'string' ? resultJson.contentText : '';
    let contentTruncated = false;
    if (contentText.length > MAX_INPUT_LENGTH) {
      contentText = contentText.substring(0, MAX_INPUT_LENGTH);
      contentTruncated = true;
    }

    const validatedData = {
      summary: typeof resultJson.summary === 'string' ? resultJson.summary : null,
      category: typeof resultJson.category === 'string' ? resultJson.category : null,
      tags: Array.isArray(resultJson.tags) ? resultJson.tags.filter(t => typeof t === 'string') : [],
      importantInformation: Array.isArray(resultJson.importantInformation) ? resultJson.importantInformation.filter(f => typeof f === 'string') : [],
      deadlines: Array.isArray(resultJson.deadlines)
        ? resultJson.deadlines
            .filter(d => d && typeof d.title === 'string')
            .map(d => ({
              title: d.title,
              description: d.description || null,
              deadline: typeof d.deadline === 'string' ? d.deadline : null,
              sourceText: d.sourceText || null,
            }))
        : [],
      actionItems: Array.isArray(resultJson.actionItems)
        ? resultJson.actionItems
            .filter(a => a && typeof a.title === 'string')
            .map(a => ({
              title: a.title,
              description: a.description || null,
              deadline: typeof a.deadline === 'string' ? a.deadline : null,
            }))
        : [],
      contentText: contentText || null,
      contentTruncated
    };

    return res.status(200).json({
      success: true,
      data: validatedData
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI analysis failed due to an internal or network error.'
    });
  }
}
