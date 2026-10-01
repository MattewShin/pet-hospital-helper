# 도케 · DOG CARE, TOGETHER

초대된 가족만 같은 가족 공간의 반려견과 건강 기록을 함께 관리하는 React/Vite 앱입니다. 로그인·공유 데이터는 Supabase Auth/PostgreSQL에 저장하고, 브라우저의 기존 도케 데이터는 사용자가 동의할 때 한 번만 이전합니다.

## 구현 범위

- 이메일 회원가입·로그인과 Google·네이버·카카오 OAuth, 로그아웃
- 반려견 전환 메뉴에서 진입하는 내 계정 표시 이름·소셜 아바타 관리
- 가족 공간 생성과 OWNER/MEMBER 역할
- 관리자 초대·초대 취소·구성원 내보내기, 초대받은 사용자의 수락
- 가족 공간별 다견 프로필과 반려견별 타임라인·병원 기록·진료 브리핑 분리
- 기록 작성자와 작성 시각 저장·표시
- 비공개 Storage 버킷의 반려견/기록 사진
- 기존 `localStorage` 프로필·타임라인·병원 기록의 동의 기반 1회 이전
- RLS를 통한 가족 공간 간 데이터 격리

## 1. Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 [`supabase/migrations/202610010001_initial_doke_schema.sql`](supabase/migrations/202610010001_initial_doke_schema.sql)을 실행합니다. 기존 프로젝트라면 [`supabase/migrations/202610010002_social_auth_profiles.sql`](supabase/migrations/202610010002_social_auth_profiles.sql), [`supabase/migrations/202610010003_user_account_profile.sql`](supabase/migrations/202610010003_user_account_profile.sql) 순서로 실행합니다.
3. Authentication → Providers에서 Email 로그인을 켭니다.
4. Authentication → URL Configuration에서 다음을 설정합니다.
   - Site URL: 실제 Vercel 주소(예: `https://doke.example.com`)
   - Redirect URLs: 로컬 주소와 Vercel 주소(예: `http://localhost:5173/**`, `https://doke.example.com/**`)
5. 실제 초대 메일 발송이 필요하면 Authentication → SMTP Settings에 운영용 SMTP를 설정합니다. Supabase 기본 메일 발송은 개발/요율 제한이 있을 수 있습니다.

마이그레이션은 `profiles`, `households`, `household_members`, `invitations`, `pets`, `timeline_records`, `hospital_records`, `data_migrations` 테이블과 비공개 `pet-media` 버킷을 만듭니다.

### RLS 요약

- `households`, `pets`, 기록 및 사진: 해당 가족 공간의 `ACTIVE` 구성원만 조회
- 반려견 추가·수정: `OWNER`만 허용
- 타임라인·병원 기록 추가: `OWNER`와 `MEMBER` 모두 허용
- 기록 수정·삭제: 작성자 또는 `OWNER`만 허용
- 구성원/초대 관리: `OWNER`만 허용
- 초대 수락 전 사용자는 본인 이메일의 초대 정보와 가족 공간 이름만 확인 가능하며 반려견·기록은 조회 불가
- 다른 가족 공간의 UUID를 직접 호출해도 RLS가 조회·등록·수정을 차단

## 2. 환경 변수

`.env.example`을 `.env.local`로 복사합니다.

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`VITE_SUPABASE_URL`과 anon key는 브라우저 공개 값이며, 데이터 보호는 RLS가 담당합니다.

공급자 설정을 완료한 뒤 사용할 버튼만 켭니다. `false`인 공급자는 로그인 화면에 표시되지 않습니다.

```bash
VITE_AUTH_GOOGLE_ENABLED=true
VITE_AUTH_NAVER_ENABLED=true
VITE_AUTH_KAKAO_ENABLED=true
```

`SUPABASE_SERVICE_ROLE_KEY`는 초대 메일을 보내는 `api/invitations.js`에서만 사용합니다. 신규 Supabase Secret key를 사용하는 프로젝트는 같은 서버 함수에서 `SUPABASE_SECRET_KEY` 이름도 지원합니다. 둘 중 하나만 설정하고, 이 값에는 `VITE_` 접두사를 붙이거나 `src/` 코드에 넣으면 안 됩니다.

## 3. 소셜 로그인 공급자 설정

### Google

1. Google Cloud Console에서 OAuth 동의 화면을 구성하고 **Web application** OAuth Client를 만듭니다.
2. Authorized JavaScript origins에 로컬/운영 앱 주소(예: `http://localhost:5173`, `https://doke.example.com`)를 추가합니다.
3. Authorized redirect URI에는 Supabase Dashboard → Authentication → Providers → Google에 표시되는 `https://<project-ref>.supabase.co/auth/v1/callback`을 정확히 추가합니다.
4. Google Client ID/Secret은 Supabase의 Google Provider에만 넣고 Provider를 켭니다. 별도 Google API scope는 추가하지 않습니다.
5. 앱 환경 변수의 `VITE_AUTH_GOOGLE_ENABLED=true`를 설정하고 다시 빌드합니다.

