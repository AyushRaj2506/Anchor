begin;
drop function public.anchor_update_record(text,text,jsonb);
create function public.anchor_update_record(record_kind text, record_id text, owner_id uuid, patch jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if owner_id is distinct from (select auth.uid()) then
    raise exception 'Account changed; sign in again' using errcode = '42501';
  end if;
  if jsonb_typeof(patch) is distinct from 'object' then raise exception 'A JSON object is required'; end if;
  if record_kind = 'resources' then
    update public.resources set data = data || patch, updated_at = now()
      where user_id = owner_id and id = record_id;
  elsif record_kind = 'tasks' then
    update public.tasks set data = data || patch, updated_at = now()
      where user_id = owner_id and id = record_id;
  else raise exception 'Invalid record kind'; end if;
  if not found then raise exception 'Record not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.anchor_update_record(text,text,uuid,jsonb) from public, anon;
grant execute on function public.anchor_update_record(text,text,uuid,jsonb) to authenticated;
commit;
