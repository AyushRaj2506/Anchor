/**
 * Frontend AI Service
 * 
 * Handles communication with our Vercel API routes.
 * React components call this service instead of calling endpoints directly.
 */

/**
 * Sends text to the AI backend for analysis.
 * 
 * @param {string} text - The text to analyze.
 * @returns {Promise<Object>} The structured analysis result { summary, category, tags }
 * @throws {Error} Human-readable error message if the analysis fails.
 */
export async function analyzeText(text) {
  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('Received an invalid response from the server.');
    }

    if (!response.ok || !data.success) {
      // Return the controlled error message from the backend
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data.data;

  } catch (error) {
    // If it's our own thrown error from above, rethrow it
    if (error.message && error.message !== 'Failed to fetch') {
      throw error;
    }
    // Handle true network failures (server down, offline)
    console.error('Network or fetch error:', error);
    throw new Error('AI analysis is temporarily unavailable due to a network error.');
  }
}
