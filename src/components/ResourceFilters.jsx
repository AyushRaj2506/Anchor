import React from 'react';
import './ResourceFilters.css';

/**
 * ResourceFilters — the search + filter bar for the Library page.
 *
 * Props:
 *   search        — current search string
 *   onSearch      — called when search input changes
 *   category      — currently selected category ('all' or a category id)
 *   onCategory    — called when the category select changes
 *   type          — currently selected type ('all' or a type string)
 *   onType        — called when the type select changes
 *   sort          — currently selected sort ('newest' | 'oldest' | 'az')
 *   onSort        — called when sort select changes
 *   categories    — array of { id, label, count } computed from actual resources
 *   resourceTypes — array of type strings computed from actual resources
 *
 * Category and type lists are passed in from Library.jsx where they are
 * derived from the actual resources — no static data files imported here.
 */
function ResourceFilters({
  search, onSearch,
  category, onCategory,
  type, onType,
  sort, onSort,
  categories = [],
  resourceTypes = [],
}) {
  return (
    <div className="rf-bar" role="search" aria-label="Filter and search resources">
      {/* ── Search ── */}
      <div className="rf-search">
        <span className="rf-search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="rf-search-input"
          placeholder="Search resources..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search resources by title, category, or tag"
        />
        {search && (
          <button
            className="rf-clear-btn"
            onClick={() => onSearch('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Filters row ── */}
      <div className="rf-controls">
        {/* Category */}
        <div className="rf-select-wrap">
          <label htmlFor="filter-category" className="rf-label-sr">Category</label>
          <select
            id="filter-category"
            className="rf-select"
            value={category}
            onChange={(e) => onCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label} ({cat.count})</option>
            ))}
          </select>
          <span className="rf-select-arrow" aria-hidden="true">▾</span>
        </div>

        {/* Type */}
        <div className="rf-select-wrap">
          <label htmlFor="filter-type" className="rf-label-sr">Type</label>
          <select
            id="filter-type"
            className="rf-select"
            value={type}
            onChange={(e) => onType(e.target.value)}
            aria-label="Filter by resource type"
          >
            <option value="all">All Types</option>
            {resourceTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="rf-select-arrow" aria-hidden="true">▾</span>
        </div>

        {/* Sort */}
        <div className="rf-select-wrap">
          <label htmlFor="filter-sort" className="rf-label-sr">Sort by</label>
          <select
            id="filter-sort"
            className="rf-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label="Sort resources"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="az">Sort: A → Z</option>
          </select>
          <span className="rf-select-arrow" aria-hidden="true">▾</span>
        </div>
      </div>
    </div>
  );
}

export default ResourceFilters;
