/**
 * Frontend AI Service
 * 
 * Handles communication with our Vercel API routes.
 * React components call this service instead of calling endpoints directly.
 */

/**
 * Sends generic text to the AI backend for analysis.
 * 
 * @param {string} text - The text to analyze.
 * @returns {Promise<Object>} The structured analysis result
 * @throws {Error} Human-readable error message if the analysis fails.
 */
export async function analyzeText(text) {
  return fetchAI('/api/ai/analyze', { text });
}

/**
 * Sends a structured resource object to the AI backend for analysis.
 * 
 * @param {Object} resource - The resource payload containing title, description, category, tags.
 * @returns {Promise<Object>} The structured AI analysis result
 * @throws {Error} Human-readable error message if the analysis fails.
 */
export async function analyzeResource(resource) {
  // Clean resource to send only required fields to minimize payload
  const cleanedResource = {
    title: resource.title || '',
    description: resource.description || '',
    notes: resource.notes || '',
    category: resource.category || '',
    tags: Array.isArray(resource.tags) ? resource.tags : []
  };

  return fetchAI('/api/ai/analyze', { resource: cleanedResource });
}

/**
 * Sends a grounded Q&A query with relevance context to the AI backend.
 * 
 * @param {string} question - User's question text.
 * @param {Object} context - relevance context containing resources and tasks arrays.
 * @returns {Promise<Object>} Grounded structured response
 */
export async function askQuestion(question, context) {
  return fetchAI('/api/ai/ask', { question, context });
}

/**
 * Helper to fetch from local/deployed AI endpoint.
 */
async function fetchAI(url, payload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('Received an invalid response from the server.');
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data.data;

  } catch (error) {
    if (error.message && error.message !== 'Failed to fetch') {
      throw error;
    }
    console.error('AI Fetch error:', error);
    throw new Error('AI analysis is temporarily unavailable due to a network error.');
  }
}
