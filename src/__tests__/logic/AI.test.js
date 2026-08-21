import { describe, it, expect, vi } from 'vitest';
import { askQuestion, analyzeResource } from '../../services/ai';

// Mock the global fetch
global.fetch = vi.fn();

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
    const mockData = {
      summary: 'Mock summary',
      category: 'Mock Category',
      tags: ['mock'],
      importantInformation: ['Important!'],
      actionItems: [{ title: 'Do something', deadline: 'September 5' }]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData })
    });

    const result = await analyzeResource('Some text', 'Note');
    expect(result.summary).toBe('Mock summary');
    expect(result.actionItems[0].deadline).toBe('September 5');
  });
});
