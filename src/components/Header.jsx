import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Moon, Sun, Menu, X } from 'lucide-react';
import { getDisplayName } from '../utils/user';
import './Header.css';
import { readJSON, writeJSON } from '../utils/persistence';

const MAX_RECENT   = 5;
const STORAGE_KEY  = 'anchor-recent-searches';

function loadRecent(key = STORAGE_KEY) {
  const saved = readJSON(key, []);
  return Array.isArray(saved) ? saved.filter(value => typeof value === 'string').slice(0, MAX_RECENT) : [];
}

function saveRecent(term, key = STORAGE_KEY) {
  if (!term || !term.trim()) return;
  const trimmed = term.trim();
  let list = loadRecent(key).filter(s => s !== trimmed);
  list.unshift(trimmed);
  list = list.slice(0, MAX_RECENT);
  writeJSON(key, list);
}

/**
 * Header — top app bar with working global search.
 *
 * Props:
 *   onMenuToggle  — toggles mobile sidebar drawer
 *   activePage    — currently active page id
 *   theme         — 'light' | 'dark'
 *   onToggleTheme — toggles the theme
 *   user          — current user object
 *   resources     — user's resources array (from App state)
 *   tasks         — user's tasks array (from App state)
 *   onOpenResource — function(resource) to navigate to Resource Details
 *   onNavigate    — function(pageId) to navigate pages
 */
