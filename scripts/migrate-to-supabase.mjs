// One-time import from an ignored local Firebase export. No Firebase dependency
// remains in the application. This never deletes legacy accounts, rows or files.
import fs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { firebasePasswordHash } from './lib/firebase-hash.mjs';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const backupPath = process.env.ANCHOR_MIGRATION_BACKUP || '.migration.local/firebase-backup.json';
const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
const run = process.argv.includes('--run');
const confirmExisting = process.argv.includes('--confirm-existing');
const config = backup.hashConfig;
assert.equal(config?.algorithm, 'SCRYPT', 'Export the Firebase SCRYPT hash configuration first.');
assert.ok(config.signerKey && config.saltSeparator, 'Hash configuration is incomplete.');
for (const user of backup.users) assert.ok(user.email && user.passwordHash && user.passwordSalt, 'An account needs a supported email/password export.');
console.log('Migration preflight:', backup.users.length, 'accounts;', backup.data.reduce((n, d) => n + d.resources.length, 0), 'resources;', backup.data.reduce((n, d) => n + d.tasks.length, 0), 'tasks.');
if (!run) { console.log('No changes made. Use --run; --confirm-existing preserves previously allowed unverified-email sign-in.'); process.exit(0); }
const env = process.env;
const client = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function check(error) { if (error) throw error; }
function convert(value) {
  if (!value || typeof value !== 'object') return value;
  if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000 + (value._nanoseconds || 0) / 1e6).toISOString();
  if (Array.isArray(value)) return value.map(convert);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convert(item)]));
}
const existing = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 }); check(error);
  existing.push(...data.users); if (data.users.length < 1000) break;
}
const mapping = {};
for (const user of backup.users) {
  const found = existing.find(candidate => candidate.app_metadata?.legacy_firebase_uid === user.uid);
  if (found) { mapping[user.uid] = found.id; continue; }
  assert.ok(!existing.some(candidate => candidate.email?.toLowerCase() === user.email.toLowerCase()), 'An unrelated Supabase account already uses a migration email. Resolve ownership before retrying.');
  const hash = firebasePasswordHash(user, config);
  const { data, error } = await client.auth.admin.createUser({
    id: randomUUID(), email: user.email, password_hash: hash,
    email_confirm: user.emailVerified || confirmExisting,
    user_metadata: { name: user.displayName || user.email.split('@')[0] },
    app_metadata: { legacy_firebase_uid: user.uid, legacy_email_verified: user.emailVerified, migration: 'anchor_supabase_v1' },
    ...(user.disabled ? { ban_duration: '876000h' } : {}),
  }); check(error); mapping[user.uid] = data.user.id;
}
await fs.writeFile('.migration.local/account-map.json', JSON.stringify(mapping, null, 2));
let files = 0;
for (const owner of backup.data) {
  const uid = mapping[owner.uid]; assert.ok(uid, 'Missing account mapping.');
  for (const kind of ['resources', 'tasks']) for (const entry of owner[kind]) {
    const data = convert(entry.data);
    if (data.storagePath) {
      assert.ok(data.storagePath.startsWith(owner.uid + '/'), 'Unexpected legacy object owner.');
      const target = uid + data.storagePath.slice(owner.uid.length);
      const bucket = client.storage.from('anchor-resources');
      const source = await bucket.download(data.storagePath); check(source.error);
      const bytes = Buffer.from(await source.data.arrayBuffer());
      const old = await bucket.download(target);
      if (!old.error) {
        const existingBytes = Buffer.from(await old.data.arrayBuffer());
        assert.equal(createHash('sha256').update(existingBytes).digest('hex'), createHash('sha256').update(bytes).digest('hex'), 'Existing migration target differs; refusing to overwrite it.');
      } else {
        const uploaded = await bucket.upload(target, bytes, { contentType: data.fileType || source.data.type || 'application/octet-stream', upsert: false }); check(uploaded.error);
      }
      data.storagePath = target; files++;
    }
    const created = data.createdAt || new Date().toISOString();
    const updated = data.updatedAt || created;
    const { error } = await client.from(kind).upsert({ user_id: uid, id: entry.id, data, created_at: created, updated_at: updated }, { onConflict: 'user_id,id', ignoreDuplicates: true }); check(error);
    const result = await client.from(kind).select('data').eq('user_id', uid).eq('id', entry.id).single(); check(result.error);
    assert.deepEqual(result.data.data, data, 'A target row differs from its export; refusing to overwrite it.');
  }
}
console.log('PASS imported and verified accounts, resource/task data and', files, 'private files. Legacy data remains intact.');
