create extension if not exists pgcrypto;

do $$ begin
  create type public.household_role as enum ('OWNER', 'MEMBER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_status as enum ('ACTIVE', 'REMOVED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_unique_normalized_email on public.profiles (lower(email));

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'MEMBER',
  status public.member_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  role public.household_role not null default 'MEMBER' check (role = 'MEMBER'),
  status public.invitation_status not null default 'PENDING',
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_one_pending_email
  on public.invitations (household_id, lower(invited_email)) where status = 'PENDING';

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  photo_url text,
  breed text,
  sex text,
  birth_date date,
  weight numeric(6,2),
  neutered text,
  notes text,
  registration_number text,
  legacy_id text,
  created_at timestamptz not null default now(),
  unique (household_id, legacy_id)
);

create table if not exists public.timeline_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  record_type text not null,
  occurred_at timestamptz not null,
  details jsonb not null default '{}'::jsonb,
  photo_url text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, legacy_id)
);

create table if not exists public.meal_routines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  time_minutes smallint not null check (time_minutes between 0 and 1439),
  food_name text not null default '사료',
  amount_grams numeric(7,1) not null check (amount_grams > 0 and amount_grams <= 999),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, time_minutes)
);

create table if not exists public.meal_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  routine_id uuid,
  routine_time_minutes smallint check (routine_time_minutes is null or routine_time_minutes between 0 and 1439),
  created_by uuid not null references public.profiles(id),
  occurred_at timestamptz not null,
  local_date date not null,
  food_name text not null check (char_length(food_name) between 1 and 80),
  amount_grams numeric(7,1) check (amount_grams is null or amount_grams between 0 and 999),
  planned_amount_grams numeric(7,1) check (planned_amount_grams is null or planned_amount_grams between 0 and 999),
  status text not null check (status in ('confirmed', 'skipped')),
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists meal_records_one_routine_result_per_day
  on public.meal_records (routine_id, local_date) where routine_id is not null;
create index if not exists meal_records_pet_occurred_at
  on public.meal_records (pet_id, occurred_at desc);

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

create table if not exists public.hospital_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  visited_at timestamptz not null,
  hospital_name text,
  visit_reason text not null,
  details jsonb not null default '{}'::jsonb,
  prescription text,
  cost numeric(12,2),
  photo_url text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, legacy_id)
);

create table if not exists public.data_migrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null,
  migrated_at timestamptz not null default now(),
  unique (user_id, source)
);

create table if not exists public.pet_view_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  metric_ids text[] not null default array['weight', 'meal', 'activity']::text[],
  banner_theme text not null default 'green',
  updated_at timestamptz not null default now(),
  primary key (user_id, pet_id),
  check (cardinality(metric_ids) = 3),
  check (metric_ids <@ array['weight', 'meal', 'activity', 'vaccination', 'medication', 'appointment']::text[]),
  check (banner_theme in ('green', 'beige', 'sky'))
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare profile_name text;
declare profile_avatar text;
begin
  if new.email is null or btrim(new.email) = '' then raise exception 'A verified email is required'; end if;
  profile_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'nickname'), ''),
    split_part(new.email, '@', 1)
  );
  profile_avatar := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data->>'picture'), ''),
    nullif(btrim(new.raw_user_meta_data->>'profile_image'), '')
  );
  insert into public.profiles (id, display_name, email, avatar_url)
  values (new.id, profile_name, lower(new.email), profile_avatar)
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(nullif(public.profiles.avatar_url, ''), excluded.avatar_url);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, email, avatar_url, created_at)
select id, coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', raw_user_meta_data->>'nickname', split_part(email, '@', 1)), lower(email), coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', raw_user_meta_data->>'profile_image'), created_at
from auth.users
where email is not null
on conflict (id) do update set
  email = excluded.email,
  avatar_url = coalesce(nullif(public.profiles.avatar_url, ''), excluded.avatar_url);

create or replace function public.is_active_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and status = 'ACTIVE'
  );
$$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role = 'OWNER' and status = 'ACTIVE'
  );
$$;

