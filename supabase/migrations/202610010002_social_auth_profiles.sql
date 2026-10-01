-- 이메일 로그인과 소셜 로그인이 같은 profiles/권한 구조를 사용하도록
-- 공급자별 사용자 이름 claim을 안전하게 정규화합니다.
create unique index if not exists profiles_unique_normalized_email on public.profiles (lower(email));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  profile_name text;
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

  insert into public.profiles (id, display_name, email)
  values (new.id, profile_name, lower(new.email))
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();
