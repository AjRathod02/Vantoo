-- Durable, idempotent order/payment foundation for the Supabase-only launch.
-- All mutation functions are service-role only; clients retain owner reads.

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.vantoo_order_id_seq
  as bigint
  start with 100000
  increment by 1
  no cycle;

create or replace function public.next_vantoo_order_id()
returns text
language sql
volatile
set search_path = public
as $$
  select 'VT' || to_char(current_date, 'YYMMDD') ||
         lpad(nextval('public.vantoo_order_id_seq')::text, 10, '0');
$$;

alter table public.orders
  alter column id set default public.next_vantoo_order_id(),
  add column if not exists request_hash text,
  add column if not exists payment_attempt_id uuid;

update public.orders
set idempotency_key = 'legacy:' || id
where idempotency_key is null or btrim(idempotency_key) = '';

update public.orders
set request_hash = encode(
  extensions.digest(convert_to(id || ':' || coalesce(user_id::text, ''), 'UTF8'), 'sha256'),
  'hex'
)
where request_hash is null or btrim(request_hash) = '';

alter table public.orders
  alter column idempotency_key set not null,
  alter column request_hash set not null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in (
    'payment_pending', 'pending', 'confirmed', 'preparing', 'packed',
    'assigned', 'picked', 'in_transit', 'out_for_delivery', 'delivered',
    'cancelled', 'returned', 'refunded', 'exchanged'
  )
);

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (
  payment_status in (
    'pending', 'processing', 'verification_pending', 'paid', 'failed',
    'refund_initiated', 'partially_refunded', 'refunded', 'refund_completed'
  )
);

create unique index if not exists orders_user_idempotency_uidx
  on public.orders (user_id, idempotency_key)
  where user_id is not null;
create unique index if not exists orders_razorpay_order_id_uidx
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null and razorpay_order_id <> '';
create index if not exists orders_user_placed_idx
  on public.orders (user_id, placed_at desc);

create table if not exists public.product_inventory (
  product_id text primary key references public.products (id) on delete cascade,
  available_quantity integer not null check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  check (reserved_quantity <= available_quantity)
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists inventory_reservations_order_status_idx
  on public.inventory_reservations (order_id, status);

create table if not exists public.order_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  provider text not null default 'razorpay',
  payment_method text not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (
    status in (
      'created', 'gateway_order_created', 'verification_pending', 'captured',
      'failed', 'cancelled', 'partially_refunded', 'refunded'
    )
  ),
  idempotency_key text not null,
  request_hash text not null,
  gateway_order_id text,
  gateway_payment_id text,
  failure_code text,
  failure_reason text,
  metadata jsonb not null default '{}',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (gateway_order_id),
  unique (gateway_payment_id)
);

create index if not exists order_payment_attempts_order_idx
  on public.order_payment_attempts (order_id, created_at desc);

alter table public.orders
  add constraint orders_payment_attempt_id_fkey
  foreign key (payment_attempt_id)
  references public.order_payment_attempts (id)
  deferrable initially deferred;

create table if not exists public.payment_webhook_events (
  event_id text primary key,
  provider text not null default 'razorpay',
  event_type text not null,
  gateway_order_id text,
  gateway_payment_id text,
  gateway_refund_id text,
  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'unmatched', 'failed')),
  processing_attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_webhook_events_unprocessed_idx
  on public.payment_webhook_events (received_at)
  where processing_status in ('received', 'unmatched', 'failed');

create table if not exists public.refund_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete restrict,
  payment_attempt_id uuid not null
    references public.order_payment_attempts (id) on delete restrict,
  requested_by uuid,
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  gateway_refund_id text unique,
  failure_reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists refund_attempts_order_idx
  on public.refund_attempts (order_id, created_at desc);

alter table public.order_status_history
  add column if not exists from_status text,
  add column if not exists changed_by uuid,
  add column if not exists changed_by_role text,
  add column if not exists metadata jsonb not null default '{}';

