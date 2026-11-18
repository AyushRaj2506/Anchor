// Opt-in live check: creates only synthetic test data under a unique test UID,
// then removes that account, its known documents, and its uploaded file.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp as initializeAdmin, cert, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore/lite';
import { createClient } from '@supabase/supabase-js';

if (!process.argv.includes('--run')) {
  console.log('Run with --run to test the configured live services using a temporary test account.');
  process.exit(0);
}
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const base = process.env.ANCHOR_TEST_URL || 'http://localhost:5173';
const uid = 'anchor-audit-' + randomUUID();
const admin = initializeAdmin({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) }, uid);
const app = initializeApp({ apiKey: process.env.VITE_FIREBASE_API_KEY, projectId: process.env.VITE_FIREBASE_PROJECT_ID, appId: process.env.VITE_FIREBASE_APP_ID }, uid);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const adminAuth = getAdminAuth(admin);
const resourceRef = doc(db, 'users', uid, 'resources', 'audit-note');
const taskRef = doc(db, 'users', uid, 'tasks', 'audit-task');
let created = false;
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
  await adminAuth.createUser({ uid });
  created = true;
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid));
  token = await auth.currentUser.getIdToken();
  console.log('PASS Firebase authentication');
  await api('/api/ai/analyze', { text: 'Test' }, 401, false);
  const content = 'Anchor integration test. Submit the integration report by December 15, 2026.';
  const resource = { title: 'Integration test note', type: 'Note', category: 'Testing', tags: ['audit'], content, bookmarked: false };
  await setDoc(resourceRef, { ...resource, createdAt: serverTimestamp() });
  await updateDoc(resourceRef, { bookmarked: true });
  assert.equal((await getDoc(resourceRef)).data().bookmarked, true);
  assert.equal((await getDocs(collection(db, 'users', uid, 'resources'))).size, 1);
  console.log('PASS Firestore create/read/update and user-scoped queries');
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
} catch (error) {
  // Assertion text never includes credentials or tokens.
  console.error('FAIL integration check:', error.message);
  process.exitCode = 1;
} finally {
  if (storagePath) {
    const { error } = await storage.storage.from('anchor-resources').remove([storagePath]);
    if (error) { cleaned = false; console.error('Cleanup failed for temporary test file:', storagePath); }
  }
  if (auth.currentUser) {
    for (const ref of [resourceRef, taskRef]) {
      try { await deleteDoc(ref); } catch { cleaned = false; console.error('Cleanup failed for temporary document:', ref.path); }
    }
    await signOut(auth);
  }
  if (created) {
    try { await adminAuth.deleteUser(uid); } catch { cleaned = false; console.error('Cleanup failed for temporary account:', uid); }
  }
  await Promise.all([deleteApp(app), deleteAdmin(admin)]);
  if (cleaned) console.log('PASS temporary test data and account cleaned up');
  else process.exitCode = 1;
}
