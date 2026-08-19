import React, { useState } from 'react';
import './ResourceDetails.css';

/**
 * ResourceDetails — shows full information for a single resource.
 *
 * Props:
 *   resource         — the resource object from Firestore (passed from Library/App)
 *   onBack           — function to call when "← Back to Library" is clicked
 *   onToggleBookmark — function(resourceId) to toggle bookmark state (persists to Firestore)
 *   onDeleteResource — function(resourceId) to delete this resource
 *   onNavigate       — function(pageId) to navigate between pages
 *
 * How it works:
 *   - Shows data from the resource object itself (title, category, type, tags, description, sourceUrl)
 *   - For real Firestore resources, fields like description may not exist — graceful fallbacks shown
 *   - Action items are local UI state only (future milestone for persistence)
 *   - Document preview is a styled CSS placeholder — no PDF library in scope
 */
function ResourceDetails({ resource, onBack, onToggleBookmark, onDeleteResource, onNavigate }) {
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
  } = resource;

  // Bookmark pop animation
  const [bookmarkPopping, setBookmarkPopping] = useState(false);

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
