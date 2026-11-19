import { getStorageClient } from './clients.js';
import { resourceRecord, taskRecord } from '../src/utils/records.js';

const filler = new Set('what when where who how does do are is the a an my me i in on to of for from and or please tell about explain summarize main key points information saved knowledge resources notes document this that with'.split(' '));
export async function loadKnowledge(uid, question) {
  const tokens = [...new Set(question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token && !filler.has(token)))];
  const mode = /\boverdue\b/i.test(question) ? 'overdue' : /\b(upcoming|coming up|due soon)\b/i.test(question) ? 'upcoming'
    : /\b(pending|remaining|unfinished|outstanding)\b/i.test(question) ? 'pending' : /\b(tasks?|deadlines?|due|progress|priorit(?:y|ies))\b/i.test(question) ? 'all' : '';
  const { data, error } = await getStorageClient().rpc('anchor_knowledge', {
    owner_id: uid, search_query: tokens.join(' OR '), task_mode: mode,
  });
  if (error) throw Object.assign(new Error('Knowledge retrieval is temporarily unavailable.'), { status: 503 });
  return {
    resources: (data?.resources || []).map(item => resourceRecord(item, String(item.id))),
    tasks: (data?.tasks || []).map(item => taskRecord(item, String(item.id))),
  };
}
