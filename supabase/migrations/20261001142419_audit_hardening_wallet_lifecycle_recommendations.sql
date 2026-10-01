-- StudTask audit hardening migration
-- Applied to Supabase project dthvdxgxesomltlruogp on 2026-10-01.
-- Fixes wallet double-spend risk, system task lifecycle updates,
-- dispute fund stranding, future activity dates, and blocked recommendations.

create or replace function public.enforce_task_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_system_update boolean := current_setting('app.allow_task_system_update', true) = 'on';
begin
  if v_system_update then return new; end if;
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select exists(select 1 from public.admin_users where user_id=v_uid) into v_is_admin;

  if v_is_admin then
    if old.moderation_status is distinct from new.moderation_status
       or old.moderation_note is distinct from new.moderation_note then
      if old.status is distinct from new.status
         or old.runner_id is distinct from new.runner_id
         or old.rejection_note is distinct from new.rejection_note
         or old.user_id is distinct from new.user_id
         or old.title is distinct from new.title
         or old.description is distinct from new.description
         or old.category is distinct from new.category
         or old.location is distinct from new.location
         or old.budget is distinct from new.budget
         or old.deadline is distinct from new.deadline
         or old.university_id is distinct from new.university_id
         or old.university_other is distinct from new.university_other
         or old.campus_id is distinct from new.campus_id
         or old.campus_other is distinct from new.campus_other then
        raise exception 'Moderation changes cannot modify task data or lifecycle fields.';
      end if;
      return new;
    end if;
    if old.status is distinct from new.status
       or old.runner_id is distinct from new.runner_id
       or old.rejection_note is distinct from new.rejection_note
       or old.user_id is distinct from new.user_id
       or old.title is distinct from new.title
       or old.description is distinct from new.description
       or old.category is distinct from new.category
       or old.location is distinct from new.location
       or old.budget is distinct from new.budget
       or old.deadline is distinct from new.deadline
       or old.university_id is distinct from new.university_id
       or old.university_other is distinct from new.university_other
       or old.campus_id is distinct from new.campus_id
       or old.campus_other is distinct from new.campus_other then
      raise exception 'Administrators can only change task moderation fields.';
    end if;
    return new;
  end if;

  if old.user_id is distinct from new.user_id
     or old.title is distinct from new.title
     or old.description is distinct from new.description
     or old.category is distinct from new.category
     or old.location is distinct from new.location
     or old.budget is distinct from new.budget
     or old.deadline is distinct from new.deadline
     or old.moderation_status is distinct from new.moderation_status
     or old.moderation_note is distinct from new.moderation_note
     or old.university_id is distinct from new.university_id
     or old.university_other is distinct from new.university_other
     or old.campus_id is distinct from new.campus_id
     or old.campus_other is distinct from new.campus_other then
    raise exception 'Task details cannot be modified after posting.';
  end if;

  if old.status is not distinct from new.status
     and old.runner_id is not distinct from new.runner_id
     and old.rejection_note is not distinct from new.rejection_note then
    return new;
  end if;

  if old.status in ('completed','rejected','cancelled') then
    if new.status<>old.status then raise exception 'This task is already closed.'; end if;
  end if;
  if old.deadline < now() and new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'This task deadline has passed.';
  end if;

  if old.status='open' then
    if new.status='cancelled' then
      if new.runner_id is distinct from old.runner_id then raise exception 'Cancelled task cannot assign a runner.'; end if;
      return new;
    end if;
    if new.status<>'accepted' or new.runner_id is null or new.runner_id=old.user_id then raise exception 'Invalid task acceptance.'; end if;
  end if;
  if old.status='accepted' then
    if new.status='cancelled' then
      if new.runner_id is distinct from old.runner_id then raise exception 'Cancelled task cannot change its runner.'; end if;
      return new;
    end if;
    if new.status<>'in_progress' or new.runner_id<>old.runner_id then raise exception 'Invalid task start.'; end if;
  end if;
  if old.status='in_progress' then
    if new.status='cancelled' then
      if new.runner_id is distinct from old.runner_id then raise exception 'Cancelled task cannot change its runner.'; end if;
      return new;
    end if;
    if new.status<>'awaiting_verification' or new.runner_id<>old.runner_id then raise exception 'Invalid verification submission.'; end if;
  end if;
  if old.status='awaiting_verification' then
    if new.status not in ('completed','rejected') or new.runner_id<>old.runner_id then raise exception 'Invalid verification decision.'; end if;
    if new.status='rejected' and (new.rejection_note is null or trim(new.rejection_note)='') then raise exception 'A rejection reason is required.'; end if;
  end if;
  if old.status<>'open' and new.runner_id is distinct from old.runner_id then raise exception 'The assigned runner cannot be changed.'; end if;
  if old.status in ('completed','rejected','cancelled') and new.rejection_note is distinct from old.rejection_note then raise exception 'Closed task cannot be modified.'; end if;
  return new;
