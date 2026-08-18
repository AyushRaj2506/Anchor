import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Tasks from './pages/Tasks';
import ResourceDetails from './pages/ResourceDetails';
import Bookmarks from './pages/Bookmarks';
import AskMyKnowledge from './pages/AskMyKnowledge';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DemoAccount from './pages/DemoAccount';
import { LIBRARY_RESOURCES } from './data/libraryData';
import { TASKS } from './data/taskData';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './config/firebase';
import { getResources, addResource, updateResource, deleteResource, getTasks, addTask, updateTask, deleteTask } from './services/firestore';
import './App.css';

/**
 * App — root component.
 *
 * State:
 *   user             — the currently logged in user session (null when unauthenticated)
 *   theme            — the active style theme ('light' | 'dark')
 *   authView         — which authentication page to render ('login' | 'signup' | 'demo')
 *   activePage       — which page is currently shown within the dashboard app shell
 *   sidebarOpen      — whether the mobile drawer sidebar is open
 *   selectedResource — the resource object to show on the Resource Details page
 *                      (null when no resource is selected)
 *   resources        — shared resources collection state (holds bookmark toggles)
 */
function App() {
  // ── Authentication State Persistence ──
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('anchor-user');
    return saved ? JSON.parse(saved) : null;
  });

  // ── Theme State Persistence ──
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('anchor-theme');
    return saved || 'light';
  });

  const [authView, setAuthView]               = useState('login');
  const [activePage, setActivePage]           = useState('dashboard');
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [resources, setResources]             = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [tasks, setTasks]                     = useState([]);
  const [loadingTasks, setLoadingTasks]       = useState(false);
  const [loadingAuth, setLoadingAuth]         = useState(true);

  // ── Firebase Auth Listener ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          isDemo: false
        });
      } else {
        // Fallback to demo user if present
        const saved = localStorage.getItem('anchor-user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.isDemo) {
            setUser(parsed);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply Theme attribute dynamically on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anchor-theme', theme);
  }, [theme]);

  // ── Firestore Resources Synchronization ──
  useEffect(() => {
    if (!user) {
      setResources([]);
      return;
    }
    
    if (user.isDemo) {
      setResources(LIBRARY_RESOURCES);
      return;
    }

    async function loadFirestoreResources() {
      setLoadingResources(true);
      try {
        const data = await getResources(user.uid);
        // data comes back sorted newest-first due to orderBy in service
        setResources(data);
      } catch (err) {
        console.error('Failed to load resources:', err);
        // Fallback to mock data for display if network/permissions fail
        setResources(LIBRARY_RESOURCES);
      } finally {
        setLoadingResources(false);
      }
    }

    loadFirestoreResources();
  }, [user]);

  // ── Firestore Tasks Synchronization ──
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    
    if (user.isDemo) {
      setTasks(TASKS);
      return;
    }

    async function loadFirestoreTasks() {
      setLoadingTasks(true);
      try {
        const data = await getTasks(user.uid);
        setTasks(data);
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setTasks(TASKS); // Fallback to mock data for display
      } finally {
        setLoadingTasks(false);
      }
    }

    loadFirestoreTasks();
  }, [user]);

  function handleToggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  // Firebase login/signup are handled inside their respective components now.
  // We only need to handle Demo Login here.

  function handleDemoLogin() {
    const sessionUser = {
      email: 'demo@anchor.edu',
      name: 'Demo User',
      isDemo: true,
    };
    setUser(sessionUser);
    localStorage.setItem('anchor-user', JSON.stringify(sessionUser));
    setActivePage('dashboard');
  }

  async function handleLogout() {
    if (user?.isDemo) {
      setUser(null);
      localStorage.removeItem('anchor-user');
    } else {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Logout failed:', err);
      }
    }
    setAuthView('login');
    setActivePage('dashboard');
    setSelectedResource(null);
  }

  function handleNavigate(pageId) {
    setActivePage(pageId);
    setSidebarOpen(false);
    // Clear selected resource when navigating away from resource-details
    if (pageId !== 'resource-details') {
      setSelectedResource(null);
    }
  }

  function handleOpenResource(resource) {
    setSelectedResource(resource);
    setActivePage('resource-details');
    setSidebarOpen(false);
  }

  async function handleToggleBookmark(resourceId) {
    const target = resources.find(r => r.id === resourceId);
    if (!target) return;

    // Optimistic UI update
    setResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, bookmarked: !r.bookmarked } : r))
    );

    if (user && !user.isDemo) {
      try {
        await updateResource(user.uid, resourceId, { bookmarked: !target.bookmarked });
      } catch (err) {
        console.error('Failed to update bookmark in Firestore:', err);
        // Revert on failure
        setResources((prev) =>
          prev.map((r) => (r.id === resourceId ? { ...r, bookmarked: target.bookmarked } : r))
        );
      }
    }
  }

  async function handleAddResource(newResource) {
    if (user && !user.isDemo) {
      try {
        const id = await addResource(user.uid, newResource);
        setResources(prev => [{ id, ...newResource, time: 'Just now' }, ...prev]);
      } catch (err) {
        console.error('Failed to add resource:', err);
        alert('Failed to add resource. Please try again.');
      }
    } else {
      // Demo mode
      const id = Date.now().toString();
      setResources(prev => [{ id, ...newResource, time: 'Just now' }, ...prev]);
    }
  }

  async function handleDeleteResource(resourceId) {
    if (user && !user.isDemo) {
      try {
        await deleteResource(user.uid, resourceId);
        setResources(prev => prev.filter(r => r.id !== resourceId));
      } catch (err) {
        console.error('Failed to delete resource:', err);
        alert('Failed to delete resource. Please try again.');
      }
    } else {
      setResources(prev => prev.filter(r => r.id !== resourceId));
    }
  }

  // ── Task Handlers ──
  async function handleAddTask(newTask) {
    if (user && !user.isDemo) {
      try {
        const id = await addTask(user.uid, newTask);
        setTasks(prev => [{ id, ...newTask }, ...prev]);
      } catch (err) {
        console.error('Failed to add task:', err);
        alert('Failed to add task. Please try again.');
      }
    } else {
      const id = Date.now().toString();
      setTasks(prev => [{ id, ...newTask }, ...prev]);
    }
  }

  async function handleUpdateTask(taskId, updates) {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    
    if (user && !user.isDemo) {
      try {
        await updateTask(user.uid, taskId, updates);
      } catch (err) {
        console.error('Failed to update task:', err);
      }
    }
  }

  async function handleDeleteTask(taskId) {
    if (user && !user.isDemo) {
      try {
        await deleteTask(user.uid, taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (err) {
        console.error('Failed to delete task:', err);
        alert('Failed to delete task. Please try again.');
      }
    } else {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  }

  // Render the correct authenticated page component
  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard tasks={tasks} />;
      case 'library':
        return (
          <Library
            resources={resources}
            loading={loadingResources}
            onOpenResource={handleOpenResource}
            onToggleBookmark={handleToggleBookmark}
            onAddResource={handleAddResource}
            onDeleteResource={handleDeleteResource}
          />
        );
      case 'tasks':
        return (
          <Tasks 
            tasks={tasks} 
            loading={loadingTasks} 
            onAddTask={handleAddTask} 
            onUpdateTask={handleUpdateTask} 
            onDeleteTask={handleDeleteTask} 
          />
        );
      case 'ask':
        return <AskMyKnowledge onOpenResource={handleOpenResource} />;
      case 'bookmarks':
        return (
          <Bookmarks
            resources={resources}
            onToggleBookmark={handleToggleBookmark}
            onOpenResource={handleOpenResource}
            onNavigateToLibrary={() => handleNavigate('library')}
            onDeleteResource={handleDeleteResource}
          />
        );
      case 'resource-details':
        if (!selectedResource) {
          return (
            <Library
              resources={resources}
              loading={loadingResources}
              onOpenResource={handleOpenResource}
              onToggleBookmark={handleToggleBookmark}
              onAddResource={handleAddResource}
              onDeleteResource={handleDeleteResource}
            />
          );
        }
        const currentResource = resources.find(r => r.id === selectedResource.id) || selectedResource;
        return (
          <ResourceDetails
            resource={currentResource}
            onBack={() => handleNavigate('library')}
          />
        );
      default:
        return (
          <div className="page-placeholder">
            <p>🚧 &ldquo;{activePage}&rdquo; page coming soon.</p>
          </div>
        );
    }
  }

  // ── Authentication Views Guard ──
  if (loadingAuth) {
    return (
      <div className="auth-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    if (authView === 'signup') {
      return (
        <Signup
          onSwitchView={setAuthView}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      );
    }
    if (authView === 'demo') {
      return (
        <DemoAccount
          onDemoLogin={handleDemoLogin}
          onSwitchView={setAuthView}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      );
    }
    return (
      <Login
        onSwitchView={setAuthView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // ── Authenticated Application Shell ──
  return (
    <div className="app-shell">
      {/* Sidebar — collapses to drawer on mobile */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Right side: header + scrollable content */}
      <div className="app-body">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          activePage={activePage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
        <div className="app-content">
          <div key={activePage} className="page-enter">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