create or replace function public.has_pending_household_invitation(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitations
    where household_id = target_household
      and lower(invited_email) = lower(coalesce(auth.jwt()->>'email', ''))
      and status = 'PENDING' and expires_at > now()
  );
$$;

create or replace function public.shares_household(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and mine.status = 'ACTIVE'
      and theirs.user_id = target_user and theirs.status = 'ACTIVE'
  );
$$;

create or replace function public.pet_household(target_pet uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.pets where id = target_pet;
$$;

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

create or replace function public.complete_health_routine(target_routine_id uuid, completion_local_date date, requested_next_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.health_routines%rowtype;
declare calculated_next_due date;
declare completion_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if completion_local_date is null then raise exception 'Completion date is required'; end if;
  select * into target from public.health_routines where id = target_routine_id for update;
  if target.id is null then raise exception 'Health routine not found'; end if;
  if not target.active then raise exception 'Health routine is inactive'; end if;
  if not public.is_active_household_member(public.pet_household(target.pet_id)) then raise exception 'Access denied'; end if;
  if target.recurrence_unit = 'once' then calculated_next_due := null;
  elsif requested_next_due_date is not null then calculated_next_due := requested_next_due_date;
  elsif target.recurrence_unit = 'day' then calculated_next_due := completion_local_date + target.recurrence_interval;
  elsif target.recurrence_unit = 'week' then calculated_next_due := completion_local_date + (target.recurrence_interval * 7);
  elsif target.recurrence_unit = 'month' then calculated_next_due := (completion_local_date + make_interval(months => target.recurrence_interval))::date;
  elsif target.recurrence_unit = 'year' then calculated_next_due := (completion_local_date + make_interval(years => target.recurrence_interval))::date;
  end if;
  insert into public.health_routine_completions (routine_id, pet_id, completed_by, completed_local_date, scheduled_for, next_due_date, title, category, medication_name, dosage, notes)
  values (target.id, target.pet_id, auth.uid(), completion_local_date, target.next_due_date, calculated_next_due, target.title, target.category, target.medication_name, target.dosage, target.notes)
  returning id into completion_id;
  update public.health_routines set last_completed_at = now(), next_due_date = coalesce(calculated_next_due, next_due_date), active = (recurrence_unit <> 'once'), updated_at = now() where id = target.id;
  return completion_id;
end;
$$;

create or replace function public.replace_meal_routines(target_pet_id uuid, routine_items jsonb)
returns setof public.meal_routines
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_household_owner(public.pet_household(target_pet_id)) then raise exception 'Only the household owner can manage meal routines'; end if;
  if routine_items is null or jsonb_typeof(routine_items) <> 'array' then raise exception 'Meal routines must be an array'; end if;
  if jsonb_array_length(routine_items) > 12 then raise exception 'Up to 12 meal routines are allowed'; end if;
  if exists (
    select 1 from jsonb_array_elements(routine_items) as item(value)
    where item.value->>'id' is null
      or item.value->>'timeMinutes' is null
      or (item.value->>'timeMinutes')::integer not between 0 and 1439
      or nullif(btrim(item.value->>'foodName'), '') is null
      or char_length(item.value->>'foodName') > 80
      or item.value->>'amountGrams' is null
      or (item.value->>'amountGrams')::numeric <= 0
      or (item.value->>'amountGrams')::numeric > 999
  ) then raise exception 'Invalid meal routine value'; end if;
  delete from public.meal_routines where pet_id = target_pet_id;
  insert into public.meal_routines (id, pet_id, created_by, time_minutes, food_name, amount_grams, active, sort_order)
  select (item.value->>'id')::uuid, target_pet_id, auth.uid(), (item.value->>'timeMinutes')::smallint, btrim(item.value->>'foodName'), (item.value->>'amountGrams')::numeric, coalesce((item.value->>'active')::boolean, true), (item.position - 1)::smallint
  from jsonb_array_elements(routine_items) with ordinality as item(value, position);
  return query select routine.* from public.meal_routines as routine where routine.pet_id = target_pet_id order by routine.time_minutes;
end;
$$;

create or replace function public.create_household(household_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.households (name, owner_id) values (trim(household_name), auth.uid()) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, auth.uid(), 'OWNER', 'ACTIVE');
  return new_household_id;
end;
$$;

create or replace function public.accept_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.invitations%rowtype;
declare current_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  current_email := lower(coalesce(auth.jwt()->>'email', ''));
  select * into target from public.invitations where id = invitation_id for update;
  if target.id is null or target.status <> 'PENDING' then raise exception 'Invitation is not pending'; end if;
  if target.expires_at <= now() then
    update public.invitations set status = 'EXPIRED' where id = invitation_id;
    return null;
  end if;
  if lower(target.invited_email) <> current_email then raise exception 'Invitation email does not match'; end if;
  insert into public.household_members (household_id, user_id, role, status)
  values (target.household_id, auth.uid(), target.role, 'ACTIVE')
  on conflict (household_id, user_id) do update set role = excluded.role, status = 'ACTIVE';
  update public.invitations set status = 'ACCEPTED' where id = invitation_id;
  return target.household_id;
end;
$$;

create or replace function public.protect_household_member_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_email text;
begin
  if new.household_id is distinct from old.household_id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.joined_at is distinct from old.joined_at then
    raise exception 'Membership identity and role are immutable';
  end if;
  if old.role = 'OWNER' and new.status is distinct from old.status then
    raise exception 'Owner membership cannot be removed';
  end if;
  if old.status = 'REMOVED' and new.status = 'ACTIVE' then
    select email into member_email from public.profiles where id = old.user_id;
    if not exists (
      select 1 from public.invitations
      where household_id = old.household_id
        and lower(invited_email) = lower(member_email)
        and status = 'PENDING' and expires_at > now()
    ) then
      raise exception 'A valid invitation is required to reactivate a member';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_household_member_update_trigger on public.household_members;
create trigger protect_household_member_update_trigger before update on public.household_members
for each row execute function public.protect_household_member_update();

create or replace function public.protect_invitation_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare jwt_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if new.household_id is distinct from old.household_id
    or lower(new.invited_email) is distinct from lower(old.invited_email)
    or new.role is distinct from old.role
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'Invitation identity is immutable';
  end if;
  if new.status = old.status then return new; end if;
  if old.status = 'PENDING' and new.status = 'REVOKED' and public.is_household_owner(old.household_id) then return new; end if;
  if old.status = 'PENDING' and new.status = 'ACCEPTED' and jwt_email = lower(old.invited_email) then return new; end if;
  if old.status = 'PENDING' and new.status = 'EXPIRED' and (jwt_email = lower(old.invited_email) or auth.role() = 'service_role') then return new; end if;
  raise exception 'Invalid invitation status transition';
end;
$$;

drop trigger if exists protect_invitation_update_trigger on public.invitations;
create trigger protect_invitation_update_trigger before update on public.invitations
for each row execute function public.protect_invitation_update();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;
alter table public.pets enable row level security;
alter table public.timeline_records enable row level security;
alter table public.meal_routines enable row level security;
alter table public.meal_records enable row level security;
alter table public.health_routines enable row level security;
alter table public.health_routine_completions enable row level security;
alter table public.hospital_records enable row level security;
alter table public.data_migrations enable row level security;
alter table public.pet_view_preferences enable row level security;

create policy "profiles_select_shared" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

create policy "households_select_member" on public.households for select to authenticated
  using (public.is_active_household_member(id) or public.has_pending_household_invitation(id));
create policy "households_update_owner" on public.households for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id) and owner_id = auth.uid());

