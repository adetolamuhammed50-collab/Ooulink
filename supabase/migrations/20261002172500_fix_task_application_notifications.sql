create or replace function private.notify_task_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.moderation_status='approved'
     and old.moderation_status is distinct from 'approved' then
    insert into public.notifications
      (user_id,task_id,type,title,message,is_read,created_at)
    values
      (new.user_id,new.id,'task','Task Approved',
       'Your task was approved and is now available: '||new.title,false,now());
  elsif old.status='accepted' and new.status='in_progress' then
    insert into public.notifications
      (user_id,task_id,type,title,message,is_read,created_at)
    values
      (new.user_id,new.id,'task','Task Started',
       'Your runner started working on: '||new.title,false,now());
  end if;
  return new;
end;
$function$;

create or replace function private.notify_task_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if not found then return new; end if;
  if v_task.user_id <> new.runner_id then
    insert into public.notifications
      (user_id,task_id,type,title,message,is_read,created_at)
    values
      (v_task.user_id,v_task.id,'application','New Task Application',
       'Someone applied for your task: '||v_task.title,false,now());
  end if;
  return new;
end;
$function$;

drop trigger if exists notify_task_application on public.task_applications;
create trigger notify_task_application
after insert on public.task_applications
for each row execute function private.notify_task_application();