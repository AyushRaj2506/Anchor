import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK with the server-side environment variable.
// Vercel exposes process.env automatically.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_INPUT_LENGTH = 50000; // 50k chars reasonable limit

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    // 1. Validate Input
    if (text === undefined || text === null || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text is required and must be a string.' });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text cannot be empty.' });
    }

    if (text.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ 
        success: false, 
        error: `Text exceeds the maximum length of ${MAX_INPUT_LENGTH} characters.` 
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

    // 3. Construct the strict prompt
    const prompt = `
Analyze the following text and return a structured JSON response.
Do NOT include markdown formatting or backticks around the JSON.
Return ONLY valid JSON matching this exact structure:
{
  "summary": "A concise summary of the text. (string or null)",
  "category": "A single, broad academic or professional category this belongs to (e.g. DBMS, Operating Systems). (string or null)",
  "tags": ["tag1", "tag2"] // Array of relevant short tags (strings).
}

CRITICAL RULES:
1. Use ONLY information present in the provided text.
2. Do NOT infer or invent specific facts that are not stated.
3. If the text does not contain enough information to generate a field, return null (for strings) or [] (for arrays).

Text to analyze:
"""
${text}
"""
    `.trim();

    // 4. Call Gemini (with timeout protection via Promise.race, although Vercel has its own limits)
    // We'll rely on Vercel's default 10s or custom timeout, but a safe promise race is good practice.
    const fetchPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          // The SDK supports enforcing a schema:
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string", nullable: true },
              category: { type: "string", nullable: true },
              tags: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "category", "tags"]
          },
          temperature: 0.1 // Low temp for more deterministic, factual extraction
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

    // 5. Send successful structured response
    return res.status(200).json({
      success: true,
      data: {
        summary: resultJson.summary || null,
        category: resultJson.category || null,
        tags: Array.isArray(resultJson.tags) ? resultJson.tags : []
      }
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI analysis failed due to an internal or network error.'
    });
  }
}
