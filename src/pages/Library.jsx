import React, { useState, useMemo } from 'react';
import ResourceStats from '../components/ResourceStats';
import ResourceFilters from '../components/ResourceFilters';
import ResourceCard from '../components/ResourceCard';
import { LIBRARY_RESOURCES, CATEGORIES } from '../data/libraryData';
import './Library.css';

/**
 * Library page — shows all saved resources with search/filter.
 *
 * State managed here:
 *   search    — text the user has typed in the search box
 *   category  — selected category filter ('all' or a category string)
 *   type      — selected type filter ('all' or a type string)
 *   sort      — sort order ('newest' | 'oldest' | 'az')
 *   showCount — how many items to show (for "Load more")
 *
 * How filtering works:
 *   useMemo recalculates the filtered list every time search/category/type/sort changes.
 *   No external library; just standard JavaScript array methods.
 */

const ITEMS_PER_PAGE = 6; // show 6 at a time; "Load more" adds 6 more

function Library({ resources, loading, onOpenResource, onToggleBookmark, onAddResource, onDeleteResource }) {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('all');
  const [type, setType]           = useState('all');
  const [sort, setSort]           = useState('newest');
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  function handleAddSubmit() {
    if (!newTitle.trim()) return;
    if (onAddResource) {
      onAddResource({
        title: newTitle.trim(),
        sourceUrl: newUrl.trim() || '',
        type: newUrl.trim() ? 'URL' : 'Document',
        typeIcon: newUrl.trim() ? '🔗' : '📋',
        iconBg: newUrl.trim() ? '#fef4e0' : '#ede3f5',
        category: 'Uncategorized',
        tags: [],
        bookmarked: false
      });
    }
    setShowAddModal(false);
    setNewTitle('');
    setNewUrl('');
  }

  // ── Filtering + sorting ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let results = resources.filter((r) => {
      // Search: matches title, category, or any tag
      if (q) {
        const inTitle    = r.title.toLowerCase().includes(q);
        const inCategory = r.category.toLowerCase().includes(q);
        const inTags     = r.tags.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inCategory && !inTags) return false;
      }

      // Category filter
      if (category !== 'all' && r.category !== category) return false;

      // Type filter
      if (type !== 'all' && r.type !== type) return false;

      return true;
    });

    // Sort
    if (sort === 'az') {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'oldest') {
      results = [...results].reverse();
    }
    // 'newest' = original order (data is already newest-first)

    return results;
  }, [resources, search, category, type, sort]);

  // Reset "show count" whenever filters change so we start fresh
  React.useEffect(() => {
    setShowCount(ITEMS_PER_PAGE);
  }, [search, category, type, sort]);

  const visible = filtered.slice(0, showCount);
  const hasMore = showCount < filtered.length;

  return (
    <main className="library" id="main-content" tabIndex={-1}>

      {/* ── Page header ── */}
      <section className="lib-header" aria-labelledby="lib-page-title">
        <div>
          <h1 id="lib-page-title" className="lib-title">Library</h1>
          <p className="lib-subtitle">Everything you've saved, organized in one place.</p>
        </div>
        <button className="lib-add-btn" aria-label="Add a new resource" onClick={() => setShowAddModal(true)}>
          + Add Resource
        </button>
      </section>

      {/* ── Stats ── */}
      <ResourceStats />

      {/* ── Search + Filters ── */}
      <ResourceFilters
        search={search}       onSearch={setSearch}
        category={category}   onCategory={setCategory}
        type={type}           onType={setType}
        sort={sort}           onSort={setSort}
      />

      {/* ── Main content: resource list + categories panel ── */}
      <div className="lib-body">

        {/* Left: resource list */}
        <div className="lib-list-area">
          <div className="lib-list-header">
            <h2 className="lib-list-title">
              All Resources{' '}
              <span className="lib-list-count">({filtered.length})</span>
            </h2>
          </div>

          {/* Resource rows */}
          <div className="card lib-list-card">
            {loading ? (
              <div className="lib-empty" role="status" aria-live="polite">
                <p className="lib-empty-title">Loading your resources...</p>
              </div>
            ) : visible.length === 0 ? (
              /* Empty state */
              <div className="lib-empty" role="status" aria-live="polite">
                <span className="lib-empty-icon" aria-hidden="true">🔍</span>
                <p className="lib-empty-title">No resources found</p>
                <p className="lib-empty-sub">Try changing your search or filters.</p>
                <button
                  className="lib-empty-reset"
                  onClick={() => { setSearch(''); setCategory('all'); setType('all'); }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="lib-resource-list" role="list" aria-label="Resource list">
                {visible.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onOpen={onOpenResource}
                    onBookmarkToggle={onToggleBookmark}
                    onDelete={onDeleteResource}
                  />
                ))}
              </ul>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="lib-load-more">
                <button
                  className="lib-load-btn"
                  onClick={() => setShowCount((prev) => prev + ITEMS_PER_PAGE)}
                  aria-label={`Load more resources. Showing ${visible.length} of ${filtered.length}`}
                >
                  Load more ↓
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Categories panel */}
        <aside className="lib-categories" aria-label="Resource categories">
          <div className="card lib-cat-card">
            <div className="lib-cat-header">
              <h2 className="lib-cat-title">Categories</h2>
              <button className="view-all-btn" aria-label="View all categories">
                View all
              </button>
            </div>

            <ul className="lib-cat-list" role="list">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    className={`lib-cat-item ${category === cat.id ? 'lib-cat-item--active' : ''}`}
                    onClick={() => setCategory(category === cat.id ? 'all' : cat.id)}
                    aria-pressed={category === cat.id}
                    aria-label={`Filter by ${cat.label}: ${cat.count} resources`}
                  >
                    <span className="lib-cat-label">{cat.label}</span>
                    <span className="lib-cat-count">{cat.count}</span>
                  </button>
                </li>
              ))}
            </ul>

            <button className="lib-new-cat-btn" aria-label="Add a new category">
              + New Category
            </button>
          </div>
        </aside>

      </div>

      {/* Add Resource Modal Overlay */}
      {showAddModal && (
        <div className="lib-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Add New Resource</h3>
            <input 
              type="text" 
              placeholder="Resource Title" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
              autoFocus
            />
            <input 
              type="url" 
              placeholder="URL (optional)" 
              value={newUrl} 
              onChange={e => setNewUrl(e.target.value)} 
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
                Add Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Library;
