import React from 'react';
import StatCard from '../components/StatCard';
import ResourceList from '../components/ResourceList';
import DeadlineList from '../components/DeadlineList';
import TaskOverview from '../components/TaskOverview';
import KnowledgeCard from '../components/KnowledgeCard';
import './Dashboard.css';

/**
 * Dashboard page — shows a greeting, stat cards, and several sections.
 *
 * Props:
 *   resources        — full array of user resources (from Firestore or demo data)
 *   tasks            — full array of user tasks (from Firestore or demo data)
 *   user             — current user object ({ name, isDemo, ... })
 *   onNavigate       — function(pageId) to navigate between pages
 *   onToggleBookmark — function(resourceId) to toggle bookmark state
 *
 * All statistics are derived from props — no hardcoded numbers.
 */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Stagger timing constants (ms)
const STAGGER_BASE  = 40;
const STAGGER_STEP  = 55;

function Dashboard({ resources = [], tasks = [], user, onNavigate, onToggleBookmark }) {
  const greeting = getGreeting();

  // Derive all stats from actual data — no hardcoded values
  const resourceCount    = resources.length;
  const pendingTasks     = tasks.filter(t => t.status === 'todo' || t.status === 'inprogress').length;
  const inProgressTasks  = tasks.filter(t => t.status === 'inprogress').length;
  const activeDeadlines  = tasks.filter(t => t.deadlineMs && t.status !== 'completed').sort((a, b) => a.deadlineMs - b.deadlineMs);
  const nextDeadlineTask = activeDeadlines.length > 0 ? activeDeadlines[0].title : 'None';

  // Derive display name from user object
  const displayName = user?.name || 'there';

  return (
    <main className="dashboard" id="main-content" tabIndex={-1}>

      {/* ── Greeting + Add Resource ── */}
      <section
        className="dashboard-greeting stagger-item"
        style={{ animationDelay: `${STAGGER_BASE}ms` }}
        aria-labelledby="greeting-heading"
      >
        <div>
          <h2 id="greeting-heading" className="greeting-text">
            {greeting}, {displayName} 🌿
          </h2>
          <p className="greeting-sub">Let's make today productive.</p>
        </div>
        <button
          className="add-resource-btn"
          aria-label="Go to Library to add a new resource"
          onClick={() => onNavigate && onNavigate('library')}
        >
          + Add Resource
        </button>
      </section>

      {/* ── Summary Stat Cards ── */}
      <section
        className="dashboard-stats stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP}ms` }}
        aria-label="Summary statistics"
      >
        <StatCard
          icon="📋"
          iconBg="#e8f0e8"
          label="Resources"
          value={resourceCount}
          sub={resourceCount === 1 ? '1 resource saved' : `${resourceCount} resources saved`}
        />
        <StatCard
          icon="✓"
          iconBg="#fef4e0"
          label="Pending Tasks"
          value={pendingTasks}
          sub={`${inProgressTasks} in progress`}
          subColor="var(--color-accent)"
        />
        <StatCard
          icon="📅"
          iconBg="#fde8e0"
          label="Upcoming Deadlines"
          value={activeDeadlines.length}
          sub={`Next: ${nextDeadlineTask}`}
          subColor="var(--color-danger)"
        />
      </section>

      {/* ── Main two-column grid ── */}
      <section
        className="dashboard-grid stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 2}ms` }}
        aria-label="Dashboard details"
      >
        <div className="dashboard-grid-left">
          <ResourceList
            resources={resources}
            onNavigate={onNavigate}
            onToggleBookmark={onToggleBookmark}
          />
        </div>
        <div className="dashboard-grid-right">
          <DeadlineList tasks={tasks} onNavigate={onNavigate} />
        </div>
      </section>

      {/* ── Bottom row: Tasks + Knowledge ── */}
      <section
        className="dashboard-bottom stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 3}ms` }}
        aria-label="Tasks and knowledge summary"
      >
        <div className="dashboard-bottom-left">
          <TaskOverview tasks={tasks} />
        </div>
        <div className="dashboard-bottom-right">
          <KnowledgeCard />
        </div>
      </section>

    </main>
  );
}

export default Dashboard;
