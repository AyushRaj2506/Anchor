// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAIContent, withTimeout } from '../../../server/clients.js';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-test-key');
  vi.stubEnv('GEMINI_FALLBACK_MODEL', '');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('Gemini REST transport', () => {
  it('uses the configured fallback model once when the primary quota is reached', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'gemini-3.5-flash-lite');
    fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) });
    expect((await generateAIContent({ contents: 'Test' })).text).toBe('{"ok":true}');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
  });
  it('sends JSON mode, system instructions, and input separately and ignores thought parts', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ thought: true, text: 'private thought' }, { text: '{"summary":"Notes"}' }] } }] }) });
    const result = await generateAIContent({ contents: 'Synthetic note', config: { systemInstruction: 'Ground answers in context.', responseMimeType: 'application/json' } });
    expect(result.text).toBe('{"summary":"Notes"}');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain(':generateContent');
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].text).toBe('Synthetic note');
    expect(body.systemInstruction.parts[0].text).toContain('Ground');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('preserves provider error status without exposing the provider response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: 'Internal provider detail' } }) });
    await expect(generateAIContent({ contents: 'Test' })).rejects.toMatchObject({ status: 429, message: 'AI provider request failed.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects empty or blocked responses', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    await expect(generateAIContent({ contents: 'Test' })).rejects.toThrow('no answer');
  });

  it('clears the application timeout after successful requests', async () => {
    vi.useFakeTimers();
    expect(await withTimeout(Promise.resolve('done'), 25000)).toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });
});
