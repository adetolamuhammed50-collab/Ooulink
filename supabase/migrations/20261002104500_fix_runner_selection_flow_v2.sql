-- Keep runner selection atomic and consistent with the current task/payment lifecycle.
create or replace function public.select_task_runner(target_task_id uuid, target_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_application public.task_applications%rowtype;
  v_payment public.task_payments%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_task
  from public.tasks
  where id = target_task_id
  for update;

  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.user_id <> v_uid then raise exception 'NOT_TASK_OWNER'; end if;
  if v_task.status <> 'open' then raise exception 'TASK_NOT_OPEN'; end if;
  if v_task.moderation_status is distinct from 'approved' then raise exception 'TASK_NOT_APPROVED'; end if;
  if v_task.deadline <= now() then raise exception 'TASK_DEADLINE_PASSED'; end if;

  select * into v_application
  from public.task_applications
  where id = target_application_id
    and task_id = target_task_id
  for update;

  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_application.status <> 'pending' then raise exception 'APPLICATION_NOT_PENDING'; end if;
  if v_application.runner_id = v_uid then raise exception 'OWNER_CANNOT_BE_RUNNER'; end if;

  select * into v_payment
  from public.task_payments
  where task_id = target_task_id
  for update;

  if not found then raise exception 'TASK_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'locked' then raise exception 'TASK_PAYMENT_NOT_LOCKED'; end if;
  if v_payment.poster_id <> v_task.user_id
     or v_payment.amount <> v_task.budget then
    raise exception 'TASK_PAYMENT_INTEGRITY_FAILED';
  end if;

  update public.tasks
  set runner_id = v_application.runner_id,
      status = 'accepted'
  where id = target_task_id
    and status = 'open'
    and runner_id is null;

  if not found then raise exception 'TASK_SELECTION_CONFLICT'; end if;

  update public.task_payments
  set runner_id = v_application.runner_id
  where task_id = target_task_id
    and status = 'locked';

  update public.task_applications
  set status = case
    when id = target_application_id then 'selected'
    else 'rejected'
  end
  where task_id = target_task_id
    and status = 'pending';

  return true;
end;
$function$;

revoke execute on function public.select_task_runner(uuid,uuid) from public;
revoke execute on function public.select_task_runner(uuid,uuid) from anon;
grant execute on function public.select_task_runner(uuid,uuid) to authenticated;