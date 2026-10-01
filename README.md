# 도케 · DOG CARE, TOGETHER

초대된 가족만 같은 가족 공간의 반려견과 건강 기록을 함께 관리하는 React/Vite 앱입니다. 로그인·공유 데이터는 Supabase Auth/PostgreSQL에 저장하고, 브라우저의 기존 도케 데이터는 사용자가 동의할 때 한 번만 이전합니다.

## 구현 범위

- 이메일 회원가입·로그인, 로그아웃
- 가족 공간 생성과 OWNER/MEMBER 역할
- 관리자 초대·초대 취소·구성원 내보내기, 초대받은 사용자의 수락
- 가족 공간별 다견 프로필과 반려견별 타임라인·병원 기록·진료 브리핑 분리
- 기록 작성자와 작성 시각 저장·표시
- 비공개 Storage 버킷의 반려견/기록 사진
- 기존 `localStorage` 프로필·타임라인·병원 기록의 동의 기반 1회 이전
- RLS를 통한 가족 공간 간 데이터 격리

## 1. Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 [`supabase/migrations/202610010001_initial_doke_schema.sql`](supabase/migrations/202610010001_initial_doke_schema.sql)을 실행합니다.
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

`SUPABASE_SERVICE_ROLE_KEY`는 초대 메일을 보내는 `api/invitations.js`에서만 사용합니다. 이 값에는 `VITE_` 접두사를 붙이거나 `src/` 코드에 넣으면 안 됩니다.

## 3. 로컬 실행

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

## 4. Vercel 배포

Vercel 프로젝트의 Settings → Environment Variables에 다음을 설정합니다.

| 변수 | 노출 범위 | 설명 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 클라이언트 | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | 클라이언트 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 | 초대 사용자 이메일 발송용. 절대 클라이언트에 노출하지 않음 |
| `APP_URL` | 서버 | 배포 주소. 예: `https://doke.example.com` |

Build Command는 `npm run build`, Output Directory는 `dist`입니다. 환경 변수를 추가하거나 변경한 뒤에는 다시 배포합니다.

초대 API는 먼저 로그인 토큰과 요청자의 `OWNER + ACTIVE` 멤버십을 검증한 뒤 초대 레코드를 생성합니다. SMTP/Auth 설정 문제로 메일 발송이 실패하면 성공한 것처럼 표시하지 않고, 초대 레코드 생성 여부와 메일 실패를 구분해 안내합니다. 이미 가입한 사용자는 이메일이 오지 않아도 로그인 후 `받은 초대`에서 수락할 수 있습니다.

## 5. 기존 춘식 데이터 이전

로그인 후 기존 도케 저장 키가 감지되면 `기존 춘식 기록을 내 가족 공간으로 옮길까요?` 안내가 표시됩니다.

1. 사용자가 동의하면 가족 공간을 생성합니다.
2. 기존 반려견마다 새 UUID를 만들고 기존 `petId` 연결을 변환합니다.
3. 프로필 사진, 타임라인, 병원 기록을 업로드합니다.
4. `data_migrations`에 `doke-local-v1` 완료 레코드를 남깁니다.
5. `(household_id, legacy_id)` / `(pet_id, legacy_id)` 고유 키로 재시도 시 중복 생성을 방지합니다.

원본 `localStorage`는 자동 삭제하지 않으므로 이전 실패 시 다시 시도할 수 있습니다. 사진 업로드가 실패한 항목은 텍스트 기록 이전을 계속하며, 브라우저 데이터 URL이나 오래된 참조는 가능한 범위에서만 유지됩니다.

## 보안 주의사항

- `.env`, `.env.local`과 실제 키는 Git에 커밋하지 않습니다.
- 클라이언트 화면에서 버튼을 숨기는 것만 권한 처리로 보지 않습니다. 모든 공유 테이블과 Storage 객체는 RLS 정책으로 보호됩니다.
- Supabase Dashboard의 RLS를 끄거나 서비스 역할 키를 브라우저에 노출하면 가족 공간 격리가 무력화됩니다.