end;
$function$;

create or replace function public.create_task_with_funding(
  p_title text,p_description text,p_category text,p_location text,p_budget numeric,
  p_deadline timestamp with time zone,p_university_id uuid default null,p_university_other text default null,
  p_campus_id uuid default null,p_campus_other text default null
)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare uid uuid:=auth.uid(); task_id uuid; w public.wallets%rowtype;
begin
  if uid is null then raise exception 'Not authenticated.'; end if;
  if trim(coalesce(p_title,''))='' or trim(coalesce(p_description,''))='' or trim(coalesce(p_category,''))='' or trim(coalesce(p_location,''))='' then raise exception 'All task details are required.'; end if;
  if p_budget is null or p_budget<=0 then raise exception 'Budget must be greater than zero.'; end if;
  if p_deadline is null or p_deadline<=now() then raise exception 'Deadline must be in the future.'; end if;
  if exists(select 1 from public.user_moderation where user_id=uid and status='banned' and (ban_type='permanent' or (ban_type='temporary' and banned_until is not null and banned_until>now()))) then raise exception 'Account restricted.'; end if;
  select * into w from public.wallets where id=uid for update;
  if not found then insert into public.wallets(id) values(uid) returning * into w; end if;
  if w.available_balance<p_budget or w.withdrawable_balance<p_budget then raise exception 'INSUFFICIENT_BALANCE'; end if;
  insert into public.tasks(user_id,title,description,category,location,budget,deadline,status,moderation_status,university_id,university_other,campus_id,campus_other)
  values(uid,trim(p_title),trim(p_description),trim(p_category),trim(p_location),p_budget,p_deadline,'open','pending',p_university_id,nullif(trim(coalesce(p_university_other,'')),''),p_campus_id,nullif(trim(coalesce(p_campus_other,'')),'')) returning id into task_id;
  update public.wallets set available_balance=available_balance-p_budget,withdrawable_balance=withdrawable_balance-p_budget,locked_balance=locked_balance+p_budget,updated_at=now() where id=uid;
  insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status) values(uid,'task_lock',p_budget,'task',task_id,'Funds reserved for task','completed');
  insert into public.task_payments(task_id,poster_id,amount,status) values(task_id,uid,p_budget,'locked');
  return task_id;
end;
$function$;

create or replace function public.settle_task_payment()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare p public.task_payments%rowtype; poster_wallet public.wallets%rowtype; runner_wallet public.wallets%rowtype;
begin
  if old.status is distinct from new.status then
    select * into p from public.task_payments where task_id=new.id for update;
    if not found then return new; end if;
    if new.status='completed' and p.status='locked' then
      if new.runner_id is null then raise exception 'Completed task requires a runner.'; end if;
      if p.poster_id<>new.user_id or p.amount<>new.budget then raise exception 'Task payment integrity check failed.'; end if;
      select * into poster_wallet from public.wallets where id=p.poster_id for update;
      if not found or poster_wallet.locked_balance<p.amount then raise exception 'Insufficient locked task funds.'; end if;
      select * into runner_wallet from public.wallets where id=new.runner_id for update;
      if not found then insert into public.wallets(id) values(new.runner_id) returning * into runner_wallet; end if;
      update public.wallets set locked_balance=locked_balance-p.amount,updated_at=now() where id=p.poster_id;
      update public.wallets set available_balance=available_balance+p.amount,withdrawable_balance=withdrawable_balance+p.amount,updated_at=now() where id=new.runner_id;
      insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status) values
        (p.poster_id,'task_release',p.amount,'task',new.id,'Task payment released to runner','completed'),
        (new.runner_id,'task_release',p.amount,'task',new.id,'Task earnings received','completed');
      update public.task_payments set runner_id=new.runner_id,status='released',updated_at=now() where task_id=new.id and status='locked';
    elsif new.status in ('rejected','cancelled') and p.status='locked' then
      if p.poster_id<>new.user_id or p.amount<>new.budget then raise exception 'Task payment integrity check failed.'; end if;
      select * into poster_wallet from public.wallets where id=p.poster_id for update;
      if not found or poster_wallet.locked_balance<p.amount then raise exception 'Insufficient locked task funds for refund.'; end if;
      update public.wallets set available_balance=available_balance+p.amount,withdrawable_balance=withdrawable_balance+p.amount,locked_balance=locked_balance-p.amount,updated_at=now() where id=p.poster_id;
      insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status) values(p.poster_id,'task_refund',p.amount,'task',new.id,'Task funds refunded','completed');
      update public.task_payments set status='refunded',updated_at=now() where task_id=new.id and status='locked';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.refund_deleted_task_payment()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare p public.task_payments%rowtype; w public.wallets%rowtype;
