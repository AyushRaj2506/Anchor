import React, { useState } from 'react';
import './ResourceDetails.css';
import { analyzeResource } from '../services/ai';

/**
 * ResourceDetails — shows full information for a single resource.
 *
 * Props:
 *   resource         — the resource object from Firestore (passed from Library/App)
 *   onBack           — function to call when "← Back to Library" is clicked
 *   onToggleBookmark — function(resourceId) to toggle bookmark state (persists to Firestore)
 *   onDeleteResource — function(resourceId) to delete this resource
 *   onUpdateResource — function(resourceId, updates) to persist AI analysis results
 *   onNavigate       — function(pageId) to navigate between pages
 *
 * How it works:
 *   - Shows data from the resource object itself (title, category, type, tags, description, sourceUrl)
 *   - For real Firestore resources, fields like description may not exist — graceful fallbacks shown
 *   - Action items are local UI state only (future milestone for persistence)
 *   - Document preview is a styled CSS placeholder — no PDF library in scope
 */
function ResourceDetails({ resource, onBack, onToggleBookmark, onDeleteResource, onUpdateResource, onNavigate }) {
  const {
    id,
    title,
    category,
    type,
    typeIcon,
    iconBg,
    tags = [],
    bookmarked,
    sourceUrl,
    description,
    notes,
    createdAt,
    // AI fields
    aiSummary,
    aiCategory,
    aiTags = [],
    aiImportantInformation = [],
    aiDeadline,
    aiActionItems = [],
    aiAnalyzedAt,
  } = resource;

  // Bookmark pop animation
  const [bookmarkPopping, setBookmarkPopping] = useState(false);

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);

  async function handleAnalyze() {
    setAnalyzing(true);
    setAiError(null);

    try {
      const result = await analyzeResource(resource);
      
      try {
        if (onUpdateResource) {
          await onUpdateResource(id, {
            aiSummary: result.summary,
            aiCategory: result.category,
            aiTags: result.tags,
            aiImportantInformation: result.importantInformation,
            aiDeadline: result.deadline,
            aiActionItems: result.actionItems
          });
        }
      } catch (firestoreError) {
        console.error('Firestore save failed:', firestoreError);
        throw new Error('FIRESTORE_SAVE_FAILED');
      }
    } catch (err) {
      console.error('AI Analysis failed:', err);
      if (err.message === 'FIRESTORE_SAVE_FAILED') {
        setAiError("AI analysis completed, but it could not be saved. Please try again.");
      } else {
        setAiError("AI analysis is temporarily unavailable. Your resource was not affected.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  function handleBookmarkToggle() {
    setBookmarkPopping(true);
    setTimeout(() => setBookmarkPopping(false), 240);
    if (onToggleBookmark) onToggleBookmark(id);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      if (onDeleteResource) {
        onDeleteResource(id);
        // Navigation back to Library is handled by App.jsx after deletion
      }
    }
  }

  // Format the creation date for display
  function formatDate(ts) {
    if (!ts) return '—';
    try {
      // Firestore Timestamp has .toDate(), Date objects work directly
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  // Derive display summary — use resource.description if present, otherwise notes
  const displaySummary = description || notes || null;

  // Page navigation state for the document preview (visual UI)
  const [previewPage, setPreviewPage] = useState(1);
  const totalPages = 1; // No real file access — visual placeholder

  return (
    <main className="rd-page" id="main-content" tabIndex={-1}>

      {/* ── Top bar: back button + actions ── */}
      <div className="rd-topbar">
        <button
          className="rd-back-btn"
          onClick={onBack}
          aria-label="Go back to Library"
        >
          ← Back to Library
        </button>

        <div className="rd-header-actions">
          {/* AI Analysis button */}
          <button
            className="rd-action-btn"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600 }}
            onClick={handleAnalyze}
            disabled={analyzing}
            aria-label={aiSummary ? "Analyze this resource again with AI" : "Analyze this resource with AI"}
          >
            {analyzing ? '✨ Analyzing...' : aiSummary ? '✨ Analyze Again' : '✨ Analyze with AI'}
          </button>

          {/* Bookmark — fully functional, persists to Firestore */}
          <button
            className={`rd-action-btn ${bookmarked ? 'rd-action-btn--active' : ''} ${bookmarkPopping ? 'icon-pop' : ''}`}
            aria-label={bookmarked ? 'Remove bookmark for this resource' : 'Bookmark this resource'}
            aria-pressed={Boolean(bookmarked)}
            onClick={handleBookmarkToggle}
          >
            {bookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}
          </button>

          {/* Delete — fully functional */}
          <button
            className="rd-action-btn rd-action-btn--danger"
            aria-label={`Delete ${title}`}
            onClick={handleDelete}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* ── Two-column layout: left content + right panel ── */}
      <div className="rd-body">

        {/* ════ LEFT COLUMN ════ */}
        <div className="rd-left">

          {/* ── Resource header card ── */}
          <div className="rd-hero card">
            <div
              className="rd-hero-icon"
              style={{ background: iconBg || '#e8f0e8' }}
              aria-hidden="true"
            >
              <span className="rd-hero-icon-emoji">{typeIcon || '📋'}</span>
              <span className="rd-hero-icon-label">
                {(type || 'DOC').toUpperCase().slice(0, 4)}
              </span>
            </div>

            <div className="rd-hero-info">
              <h1 className="rd-hero-title">{title}</h1>
              <p className="rd-hero-meta">
                <span className="rd-hero-meta-item">📁 {category || 'Uncategorized'}</span>
                <span className="rd-hero-meta-dot" aria-hidden="true"> • </span>
                <span className="rd-hero-meta-item">{type || 'Document'}</span>
                {createdAt && (
                  <>
                    <span className="rd-hero-meta-dot" aria-hidden="true"> • </span>
                    <span className="rd-hero-meta-item">Added {formatDate(createdAt)}</span>
                  </>
                )}
              </p>

              {/* Tags row */}
              {tags.length > 0 && (
                <div className="rd-tag-row" aria-label="Resource tags">
                  {tags.map((tag) => (
                    <span key={tag} className="rd-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Description / Summary card ── */}
          <section className="card rd-section" aria-labelledby="rd-summary-heading">
            <h2 id="rd-summary-heading" className="rd-section-title">
              <span className="rd-section-icon" aria-hidden="true">≡</span>
              Description
            </h2>
            {displaySummary ? (
              <p className="rd-summary-text">{displaySummary}</p>
            ) : (
              <p className="rd-empty-hint">No description added for this resource yet.</p>
            )}
          </section>

          {/* ── AI Analysis Card ── */}
          {(aiSummary || aiError || analyzing) && (
            <section className="card rd-section rd-ai-section" aria-labelledby="rd-ai-heading">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 id="rd-ai-heading" className="rd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                  <span aria-hidden="true">✨</span> AI Analysis
                </h2>
                {aiAnalyzedAt && !analyzing && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Analyzed on {formatDate(aiAnalyzedAt)}
                  </span>
                )}
              </div>

              {analyzing && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div className="rd-ai-spinner" aria-hidden="true"></div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Analyzing resource with Gemini...</p>
                </div>
              )}

              {aiError && !analyzing && (
                <div style={{ padding: '12px 16px', background: '#fde8e0', color: '#c0392b', borderRadius: 'var(--radius-sm)', border: '1px solid #f8d7da', fontSize: '0.85rem', marginBottom: '16px' }} role="alert">
                  <strong>Status:</strong> {aiError}
                </div>
              )}

              {aiSummary && !analyzing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Summary */}
                  <div>
                    <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '6px' }}>Summary</h3>
                    <p className="rd-summary-text" style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--color-text-primary)' }}>{aiSummary}</p>
                  </div>

                  {/* Category & Tags in a grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '6px' }}>AI Category</h3>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>{aiCategory || 'Not specified'}</p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '6px' }}>AI Tags</h3>
                      {aiTags.length > 0 ? (
                        <div className="rd-tag-row" style={{ marginTop: '4px' }}>
                          {aiTags.map(tag => <span key={tag} className="rd-tag">{tag}</span>)}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None</p>
                      )}
                    </div>
                  </div>

                  {/* Important Information */}
                  <div>
                    <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '8px' }}>Important Information</h3>
                    {aiImportantInformation.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                        {aiImportantInformation.map((info, idx) => <li key={idx}>{info}</li>)}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not specified</p>
                    )}
                  </div>

                  {/* Deadline & Action Items in a grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '6px' }}>AI Deadline</h3>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: aiDeadline ? '600' : 'normal', color: aiDeadline ? '#c0392b' : 'var(--color-text-primary)' }}>
                        {aiDeadline ? `📅 ${aiDeadline}` : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '8px' }}>Action Items</h3>
                      {aiActionItems.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                          {aiActionItems.map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not specified</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Source URL card (if applicable) ── */}
          {sourceUrl && (
            <section className="card rd-section" aria-labelledby="rd-url-heading">
              <h2 id="rd-url-heading" className="rd-section-title">
                <span className="rd-section-icon" aria-hidden="true">🔗</span>
                Source URL
              </h2>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rd-source-link"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                  fontSize: '0.875rem',
                }}
                aria-label={`Open source URL: ${sourceUrl}`}
              >
                {sourceUrl}
              </a>
            </section>
          )}

          {/* ── Tags card ── */}
          <section className="card rd-section" aria-labelledby="rd-tags-heading">
            <h2 id="rd-tags-heading" className="rd-section-title">Tags</h2>
            {tags.length > 0 ? (
              <div className="rd-tag-row">
                {tags.map((tag) => (
                  <span key={tag} className="rd-tag">{tag}</span>
                ))}
              </div>
            ) : (
              <p className="rd-empty-hint">No tags added for this resource.</p>
            )}
          </section>

        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="rd-right">

          {/* ── Document Preview (visual placeholder — no file storage in scope) ── */}
          <section className="card rd-section rd-preview-card" aria-labelledby="rd-preview-heading">
            <div className="rd-preview-header">
              <h2 id="rd-preview-heading" className="rd-section-title">
                <span aria-hidden="true">👁</span> Document Preview
              </h2>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rd-icon-btn"
                  aria-label="Open source URL in new tab"
                  style={{ textDecoration: 'none' }}
                >
                  ↗
                </a>
              )}
            </div>

            {/* Styled placeholder document */}
            <div
              className="rd-preview-area"
              role="img"
              aria-label={`Document preview placeholder for ${title}`}
            >
              <div className="rd-preview-doc">
                <div className="rd-preview-doc-title">{title.replace(/\.[^.]+$/, '')}</div>
                <div className="rd-preview-doc-line rd-preview-doc-line--heading">1. Introduction</div>
                <div className="rd-preview-doc-line"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text rd-preview-doc-line--short"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text"></div>
                <div className="rd-preview-doc-line"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--heading">2. Key Concepts</div>
                <div className="rd-preview-doc-line"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text rd-preview-doc-line--short"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text"></div>
                <div className="rd-preview-doc-line rd-preview-doc-line--text rd-preview-doc-line--medium"></div>
                <div className="rd-preview-doc-line"></div>
              </div>
            </div>

            {/* Navigation controls (functional UI) */}
            <div className="rd-preview-controls" aria-label="Document page navigation">
              <button
                className="rd-preview-ctrl-btn"
                onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="rd-preview-page-info" aria-live="polite">
                {previewPage} / {totalPages}
              </span>
              <button
                className="rd-preview-ctrl-btn"
                onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                disabled={previewPage >= totalPages}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          </section>

          {/* ── Resource Metadata ── */}
          <section className="card rd-section rd-source-card" aria-labelledby="rd-source-heading">
            <h2 id="rd-source-heading" className="rd-section-title">
              <span aria-hidden="true">📁</span> Resource Info
            </h2>

            <dl className="rd-source-list">
              <div className="rd-source-row">
                <dt className="rd-source-label">Title</dt>
                <dd className="rd-source-value">{title}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">Category</dt>
                <dd className="rd-source-value">{category || '—'}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">Type</dt>
                <dd className="rd-source-value">{type || '—'}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">Added</dt>
                <dd className="rd-source-value">{formatDate(createdAt)}</dd>
              </div>
              {sourceUrl && (
                <div className="rd-source-row">
                  <dt className="rd-source-label">Source</dt>
                  <dd className="rd-source-value" style={{ wordBreak: 'break-all' }}>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      Open link ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

        </div>
      </div>
    </main>
  );
}

export default ResourceDetails;
