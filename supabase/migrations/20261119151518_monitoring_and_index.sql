begin;
create index upload_intents_owner on anchor_private.upload_intents(user_id);
create function public.anchor_health() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'workerConfigured',exists(select 1 from anchor_private.worker_config),
  'queued',(select count(*) from public.ai_jobs where status='queued'),
  'processing',(select count(*) from public.ai_jobs where status='processing'),
  'stalled',(select count(*) from public.ai_jobs where (status='queued' and created_at<now()-interval '5 minutes') or (status='processing' and lease_until<now())),
  'failedLast24Hours',(select count(*) from public.ai_jobs where status='failed' and updated_at>now()-interval '24 hours')
 );
$$;
revoke all on function public.anchor_health() from public,anon,authenticated;
grant execute on function public.anchor_health() to service_role;
commit;
