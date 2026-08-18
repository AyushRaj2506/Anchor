import React from 'react';
import { Search, Moon, Sun, Menu } from 'lucide-react';
import './Header.css';

function Header({ onMenuToggle, activePage, theme, onToggleTheme }) {
  // Map page IDs to human-readable titles
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    library:   'Library',
    tasks:     'Tasks',
    ask:       'Ask My Knowledge',
    bookmarks: 'Bookmarks',
  };
  const title = PAGE_TITLES[activePage] || 'Anchor';

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

      {/* Center: Search bar */}
      <div className="header-search" role="search">
        <span className="header-search-icon" aria-hidden="true">
          <Search size={14} strokeWidth={2} />
        </span>
        <input
          type="search"
          className="header-search-input"
          placeholder="Search your resources, notes, tasks..."
          aria-label="Search your resources, notes, and tasks"
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
        <div className="header-avatar" aria-label="User avatar: Ayush Raj" role="img">
          A
        </div>
      </div>
    </header>
  );
}

export default Header;
