import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Code-split pages for performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Library = lazy(() => import('./pages/Library'));
const Tasks = lazy(() => import('./pages/Tasks'));
const ResourceDetails = lazy(() => import('./pages/ResourceDetails'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const AskMyKnowledge = lazy(() => import('./pages/AskMyKnowledge'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DemoAccount = lazy(() => import('./pages/DemoAccount'));
const AnalysisActivity = lazy(() => import('./pages/AnalysisActivity'));
import { LIBRARY_RESOURCES } from './data/libraryData';
import { TASKS } from './data/taskData';
import { subscribeAuth, signOut, auth } from './services/auth';
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
import { getResources, addResource, updateResource, deleteResource, getTasks, addTask, updateTask, deleteTask, addAnalysisTask } from './services/database';
import { deleteFile } from './services/storage';
import './App.css';
import { readJSON, writeJSON } from './utils/persistence';
import { parseTaskDeadline, taskTitleKey } from './utils/tasks';

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
 *   resourceError    — error message if Database resource load fails
 *   taskError        — error message if Database task load fails
 */
function App() {
  // ── Authentication State Persistence ──
  const [user, setUser] = useState(() => {
    const saved = readJSON('anchor-user');
    return saved?.isDemo === true ? saved : null;
  });

  // ── Theme State Persistence ──
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('anchor-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });

  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).get('recovery') === '1');
  const [authView, setAuthView]               = useState('login');
  const [activePage, setActivePage]           = useState('dashboard');
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return readJSON('anchor-sidebar-collapsed', false) === true;
  });
  const [selectedResource, setSelectedResource] = useState(null);
  const [resources, setResources]             = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceError, setResourceError]     = useState(null);
  const [tasks, setTasks]                     = useState([]);
  const [loadingTasks, setLoadingTasks]       = useState(false);
  const [taskError, setTaskError]             = useState(null);
  const [loadingAuth, setLoadingAuth]         = useState(true);
  const [operationError, setOperationError] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const sessionRef = useRef(null);
  const taskCreationLocks = useRef(new Set());
  const uid = user?.uid;
  const isDemo = user?.isDemo === true;
  const sessionKey = user?.isDemo ? 'demo' : user?.uid || null;
  sessionRef.current = sessionKey;
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  useEffect(() => {
    setActivePage('dashboard');
    setSelectedResource(null);
    setSidebarOpen(false);
    setOperationError('');
    setPageSearch('');
    taskCreationLocks.current.clear();
  }, [sessionKey]);

  // ── Supabase Auth Listener ──
  useEffect(() => {
    if (!auth) { setLoadingAuth(false); return; }
    const unsubscribe = subscribeAuth((account) => {
      const savedDemo = readJSON('anchor-user');
      const nextSession = account?.uid || (savedDemo?.isDemo === true ? 'demo' : null);
      if (nextSession !== sessionRef.current) {
        setResources([]);
        setTasks([]);
        setSelectedResource(null);
        setActivePage('dashboard');
      }
      if (account) {
        setUser({
          uid: account.uid,
          email: account.email,
          name: account.displayName || account.email?.split('@')[0] || 'User',
          isDemo: false
        });
      } else {
        const saved = readJSON('anchor-user');
        setUser(saved?.isDemo === true ? saved : null);
      }
      setLoadingAuth(false);
    }, () => {
      setLoadingAuth(false);
      setUser(null);
      setOperationError('Could not restore your session. Please sign in again.');
    }, () => setPasswordRecovery(true));

    return () => unsubscribe();
  }, []);

  // Apply Theme attribute dynamically on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('anchor-theme', theme); } catch { /* Storage can be disabled. */ }
  }, [theme]);

  // Persist Sidebar Collapsed state
  useEffect(() => {
    writeJSON('anchor-sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // ── Database Resources Synchronization ──
  useEffect(() => {
    if (!uid && !isDemo) {
      setResources([]);
      setResourceError(null);
      return;
    }

    if (isDemo) {
      setResources(LIBRARY_RESOURCES);
      setResourceError(null);
      setLoadingResources(false);
      return;
    }

    let active = true;
    setResources([]);
    async function loadDatabaseResources() {
      setLoadingResources(true);
      setResourceError(null);
      try {
        const data = await getResources(uid);
        if (active) setResources(data);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load resources:', err);
        // Do NOT fall back to mock data for real users.
        // Show an empty list with an error message instead.
        setResources([]);
        setResourceError('Could not load your resources. Please check your connection and try again.');
      } finally {
        if (active) setLoadingResources(false);
      }
    }

    loadDatabaseResources();
    return () => { active = false; };
  }, [uid, isDemo]);

  // ── Database Tasks Synchronization ──
  useEffect(() => {
    if (!uid && !isDemo) {
      setTasks([]);
      setTaskError(null);
      return;
    }

    if (isDemo) {
      setTasks(TASKS);
      setTaskError(null);
      setLoadingTasks(false);
      return;
    }

    let active = true;
    setTasks([]);
    async function loadDatabaseTasks() {
      setLoadingTasks(true);
      setTaskError(null);
      try {
        const data = await getTasks(uid);
        if (active) setTasks(data);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load tasks:', err);
        // Do NOT fall back to mock data for real users.
        setTasks([]);
        setTaskError('Could not load your tasks. Please check your connection and try again.');
      } finally {
        if (active) setLoadingTasks(false);
      }
    }

    loadDatabaseTasks();
    return () => { active = false; };
  }, [uid, isDemo]);

  function handleToggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  // Supabase login/signup are handled inside their respective components now.
  // We only need to handle Demo Login here.

  function handleDemoLogin() {
    const sessionUser = {
      email: 'demo@anchor.edu',
      name: 'Demo User',
      isDemo: true,
    };
    setResources(LIBRARY_RESOURCES);
    setTasks(TASKS);
    setUser(sessionUser);
    writeJSON('anchor-user', sessionUser);
    setActivePage('dashboard');
  }

  async function handleLogout() {
    if (user?.isDemo) {
      setUser(null);
      writeJSON('anchor-user', null);
    } else {
      try {
        writeJSON('anchor-user', null);
        await signOut();
      } catch (err) {
        console.error('Logout failed:', err);
        setOperationError('Could not log out. Please try again.');
        return;
      }
    }
    setAuthView('login');
    setActivePage('dashboard');
    setSelectedResource(null);
  }

  function handleNavigate(pageId, search = '') {
    setPageSearch(search);
    setOperationError('');
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
    if (!target || !user) return;
    const owner = sessionKey;
    try {
      if (!user.isDemo) await updateResource(user.uid, resourceId, { bookmarked: !target.bookmarked });
      if (sessionRef.current === owner) {
        setResources(prev => prev.map(r => r.id === resourceId ? { ...r, bookmarked: !target.bookmarked } : r));
      }
    } catch {
      if (sessionRef.current === owner) setOperationError('Could not update the bookmark. Please try again.');
    }
  }

  async function handleAddResource(newResource, resourceId = null) {
    if (!user || sessionRef.current !== sessionKey) throw new Error('Please sign in again.');
    const owner = sessionKey;
    const id = user.isDemo ? resourceId || crypto.randomUUID() : await addResource(user.uid, newResource, resourceId);
    if (sessionRef.current === owner) {
      setResources(prev => [{ ...newResource, id, createdAt: new Date() }, ...prev]);
    }
    return id;
  }

  async function handleUpdateResource(resourceId, updates) {
    if (!user || sessionRef.current !== sessionKey || !resourcesRef.current.some(r => r.id === resourceId)) throw new Error('Resource is no longer available.');
    const owner = sessionKey;
    const saved = { ...updates };
    const local = { ...updates };
    delete saved._serverSaved;
    delete local._serverSaved;
    if (updates.aiSummary !== undefined) {
      saved.aiAnalyzedAt = new Date().toISOString();
      local.aiAnalyzedAt = new Date();
    }
    if (!user.isDemo && !updates._serverSaved) await updateResource(user.uid, resourceId, saved);
    if (sessionRef.current === owner) {
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, ...local } : r));
    }
  }

  async function handleDeleteResource(resourceId) {
    const target = resources.find(r => r.id === resourceId);
    if (!target || !user) return;
    const owner = sessionKey;
    try {
      if (!user.isDemo) {
        if (target.storagePath) {
          const token = await auth.currentUser.getIdToken();
          await deleteFile(target.storagePath, token);
        }
        await deleteResource(user.uid, resourceId);
      }
      if (sessionRef.current !== owner) return;
      setResources(prev => prev.filter(r => r.id !== resourceId));
      if (selectedResource?.id === resourceId) handleNavigate('library');
    } catch {
      if (sessionRef.current === owner) setOperationError('Could not delete the resource. Please try again.');
    }
  }

  async function handleAddTask(newTask) {
    if (!user) throw new Error('Please sign in again.');
    const owner = sessionKey;
    const id = user.isDemo ? crypto.randomUUID() : await addTask(user.uid, newTask);
    if (sessionRef.current === owner) setTasks(prev => [{ ...newTask, id, createdAt: new Date() }, ...prev]);
    return id;
  }

  async function handleUpdateTask(taskId, updates) {
    if (!user || sessionRef.current !== sessionKey) return;
    const owner = sessionKey;
    const changes = { ...updates };
    if (updates.status) changes.completedOn = updates.status === 'completed'
      ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    if (updates.status) changes.completedAtMs = updates.status === 'completed' ? Date.now() : null;
    try {
      if (!user.isDemo) await updateTask(user.uid, taskId, changes);
      if (sessionRef.current === owner) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...changes, updatedAt: new Date() } : t));
    } catch {
      if (sessionRef.current === owner) setOperationError('Could not save the task changes. Please try again.');
    }
  }

  async function handleDeleteTask(taskId) {
    if (!user) return;
    const owner = sessionKey;
    try {
      if (!user.isDemo) await deleteTask(user.uid, taskId);
      if (sessionRef.current === owner) setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {
      if (sessionRef.current === owner) setOperationError('Could not delete the task. Please try again.');
    }
  }

  /**
   * Creates tasks from AI-extracted action items, preventing duplicates.
   * Each auto-generated task stores sourceResourceId to enable dedup on re-analysis.
   * @param {string} resourceId - The resource that was analyzed
   * @param {Array}  actionItems - Array of { title, description, deadline } objects
   * @param {string} resourceCategory - Category of the resource for task grouping
   * @returns {number} count of newly created tasks
   */
  async function handleCreateTasksFromAnalysis(resourceId, actionItems, resourceCategory) {
    if (!user || !Array.isArray(actionItems) || actionItems.length === 0) return 0;
    if (user?.isDemo) return 0; // Demo mode: don't persist tasks from AI

    // Find tasks already generated from this resource
    const existingSourceTaskIds = new Set(
      tasksRef.current
        .filter(t => t.sourceResourceId === resourceId)
        .map(t => taskTitleKey(t.title))
    );

    let created = 0;
    for (const item of actionItems) {
      if (!item || typeof item.title !== 'string' || !item.title.trim()) continue;
      if (sessionRef.current !== sessionKey) throw new Error('Your session changed. Please retry.');
      const titleKey = taskTitleKey(item.title);
      // Skip if an equivalent task already exists for this resource
      const lockKey = sessionKey + ':' + resourceId + ':' + titleKey;
      if (existingSourceTaskIds.has(titleKey) || taskCreationLocks.current.has(lockKey)) continue;
      taskCreationLocks.current.add(lockKey);

      const { deadline: deadlineDisplay, deadlineMs } = parseTaskDeadline(item.deadline);

      const newTask = {
        title:            item.title.trim(),
        description:      item.description || '',
        category:         resourceCategory || 'General',
        status:           'todo',
        priority:         'Medium',
        deadline:         deadlineDisplay,
        deadlineMs:       deadlineMs,
        bookmarked:       false,
        sourceResourceId: resourceId,  // Track origin for dedup
        autoGenerated:    true,
      };

      try {
        const result = await addAnalysisTask(user.uid, resourceId, newTask);
        if (sessionRef.current === sessionKey) setTasks(prev => prev.some(task => task.id === result.task.id) ? prev : [result.task, ...prev]);
        existingSourceTaskIds.add(titleKey);
        if (result.created) created++;
      } catch (err) {
        taskCreationLocks.current.delete(lockKey);
        console.error('Failed to create auto-generated task:', err);
        throw new Error('Some action items could not be saved as tasks. Please retry.');
      } finally {
        taskCreationLocks.current.delete(lockKey);
      }
    }
    return created;
  }

  // Render the correct authenticated page component
  function renderPage() {
    switch (activePage) {
      case 'activity':
        return <AnalysisActivity user={user} onResults={async () => {
          const owner = sessionKey;
          const [nextResources, nextTasks] = await Promise.all([getResources(uid), getTasks(uid)]);
          if (sessionRef.current === owner) { setResources(nextResources); setTasks(nextTasks); }
        }} />;
      case 'dashboard':
        return (
          <Dashboard
            resources={resources}
            tasks={tasks}
            user={user}
            onOpenResource={handleOpenResource}
            onNavigate={handleNavigate}
            onToggleBookmark={handleToggleBookmark}
          />
        );
      case 'library':
        return (
          <Library
            user={user}
            initialSearch={pageSearch}
            resources={resources}
            loading={loadingResources}
            error={resourceError}
            onOpenResource={handleOpenResource}
            onToggleBookmark={handleToggleBookmark}
            onAddResource={handleAddResource}
            onDeleteResource={handleDeleteResource}
            onUpdateResource={handleUpdateResource}
            onCreateTasksFromAnalysis={handleCreateTasksFromAnalysis}
          />
        );
      case 'tasks':
        return (
          <Tasks
            initialSearch={pageSearch}
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
            user={user}
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
            key={currentResource.id}
            user={user}
            resource={currentResource}
            onBack={() => handleNavigate('library')}
            onToggleBookmark={handleToggleBookmark}
            onDeleteResource={handleDeleteResource}
            onUpdateResource={handleUpdateResource}
            onCreateTasksFromAnalysis={handleCreateTasksFromAnalysis}
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

  if (passwordRecovery) return <Suspense fallback={<p>Loading...</p>}><ResetPassword onComplete={() => {
    setPasswordRecovery(false); window.history.replaceState({}, '', window.location.pathname);
  }} /></Suspense>;

  if (!user) {
    return (
      <Suspense fallback={
        <div className="auth-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      }>
        {authView === 'signup' && (
          <Signup
            onProfileUpdated={name => setUser(current => current && !current.isDemo ? { ...current, name } : current)}
            onSwitchView={setAuthView}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
        {authView === 'demo' && (
          <DemoAccount
            onDemoLogin={handleDemoLogin}
            onSwitchView={setAuthView}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
        {authView === 'login' && (
          <Login
            onSwitchView={setAuthView}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </Suspense>
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Right side: header + scrollable content */}
      <div className="app-body">
        <Header
          key={sessionKey}
          sidebarOpen={sidebarOpen}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          activePage={activePage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          user={user}
          resources={resources}
          tasks={tasks}
          onOpenResource={handleOpenResource}
          onNavigate={handleNavigate}
        />
        <div className="app-content">
          {operationError && <div role="alert" className="app-error">{operationError}</div>}
          <Suspense fallback={
            <div style={{ display: 'flex', padding: '2rem', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Loading page...
            </div>
          }>
            <div key={sessionKey + activePage + pageSearch} className="page-enter">
              {renderPage()}
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;
