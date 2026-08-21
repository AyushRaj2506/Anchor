import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Library from '../../pages/Library';

const mockResources = [
  { id: '1', title: 'React Node', type: 'Note', bookmarked: false },
  { id: '2', title: 'Vitest PDF', type: 'PDF', bookmarked: true }
];

describe('Library Component', () => {
  it('renders resources', () => {
    render(<Library resources={mockResources} user={{ isDemo: true }} />);
    expect(screen.getByText('React Node')).toBeInTheDocument();
    expect(screen.getByText('Vitest PDF')).toBeInTheDocument();
  });

  it('filters resources by search query', () => {
    render(<Library resources={mockResources} user={{ isDemo: true }} />);
    const searchInput = screen.getByPlaceholderText('Search resources...');
    fireEvent.change(searchInput, { target: { value: 'React' } });
    
    expect(screen.getByText('React Node')).toBeInTheDocument();
    expect(screen.queryByText('Vitest PDF')).not.toBeInTheDocument();
  });

  it('renders add resource buttons', () => {
    render(<Library resources={mockResources} user={{ isDemo: true }} />);
    expect(screen.getByText('+ Add Resource')).toBeInTheDocument();
  });
});
