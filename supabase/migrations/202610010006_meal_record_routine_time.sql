-- 실제 식사 기록에 당시 루틴의 예정 시각을 복사해 보존합니다.
-- 이후 루틴 시간을 수정해도 과거 타임라인의 예정 시각은 바뀌지 않습니다.
alter table public.meal_records
  add column if not exists routine_time_minutes smallint
  check (routine_time_minutes is null or routine_time_minutes between 0 and 1439);

-- 006 적용 전에 저장된 루틴 식사 기록은 현재 연결된 루틴 시간으로 한 번 보정합니다.
update public.meal_records as meal
set routine_time_minutes = routine.time_minutes
from public.meal_routines as routine
where meal.routine_id = routine.id
  and meal.routine_time_minutes is null;
