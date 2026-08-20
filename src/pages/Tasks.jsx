import React, { useState, useMemo } from 'react';
import TaskStats from '../components/TaskStats';
import TaskFilters from '../components/TaskFilters';
import TaskCard from '../components/TaskCard';
import { KANBAN_COLUMNS, TASK_CATEGORIES, TASK_PRIORITIES } from '../data/taskData';
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
 *   useMemo filters and sorts the tasks array on every state change.
 *   Then the filtered list is split by status into three Kanban columns.
 *   No external libraries — plain JavaScript.
 *
 * KANBAN_COLUMNS, TASK_CATEGORIES, TASK_PRIORITIES from taskData are static
 * UI configuration — they are NOT mock task records and are kept intentionally.
 */
function Tasks({ tasks, loading, error, onAddTask, onUpdateTask, onDeleteTask }) {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('all');
  const [priority, setPriority]   = useState('all');
  const [status, setStatus]       = useState('all');
  const [sort, setSort]           = useState('duesoon');

  // ── Filter + sort logic ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = (tasks || []).filter((task) => {
      // Search: title or category
      if (q) {
        const inTitle    = task.title.toLowerCase().includes(q);
        const inCategory = (task.category || '').toLowerCase().includes(q);
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
      result = [...result].sort((a, b) => {
        // Null deadlines go to the end
        if (!a.deadlineMs && !b.deadlineMs) return 0;
        if (!a.deadlineMs) return 1;
        if (!b.deadlineMs) return -1;
        return a.deadlineMs - b.deadlineMs;
      });
    }
    // 'newest' keeps original array order (inserted newest-first)

    return result;
  }, [tasks, search, category, priority, status, sort]); // tasks is in deps — fixes stale filter bug

  // ── Split into Kanban columns ────────────────────────────────────
  function getColumnTasks(colId) {
    return filtered.filter((t) => t.status === colId);
  }

  // ── Modal State ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [newCategory, setNewCategory]   = useState('Personal');
  const [newPriority, setNewPriority]   = useState('Medium');
  const [newDeadline, setNewDeadline]   = useState('');

  function handleAddSubmit() {
    if (!newTitle.trim()) return;
    if (onAddTask) {
      onAddTask({
        title:      newTitle.trim(),
        category:   newCategory,
        priority:   newPriority,
        status:     'todo',
        deadline:   newDeadline
          ? new Date(newDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : 'No deadline',
        deadlineMs: newDeadline ? new Date(newDeadline).getTime() : null,
        bookmarked: false,
      });
    }
    setShowAddModal(false);
    setNewTitle('');
    setNewCategory('Personal');
    setNewPriority('Medium');
    setNewDeadline('');
  }

  const hasNoTasks      = !loading && (tasks || []).length === 0;
  const hasNoFiltered   = !loading && (tasks || []).length > 0 && filtered.length === 0;

  return (
    <main className="tasks-page" id="main-content" tabIndex={-1}>

      {/* ── Page header ── */}
      <section className="tasks-header" aria-labelledby="tasks-page-title">
        <div>
          <h1 id="tasks-page-title" className="tasks-title">Tasks</h1>
          <p className="tasks-subtitle">Stay on top of your work and deadlines.</p>
        </div>
        <button
          className="tasks-add-btn"
          aria-label="Add a new task"
          onClick={() => setShowAddModal(true)}
        >
          + Add Task
        </button>
      </section>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: 'var(--color-danger-bg, #fde8e0)',
            color: 'var(--color-danger, #c0392b)',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Statistics (computed from real tasks) ── */}
      <TaskStats tasks={tasks} />

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
        {loading ? (
          <div
            className="tasks-loading"
            style={{ padding: '2rem', textAlign: 'center', width: '100%', color: 'var(--text-secondary)' }}
            role="status"
            aria-live="polite"
          >
            Loading your tasks...
          </div>

        ) : hasNoTasks ? (
          /* User has no tasks at all — primary empty state */
          <div
            style={{ padding: '3rem 2rem', textAlign: 'center', width: '100%', color: 'var(--text-secondary)' }}
            role="status"
            aria-live="polite"
          >
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</p>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              No tasks yet
            </p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Add your first task using the button above.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              + Add Task
            </button>
          </div>

        ) : hasNoFiltered ? (
          /* Tasks exist but filters return nothing */
          <div
            style={{ padding: '2rem', textAlign: 'center', width: '100%', color: 'var(--text-secondary)' }}
            role="status"
            aria-live="polite"
          >
            <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              No tasks match your filters
            </p>
            <button
              onClick={() => { setSearch(''); setCategory('all'); setPriority('all'); setStatus('all'); }}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.5rem' }}
            >
              Clear filters
            </button>
          </div>

        ) : KANBAN_COLUMNS.map((col) => {
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
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdateStatus={(newStatus) => onUpdateTask(task.id, { status: newStatus })}
                      onDelete={() => onDeleteTask(task.id)}
                      onUpdateTask={onUpdateTask}
                    />
                  ))
                )}
              </div>

              {/* Column-level Add Task */}
              <div className="kanban-col-footer">
                <button
                  className="kanban-add-btn"
                  aria-label={`Add a new task to ${col.label}`}
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Task
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Add Task Modal ── */}
      {showAddModal && (
        <div
          className="task-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-dialog-title"
        >
          <div className="task-modal-card">
            
            {/* Modal Header */}
            <div className="task-modal-header">
              <div>
                <h3 id="add-task-dialog-title">Add New Task</h3>
                <p>Create a task and keep track of your progress.</p>
              </div>
              <button 
                className="task-modal-close" 
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="task-modal-body">
              
              <div className="task-modal-group">
                <label className="task-modal-label" htmlFor="add-task-title">Title *</label>
                <input
                  id="add-task-title"
                  type="text"
                  className="task-modal-input"
                  placeholder="Task title..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubmit(); if (e.key === 'Escape') setShowAddModal(false); }}
                />
              </div>

              <div className="task-modal-row">
                <div className="task-modal-group">
                  <label className="task-modal-label" htmlFor="add-task-category">Category</label>
                  <select
                    id="add-task-category"
                    className="task-modal-select"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    {TASK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                
                <div className="task-modal-group">
                  <label className="task-modal-label" htmlFor="add-task-priority">Priority</label>
                  <select
                    id="add-task-priority"
                    className="task-modal-select"
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                  >
                    {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="task-modal-group">
                <label className="task-modal-label" htmlFor="add-task-deadline">
                  Deadline <span className="task-modal-label-hint">(optional)</span>
                </label>
                <input
                  id="add-task-deadline"
                  type="datetime-local"
                  className="task-modal-input"
                  value={newDeadline}
                  onChange={e => setNewDeadline(e.target.value)}
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="task-modal-footer">
              <button
                className="task-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="task-btn-submit"
                onClick={handleAddSubmit}
                disabled={!newTitle.trim()}
              >
                Add Task
              </button>
            </div>
            
          </div>
        </div>
      )}
    </main>
  );
}

export default Tasks;
