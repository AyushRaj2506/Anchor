import React from 'react';
import './KnowledgeCard.css';

function KnowledgeCard() {
  return (
    <div className="card knowledge-card" aria-label="Knowledge summary for this week">
      <div className="knowledge-content">
        <div className="knowledge-icon" aria-hidden="true">📈</div>
        <h2 className="card-title knowledge-title">Your knowledge this week</h2>
        <p className="knowledge-text">
          You added <strong>12 resources</strong> and completed{' '}
          <strong>5 tasks</strong>. Keep going!
        </p>
        <div className="knowledge-stats">
          <div className="knowledge-stat">
            <span className="knowledge-stat-value">12</span>
            <span className="knowledge-stat-label">Resources added</span>
          </div>
          <div className="knowledge-stat-divider" aria-hidden="true" />
          <div className="knowledge-stat">
            <span className="knowledge-stat-value">5</span>
            <span className="knowledge-stat-label">Tasks completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KnowledgeCard;
