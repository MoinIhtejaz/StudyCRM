create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assignment_type') then
    create type public.assignment_type as enum ('standard', 'weekly');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('pending', 'in_progress', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'occurrence_status') then
    create type public.occurrence_status as enum ('active', 'completed', 'missed');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();
drop table if exists public.profiles cascade;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  type public.assignment_type not null,
  title text not null,
  unit_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  description text not null default '',
  due_at timestamptz,
  weekly_day_of_week smallint check (weekly_day_of_week between 0 and 6),
  weekly_activation_time time,
  reminder_offsets_minutes integer[] not null default array[1440, 360, 30],
  status public.assignment_status not null default 'pending',
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

create table if not exists public.assignment_occurrences (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  cycle_start_at timestamptz not null,
  cycle_end_at timestamptz not null,
  status public.occurrence_status not null default 'active',
  completed_at timestamptz,
  missed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_key text not null,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  occurrence_id uuid references public.assignment_occurrences(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  channel text not null default 'in_app'
);

alter table if exists public.categories disable row level security;
alter table if exists public.assignments disable row level security;
alter table if exists public.assignment_occurrences disable row level security;
alter table if exists public.reminder_logs disable row level security;

alter table if exists public.categories drop constraint if exists categories_user_id_name_key;
alter table if exists public.categories drop constraint if exists categories_name_key;
alter table if exists public.categories drop column if exists user_id;
alter table if exists public.categories add constraint categories_name_key unique (name);

alter table if exists public.assignments drop column if exists user_id;

alter table if exists public.assignment_occurrences
  drop constraint if exists assignment_occurrences_user_id_assignment_id_cycle_start_at_key;
alter table if exists public.assignment_occurrences
  drop constraint if exists assignment_occurrences_assignment_id_cycle_start_at_key;
alter table if exists public.assignment_occurrences drop column if exists user_id;
alter table if exists public.assignment_occurrences
  add constraint assignment_occurrences_assignment_id_cycle_start_at_key unique (assignment_id, cycle_start_at);

alter table if exists public.reminder_logs drop constraint if exists reminder_logs_user_id_reminder_key_key;
alter table if exists public.reminder_logs drop constraint if exists reminder_logs_reminder_key_key;
alter table if exists public.reminder_logs drop column if exists user_id;
alter table if exists public.reminder_logs
  add constraint reminder_logs_reminder_key_key unique (reminder_key);

drop trigger if exists set_updated_at_categories on public.categories;
create trigger set_updated_at_categories
before update on public.categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_assignments on public.assignments;
create trigger set_updated_at_assignments
before update on public.assignments
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_occurrences on public.assignment_occurrences;
create trigger set_updated_at_occurrences
before update on public.assignment_occurrences
for each row
execute function public.set_updated_at();

drop index if exists public.assignments_user_due_idx;
drop index if exists public.assignments_user_type_idx;
drop index if exists public.occurrences_user_cycle_idx;
drop index if exists public.reminder_logs_user_triggered_idx;

create index if not exists assignments_due_idx on public.assignments (due_at);
create index if not exists assignments_type_idx on public.assignments (type);
create index if not exists occurrences_cycle_idx on public.assignment_occurrences (cycle_start_at desc);
create index if not exists reminder_logs_triggered_idx on public.reminder_logs (triggered_at desc);