create policy "members_select_household" on public.household_members for select to authenticated
  using (public.is_active_household_member(household_id));
create policy "members_update_owner" on public.household_members for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

create policy "invitations_select_owner_or_invitee" on public.invitations for select to authenticated
  using (public.is_household_owner(household_id) or lower(invited_email) = lower(coalesce(auth.jwt()->>'email', '')));
create policy "invitations_update_owner" on public.invitations for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

create policy "pets_select_member" on public.pets for select to authenticated
  using (public.is_active_household_member(household_id));
create policy "pets_insert_owner" on public.pets for insert to authenticated
  with check (public.is_household_owner(household_id));
create policy "pets_update_owner" on public.pets for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "pets_delete_owner" on public.pets for delete to authenticated
  using (public.is_household_owner(household_id));

create policy "meal_routines_select_member" on public.meal_routines for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_routines_insert_owner" on public.meal_routines for insert to authenticated
  with check (created_by = auth.uid() and public.is_household_owner(public.pet_household(pet_id)));
create policy "meal_routines_update_owner" on public.meal_routines for update to authenticated
  using (public.is_household_owner(public.pet_household(pet_id))) with check (public.is_household_owner(public.pet_household(pet_id)));
create policy "meal_routines_delete_owner" on public.meal_routines for delete to authenticated
  using (public.is_household_owner(public.pet_household(pet_id)));

