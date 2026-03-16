# StudyCRM

StudyCRM is a Supabase-backed assignment CRM with multi-user authentication.

Each student:
- signs up with **SID (9 digits) + password**
- logs in to their own account
- sees only their own assignments and history

## Authentication model

- UI input is SID-only: exactly 9 numeric digits
- App maps SID to a valid synthetic auth email for Supabase Auth:
  - `<sid>@auth.studycrm.app`
- SID is also stored in `profiles.sid`
- Passwords are never stored in your custom tables (managed by Supabase Auth)

## Security model

- **No raw SQL from frontend**: app uses Supabase client query builders (parameterized requests)
- **Strict SID validation** in frontend and database
- **RLS enforced** on all user data tables
- **Ownership checks** use `auth.uid()` for select/insert/update/delete
- **Input hardening**:
  - SID accepts digits only and exact length
  - Signup uses stronger password policy (min 10 chars incl. upper/lower/number/symbol)

## Environment variables

Create `.env`:

```env
VITE_STORAGE_MODE=supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-publishable-anon-key>
```

## Local run

```bash
npm install
npm run dev
```

## Supabase setup (required)

1. Open Supabase project.
2. Go to `Authentication -> Providers` and enable **Email**.
3. In `Authentication -> Email`, set **Confirm email** to **OFF** for SID/password flow.
4. Run the SQL below in Supabase SQL Editor.
5. Put env keys in `.env`.
6. Start app.

## SQL to paste into Supabase

```sql
create extension if not exists pgcrypto;

-- Reset prior StudyCRM tables/types for clean auth migration
drop table if exists public.reminder_logs cascade;
drop table if exists public.assignment_occurrences cascade;
drop table if exists public.assignments cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

do $$
begin
  if exists (select 1 from pg_type where typname = 'occurrence_status') then
    drop type public.occurrence_status;
  end if;
  if exists (select 1 from pg_type where typname = 'assignment_status') then
    drop type public.assignment_status;
  end if;
  if exists (select 1 from pg_type where typname = 'assignment_type') then
    drop type public.assignment_type;
  end if;
end
$$;

create type assignment_type as enum ('standard', 'weekly');
create type assignment_status as enum ('pending', 'in_progress', 'completed');
create type occurrence_status as enum ('active', 'completed', 'missed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles table stores SID only (not password)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sid char(9) not null unique check (sid ~ '^[0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Auto-create profile on auth signup
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid_candidate text;
  normalized_sid text;
begin
  sid_candidate := coalesce(new.raw_user_meta_data ->> 'sid', split_part(new.email, '@', 1));
  normalized_sid := regexp_replace(coalesce(sid_candidate, ''), '[^0-9]', '', 'g');

  if normalized_sid !~ '^[0-9]{9}$' then
    raise exception 'SID must be exactly 9 digits';
  end if;

  insert into public.profiles (user_id, sid)
  values (new.id, normalized_sid)
  on conflict (user_id)
  do update set sid = excluded.sid, updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create trigger set_updated_at_categories
before update on public.categories
for each row
execute function public.set_updated_at();

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type assignment_type not null,
  title text not null,
  unit_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  description text not null default '',
  due_at timestamptz,
  weekly_day_of_week smallint check (weekly_day_of_week between 0 and 6),
  weekly_activation_time time,
  reminder_offsets_minutes integer[] not null default array[1440,360,30],
  status assignment_status not null default 'pending',
  is_completed boolean not null default false,
  is_active boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_type_shape_check check (
    (type = 'standard' and due_at is not null and weekly_day_of_week is null and weekly_activation_time is null)
    or
    (type = 'weekly' and due_at is null and weekly_day_of_week is not null and weekly_activation_time is not null)
  )
);

create trigger set_updated_at_assignments
before update on public.assignments
for each row
execute function public.set_updated_at();

create table public.assignment_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  cycle_start_at timestamptz not null,
  cycle_end_at timestamptz not null,
  status occurrence_status not null default 'active',
  completed_at timestamptz,
  missed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assignment_id, cycle_start_at)
);

create trigger set_updated_at_occurrences
before update on public.assignment_occurrences
for each row
execute function public.set_updated_at();

create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reminder_key text not null,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  occurrence_id uuid references public.assignment_occurrences(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  channel text not null default 'in_app',
  unique (user_id, reminder_key)
);

create index assignments_user_due_idx on public.assignments (user_id, due_at);
create index assignments_user_type_idx on public.assignments (user_id, type);
create index occurrences_user_cycle_idx on public.assignment_occurrences (user_id, cycle_start_at desc);
create index reminder_logs_user_triggered_idx on public.reminder_logs (user_id, triggered_at desc);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_occurrences enable row level security;
alter table public.reminder_logs enable row level security;

create policy profiles_select_own on public.profiles
for select using (user_id = auth.uid());
create policy profiles_insert_own on public.profiles
for insert with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy categories_select_own on public.categories
for select using (user_id = auth.uid());
create policy categories_insert_own on public.categories
for insert with check (user_id = auth.uid());
create policy categories_update_own on public.categories
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_delete_own on public.categories
for delete using (user_id = auth.uid());

create policy assignments_select_own on public.assignments
for select using (user_id = auth.uid());
create policy assignments_insert_own on public.assignments
for insert with check (user_id = auth.uid());
create policy assignments_update_own on public.assignments
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assignments_delete_own on public.assignments
for delete using (user_id = auth.uid());

create policy occurrences_select_own on public.assignment_occurrences
for select using (user_id = auth.uid());
create policy occurrences_insert_own on public.assignment_occurrences
for insert with check (user_id = auth.uid());
create policy occurrences_update_own on public.assignment_occurrences
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy occurrences_delete_own on public.assignment_occurrences
for delete using (user_id = auth.uid());

create policy reminder_logs_select_own on public.reminder_logs
for select using (user_id = auth.uid());
create policy reminder_logs_insert_own on public.reminder_logs
for insert with check (user_id = auth.uid());
create policy reminder_logs_update_own on public.reminder_logs
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminder_logs_delete_own on public.reminder_logs
for delete using (user_id = auth.uid());
```

## Why this prevents SQL injection in this flow

- The app does not concatenate SQL strings from user input.
- Supabase JS SDK calls use structured query methods (parameterized API requests).
- SID is validated as strict `^[0-9]{9}$` in UI and DB trigger/check.
- RLS prevents cross-user data access even if malicious requests are attempted.
- Text inputs are normalized and control characters are stripped before persistence.

## Troubleshooting signup

- Error: `email rate limit exceeded`
  - Cause: Supabase Auth email provider/rate limits are being hit.
  - Fix:
    1. Ensure `Confirm email` is OFF in Supabase Auth settings.
    2. If the SID may already be created, use **Login** instead of Create account.
    3. Wait ~60 seconds before retrying if you spammed create attempts.

## Notification limitations

- In-app reminders and browser notifications work while app is open.
- Reliable background reminders while app is closed require backend schedulers (Edge Functions / cron / push / email).
