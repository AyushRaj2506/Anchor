import React from 'react';
import './DeadlineList.css';

/**
 * Mock deadline data.
 * priority can be: 'high' | 'medium' | 'low'
 */
const DEADLINES = [
  {
    id: 1,
    month: 'MAY',
    day: '15',
    title: 'DBMS Assignment',
    remaining: 'Tomorrow, 11:59 PM',
    priority: 'high',
    remainingColor: '#c0392b', // red = urgent
  },
  {
    id: 2,
    month: 'MAY',
    day: '17',
    title: 'OS Lab Record',
    remaining: '2 days left',
    priority: 'medium',
    remainingColor: '#c97b5a', // terracotta = moderate
  },
  {
    id: 3,
    month: 'MAY',
    day: '20',
    title: 'AI Project Report',
    remaining: '5 days left',
    priority: 'medium',
    remainingColor: '#888',
  },
  {
    id: 4,
    month: 'MAY',
    day: '25',
    title: 'CN Presentation',
    remaining: '10 days left',
    priority: 'low',
    remainingColor: '#888',
  },
];

/** Map priority to a badge label + CSS class */
const PRIORITY_BADGE = {
  high:   { label: 'High',   className: 'badge--high' },
  medium: { label: 'Medium', className: 'badge--medium' },
  low:    { label: 'Low',    className: 'badge--low' },
};

function DeadlineList() {
  return (
    <div className="card deadline-card">
      <div className="card-header">
        <h2 className="card-title">Upcoming Deadlines</h2>
        <button className="view-all-btn" aria-label="View all deadlines">
          View all
        </button>
      </div>

      <ul className="deadline-list" role="list" aria-label="Upcoming deadlines">
        {DEADLINES.map((d) => {
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
