-- Durable tracking events are committed before Redis cache/pubsub fanout.

alter table public.orders
  add column if not exists tracking_version bigint not null default 0,
  add column if not exists tracking_updated_at timestamptz;

create table if not exists public.order_tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  rider_id uuid references public.profiles (id) on delete set null,
  version bigint not null,
  latitude numeric not null check (latitude between -90 and 90),
  longitude numeric not null check (longitude between -180 and 180),
  accuracy numeric,
  speed numeric,
  heading numeric,
  source text not null default 'rider_app',
  metadata jsonb not null default '{}',
  recorded_at timestamptz not null default now(),
  unique (order_id, version)
);

create index if not exists order_tracking_events_order_recorded_idx
  on public.order_tracking_events (order_id, recorded_at desc);

alter table public.order_tracking_events enable row level security;

drop policy if exists "Users read own order tracking"
  on public.order_tracking_events;
create policy "Users read own order tracking"
  on public.order_tracking_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_tracking_events.order_id
        and orders.user_id = (select auth.uid())
    )
  );

grant select on public.order_tracking_events to authenticated;
revoke insert, update, delete on public.order_tracking_events
  from anon, authenticated;

create or replace function public.persist_order_tracking(
  p_order_id text,
  p_rider_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy numeric default null,
  p_speed numeric default null,
  p_heading numeric default null,
  p_source text default 'rider_app',
  p_metadata jsonb default '{}'
)
returns public.order_tracking_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_event public.order_tracking_events%rowtype;
begin
  if p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('delivered', 'cancelled', 'returned', 'refunded') then
    raise exception 'ORDER_NOT_TRACKABLE';
  end if;

  update public.orders
  set rider_lat = p_latitude,
      rider_lng = p_longitude,
      tracking_version = tracking_version + 1,
      tracking_updated_at = now(),
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_tracking_events (
    order_id, rider_id, version, latitude, longitude,
    accuracy, speed, heading, source, metadata
  )
  values (
    p_order_id, p_rider_id, v_order.tracking_version, p_latitude, p_longitude,
    p_accuracy, p_speed, p_heading, p_source, coalesce(p_metadata, '{}')
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.persist_order_tracking(
  text, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_order_tracking(
  text, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb
) to service_role;
