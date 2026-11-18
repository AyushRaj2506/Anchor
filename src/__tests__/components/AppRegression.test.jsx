import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ listener: null, initial: null, auth: { currentUser: null }, resources: vi.fn(), tasks: vi.fn(), updateTask: vi.fn() }));
vi.mock('../../config/firebase', () => ({ auth: state.auth, db: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, listener) => { state.listener = listener; queueMicrotask(() => state.listener?.(state.initial)); return () => { state.listener = null; }; },
  signOut: vi.fn(async () => state.listener?.(null)),
}));
vi.mock('../../services/firestore', () => ({
  getResources: state.resources, getTasks: state.tasks, updateTask: state.updateTask,
  addResource: vi.fn(), updateResource: vi.fn(), deleteResource: vi.fn(),
  addTask: vi.fn(), deleteTask: vi.fn(), addAnalysisTask: vi.fn(),
}));
vi.mock('../../pages/Dashboard', () => ({ default: ({ resources, tasks }) => <div>
  {resources.map(item => <p key={item.id}>{item.title}</p>)}
  {tasks.map(item => <p key={item.id}>{item.title}</p>)}
</div> }));
import App from '../../App';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.initial = null;
  state.auth.currentUser = null;
  state.resources.mockResolvedValue([]);
  state.tasks.mockResolvedValue([]);
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Application session and persistence regressions', () => {
  it('recovers from corrupt local storage instead of blanking the app', async () => {
    localStorage.setItem('anchor-user', '{broken');
    localStorage.setItem('anchor-sidebar-collapsed', '{broken');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Log in', exact: true })).toBeInTheDocument();
  });

  it('does not trust a cached real account as authentication', async () => {
    localStorage.setItem('anchor-user', JSON.stringify({ uid: 'forged', name: 'Forged user' }));
    render(<App />);
    await screen.findByRole('button', { name: 'Log in', exact: true });
    expect(state.resources).not.toHaveBeenCalled();
  });

  it('ignores delayed data from an account that has been switched away from', async () => {
    let finishFirst;
    state.initial = { uid: 'first', email: 'first@example.com' };
    state.resources.mockImplementation(uid => uid === 'first'
      ? new Promise(resolve => { finishFirst = resolve; })
      : Promise.resolve([{ id: 'second-resource', title: 'Second account resource' }]));
    render(<App />);
    await waitFor(() => expect(state.resources).toHaveBeenCalledWith('first'));
    act(() => state.listener({ uid: 'second', email: 'second@example.com' }));
    await screen.findByText('Second account resource');
    await act(async () => finishFirst([{ id: 'first-resource', title: 'First account private resource' }]));
    expect(screen.queryByText('First account private resource')).not.toBeInTheDocument();
    expect(screen.getByText('Second account resource')).toBeInTheDocument();
  });

  it('does not display a failed task update as saved', async () => {
    state.initial = { uid: 'student', email: 'student@example.com' };
    state.tasks.mockResolvedValue([{ id: 'task', title: 'Submit report', status: 'todo', category: 'General', priority: 'Medium' }]);
    state.updateTask.mockRejectedValue(new Error('Offline'));
    render(<App />);
    await screen.findByText('Submit report');
    fireEvent.click(screen.getByRole('button', { name: 'Tasks', exact: true }));
    const select = await screen.findByLabelText('Change status for Submit report');
    fireEvent.change(select, { target: { value: 'completed' } });
    await screen.findByText('Could not save the task changes. Please try again.');
    expect(select).toHaveValue('todo');
  });

  it('keeps the global query when viewing all results from the current Library page', async () => {
    state.initial = { uid: 'student', email: 'student@example.com' };
    state.resources.mockResolvedValue([
      { id: 'matching', title: 'OS guide', type: 'Note', content: 'System calls explained' },
      { id: 'other', title: 'Other lecture', type: 'Note', content: 'Different topic' },
    ]);
    render(<App />);
    await screen.findByText('OS guide');
    fireEvent.click(screen.getByRole('button', { name: 'Library', exact: true }));
    await screen.findByRole('searchbox', { name: 'Search resources by title, category, or tag' });
    const globalSearch = screen.getByRole('searchbox', { name: 'Search your resources and tasks' });
    fireEvent.focus(globalSearch);
    fireEvent.change(globalSearch, { target: { value: 'system calls' } });
    fireEvent.click(await screen.findByRole('button', { name: 'View all results in Library →' }));
    expect(await screen.findByRole('searchbox', { name: 'Search resources by title, category, or tag' })).toHaveValue('system calls');
    expect(screen.getByRole('button', { name: 'View details for OS guide' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details for Other lecture' })).not.toBeInTheDocument();
  });

  it('opens filtered Tasks when the global search has only task results', async () => {
    state.initial = { uid: 'student', email: 'student@example.com' };
    state.tasks.mockResolvedValue([
      { id: 'matching', title: 'Submit report', status: 'todo' },
      { id: 'other', title: 'Read chapter', status: 'todo' },
    ]);
    render(<App />);
    await screen.findByText('Submit report');
    const globalSearch = screen.getByRole('searchbox', { name: 'Search your resources and tasks' });
    fireEvent.focus(globalSearch);
    fireEvent.change(globalSearch, { target: { value: 'Submit report' } });
    fireEvent.click(await screen.findByRole('button', { name: 'View all results in Tasks →' }));
    expect(await screen.findByRole('searchbox', { name: 'Search tasks by title or category' })).toHaveValue('Submit report');
    expect(screen.getByLabelText('Change status for Submit report')).toBeInTheDocument();
    expect(screen.queryByLabelText('Change status for Read chapter')).not.toBeInTheDocument();
  });
});
