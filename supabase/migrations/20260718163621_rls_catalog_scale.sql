-- RLS/privilege hardening and bounded catalog query indexes.

create extension if not exists pg_trgm with schema extensions;

create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_brand_trgm_idx
  on public.products using gin (brand extensions.gin_trgm_ops);
create index if not exists products_description_trgm_idx
  on public.products using gin (description extensions.gin_trgm_ops);
create index if not exists products_service_category_stock_id_idx
  on public.products (service, category, in_stock, id);
create index if not exists products_service_price_id_idx
  on public.products (service, price, id);
create index if not exists products_service_rating_id_idx
  on public.products (service, rating desc, id);
create index if not exists products_vendor_updated_idx
  on public.products (vendor_id, updated_at desc)
  where vendor_id is not null;

revoke insert, update, delete on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

revoke update on public.profiles from authenticated;
grant update (name, phone, avatar_url, gender, date_of_birth)
  on public.profiles to authenticated;

create or replace function public.enforce_location_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = new.user_id;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  new.role := v_role;
  return new;
end;
$$;

drop trigger if exists user_locations_enforce_role on public.user_locations;
create trigger user_locations_enforce_role
  before insert or update of user_id, role
  on public.user_locations
  for each row execute function public.enforce_location_role();

drop trigger if exists user_location_history_enforce_role
  on public.user_location_history;
create trigger user_location_history_enforce_role
  before insert or update of user_id, role
  on public.user_location_history
  for each row execute function public.enforce_location_role();

revoke all on function public.enforce_location_role()
  from public, anon, authenticated;

drop policy if exists "Users can upsert own location" on public.user_locations;
create policy "Users can upsert own location"
  on public.user_locations for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own history"
  on public.user_location_history;
create policy "Users can insert own history"
  on public.user_location_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own history"
  on public.user_location_history;
create policy "Users can read own history"
  on public.user_location_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own order history"
  on public.order_status_history;
create policy "Users read own order history"
  on public.order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and orders.user_id = (select auth.uid())
    )
  );

grant select on public.order_status_history to authenticated;
