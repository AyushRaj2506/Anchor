import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Tasks from '../../pages/Tasks';
import Library from '../../pages/Library';
import Login from '../../pages/Login';

const { login, reset } = vi.hoisted(() => ({ login: vi.fn(), reset: vi.fn() }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: login, sendPasswordResetEmail: reset }));
vi.mock('../../config/firebase', () => ({ auth: { currentUser: null }, db: {} }));

beforeEach(() => { vi.clearAllMocks(); });

describe('Save failures', () => {
  it('creates a task in the column whose Add Task button was used', async () => {
    const save = vi.fn().mockResolvedValue('new-task');
    render(<Tasks tasks={[{ id: 'existing', title: 'Existing task', status: 'todo' }]} onAddTask={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a new task to In Progress' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Work in progress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task', exact: true }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'inprogress' })));
  });
  it('keeps the task form open with its input after a failed save', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Offline'));
    render(<Tasks tasks={[]} onAddTask={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a new task' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My report' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task', exact: true }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save the task'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Title *')).toHaveValue('My report');
  });

  it('prevents duplicate task submissions while saving', async () => {
    let finish;
    const save = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    render(<Tasks tasks={[]} onAddTask={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a new task' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My report' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task', exact: true }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Title *'), { key: 'Enter' });
    expect(save).toHaveBeenCalledTimes(1);
    finish('new-task');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not save an empty note or unsafe URL', () => {
    const save = vi.fn();
    render(<Library resources={[]} user={{ isDemo: true }} onAddResource={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a new resource' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource', exact: true }));
    expect(screen.getByText(/Please enter the resource content/)).toBeInTheDocument();
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Type', { exact: true }), { target: { value: 'URL' } });
    fireEvent.change(screen.getByLabelText('URL *'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource', exact: true }));
    expect(screen.getByText(/Enter a valid HTTP\/HTTPS URL/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps resource content after a failed save', async () => {
    render(<Library resources={[]} user={{ isDemo: true }} onAddResource={vi.fn().mockRejectedValue(new Error('Offline'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a new resource' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Lecture' } });
    fireEvent.change(screen.getByLabelText('Content *'), { target: { value: 'Semaphores coordinate processes.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource', exact: true }));
    await screen.findByText(/Could not save the resource/);
    expect(screen.getByLabelText('Content *')).toHaveValue('Semaphores coordinate processes.');
  });
});

describe('Authentication regressions', () => {
  it('sends password reset links using the entered email', async () => {
    reset.mockResolvedValue();
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByText('Forgot password?'));
    expect(reset).toHaveBeenCalledWith(expect.any(Object), 'student@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent('password reset link');
  });

  it('does not lock existing Firebase users out due to a new signup password policy', async () => {
    login.mockResolvedValue();
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in', exact: true }));
    await waitFor(() => expect(login).toHaveBeenCalledWith(expect.any(Object), 'student@example.com', 'abc123'));
  });
});
