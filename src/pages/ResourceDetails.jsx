import React, { useState, useEffect } from 'react';
import './ResourceDetails.css';
import { analyzeResource, analyzeResourceFile } from '../services/ai';
import { auth } from '../config/firebase';
import { getDownloadUrl } from '../services/storage';

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
function ResourceDetails({ resource, onBack, onToggleBookmark, onDeleteResource, onUpdateResource, onCreateTasksFromAnalysis, onNavigate }) {
  const {
    id,
    title,
    category,
    type,
    typeIcon,
    iconBg,
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
  const [taskNotification, setTaskNotification] = useState(null); // e.g. "AI found 2 action items and created 2 tasks."

  // Signed URL state
  const [signedUrl, setSignedUrl] = useState(null);

  // Fetch signed download URL if resource is saved in Supabase
  useEffect(() => {
    const isDemo = JSON.parse(localStorage.getItem('anchor-user') || '{}').isDemo;
    if (resource.storagePath && !isDemo && auth.currentUser) {
      let active = true;
      async function fetchSignedUrl() {
        try {
          const idToken = await auth.currentUser.getIdToken();
          const url = await getDownloadUrl(resource.storagePath, idToken);
          if (active) {
            setSignedUrl(url);
          }
        } catch (err) {
          console.error('Failed to fetch signed download URL:', err);
        }
      }
      fetchSignedUrl();
      return () => { active = false; };
    }
  }, [resource.storagePath]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setAiError(null);
    setTaskNotification(null);

    const isDemo = JSON.parse(localStorage.getItem('anchor-user') || '{}').isDemo;
    const hasRealFile = resource.storagePath && !isDemo && auth.currentUser;

    try {
      let result;

      if (hasRealFile && (resource.fileType === 'application/pdf' ||
                          resource.fileType === 'image/jpeg' ||
                          resource.fileType === 'image/png' ||
                          resource.fileType === 'image/webp')) {
        // Real file: send actual bytes to Gemini via authenticated backend
        const idToken = await auth.currentUser.getIdToken();
        result = await analyzeResourceFile(
          {
            resourceId: id,
            storagePath: resource.storagePath,
            fileType: resource.fileType,
            fileName: resource.fileName,
          },
          idToken
        );
      } else {
        // Demo mode or non-file resource: fall back to metadata-based analysis
        result = await analyzeResource(resource);
      }

      // Persist AI results to Firestore
      try {
        if (onUpdateResource) {
          await onUpdateResource(id, {
            aiSummary:             result.summary,
            aiCategory:            result.category,
            aiTags:                result.tags,
            aiImportantInformation: result.importantInformation,
            aiDeadline:            result.deadline ?? null,
            aiActionItems:         result.actionItems,
            // New fields from real file analysis
            contentText:           result.contentText ?? null,
            contentTruncated:      result.contentTruncated ?? false,
            deadlines:             result.deadlines ?? [],
          });
        }
      } catch (firestoreError) {
        console.error('Firestore save failed:', firestoreError);
        throw new Error('FIRESTORE_SAVE_FAILED');
      }

      // Auto-create tasks from action items
      if (onCreateTasksFromAnalysis && result.actionItems && result.actionItems.length > 0) {
        try {
          const createdCount = await onCreateTasksFromAnalysis(
            id,
            result.actionItems,
            result.category || category
          );
          if (createdCount > 0) {
            setTaskNotification(`✅ AI found ${result.actionItems.length} action item${result.actionItems.length !== 1 ? 's' : ''} and created ${createdCount} task${createdCount !== 1 ? 's' : ''}.`);
          } else {
            setTaskNotification('✅ AI analysis complete. Action items were already in your tasks.');
          }
        } catch (taskErr) {
          console.error('Task creation from analysis failed:', taskErr);
          setTaskNotification('✅ AI analysis complete. Tasks could not be created automatically.');
        }
      } else {
        setTaskNotification('✅ AI analysis complete. No action items found.');
      }

      // Auto-dismiss notification after 6 seconds
      setTimeout(() => setTaskNotification(null), 6000);

    } catch (err) {
      console.error('AI Analysis failed:', err);
      if (err.message === 'FIRESTORE_SAVE_FAILED') {
        setAiError('AI analysis completed, but it could not be saved. Please try again.');
      } else {
        setAiError('AI analysis is temporarily unavailable. Your resource was not affected.');
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

  const tags = Array.isArray(resource.tags) 
    ? resource.tags 
    : (typeof resource.tags === 'string' && resource.tags.trim() ? resource.tags.split(',').map(t=>t.trim()).filter(Boolean) : []);

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

      {/* ── Task notification banner ── */}
      {taskNotification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 20px',
            background: 'var(--color-green-soft, #e8f0e8)',
            color: 'var(--color-text-primary)',
            borderLeft: '3px solid var(--color-accent)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>{taskNotification}</span>
          <button
            onClick={() => setTaskNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-text-muted)', lineHeight: 1 }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* ── AI Error banner ── */}
      {aiError && (
        <div
          role="alert"
          style={{
            padding: '12px 20px',
            background: 'var(--color-danger-bg, #fde8e0)',
            color: 'var(--color-danger, #c0392b)',
            borderLeft: '3px solid var(--color-danger, #c0392b)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>⚠️ {aiError}</span>
          <button
            onClick={() => setAiError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit', lineHeight: 1 }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

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
                <span className="rd-hero-meta-item">{category || 'Uncategorized'}</span>
                <span className="rd-hero-meta-dot" aria-hidden="true"> · </span>
                <span className="rd-hero-meta-item">{type || 'Document'}</span>
                {createdAt && (
                  <>
                    <br />
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

          {/* ── Document Preview (renders actual file via signed URL, or visual placeholder) ── */}
          <section className="card rd-section rd-preview-card" aria-labelledby="rd-preview-heading">
            <div className="rd-preview-header">
              <h2 id="rd-preview-heading" className="rd-section-title">
                <span aria-hidden="true">👁</span> Document Preview
              </h2>
              {(signedUrl || sourceUrl) && (
                <a
                  href={signedUrl || sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rd-icon-btn"
                  aria-label={signedUrl ? "Open document in new tab" : "Open source URL in new tab"}
                  style={{ textDecoration: 'none' }}
                >
                  ↗
                </a>
              )}
            </div>

            {/* Display private Image, PDF details, or default styled mock markup */}
            {resource.storagePath && type === 'Image' ? (
              <div className="rd-preview-area rd-preview-image">
                {signedUrl ? (
                  <img
                    src={signedUrl}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                  />
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading image...</div>
                )}
              </div>
            ) : resource.storagePath && type === 'PDF' ? (
              <div className="rd-preview-area rd-preview-pdf">
                <span className="rd-pdf-icon" aria-hidden="true">📄</span>
                <div className="rd-pdf-info">
                  <p className="rd-pdf-filename">{resource.fileName || `${title}.pdf`}</p>
                  <p className="rd-pdf-type">PDF Document</p>
                  <p className="rd-pdf-size">{resource.fileSize || 'Unknown Size'}</p>
                </div>
                <div className="rd-pdf-actions">
                  <a
                    href={signedUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rd-pdf-btn rd-pdf-btn-primary ${!signedUrl ? 'disabled' : ''}`}
                  >
                    Open PDF
                  </a>
                  <button
                    onClick={() => {
                      if (signedUrl) {
                        const a = document.createElement('a');
                        a.href = signedUrl;
                        a.download = resource.fileName || `${title}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                    className="rd-pdf-btn rd-pdf-btn-secondary"
                    disabled={!signedUrl}
                  >
                    Download
                  </button>
                </div>
              </div>
            ) : (type === 'Note' || type === 'Document') ? (
              <div className="rd-preview-area rd-preview-text" style={{ padding: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '600px', overflowY: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  {resource.content || 'No content provided.'}
                </pre>
              </div>
            ) : (type === 'Email') ? (
              <div className="rd-preview-area rd-preview-email" style={{ padding: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '600px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  <div style={{ marginBottom: '0.5rem' }}><strong>From:</strong> {resource.emailSender || 'Unknown'}</div>
                  <div><strong>Subject:</strong> {resource.emailSubject || 'No Subject'}</div>
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  {resource.content || 'No email body provided.'}
                </pre>
              </div>
            ) : (type === 'URL' || type === 'Google Drive') ? (
              <div className="rd-preview-area rd-preview-link" style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span aria-hidden="true" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}>{type === 'Google Drive' ? '📂' : '🔗'}</span>
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>This resource is a {type}.</p>
                {sourceUrl ? (
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: 'var(--accent)', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
                    Open {type}
                  </a>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No URL provided.</p>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </section>

          {/* ── Resource Metadata ── */}
          <section className="card rd-section rd-source-card" aria-labelledby="rd-source-heading">
            <h2 id="rd-source-heading" className="rd-section-title">
              <span aria-hidden="true">📁</span> Resource Info
            </h2>

            <dl className="rd-source-list">
              <div className="rd-source-row">
                <dt className="rd-source-label">TITLE</dt>
                <dd className="rd-source-value">{title}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">CATEGORY</dt>
                <dd className="rd-source-value">{category || '—'}</dd>
              </div>
              <div className="rd-source-row">
                <dt className="rd-source-label">TYPE</dt>
                <dd className="rd-source-value">{type || '—'}</dd>
              </div>
              {(resource.fileName || resource.storagePath) && (
                <div className="rd-source-row">
                  <dt className="rd-source-label">FILE</dt>
                  <dd className="rd-source-value">{resource.fileName || 'Unknown File'}</dd>
                </div>
              )}
              {resource.fileSize && (
                <div className="rd-source-row">
                  <dt className="rd-source-label">SIZE</dt>
                  <dd className="rd-source-value">{resource.fileSize}</dd>
                </div>
              )}
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
