create or replace function public.approve_task_completion(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_task public.tasks%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_task
  from public.tasks
  where id=p_task_id
  for update;

  if not found then raise exception 'Task not found.'; end if;
  if v_task.user_id<>v_uid then raise exception 'Only the task poster can verify completion.'; end if;
  if v_task.status<>'awaiting_verification' then raise exception 'This task is not awaiting verification.'; end if;
  if v_task.runner_id is null then raise exception 'A runner is required before completion.'; end if;

  perform set_config('app.allow_task_system_update','on',true);

  update public.tasks
  set status='completed'
  where id=p_task_id
    and user_id=v_uid
    and status='awaiting_verification'
    and runner_id=v_task.runner_id;

  if not found then raise exception 'Could not complete the task.'; end if;

  return true;
end;
$function$;

revoke all on function public.approve_task_completion(uuid) from public;
grant execute on function public.approve_task_completion(uuid) to authenticated;