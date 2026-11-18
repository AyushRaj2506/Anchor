import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchKnowledge } from '../../services/relevance';
import { readJSON, writeJSON } from '../../utils/persistence';
import { safeWebUrl } from '../../utils/url';
import { getDisplayName } from '../../utils/user';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Knowledge retrieval regressions', () => {
  it('finds saved notes using their actual content before AI analysis', () => {
    const note = { id: '1', title: 'Lecture', content: 'Semaphores coordinate concurrent processes.' };
    expect(searchKnowledge('Explain semaphores', [note]).resources).toEqual([note]);
  });

  it('answers generic pending-task questions without matching words in task titles', () => {
    const pending = { id: '1', title: 'Submit report', status: 'todo' };
    const completed = { id: '2', title: 'Read chapter', status: 'completed' };
    expect(searchKnowledge('What tasks are still pending?', [], [pending, completed]).tasks).toEqual([pending]);
  });

  it('retrieves future deadlines and excludes completed and overdue tasks', () => {
    const tasks = [
      { id: 'past', title: 'Old report', status: 'todo', deadlineMs: Date.now() - 86400000 },
      { id: 'next', title: 'New report', status: 'todo', deadlineMs: Date.now() + 86400000 },
      { id: 'done', title: 'Done report', status: 'completed', deadlineMs: Date.now() + 86400000 },
    ];
    expect(searchKnowledge('What deadlines are coming up?', [], tasks).tasks.map(task => task.id)).toEqual(['next']);
  });

  it('handles legacy/null array fields without crashing', () => {
    expect(() => searchKnowledge('biology', [{ title: 'biology', tags: 'biology', aiActionItems: [null], deadlines: [null] }])).not.toThrow();
  });

  it('does not retrieve unrelated content just because the question contains filler words', () => {
    expect(searchKnowledge('What is quantum chromodynamics?', [{ title: 'What to study', content: 'Gardening' }]).resources).toEqual([]);
  });
});

describe('Browser-state resilience', () => {
  it('recovers from malformed saved sessions', () => {
    localStorage.setItem('anchor-user', '{broken');
    expect(readJSON('anchor-user')).toBeNull();
  });

  it('keeps working when the browser blocks local storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    expect(readJSON('anchor-user', false)).toBe(false);
    expect(() => writeJSON('anchor-user', { isDemo: true })).not.toThrow();
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://user:pass@example.com', 'not a URL'])('rejects unsafe source links: %s', value => {
    expect(safeWebUrl(value)).toBeNull();
  });

  it('allows ordinary HTTP/HTTPS links', () => {
    expect(safeWebUrl('https://example.com/notes')).toBe('https://example.com/notes');
  });

  it('uses the name entered during registration', () => {
    expect(getDisplayName({ name: 'Ayush Raj', email: 'different@example.com' })).toBe('Ayush Raj');
  });
});
