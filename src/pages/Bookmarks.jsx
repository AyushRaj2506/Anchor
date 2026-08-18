import React, { useState, useMemo } from 'react';
import StatCard from '../components/StatCard';
import ResourceCard from '../components/ResourceCard';
import { BOOKMARK_STATS } from '../data/bookmarkData';
import { CATEGORIES } from '../data/libraryData';
import './Bookmarks.css';

/**
 * Bookmarks page. Shows resources marked as bookmarked.
 * Allows searching, filtering, and toggling bookmark status locally.
 * Also supports opening the Resource Details page.
 */
function Bookmarks({ resources, onToggleBookmark, onOpenResource, onNavigateToLibrary }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('recent');

  // Filter for resources that are currently bookmarked
  const bookmarkedList = useMemo(() => {
    return resources.filter(r => r.bookmarked);
  }, [resources]);

  // Compute stats dynamically based on current bookmarks
  const stats = useMemo(() => {
    const total = bookmarkedList.length;
    const docs = bookmarkedList.filter(r => r.type === 'PDF' || r.type === 'Note' || r.type === 'Document').length;
    const links = bookmarkedList.filter(r => r.type === 'URL').length;
    const images = bookmarkedList.filter(r => r.type === 'Image').length;

    return [
      {
        id: 'total',
        icon: '🔖',
        iconBg: '#e8f0e8',
        label: 'Total Bookmarks',
        value: total,
        sub: 'All saved items',
        subColor: '#4a6741',
      },
      {
        id: 'documents',
        icon: '📄',
        iconBg: '#fde8e0',
        label: 'Documents',
        value: docs,
        sub: 'PDFs & Notes',
        subColor: '#b8710a',
      },
      {
        id: 'links',
        icon: '🔗',
        iconBg: '#fef4e0',
        label: 'Links',
        value: links,
        sub: 'Saved URLs',
        subColor: '#2a6496',
      },
      {
        id: 'images',
        icon: '🖼',
        iconBg: '#ede3f5',
        label: 'Images',
        value: images,
        sub: 'Saved images',
        subColor: '#7e57c2',
      },
    ];
  }, [bookmarkedList]);

  // Apply search/filter/sort
  const filteredBookmarks = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = bookmarkedList.filter((r) => {
      // Search matches title or category
      if (q) {
        const inTitle = r.title.toLowerCase().includes(q);
        const inCategory = r.category.toLowerCase().includes(q);
        const inTags = r.tags && r.tags.some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inCategory && !inTags) return false;
      }

      // Category filter
      if (category !== 'all' && r.category !== category) return false;

      // Type filter
      if (type !== 'all' && r.type !== type) return false;

      return true;
    });

    // Sort: 'recent' (original order) or 'name' (alphabetical)
    if (sort === 'name') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [bookmarkedList, search, category, type, sort]);

  // Unique types from the bookmarked resources
  const availableTypes = useMemo(() => {
    const types = new Set(bookmarkedList.map(r => r.type));
    return Array.from(types);
  }, [bookmarkedList]);

  return (
    <main className="bookmarks-page" id="main-content" tabIndex={-1}>
      {/* Page Header */}
      <section className="bm-header" aria-labelledby="bm-page-title">
        <div>
          <h1 id="bm-page-title" className="bm-title">Bookmarks</h1>
          <p className="bm-subtitle">Resources you've saved for quick access. Keep important resources close at hand.</p>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bm-stats-grid" aria-label="Bookmark statistics">
        {stats.map((stat) => (
          <StatCard
            key={stat.id}
            icon={stat.icon}
            iconBg={stat.iconBg}
            label={stat.label}
            value={stat.value}
            sub={stat.sub}
            subColor={stat.subColor}
          />
        ))}
      </section>

      {/* Search and Filters Bar */}
      <div className="bm-filter-bar" role="search" aria-label="Filter and search bookmarks">
        <div className="bm-search">
          <span className="bm-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            className="bm-search-input"
            placeholder="Search bookmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bookmarks by title, category, or tag"
          />
          {search && (
            <button
              className="bm-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="bm-controls">
          {/* Categories select */}
          <div className="bm-select-wrap">
            <label htmlFor="bm-filter-category" className="bm-label-sr">Category</label>
            <select
              id="bm-filter-category"
              className="bm-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter bookmarks by category"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <span className="bm-select-arrow" aria-hidden="true">▾</span>
          </div>

          {/* Types select */}
          <div className="bm-select-wrap">
            <label htmlFor="bm-filter-type" className="bm-label-sr">Type</label>
            <select
              id="bm-filter-type"
              className="bm-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter bookmarks by type"
            >
              <option value="all">All Types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="bm-select-arrow" aria-hidden="true">▾</span>
          </div>

          {/* Sort select */}
          <div className="bm-select-wrap">
            <label htmlFor="bm-filter-sort" className="bm-label-sr">Sort by</label>
            <select
              id="bm-filter-sort"
              className="bm-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort bookmarks"
            >
              <option value="recent">Sort: Recently Added</option>
              <option value="name">Sort: Name</option>
            </select>
            <span className="bm-select-arrow" aria-hidden="true">▾</span>
          </div>
        </div>
      </div>

      {/* Bookmarked resources list */}
      <section className="bm-list-section" aria-label="Bookmarked resources">
        <h2 className="bm-list-title">Saved Resources ({filteredBookmarks.length})</h2>

        <div className="card bm-list-card">
          {bookmarkedList.length === 0 ? (
            /* General Empty State */
            <div className="bm-empty" role="status" aria-live="polite">
              <span className="bm-empty-icon" aria-hidden="true">🔖</span>
              <p className="bm-empty-title">No bookmarks yet</p>
              <p className="bm-empty-sub">Save important resources from your Library to find them here quickly.</p>
              <button
                className="bm-empty-action-btn"
                onClick={onNavigateToLibrary}
              >
                Go to Library
              </button>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            /* Search/Filter Empty State */
            <div className="bm-empty" role="status" aria-live="polite">
              <span className="bm-empty-icon" aria-hidden="true">🔍</span>
              <p className="bm-empty-title">No matching bookmarks</p>
              <p className="bm-empty-sub">Try changing your search or filters.</p>
              <button
                className="bm-empty-reset-btn"
                onClick={() => { setSearch(''); setCategory('all'); setType('all'); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="bm-resource-list" role="list" aria-label="Bookmarked resources list">
              {filteredBookmarks.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onOpen={onOpenResource}
                  onBookmarkToggle={onToggleBookmark}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

export default Bookmarks;
