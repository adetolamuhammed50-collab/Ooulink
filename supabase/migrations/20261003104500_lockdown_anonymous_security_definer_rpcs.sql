-- Prevent unauthenticated callers from reaching privileged SECURITY DEFINER RPCs.
revoke execute on function public.approve_task_completion(uuid) from anon;
revoke execute on function public.check_action_rate_limit_for_user(uuid,text,integer,integer) from anon;
revoke execute on function public.send_tip(uuid,numeric,text) from anon;

grant execute on function public.approve_task_completion(uuid) to authenticated;
grant execute on function public.check_action_rate_limit_for_user(uuid,text,integer,integer) to authenticated;
grant execute on function public.send_tip(uuid,numeric,text) to authenticated;
