-- 사용자 계정 화면에서 사용하는 소셜 프로필 이미지 URL을 저장합니다.
-- 이미지 업로드 파일이 아니라 신원 공급자가 제공한 공개 아바타 URL만 보관합니다.
alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  profile_name text;
  profile_avatar text;
begin
  if new.email is null or btrim(new.email) = '' then
    raise exception 'A verified email is required';
  end if;

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
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

update public.profiles as profile
set avatar_url = coalesce(
  nullif(btrim(auth_user.raw_user_meta_data->>'avatar_url'), ''),
  nullif(btrim(auth_user.raw_user_meta_data->>'picture'), ''),
  nullif(btrim(auth_user.raw_user_meta_data->>'profile_image'), '')
)
from auth.users as auth_user
where profile.id = auth_user.id
  and (profile.avatar_url is null or btrim(profile.avatar_url) = '');

alter table public.profiles enable row level security;

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
