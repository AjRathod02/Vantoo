-- Local/staging test fixtures only. Never include seed data in a production push.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'database-test@vantoo.invalid',
  extensions.crypt('DatabaseTestOnly1!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Database Test"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into public.products (
  id, name, description, service, category, brand, price, rating, reviews,
  image, in_stock
)
values (
  'db-test-product',
  'Database Test Product',
  'Local and staging test fixture',
  'grocery',
  'test',
  'Vantoo Test',
  100,
  5,
  0,
  '',
  true
)
on conflict (id) do update
set price = excluded.price, in_stock = true, updated_at = now();

insert into public.product_inventory (
  product_id, available_quantity, reserved_quantity
)
values ('db-test-product', 10, 0)
on conflict (product_id) do update
set available_quantity = 10, reserved_quantity = 0, updated_at = now();
