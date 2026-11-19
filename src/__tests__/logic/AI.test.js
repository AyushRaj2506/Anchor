import { describe, it, expect, vi, afterEach } from 'vitest';
import { askQuestion, analyzeResource } from '../../services/ai';

// Mock the global fetch
global.fetch = vi.fn();
vi.mock('../../services/auth', () => ({ getAccessToken: vi.fn(async () => 'fresh-token') }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('AI Service', () => {
  it('askQuestion - Success', async () => {
    const mockResponse = {
      answer: 'This is a mocked answer.',
      sources: [{ id: '123', type: 'resource' }]
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockResponse })
    });

    const result = await askQuestion('What is DBMS?', { resources: [], tasks: [] }, 'fake-token');
    expect(result.answer).toBe('This is a mocked answer.');
    expect(result.sources.length).toBe(1);
  });

  it('askQuestion - Failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(askQuestion('Fail me', {}, 'fake-token')).rejects.toThrow('AI analysis is temporarily unavailable due to a network error.');
  });

  it('analyzeResource - Success', async () => {
    vi.useFakeTimers();
    const mockData = {
      summary: 'Mock summary',
      category: 'Mock Category',
      tags: ['mock'],
      importantInformation: ['Important!'],
      actionItems: [{ title: 'Do something', deadline: 'September 5' }]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'job-id', status: 'queued' } })
    });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { status: 'succeeded', result: mockData } }) });
    const pending = analyzeResource({ id: 'resource-id', content: 'Some text' }, 'token');
    await vi.advanceTimersByTimeAsync(2500);
    const result = await pending;
    expect(result.summary).toBe('Mock summary');
    expect(result.actionItems[0].deadline).toBe('September 5');
    expect(result._persisted).toBe(true);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ kind: 'text', payload: { resourceId: 'resource-id' } });
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token');
  });
});
