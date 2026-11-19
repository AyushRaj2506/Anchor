begin;
create schema if not exists anchor_private;
revoke all on schema anchor_private from public, anon, authenticated;
grant usage on schema anchor_private to service_role;

create table anchor_private.ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 minute_start timestamptz not null,
 minute_requests integer not null default 0,
 credits integer not null default 0,
 primary key(user_id, usage_day)
);
alter table anchor_private.ai_usage enable row level security;
grant all on anchor_private.ai_usage to service_role;

create function public.anchor_consume_ai(owner_id uuid, cost integer default 1)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare u anchor_private.ai_usage; minute_bucket timestamptz := date_trunc('minute',now());
 day_bucket date := (now() at time zone 'UTC')::date;
begin
 if cost not between 1 and 4 then raise exception 'Invalid credit cost'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 19));
 insert into anchor_private.ai_usage(user_id,usage_day,minute_start) values(owner_id,day_bucket,minute_bucket) on conflict do nothing;
 select * into u from anchor_private.ai_usage where user_id=owner_id and usage_day=day_bucket for update;
 if u.minute_start <> minute_bucket then u.minute_requests:=0; end if;
 if u.credits+cost > 100 then return jsonb_build_object('allowed',false,'reason','daily','retryAfter',greatest(1,extract(epoch from ((day_bucket+1)::timestamp at time zone 'UTC')-now())::integer)); end if;
 if u.minute_requests >= 10 then return jsonb_build_object('allowed',false,'reason','minute','retryAfter',greatest(1,60-extract(second from now())::integer)); end if;
 update anchor_private.ai_usage set credits=credits+cost,minute_start=minute_bucket,minute_requests=u.minute_requests+1 where user_id=owner_id and usage_day=day_bucket;
 return jsonb_build_object('allowed',true,'remaining',100-u.credits-cost);
end;
$$;
revoke all on function public.anchor_consume_ai(uuid,integer) from public,anon,authenticated;
grant execute on function public.anchor_consume_ai(uuid,integer) to service_role;

create index resources_owner_cursor on public.resources(user_id,created_at desc,id desc);
create index tasks_owner_cursor on public.tasks(user_id,created_at desc,id desc);
create index resources_search on public.resources using gin(to_tsvector('english',data::text));
create index tasks_search on public.tasks using gin(to_tsvector('english',data::text));

create function public.anchor_knowledge(owner_id uuid, search_query text, task_mode text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
 with q as (select websearch_to_tsquery('english',left(search_query,2000)) as query),
 r as (select id,data from public.resources,q where user_id=owner_id
   and (numnode(q.query)=0 or to_tsvector('english',data::text) @@ q.query)
   order by ts_rank(to_tsvector('english',data::text),q.query) desc,created_at desc,id desc limit 8),
 t as (select id,data from public.tasks,q where user_id=owner_id
   and (task_mode<>'' or numnode(q.query)=0 or to_tsvector('english',data::text) @@ q.query)
   and (task_mode not in ('pending','upcoming','overdue') or coalesce(data->>'status','todo')<>'completed')
   and (task_mode not in ('upcoming','overdue') or case when jsonb_typeof(data->'deadlineMs')='number'
     then case when task_mode='upcoming' then (data->>'deadlineMs')::numeric >= extract(epoch from now())*1000
       else (data->>'deadlineMs')::numeric < extract(epoch from now())*1000 end else false end)
   order by ts_rank(to_tsvector('english',data::text),q.query) desc,created_at desc,id desc limit 8)
 select jsonb_build_object('resources',coalesce((select jsonb_agg(data||jsonb_build_object('id',id)) from r),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(data||jsonb_build_object('id',id)) from t),'[]'::jsonb));
$$;
revoke all on function public.anchor_knowledge(uuid,text,text) from public,anon,authenticated;
grant execute on function public.anchor_knowledge(uuid,text,text) to service_role;

create table public.ai_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('text','file','url')),
 request_key uuid not null,unique(user_id,request_key),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=220000),
 status text not null default 'queued' check(status in ('queued','processing','succeeded','failed')),
 result jsonb,error text,attempts integer not null default 0,
 lease_token uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.ai_jobs enable row level security;
revoke all on public.ai_jobs from public,anon,authenticated;
grant select on public.ai_jobs to authenticated;
grant all on public.ai_jobs to service_role;
create policy jobs_own on public.ai_jobs for select to authenticated using(user_id=(select auth.uid()));
create index jobs_owner_created on public.ai_jobs(user_id,created_at desc);
create index jobs_pending on public.ai_jobs(created_at) where status in ('queued','processing');
create function public.anchor_claim_job() returns setof public.ai_jobs
language plpgsql security invoker set search_path = '' as $$
begin
 update public.ai_jobs set status='failed',error='Analysis was interrupted. Please retry.',updated_at=now()
 where status='processing' and lease_until<now() and attempts>=3;
 return query update public.ai_jobs set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
 where id=(select j.id from public.ai_jobs j where (j.status='queued' or j.status='processing' and j.lease_until<now()) and j.attempts<3 order by j.created_at for update skip locked limit 1) returning *;
end;
$$;
revoke all on function public.anchor_claim_job() from public,anon,authenticated;
grant execute on function public.anchor_claim_job() to service_role;

