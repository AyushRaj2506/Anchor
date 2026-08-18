import React, { useState, useMemo } from 'react';
import TaskStats from '../components/TaskStats';
import TaskFilters from '../components/TaskFilters';
import TaskCard from '../components/TaskCard';
import { TASKS, KANBAN_COLUMNS } from '../data/taskData';
import './Tasks.css';

/**
 * Tasks page — shows a Kanban board with To Do / In Progress / Completed columns.
 *
 * State managed here:
 *   search    — text search string
 *   category  — category filter ('all' or a category string)
 *   priority  — priority filter ('all' | 'High' | 'Medium' | 'Low')
 *   status    — status filter ('all' | 'todo' | 'inprogress' | 'completed')
 *   sort      — sort order ('duesoon' | 'newest')
 *
 * How filtering works:
 *   useMemo filters and sorts the TASKS array on every state change.
 *   Then the filtered list is split by status into three Kanban columns.
 *   No external libraries — plain JavaScript.
 */
function Tasks() {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('all');
  const [priority, setPriority]   = useState('all');
  const [status, setStatus]       = useState('all');
  const [sort, setSort]           = useState('duesoon');

  // ── Filter + sort logic ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = TASKS.filter((task) => {
      // Search: title or category
      if (q) {
        const inTitle    = task.title.toLowerCase().includes(q);
        const inCategory = task.category.toLowerCase().includes(q);
        if (!inTitle && !inCategory) return false;
      }

      // Category filter
      if (category !== 'all' && task.category !== category) return false;

      // Priority filter
      if (priority !== 'all' && task.priority !== priority) return false;

      // Status filter
      if (status !== 'all' && task.status !== status) return false;

      return true;
    });

    // Sort
    if (sort === 'duesoon') {
      result = [...result].sort((a, b) => a.deadlineMs - b.deadlineMs);
    }
    // 'newest' keeps original array order (data is inserted newest-first by id asc for todo/inprogress)

    return result;
  }, [search, category, priority, status, sort]);

  // ── Split into Kanban columns ────────────────────────────────────
  // Each column gets the tasks that match its id ('todo', 'inprogress', 'completed')
  function getColumnTasks(colId) {
    return filtered.filter((t) => t.status === colId);
  }

  return (
    <main className="tasks-page" id="main-content" tabIndex={-1}>

      {/* ── Page header ── */}
      <section className="tasks-header" aria-labelledby="tasks-page-title">
        <div>
          <h1 id="tasks-page-title" className="tasks-title">Tasks</h1>
          <p className="tasks-subtitle">Stay on top of your work and deadlines.</p>
        </div>
        <button className="tasks-add-btn" aria-label="Add a new task">
          + Add Task
        </button>
      </section>

      {/* ── Statistics ── */}
      <TaskStats />

      {/* ── Filters ── */}
      <TaskFilters
        search={search}       onSearch={setSearch}
        category={category}   onCategory={setCategory}
        priority={priority}   onPriority={setPriority}
        status={status}       onStatus={setStatus}
        sort={sort}           onSort={setSort}
      />

      {/* ── Kanban board ── */}
      <section className="kanban-board" aria-label="Kanban task board">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = getColumnTasks(col.id);
          return (
            <div
              key={col.id}
              className="kanban-col"
              style={{ '--col-accent': col.accent }}
              aria-labelledby={`kanban-col-${col.id}`}
            >
              {/* Column header */}
              <div className="kanban-col-header">
                <h2 id={`kanban-col-${col.id}`} className="kanban-col-title">
                  {col.label}
                </h2>
                <span
                  className="kanban-col-count"
                  aria-label={`${colTasks.length} tasks`}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Task cards */}
              <div className="kanban-col-body">
                {colTasks.length === 0 ? (
                  <p className="kanban-empty" role="status">
                    {col.emptyMsg}
                  </p>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>

              {/* Column-level Add Task — subtle, secondary */}
              <div className="kanban-col-footer">
                <button
                  className="kanban-add-btn"
                  aria-label={`Add a new task to ${col.label}`}
                >
                  + Add Task
                </button>
              </div>
            </div>
          );
        })}
      </section>

    </main>
  );
}

export default Tasks;
