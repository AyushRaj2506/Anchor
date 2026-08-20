import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Tasks from './pages/Tasks';
import ResourceDetails from './pages/ResourceDetails';
import Bookmarks from './pages/Bookmarks';
import AskMyKnowledge from './pages/AskMyKnowledge';
import AITest from './pages/AITest';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DemoAccount from './pages/DemoAccount';
import { LIBRARY_RESOURCES } from './data/libraryData';
import { TASKS } from './data/taskData';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './config/firebase';
import { getResources, addResource, updateResource, deleteResource, getTasks, addTask, updateTask, deleteTask } from './services/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { deleteFile } from './services/storage';
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
 *   resourceError    — error message if Firestore resource load fails
 *   taskError        — error message if Firestore task load fails
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
  const [resourceError, setResourceError]     = useState(null);
  const [tasks, setTasks]                     = useState([]);
  const [loadingTasks, setLoadingTasks]       = useState(false);
  const [taskError, setTaskError]             = useState(null);
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
      setResourceError(null);
      return;
    }

    if (user.isDemo) {
      setResources(LIBRARY_RESOURCES);
      setResourceError(null);
      return;
    }

    async function loadFirestoreResources() {
      setLoadingResources(true);
      setResourceError(null);
      try {
        const data = await getResources(user.uid);
        setResources(data);
      } catch (err) {
        console.error('Failed to load resources:', err);
        // Do NOT fall back to mock data for real users.
        // Show an empty list with an error message instead.
        setResources([]);
        setResourceError('Could not load your resources. Please check your connection and try again.');
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
      setTaskError(null);
      return;
    }

    if (user.isDemo) {
      setTasks(TASKS);
      setTaskError(null);
      return;
    }

    async function loadFirestoreTasks() {
      setLoadingTasks(true);
      setTaskError(null);
      try {
        const data = await getTasks(user.uid);
        setTasks(data);
      } catch (err) {
        console.error('Failed to load tasks:', err);
        // Do NOT fall back to mock data for real users.
        setTasks([]);
        setTaskError('Could not load your tasks. Please check your connection and try again.');
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
        alert('Failed to update bookmark. Please try again.');
      }
    }
  }

  async function handleAddResource(newResource, resourceId = null) {
    if (user && !user.isDemo) {
      try {
        const id = await addResource(user.uid, newResource, resourceId);
        setResources(prev => [{ id, ...newResource, createdAt: new Date() }, ...prev]);
        return id;
      } catch (err) {
        console.error('Failed to add resource:', err);
        alert('Failed to add resource. Please try again.');
        throw err;
      }
    } else {
      // Demo mode — local only
      const id = resourceId || Date.now().toString();
      setResources(prev => [{ id, ...newResource, createdAt: new Date() }, ...prev]);
      return id;
    }
  }

  async function handleUpdateResource(resourceId, updates) {
    let enrichedUpdates = { ...updates };
    let localUpdates = { ...updates };

    // If updates contain AI fields, add the analysis timestamp
    if (updates.aiSummary !== undefined) {
      enrichedUpdates.aiAnalyzedAt = serverTimestamp();
      localUpdates.aiAnalyzedAt = new Date();
    }

    // Optimistic UI update
    setResources(prev => prev.map(r => r.id === resourceId ? { ...r, ...localUpdates } : r));

    if (user && !user.isDemo) {
      try {
        await updateResource(user.uid, resourceId, enrichedUpdates);
      } catch (err) {
        console.error('Failed to update resource in Firestore:', err);
        throw err; // Propagate error so Caller can revert UI or show warning
      }
    }
  }

  async function handleDeleteResource(resourceId) {
    const targetResource = resources.find(r => r.id === resourceId);

    if (user && !user.isDemo) {
      try {
        // If the resource has a Supabase file, delete it first
        if (targetResource && targetResource.storagePath) {
          try {
            const idToken = await auth.currentUser.getIdToken();
            await deleteFile(targetResource.storagePath, idToken);
            console.log('Successfully deleted associated Supabase storage file:', targetResource.storagePath);
          } catch (storageErr) {
            console.error('Failed to delete Supabase file:', storageErr);
            alert(`Failed to delete the associated storage file. Deletion halted to prevent orphaned data. Details: ${storageErr.message}`);
            return; // HALT deletion if Supabase delete fails
          }
        }

        // Delete from Firestore
        await deleteResource(user.uid, resourceId);
        setResources(prev => prev.filter(r => r.id !== resourceId));
        // If currently viewing this resource, go back to Library
        if (selectedResource?.id === resourceId) {
          handleNavigate('library');
        }
      } catch (err) {
        console.error('Failed to delete resource from database:', err);
        alert('Failed to delete resource from database. Please try again.');
      }
    } else {
      // Demo mode or mock only
      setResources(prev => prev.filter(r => r.id !== resourceId));
      if (selectedResource?.id === resourceId) {
        handleNavigate('library');
      }
    }
  }

  // ── Task Handlers ──
  async function handleAddTask(newTask) {
    if (user && !user.isDemo) {
      try {
        const id = await addTask(user.uid, newTask);
        setTasks(prev => [{ id, ...newTask, createdAt: new Date() }, ...prev]);
      } catch (err) {
        console.error('Failed to add task:', err);
        alert('Failed to add task. Please try again.');
      }
    } else {
      const id = Date.now().toString();
      setTasks(prev => [{ id, ...newTask, createdAt: new Date() }, ...prev]);
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
        // Revert on failure — re-fetch would be cleaner but expensive
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
        return (
          <Dashboard
            resources={resources}
            tasks={tasks}
            user={user}
            onNavigate={handleNavigate}
            onToggleBookmark={handleToggleBookmark}
          />
        );
      case 'library':
        return (
          <Library
            resources={resources}
            loading={loadingResources}
            error={resourceError}
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
            error={taskError}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        );
      case 'ask':
        return (
          <AskMyKnowledge
            resources={resources}
            tasks={tasks}
            onOpenResource={handleOpenResource}
            onNavigate={handleNavigate}
          />
        );
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
      case 'ai-test':
        return <AITest />;
      case 'resource-details':
        if (!selectedResource) {
          return (
            <Library
              resources={resources}
              loading={loadingResources}
              error={resourceError}
              onOpenResource={handleOpenResource}
              onToggleBookmark={handleToggleBookmark}
              onAddResource={handleAddResource}
              onDeleteResource={handleDeleteResource}
            />
          );
        }
        // Always use the latest version of the resource from state (bookmark state may have changed)
        const currentResource = resources.find(r => r.id === selectedResource.id) || selectedResource;
        return (
          <ResourceDetails
            resource={currentResource}
            onBack={() => handleNavigate('library')}
            onToggleBookmark={handleToggleBookmark}
            onDeleteResource={handleDeleteResource}
            onUpdateResource={handleUpdateResource}
            onNavigate={handleNavigate}
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
          user={user}
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
