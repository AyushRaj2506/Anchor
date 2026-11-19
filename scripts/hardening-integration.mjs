// Explicit opt-in. Uses disposable Supabase users and removes all their rows.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
if (!process.argv.includes('--run') && !process.argv.includes('--cleanup')) {
  console.log('Use --run for disposable-account checks or --cleanup after SQL checks.'); process.exit(0);
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicKey = process.env.VITE_SUPABASE_ANON_KEY;
const statePath = '.work.local/hardening-fixtures.json';
function check(result) { if (result.error) throw result.error; return result.data; }
if (process.argv.includes('--cleanup')) {
  const { owners } = JSON.parse(await readFile(statePath, 'utf8'));
  for (const id of owners) check(await admin.auth.admin.deleteUser(id));
  await unlink(statePath); console.log('PASS temporary hardening accounts removed'); process.exit(0);
}
const owners = [];
await mkdir('.work.local', { recursive: true });
try {
  const clients = [];
  for (let index = 0; index < 2; index++) {
    const email = 'anchor-hardening-' + randomUUID() + '@example.com', password = randomUUID() + '-Audit9!';
    const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    owners.push(user.id);
    // Persist immediately so an interrupted check can still clean up.
    await writeFile(statePath, JSON.stringify({ owners }));
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    check(await client.auth.signInWithPassword({ email, password })); clients.push(client);
  }
  const [owner, other] = owners, [client, second] = clients;
  const timestamp = '2026-01-01T00:00:00Z';
  const records = Array.from({ length: 1005 }, (_, index) => ({ user_id: owner, id: 'page-' + String(index).padStart(4, '0'),
    created_at: timestamp, data: { title: index === 0 ? 'Xylophone durability report' : 'Pagination fixture ' + index, content: 'Temporary audit note' } }));
  for (let start = 0; start < records.length; start += 200) check(await client.from('resources').insert(records.slice(start, start + 200)));
  let cursor = null;
  const ids = [];
  do {
    const page = check(await client.rpc('anchor_page_records', { record_kind: 'resources', owner_id: owner, page_size: 100,
      cursor_created: cursor?.created_at || null, cursor_id: cursor?.id || null }));
    ids.push(...page.map(row => row.id)); cursor = page.length === 100 ? page.at(-1) : null;
  } while (cursor);
  assert.equal(ids.length, 1005); assert.equal(new Set(ids).size, 1005);
  assert.equal(ids.at(-1), 'page-0000');
  assert.ok((await second.rpc('anchor_page_records', { record_kind: 'resources', owner_id: owner })).error);
  assert.ok((await client.rpc('anchor_consume_ai', { owner_id: owner, cost: 1 })).error);
  assert.ok((await client.rpc('anchor_claim_job')).error);
  console.log('PASS stable cursor pagination beyond 1,000 rows, same-timestamp boundaries and RPC isolation');
  const knowledge = check(await admin.rpc('anchor_knowledge', { owner_id: owner, search_query: 'Xylophone', task_mode: '' }));
  assert.equal(knowledge.resources.length, 1); assert.equal(knowledge.resources[0].id, 'page-0000');
  assert.equal(check(await admin.rpc('anchor_knowledge', { owner_id: other, search_query: 'Xylophone', task_mode: '' })).resources.length, 0);
  console.log('PASS indexed owner-scoped retrieval beyond the first page');
  const allowances = await Promise.all(Array.from({ length: 15 }, () => admin.rpc('anchor_consume_ai', { owner_id: other, cost: 4 })));
  allowances.forEach(check);
  assert.equal(allowances.filter(result => result.data.allowed).length, 10);
  console.log('PASS concurrent quota reservations allow exactly 10 requests per minute');
  const key = randomUUID(), payload = { resourceId: 'page-0000', source_fingerprint: check(await admin.rpc('anchor_source_fingerprint', { document: records[0].data })) };
  const requests = await Promise.all(Array.from({ length: 3 }, () => admin.rpc('anchor_enqueue_job', { owner_id: owner, job_kind: 'text', job_payload: payload, request_key: key, credit_cost: 1 })));
  requests.forEach(check); assert.equal(new Set(requests.map(result => result.data.id)).size, 1);
  const jobId = requests[0].data.id; assert.ok(jobId);
  const different = check(await admin.rpc('anchor_enqueue_job', { owner_id: owner, job_kind: 'url', job_payload: payload, request_key: key, credit_cost: 2 }));
  assert.equal(different.status, 400);
  assert.equal(check(await second.from('ai_jobs').select('id').eq('user_id', owner)).length, 0);
  const lease = randomUUID();
  check(await admin.from('ai_jobs').update({ status: 'processing', lease_token: lease, lease_until: new Date(Date.now() + 180000).toISOString(), attempts: 1 }).eq('id', jobId).eq('user_id', owner));
  const output = { summary: 'Synthetic durable result', actionItems: [] };
  assert.equal(check(await admin.rpc('anchor_finish_job', { job_id: jobId, worker_lease: randomUUID(), output, generated_tasks: [] })), false);
  assert.equal(check(await admin.rpc('anchor_finish_job', { job_id: jobId, worker_lease: lease, output, generated_tasks: [] })), true);
  const saved = check(await client.from('resources').select('data').eq('id', 'page-0000').single());
  assert.equal(saved.data.aiSummary, output.summary);
  const changedId = randomUUID(), changedLease = randomUUID();
  check(await admin.from('ai_jobs').insert({ id: changedId, user_id: owner, kind: 'text', request_key: randomUUID(), payload,
    status: 'processing', attempts: 1, lease_token: changedLease, lease_until: new Date(Date.now() + 180000).toISOString() }));
  check(await client.rpc('anchor_update_record', { record_kind: 'resources', record_id: 'page-0000', owner_id: owner, patch: { content: 'Changed while analysis was running' } }));
  assert.equal(check(await admin.rpc('anchor_finish_job', { job_id: changedId, worker_lease: changedLease, output: { summary: 'Stale output' }, generated_tasks: [] })), true);
  const changed = check(await admin.from('ai_jobs').select('status,error').eq('id', changedId).single());
  assert.equal(changed.status, 'failed'); assert.match(changed.error, /changed during analysis/);
  assert.equal(check(await client.from('resources').select('data').eq('id', 'page-0000').single()).data.aiSummary, output.summary);
  console.log('PASS enqueue idempotency, job isolation, stale-lease rejection and transactional result persistence');
  const sql = `begin;
do $test$
declare owner uuid:='${owner}'; allowance jsonb; claimed public.ai_jobs; paths jsonb;
 ref_path text:='${owner}/retained/file.pdf'; orphan text:='${owner}/orphan/file.pdf';
begin
 update anchor_private.ai_usage set credits=99,minute_requests=0,minute_start=date_trunc('minute',now()) where user_id=owner;
 allowance:=public.anchor_consume_ai(owner,2);
 if (allowance->>'allowed')::boolean or allowance->>'reason'<>'daily' then raise exception 'Daily quota exceeded'; end if;
 allowance:=public.anchor_consume_ai(owner,1);
 if not (allowance->>'allowed')::boolean then raise exception 'Last available credit rejected'; end if;
 insert into anchor_private.upload_intents(path,user_id,resource_id,mime_type,expected_size,created_at)
 values(ref_path,owner,'retained','application/pdf',10,'1970-01-01'),(orphan,owner,'orphan','application/pdf',10,'1970-01-01');
 insert into public.resources(user_id,id,data) values(owner,'retained',jsonb_build_object('storagePath',ref_path));
 paths:=public.anchor_claim_orphans();
 if paths ? ref_path or not(paths ? orphan) then raise exception 'Cleanup reference guard failed'; end if;
 begin
  insert into public.resources(user_id,id,data) values(owner,'race',jsonb_build_object('storagePath',orphan));
  raise exception 'Cleanup save race was not rejected' using errcode='ZX001';
 exception when sqlstate 'ZX001' then raise; when others then if sqlerrm not like 'File unavailable%' then raise; end if; end;
 insert into public.ai_jobs(user_id,kind,request_key,payload,created_at) values(owner,'text',gen_random_uuid(),'{}','1970-01-01');
 select * into claimed from public.anchor_claim_job();
 if claimed.user_id<>owner or claimed.status<>'processing' or claimed.attempts<>1 then raise exception 'Queue claim failed'; end if;
 if not public.anchor_finish_job(claimed.id,claimed.lease_token,'{"summary":"Durable"}','[]') then raise exception 'Completion failed'; end if;
end $test$;
select 'PASS daily quota, queue claim, orphan grace/reference protection and save race' as result;
rollback;`;
  await writeFile('.work.local/verify-hardening.sql', sql);
  console.log('SQL checks prepared in .work.local/verify-hardening.sql; run --cleanup after applying the rollback-only verification.');
} catch (error) {
  for (const owner of owners) await admin.auth.admin.deleteUser(owner);
  await unlink(statePath).catch(() => {});
  throw error;
}
