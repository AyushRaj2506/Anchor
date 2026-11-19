begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
-- Request headers contain the worker credential. These queues are administrative.
revoke all on net.http_request_queue, net._http_response from public,anon,authenticated;

create function anchor_private.dispatch_worker(route text) returns bigint
language plpgsql security definer set search_path='' as $$
declare config anchor_private.worker_config; request_id bigint;
begin
 if route not in ('jobs/run','maintenance/run') then raise exception 'Invalid worker'; end if;
 select * into config from anchor_private.worker_config where id;
 if not found then return null; end if;
 if route='jobs/run' and not exists(select 1 from public.ai_jobs where status='queued' or (status='processing' and lease_until<now())) then return null; end if;
 select net.http_post(url:=config.base_url||'/api/'||route,body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||config.secret),
  timeout_milliseconds:=150000) into request_id;
 return request_id;
end;
$$;
revoke all on function anchor_private.dispatch_worker(text) from public,anon,authenticated;

create function anchor_private.wake_analysis_worker() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform anchor_private.dispatch_worker('jobs/run'); return new;
end;
$$;
revoke all on function anchor_private.wake_analysis_worker() from public,anon,authenticated;
create trigger analysis_enqueued after insert on public.ai_jobs for each row execute function anchor_private.wake_analysis_worker();

create function anchor_private.housekeeping() returns void
language plpgsql security invoker set search_path='' as $$
begin
 -- Keep recent failures available for diagnosis; source resources are retained.
 delete from public.ai_jobs where status in ('succeeded','failed') and updated_at<now()-interval '7 days';
 delete from anchor_private.ai_usage where usage_day<current_date-30;
 delete from anchor_private.upload_intents where state='deleted' and created_at<now()-interval '30 days';
 delete from cron.job_run_details where end_time<now()-interval '7 days';
 perform anchor_private.dispatch_worker('maintenance/run');
end;
$$;
revoke all on function anchor_private.housekeeping() from public,anon,authenticated;
select cron.schedule('anchor-analysis-worker','* * * * *', $$select anchor_private.dispatch_worker('jobs/run')$$);
select cron.schedule('anchor-maintenance','15 * * * *', $$select anchor_private.housekeeping()$$);

create function public.anchor_upload_intent(object_path text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('mime',mime_type,'size',expected_size,'state',state)
 from anchor_private.upload_intents where path=object_path;
$$;
create function public.anchor_record_inspection(object_path text,digest text,rejected boolean) returns void
language sql security invoker set search_path='' as $$
 update anchor_private.upload_intents set state=case when rejected then 'rejected' else 'clean' end,
  sha256=digest,inspected_at=now() where path=object_path and state in ('pending','clean','rejected');
$$;
revoke all on function public.anchor_upload_intent(text),public.anchor_record_inspection(text,text,boolean) from public,anon,authenticated;
grant execute on function public.anchor_upload_intent(text),public.anchor_record_inspection(text,text,boolean) to service_role;
commit;
