import React from 'react';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../data/taskData';
import './TaskFilters.css';

/**
 * TaskFilters — search + filter bar for the Tasks page.
 *
 * Props:
 *   search       — current search string
 *   onSearch     — handler called when search input changes
 *   category     — selected category ('all' or a category string)
 *   onCategory   — handler for category change
 *   priority     — selected priority ('all' | 'High' | 'Medium' | 'Low')
 *   onPriority   — handler for priority change
 *   status       — selected status ('all' | 'todo' | 'inprogress' | 'completed')
 *   onStatus     — handler for status change
 *   sort         — selected sort ('duesoon' | 'newest')
 *   onSort       — handler for sort change
 */
function TaskFilters({
  search, onSearch,
  category, onCategory,
  priority, onPriority,
  status, onStatus,
  sort, onSort,
}) {
  return (
    <div className="tf-bar" role="search" aria-label="Filter and search tasks">
      {/* ── Search ── */}
      <div className="tf-search">
        <span className="tf-search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="tf-search-input"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search tasks by title or category"
        />
        {search && (
          <button
            className="tf-clear-btn"
            onClick={() => onSearch('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="tf-controls">

        {/* Category */}
        <div className="tf-select-wrap">
          <label htmlFor="task-filter-category" className="tf-label-sr">Category</label>
          <select
            id="task-filter-category"
            className="tf-select"
            value={category}
            onChange={(e) => onCategory(e.target.value)}
            aria-label="Filter tasks by category"
          >
            <option value="all">All Categories</option>
            {TASK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="tf-select-arrow" aria-hidden="true">▾</span>
        </div>

        {/* Priority */}
        <div className="tf-select-wrap">
          <label htmlFor="task-filter-priority" className="tf-label-sr">Priority</label>
          <select
            id="task-filter-priority"
            className="tf-select"
            value={priority}
            onChange={(e) => onPriority(e.target.value)}
            aria-label="Filter tasks by priority"
          >
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="tf-select-arrow" aria-hidden="true">▾</span>
        </div>

        {/* Status */}
        <div className="tf-select-wrap">
          <label htmlFor="task-filter-status" className="tf-label-sr">Status</label>
          <select
            id="task-filter-status"
            className="tf-select"
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            aria-label="Filter tasks by status"
          >
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <span className="tf-select-arrow" aria-hidden="true">▾</span>
        </div>

        {/* Sort */}
        <div className="tf-select-wrap">
          <label htmlFor="task-filter-sort" className="tf-label-sr">Sort by</label>
          <select
            id="task-filter-sort"
            className="tf-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label="Sort tasks"
          >
            <option value="duesoon">Sort: Due Soon</option>
            <option value="newest">Sort: Newest</option>
          </select>
          <span className="tf-select-arrow" aria-hidden="true">▾</span>
        </div>
      </div>
    </div>
  );
}

export default TaskFilters;
