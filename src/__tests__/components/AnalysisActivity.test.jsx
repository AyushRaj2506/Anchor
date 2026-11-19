import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ result: vi.fn() }));
vi.mock('../../config/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: mocks.result }) }) }) }) } }));
import AnalysisActivity from '../../pages/AnalysisActivity';
beforeEach(() => vi.clearAllMocks());
it('shows saved completion and refreshes resources after returning to the page', async () => {
  mocks.result.mockResolvedValue({ data: [{ id: 'one', kind: 'file', status: 'succeeded', created_at: '2026-11-19T00:00:00Z', updated_at: '2026-11-19T00:01:00Z' }] });
  const refresh = vi.fn(async () => {});
  render(<AnalysisActivity user={{ uid: 'owner' }} onResults={refresh} />);
  expect(await screen.findByText('Completed')).toBeInTheDocument();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});
it('keeps request failures visible without replacing them with an empty success view', async () => {
  mocks.result.mockResolvedValue({ error: new Error('network') });
  render(<AnalysisActivity user={{ uid: 'owner' }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh');
});
