// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseTaskDeadline, taskTitleKey, analysisTaskId } from '../../utils/tasks';

describe('AI task deadline and identity handling', () => {
  it('preserves yearless deadlines without inventing a calendar year', () => {
    expect(parseTaskDeadline('September 5')).toEqual({ deadline: 'September 5', deadlineMs: null });
  });
  it('uses the end of the local day for ISO date-only deadlines', () => {
    const parsed = parseTaskDeadline('2026-09-05');
    const date = new Date(parsed.deadlineMs);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(23);
  });
  it('does not silently roll impossible calendar dates into another month', () => {
    expect(parseTaskDeadline('2026-02-30').deadlineMs).toBeNull();
    expect(parseTaskDeadline(null)).toEqual({ deadline: 'No deadline', deadlineMs: null });
  });
  it('normalizes spacing and case for task deduplication', () => {
    expect(taskTitleKey('  Submit   Report ')).toBe('submit report');
  });
  it('creates stable IDs across retries while keeping different resources separate', async () => {
    const first = await analysisTaskId('resource-a', 'Submit report');
    expect(await analysisTaskId('resource-a', ' submit   REPORT ')).toBe(first);
    expect(await analysisTaskId('resource-b', 'Submit report')).not.toBe(first);
  });
});
