begin;
create function public.anchor_source_fingerprint(document jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(public.anchor_source_snapshot(document)::text,'UTF8')),'hex');
$$;
revoke all on function public.anchor_source_fingerprint(jsonb) from public,anon,authenticated;
grant execute on function public.anchor_source_fingerprint(jsonb) to service_role;
create or replace function public.anchor_finish_job(job_id uuid,worker_lease uuid,output jsonb,generated_tasks jsonb,failure text default null,retry boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare job public.ai_jobs; resource public.resources; task jsonb;
begin
 select * into job from public.ai_jobs where id=job_id and lease_token=worker_lease and status='processing' and lease_until>now() for update;
 if not found then return false; end if;
 if output is not null then
  if job.payload->>'resourceId' is not null then
   select * into resource from public.resources where user_id=job.user_id and id=job.payload->>'resourceId' for update;
   if not found then failure:='Resource no longer exists.';
   elsif (case when job.payload ? 'source_fingerprint' then public.anchor_source_fingerprint(resource.data) is distinct from job.payload->>'source_fingerprint' else public.anchor_source_snapshot(resource.data) is distinct from job.payload->'source_snapshot' end) then failure:='Resource changed during analysis. Please analyze it again.';
   else
    update public.resources set data=data||jsonb_build_object('aiSummary',output->'summary','aiCategory',output->'category',
     'aiTags',output->'tags','aiImportantInformation',output->'importantInformation','aiDeadline',output->'deadlines'->0->'deadline',
     'aiActionItems',output->'actionItems','contentText',output->'contentText','contentTruncated',output->'contentTruncated',
     'deadlines',output->'deadlines','aiAnalyzedAt',now(),'aiJobId',job.id),updated_at=now()
     where user_id=job.user_id and id=resource.id;
    if jsonb_typeof(generated_tasks)<>'array' or jsonb_array_length(generated_tasks)>50 then raise exception 'Invalid generated tasks'; end if;
    for task in select value from jsonb_array_elements(generated_tasks) loop
     insert into public.tasks(user_id,id,data) values(job.user_id,task->>'id',task->'data') on conflict(user_id,id) do nothing;
    end loop;
   end if;
  end if;
  if failure is null then
   update public.ai_jobs set status='succeeded',result=output,error=null,lease_until=null,updated_at=now() where id=job_id;
   return true;
  end if;
 end if;
 update public.ai_jobs set status=case when retry and attempts<3 then 'queued' else 'failed' end,result=null,error=left(coalesce(failure,'Analysis failed.'),500),lease_until=null,updated_at=now() where id=job_id;
 return true;
end;
$$;
commit;
