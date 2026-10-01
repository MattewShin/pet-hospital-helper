-- 식사 예정(루틴)과 보호자가 확인한 실제 식사 결과를 분리합니다.
alter table public.meal_routines
  add column if not exists food_name text not null default '사료',
  add column if not exists active boolean not null default true;

create table if not exists public.meal_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  -- 루틴 삭제 후에도 당시 참조 값을 보존하기 위해 의도적으로 FK를 걸지 않습니다.
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

alter table public.meal_records enable row level security;

drop policy if exists "meal_records_select_member" on public.meal_records;
drop policy if exists "meal_records_insert_member" on public.meal_records;
drop policy if exists "meal_records_delete_author_or_owner" on public.meal_records;
create policy "meal_records_select_member" on public.meal_records for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_records_insert_member" on public.meal_records for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_records_delete_author_or_owner" on public.meal_records for delete to authenticated
  using (
    public.is_active_household_member(public.pet_household(pet_id))
    and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id)))
  );

-- 기존 ID를 다시 사용해 오늘 연결된 결과 상태를 유지하면서 루틴 내용만 교체합니다.
create or replace function public.replace_meal_routines(target_pet_id uuid, routine_items jsonb)
returns setof public.meal_routines
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_household_owner(public.pet_household(target_pet_id)) then
    raise exception 'Only the household owner can manage meal routines';
  end if;
  if routine_items is null or jsonb_typeof(routine_items) <> 'array' then
    raise exception 'Meal routines must be an array';
  end if;
  if jsonb_array_length(routine_items) > 12 then
    raise exception 'Up to 12 meal routines are allowed';
  end if;
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
  ) then
    raise exception 'Invalid meal routine value';
  end if;

  delete from public.meal_routines where pet_id = target_pet_id;
  insert into public.meal_routines (id, pet_id, created_by, time_minutes, food_name, amount_grams, active, sort_order)
  select
    (item.value->>'id')::uuid,
    target_pet_id,
    auth.uid(),
    (item.value->>'timeMinutes')::smallint,
    btrim(item.value->>'foodName'),
    (item.value->>'amountGrams')::numeric,
    coalesce((item.value->>'active')::boolean, true),
    (item.position - 1)::smallint
  from jsonb_array_elements(routine_items) with ordinality as item(value, position);

  return query
    select routine.* from public.meal_routines as routine
    where routine.pet_id = target_pet_id
    order by routine.time_minutes;
end;
$$;

revoke all on function public.replace_meal_routines(uuid, jsonb) from public;
grant execute on function public.replace_meal_routines(uuid, jsonb) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.meal_records;
exception when duplicate_object then null; end $$;
