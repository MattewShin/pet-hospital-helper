-- 대표 상태 배너의 사용자별·반려견별 화면 환경설정입니다.
-- 건강 데이터와 분리하며 다른 가족 구성원의 설정에는 영향을 주지 않습니다.
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

alter table public.pet_view_preferences enable row level security;

drop policy if exists "pet_view_preferences_select_self" on public.pet_view_preferences;
drop policy if exists "pet_view_preferences_insert_self" on public.pet_view_preferences;
drop policy if exists "pet_view_preferences_update_self" on public.pet_view_preferences;
drop policy if exists "pet_view_preferences_delete_self" on public.pet_view_preferences;

create policy "pet_view_preferences_select_self" on public.pet_view_preferences for select to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_household_member(public.pet_household(pet_id))
  );
create policy "pet_view_preferences_insert_self" on public.pet_view_preferences for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_household_member(public.pet_household(pet_id))
  );
create policy "pet_view_preferences_update_self" on public.pet_view_preferences for update to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_household_member(public.pet_household(pet_id))
  )
  with check (
    user_id = auth.uid()
    and public.is_active_household_member(public.pet_household(pet_id))
  );
create policy "pet_view_preferences_delete_self" on public.pet_view_preferences for delete to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_household_member(public.pet_household(pet_id))
  );

do $$ begin
  alter publication supabase_realtime add table public.pet_view_preferences;
exception when duplicate_object then null; end $$;
