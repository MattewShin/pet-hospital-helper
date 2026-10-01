-- 반려견별 반복 식사 시간과 1회 급여량을 저장합니다.
create table if not exists public.meal_routines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  time_minutes smallint not null check (time_minutes between 0 and 1439),
  amount_grams numeric(7,1) not null check (amount_grams > 0 and amount_grams <= 999),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, time_minutes)
);

alter table public.meal_routines enable row level security;

create policy "meal_routines_select_member" on public.meal_routines for select to authenticated
  using (public.is_active_household_member(public.pet_household(pet_id)));
create policy "meal_routines_insert_owner" on public.meal_routines for insert to authenticated
  with check (created_by = auth.uid() and public.is_household_owner(public.pet_household(pet_id)));
create policy "meal_routines_update_owner" on public.meal_routines for update to authenticated
  using (public.is_household_owner(public.pet_household(pet_id)))
  with check (public.is_household_owner(public.pet_household(pet_id)));
create policy "meal_routines_delete_owner" on public.meal_routines for delete to authenticated
  using (public.is_household_owner(public.pet_household(pet_id)));

-- 전체 루틴 교체를 한 트랜잭션으로 처리해 저장 실패 시 기존 루틴이 사라지지 않게 합니다.
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
    where item.value->>'timeMinutes' is null
      or (item.value->>'timeMinutes')::integer not between 0 and 1439
      or item.value->>'amountGrams' is null
      or (item.value->>'amountGrams')::numeric <= 0
      or (item.value->>'amountGrams')::numeric > 999
  ) then
    raise exception 'Invalid meal routine value';
  end if;

  delete from public.meal_routines where pet_id = target_pet_id;
  insert into public.meal_routines (pet_id, created_by, time_minutes, amount_grams, sort_order)
  select
    target_pet_id,
    auth.uid(),
    (item.value->>'timeMinutes')::smallint,
    (item.value->>'amountGrams')::numeric,
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
  alter publication supabase_realtime add table public.meal_routines;
exception when duplicate_object then null; end $$;
