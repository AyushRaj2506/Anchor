import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_QUESTION_LENGTH = 1000;

export default async function handler(req, res) {
  // Only allow POST
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
      console.error('GEMINI_API_KEY is missing from environment variables.');
      return res.status(503).json({ 
        success: false, 
        error: 'AI search is temporarily unavailable. (Missing configuration)' 
      });
    }

    // 4. Format the context for the model prompt
    const formattedResources = context.resources.map((r, idx) => `
[Resource #${idx + 1}]
ID: ${r.id}
Title: ${r.title}
Category: ${r.category || 'Uncategorized'}
Type: ${r.type || 'Document'}
Tags: ${(r.tags || []).join(', ') || 'None'}
Description/Content: ${r.description || r.notes || 'No content provided.'}
AI Summary: ${r.aiSummary || 'None'}
AI Important Facts: ${(r.aiImportantInformation || []).join('; ') || 'None'}
AI Deadline: ${r.aiDeadline || 'None'}
AI Action Items: ${(r.aiActionItems || []).join('; ') || 'None'}
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

    const prompt = `
You are Anchor's personal academic/knowledge assistant.
Your goal is to answer the user's question using ONLY the provided Grounding Context (Resources and Tasks) saved in their account.

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
  "notFound": false // Set to true ONLY if the question cannot be answered from the provided context.
}

CRITICAL RULES:
1. Answer the question using ONLY the provided Resources and Tasks context.
2. Do NOT use outside general knowledge or external facts to fill in missing details.
3. If the context does not contain enough information to answer, set "notFound" to true, "confidence" to "low", "sources" to [], and set the "answer" to "I couldn't find this information in your saved resources or tasks."
4. Distinguish clearly between Resources and Tasks.
5. In your "sources" array, cite ONLY the actual Resource or Task IDs and titles provided in the context that supported your answer. Do NOT invent source IDs.

USER QUESTION:
"${question}"

GROUNDING CONTEXT:
=== RESOURCES ===
${formattedResources || 'No resources found in context.'}

=== TASKS ===
${formattedTasks || 'No tasks found in context.'}
    `.trim();

    // 5. Query Gemini
    const fetchPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
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

    // 6. Source ID Validation (filtering out any hallucinated IDs)
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
