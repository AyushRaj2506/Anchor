import React, { useEffect, useRef, useState } from 'react';
import './TaskOverview.css';

/**
 * TaskOverview — shows task counts with a CSS-only animated donut chart.
 *
 * The ring animates from a "blank" state to the final conic-gradient
 * by interpolating the progress from 0 → 1 over ~800ms on mount.
 * Respects prefers-reduced-motion by skipping the animation.
 */



// Build conic-gradient string from task array, scaled by `progress` (0–1)
function buildGradient(tasks, total, progress) {
  let angle = 0;
  const parts = tasks.map((t) => {
    const degrees = (t.count / total) * 360 * progress;
    const start   = angle;
    const end     = angle + degrees;
    angle = end;
    return `${t.color} ${start}deg ${end}deg`;
  });

  // If progress < 1, fill remaining with the bg color so the ring
  // looks like it's drawing rather than showing partial segments
  if (progress < 1) {
    parts.push(`var(--color-border) ${angle}deg 360deg`);
  }

  return `conic-gradient(${parts.join(', ')})`;
}

function TaskOverview({ tasks = [] }) {
  const [progress, setProgress] = useState(0);
  const rafRef   = useRef(null);
  const startRef = useRef(null);
  const DURATION = 800; // ms

  const todo = tasks.filter(t => t.status === 'todo').length;
  const inprogress = tasks.filter(t => t.status === 'inprogress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;

  const breakdown = [
    { label: 'To Do',       count: todo,  color: '#7faa7f' },
    { label: 'In Progress', count: inprogress,  color: '#c97b5a' },
    { label: 'Completed',   count: completed,  color: '#b0bec5' },
  ];

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setProgress(1); return; }

    function step(timestamp) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const p = Math.min(elapsed / DURATION, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    }

    // Small delay so it fires after the page-enter animation finishes
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, 180);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const gradient = buildGradient(breakdown, total || 1, progress);

  return (
    <div className="card task-overview-card">
      <h2 className="card-title" style={{ marginBottom: '16px' }}>
        Tasks Overview
      </h2>

      <div className="task-overview-body">
        {/* CSS Donut chart */}
        <div className="donut-wrapper" aria-hidden="true">
          <div
            className="donut"
            style={{ background: gradient }}
          />
          <div className="donut-hole">
            <span className="donut-total">{total}</span>
            <span className="donut-total-label">Total</span>
          </div>
        </div>

        {/* Legend */}
        <ul className="task-legend" role="list" aria-label="Task breakdown">
          {breakdown.map((t) => (
            <li key={t.label} className="task-legend-item">
              <span
                className="task-legend-dot"
                style={{ background: t.color }}
                aria-hidden="true"
              />
              <span className="task-legend-count">{t.count}</span>
              <span className="task-legend-label">{t.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TaskOverview;
