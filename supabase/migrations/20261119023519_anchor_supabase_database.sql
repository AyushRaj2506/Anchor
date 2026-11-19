begin;

create table public.resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table public.tasks (like public.resources including defaults including constraints);
alter table public.tasks add primary key (user_id, id);
alter table public.tasks add foreign key (user_id) references auth.users(id) on delete cascade;
create index resources_user_created on public.resources(user_id, created_at desc);
create index tasks_user_created on public.tasks(user_id, created_at desc);

alter table public.resources enable row level security;
alter table public.tasks enable row level security;
create policy resources_own on public.resources for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tasks_own on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.resources, public.tasks from anon;
grant select, insert, update, delete on public.resources, public.tasks to authenticated;
grant all on public.resources, public.tasks to service_role;

create function public.anchor_update_record(record_kind text, record_id text, patch jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(patch) is distinct from 'object' then raise exception 'A JSON object is required'; end if;
  if record_kind = 'resources' then
    update public.resources set data = data || patch, updated_at = now()
      where user_id = (select auth.uid()) and id = record_id;
  elsif record_kind = 'tasks' then
    update public.tasks set data = data || patch, updated_at = now()
      where user_id = (select auth.uid()) and id = record_id;
  else raise exception 'Invalid record kind'; end if;
  if not found then raise exception 'Record not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.anchor_update_record(text,text,jsonb) from public, anon;
grant execute on function public.anchor_update_record(text,text,jsonb) to authenticated;

-- Private storage remains mediated by authenticated server routes. No public
-- storage policy or service-role credential is exposed to the browser.
commit;
