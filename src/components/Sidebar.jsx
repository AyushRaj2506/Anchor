import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  MessageCircle,
  Bookmark,
  LogOut,
  Anchor,
  PanelLeft,
} from 'lucide-react';
import { getDisplayName } from '../utils/user';
import './Sidebar.css';

// Each nav item: lucide icon component, label, id
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',        Icon: LayoutDashboard },
  { id: 'library',   label: 'Library',          Icon: BookOpen        },
  { id: 'tasks',     label: 'Tasks',            Icon: CheckSquare     },
  { id: 'ask',       label: 'Ask My Knowledge', Icon: MessageCircle   },
  { id: 'bookmarks', label: 'Bookmarks',        Icon: Bookmark        },
];

function Sidebar({ activePage, onNavigate, isOpen, onClose, user, onLogout, collapsed, onToggleCollapse }) {
  const isDemo      = user?.isDemo;
  const displayName = getDisplayName(user);
  const displayRole = isDemo ? 'Demo Mode' : 'Student';
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Overlay for mobile — clicking it closes the sidebar */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}
        aria-label="Main navigation"
      >
        {/* ── Brand ── */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" aria-hidden="true">
            <Anchor size={20} strokeWidth={2.5} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Anchor</span>
            <span className="sidebar-brand-tagline">College Second Brain</span>
          </div>
          <button 
             className="sidebar-toggle-btn"
             onClick={onToggleCollapse}
             aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
             title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
             <PanelLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          <ul role="list">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  className={`sidebar-nav-item ${activePage === id || (activePage === 'resource-details' && id === 'library') ? 'sidebar-nav-item--active' : ''}`}
                  onClick={() => { onNavigate(id); onClose(); }}
                  aria-current={activePage === id ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={activePage === id ? 2.5 : 2} />
                  </span>
                  <span className="sidebar-nav-label">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden="true">{initial}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-role">{displayRole}</span>
            </div>
          </div>

          <button
            className="sidebar-footer-item"
            aria-label="Log out of Anchor"
            title={collapsed ? "Logout" : undefined}
            onClick={onLogout}
          >
            <LogOut size={15} strokeWidth={2} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