### 카카오

1. Kakao Developers에서 애플리케이션을 만들고 카카오 로그인을 활성화합니다.
2. 동의 항목에서 닉네임과 이메일을 설정합니다. 이메일 동의가 불가능한 앱 상태라면 도케 로그인을 켜지 않습니다.
3. Redirect URI에는 Supabase Kakao Provider 화면에 표시되는 `https://<project-ref>.supabase.co/auth/v1/callback`을 등록합니다.
4. 카카오의 **REST API 키**를 Client ID로, 카카오 로그인 Client Secret을 Client Secret으로 Supabase Dashboard → Authentication → Providers → Kakao에 입력합니다.
5. Supabase의 **Allow users without an email** 옵션은 끈 상태로 유지하고 `VITE_AUTH_KAKAO_ENABLED=true`를 설정합니다.

### 네이버

Supabase 기본 소셜 공급자 목록에는 네이버가 없으므로 Authentication → Providers의 **Custom OAuth Providers**에서 `custom:naver`를 만듭니다. 별도 브라우저 콜백이나 `localStorage` 세션을 만들지 않고, Supabase가 OAuth state/PKCE와 토큰 교환을 서버에서 처리합니다.

1. Naver Developers에서 **네이버 로그인** 애플리케이션을 만들고 이메일을 필수 제공 정보로 신청합니다.
2. Supabase Custom OAuth Provider를 Manual configuration으로 만들고 identifier를 `naver`로 지정합니다.
3. Authorization URL은 `https://nid.naver.com/oauth2.0/authorize`, Token URL은 `https://nid.naver.com/oauth2.0/token`으로 설정합니다.
4. UserInfo URL은 운영 앱의 `https://doke.example.com/api/auth/naver/userinfo`로 설정합니다. 이 서버 함수는 Supabase가 전달한 Bearer token으로 네이버 프로필을 확인하고, 이메일이 없는 응답을 거부한 뒤 중첩 응답을 표준 claim으로 변환합니다.
5. Attribute mapping은 `sub → sub`, `email → email`, `name → name`, `nickname → nickname`, `picture → picture`로 설정합니다. **Email optional**은 켜지 않습니다.
6. Supabase가 표시하는 Callback URL을 Naver Developers의 Callback URL에 등록하고, Naver Client ID/Secret은 Custom OAuth Provider 설정에만 저장합니다.
7. 설정 후 `VITE_AUTH_NAVER_ENABLED=true`를 설정합니다.

네이버 API는 별도의 `email_verified` claim을 제공하지 않습니다. 따라서 서버 함수는 이를 임의로 `true`로 만들지 않으며, Supabase가 확인된 이메일 세션을 만들지 못하면 앱이 로그인 완료를 거부합니다. 기존 계정과 같은 **확인된 이메일**은 Supabase의 자동 identity linking 대상이 되고, DB의 정규화 이메일 고유 인덱스도 중복 프로필 생성을 차단합니다. 충돌 시 새 가족 공간을 자동 생성하지 않고 로그인 오류를 표시합니다.

이 구성에서는 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `OAUTH_STATE_SECRET`을 Vercel 환경 변수로 사용하지 않습니다. Client ID/Secret은 Supabase Custom OAuth Provider의 암호화된 설정에 저장하고 state/PKCE 검증도 Supabase Auth가 담당합니다. Custom OAuth Provider를 사용할 수 없는 프로젝트에서는 불완전한 자체 콜백으로 대체하지 말고 네이버 플래그를 `false`로 유지합니다.

`api/auth/naver/userinfo.js`는 Vercel에서 실행되므로 `npm run dev` 주소를 UserInfo URL로 등록할 수 없습니다. 네이버 로그인을 로컬 앱에서 시험할 때도 배포된 HTTPS 함수 주소를 사용하거나 `vercel dev`를 외부 HTTPS 터널로 노출해야 합니다. 토큰·응답은 캐시하거나 로그로 남기지 않습니다.

### Redirect URL 공통 설정

Supabase Dashboard → Authentication → URL Configuration에서 다음처럼 실제 사용하는 주소를 모두 허용합니다.

- 로컬: `http://localhost:5173/**`
- Vercel Production: `https://doke.example.com/**`
- Vercel Preview: 필요한 팀 도메인 패턴(예: `https://*-team.vercel.app/**`)

