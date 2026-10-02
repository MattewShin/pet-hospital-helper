-- 식사 기록도 작성자 또는 가족 공간 관리자가 수정할 수 있게 합니다.
alter table public.meal_records enable row level security;

drop policy if exists "meal_records_update_author_or_owner" on public.meal_records;
create policy "meal_records_update_author_or_owner" on public.meal_records for update to authenticated
  using (
    public.is_active_household_member(public.pet_household(pet_id))
    and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id)))
  )
  with check (
    public.is_active_household_member(public.pet_household(pet_id))
    and (created_by = auth.uid() or public.is_household_owner(public.pet_household(pet_id)))
  );
