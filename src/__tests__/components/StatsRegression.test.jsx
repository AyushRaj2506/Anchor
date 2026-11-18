import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import StatCard from '../../components/StatCard';
import { resourceRecord, taskRecord } from '../../utils/records';

afterEach(() => vi.restoreAllMocks());

describe('Statistics and stored-record regressions', () => {
  it('updates displayed statistics when resources are added or removed', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const view = render(<StatCard label="Resources" value={2} />);
    await waitFor(() => expect(screen.getByLabelText('Resources: 2')).toHaveTextContent('2'));
    view.rerender(<StatCard label="Resources" value={3} />);
    await waitFor(() => expect(screen.getByLabelText('Resources: 3')).toHaveTextContent('3'));
  });

  it('uses Firestore document identity instead of a stale ID saved inside a document', () => {
    expect(resourceRecord({ id: 'stale', title: 'Notes' }, 'actual').id).toBe('actual');
    expect(taskRecord({ id: 'stale', title: 'Report' }, 'actual').id).toBe('actual');
  });

  it('normalizes legacy records so malformed fields cannot crash filters and cards', () => {
    const resource = resourceRecord({ tags: 'dbms, sql', aiActionItems: [null, { title: 'Read', description: {} }] }, 'actual');
    expect(resource.title).toBe('Untitled resource');
    expect(resource.tags).toEqual(['dbms', 'sql']);
    expect(resource.aiActionItems).toEqual([{ title: 'Read', description: '', deadline: null }]);
    expect(taskRecord({ status: 'unknown', priority: {}, deadlineMs: 'invalid' }, 'task')).toMatchObject({ status: 'todo', priority: 'Medium', deadlineMs: null });
  });
});
