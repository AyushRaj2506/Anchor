import React, { useState, useMemo } from 'react';
import TaskStats from '../components/TaskStats';
import TaskFilters from '../components/TaskFilters';
import TaskCard from '../components/TaskCard';
import { KANBAN_COLUMNS } from '../data/taskData';
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
function Tasks({ tasks, loading, onAddTask, onUpdateTask, onDeleteTask }) {
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

  // ── Modal State ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Personal');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newDeadline, setNewDeadline] = useState('');

  function handleAddSubmit() {
    if (!newTitle.trim()) return;
    if (onAddTask) {
      onAddTask({
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        status: 'todo',
        deadline: newDeadline ? new Date(newDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No deadline',
        deadlineMs: newDeadline ? new Date(newDeadline).getTime() : null,
        bookmarked: false
      });
    }
    setShowAddModal(false);
    setNewTitle('');
    setNewCategory('Personal');
    setNewPriority('Medium');
    setNewDeadline('');
  }

  return (
    <main className="tasks-page" id="main-content" tabIndex={-1}>

      {/* ── Page header ── */}
      <section className="tasks-header" aria-labelledby="tasks-page-title">
        <div>
          <h1 id="tasks-page-title" className="tasks-title">Tasks</h1>
          <p className="tasks-subtitle">Stay on top of your work and deadlines.</p>
        </div>
        <button className="tasks-add-btn" aria-label="Add a new task" onClick={() => setShowAddModal(true)}>
          + Add Task
        </button>
      </section>

      {/* ── Statistics ── */}
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
          <div className="tasks-loading" style={{ padding: '2rem', textAlign: 'center', width: '100%', color: 'var(--text-secondary)' }}>
            Loading your tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty" style={{ padding: '2rem', textAlign: 'center', width: '100%', color: 'var(--text-secondary)' }}>
            You don't have any tasks yet.
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
                    />
                  ))
                )}
              </div>

              {/* Column-level Add Task — subtle, secondary */}
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

      {/* Add Task Modal Overlay */}
      {showAddModal && (
        <div className="lib-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Add New Task</h3>
            <input 
              type="text" 
              placeholder="Task Title" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="Personal">Personal</option>
                <option value="DBMS">DBMS</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Operating System">Operating System</option>
                <option value="Web Development">Web Development</option>
                <option value="AI / ML">AI / ML</option>
                <option value="Mathematics">Mathematics</option>
              </select>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <input 
              type="datetime-local" 
              value={newDeadline} 
              onChange={e => setNewDeadline(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddSubmit}
                disabled={!newTitle.trim()}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: !newTitle.trim() ? 0.5 : 1 }}
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