begin
  select * into p from public.task_payments where task_id=old.id for update;
  if found and p.status='locked' then
    if p.poster_id<>old.user_id or p.amount<>old.budget then raise exception 'Task payment integrity check failed.'; end if;
    select * into w from public.wallets where id=p.poster_id for update;
    if not found or w.locked_balance<p.amount then raise exception 'Insufficient locked task funds for refund.'; end if;
    update public.wallets set available_balance=available_balance+p.amount,withdrawable_balance=withdrawable_balance+p.amount,locked_balance=locked_balance-p.amount,updated_at=now() where id=p.poster_id;
    insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status) values(p.poster_id,'task_refund',p.amount,'task',old.id,'Task funds refunded after task deletion','completed');
    update public.task_payments set status='refunded',updated_at=now() where task_id=old.id and status='locked';
  end if;
  return old;
end;
$function$;

create or replace function public.cancel_task(p_task_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_task public.tasks%rowtype;v_payment public.task_payments%rowtype;v_wallet public.wallets%rowtype;v_user uuid:=auth.uid();v_reason text:=nullif(trim(coalesce(p_reason,'')),'');v_dispute_status text;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if v_task.status not in ('open','accepted','in_progress') then raise exception 'This task cannot be cancelled at its current stage.'; end if;
  select d.status into v_dispute_status from public.task_disputes d where d.task_id=v_task.id and d.status in ('open','under_review') order by d.created_at desc limit 1;
  if v_dispute_status is not null then raise exception 'This task has an active dispute and cannot be cancelled.'; end if;
  if v_task.status='open' then
    if v_user<>v_task.user_id then raise exception 'Only the poster can cancel an open task.'; end if;
  elsif v_task.status in ('accepted','in_progress') then
    if v_user<>v_task.runner_id then raise exception 'After a runner is assigned, only the runner can cancel the task.'; end if;
  end if;
  select * into v_payment from public.task_payments where task_id=v_task.id for update;
  if found and v_payment.status='locked' then
    if v_payment.poster_id<>v_task.user_id or v_payment.amount<>v_task.budget then raise exception 'Task payment integrity check failed.'; end if;
    select * into v_wallet from public.wallets where id=v_task.user_id for update;
    if not found or v_wallet.locked_balance<v_payment.amount then raise exception 'Insufficient locked task funds for refund.'; end if;
    update public.wallets set available_balance=available_balance+v_payment.amount,withdrawable_balance=withdrawable_balance+v_payment.amount,locked_balance=locked_balance-v_payment.amount,updated_at=now() where id=v_task.user_id;
    insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status) values(v_task.user_id,'task_refund',v_payment.amount,'task',v_task.id,'Task funds refunded after cancellation','completed');
    update public.task_payments set status='refunded',updated_at=now() where id=v_payment.id and status='locked';
  end if;
  insert into public.task_cancellations(task_id,cancelled_by,previous_status,reason) values(v_task.id,v_user,v_task.status,v_reason);
  update public.tasks set status='cancelled',rejection_note=null where id=v_task.id;
  if v_task.runner_id is not null and v_task.runner_id<>v_user then insert into public.notifications(user_id,task_id,type,title,message,is_read) values(v_task.runner_id,v_task.id,'task_cancelled','Task cancelled','The task was cancelled before completion.',false); end if;
  if v_task.user_id<>v_user then insert into public.notifications(user_id,task_id,type,title,message,is_read) values(v_task.user_id,v_task.id,'task_cancelled','Task cancelled','The assigned runner cancelled the task.',false); end if;
end;
$function$;

