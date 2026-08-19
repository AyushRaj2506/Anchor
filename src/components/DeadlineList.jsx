import React from 'react';
import './DeadlineList.css';

/**
 * Mock deadline data.
 * priority can be: 'high' | 'medium' | 'low'
 */
function getRemaining(deadlineMs) {
  const now = Date.now();
  const diff = deadlineMs - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days left`;
}

function getRemainingColor(days) {
  if (days <= 1) return '#c0392b';
  if (days <= 3) return '#c97b5a';
  return '#888';
}

/** Map priority to a badge label + CSS class */
const PRIORITY_BADGE = {
  high:   { label: 'High',   className: 'badge--high' },
  medium: { label: 'Medium', className: 'badge--medium' },
  low:    { label: 'Low',    className: 'badge--low' },
};

function DeadlineList({ tasks = [], onNavigate }) {
  const upcoming = tasks
    .filter(t => t.deadlineMs && t.status !== 'completed')
    .sort((a, b) => a.deadlineMs - b.deadlineMs)
    .slice(0, 4)
    .map(t => {
      const date = new Date(t.deadlineMs);
      const diff = t.deadlineMs - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return {
        id: t.id,
        month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        day: date.getDate().toString(),
        title: t.title,
        remaining: getRemaining(t.deadlineMs),
        priority: t.priority?.toLowerCase() || 'low',
        remainingColor: getRemainingColor(days)
      };
    });
  return (
    <div className="card deadline-card">
      <div className="card-header">
        <h2 className="card-title">Upcoming Deadlines</h2>
        <button
          className="view-all-btn"
          aria-label="View all tasks and deadlines"
          onClick={() => onNavigate && onNavigate('tasks')}
        >
          View all
        </button>
      </div>

      <ul className="deadline-list" role="list" aria-label="Upcoming deadlines">
        {upcoming.length === 0 ? (
           <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>No upcoming deadlines.</p>
        ) : upcoming.map((d) => {
          const badge = PRIORITY_BADGE[d.priority];
          return (
            <li key={d.id} className="deadline-item">
              {/* Date block */}
              <div className="deadline-date" aria-label={`${d.month} ${d.day}`}>
                <span className="deadline-month">{d.month}</span>
                <span className="deadline-day">{d.day}</span>
              </div>

              {/* Title + remaining */}
              <div className="deadline-info">
                <span className="deadline-title">{d.title}</span>
                <span
                  className="deadline-remaining"
                  style={{ color: d.remainingColor }}
                >
                  {d.remaining}
                </span>
              </div>

              {/* Priority badge */}
              <span
                className={`priority-badge ${badge.className}`}
                aria-label={`Priority: ${badge.label}`}
              >
                {badge.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DeadlineList;
