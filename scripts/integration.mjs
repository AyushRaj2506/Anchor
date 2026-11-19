// Opt-in live check: creates only synthetic test data under a unique test UID,
// then removes that account, its known documents, and its uploaded file.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

if (!process.argv.includes('--run')) {
  console.log('Run with --run to test the configured live services using a temporary test account.');
  process.exit(0);
}
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const base = process.env.ANCHOR_TEST_URL || 'http://localhost:5173';
const uid = randomUUID();
const password = 'Anchor-Audit-' + randomUUID();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const storage = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const resourceRef = { id: 'audit-note', path: 'resources/audit-note' };
const taskRef = { id: 'audit-task', path: 'tasks/audit-task' };
function tableFor(ref) { return ref === resourceRef ? 'resources' : 'tasks'; }
function check(error) { if (error) throw error; }
async function setDoc(ref, value) { const { error } = await db.from(tableFor(ref)).insert({ user_id: uid, id: ref.id, data: value }); check(error); }
async function updateDoc(ref, value) { const { error } = await db.rpc('anchor_update_record', { record_kind: tableFor(ref), record_id: ref.id, owner_id: uid, patch: value }); check(error); }
async function getDoc(ref) { const { data, error } = await db.from(tableFor(ref)).select('data').eq('user_id', uid).eq('id', ref.id).single(); check(error); return { data: () => data.data }; }
async function deleteDoc(ref) { const { error } = await db.from(tableFor(ref)).delete().eq('user_id', uid).eq('id', ref.id); check(error); }
const serverTimestamp = () => new Date().toISOString();
let created = false;
let secondId = null;
let storagePath;
let token;
let cleaned = true;

