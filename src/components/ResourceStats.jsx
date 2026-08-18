import React from 'react';
import StatCard from './StatCard';
import { LIBRARY_STATS } from '../data/libraryData';
import './ResourceStats.css';

/**
 * ResourceStats — the 4 summary number cards at the top of the Library page.
 * Reuses the existing StatCard component; just wraps them in a grid.
 */
function ResourceStats() {
  return (
    <section className="resource-stats" aria-label="Library statistics">
      {LIBRARY_STATS.map((stat) => (
        <StatCard
          key={stat.id}
          icon={stat.icon}
          iconBg={stat.iconBg}
          label={stat.label}
          value={stat.value}
          sub={stat.sub}
          subColor={stat.subColor}
        />
      ))}
    </section>
  );
}

export default ResourceStats;
