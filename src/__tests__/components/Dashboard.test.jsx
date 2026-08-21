import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from '../../pages/Dashboard';

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

const mockUser = { name: 'Test User', isDemo: true };

const mockResources = [
  { id: '1', title: 'React Basics', type: 'Note' },
  { id: '2', title: 'Vitest Guide', type: 'PDF' }
];

const mockTasks = [
  { id: 't1', title: 'Read Guide', status: 'todo', deadlineMs: Date.now() + 100000 },
  { id: 't2', title: 'Write Tests', status: 'inprogress' }
];

describe('Dashboard Component', () => {
  it('renders greeting with user name', () => {
    render(<Dashboard resources={mockResources} tasks={mockTasks} user={mockUser} />);
    expect(screen.getByText(/Demo User/i)).toBeInTheDocument();
  });

  it('renders correct task and resource counts', () => {
    render(<Dashboard resources={mockResources} tasks={mockTasks} user={mockUser} />);
    // 2 resources
    expect(screen.getAllByText('2')[0]).toBeInTheDocument();
    // 2 pending tasks
    expect(screen.getByText('Pending Tasks (1 in progress)')).toBeInTheDocument();
  });

  it('renders recent resources', () => {
    render(<Dashboard resources={mockResources} tasks={mockTasks} user={mockUser} />);
    expect(screen.getByText('React Basics')).toBeInTheDocument();
    expect(screen.getByText('Vitest Guide')).toBeInTheDocument();
  });
});
