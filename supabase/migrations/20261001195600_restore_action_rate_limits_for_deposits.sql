create table if not exists public.action_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_key, window_started_at)
);

alter table public.action_rate_limits enable row level security;

revoke all on public.action_rate_limits from anon, authenticated;
grant select on public.action_rate_limits to service_role;

create index if not exists action_rate_limits_window_idx
on public.action_rate_limits(action_key, window_started_at);

create or replace function public.check_action_rate_limit_for_user(
  p_user_id uuid,
  p_action_key text,
  p_window_seconds integer,
  p_max_attempts integer
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  current_attempts integer;
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;
  if p_window_seconds <= 0 or p_max_attempts <= 0 then raise exception 'Invalid rate limit'; end if;

  insert into public.action_rate_limits(user_id,action_key,window_started_at,attempts)
  values(p_user_id,p_action_key,ws,1)
  on conflict(user_id,action_key,window_started_at)
  do update set attempts=public.action_rate_limits.attempts+1,
                updated_at=now()
  returning attempts into current_attempts;

  if current_attempts > p_max_attempts then
    raise exception 'Too many attempts. Please try again later.';
  end if;
end
$function$;

revoke all on function public.check_action_rate_limit_for_user(uuid,text,integer,integer) from public;
grant execute on function public.check_action_rate_limit_for_user(uuid,text,integer,integer) to authenticated, service_role;