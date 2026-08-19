import React from 'react';
import { Search, Moon, Sun, Menu } from 'lucide-react';
import './Header.css';

/**
 * Header — top app bar.
 *
 * Props:
 *   onMenuToggle  — toggles mobile sidebar drawer
 *   activePage    — currently active page id
 *   theme         — 'light' | 'dark'
 *   onToggleTheme — toggles the theme
 *   user          — current user object ({ name, isDemo, ... })
 */
function Header({ onMenuToggle, activePage, theme, onToggleTheme, user }) {
  // Map page IDs to human-readable titles
  const PAGE_TITLES = {
    dashboard:        'Dashboard',
    library:          'Library',
    tasks:            'Tasks',
    ask:              'Ask My Knowledge',
    bookmarks:        'Bookmarks',
    'resource-details': 'Resource Details',
  };
  const title = PAGE_TITLES[activePage] || 'Anchor';

  // Derive avatar initial from user name
  const displayName = user?.name || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  return (
    <header className="app-header" role="banner">
      {/* Left: hamburger (mobile) + page title */}
      <div className="header-left">
        <button
          className="header-menu-btn"
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
        >
          <Menu size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>

      {/* Center: Search bar — visual placeholder (global search is a future milestone) */}
      <div className="header-search" aria-label="Global search (coming soon)">
        <span className="header-search-icon" aria-hidden="true">
          <Search size={14} strokeWidth={2} />
        </span>
        <input
          type="text"
          className="header-search-input"
          placeholder="Search your resources, notes, tasks..."
          aria-label="Global search — not yet available. Use per-page search filters instead."
          readOnly
          style={{ cursor: 'default' }}
          tabIndex={-1}
        />
      </div>

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
