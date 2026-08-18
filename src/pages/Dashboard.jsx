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
 * Each top-level section uses the .stagger-item class with an inline
 * animation-delay to create a subtle entrance cascade. The overall
 * page-enter animation is handled by the App.jsx wrapper.
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

function Dashboard() {
  const greeting = getGreeting();

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
            {greeting}, Ayush 🌿
          </h2>
          <p className="greeting-sub">Let's make today productive.</p>
        </div>
        <button className="add-resource-btn" aria-label="Add a new resource">
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
          value={128}
          sub="12 new this week"
        />
        <StatCard
          icon="✓"
          iconBg="#fef4e0"
          label="Pending Tasks"
          value={14}
          sub="8 in progress"
          subColor="var(--color-accent)"
        />
        <StatCard
          icon="📅"
          iconBg="#fde8e0"
          label="Upcoming Deadlines"
          value={7}
          sub="Next: DBMS Assignment"
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
          <ResourceList />
        </div>
        <div className="dashboard-grid-right">
          <DeadlineList />
        </div>
      </section>

      {/* ── Bottom row: Tasks + Knowledge ── */}
      <section
        className="dashboard-bottom stagger-item"
        style={{ animationDelay: `${STAGGER_BASE + STAGGER_STEP * 3}ms` }}
        aria-label="Tasks and knowledge summary"
      >
        <div className="dashboard-bottom-left">
          <TaskOverview />
        </div>
        <div className="dashboard-bottom-right">
          <KnowledgeCard />
        </div>
      </section>

    </main>
  );
}

export default Dashboard;