alter table public.product_inventory enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.order_payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refund_attempts enable row level security;

revoke all on public.product_inventory from anon, authenticated;
revoke all on public.inventory_reservations from anon, authenticated;
revoke all on public.order_payment_attempts from anon, authenticated;
revoke all on public.payment_webhook_events from anon, authenticated;
revoke all on public.refund_attempts from anon, authenticated;

drop policy if exists "Users create own orders" on public.orders;
drop policy if exists "Users update own orders (cancel)" on public.orders;
drop policy if exists "Admins manage all orders" on public.orders;

drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.prepare_order(
  p_user_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_items jsonb,
  p_payment_method text,
  p_address jsonb,
  p_service text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_attempt public.order_payment_attempts%rowtype;
  v_priced_items jsonb;
  v_requested_count integer;
  v_priced_count integer;
  v_subtotal numeric;
  v_tax numeric;
  v_delivery_fee numeric := 40;
  v_total numeric;
  v_inventory record;
  v_requested_qty integer;
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 16 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_request_hash is null or length(p_request_hash) < 32 then
    raise exception 'INVALID_REQUEST_HASH';
  end if;
  if p_payment_method not in ('card', 'netbanking', 'upi', 'cod') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if p_service not in ('food', 'grocery', 'medicine', 'ecommerce', 'local_shop') then
    raise exception 'INVALID_SERVICE';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_CART';
  end if;

  select *
  into v_existing
  from public.orders
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_attempt
    from public.order_payment_attempts
    where order_id = v_existing.id
    order by created_at desc
    limit 1;
    return jsonb_build_object(
      'order', to_jsonb(v_existing),
      'paymentAttempt', case when v_attempt.id is null then null else to_jsonb(v_attempt) end,
      'replayed', true
    );
  end if;

  with requested as (
    select
      item->>'productId' as product_id,
      sum((item->>'quantity')::integer)::integer as quantity,
      min(nullif(item->>'variantId', '')) as variant_id
    from jsonb_array_elements(p_items) item
    where item ? 'productId' and item ? 'quantity'
      and (item->>'quantity') ~ '^[1-9][0-9]*$'
      and (item->>'quantity')::integer <= 100
    group by item->>'productId'
  ),
  priced as (
    select
      r.product_id,
      r.variant_id,
      r.quantity,
      p.name,
      p.image,
      p.price
    from requested r
    join public.products p on p.id = r.product_id
    where p.in_stock = true
  )
  select
    (select count(*) from requested),
    count(*),
    jsonb_agg(
      jsonb_build_object(
        'productId', product_id,
        'variantId', variant_id,
        'name', name,
        'image', image,
        'price', price,
        'quantity', quantity
      )
      order by product_id
    ),
    sum(price * quantity)
  into v_requested_count, v_priced_count, v_priced_items, v_subtotal
  from priced;

  if v_requested_count is null or v_requested_count = 0
     or v_requested_count <> v_priced_count then
    raise exception 'PRODUCT_UNAVAILABLE';
  end if;

  v_tax := round(v_subtotal * 0.05);
  v_total := v_subtotal + v_tax + v_delivery_fee;

  insert into public.orders (
    user_id, items, subtotal, delivery_fee, tax, discount, total,
    status, payment_method, payment_status, refund_status,
    address, service, idempotency_key, request_hash
  )
  values (
    p_user_id, v_priced_items, v_subtotal, v_delivery_fee, v_tax, 0, v_total,
    case when p_payment_method = 'cod' then 'confirmed' else 'payment_pending' end,
    p_payment_method, 'pending', 'none',
    p_address, p_service, p_idempotency_key, p_request_hash
  )
  returning * into v_order;

  for v_inventory in
    select pi.product_id, pi.available_quantity, pi.reserved_quantity
    from public.product_inventory pi
    where pi.product_id in (
      select item->>'productId' from jsonb_array_elements(v_priced_items) item
    )
    order by pi.product_id
    for update
  loop
    select (item->>'quantity')::integer
    into v_requested_qty
    from jsonb_array_elements(v_priced_items) item
    where item->>'productId' = v_inventory.product_id;

    if v_inventory.available_quantity - v_inventory.reserved_quantity < v_requested_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_inventory.product_id;
    end if;

    update public.product_inventory
    set reserved_quantity = reserved_quantity + v_requested_qty,
        version = version + 1,
        updated_at = now()
    where product_id = v_inventory.product_id;

    insert into public.inventory_reservations (order_id, product_id, quantity)
    values (v_order.id, v_inventory.product_id, v_requested_qty);
  end loop;

  insert into public.order_status_history (
    order_id, status, label, note, changed_by, changed_by_role, metadata
  )
  values (
    v_order.id, v_order.status, 'Order placed', '',
    p_user_id, 'customer', jsonb_build_object('idempotencyKey', p_idempotency_key)
  );

  if p_payment_method <> 'cod' then
    insert into public.order_payment_attempts (
      order_id, user_id, payment_method, amount_paise,
      idempotency_key, request_hash
    )
    values (
      v_order.id, p_user_id, p_payment_method, round(v_total * 100)::bigint,
      p_idempotency_key, p_request_hash
    )
    returning * into v_attempt;

    update public.orders
    set payment_attempt_id = v_attempt.id
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'paymentAttempt', case when v_attempt.id is null then null else to_jsonb(v_attempt) end,
    'replayed', false
  );
