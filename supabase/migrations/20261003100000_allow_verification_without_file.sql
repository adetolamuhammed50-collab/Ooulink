create or replace function public.finalize_completion_proof(p_proof_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_task_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select p.task_id
    into v_task_id
  from public.task_completion_proofs p
  where p.id=p_proof_id
    and p.runner_id=v_uid
    and p.status='draft'
  for update;

  if v_task_id is null then
    raise exception 'Proof draft not found.';
  end if;

  if not exists (
    select 1 from public.tasks
    where id=v_task_id and runner_id=v_uid and status='in_progress'
  ) then
    raise exception 'Task is no longer ready for proof submission.';
  end if;

  update public.task_completion_proofs
  set status='submitted'
  where id=p_proof_id and runner_id=v_uid and status='draft';

  update public.tasks
  set status='awaiting_verification'
  where id=v_task_id and runner_id=v_uid and status='in_progress';

  if not found then
    raise exception 'Could not move task to verification.';
  end if;

  return true;
end;
$function$;