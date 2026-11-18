export function taskTitleKey(title) {
  return typeof title === 'string' ? title.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

export function parseTaskDeadline(value) {
  const deadline = typeof value === 'string' ? value.trim() : '';
  if (!deadline) return { deadline: 'No deadline', deadlineMs: null };
  // Retain incomplete source dates without inventing a year.
  if (!/\b\d{4}\b/.test(deadline)) return { deadline, deadlineMs: null };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  const date = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3], 23, 59, 59, 999) : new Date(deadline);
  if (!Number.isFinite(date.getTime()) || iso && (date.getFullYear() !== +iso[1] || date.getMonth() !== +iso[2] - 1 || date.getDate() !== +iso[3])) {
    return { deadline, deadlineMs: null };
  }
  return { deadline: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), deadlineMs: date.getTime() };
}

export async function analysisTaskId(resourceId, title) {
  const bytes = new TextEncoder().encode(JSON.stringify([resourceId, taskTitleKey(title)]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'ai-' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
