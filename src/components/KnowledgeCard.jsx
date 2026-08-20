import React from 'react';
import './KnowledgeCard.css';

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function KnowledgeCard({ resources = [], tasks = [] }) {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now).getTime();

  const resourcesAddedThisWeek = resources.filter(r => {
    if (!r.createdAt) return false;
    let timeMs = r.createdAt.toMillis ? r.createdAt.toMillis() : new Date(r.createdAt).getTime();
    return timeMs >= startOfWeek;
  }).length;

  const tasksCompletedThisWeek = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    const timeField = t.updatedAt || t.createdAt;
    if (!timeField) return false;
    let timeMs = timeField.toMillis ? timeField.toMillis() : new Date(timeField).getTime();
    return timeMs >= startOfWeek;
  }).length;

  let message = "No new resources or completed tasks this week. Start by adding a resource or creating a task.";
  if (resourcesAddedThisWeek > 0 && tasksCompletedThisWeek > 0) {
    message = `You added ${resourcesAddedThisWeek} resource${resourcesAddedThisWeek !== 1 ? 's' : ''} and completed ${tasksCompletedThisWeek} task${tasksCompletedThisWeek !== 1 ? 's' : ''} this week. Keep going!`;
  } else if (resourcesAddedThisWeek > 0) {
    message = `You added ${resourcesAddedThisWeek} resource${resourcesAddedThisWeek !== 1 ? 's' : ''} this week. Keep going!`;
  } else if (tasksCompletedThisWeek > 0) {
    message = `You completed ${tasksCompletedThisWeek} task${tasksCompletedThisWeek !== 1 ? 's' : ''} this week. Keep going!`;
  }

  return (
    <div className="card knowledge-card" aria-label="Knowledge summary for this week">
      <div className="knowledge-content">
        <div className="knowledge-icon" aria-hidden="true">📈</div>
        <h2 className="card-title knowledge-title">Your knowledge this week</h2>
        <p className="knowledge-text">{message}</p>
        <div className="knowledge-stats">
          <div className="knowledge-stat">
            <span className="knowledge-stat-value">{resourcesAddedThisWeek}</span>
            <span className="knowledge-stat-label">RESOURCES ADDED</span>
          </div>
          <div className="knowledge-stat-divider" aria-hidden="true" />
          <div className="knowledge-stat">
            <span className="knowledge-stat-value">{tasksCompletedThisWeek}</span>
            <span className="knowledge-stat-label">TASKS COMPLETED</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KnowledgeCard;
