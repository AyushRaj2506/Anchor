import React, { useState } from 'react';
import { RESOURCE_DETAILS, DEFAULT_RESOURCE_DETAIL } from '../data/libraryData';
import './ResourceDetails.css';

/**
 * ResourceDetails — shows full information for a single resource.
 *
 * Props:
 *   resource   — the resource object from LIBRARY_RESOURCES (passed from Library/App)
 *   onBack     — function to call when "← Back to Library" is clicked
 *
 * How it works:
 *   - Gets the resource's base info (title, category, type, tags, time) from `resource` prop
 *   - Looks up richer mock detail (summary, action items, deadlines…) from RESOURCE_DETAILS
 *   - Action items have local checkbox state (useState) — not connected to a database yet
 *   - Document preview is a styled CSS placeholder — no PDF library needed
 */
function ResourceDetails({ resource, onBack }) {
  // Merge base resource with detail data (fall back to defaults for resources without details)
  const detail = RESOURCE_DETAILS[resource.id] || DEFAULT_RESOURCE_DETAIL;

  // Tags: start from the detail's tag list (may be richer than the library card tags)
  const initialTags = detail.tags.length > 0 ? detail.tags : (resource.tags || []);

  // Local state for interactive action items (checkboxes)
  const [actionItems, setActionItems] = useState(
    detail.actionItems.map((item) => ({ ...item }))
  );

  // Local page number state for the document preview controls (visual only)
  const [previewPage, setPreviewPage] = useState(1);
  const totalPages = detail.previewPages || 1;

  function toggleActionItem(id) {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  }

  function prevPage() {
    setPreviewPage((p) => Math.max(1, p - 1));
  }

  function nextPage() {
    setPreviewPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <main className="rd-page" id="main-content" tabIndex={-1}>

      {/* ── Back link ── */}
      <div className="rd-topbar">
        <button
          className="rd-back-btn"
          onClick={onBack}
          aria-label="Go back to Library"
        >
          ← Back to Library
        </button>

        {/* Header-level action buttons */}
        <div className="rd-header-actions">
          <button className="rd-action-btn" aria-label="Bookmark this resource">
            🔖 Bookmark
          </button>
          <button className="rd-action-btn" aria-label="Share this resource">
            ↗ Share
          </button>
          <button className="rd-action-btn rd-action-btn--icon" aria-label="More options">
            ⋯
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
              style={{ background: resource.iconBg }}
              aria-hidden="true"
            >
              <span className="rd-hero-icon-emoji">{resource.typeIcon}</span>
              <span className="rd-hero-icon-label">
                {resource.type.toUpperCase().slice(0, 4)}
              </span>
            </div>

            <div className="rd-hero-info">
              <h1 className="rd-hero-title">{resource.title}</h1>
              <p className="rd-hero-meta">
                <span className="rd-hero-meta-item">📁 {resource.category}</span>
                <span className="rd-hero-meta-dot" aria-hidden="true"> • </span>
                <span className="rd-hero-meta-item">{resource.type} Document</span>
                <span className="rd-hero-meta-dot" aria-hidden="true"> • </span>
                <span className="rd-hero-meta-item">Added {resource.time}</span>
              </p>

              {/* Tags row */}
              <div className="rd-tag-row" aria-label="Resource tags">
                {initialTags.map((tag) => (
                  <span key={tag} className="rd-tag">{tag}</span>
                ))}
                <button className="rd-tag-add" aria-label="Add a new tag">
                  + Add Tag
                </button>
              </div>
            </div>
          </div>

          {/* ── Summary card ── */}
          <section className="card rd-section" aria-labelledby="rd-summary-heading">
            <h2 id="rd-summary-heading" className="rd-section-title">
              <span className="rd-section-icon" aria-hidden="true">≡</span>
              Summary
            </h2>
            <p className="rd-summary-text">{detail.summary}</p>
          </section>

          {/* ── Two-column grid: Important Info + Deadlines ── */}
          <div className="rd-mid-grid">

            {/* Important Information */}
            <section className="card rd-section" aria-labelledby="rd-info-heading">
              <h2 id="rd-info-heading" className="rd-section-title">
                <span className="rd-section-icon rd-section-icon--green" aria-hidden="true">ℹ</span>
                Important Information
              </h2>
              <ul className="rd-bullet-list" aria-label="Important points">
                {detail.importantInfo.map((point, i) => (
                  <li key={i} className="rd-bullet-item">{point}</li>
                ))}
              </ul>
            </section>

            {/* Deadlines */}
            <section className="card rd-section" aria-labelledby="rd-deadlines-heading">
              <h2 id="rd-deadlines-heading" className="rd-section-title">
                <span className="rd-section-icon rd-section-icon--orange" aria-hidden="true">📅</span>
                Deadlines
              </h2>

              {detail.deadlines.length === 0 ? (
                <p className="rd-empty-hint">No deadlines linked yet.</p>
              ) : (
                <ul className="rd-deadline-list" aria-label="Linked deadlines">
                  {detail.deadlines.map((dl) => (
                    <li key={dl.id} className="rd-deadline-item">
                      <span className="rd-deadline-dot" aria-hidden="true">●</span>
                      <div className="rd-deadline-info">
                        <span className="rd-deadline-title">{dl.title}</span>
                        <span className="rd-deadline-date">{dl.date}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button className="rd-add-btn" aria-label="Add a deadline">
                + Add Deadline
              </button>
            </section>
          </div>

          {/* ── Action Items ── */}
          <section className="card rd-section" aria-labelledby="rd-actions-heading">
            <h2 id="rd-actions-heading" className="rd-section-title">
              <span className="rd-section-icon" aria-hidden="true">☰</span>
              Action Items
            </h2>

            {actionItems.length === 0 ? (
              <p className="rd-empty-hint">No action items yet.</p>
            ) : (
              <ul className="rd-action-list" aria-label="Action items">
                {actionItems.map((item) => (
                  <li key={item.id} className="rd-action-item">
                    <label className="rd-action-label">
                      <input
                        type="checkbox"
                        className="rd-checkbox"
                        checked={item.done}
                        onChange={() => toggleActionItem(item.id)}
                        aria-label={item.text}
                      />
                      <span className={`rd-action-text ${item.done ? 'rd-action-text--done' : ''}`}>
                        {item.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <button className="rd-add-btn" aria-label="Add an action item">
              + Add Action Item
            </button>
          </section>

          {/* ── Tags card ── */}
          <section className="card rd-section" aria-labelledby="rd-tags-heading">
            <h2 id="rd-tags-heading" className="rd-section-title">Tags</h2>
            <div className="rd-tag-row">
              {initialTags.map((tag) => (
                <span key={tag} className="rd-tag">{tag}</span>
              ))}
              <button className="rd-tag-add" aria-label="Add a new tag">
                + Add Tag
              </button>
            </div>
          </section>

        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="rd-right">

          {/* ── Document Preview ── */}
          <section className="card rd-section rd-preview-card" aria-labelledby="rd-preview-heading">
            <div className="rd-preview-header">
              <h2 id="rd-preview-heading" className="rd-section-title">
                <span aria-hidden="true">👁</span> Document Preview
              </h2>
              <button className="rd-icon-btn" aria-label="Open document in full screen">
                ↗
              </button>
            </div>

            {/* Styled placeholder document */}
            <div
              className="rd-preview-area"
              role="img"
              aria-label={`Document preview placeholder for ${resource.title}`}
            >
              <div className="rd-preview-doc">
                <div className="rd-preview-doc-title">{resource.title.replace(/\.[^.]+$/, '')}</div>
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

            {/* Navigation controls */}
            <div className="rd-preview-controls" aria-label="Document page navigation">
              <button
                className="rd-preview-ctrl-btn"
                onClick={prevPage}
                disabled={previewPage <= 1}
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="rd-preview-page-info" aria-live="polite">
                {previewPage} / {totalPages || 1}
              </span>
              <button
                className="rd-preview-ctrl-btn"
                onClick={nextPage}
                disabled={previewPage >= totalPages}
                aria-label="Next page"
              >
                →
              </button>
              <div className="rd-preview-zoom" aria-label="Zoom controls (visual placeholder)">
                <button className="rd-preview-ctrl-btn" aria-label="Zoom out">−</button>
                <span className="rd-preview-zoom-label">Zoom</span>
                <button className="rd-preview-ctrl-btn" aria-label="Zoom in">+</button>
              </div>
            </div>
          </section>

          {/* ── Source / Original Resource ── */}
          <section className="card rd-section rd-source-card" aria-labelledby="rd-source-heading">
            <h2 id="rd-source-heading" className="rd-section-title">
              <span aria-hidden="true">🔗</span> Source / Original Resource
            </h2>

            <dl className="rd-source-list">
              <div className="rd-source-row">
                <dt className="rd-source-label">File Name</dt>
                <dd className="rd-source-value">{detail.fileName}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">Uploaded</dt>
                <dd className="rd-source-value">{detail.uploadedOn}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">File Size</dt>
                <dd className="rd-source-value">{detail.fileSize}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">Uploaded By</dt>
                <dd className="rd-source-value">{detail.uploadedBy}</dd>
              </div>
            </dl>

            <button className="rd-download-btn" aria-label={`Download ${detail.fileName}`}>
              ↓ Download
            </button>
          </section>

        </div>
      </div>
    </main>
  );
}

export default ResourceDetails;
