import { supabase } from '../config/supabase';
import { resourceRecord, taskRecord } from '../utils/records';
import { analysisTaskId } from '../utils/tasks';

function client() {
  if (!supabase) throw new Error('Database is not configured.');
  return supabase;
}
function record(row, kind) {
  return (kind === 'resources' ? resourceRecord : taskRecord)({ ...row.data,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }, row.id);
}
async function list(kind, userId) {
  if (!userId) throw new Error('A user is required.');
  const records = [];
  let cursor = null;
  do {
    const page = await getRecordPage(kind, userId, cursor);
    records.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}
export async function getRecordPage(kind, userId, cursor = null, pageSize = 50) {
  const { data, error } = await client().rpc('anchor_page_records', {
    record_kind: kind, owner_id: userId, page_size: pageSize,
    cursor_created: cursor?.createdAt || null, cursor_id: cursor?.id || null,
  });
  if (error) throw error;
  const last = data.at(-1);
  return { items: data.map(row => record(row, kind)), nextCursor: data.length === pageSize ? { createdAt: last.created_at, id: last.id } : null };
}
export async function getRecord(kind, userId, id) {
  if (!['resources', 'tasks'].includes(kind) || !userId || !id) throw new Error('Invalid record request.');
  const { data, error } = await client().from(kind).select('*').eq('user_id', userId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? record(data, kind) : null;
}
async function add(kind, userId, data, id = crypto.randomUUID()) {
  if (!userId) throw new Error('A user is required.');
  const { error } = await client().from(kind).insert({ id, user_id: userId, data });
  if (error) throw error;
  return id;
}
async function update(kind, userId, id, patch) {
  if (!userId || !id) throw new Error('A user and record are required.');
  // Merge on the server so independent updates cannot overwrite other fields.
  const { error } = await client().rpc('anchor_update_record', { record_kind: kind, record_id: id, owner_id: userId, patch });
  if (error) throw error;
}
async function remove(kind, userId, id) {
  if (!userId || !id) throw new Error('A user and record are required.');
  const { error } = await client().from(kind).delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
export const getResources = userId => list('resources', userId);
export const getTasks = userId => list('tasks', userId);
export const addResource = (userId, data, id) => add('resources', userId, data, id || undefined);
export const addTask = (userId, data) => add('tasks', userId, data);
export const updateResource = (userId, id, data) => update('resources', userId, id, data);
export const updateTask = (userId, id, data) => update('tasks', userId, id, data);
export const deleteResource = (userId, id) => remove('resources', userId, id);
export const deleteTask = (userId, id) => remove('tasks', userId, id);
export async function addAnalysisTask(userId, resourceId, data) {
  if (!userId || !resourceId) throw new Error('A user and resource are required.');
  const id = await analysisTaskId(resourceId, data.title);
  const { data: inserted, error } = await client().from('tasks').upsert({ id, user_id: userId, data },
    { onConflict: 'user_id,id', ignoreDuplicates: true }).select('*');
  if (error) throw error;
  if (inserted.length) return { created: true, task: record(inserted[0], 'tasks') };
  const { data: existing, error: readError } = await client().from('tasks').select('*').eq('user_id', userId).eq('id', id).single();
  if (readError) throw readError;
  return { created: false, task: record(existing, 'tasks') };
}
