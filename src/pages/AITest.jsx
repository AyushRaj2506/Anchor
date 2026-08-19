import React, { useState } from 'react';
import { analyzeText } from '../services/ai';

/**
 * Temporary UI for testing Gemini Foundation (Milestone 3A).
 * This component is isolated and can be safely removed later.
 */
function AITest() {
  const [text, setText] = useState('Operating systems manage computer hardware and provide services to application programs.');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeText(text);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dashboard" id="main-content" tabIndex={-1} style={{ padding: '2rem' }}>
      <section className="card" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Gemini Foundation Test (Milestone 3A)
        </h1>
        
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ai-test-input" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Text to analyze:
          </label>
          <textarea
            id="ai-test-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !text.trim() ? 0.7 : 1,
            fontWeight: 600,
            marginBottom: '1.5rem'
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze with AI'}
        </button>

        {/* Status / Results Area */}
        <div aria-live="polite">
          {error && (
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--color-danger-bg, #fde8e0)', color: 'var(--color-danger, #c0392b)', marginBottom: '1rem' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <div style={{ padding: '1.5rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Structured Result:</h2>
              
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Summary:</strong>
                <p style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>{result.summary !== null ? result.summary : <em>null</em>}</p>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Category:</strong>
                <p style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>{result.category !== null ? result.category : <em>null</em>}</p>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Tags:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {result.tags && result.tags.length > 0 ? (
                    result.tags.map(tag => (
                      <span key={tag} style={{ padding: '0.25rem 0.75rem', borderRadius: '16px', background: '#e8f0e8', color: '#4a6741', fontSize: '0.875rem' }}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <em style={{ color: 'var(--text-primary)' }}>[]</em>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default AITest;
