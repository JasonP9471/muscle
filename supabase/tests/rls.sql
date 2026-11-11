begin;
select plan(15);
select has_table('public','profiles','profiles exists');
select has_table('public','workouts','workouts exists');
select has_table('public','meals','meals exists');
select has_table('public','nutrition_targets','nutrition targets exists');
select has_table('public','progress_photos','progress photos exists');
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),true,'profiles RLS is active');
select is((select relrowsecurity from pg_class where oid = 'public.workouts'::regclass),true,'workouts RLS is active');
select is((select relrowsecurity from pg_class where oid = 'public.meals'::regclass),true,'meals RLS is active');
select is((select relrowsecurity from pg_class where oid = 'public.account_snapshots'::regclass),true,'account snapshot RLS is active');

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'trainos-user-a@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'trainos-user-b@test.invalid');

insert into public.account_snapshots (user_id, payload, backup_version, source_device_id, updated_at) values
  ('11111111-1111-4111-8111-111111111111', '{"app":"TrainOS","version":4,"tables":{"profiles":[{"id":"primary","name":"User A"}]}}', 4, 'seed-a', '2026-10-27T12:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', '{"app":"TrainOS","version":4,"tables":{"profiles":[{"id":"primary","name":"User B"}]}}', 4, 'seed-b', '2026-10-27T12:00:00Z');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$ select count(*) from public.account_snapshots $$,
  array[1::bigint],
  'user A can only read one account snapshot'
);
select results_eq(
  $$ update public.account_snapshots set source_device_id = 'user-a-device' where user_id = '11111111-1111-4111-8111-111111111111' returning source_device_id $$,
  $$ values ('user-a-device'::text) $$,
  'user A can update their own snapshot'
);
select is_empty(
  $$ update public.account_snapshots set source_device_id = 'cross-user-write' where user_id = '22222222-2222-4222-8222-222222222222' returning user_id $$,
  'user A cannot update user B snapshot'
);
select is_empty(
  $$ delete from public.account_snapshots where user_id = '22222222-2222-4222-8222-222222222222' returning user_id $$,
  'user A cannot delete user B snapshot'
);

set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
select results_eq(
  $$ select source_device_id from public.account_snapshots $$,
  $$ values ('seed-b'::text) $$,
  'user B sees only their unchanged snapshot'
);

set local role anon;
set local "request.jwt.claim.sub" = '';
select throws_ok(
  $$ select user_id from public.account_snapshots $$,
  '42501',
  'permission denied for table account_snapshots',
  'anonymous users cannot read account snapshots'
);
select * from finish();
rollback;
