import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '../utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_CONTENT_TEXT_CHARS = 80000;
const FILE_SIZE_LIMIT_BYTES  = 20 * 1024 * 1024; // 20 MB inline limit

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * POST /api/ai/analyze-resource
 *
 * Authenticated endpoint: verifies Firebase ID token, validates that
 * storagePath belongs to the authenticated uid, fetches the actual file
 * from Supabase, passes it inline to Gemini for deep document analysis,
 * and returns structured JSON.
 *
 * Body: { resourceId, storagePath, fileType, fileName }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── 1. Authenticate ─────────────────────────────────────────────────
  let decodedToken;
  try {
    decodedToken = await verifyAuth(req);
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing token.' });
  }

  const { uid } = decodedToken;

  // ── 2. Validate input ────────────────────────────────────────────────
  const { resourceId, storagePath, fileType, fileName } = req.body || {};

  if (!storagePath || typeof storagePath !== 'string') {
    return res.status(400).json({ success: false, error: 'storagePath is required.' });
  }

  if (!fileType || typeof fileType !== 'string') {
    return res.status(400).json({ success: false, error: 'fileType is required.' });
  }

  // ── 3. Path ownership check ──────────────────────────────────────────
  if (!storagePath.startsWith(`${uid}/`)) {
    console.warn(`UID ${uid} attempted to analyze unauthorized path: ${storagePath}`);
    return res.status(403).json({ success: false, error: 'Access denied: Unauthorized file path.' });
  }

  // ── 4. MIME type validation ──────────────────────────────────────────
  if (!SUPPORTED_MIME_TYPES.has(fileType)) {
    return res.status(400).json({
      success: false,
      error: `Unsupported file type: ${fileType}. Supported: PDF, JPEG, PNG, WEBP.`
    });
  }

  // ── 5. Check env config ──────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ success: false, error: 'AI analysis is temporarily unavailable.' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VITE_SUPABASE_URL) {
    return res.status(503).json({ success: false, error: 'Storage access is temporarily unavailable.' });
  }

  try {
    // ── 6. Download file from Supabase ───────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('anchor-resources')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Supabase download error:', downloadError);
      return res.status(502).json({
        success: false,
        error: 'Failed to retrieve the file from storage. It may have been deleted.'
      });
    }

    // ── 7. Size check for inline delivery ───────────────────────────
    const fileSizeBytes = fileData.size;
    if (fileSizeBytes > FILE_SIZE_LIMIT_BYTES) {
      return res.status(413).json({
        success: false,
        error: `File is too large for inline AI analysis (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`
      });
    }

    // ── 8. Convert to base64 ─────────────────────────────────────────
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data  = Buffer.from(arrayBuffer).toString('base64');

    // ── 9. Build Gemini prompt ────────────────────────────────────────
    const systemInstruction = `
You are a document analysis assistant for a student knowledge management app called Anchor.
Analyze the provided document and extract structured information.

CRITICAL RULES:
1. Only use information EXPLICITLY present in the document.
2. Do NOT invent facts, dates, deadlines, names, requirements, or action items.
3. If a deadline is mentioned but the absolute date cannot be resolved from the document alone, set deadline to null.
4. If information is unavailable for a field, return null (strings) or [] (arrays).
5. contentText should capture the most useful raw content for future Q&A, up to ~2000 words.
6. Only add actionItems when the document explicitly asks someone to DO something with a clear deliverable.
   - "Submit assignment by Friday" → action item
   - "Normalization reduces redundancy" → NOT an action item
7. deadlines[] entries must only be populated when there is an explicit date, event, or submission mentioned.
    `.trim();

    const userPrompt = `
Analyze this ${fileType === 'application/pdf' ? 'PDF document' : 'image'} and return structured JSON only (no markdown, no backticks).

Return ONLY valid JSON matching this EXACT schema:
{
  "summary": "Concise 2-4 sentence summary of what this document is about. (string or null)",
  "category": "A single subject/topic category, e.g. 'Operating Systems', 'DBMS', 'Computer Networks'. (string or null)",
  "tags": ["keyword1", "keyword2"],
  "importantInformation": ["important fact 1", "important fact 2"],
  "deadlines": [
    {
      "title": "Name of the deliverable or event",
      "description": "Additional context",
      "deadline": "YYYY-MM-DD if determinable from document, otherwise null",
      "sourceText": "Exact quote from the document"
    }
  ],
  "actionItems": [
    {
      "title": "Short action title",
      "description": "What needs to be done",
      "deadline": "YYYY-MM-DD if determinable, otherwise null"
    }
  ],
  "contentText": "The most useful extracted text content from this document for later Q&A, approximately 1000-2000 words. Must be actual document text, not your summary."
}
    `.trim();

    // ── 10. Call Gemini with inline file data ────────────────────────
    const fetchPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: fileType,
                data: base64Data,
              }
            },
            { text: userPrompt }
          ]
        }
      ],
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
      setTimeout(() => reject(new Error('AI request timed out.')), 55000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // ── 11. Parse response ───────────────────────────────────────────
    let resultJson;
    try {
      resultJson = JSON.parse(response.text);
    } catch {
      console.error('Failed to parse Gemini response:', response.text?.substring(0, 500));
      return res.status(502).json({ success: false, error: 'AI returned malformed data. Please try again.' });
    }

    // ── 12. Validate and sanitize ────────────────────────────────────
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
    console.error('analyze-resource error:', err);
    return res.status(500).json({
      success: false,
      error: 'AI document analysis failed. Your resource has been preserved.'
    });
  }
}
