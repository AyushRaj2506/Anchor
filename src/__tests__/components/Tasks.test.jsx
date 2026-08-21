import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Tasks from '../../pages/Tasks';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockTasks = [
  { id: '1', title: 'Task One', status: 'todo', category: 'General' },
  { id: '2', title: 'Task Two', status: 'inprogress', category: 'Homework' }
];

describe('Tasks Component', () => {
  it('renders task cards', () => {
    render(<Tasks tasks={mockTasks} user={{ isDemo: true }} />);
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('filters tasks by search query', () => {
    render(<Tasks tasks={mockTasks} user={{ isDemo: true }} />);
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'One' } });
    
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.queryByText('Task Two')).not.toBeInTheDocument();
  });

  it('allows adding a new task', () => {
    render(<Tasks tasks={mockTasks} user={{ isDemo: true }} />);
    const addBtn = screen.getAllByText('+ Add Task')[0];
    expect(addBtn).toBeInTheDocument();
  });
});
