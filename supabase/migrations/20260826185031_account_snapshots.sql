create table public.account_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  backup_version integer not null,
  source_device_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.account_snapshots enable row level security;
revoke all on table public.account_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.account_snapshots to authenticated;

create policy account_snapshots_select_own
on public.account_snapshots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy account_snapshots_insert_own
on public.account_snapshots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy account_snapshots_update_own
on public.account_snapshots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy account_snapshots_delete_own
on public.account_snapshots for delete
to authenticated
using ((select auth.uid()) = user_id);