end;
$$;

create or replace function public.bind_gateway_order(
  p_user_id uuid,
  p_order_id text,
  p_payment_attempt_id uuid,
  p_gateway_order_id text
)
returns public.order_payment_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.order_payment_attempts%rowtype;
begin
  update public.order_payment_attempts
  set gateway_order_id = p_gateway_order_id,
      status = 'gateway_order_created',
      updated_at = now()
  where id = p_payment_attempt_id
    and order_id = p_order_id
    and user_id = p_user_id
    and (gateway_order_id is null or gateway_order_id = p_gateway_order_id)
  returning * into v_attempt;

  if v_attempt.id is null then raise exception 'PAYMENT_ATTEMPT_NOT_FOUND'; end if;

  update public.orders
  set razorpay_order_id = p_gateway_order_id, updated_at = now()
  where id = p_order_id and user_id = p_user_id;

  return v_attempt;
end;
$$;

create or replace function public.finalize_order_payment(
  p_user_id uuid,
  p_order_id text,
  p_payment_attempt_id uuid,
  p_gateway_order_id text,
  p_gateway_payment_id text,
  p_amount_paise bigint
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.order_payment_attempts%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_attempt
  from public.order_payment_attempts
  where id = p_payment_attempt_id and order_id = p_order_id and user_id = p_user_id
  for update;

  if v_attempt.id is null then raise exception 'PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.gateway_order_id is distinct from p_gateway_order_id then
    raise exception 'GATEWAY_ORDER_MISMATCH';
  end if;
  if v_attempt.amount_paise <> p_amount_paise then
    raise exception 'CAPTURED_AMOUNT_MISMATCH';
  end if;
  if v_attempt.gateway_payment_id is not null
     and v_attempt.gateway_payment_id <> p_gateway_payment_id then
    raise exception 'PAYMENT_ALREADY_FINALIZED';
  end if;

  update public.order_payment_attempts
  set gateway_payment_id = p_gateway_payment_id,
      status = 'captured',
      captured_at = coalesce(captured_at, now()),
      updated_at = now()
  where id = v_attempt.id;

  update public.orders
  set razorpay_order_id = p_gateway_order_id,
      razorpay_payment_id = p_gateway_payment_id,
      payment_status = 'paid',
      status = case when status = 'payment_pending' then 'confirmed' else status end,
      updated_at = now()
  where id = p_order_id and user_id = p_user_id
  returning * into v_order;

  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;

  update public.inventory_reservations
  set status = 'committed', updated_at = now()
  where order_id = p_order_id and status = 'reserved';

  insert into public.order_status_history (
    order_id, from_status, status, label, note, changed_by, changed_by_role
  )
  select p_order_id, 'payment_pending', v_order.status, 'Payment confirmed', '',
         p_user_id, 'customer'
  where not exists (
    select 1 from public.order_status_history
    where order_id = p_order_id and label = 'Payment confirmed'
  );

  return v_order;
end;
$$;

create or replace function public.release_order_reservations(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation record;
begin
  for v_reservation in
    select * from public.inventory_reservations
    where order_id = p_order_id and status = 'reserved'
    order by product_id
    for update
  loop
    update public.product_inventory
    set reserved_quantity = greatest(reserved_quantity - v_reservation.quantity, 0),
        version = version + 1,
        updated_at = now()
    where product_id = v_reservation.product_id;

    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where id = v_reservation.id;
  end loop;
end;
$$;

create or replace function public.cancel_order(
  p_order_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_reason text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_previous text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_actor_role = 'customer' and v_order.user_id <> p_actor_id then
    raise exception 'ORDER_FORBIDDEN';
  end if;
  if v_order.status in ('delivered', 'cancelled', 'returned', 'refunded') then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  v_previous := v_order.status;
  update public.orders
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_order_id
  returning * into v_order;

  perform public.release_order_reservations(p_order_id);

  update public.order_payment_attempts
  set status = case when status = 'captured' then status else 'cancelled' end,
      updated_at = now()
  where order_id = p_order_id;

  insert into public.order_status_history (
    order_id, from_status, status, label, note, changed_by, changed_by_role
  )
  values (
    p_order_id, v_previous, 'cancelled', 'Order cancelled',
    coalesce(p_reason, ''), p_actor_id, p_actor_role
  );

  return v_order;
end;
$$;

create or replace function public.transition_order_status(
  p_order_id text,
  p_next_status text,
  p_actor_id uuid,
  p_actor_role text,
  p_note text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_previous text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  v_previous := v_order.status;

  if not (
    (v_previous = 'confirmed' and p_next_status in ('preparing', 'cancelled')) or
    (v_previous = 'preparing' and p_next_status in ('packed', 'cancelled')) or
    (v_previous = 'packed' and p_next_status in ('assigned', 'out_for_delivery', 'cancelled')) or
    (v_previous = 'assigned' and p_next_status in ('picked', 'out_for_delivery', 'cancelled')) or
    (v_previous = 'picked' and p_next_status in ('in_transit', 'out_for_delivery')) or
    (v_previous = 'in_transit' and p_next_status = 'delivered') or
    (v_previous = 'out_for_delivery' and p_next_status = 'delivered') or
    (v_previous = 'delivered' and p_next_status in ('returned', 'refunded')) or
    (v_previous = p_next_status)
  ) then
    raise exception 'INVALID_STATUS_TRANSITION:%->%', v_previous, p_next_status;
  end if;

  if p_next_status = 'cancelled' then
    return public.cancel_order(p_order_id, p_actor_id, p_actor_role, p_note);
  end if;

  update public.orders
  set status = p_next_status,
      payment_status = case
        when p_next_status = 'delivered' and payment_method = 'cod' then 'paid'
        else payment_status
      end,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (
    order_id, from_status, status, label, note, changed_by, changed_by_role
  )
  values (
    p_order_id, v_previous, p_next_status, initcap(replace(p_next_status, '_', ' ')),
    coalesce(p_note, ''), p_actor_id, p_actor_role
  );

  return v_order;
end;
$$;

create or replace function public.record_payment_webhook(
  p_event_id text,
  p_event_type text,
  p_gateway_order_id text,
  p_gateway_payment_id text,
  p_gateway_refund_id text,
  p_payload jsonb
)
returns public.payment_webhook_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.payment_webhook_events%rowtype;
begin
  insert into public.payment_webhook_events (
    event_id, event_type, gateway_order_id, gateway_payment_id,
    gateway_refund_id, payload
  )
  values (
    p_event_id, p_event_type, p_gateway_order_id, p_gateway_payment_id,
    p_gateway_refund_id, p_payload
  )
  on conflict (event_id) do update
    set processing_attempts = public.payment_webhook_events.processing_attempts + 1
  returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.update_payment_webhook_status(
  p_event_id text,
  p_status text,
  p_error text default null
)
returns public.payment_webhook_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.payment_webhook_events%rowtype;
begin
  if p_status not in ('processed', 'unmatched', 'failed') then
    raise exception 'INVALID_WEBHOOK_STATUS';
  end if;
  update public.payment_webhook_events
  set processing_status = p_status,
      processing_attempts = processing_attempts + 1,
      last_error = p_error,
      processed_at = case when p_status = 'processed' then now() else processed_at end
  where event_id = p_event_id
  returning * into v_event;
  if v_event.event_id is null then raise exception 'WEBHOOK_EVENT_NOT_FOUND'; end if;
  return v_event;
end;
$$;

create or replace function public.mark_payment_attempt_failed(
  p_gateway_order_id text,
  p_gateway_payment_id text,
  p_failure_code text,
  p_failure_reason text
)
returns public.order_payment_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.order_payment_attempts%rowtype;
begin
  update public.order_payment_attempts
  set gateway_payment_id = coalesce(gateway_payment_id, p_gateway_payment_id),
      status = 'failed',
      failure_code = p_failure_code,
      failure_reason = p_failure_reason,
      updated_at = now()
  where gateway_order_id = p_gateway_order_id
    and status not in ('captured', 'partially_refunded', 'refunded')
  returning * into v_attempt;

  if v_attempt.id is null then raise exception 'PAYMENT_ATTEMPT_NOT_FOUND'; end if;

  update public.orders
  set payment_status = 'failed', updated_at = now()
  where id = v_attempt.order_id
    and status = 'payment_pending';
  return v_attempt;
end;
$$;

create or replace function public.prepare_refund_attempt(
  p_order_id text,
  p_requested_by uuid,
  p_amount_paise bigint,
  p_reason text,
  p_idempotency_key text
)
returns public.refund_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.order_payment_attempts%rowtype;
  v_refund public.refund_attempts%rowtype;
  v_committed bigint;
begin
  select * into v_refund
  from public.refund_attempts
  where idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_refund.order_id <> p_order_id or v_refund.amount_paise <> p_amount_paise then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_refund;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_status not in ('paid', 'partially_refunded', 'refund_initiated') then
    raise exception 'ORDER_NOT_REFUNDABLE';
  end if;

  select * into v_payment
  from public.order_payment_attempts
  where order_id = p_order_id and status in ('captured', 'partially_refunded')
  order by created_at desc
  limit 1
  for update;
  if v_payment.id is null then raise exception 'CAPTURED_PAYMENT_NOT_FOUND'; end if;

  select coalesce(sum(amount_paise), 0)::bigint into v_committed
  from public.refund_attempts
  where order_id = p_order_id and status in ('processing', 'completed');

  if p_amount_paise <= 0
     or v_committed + p_amount_paise > round(v_order.total * 100)::bigint then
    raise exception 'INVALID_REFUND_AMOUNT';
  end if;

  insert into public.refund_attempts (
    order_id, payment_attempt_id, requested_by, amount_paise,
    reason, idempotency_key
  )
  values (
    p_order_id, v_payment.id, p_requested_by, p_amount_paise,
    coalesce(p_reason, ''), p_idempotency_key
  )
  returning * into v_refund;

  update public.orders
  set refund_status = 'processing',
      payment_status = 'refund_initiated',
      refund_amount = (v_committed + p_amount_paise)::numeric / 100,
      updated_at = now()
  where id = p_order_id;

  return v_refund;
end;
$$;

create or replace function public.bind_gateway_refund(
  p_refund_attempt_id uuid,
  p_gateway_refund_id text
)
returns public.refund_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refund_attempts%rowtype;
begin
  update public.refund_attempts
  set gateway_refund_id = p_gateway_refund_id,
      status = 'processing',
      updated_at = now()
  where id = p_refund_attempt_id
    and (gateway_refund_id is null or gateway_refund_id = p_gateway_refund_id)
  returning * into v_refund;
  if v_refund.id is null then raise exception 'REFUND_ATTEMPT_NOT_FOUND'; end if;

  update public.orders
  set gateway_refund_id = p_gateway_refund_id,
      refund_status = 'processing',
      updated_at = now()
  where id = v_refund.order_id;
  return v_refund;
end;
$$;

create or replace function public.complete_gateway_refund(
  p_gateway_refund_id text,
  p_amount_paise bigint
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refund_attempts%rowtype;
  v_order public.orders%rowtype;
  v_completed bigint;
begin
  select * into v_refund
  from public.refund_attempts
  where gateway_refund_id = p_gateway_refund_id
  for update;
  if v_refund.id is null then raise exception 'REFUND_ATTEMPT_NOT_FOUND'; end if;
  if v_refund.amount_paise <> p_amount_paise then
    raise exception 'REFUND_AMOUNT_MISMATCH';
  end if;

  update public.refund_attempts
  set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = v_refund.id;

  select coalesce(sum(amount_paise), 0)::bigint into v_completed
  from public.refund_attempts
  where order_id = v_refund.order_id and status = 'completed';

  update public.orders
  set refund_amount = v_completed::numeric / 100,
      refund_status = case
        when v_completed >= round(total * 100)::bigint then 'completed'
        else 'processing'
      end,
      payment_status = case
        when v_completed >= round(total * 100)::bigint then 'refunded'
        else 'partially_refunded'
      end,
      updated_at = now()
  where id = v_refund.order_id
  returning * into v_order;

  update public.order_payment_attempts
  set status = case
        when v_order.payment_status = 'refunded' then 'refunded'
        else 'partially_refunded'
      end,
      updated_at = now()
  where id = v_refund.payment_attempt_id;

  return v_order;
end;
$$;

revoke all on function public.next_vantoo_order_id() from public, anon, authenticated;
revoke all on function public.prepare_order(uuid, text, text, jsonb, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.bind_gateway_order(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.finalize_order_payment(uuid, text, uuid, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.release_order_reservations(text)
  from public, anon, authenticated;
revoke all on function public.cancel_order(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.transition_order_status(text, text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_payment_webhook(text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_payment_webhook_status(text, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_payment_attempt_failed(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.prepare_refund_attempt(text, uuid, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.bind_gateway_refund(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_gateway_refund(text, bigint)
  from public, anon, authenticated;

grant execute on function public.prepare_order(uuid, text, text, jsonb, text, jsonb, text)
  to service_role;
grant execute on function public.bind_gateway_order(uuid, text, uuid, text)
  to service_role;
grant execute on function public.finalize_order_payment(uuid, text, uuid, text, text, bigint)
  to service_role;
grant execute on function public.release_order_reservations(text)
  to service_role;
grant execute on function public.cancel_order(text, uuid, text, text)
  to service_role;
grant execute on function public.transition_order_status(text, text, uuid, text, text)
  to service_role;
grant execute on function public.record_payment_webhook(text, text, text, text, text, jsonb)
  to service_role;
grant execute on function public.update_payment_webhook_status(text, text, text)
  to service_role;
grant execute on function public.mark_payment_attempt_failed(text, text, text, text)
  to service_role;
grant execute on function public.prepare_refund_attempt(text, uuid, bigint, text, text)
  to service_role;
grant execute on function public.bind_gateway_refund(uuid, text)
  to service_role;
grant execute on function public.complete_gateway_refund(text, bigint)
  to service_role;
