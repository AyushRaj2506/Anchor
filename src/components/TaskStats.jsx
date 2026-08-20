import React from 'react';
import StatCard from './StatCard';
import './TaskStats.css';

/**
 * TaskStats — the 4 summary cards at the top of the Tasks page.
 * Reuses the existing StatCard component.
 */
function TaskStats({ tasks = [] }) {
  const total = tasks.length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const inprogress = tasks.filter(t => t.status === 'inprogress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  const stats = [
    { id: 'total', icon: '✔', iconBg: '#e8f0e8', label: 'Total Tasks', value: total, sub: 'All your tasks', subColor: '#4a6741' },
    { id: 'todo', icon: '○', iconBg: '#fef4e0', label: 'To Do', value: todo, sub: 'Tasks to start', subColor: '#b8710a' },
    { id: 'inprogress', icon: '↻', iconBg: '#e0ebf5', label: 'In Progress', value: inprogress, sub: 'In progress', subColor: '#2a6496' },
    { id: 'completed', icon: '✓', iconBg: '#e3f0e3', label: 'Completed', value: completed, sub: 'Well done!', subColor: '#4a6741' },
  ];

  return (
    <section className="task-stats" aria-label="Task statistics">
      {stats.map((stat) => (
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
