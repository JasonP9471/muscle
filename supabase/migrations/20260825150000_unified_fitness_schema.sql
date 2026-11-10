create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  birth_year integer check (birth_year between 1900 and extract(year from now())::integer - 13),
  biological_sex text check (biological_sex in ('female','male','nonbinary','prefer_not_to_say')),
  height_cm numeric(6,2), current_weight numeric(7,2), target_weight numeric(7,2), units text not null default 'lb' check (units in ('lb','kg')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  primary_goal text not null, goal_rate text not null default 'moderate', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  training jsonb not null default '{}'::jsonb, nutrition jsonb not null default '{}'::jsonb,
  appearance jsonb not null default '{"theme":"system"}'::jsonb, notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.gym_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null unique
);
create table if not exists public.gym_profile_equipment (
  gym_profile_id uuid not null references public.gym_profiles(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (gym_profile_id,equipment_id)
);
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  movement_pattern text not null, difficulty text not null, exercise_type text not null,
  unilateral boolean not null default false, instructions jsonb not null default '[]'::jsonb,
  required_equipment text[] not null default '{}', media_url text, limitation_tags text[] not null default '{}'
);
create table if not exists public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade, muscle text not null,
  contribution numeric(4,3) not null check (contribution between 0 and 1), is_primary boolean not null default false,
  primary key (exercise_id,muscle)
);
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, split_day text not null, started_at timestamptz not null, completed_at timestamptz,
  duration_seconds integer not null default 0, total_volume numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('draft','active','completed','abandoned')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade, exercise_id uuid references public.exercises(id),
  exercise_key text not null, position integer not null, notes text not null default '', prescription jsonb not null default '{}'::jsonb,
  unique(workout_id,position)
);
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null check (set_number > 0), weight numeric(9,2), reps integer, rir integer check (rir between 0 and 5),
  completed_at timestamptz, created_at timestamptz not null default now(), unique(workout_exercise_id,set_number)
);
create table if not exists public.muscle_recovery (
  user_id uuid not null references auth.users(id) on delete cascade, muscle text not null,
  recovery integer not null check (recovery between 0 and 100), last_trained_at timestamptz,
  fatigue_sources jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now(), primary key(user_id,muscle)
);
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, brand text, serving_label text not null, serving_grams numeric(8,2),
  calories numeric(9,2) not null check (calories >= 0), protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0, fat_g numeric(8,2) not null default 0,
  barcode text, source text not null default 'custom', created_at timestamptz not null default now()
);
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, meal_type text not null, logged_at timestamptz not null,
  method text not null, estimated boolean not null default false, notes text, photo_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade, food_id uuid references public.foods(id) on delete set null,
  name text not null, serving_label text not null, quantity numeric(8,3) not null check (quantity > 0),
  calories numeric(9,2) not null, protein_g numeric(8,2) not null default 0, carbs_g numeric(8,2) not null default 0, fat_g numeric(8,2) not null default 0,
  confidence numeric(4,3) check (confidence between 0 and 1)
);
create table if not exists public.favorite_foods (
  user_id uuid not null references auth.users(id) on delete cascade, food_id uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,food_id)
);
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, default_meal_type text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.saved_meal_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  saved_meal_id uuid not null references public.saved_meals(id) on delete cascade, food_id uuid references public.foods(id) on delete set null,
  item jsonb not null
);
create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  calories integer not null, protein_g integer not null, carbs_g integer not null, fat_g integer not null,
  maintenance_calories integer not null, source text not null, effective_from date not null, created_at timestamptz not null default now(),
  unique(user_id,effective_from)
);
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  weight numeric(7,2) not null, logged_at timestamptz not null, notes text, created_at timestamptz not null default now()
);
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null, waist numeric(7,2), chest numeric(7,2), arms numeric(7,2), thighs numeric(7,2), hips numeric(7,2), units text not null, notes text
);
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null, logged_at timestamptz not null, caption text, created_at timestamptz not null default now()
);
create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null, weight numeric(7,2) not null, energy smallint not null check (energy between 1 and 5),
  hunger smallint not null check (hunger between 1 and 5), performance smallint not null check (performance between 1 and 5),
  recovery smallint not null check (recovery between 1 and 5), notes text, photo_path text
);
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade, exercise_key text,
  record_type text not null, value numeric(14,3) not null, achieved_at timestamptz not null
);
create table if not exists public.adaptive_recommendations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_type text not null, title text not null, message text not null, priority text not null,
  proposed_change jsonb, accepted_at timestamptz, dismissed_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists workouts_user_completed_idx on public.workouts(user_id,completed_at desc);
