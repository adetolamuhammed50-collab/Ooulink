-- StudTask tipping: atomic wallet-to-wallet transfers
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  tipper_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  constraint tips_different_users check (tipper_id <> recipient_id)
);

alter table public.tips enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tips' and policyname='tips_select_own') then
    create policy "tips_select_own" on public.tips for select to authenticated
      using ((select auth.uid())=tipper_id or (select auth.uid())=recipient_id);
  end if;
end $$;

create or replace function public.send_tip(p_recipient_id uuid,p_amount numeric,p_note text default null)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_uid uuid := (select auth.uid());
  v_tip_id uuid;
  v_sender public.wallets%rowtype;
  v_recipient public.wallets%rowtype;
  v_amount numeric := round(p_amount,2);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recipient_id is null or p_recipient_id=v_uid then raise exception 'INVALID_RECIPIENT'; end if;
  if v_amount is null or v_amount<=0 or v_amount<>round(v_amount,2) then raise exception 'INVALID_AMOUNT'; end if;
  if v_amount>100000 then raise exception 'TIP_TOO_LARGE'; end if;
  if p_note is not null and length(trim(p_note))>200 then raise exception 'NOTE_TOO_LONG'; end if;

  insert into public.wallets(id) values(v_uid) on conflict (id) do nothing;
  insert into public.wallets(id) values(p_recipient_id) on conflict (id) do nothing;

  if v_uid::text < p_recipient_id::text then
    select * into v_sender from public.wallets where id=v_uid for update;
    select * into v_recipient from public.wallets where id=p_recipient_id for update;
  else
    select * into v_recipient from public.wallets where id=p_recipient_id for update;
    select * into v_sender from public.wallets where id=v_uid for update;
  end if;

  if v_sender.available_balance < v_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.wallets
    set available_balance=available_balance-v_amount,
        withdrawable_balance=least(withdrawable_balance,available_balance-v_amount),
        updated_at=now()
    where id=v_uid;

  update public.wallets
    set available_balance=available_balance+v_amount,
        withdrawable_balance=withdrawable_balance+v_amount,
        updated_at=now()
    where id=p_recipient_id;

  insert into public.tips(tipper_id,recipient_id,amount,note)
    values(v_uid,p_recipient_id,v_amount,nullif(trim(p_note),''))
    returning id into v_tip_id;

  insert into public.wallet_transactions(user_id,type,amount,reference_type,reference_id,description,status)
    values
      (v_uid,'adjustment',-v_amount,'tip',v_tip_id,'Tip sent','completed'),
      (p_recipient_id,'adjustment',v_amount,'tip',v_tip_id,'Tip received','completed');

  insert into public.notifications(user_id,task_id,type,title,message,is_read)
    values
      (p_recipient_id,null,'tip','You received a tip','You received '||to_char(v_amount,'FM₦999,999,990.00')||' from another user.',false),
      (v_uid,null,'tip','Tip sent','You sent '||to_char(v_amount,'FM₦999,999,990.00')||' to another user.',false);

  return v_tip_id;
end;
$function$;

revoke all on function public.send_tip(uuid,numeric,text) from public;
grant execute on function public.send_tip(uuid,numeric,text) to authenticated;