create policy "meal_records_select_member" on public.meal_records for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_records_insert_member" on public.meal_records for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_records_delete_author_or_owner" on public.meal_records for delete to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))));

create policy "health_routines_select_member" on public.health_routines for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "health_routines_insert_member" on public.health_routines for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "health_routines_update_member" on public.health_routines for update to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)))
  with check (public.is_active_household_member(public.pet_household(pet_id)));
create policy "health_routine_completions_select_member" on public.health_routine_completions for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));

create policy "timeline_select_member" on public.timeline_records for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "timeline_insert_member" on public.timeline_records for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "timeline_update_author_or_owner" on public.timeline_records for update to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))))
  with check (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))));
create policy "timeline_delete_author_or_owner" on public.timeline_records for delete to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))));

create policy "hospital_select_member" on public.hospital_records for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "hospital_insert_member" on public.hospital_records for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "hospital_update_author_or_owner" on public.hospital_records for update to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))))
  with check (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))));
create policy "hospital_delete_author_or_owner" on public.hospital_records for delete to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)) and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id))));

create policy "migrations_select_self" on public.data_migrations for select to authenticated using (user_id = auth.uid());
create policy "migrations_insert_self" on public.data_migrations for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_household_member(household_id));
create policy "migrations_update_self" on public.data_migrations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_household_member(household_id));

create policy "pet_view_preferences_select_self" on public.pet_view_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "pet_view_preferences_insert_self" on public.pet_view_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "pet_view_preferences_update_self" on public.pet_view_preferences for update to authenticated
  using (user_id = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)))
  with check (user_id = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "pet_view_preferences_delete_self" on public.pet_view_preferences for delete to authenticated
  using (user_id = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));

insert into storage.buckets (id, name, public) values ('pet-media', 'pet-media', false)
on conflict (id) do update set public = false;
create policy "pet_media_select_members" on storage.objects for select to authenticated
  using (bucket_id = 'pet-media' and public.is_active_household_member(((storage.foldername(name))[1])::uuid));
create policy "pet_media_insert_members" on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-media'
    and public.is_active_household_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2]) = auth.uid()::text);
create policy "pet_media_update_owner" on storage.objects for update to authenticated
  using (bucket_id = 'pet-media' and owner_id = auth.uid()::text);
create policy "pet_media_delete_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'pet-media' and owner_id = auth.uid()::text);

revoke all on function public.is_active_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.has_pending_household_invitation(uuid) from public;
revoke all on function public.shares_household(uuid) from public;
revoke all on function public.pet_household(uuid) from public;
revoke all on function public.create_household(text) from public;
revoke all on function public.accept_invitation(uuid) from public;
revoke all on function public.replace_meal_routines(uuid, jsonb) from public;
revoke all on function public.complete_health_routine(uuid, date, date) from public;
grant execute on function public.is_active_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.has_pending_household_invitation(uuid) to authenticated;
grant execute on function public.shares_household(uuid) to authenticated;
grant execute on function public.pet_household(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.replace_meal_routines(uuid, jsonb) to authenticated;
grant execute on function public.complete_health_routine(uuid, date, date) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.pets;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.timeline_records;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.hospital_records;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.household_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.invitations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.meal_routines;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pet_view_preferences;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.health_routines;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.health_routine_completions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.meal_records;
exception when duplicate_object then null; end $$;
