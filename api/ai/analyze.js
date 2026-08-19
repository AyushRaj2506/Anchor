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

      const { title, description, notes, category, tags } = resource;
      
      // Combine fields to construct a usable text block
      const parts = [];
      if (title) parts.push(`Title: ${title}`);
      if (description) parts.push(`Description: ${description}`);
      if (notes) parts.push(`Notes: ${notes}`);
      if (category) parts.push(`Category: ${category}`);
      if (tags && Array.isArray(tags) && tags.length > 0) {
        parts.push(`Tags: ${tags.join(', ')}`);
      }

      textToAnalyze = parts.join('\n');

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
  "deadline": "YYYY-MM-DD (or explicit date string/description) ONLY if explicitly stated. (string or null)",
  "actionItems": ["action1", "action2"] // Actions explicitly stated or clearly required.
}

CRITICAL RULES:
1. Use ONLY information contained in the provided text.
2. Do NOT invent facts or infer details.
3. Do NOT infer dates, deadlines, organizations, requirements, or actions that are not explicitly stated.
4. If information is unavailable for a field, return null (for strings) or [] (for arrays). Do not guess.

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
              deadline: { type: "string", nullable: true },
              actionItems: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "category", "tags", "importantInformation", "deadline", "actionItems"]
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
    const validatedData = {
      summary: typeof resultJson.summary === 'string' ? resultJson.summary : null,
      category: typeof resultJson.category === 'string' ? resultJson.category : null,
      tags: Array.isArray(resultJson.tags) ? resultJson.tags.filter(t => typeof t === 'string') : [],
      importantInformation: Array.isArray(resultJson.importantInformation) ? resultJson.importantInformation.filter(f => typeof f === 'string') : [],
      deadline: typeof resultJson.deadline === 'string' ? resultJson.deadline : null,
      actionItems: Array.isArray(resultJson.actionItems) ? resultJson.actionItems.filter(a => typeof a === 'string') : []
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