create function public.anchor_enqueue_job(owner_id uuid,job_kind text,job_payload jsonb,request_key uuid,credit_cost integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.ai_jobs; allowance jsonb; job_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,19));
 select * into existing from public.ai_jobs j where j.user_id=owner_id and j.request_key=anchor_enqueue_job.request_key;
 if found then
  if existing.kind<>job_kind or existing.payload<>job_payload then return jsonb_build_object('status',400,'error','Request ID already used'); end if;
  return jsonb_build_object('id',existing.id,'status',202);
 end if;
 if (select count(*) from public.ai_jobs where user_id=owner_id and status in ('queued','processing'))>=3 then
  return jsonb_build_object('status',429,'error','Three analyses are already queued. Please wait for one to finish.');
 end if;
 allowance:=public.anchor_consume_ai(owner_id,credit_cost);
 if not (allowance->>'allowed')::boolean then return allowance||jsonb_build_object('status',429,'error','AI allowance reached. Please try again later.'); end if;
 insert into public.ai_jobs(user_id,kind,payload,request_key) values(owner_id,job_kind,job_payload,request_key) returning id into job_id;
 return jsonb_build_object('id',job_id,'status',202);
end;
$$;
revoke all on function public.anchor_enqueue_job(uuid,text,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.anchor_enqueue_job(uuid,text,jsonb,uuid,integer) to service_role;

create table anchor_private.upload_intents (
 path text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 resource_id text not null,mime_type text not null,expected_size integer not null,
 state text not null default 'pending' check(state in ('pending','clean','deleting','deleted','rejected')),
 created_at timestamptz not null default now(),inspected_at timestamptz,
 sha256 text,inspection_error text
);
alter table anchor_private.upload_intents enable row level security;
grant all on anchor_private.upload_intents to service_role;
create index upload_expiry on anchor_private.upload_intents(created_at) where state in ('pending','clean','deleting');
create function public.anchor_register_upload(object_path text,owner_id uuid,resource_id text,mime_type text,expected_size integer)
returns void language sql security invoker set search_path = '' as $$
 insert into anchor_private.upload_intents(path,user_id,resource_id,mime_type,expected_size) values(object_path,owner_id,resource_id,mime_type,expected_size);
$$;
revoke all on function public.anchor_register_upload(text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.anchor_register_upload(text,uuid,text,text,integer) to service_role;

-- Lock the intent before allowing a new reference, preventing a cleanup/save race.
create function anchor_private.guard_storage_reference() returns trigger language plpgsql security definer set search_path = '' as $$
declare intent_state text; object_path text:=new.data->>'storagePath';
begin
 if object_path is null or object_path='' then return new; end if;
 if split_part(object_path,'/',1)<>new.user_id::text then raise exception 'Invalid file owner' using errcode='42501'; end if;
 select state into intent_state from anchor_private.upload_intents where path=object_path for share;
 if intent_state in ('deleting','deleted','rejected') then raise exception 'File unavailable; upload it again'; end if;
 return new;
end;
$$;
revoke all on function anchor_private.guard_storage_reference() from public,anon,authenticated;
create trigger resources_storage_guard before insert or update of data on public.resources for each row execute function anchor_private.guard_storage_reference();

create function public.anchor_claim_orphans() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item anchor_private.upload_intents; paths jsonb:='[]'::jsonb;
begin
 for item in select * from anchor_private.upload_intents where state in ('pending','clean','deleting') and created_at<now()-interval '48 hours' order by created_at for update skip locked limit 5 loop
  if not exists(select 1 from public.resources where user_id=item.user_id and data->>'storagePath'=item.path) then
   update anchor_private.upload_intents set state='deleting' where path=item.path;
   paths:=paths||jsonb_build_array(item.path);
  end if;
 end loop;
 return paths;
end;
$$;
revoke all on function public.anchor_claim_orphans() from public,anon,authenticated;
grant execute on function public.anchor_claim_orphans() to service_role;
create function public.anchor_finish_cleanup(paths text[]) returns void language sql security invoker set search_path = '' as $$
 update anchor_private.upload_intents set state='deleted' where path=any(paths) and state='deleting';
$$;
revoke all on function public.anchor_finish_cleanup(text[]) from public,anon,authenticated;
grant execute on function public.anchor_finish_cleanup(text[]) to service_role;

create table anchor_private.worker_config(id boolean primary key default true check(id),base_url text not null,secret text not null);
alter table anchor_private.worker_config enable row level security;
grant all on anchor_private.worker_config to service_role;
create function public.anchor_configure_worker(base_url text,worker_secret text) returns void language sql security invoker set search_path = '' as $$
 insert into anchor_private.worker_config(id,base_url,secret) values(true,base_url,worker_secret) on conflict(id) do update set base_url=excluded.base_url,secret=excluded.secret;
$$;
create function public.anchor_validate_worker(token text) returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from anchor_private.worker_config where secret=token);
$$;
revoke all on function public.anchor_configure_worker(text,text),public.anchor_validate_worker(text) from public,anon,authenticated;
grant execute on function public.anchor_configure_worker(text,text),public.anchor_validate_worker(text) to service_role;

create function public.anchor_page_records(record_kind text,owner_id uuid,page_size integer default 50,cursor_created timestamptz default null,cursor_id text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if owner_id is distinct from (select auth.uid()) then raise exception 'Invalid owner' using errcode='42501'; end if;
 if record_kind not in ('resources','tasks') or page_size not between 1 and 100 or ((cursor_created is null)<>(cursor_id is null)) then raise exception 'Invalid page request'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I where user_id=$1 and ($2 is null or (created_at,id)<($2,$3)) order by created_at desc,id desc limit $4) r',record_kind)
 into result using owner_id,cursor_created,cursor_id,page_size;
 return result;
end;
$$;
revoke all on function public.anchor_page_records(text,uuid,integer,timestamptz,text) from public,anon;
grant execute on function public.anchor_page_records(text,uuid,integer,timestamptz,text) to authenticated;

commit;
