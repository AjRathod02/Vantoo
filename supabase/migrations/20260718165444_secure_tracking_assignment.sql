alter table public.orders
  add column if not exists assigned_rider_id uuid
  references public.profiles (id) on delete set null;

create index if not exists orders_assigned_rider_active_idx
  on public.orders (assigned_rider_id, status)
  where assigned_rider_id is not null;

create or replace function public.enforce_tracking_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assigned_rider uuid;
begin
  if new.source = 'admin' then return new; end if;
  select assigned_rider_id into v_assigned_rider
  from public.orders
  where id = new.order_id;
  if new.rider_id is null or v_assigned_rider is distinct from new.rider_id then
    raise exception 'RIDER_NOT_ASSIGNED';
  end if;
  return new;
end;
$$;

drop trigger if exists order_tracking_enforce_assignment
  on public.order_tracking_events;
create trigger order_tracking_enforce_assignment
  before insert on public.order_tracking_events
  for each row execute function public.enforce_tracking_assignment();

create or replace function public.assign_order_rider(
  p_order_id text,
  p_rider_id uuid,
  p_actor_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_rider_role text;
begin
  select role into v_rider_role from public.profiles where id = p_rider_id;
  if v_rider_role <> 'rider' then raise exception 'INVALID_RIDER'; end if;

  update public.orders
  set assigned_rider_id = p_rider_id,
      status = case when status in ('confirmed', 'preparing', 'packed') then 'assigned' else status end,
      updated_at = now()
  where id = p_order_id
    and status not in ('delivered', 'cancelled', 'returned', 'refunded')
  returning * into v_order;
  if v_order.id is null then raise exception 'ORDER_NOT_ASSIGNABLE'; end if;

  insert into public.order_status_history (
    order_id, from_status, status, label, note, changed_by, changed_by_role,
    metadata
  )
  values (
    p_order_id, null, v_order.status, 'Rider assigned', '', p_actor_id, 'admin',
    jsonb_build_object('riderId', p_rider_id)
  );
  return v_order;
end;
$$;

revoke all on function public.enforce_tracking_assignment()
  from public, anon, authenticated;
revoke all on function public.assign_order_rider(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_order_rider(text, uuid, uuid)
  to service_role;
