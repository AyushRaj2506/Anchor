import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '../utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_QUESTION_LENGTH = 1000;
const FILE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024; // 20 MB inline limit

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { question, context } = req.body;

    // 1. Validate Input Question
    if (question === undefined || question === null || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'Question is required and must be a string.' });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question cannot be empty.' });
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: `Question exceeds the maximum length of ${MAX_QUESTION_LENGTH} characters.` 
      });
    }

    // 2. Validate Context
    if (!context || typeof context !== 'object' || !Array.isArray(context.resources) || !Array.isArray(context.tasks)) {
      return res.status(400).json({ success: false, error: 'Valid context (containing resources and tasks arrays) is required.' });
    }

    // 3. Check configuration
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'AI search is temporarily unavailable. (Missing configuration)' });
    }

    // 4. Authenticate (optional for Demo Mode, required for file fetching)
    let uid = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const decodedToken = await verifyAuth(req);
        uid = decodedToken.uid;
      } catch (authErr) {
        console.warn('Auth verify failed in ask.js, proceeding without auth (demo mode fallback).', authErr.message);
      }
    }

    // 5. Format the context for the model prompt
    const formattedResources = context.resources.map((r, idx) => `
[Resource #${idx + 1}]
ID: ${r.id}
Title: ${r.title}
Category: ${r.category || 'Uncategorized'}
Type: ${r.type || 'Document'}
Tags: ${(r.tags || []).join(', ') || 'None'}
AI Summary: ${r.aiSummary || 'None'}
AI Important Facts: ${(r.aiImportantInformation || []).join('; ') || 'None'}
AI Deadline: ${r.aiDeadline || 'None'}
AI Action Items: ${Array.isArray(r.aiActionItems) ? (r.aiActionItems.map ? r.aiActionItems.map(a => typeof a === 'string' ? a : a.title || '').filter(Boolean).join('; ') : r.aiActionItems) : 'None'}
${r.url ? `URL: ${r.url}` : ''}
Extracted Document Content: ${r.contentText ? r.contentText.substring(0, 6000) : (r.content || r.description || r.notes || 'No content available.')}
${r.emailSender ? `Email Sender: ${r.emailSender}` : ''}
${r.emailSubject ? `Email Subject: ${r.emailSubject}` : ''}
`).join('\n');


    const formattedTasks = context.tasks.map((t, idx) => `
[Task #${idx + 1}]
ID: ${t.id}
Title: ${t.title}
Category: ${t.category || 'Uncategorized'}
Status: ${t.status || 'todo'}
Priority: ${t.priority || 'Medium'}
Deadline Description/MS: ${t.deadlineMs ? new Date(t.deadlineMs).toLocaleDateString() : 'None'}
Description: ${t.description || 'No description provided.'}
`).join('\n');

    const promptText = `
You are Anchor's personal academic/knowledge assistant.
Your goal is to answer the user's question using ONLY the provided Grounding Context (Resources and Tasks) saved in their account, and any attached files.

Do NOT include markdown formatting or backticks around the JSON.
Return ONLY valid JSON matching this exact structure:
{
  "answer": "Your grounded response text explaining the answer to the user. (string)",
  "confidence": "high | medium | low",
  "sources": [
    {
      "type": "resource | task",
      "id": "string",
      "title": "string"
    }
  ],
  "notFound": false // Set to true ONLY if the question cannot be answered from the provided context or files.
}

CRITICAL RULES:
1. Answer the question using ONLY the provided Resources, Tasks, and attached file contents.
2. Do NOT use outside general knowledge or external facts to fill in missing details.
3. If a provided Resource matches the user's question (e.g. by Title) but its "Extracted Document Content" says "No content available.", do NOT hallucinate an answer. Set "notFound" to true, "confidence" to "low", cite the resource in "sources", and set the "answer" to "I have the [Resource Title] link saved, but I don't have its page content available in your knowledge yet." (Adjust text if it's not a link).
4. If the context does not contain enough information to answer and does NOT match the query, set "notFound" to true, "confidence" to "low", "sources" to [], and set the "answer" to "I couldn't find this information in your saved resources or tasks."
5. Distinguish clearly between Resources and Tasks.
6. In your "sources" array, cite ONLY the actual Resource or Task IDs and titles provided in the context that supported your answer. Do NOT invent source IDs.

USER QUESTION:
"${question}"

GROUNDING CONTEXT:
=== RESOURCES ===
${formattedResources || 'No resources found in context.'}

=== TASKS ===
${formattedTasks || 'No tasks found in context.'}
    `.trim();

    // 6. Dynamically fetch up to 2 relevant files from Supabase if authenticated
    const parts = [];
    
    // Always add the text prompt first
    parts.push({ text: promptText });

    if (uid && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Find resources that have a valid storagePath and supported fileType
      const resourcesWithFiles = context.resources.filter(r => 
        r.storagePath && 
        r.storagePath.startsWith(`${uid}/`) && 
        r.fileType && 
        SUPPORTED_MIME_TYPES.has(r.fileType)
      ).slice(0, 2); // Limit to top 2 to avoid timeouts/payload limits

      for (const r of resourcesWithFiles) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('anchor-resources')
            .download(r.storagePath);

          if (!downloadError && fileData && fileData.size <= FILE_SIZE_LIMIT_BYTES) {
            const arrayBuffer = await fileData.arrayBuffer();
            const base64Data  = Buffer.from(arrayBuffer).toString('base64');
            
            parts.push({
              inlineData: {
                mimeType: r.fileType,
                data: base64Data
              }
            });
            console.log(`Successfully injected file ${r.storagePath} into Gemini context.`);
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch file ${r.storagePath} for Gemini context:`, fetchErr);
          // Continue even if one file fails; we still have metadata and other files
        }
      }
    }

    // 7. Query Gemini
    const fetchPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["resource", "task"] },
                    id: { type: "string" },
                    title: { type: "string" }
                  },
                  required: ["type", "id", "title"]
                }
              },
              notFound: { type: "boolean" }
            },
            required: ["answer", "confidence", "sources", "notFound"]
          },
          temperature: 0.1
        }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI Request timed out.')), 25000) // Increased to 25s for file processing
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

    // 8. Source ID Validation (filtering out any hallucinated IDs)
    const validResourceIds = new Set(context.resources.map(r => r.id.toString()));
    const validTaskIds = new Set(context.tasks.map(t => t.id.toString()));

    const validatedSources = (resultJson.sources || []).filter(src => {
      if (!src || !src.id) return false;
      const sid = src.id.toString();
      if (src.type === 'resource') {
        return validResourceIds.has(sid);
      } else if (src.type === 'task') {
        return validTaskIds.has(sid);
      }
      return false;
    });

    return res.status(200).json({
      success: true,
      data: {
        answer: resultJson.answer || "I couldn't find this information in your saved resources or tasks.",
        confidence: resultJson.confidence || "low",
        sources: validatedSources,
        notFound: resultJson.notFound === true
      }
    });

  } catch (error) {
    console.error('Gemini Ask Error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI search failed due to an internal or network error.'
    });
  }
}
