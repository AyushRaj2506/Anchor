const STOP_WORDS = new Set(["what","when","where","who","how","does","do","are","is","the","a","an","my","me","i","in","on","to","of","for","from","and","or","please","tell","about","explain","summarize","main","key","points","information","saved","knowledge","resources","notes","document","this","that","with"]);
const text = value => typeof value === 'string' ? value.toLowerCase() : '';
const list = value => Array.isArray(value) ? value : [];

export function searchKnowledge(queryText, resources = [], tasks = []) {
  if (typeof queryText !== 'string' || !queryText.trim()) return { resources: [], tasks: [] };
  const tokens = [...new Set(text(queryText).split(/[^\p{L}\p{N}]+/u).filter(token => token && !STOP_WORDS.has(token)))];
  const score = (fields, words) => fields.reduce((total, [value, weight]) => total + words.reduce((sum, token) => sum + (text(value).includes(token) ? weight : 0), 0), 0);
  const taskIntent = /\b(tasks?|pending|deadlines?|due|overdue|upcoming|completed|progress|priorit(?:y|ies))\b/i.test(queryText);
  const pending = /\b(pending|remaining|unfinished|still|outstanding)\b/i.test(queryText);
  const deadlines = /\b(deadlines?|due|upcoming|overdue)\b/i.test(queryText);
  const upcoming = /\b(upcoming|coming up|due soon)\b/i.test(queryText);
  const overdue = /\boverdue\b/i.test(queryText);
  const scoredResources = list(resources).filter(Boolean).map(resource => ({
    resource,
    score: score([
      [resource.title, 10], [resource.category, 5], [resource.aiCategory, 5],
      [list(resource.tags).join(' '), 4], [list(resource.aiTags).join(' '), 4],
      [resource.description, 3], [resource.notes, 3], [resource.content, 3],
      [resource.contentText?.slice(0, 8000), 2], [resource.aiSummary, 4],
      [list(resource.aiImportantInformation).join(' '), 4],
      [list(resource.aiActionItems).map(item => typeof item === 'string' ? item : item?.title + ' ' + (item?.description || '')).join(' '), 6],
      [list(resource.deadlines).map(item => item?.title + ' ' + (item?.description || '') + ' ' + (item?.sourceText || '')).join(' '), 5],
      [resource.emailSender, 4], [resource.emailSubject, 6],
    ], tokens) || (tokens.length === 0 && !taskIntent ? 1 : 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const scoredTasks = list(tasks).filter(Boolean).filter(task => {
    if ((pending || deadlines) && task.status === 'completed') return false;
    if (deadlines && !Number.isFinite(task.deadlineMs)) return false;
    if (upcoming && task.deadlineMs < Date.now()) return false;
    if (overdue && task.deadlineMs >= Date.now()) return false;
    return true;
  }).map(task => ({
    task,
    score: score([[task.title, 10], [task.description, 3], [task.category, 5], [task.priority, 2], [task.status, 2]], tokens) + (taskIntent ? 3 : 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || (a.task.deadlineMs ?? Infinity) - (b.task.deadlineMs ?? Infinity));
  return { resources: scoredResources.slice(0, 8).map(item => item.resource), tasks: scoredTasks.slice(0, 8).map(item => item.task) };
}
