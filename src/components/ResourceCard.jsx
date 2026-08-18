import React, { useState } from 'react';
import { Bookmark, MoreHorizontal } from 'lucide-react';
import './ResourceCard.css';

/**
 * ResourceCard — one row in the Library resource list.
 *
 * Props:
 *   resource — one item from LIBRARY_RESOURCES array
 *   onOpen   — called with the resource object when the user clicks the title/icon area
 *              (does NOT fire when bookmark or more-options buttons are clicked)
 *
 * Shows: type icon, title, category, type label, relative time, tags,
 *        bookmark button, more-options button.
 */
function ResourceCard({ resource, onOpen, onBookmarkToggle }) {
  const { id, title, category, type, typeIcon, iconBg, time, tags, bookmarked } = resource;
  const [popping, setPopping] = useState(false);

  function handleOpen() {
    if (onOpen) onOpen(resource);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  }

  function handleToggle(e) {
    e.stopPropagation();
    setPopping(true);
    setTimeout(() => setPopping(false), 240);
    if (onBookmarkToggle) onBookmarkToggle(id);
  }

  return (
    <li className="rc-item">
      {/* ── Clickable area: icon + body → opens Resource Details ── */}
      <div
        className="rc-clickable"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${title}`}
      >
        {/* Icon box */}
        <div
          className="rc-icon"
          style={{ background: iconBg }}
          aria-hidden="true"
        >
          <span className="rc-icon-emoji">{typeIcon}</span>
          <span className="rc-icon-label">{type.toUpperCase().slice(0, 4)}</span>
        </div>

        {/* Main info */}
        <div className="rc-body">
          <span className="rc-title">{title}</span>
          <span className="rc-meta">
            {category}
            <span className="rc-meta-dot" aria-hidden="true"> • </span>
            {type}
            <span className="rc-meta-dot" aria-hidden="true"> • </span>
            {time}
          </span>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="rc-tags" aria-label={`Tags: ${tags.join(', ')}`}>
              {tags.map((tag) => (
                <span key={tag} className="rc-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions: bookmark + more (separate from clickable area) ── */}
      <div className="rc-actions">
        <button
          className={`rc-btn rc-bookmark ${bookmarked ? 'rc-bookmark--active' : ''} ${popping ? 'icon-pop' : ''}`}
          aria-label={bookmarked ? `Remove bookmark for ${title}` : `Bookmark ${title}`}
          aria-pressed={bookmarked}
          onClick={handleToggle}
        >
          <Bookmark size={15} strokeWidth={bookmarked ? 2.5 : 2} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <button
          className="rc-btn rc-more"
          aria-label={`More options for ${title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default ResourceCard;
