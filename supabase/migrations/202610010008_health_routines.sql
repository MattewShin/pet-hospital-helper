-- 비정기 예방 관리의 예정 정보와 실제 완료 이력을 분리합니다.
create table if not exists public.health_routines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 80),
  category text not null check (category in ('heartworm', 'parasite', 'vaccination', 'checkup', 'grooming', 'other')),
  next_due_date date not null,
  recurrence_unit text not null default 'once' check (recurrence_unit in ('once', 'day', 'week', 'month', 'year')),
  recurrence_interval smallint not null default 1 check (recurrence_interval between 1 and 365),
  reminder_days smallint[] not null default array[0]::smallint[],
  medication_name text,
  dosage text,
  notes text,
  active boolean not null default true,
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(reminder_days) between 1 and 4),
  check (reminder_days <@ array[0, 1, 3, 7]::smallint[])
);
create index if not exists health_routines_pet_due_date
  on public.health_routines (pet_id, active, next_due_date);

create table if not exists public.health_routine_completions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now(),
  completed_local_date date not null,
  scheduled_for date not null,
  next_due_date date,
  title text not null,
  category text not null,
  medication_name text,
  dosage text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists health_routine_completions_pet_completed_at
  on public.health_routine_completions (pet_id, completed_at desc);

create or replace function public.protect_health_routine_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.pet_id is distinct from old.pet_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Health routine identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_health_routine_identity_trigger on public.health_routines;
create trigger protect_health_routine_identity_trigger before update on public.health_routines
for each row execute function public.protect_health_routine_identity();

create or replace function public.complete_health_routine(
  target_routine_id uuid,
  completion_local_date date,
  requested_next_due_date date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target public.health_routines%rowtype;
  calculated_next_due date;
  completion_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if completion_local_date is null then raise exception 'Completion date is required'; end if;

  select * into target from public.health_routines where id = target_routine_id for update;
  if target.id is null then raise exception 'Health routine not found'; end if;
  if not target.active then raise exception 'Health routine is inactive'; end if;
  if not public.is_active_household_member(public.pet_household(target.pet_id)) then raise exception 'Access denied'; end if;

  if target.recurrence_unit = 'once' then
    calculated_next_due := null;
  elsif requested_next_due_date is not null then
    calculated_next_due := requested_next_due_date;
  elsif target.recurrence_unit = 'day' then
    calculated_next_due := completion_local_date + target.recurrence_interval;
  elsif target.recurrence_unit = 'week' then
    calculated_next_due := completion_local_date + (target.recurrence_interval * 7);
  elsif target.recurrence_unit = 'month' then
    calculated_next_due := (completion_local_date + make_interval(months => target.recurrence_interval))::date;
  elsif target.recurrence_unit = 'year' then
    calculated_next_due := (completion_local_date + make_interval(years => target.recurrence_interval))::date;
  end if;

  insert into public.health_routine_completions (
    routine_id, pet_id, completed_by, completed_local_date, scheduled_for, next_due_date,
    title, category, medication_name, dosage, notes
  ) values (
    target.id, target.pet_id, auth.uid(), completion_local_date, target.next_due_date, calculated_next_due,
    target.title, target.category, target.medication_name, target.dosage, target.notes
  ) returning id into completion_id;

  update public.health_routines
  set last_completed_at = now(),
      next_due_date = coalesce(calculated_next_due, next_due_date),
      active = (recurrence_unit <> 'once'),
      updated_at = now()
  where id = target.id;

  return completion_id;
end;
$$;

alter table public.health_routines enable row level security;
alter table public.health_routine_completions enable row level security;

drop policy if exists "health_routines_select_member" on public.health_routines;
drop policy if exists "health_routines_insert_member" on public.health_routines;
drop policy if exists "health_routines_update_member" on public.health_routines;
drop policy if exists "health_routine_completions_select_member" on public.health_routine_completions;

create policy "health_routines_select_member" on public.health_routines for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "health_routines_insert_member" on public.health_routines for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "health_routines_update_member" on public.health_routines for update to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)))
  with check (public.is_active_household_member(public.pet_household(pet_id)));

create policy "health_routine_completions_select_member" on public.health_routine_completions for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));

revoke all on function public.complete_health_routine(uuid, date, date) from public;
grant execute on function public.complete_health_routine(uuid, date, date) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.health_routines;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.health_routine_completions;
exception when duplicate_object then null; end $$;
