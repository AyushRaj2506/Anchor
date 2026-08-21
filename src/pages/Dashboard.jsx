import React from 'react';
import ResourceList from '../components/ResourceList';
import DeadlineList from '../components/DeadlineList';
import TaskOverview from '../components/TaskOverview';
import KnowledgeCard from '../components/KnowledgeCard';
import { getDisplayName } from '../utils/user';
import './Dashboard.css';

/**
 * Dashboard page — shows a greeting, compact metrics strip, recent knowledge, and task focus.
 *
 * Props:
 *   resources        — full array of user resources (from Firestore or demo data)
 *   tasks            — full array of user tasks (from Firestore or demo data)
 *   user             — current user object ({ name, isDemo, ... })
 *   onNavigate       — function(pageId) to navigate between pages
 *   onToggleBookmark — function(resourceId) to toggle bookmark state
 *
 * All statistics are derived dynamically from props — zero hardcoded numbers.
 */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const STAGGER_BASE = 40;
const STAGGER_STEP = 55;

function Dashboard({ resources = [], tasks = [], user, onNavigate, onToggleBookmark }) {
  const greeting = getGreeting();

  // Derive all stats dynamically
  const resourceCount    = resources.length;
  const pendingTasks     = tasks.filter(t => t.status === 'todo' || t.status === 'inprogress').length;
  const inProgressTasks  = tasks.filter(t => t.status === 'inprogress').length;
  const activeDeadlines  = tasks.filter(t => t.deadlineMs && t.status !== 'completed').sort((a, b) => a.deadlineMs - b.deadlineMs);
  const nextDeadlineTask = activeDeadlines.length > 0 ? activeDeadlines[0].title : 'None';

  // Derive display name from user object
  const displayName = getDisplayName(user);

  return (
    <main className="dashboard" id="main-content" tabIndex={-1}>

      {/* ── Hero Banner ── */}
      <section
        className="dashboard-hero stagger-item"
        style={{ animationDelay: `${STAGGER_BASE}ms` }}
        aria-labelledby="greeting-heading"
      >
        <div className="dashboard-hero-content">
          <span className="dashboard-hero-tag">Personal Knowledge Base</span>
          <h2 id="greeting-heading" className="greeting-text">
            {greeting}, <span className="greeting-name">{displayName}</span> 👋
          </h2>
          <p className="greeting-sub">Your academic second brain at a glance.</p>
        </div>
        <button
          className="add-resource-btn"
          aria-label="Go to Library to add a new resource"
          onClick={() => onNavigate && onNavigate('library')}
        >
          <span aria-hidden="true">+</span> Add Resource
        </button>
      </section>

      {/* ── Integrated Compact Metrics Strip ── */}
      <section
        className="dashboard-metrics-strip stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP}ms` }}
        aria-label="Academic metrics summary"
      >
        <div className="metric-strip-item" onClick={() => onNavigate && onNavigate('library')}>
          <div className="metric-strip-icon-box" style={{ background: 'var(--color-green-soft)', color: 'var(--color-green)' }}>
            📚
          </div>
          <div className="metric-strip-info">
            <span className="metric-strip-value">{resourceCount}</span>
            <span className="metric-strip-label">Saved Resources</span>
          </div>
        </div>

        <div className="metric-strip-divider" aria-hidden="true" />

        <div className="metric-strip-item" onClick={() => onNavigate && onNavigate('tasks')}>
          <div className="metric-strip-icon-box" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            ✓
          </div>
          <div className="metric-strip-info">
            <span className="metric-strip-value">{pendingTasks}</span>
            <span className="metric-strip-label">Pending Tasks ({inProgressTasks} in progress)</span>
          </div>
        </div>

        <div className="metric-strip-divider" aria-hidden="true" />

        <div className="metric-strip-item" onClick={() => onNavigate && onNavigate('tasks')}>
          <div className="metric-strip-icon-box" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            ⏰
          </div>
          <div className="metric-strip-info">
            <span className="metric-strip-value">{activeDeadlines.length}</span>
            <span className="metric-strip-label">Deadlines (Next: {nextDeadlineTask})</span>
          </div>
        </div>
      </section>

      {/* ── Recent Knowledge Vault Section ── */}
      <section
        className="dashboard-recent-section stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 2}ms` }}
        aria-label="Recent resources"
      >
        <div className="dashboard-section-header">
          <div>
            <h3 className="dashboard-section-title">Recent Knowledge</h3>
            <p className="dashboard-section-sub">Latest notes, PDFs, and references saved to your library.</p>
          </div>
          <button
            className="dashboard-view-more-btn"
            onClick={() => onNavigate && onNavigate('library')}
            aria-label="View full library"
          >
            View library →
          </button>
        </div>
        <ResourceList
          resources={resources}
          onNavigate={onNavigate}
          onToggleBookmark={onToggleBookmark}
        />
      </section>

      {/* ── Your Focus Grid (Tasks + Deadlines) ── */}
      <section
        className="dashboard-grid stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 3}ms` }}
        aria-label="Focus tasks and deadlines"
      >
        <div className="dashboard-grid-left">
          <TaskOverview tasks={tasks} />
        </div>
        <div className="dashboard-grid-right">
          <DeadlineList tasks={tasks} onNavigate={onNavigate} />
        </div>
      </section>

      {/* ── Weekly Knowledge Section ── */}
      <section
        className="dashboard-bottom stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 4}ms` }}
        aria-label="Knowledge activity summary"
      >
        <KnowledgeCard resources={resources} tasks={tasks} />
      </section>

    </main>
  );
}

export default Dashboard;