create or replace function public.admin_resolve_task_dispute(p_dispute_id uuid,p_resolution text,p_admin_note text default null)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_d public.task_disputes%rowtype;v_task public.tasks%rowtype;v_note text:=nullif(trim(coalesce(p_admin_note,'')),'');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.admin_users where user_id=v_uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_resolution not in ('runner','poster','dismissed') then raise exception 'INVALID_DISPUTE_RESOLUTION'; end if;
  select * into v_d from public.task_disputes where id=p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if v_d.status not in ('open','under_review') then raise exception 'DISPUTE_ALREADY_RESOLVED'; end if;
  select * into v_task from public.tasks where id=v_d.task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.status<>'awaiting_verification' then raise exception 'TASK_NOT_DISPUTABLE'; end if;
  perform set_config('app.allow_task_system_update','on',true);

  if p_resolution='runner' then
    if v_task.runner_id is null then raise exception 'RUNNER_REQUIRED'; end if;
    update public.tasks set status='completed' where id=v_task.id and status='awaiting_verification';
    if not found then raise exception 'TASK_RESOLUTION_FAILED'; end if;
    update public.task_disputes set status='resolved_runner',resolution='runner',resolved_by=v_uid,admin_note=v_note,resolved_at=now() where id=v_d.id;
    insert into public.notifications(user_id,task_id,type,title,message) values(v_task.user_id,v_task.id,'dispute_resolved','Dispute resolved','The dispute was resolved in favor of the runner and the task payment was released.');
    insert into public.notifications(user_id,task_id,type,title,message) values(v_task.runner_id,v_task.id,'dispute_resolved','Dispute resolved','The dispute was resolved in your favor and the task payment was released.');
  elsif p_resolution='poster' then
    update public.tasks set status='rejected',rejection_note=coalesce(v_note,'Task dispute resolved in favor of the poster by an admin.') where id=v_task.id and status='awaiting_verification';
    if not found then raise exception 'TASK_RESOLUTION_FAILED'; end if;
    update public.task_disputes set status='resolved_poster',resolution='poster',resolved_by=v_uid,admin_note=v_note,resolved_at=now() where id=v_d.id;
    insert into public.notifications(user_id,task_id,type,title,message) values(v_task.user_id,v_task.id,'dispute_resolved','Dispute resolved','The dispute was resolved in favor of the poster and the reserved task funds were refunded.');
    insert into public.notifications(user_id,task_id,type,title,message) values(v_task.runner_id,v_task.id,'dispute_resolved','Dispute resolved','The dispute was resolved in favor of the poster and the task payment was refunded.');
  else
    update public.tasks set status='rejected',rejection_note=coalesce(v_note,'Dispute dismissed by an admin; reserved task funds were refunded.') where id=v_task.id and status='awaiting_verification';
    if not found then raise exception 'TASK_RESOLUTION_FAILED'; end if;
    update public.task_disputes set status='dismissed',resolution='dismissed',resolved_by=v_uid,admin_note=v_note,resolved_at=now() where id=v_d.id;
    insert into public.notifications(user_id,task_id,type,title,message) values(v_task.user_id,v_task.id,'dispute_resolved','Dispute dismissed','The dispute was dismissed and the reserved task funds were refunded.');
    if v_task.runner_id is not null then insert into public.notifications(user_id,task_id,type,title,message) values(v_task.runner_id,v_task.id,'dispute_resolved','Dispute dismissed','The dispute was dismissed by an admin.'); end if;
  end if;
end;
$function$;

create or replace function public.expire_overdue_tasks()
returns integer language plpgsql security definer set search_path to ''
as $function$
declare v_task public.tasks%rowtype;v_count integer:=0;
begin
  perform set_config('app.allow_task_system_update','on',true);
  for v_task in select t.* from public.tasks t where t.deadline<now() and t.status in ('open','accepted','in_progress') order by t.deadline asc for update skip locked loop
    insert into public.task_cancellations(task_id,cancelled_by,previous_status,reason) values(v_task.id,v_task.user_id,v_task.status,'Task expired after its deadline.');
    update public.tasks set status='cancelled',rejection_note='Task expired after its deadline.' where id=v_task.id and status=v_task.status;
    if v_task.runner_id is not null then insert into public.notifications(user_id,task_id,type,title,message,is_read,created_at) values(v_task.runner_id,v_task.id,'task_expired','Task expired','The task expired because its deadline passed before completion.',false,now()); end if;
    if v_task.user_id is not null and v_task.user_id is distinct from v_task.runner_id then insert into public.notifications(user_id,task_id,type,title,message,is_read,created_at) values(v_task.user_id,v_task.id,'task_expired','Task expired','Your task expired because its deadline passed before completion. Locked task funds were refunded when applicable.',false,now()); end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.record_daily_activity(p_activity_date date default current_date)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare uid uuid:=auth.uid();d date:=coalesce(p_activity_date,current_date);today date:=current_date;current_streak integer:=0;longest_streak integer:=0;cursor_date date;streak_start date;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if d<>today then raise exception 'Activity can only be recorded for today'; end if;
  insert into public.user_activity_days(user_id,activity_date) values(uid,d) on conflict (user_id,activity_date) do nothing;
  select coalesce(max(run_len),0) into longest_streak from (
    select count(*)::integer as run_len from (
      select activity_date,activity_date-(row_number() over(order by activity_date))::integer as grp
      from public.user_activity_days where user_id=uid
    ) s group by grp
  ) runs;
  cursor_date:=d;
  while exists(select 1 from public.user_activity_days where user_id=uid and activity_date=cursor_date) loop
    current_streak:=current_streak+1;cursor_date:=cursor_date-1;
  end loop;
  select max(activity_date) into streak_start from public.user_activity_days where user_id=uid;
  if streak_start is not null and streak_start<today-1 then current_streak:=0; end if;
  return jsonb_build_object('current_streak',current_streak,'longest_streak',longest_streak,'activity_date',d);
