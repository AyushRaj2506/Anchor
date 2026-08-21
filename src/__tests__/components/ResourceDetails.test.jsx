import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResourceDetails from '../../pages/ResourceDetails';

const mockResource = {
  id: '1',
  title: 'DBMS Assignment',
  type: 'Note',
  content: 'Submit the DBMS assignment by September 5. Complete the report before submission.',
  aiSummary: 'Assignment details.',
  aiDeadline: 'September 5',
  aiActionItems: [{ title: 'Submit assignment' }, { title: 'Complete report' }]
};

describe('ResourceDetails Component', () => {
  it('renders resource metadata and content', () => {
    render(<ResourceDetails resource={mockResource} user={{ isDemo: true }} onBack={vi.fn()} />);
    expect(screen.getAllByText('DBMS Assignment')[0]).toBeInTheDocument();
    expect(screen.getByText('Submit the DBMS assignment by September 5. Complete the report before submission.')).toBeInTheDocument();
  });

  it('renders AI analysis correctly', () => {
    render(<ResourceDetails resource={mockResource} user={{ isDemo: true }} onBack={vi.fn()} />);
    expect(screen.getByText('Assignment details.')).toBeInTheDocument();
    expect(screen.getAllByText('September 5', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText('Submit assignment')).toBeInTheDocument();
    expect(screen.getByText('Complete report')).toBeInTheDocument();
  });

  it('renders bookmark and delete controls', () => {
    render(<ResourceDetails resource={mockResource} user={{ isDemo: true }} onBack={vi.fn()} />);
    expect(screen.getByText('Bookmark', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Delete', { exact: false })).toBeInTheDocument();
  });
});