create index if not exists workout_sets_user_workout_idx on public.workout_sets(user_id,workout_id);
create index if not exists meals_user_logged_idx on public.meals(user_id,logged_at desc);
create index if not exists meal_items_user_meal_idx on public.meal_items(user_id,meal_id);
create index if not exists weight_logs_user_logged_idx on public.weight_logs(user_id,logged_at desc);
create index if not exists recommendations_user_created_idx on public.adaptive_recommendations(user_id,created_at desc);
create index if not exists foods_barcode_idx on public.foods(barcode) where barcode is not null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_goals','user_preferences','gym_profiles','gym_profile_equipment','workouts','workout_exercises',
    'workout_sets','muscle_recovery','meals','meal_items','favorite_foods','saved_meals','saved_meal_items',
    'nutrition_targets','weight_logs','body_measurements','progress_photos','weekly_checkins','personal_records','adaptive_recommendations'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from anon, authenticated',table_name);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = %s)',table_name || '_select_own',table_name,case when table_name = 'profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = %s)',table_name || '_insert_own',table_name,case when table_name = 'profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = %s) with check ((select auth.uid()) = %s)',table_name || '_update_own',table_name,case when table_name = 'profiles' then 'id' else 'user_id' end,case when table_name = 'profiles' then 'id' else 'user_id' end);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = %s)',table_name || '_delete_own',table_name,case when table_name = 'profiles' then 'id' else 'user_id' end);
  end loop;
end $$;

alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_muscles enable row level security;
revoke all on public.equipment,public.exercises,public.exercise_muscles from anon,authenticated;
grant select on public.equipment,public.exercises,public.exercise_muscles to anon,authenticated;
create policy equipment_read on public.equipment for select to anon,authenticated using (true);
create policy exercises_read on public.exercises for select to anon,authenticated using (true);
create policy exercise_muscles_read on public.exercise_muscles for select to anon,authenticated using (true);

alter table public.foods enable row level security;
revoke all on public.foods from anon,authenticated;
grant select on public.foods to anon,authenticated;
grant insert,update,delete on public.foods to authenticated;
create policy foods_read_system_or_own on public.foods for select to anon,authenticated using (user_id is null or (select auth.uid()) = user_id);
create policy foods_insert_own on public.foods for insert to authenticated with check ((select auth.uid()) = user_id);
create policy foods_update_own on public.foods for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy foods_delete_own on public.foods for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('meal-photos','meal-photos',false,8388608,array['image/jpeg','image/png','image/webp']),
  ('progress-photos','progress-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy trainos_storage_select_own on storage.objects for select to authenticated using (bucket_id in ('meal-photos','progress-photos') and owner_id = (select auth.uid()::text));
create policy trainos_storage_insert_own on storage.objects for insert to authenticated with check (bucket_id in ('meal-photos','progress-photos') and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy trainos_storage_update_own on storage.objects for update to authenticated using (bucket_id in ('meal-photos','progress-photos') and owner_id = (select auth.uid()::text)) with check (bucket_id in ('meal-photos','progress-photos') and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy trainos_storage_delete_own on storage.objects for delete to authenticated using (bucket_id in ('meal-photos','progress-photos') and owner_id = (select auth.uid()::text));
