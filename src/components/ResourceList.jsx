import React, { useState } from 'react';
import { Bookmark, MoreHorizontal } from 'lucide-react';
import './ResourceList.css';

/**
 * ResourceList — "Recent Resources" card on the Dashboard.
 *
 * Props:
 *   resources        — full resources array from Firestore / demo data (passed from Dashboard)
 *   onNavigate       — function(pageId) to navigate between pages
 *   onToggleBookmark — function(resourceId) to toggle bookmark (persists to Firestore for real users)
 *
 * Shows the 5 most recent resources (first 5 from the array, which is already sorted
 * newest-first by the Firestore query). If there are no resources, shows an empty state.
 */
function ResourceList({ resources = [], onNavigate, onToggleBookmark }) {
  const [poppingId, setPoppingId] = useState(null);

  // Show up to 5 most recent resources (array is already newest-first from Firestore)
  const recent = resources.slice(0, 5);

  function handleToggle(e, resource) {
    e.stopPropagation();
    setPoppingId(resource.id);
    setTimeout(() => setPoppingId(null), 240);
    if (onToggleBookmark) onToggleBookmark(resource.id);
  }

  return (
    <div className="card resource-list-card">
      <div className="card-header">
        <h2 className="card-title">Recent Resources</h2>
        <button
          className="view-all-btn"
          aria-label="View all resources in Library"
          onClick={() => onNavigate && onNavigate('library')}
        >
          View all
        </button>
      </div>

      {recent.length === 0 ? (
        <div
          style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}
          role="status"
          aria-live="polite"
        >
          <p style={{ marginBottom: '0.5rem' }}>No resources yet.</p>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
            onClick={() => onNavigate && onNavigate('library')}
          >
            Add your first resource →
          </button>
        </div>
      ) : (
        <ul className="resource-list" role="list" aria-label="Recent resources">
          {recent.map((resource) => {
            const isBookmarked = Boolean(resource.bookmarked);
            const isPopping    = poppingId === resource.id;

            return (
              <li key={resource.id} className="resource-item">
                {/* Type icon box */}
                <div
                  className="resource-icon"
                  style={{ background: resource.iconBg || '#e8f0e8' }}
                  aria-hidden="true"
                >
                  {resource.typeIcon || '📋'}
                </div>

                {/* Title + category */}
                <div className="resource-info">
                  <span className="resource-title">{resource.title}</span>
                  <span className="resource-meta">
                    {resource.category || 'Uncategorized'} &bull; {resource.type || 'Document'}
                  </span>
                </div>

                {/* Actions */}
                <div className="resource-actions">
                  <button
                    className={`resource-icon-btn ${isBookmarked ? 'resource-bookmark--active' : ''} ${isPopping ? 'icon-pop' : ''}`}
                    aria-label={isBookmarked ? `Remove bookmark for ${resource.title}` : `Bookmark ${resource.title}`}
                    aria-pressed={isBookmarked}
                    onClick={(e) => handleToggle(e, resource)}
                  >
                    <Bookmark
                      size={13}
                      strokeWidth={isBookmarked ? 2.5 : 2}
                      fill={isBookmarked ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ResourceList;