function Header({
  onMenuToggle,
  sidebarOpen = false,
  activePage,
  theme,
  onToggleTheme,
  user,
  resources = [],
  tasks = [],
  onOpenResource,
  onNavigate,
}) {
  const PAGE_TITLES = {
    dashboard:          'Dashboard',
    library:            'Library',
    tasks:              'Tasks',
    ask:                'Ask My Knowledge',
    bookmarks:          'Bookmarks',
    activity:           'Analysis Activity',
    'resource-details': 'Resource Details',
    'ai-test':          'AI Test',
  };
  const title = PAGE_TITLES[activePage] || 'Anchor';

  const recentKey = STORAGE_KEY + ':' + (user?.isDemo ? 'demo' : user?.uid || 'guest');
  const displayName = getDisplayName(user);
  const initial     = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  // ── Search state ──────────────────────────────────────────────────────
  const [query,       setQuery]       = useState('');
  const [isOpen,      setIsOpen]      = useState(false);
  const [results,     setResults]     = useState({ resources: [], tasks: [] });
  const [recentList,  setRecentList]  = useState([]);
  const wrapperRef  = useRef(null);
  const inputRef    = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Run search
  const runSearch = useCallback((q) => {
    const term = q.trim().toLowerCase();
    if (!term) {
      setResults({ resources: [], tasks: [] });
      return;
    }
    const tokens = term.split(/\s+/).filter(t => t.length > 0);

    const matchedResources = resources.filter(r => {
      const hay = [
        r.title || '',
        r.category || '',
        r.aiCategory || '',
        r.type || '',
        r.description || '',
        r.notes || '',
        r.content || '',
        r.contentText || '',
        r.aiSummary || '',
        ...(Array.isArray(r.tags) ? r.tags : []),
        ...(Array.isArray(r.aiTags) ? r.aiTags : []),
      ].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    }).slice(0, 6);

    const matchedTasks = tasks.filter(t => {
      const hay = [
        t.title || '',
        t.description || '',
        t.category || '',
        t.status || '',
      ].join(' ').toLowerCase();
      return tokens.every(tok => hay.includes(tok));
    }).slice(0, 4);

    setResults({ resources: matchedResources, tasks: matchedTasks });
  }, [resources, tasks]);

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);

  }

  useEffect(() => {
    runSearch(query);
  }, [query, runSearch]);

  function handleFocus() {
    setRecentList(loadRecent(recentKey));
    setIsOpen(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && query.trim()) {
      handleViewAll();
    }
  }

  function handleViewAll() {
    saveRecent(query, recentKey);
    onNavigate?.(results.resources.length === 0 && results.tasks.length > 0 ? 'tasks' : 'library', query.trim());
    setIsOpen(false);
  }

  function handleSelectResource(resource) {
    saveRecent(query || resource.title, recentKey);
    setRecentList(loadRecent(recentKey));
    setIsOpen(false);
    setQuery('');
    if (onOpenResource) onOpenResource(resource);
  }

  function handleSelectTask() {
    saveRecent(query, recentKey);
    setIsOpen(false);
    setQuery('');
    if (onNavigate) onNavigate('tasks', query.trim());
  }

  function handleSelectRecent(term) {
    setQuery(term);
    runSearch(term);
    inputRef.current?.focus();
  }

  function handleClear() {
    setQuery('');
    setResults({ resources: [], tasks: [] });
    inputRef.current?.focus();
  }

  const hasResults   = results.resources.length > 0 || results.tasks.length > 0;
  const showRecent   = !query.trim() && recentList.length > 0;
  const showNoResult = query.trim() && !hasResults;
  const dropdownVisible = isOpen && (showRecent || hasResults || showNoResult);

  // Resource type icon helper
  function typeIcon(r) {
    if (r.typeIcon) return r.typeIcon;
    const t = (r.type || '').toLowerCase();
    if (t === 'pdf') return '📄';
    if (t === 'image') return '🖼';
    if (t === 'note') return '📝';
    if (t === 'url') return '🔗';
    return '📋';
  }

  return (
    <header className="app-header" role="banner">
      {/* Left: hamburger (mobile) + page title */}
      <div className="header-left">
        <button
          className="header-menu-btn"
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          aria-controls="anchor-navigation"
        >
          <Menu size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>

      {/* Center: Global Search (Hidden on Ask My Knowledge) */}
      {activePage !== 'ask' ? (
        <div
          className={`header-search${isOpen ? ' header-search--open' : ''}`}
          ref={wrapperRef}
          aria-label="Global search"
        >
          <span className="header-search-icon" aria-hidden="true">
            <Search size={14} strokeWidth={2} />
          </span>
          <input
            ref={inputRef}
            type="search"
            className="header-search-input"
            placeholder="Search resources, notes, tasks..."
            aria-label="Search your resources and tasks"
            aria-expanded={dropdownVisible}
            aria-autocomplete="list"
            aria-controls="header-search-results"
            autoComplete="off"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className="header-search-clear"
              onClick={handleClear}
              aria-label="Clear search"
              tabIndex={0}
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}

          {/* Results dropdown */}
          {dropdownVisible && (
            <div
              id="header-search-results"
              className="hsr-dropdown"
              role="listbox"
              aria-label="Search results"
            >
              {/* Recent searches (empty query) */}
              {showRecent && (
                <>
                  <p className="hsr-group-label">Recent searches</p>
                  {recentList.map((term, i) => (
                    <button
                      key={i}
                      className="hsr-item hsr-item--recent"
                      role="option"
                      onClick={() => handleSelectRecent(term)}
                    >
                      <span className="hsr-item-icon" aria-hidden="true">🕐</span>
                      <span className="hsr-item-title">{term}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Resources results */}
              {results.resources.length > 0 && (
                <>
                  <p className="hsr-group-label">Resources</p>
                  {results.resources.map((r) => (
                    <button
                      key={r.id}
                      className="hsr-item"
                      role="option"
                      onClick={() => handleSelectResource(r)}
                    >
                      <span className="hsr-item-icon" aria-hidden="true">{typeIcon(r)}</span>
                      <span className="hsr-item-body">
                        <span className="hsr-item-title">{r.title}</span>
                        <span className="hsr-item-meta">
                          {[r.aiCategory || r.category, r.type].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Task results */}
              {results.tasks.length > 0 && (
                <>
                  <p className="hsr-group-label">Tasks</p>
                  {results.tasks.map((t) => (
                    <button
                      key={t.id}
                      className="hsr-item"
                      role="option"
                      onClick={() => handleSelectTask(t)}
                    >
                      <span className="hsr-item-icon" aria-hidden="true">☑</span>
                      <span className="hsr-item-body">
                        <span className="hsr-item-title">{t.title}</span>
                        <span className="hsr-item-meta">
                          {[t.category, t.status].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* No results */}
              {showNoResult && (
                <p className="hsr-empty">No matching resources or tasks.</p>
              )}

              {/* Footer — view all */}
              {hasResults && (
                <button
                  className="hsr-footer-btn"
                  onClick={handleViewAll}
                >
                  View all results in {results.resources.length === 0 && results.tasks.length > 0 ? 'Tasks' : 'Library'} →
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* Right: theme toggle + avatar */}
      <div className="header-right">
        <button
          className="header-icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? <Sun  size={16} strokeWidth={2} aria-hidden="true" />
            : <Moon size={16} strokeWidth={2} aria-hidden="true" />
          }
        </button>
        <div
          className="header-avatar"
          aria-label={`User avatar: ${displayName || 'User'}`}
          role="img"
          title={displayName || 'User'}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}

export default Header;