OAuth 후 `redirectTo`는 현재 앱 origin과 path를 사용하며, 초대 링크의 `invitation` 값도 보존합니다. 따라서 초대받은 이메일과 같은 확인된 소셜 계정으로 로그인하면 기존 초대 수락 화면이 이어집니다.

## 4. 로컬 실행

일반 화면과 데이터 기능:

```bash
npm install
npm run dev
```

`npm run dev`는 Vite만 실행하므로 `/api/invitations` 서버리스 함수는 제공하지 않습니다. 로컬에서 실제 초대 메일까지 확인하려면 Vercel CLI로 실행하고 아래 서버 환경 변수도 설정합니다.

```bash
vercel dev
```

Supabase 프로젝트가 연결되지 않은 경우 앱은 기존 건강 데이터를 노출하지 않고 설정 안내 화면만 표시합니다.

## 5. Vercel 배포

Vercel 프로젝트의 Settings → Environment Variables에 다음을 설정합니다.

| 변수 | 노출 범위 | 설명 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 클라이언트 | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | 클라이언트 | Supabase anon key |
| `VITE_AUTH_GOOGLE_ENABLED` | 클라이언트 | Google 설정 완료 시 `true` |
| `VITE_AUTH_NAVER_ENABLED` | 클라이언트 | Naver Custom OAuth 설정 완료 시 `true` |
| `VITE_AUTH_KAKAO_ENABLED` | 클라이언트 | Kakao 설정 완료 시 `true` |
| `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEY` | 서버 전용 | 초대 사용자 이메일 발송용. 절대 클라이언트에 노출하지 않음 |
| `APP_URL` | 서버 | 배포 주소. 예: `https://doke.example.com` |

Build Command는 `npm run build`, Output Directory는 `dist`입니다. 환경 변수를 추가하거나 변경한 뒤에는 다시 배포합니다.

Production, Preview, Development에 각각 실제로 사용할 URL과 공개 플래그를 설정합니다. Supabase URL/anon key는 세 환경에서 같은 프로젝트를 사용할 수 있지만 운영 데이터 분리가 필요하면 Supabase 프로젝트도 분리합니다. 비밀 키는 서버 함수가 필요한 환경에만 설정하고 Preview URL도 Supabase Redirect URLs와 각 공급자 콘솔의 허용 목록에 포함합니다.

초대 API는 먼저 로그인 토큰과 요청자의 `OWNER + ACTIVE` 멤버십을 검증한 뒤 초대 레코드를 생성합니다. SMTP/Auth 설정 문제로 메일 발송이 실패하면 성공한 것처럼 표시하지 않고, 초대 레코드 생성 여부와 메일 실패를 구분해 안내합니다. 이미 가입한 사용자는 이메일이 오지 않아도 로그인 후 `받은 초대`에서 수락할 수 있습니다.

## 6. 기존 춘식 데이터 이전

로그인 후 기존 도케 저장 키가 감지되면 `기존 춘식 기록을 내 가족 공간으로 옮길까요?` 안내가 표시됩니다.

1. 사용자가 동의하면 가족 공간을 생성합니다.
2. 기존 반려견마다 새 UUID를 만들고 기존 `petId` 연결을 변환합니다.
3. 프로필 사진, 타임라인, 병원 기록을 업로드합니다.
4. `data_migrations`에 `doke-local-v1` 완료 레코드를 남깁니다.
5. `(household_id, legacy_id)` / `(pet_id, legacy_id)` 고유 키로 재시도 시 중복 생성을 방지합니다.

원본 `localStorage`는 자동 삭제하지 않으므로 이전 실패 시 다시 시도할 수 있습니다. 사진 업로드가 실패한 항목은 텍스트 기록 이전을 계속하며, 브라우저 데이터 URL이나 오래된 참조는 가능한 범위에서만 유지됩니다.

## 7. 내 계정 확인

상단 또는 사이드바의 반려견 선택 영역을 열고 목록 아래의 `내 계정`을 선택합니다. 표시 이름은 `profiles.display_name`에 저장되며, 이메일은 수정할 수 없습니다. 소셜 로그인 공급자가 제공한 사진은 `profiles.avatar_url`에서 표시하고 사진이 없으면 표시 이름의 이니셜을 사용합니다.

## 보안 주의사항

- `.env`, `.env.local`과 실제 키는 Git에 커밋하지 않습니다.
- 클라이언트 화면에서 버튼을 숨기는 것만 권한 처리로 보지 않습니다. 모든 공유 테이블과 Storage 객체는 RLS 정책으로 보호됩니다.
- Supabase Dashboard의 RLS를 끄거나 서비스 역할 키를 브라우저에 노출하면 가족 공간 격리가 무력화됩니다.
