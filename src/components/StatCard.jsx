import React, { useState, useEffect, useRef } from 'react';
import './StatCard.css';

/**
 * useCountUp — animates a number from 0 to `target` over `duration` ms.
 * Only runs once on mount. Respects prefers-reduced-motion.
 */
function useCountUp(target, duration = 600) {
  const [count, setCount] = useState(0);
  const rafRef   = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    // Skip animation if reduced motion is preferred
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof target !== 'number') {
      setCount(target);
      return;
    }

    const numericTarget = Number(target);
    if (isNaN(numericTarget)) { setCount(target); return; }

    setCount(0);

    function step(timestamp) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased    = 1 - Math.pow(1 - progress, 2);
      setCount(Math.round(eased * numericTarget));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return typeof target === 'number' ? count : target;
}

/**
 * StatCard — one of the summary cards at the top of the dashboard.
 *
 * Props:
 *   icon      — emoji/icon shown in the icon box
 *   label     — card title (e.g. "Resources")
 *   value     — number to animate up to (numeric) or static string
 *   sub       — small subtitle text
 *   subColor  — optional CSS color for subtitle
 *   iconBg    — optional background color for icon box
 *   countDuration — duration in ms for count-up animation (default 600)
 */
function StatCard({ icon, label, value, sub, subColor, iconBg, countDuration = 600 }) {
  const animatedValue = useCountUp(value, countDuration);

  return (
    <div className="stat-card">
      <div
        className="stat-card-icon"
        style={iconBg ? { background: iconBg } : {}}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="stat-card-body">
        <span className="stat-card-label">{label}</span>
        <span
          className="stat-card-value"
          aria-live="polite"
          aria-label={`${label}: ${value}`}
        >
          {animatedValue}
        </span>
        <span
          className="stat-card-sub"
          style={subColor ? { color: subColor } : {}}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

export default StatCard;