async function api(endpoint, body, expected = 200, authenticated = true) {
  const response = await fetch(base + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(110000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, endpoint + ': ' + (result.error || response.status));
  if (expected === 200) assert.equal(result.success, true, endpoint);
  return result.data;
}

function pdf(text) {
  const stream = `BT /F1 12 Tf 40 750 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}

try {
  const account = await storage.auth.admin.createUser({ id: uid, email: 'anchor-audit-' + uid + '@example.com', password, email_confirm: true }); check(account.error);
  created = true;
  const login = await db.auth.signInWithPassword({ email: 'anchor-audit-' + uid + '@example.com', password }); check(login.error);
  token = login.data.session.access_token;
  console.log('PASS Supabase password authentication');
  await api('/api/ai/analyze', { text: 'Test' }, 401, false);
  const content = 'Anchor integration test. Submit the integration report by December 15, 2026.';
  const resource = { title: 'Integration test note', type: 'Note', category: 'Testing', tags: ['audit'], content, bookmarked: false };
  await setDoc(resourceRef, { ...resource, createdAt: serverTimestamp() });
  await updateDoc(resourceRef, { bookmarked: true });
  assert.equal((await getDoc(resourceRef)).data().bookmarked, true);
  const listed = await db.from('resources').select('id').eq('user_id', uid); check(listed.error); assert.equal(listed.data.length, 1);
  const anonymous = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const denied = await anonymous.from('resources').select('id'); assert.ok(denied.error || denied.data.length === 0);
  const forged = await db.from('tasks').insert({ user_id: randomUUID(), id: 'forged', data: {} }); assert.ok(forged.error, 'RLS must reject writes to another user');
  await Promise.all([updateDoc(resourceRef, { concurrentA: true }), updateDoc(resourceRef, { concurrentB: true })]);
  const merged = (await getDoc(resourceRef)).data(); assert.ok(merged.concurrentA && merged.concurrentB);
  const second = await storage.auth.admin.createUser({ email: 'anchor-isolation-' + uid + '@example.com', password, email_confirm: true }); check(second.error); secondId = second.data.user.id;
  const other = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  check((await other.auth.signInWithPassword({ email: 'anchor-isolation-' + uid + '@example.com', password })).error);
  check((await other.from('resources').insert({ user_id: secondId, id: resourceRef.id, data: { title: 'Isolation fixture' } })).error);
  const crossRead = await db.from('resources').select('id').eq('user_id', secondId); check(crossRead.error); assert.equal(crossRead.data.length, 0);
  const staleUpdate = await db.rpc('anchor_update_record', { record_kind: 'resources', record_id: resourceRef.id, owner_id: secondId, patch: { title: 'Unauthorized' } }); assert.ok(staleUpdate.error);
  const crossDelete = await other.from('resources').delete().eq('user_id', uid).eq('id', resourceRef.id); check(crossDelete.error);
  assert.equal((await getDoc(resourceRef)).data().title, resource.title);
  const attempts = await Promise.all(Array.from({ length: 3 }, () => db.from('tasks').upsert({ user_id: uid, id: 'audit-ai-task', data: { title: 'One generated task', status: 'todo' } }, { onConflict: 'user_id,id', ignoreDuplicates: true }).select('id')));
  attempts.forEach(result => check(result.error)); assert.equal(attempts.reduce((n, result) => n + result.data.length, 0), 1);
  await other.auth.signOut();
  console.log('PASS cross-account read/write/delete denial, session-owner guard, concurrent merge and task deduplication');
  console.log('PASS Postgres CRUD, atomic merge and RLS ownership');
  const analysis = await api('/api/ai/analyze', { resource });
  assert.equal(typeof analysis.summary, 'string');
  assert.ok(analysis.actionItems.length > 0);
  await updateDoc(resourceRef, { aiSummary: analysis.summary, aiActionItems: analysis.actionItems });
  const task = { title: 'Submit integration report', category: 'Testing', status: 'todo', priority: 'Medium', deadlineMs: new Date('2026-12-15T23:59:00').getTime() };
  await setDoc(taskRef, { ...task, createdAt: serverTimestamp() });
  await updateDoc(taskRef, { status: 'completed' });
  assert.equal((await getDoc(taskRef)).data().status, 'completed');
  console.log('PASS AI note analysis and task persistence');
  const bytes = pdf(content);
  const upload = await api('/api/storage/create-upload-url', { resourceId: 'audit-pdf', fileName: 'audit.pdf', fileType: 'application/pdf', fileSize: bytes.length });
  storagePath = upload.path;
  const put = await fetch(upload.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes, signal: AbortSignal.timeout(30000) });
  assert.ok(put.ok, 'Signed PDF upload failed');
  const download = await api('/api/storage/create-download-url', { storagePath });
  const downloaded = await fetch(download.signedUrl, { signal: AbortSignal.timeout(30000) });
  assert.ok(downloaded.ok);
  assert.equal((await downloaded.arrayBuffer()).byteLength, bytes.length);
  await api('/api/storage/create-download-url', { storagePath: 'another-user/audit.pdf' }, 403);
  console.log('PASS private file upload/download and cross-user access denial');
  const fileAnalysis = await api('/api/ai/analyze-resource', { storagePath, fileType: 'application/pdf' });
  assert.equal(typeof fileAnalysis.summary, 'string');
  assert.ok(fileAnalysis.contentText?.length > 0);
  console.log('PASS AI analysis of actual PDF bytes');
  const urlAnalysis = await api('/api/ai/analyze-url', { url: 'https://example.com', title: 'Example Domain' });
  assert.ok(urlAnalysis.contentText?.length > 0);
  console.log('PASS public URL fetching and AI analysis');
  const answer = await api('/api/ai/ask', { question: 'When is the integration report due?', context: { resources: [{ id: resourceRef.id, ...resource }], tasks: [{ id: taskRef.id, ...task }] } });
  assert.equal(answer.notFound, false);
  assert.ok(answer.sources.length > 0);
  assert.match(answer.answer, /15|fifteenth/i);
  console.log('PASS grounded knowledge answer with verified citations');
  await api('/api/storage/delete-file', { storagePath });
  storagePath = null;
  console.log('PASS authenticated file deletion');
  const recoveryRedirect = new URL('/?recovery=1', base).href;
  const recovery = await storage.auth.admin.generateLink({ type: 'recovery', email: 'anchor-audit-' + uid + '@example.com', options: { redirectTo: recoveryRedirect } }); check(recovery.error);
  assert.equal(new URL(recovery.data.properties.action_link).searchParams.get('redirect_to'), recoveryRedirect, 'Supabase must allow the application recovery callback');
  const recovering = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  check((await recovering.auth.verifyOtp({ token_hash: recovery.data.properties.hashed_token, type: 'recovery' })).error);
  const nextPassword = 'Anchor-Recovered-' + randomUUID(); check((await recovering.auth.updateUser({ password: nextPassword })).error);
  check((await recovering.auth.signInWithPassword({ email: 'anchor-audit-' + uid + '@example.com', password: nextPassword })).error);
  await recovering.auth.signOut(); console.log('PASS Supabase recovery token and new-password sign-in (no email sent)');
} catch (error) {
  // Assertion text never includes credentials or tokens.
  console.error('FAIL integration check:', error.message);
  process.exitCode = 1;
} finally {
  if (storagePath) {
    const { error } = await storage.storage.from('anchor-resources').remove([storagePath]);
    if (error) { cleaned = false; console.error('Cleanup failed for temporary test file:', storagePath); }
  }
  if (created) {
    for (const ref of [resourceRef, taskRef]) {
      try { await deleteDoc(ref); } catch { cleaned = false; console.error('Cleanup failed for temporary document:', ref.path); }
    }
    const extra = await db.from('tasks').delete().eq('user_id', uid).eq('id', 'audit-ai-task'); if (extra.error) cleaned = false;
    await db.auth.signOut();
  }
  if (secondId) {
    try { const removed = await storage.auth.admin.deleteUser(secondId); check(removed.error); }
    catch { cleaned = false; console.error('Cleanup failed for synthetic isolation account.'); }
  }
  if (created) {
    try { const removed = await storage.auth.admin.deleteUser(uid); check(removed.error); } catch { cleaned = false; console.error('Cleanup failed for temporary account:', uid); }
  }
  if (cleaned) console.log('PASS temporary test data and account cleaned up');
  else process.exitCode = 1;
}
