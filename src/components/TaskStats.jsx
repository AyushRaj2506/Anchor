import React from 'react';
import StatCard from './StatCard';
import { TASK_STATS } from '../data/taskData';
import './TaskStats.css';

/**
 * TaskStats — the 4 summary cards at the top of the Tasks page.
 * Reuses the existing StatCard component.
 */
function TaskStats() {
  return (
    <section className="task-stats" aria-label="Task statistics">
      {TASK_STATS.map((stat) => (
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

export default TaskStats;