end;
$function$;

create or replace function public.get_smart_task_recommendations(p_limit integer default 12)
returns table(id uuid,title text,description text,category text,location text,budget numeric,deadline timestamp with time zone,university_id uuid,campus_id uuid,score integer,reasons text[])
language plpgsql security definer set search_path to ''
as $function$
declare uid uuid:=auth.uid();avg_budget numeric;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  p_limit:=least(greatest(coalesce(p_limit,12),1),30);
  select avg(x.budget) into avg_budget from (
    select t.budget from public.saved_tasks s join public.tasks t on t.id=s.task_id where s.user_id=uid
    union all select t.budget from public.task_applications a join public.tasks t on t.id=a.task_id where a.runner_id=uid
  ) x;
  return query
  with prefs as (
    select p.university_id,p.campus_id,lower(trim(coalesce(p.location,''))) as user_location from public.profiles p where p.id=uid
  ), category_counts as (
    select t.category,count(*)::integer as cnt from (
      select s.task_id from public.saved_tasks s where s.user_id=uid
      union all select a.task_id from public.task_applications a where a.runner_id=uid
      union all select t0.id as task_id from public.tasks t0 where t0.runner_id=uid and t0.status='completed'
    ) x join public.tasks t on t.id=x.task_id
    where t.category is not null and trim(t.category)<>'' group by t.category
  ), candidates as (
    select t.*,
      (case when p.university_id is not null and t.university_id=p.university_id then 40 else 0 end)+
      (case when p.campus_id is not null and t.campus_id=p.campus_id then 30 else 0 end)+
      (case when p.user_location<>'' and lower(trim(coalesce(t.location,'')))=p.user_location then 15 else 0 end)+
      (case when coalesce(cc.cnt,0)>0 then least(20,cc.cnt*5) else 0 end)+
      (case when avg_budget is not null and t.budget between avg_budget*.7 and avg_budget*1.3 then 10 else 0 end)+
      (case when t.created_at>=now()-interval '48 hours' then 5 else 0 end) as calc_score,
      array_remove(array[
        case when p.university_id is not null and t.university_id=p.university_id then 'Your university' end,
        case when p.campus_id is not null and t.campus_id=p.campus_id then 'Your campus' end,
        case when p.user_location<>'' and lower(trim(coalesce(t.location,'')))=p.user_location then 'Your location' end,
        case when coalesce(cc.cnt,0)>0 then 'Matches your task interests' end,
        case when avg_budget is not null and t.budget between avg_budget*.7 and avg_budget*1.3 then 'Fits your usual budget range' end,
        case when t.created_at>=now()-interval '48 hours' then 'Recently posted' end
      ],null) as calc_reasons
    from public.tasks t cross join prefs p left join category_counts cc on cc.category=t.category
    where t.status='open' and t.moderation_status='approved' and t.deadline is not null and t.deadline>=now()
      and t.user_id<>uid
      and not exists(select 1 from public.task_applications a where a.task_id=t.id and a.runner_id=uid)
      and not exists(select 1 from public.user_blocks b where (b.blocker_id=uid and b.blocked_id=t.user_id) or (b.blocker_id=t.user_id and b.blocked_id=uid))
      and not exists(select 1 from public.user_moderation um where um.user_id=t.user_id and um.status='banned' and (um.ban_type='permanent' or (um.ban_type='temporary' and um.banned_until is not null and um.banned_until>now())))
  )
  select c.id,c.title,c.description,c.category,c.location,c.budget,c.deadline,c.university_id,c.campus_id,c.calc_score,c.calc_reasons
  from candidates c where c.calc_score>0 order by c.calc_score desc,c.deadline asc,c.created_at desc limit p_limit;
end;
$function$;

update public.wallets set withdrawable_balance=available_balance,updated_at=now() where withdrawable_balance is distinct from available_balance;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.wallets'::regclass and conname='wallets_withdrawable_lte_available') then
    alter table public.wallets add constraint wallets_withdrawable_lte_available check (withdrawable_balance<=available_balance);
  end if;
end $$;
