import React, { useState } from 'react';
import { Bookmark, MoreHorizontal } from 'lucide-react';
import './ResourceList.css';

/**
 * Mock resource data for the Dashboard.
 * In future milestones this will come from a real database.
 */
const RECENT_RESOURCES = [
  {
    id: 1,
    title: 'Database Normalization.pdf',
    category: 'DBMS',
    type: 'PDF',
    typeIcon: '📄',
    iconBg: '#fde8e0',
    time: '2h ago',
  },
  {
    id: 2,
    title: 'Operating System – Important Notes',
    category: 'OS',
    type: 'Note',
    typeIcon: '📝',
    iconBg: '#e3f0e3',
    time: 'Yesterday',
  },
  {
    id: 3,
    title: 'CN Topology Diagram.png',
    category: 'Computer Networks',
    type: 'Image',
    typeIcon: '🖼',
    iconBg: '#e0ebf5',
    time: '2 days ago',
  },
  {
    id: 4,
    title: 'React useEffect Explained',
    category: 'Web Dev',
    type: 'URL',
    typeIcon: '🔗',
    iconBg: '#fef4e0',
    time: '3 days ago',
  },
  {
    id: 5,
    title: 'AI Project Requirements.md',
    category: 'AI',
    type: 'Note',
    typeIcon: '📋',
    iconBg: '#ede3f5',
    time: '5 days ago',
  },
];

function ResourceList() {
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const [poppingId, setPoppingId] = useState(null);

  function toggleBookmark(id) {
    setBookmarkedIds(prev => ({ ...prev, [id]: !prev[id] }));
    setPoppingId(id);
    setTimeout(() => setPoppingId(null), 240);
  }

  return (
    <div className="card resource-list-card">
      <div className="card-header">
        <h2 className="card-title">Recent Resources</h2>
        <button className="view-all-btn" aria-label="View all resources">
          View all
        </button>
      </div>

      <ul className="resource-list" role="list" aria-label="Recent resources">
        {RECENT_RESOURCES.map((resource) => {
          const isBookmarked = Boolean(bookmarkedIds[resource.id]);
          const isPopping = poppingId === resource.id;

          return (
            <li key={resource.id} className="resource-item">
              {/* Type icon box */}
              <div
                className="resource-icon"
                style={{ background: resource.iconBg }}
                aria-hidden="true"
              >
                {resource.typeIcon}
              </div>

              {/* Title + category */}
              <div className="resource-info">
                <span className="resource-title">{resource.title}</span>
                <span className="resource-meta">
                  {resource.category} &bull; {resource.type}
                </span>
              </div>

              {/* Time + actions */}
              <div className="resource-actions">
                <span className="resource-time">{resource.time}</span>
                <button
                  className={`resource-icon-btn ${isBookmarked ? 'resource-bookmark--active' : ''} ${isPopping ? 'icon-pop' : ''}`}
                  aria-label={isBookmarked ? `Remove bookmark for ${resource.title}` : `Bookmark ${resource.title}`}
                  aria-pressed={isBookmarked}
                  onClick={() => toggleBookmark(resource.id)}
                >
                  <Bookmark
                    size={13}
                    strokeWidth={isBookmarked ? 2.5 : 2}
                    fill={isBookmarked ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </button>
                <button
                  className="resource-icon-btn"
                  aria-label={`More options for ${resource.title}`}
                >
                  <MoreHorizontal size={13} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ResourceList;
