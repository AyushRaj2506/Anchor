import React, { useState } from 'react';
import { Bookmark, Trash2, Check, Folder, Calendar } from 'lucide-react';
import './TaskCard.css';

/**
 * TaskCard — a single task card inside a Kanban column.
 *
 * Props:
 *   task           — one task object
 *   onUpdateStatus — function(newStatus) — called when status dropdown changes
 *   onDelete       — function() — called when delete is confirmed
 *   onUpdateTask   — function(taskId, updates) — called for any task field updates
 *                    (used for bookmark toggle to persist to Firestore)
 */

const PRIORITY_CLASS = {
  High:   'tc-badge--high',
  Medium: 'tc-badge--medium',
  Low:    'tc-badge--low',
};

function TaskCard({ task, onUpdateStatus, onDelete, onUpdateTask }) {
  const {
    id, title, category, status,
    priority, deadline, completedOn, bookmarked,
  } = task;

  const isCompleted  = status === 'completed';
  const isBookmarked = Boolean(bookmarked);
  const [popping, setPopping] = useState(false);

  function handleBookmark(e) {
    e.stopPropagation();
    setPopping(true);
    setTimeout(() => setPopping(false), 240);
    // Persist bookmark toggle via onUpdateTask if provided (Firestore for real users)
    if (onUpdateTask) {
      onUpdateTask(id, { bookmarked: !isBookmarked });
    }
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (window.confirm(`Delete task "${title}"?`)) {
      if (onDelete) onDelete(id);
    }
  }

  function handleStatusChange(e) {
    e.stopPropagation();
    if (onUpdateStatus) onUpdateStatus(e.target.value);
  }

  return (
    <article
      className={`tc-card ${isCompleted ? 'tc-card--completed' : ''}`}
      aria-label={`Task: ${title}`}
    >
      {/* ── Title row ── */}
      <div className="tc-top">
        {isCompleted && (
          <span className="tc-check" aria-label="Completed">
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          </span>
        )}
        <span className={`tc-title ${isCompleted ? 'tc-title--done' : ''}`}>
          {title}
        </span>

        <div className="tc-actions">
          <button
            className={`tc-btn tc-bookmark ${isBookmarked ? 'tc-bookmark--active' : ''} ${popping ? 'icon-pop' : ''}`}
            aria-label={isBookmarked ? `Remove bookmark for ${title}` : `Bookmark ${title}`}
            aria-pressed={isBookmarked}
            onClick={handleBookmark}
          >
            <Bookmark size={13} strokeWidth={isBookmarked ? 2.5 : 2} fill={isBookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <select
            value={status}
            onChange={handleStatusChange}
            onClick={e => e.stopPropagation()}
            style={{
              padding: '2px 4px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
            aria-label={`Change status for ${title}`}
          >
            <option value="todo">To Do</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Done</option>
          </select>
          <button
            className="tc-btn tc-more"
            aria-label={`Delete task ${title}`}
            onClick={handleDelete}
          >
            <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Category ── */}
      <div className="tc-category" aria-label={`Category: ${category}`}>
        <span className="tc-category-icon" aria-hidden="true">
          <Folder size={12} strokeWidth={2} />
        </span>
        <span className="tc-category-label">{category}</span>
      </div>

      {/* ── Deadline / Completion date + Priority badge ── */}
      <div className="tc-footer">
        {isCompleted ? (
          <span className="tc-date tc-date--completed">
            <Check size={11} strokeWidth={2.5} aria-hidden="true" /> {completedOn || 'Completed'}
          </span>
        ) : (
          <span className="tc-date">
            <Calendar size={11} strokeWidth={2} className="tc-date-icon" aria-hidden="true" />
            {deadline || 'No deadline'}
          </span>
        )}

        <span
          className={`tc-badge ${PRIORITY_CLASS[priority] || ''}`}
          aria-label={`Priority: ${priority}`}
        >
          {priority}
        </span>
      </div>
    </article>
  );
}

export default TaskCard;
