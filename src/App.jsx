import React, { useEffect, useState } from 'react'
import { isSupabaseConfigured, socialAuthProviders, supabase } from './lib/supabase.js'
import { useDokeData } from './lib/doke-data.js'
import {
  Activity,
  Apple,
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Droplets,
  FileText,
  Footprints,
  HeartPulse,
  Home,
  LogOut,
  Mail,
  MapPin,
  MoreHorizontal,
  PawPrint,
  Pencil,
  Pill,
  Plus,
  ReceiptText,
  Scale,
  Save,
  Share2,
  Sparkles,
  Stethoscope,
  SlidersHorizontal,
  Thermometer,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

const defaultProfile = {
  name: '춘식',
  breed: '비숑 프리제',
  sex: '수컷',
  birthDate: '2025-03-30',
  weight: '4.2',
  neutered: '완료',
  allergies: '',
  registrationNumber: '',
  memo: '',
  photo: '',
}

function getAgeLabel(birthDate) {
  if (!birthDate) return '나이 미입력'
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
  if (today.getDate() < birth.getDate()) months -= 1
  if (months < 0 || Number.isNaN(months)) return '나이 미입력'
  const years = Math.floor(months / 12)
  const rest = months % 12
  return years > 0 ? `${years}년 ${rest}개월` : `${rest}개월`
}

function getCurrentTimeParts() {
  const now = new Date()
  const hour24 = now.getHours()
  return {
    period: hour24 >= 12 ? '오후' : '오전',
    hour: String(hour24 % 12 || 12),
    minute: String(now.getMinutes()).padStart(2, '0'),
  }
}

function formatTimeParts(period, hour, minute) {
  return `${period} ${Number(hour)}:${String(minute).padStart(2, '0')}`
}

function toTimeMinutes(period, hour, minute) {
  const hour12 = Number(hour) % 12
  return hour12 * 60 + Number(minute) + (period === '오후' ? 12 * 60 : 0)
}

function getTimePartsFromMinutes(timeMinutes) {
  const normalized = Math.max(0, Math.min(1439, Number(timeMinutes) || 0))
  const hour24 = Math.floor(normalized / 60)
  return {
    period: hour24 >= 12 ? '오후' : '오전',
    hour: String(hour24 % 12 || 12),
    minute: String(normalized % 60).padStart(2, '0'),
  }
}

function formatRoutineTime(timeMinutes) {
  const parts = getTimePartsFromMinutes(timeMinutes)
  return formatTimeParts(parts.period, parts.hour, parts.minute)
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getEventTimeMinutes(event) {
  if (Number.isFinite(event.routineTimeMinutes)) return event.routineTimeMinutes
  if (Number.isFinite(event.timeMinutes)) return event.timeMinutes
  const match = event.time?.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/)
  return match ? toTimeMinutes(match[1], match[2], match[3]) : -1
}

const symptoms = [
  { id: 'vomit', label: '구토', icon: Activity, color: 'coral', fields: [{ key: 'appearance', label: '상태', placeholder: '예: 노란색 거품' }, { key: 'amount', label: '양', placeholder: '예: 소량' }] },
  { id: 'meal', label: '식사', icon: Apple, color: 'green', fields: [{ key: 'appearance', label: '음식·사료', placeholder: '예: 건식 사료' }, { key: 'amount', label: '섭취량', placeholder: '예: 42g 또는 80%' }] },
  { id: 'medicine', label: '투약', icon: Pill, color: 'blue', fields: [{ key: 'appearance', label: '약 이름', placeholder: '예: 가스모틴' }, { key: 'amount', label: '용량', placeholder: '예: ½정' }] },
  { id: 'stool', label: '배변', icon: Sparkles, color: 'amber', fields: [{ key: 'appearance', label: '상태', placeholder: '예: 무른 변' }, { key: 'amount', label: '양', placeholder: '예: 보통' }] },
]

const additionalRecordTypes = [
  { id: 'water', label: '음수', icon: Droplets, color: 'blue', fields: [{ key: 'amount', label: '섭취량', placeholder: '예: 180ml' }, { key: 'appearance', label: '평소 대비', placeholder: '예: 평소와 비슷함' }] },
  { id: 'activity', label: '산책·활동', icon: Footprints, color: 'green', fields: [{ key: 'amount', label: '활동 시간·거리', placeholder: '예: 30분 또는 1.5km' }, { key: 'appearance', label: '활동 내용', placeholder: '예: 동네 산책' }] },
  { id: 'weight', label: '체중', icon: Scale, color: 'amber', fields: [{ key: 'amount', label: '체중', placeholder: '예: 4.2kg' }] },
  { id: 'condition', label: '컨디션', icon: HeartPulse, color: 'coral', fields: [{ key: 'appearance', label: '관찰한 상태', placeholder: '예: 평소처럼 활발함' }] },
]

const customRecordType = { id: 'custom', label: '직접 입력', icon: FileText, color: 'blue', fields: [] }
const recordTypes = [...symptoms, ...additionalRecordTypes, customRecordType]

const initialEvents = [
  {
    id: 1,
    type: 'vomit',
    title: '구토',
    time: '오늘 오전 8:42',
    detail: '노란색 거품 · 소량',
    note: '아침 식사 전, 기운은 평소와 비슷해요.',
    date: '오늘',
    author: 'Theo님',
  },
  {
    id: 2,
    type: 'meal',
    title: '아침 식사',
    time: '오늘 오전 7:10',
    detail: '사료 42g · 80% 섭취',
    note: '',
    date: '오늘',
    author: '배우자님',
  },
  {
    id: 3,
    type: 'medicine',
    title: '위장약 복용',
    time: '어제 오후 8:30',
    detail: '가스모틴 ½정',
    note: '저녁 식후 30분',
    date: '어제',
    author: 'Theo님',
  },
  {
    id: 4,
    type: 'vomit',
    title: '구토',
    time: '어제 오후 4:15',
    detail: '먹은 음식물 · 중간량',
    note: '산책 후 물을 급하게 마셨어요.',
    date: '어제',
    author: '배우자님',
  },
]

const initialHospitalRecords = [
  {
    id: 1,
    date: '2026. 09. 28',
    hospital: '다정한 동물병원',
    diagnosis: '급성 위염 의심',
    items: '진찰 · 복부 X-ray · 약 처방',
    amount: 86400,
    status: '진료 완료',
  },
  {
    id: 2,
    date: '2026. 09. 12',
    hospital: '다정한 동물병원',
    diagnosis: '정기 예방접종',
    items: '켄넬코프 · 건강검진',
    amount: 55000,
    status: '진료 완료',
  },
  {
    id: 3,
    date: '2026. 08. 19',
    hospital: '24시 봄 동물의료센터',
    diagnosis: '구토 및 탈수',
    items: '혈액검사 · 수액 처치',
    amount: 178200,
    status: '진료 완료',
  },
]

const STORAGE_KEYS = {
  pets: 'doke-pets-v1',
  selectedPetId: 'doke-selected-pet-id-v1',
  events: 'doke-events-v2',
  hospitalRecords: 'doke-hospital-records-v2',
  migrated: 'doke-multi-pet-migrated-v1',
}
const CHUNSIK_ID = 'pet-chunsik'

function parseStoredArray(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function loadInitialData() {
  const savedPets = parseStoredArray(STORAGE_KEYS.pets)

  if (savedPets?.length) {
    const savedSelectedId = window.localStorage.getItem(STORAGE_KEYS.selectedPetId)
    const selectedPetId = savedPets.some((pet) => pet.id === savedSelectedId) ? savedSelectedId : savedPets[0].id
    const savedEvents = (parseStoredArray(STORAGE_KEYS.events) || parseStoredArray('chunsik-care-events') || initialEvents).map((event) => ({ ...event, petId: event.petId || savedPets[0].id }))
    const savedHospitalRecords = (parseStoredArray(STORAGE_KEYS.hospitalRecords) || [...(parseStoredArray('doke-manual-hospital-records') || []), ...initialHospitalRecords]).map((record) => ({ ...record, petId: record.petId || savedPets[0].id }))
    return { pets: savedPets, selectedPetId, events: savedEvents, hospitalRecords: savedHospitalRecords }
  }

  let legacyProfile = defaultProfile
  try {
    const savedProfile = JSON.parse(window.localStorage.getItem('chunsik-care-profile') || 'null')
    const legacyPhoto = window.localStorage.getItem('chunsik-care-photo') || ''
    legacyProfile = savedProfile ? { ...defaultProfile, ...savedProfile } : { ...defaultProfile, photo: legacyPhoto }
  } catch {
    legacyProfile = defaultProfile
  }

  const chunsik = { ...legacyProfile, id: CHUNSIK_ID }
  const legacyEvents = parseStoredArray('chunsik-care-events') || initialEvents
  const events = legacyEvents.map((event, index) => ({
    ...event,
    petId: event.petId || CHUNSIK_ID,
    author: event.author || (index % 2 === 0 ? 'Theo님' : '배우자님'),
  }))
  const legacyManualRecords = parseStoredArray('doke-manual-hospital-records') || []
  const hospitalRecords = [...legacyManualRecords, ...initialHospitalRecords].map((record) => ({ ...record, petId: record.petId || CHUNSIK_ID }))

  return { pets: [chunsik], selectedPetId: CHUNSIK_ID, events, hospitalRecords }
}

const navItems = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'timeline', label: '타임라인', icon: Clock3 },
  { id: 'briefing', label: '진료 브리핑', icon: ClipboardList },
  { id: 'records', label: '병원 기록', icon: ReceiptText },
  { id: 'profile', label: '반려견 프로필', icon: UserRound },
  { id: 'family', label: '가족과 공유', icon: UsersRound },
]

const formatWon = (value) => `${value.toLocaleString('ko-KR')}원`
const honorificName = (value = '가족') => value.endsWith('님') ? value : `${value}님`

function App() {
  const [session, setSession] = useState(undefined)
  const [authNotice, setAuthNotice] = useState('')

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return undefined
    }
    const callbackUrl = new URL(window.location.href)
    const callbackError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error')
    if (callbackError) setAuthNotice(callbackError.replace(/\+/g, ' '))
    ;['error', 'error_code', 'error_description', 'oauth'].forEach((key) => callbackUrl.searchParams.delete(key))
    window.history.replaceState({}, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthNotice(error.message)
      else if (data.session?.user?.email && data.session.user.email_confirmed_at) setAuthNotice('')
      setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.user?.email && nextSession.user.email_confirmed_at) setAuthNotice('')
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const hasRequiredEmail = !session || Boolean(session.user?.email && session.user?.email_confirmed_at)

  useEffect(() => {
    if (!supabase || !session || hasRequiredEmail) return
    setAuthNotice('이메일 제공과 확인이 완료된 계정만 도케 가족 공유에 사용할 수 있어요. 소셜 계정의 이메일 제공 동의를 확인해 주세요.')
    let active = true
    supabase.auth.signOut({ scope: 'local' }).then(() => {
      if (active) setSession(null)
    })
    return () => { active = false }
  }, [session, hasRequiredEmail])

  if (!isSupabaseConfigured) return <ConfigurationScreen />
  if (session === undefined) return <AppLoading label="로그인 상태를 확인하고 있어요" />
  if (session && !hasRequiredEmail) return <AppLoading label="계정의 이메일 정보를 확인하고 있어요" />
  if (!session) return <AuthScreen notice={authNotice} />
  return <DokeApp session={session} />
}

function AppLoading({ label }) {
  return <main className="access-screen"><div className="access-card centered"><div className="brand-mark"><PawPrint size={22} /></div><h1>도케</h1><p>{label}</p><span className="loading-dot" /></div></main>
}

function ConfigurationScreen() {
  return (
    <main className="access-screen">
      <section className="access-card configuration-card">
        <div className="brand-lockup"><div className="brand-mark"><PawPrint size={22} /></div><div><strong>도케</strong><span>DOG CARE, TOGETHER</span></div></div>
        <h1>Supabase 연결이 필요해요</h1>
        <p>로그인과 가족 데이터 보호를 위해 로컬 저장소 화면은 열지 않습니다. 프로젝트 루트의 <code>.env.example</code>을 복사해 아래 공개 키를 설정해 주세요.</p>
        <pre>VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_ANON_KEY=...</pre>
        <small>초대 메일용 관리자 비밀 키는 Vercel 서버 환경 변수에만 설정하며 브라우저 코드에는 절대 넣지 마세요.</small>
      </section>
    </main>
  )
}

function ErrorScreen({ message, onRetry }) {
  return <main className="access-screen"><section className="access-card centered"><HeartPulse size={28} /><h1>데이터를 불러오지 못했어요</h1><p>{message}</p><button className="primary-button full" onClick={onRetry}>다시 시도</button></section></main>
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14Z" /><path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z" /></svg>
}

function NaverIcon() {
  return <span className="naver-symbol" aria-hidden="true">N</span>
}

function KakaoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.3 4.8 6.6l-1 3.6c-.1.3.2.5.5.3l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.5 10-7.8S17.5 3 12 3Z" /></svg>
}

const socialIcons = { google: GoogleIcon, naver: NaverIcon, kakao: KakaoIcon }

function getAuthRedirectUrl(extraParams = {}) {
  const redirectUrl = new URL(window.location.pathname || '/', window.location.origin)
  const invitationId = new URLSearchParams(window.location.search).get('invitation')
  if (invitationId) redirectUrl.searchParams.set('invitation', invitationId)
  Object.entries(extraParams).forEach(([key, value]) => redirectUrl.searchParams.set(key, value))
  return redirectUrl.toString()
}

function AuthScreen({ notice = '' }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(notice)
  const enabledProviders = socialAuthProviders.filter((item) => item.enabled)

  useEffect(() => {
    if (notice) setError(notice)
  }, [notice])

  const submit = async (event) => {
    event.preventDefault()
    setBusy('email')
    setError('')
    setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { display_name: form.displayName.trim() }, emailRedirectTo: getAuthRedirectUrl() },
        })
        if (authError) throw authError
        if (!data.session) setMessage('가입 확인 이메일을 보냈어요. 이메일 인증 후 로그인해 주세요.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
        if (authError) throw authError
      }
    } catch (authError) {
      setError(authError.message || '로그인 요청을 처리하지 못했어요.')
    } finally {
      setBusy('')
    }
  }

  const continueWithSocial = async (item) => {
    setBusy(item.id)
    setError('')
    setMessage('')
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: item.provider,
        options: { redirectTo: getAuthRedirectUrl({ oauth: item.id }) },
      })
      if (authError) throw authError
    } catch (authError) {
      setError(authError.message || `${item.label} 로그인을 시작하지 못했어요.`)
      setBusy('')
    }
  }

  return (
    <main className="access-screen">
      <section className="access-card auth-card">
        <div className="brand-lockup"><div className="brand-mark"><PawPrint size={22} /></div><div><strong>도케</strong><span>DOG CARE, TOGETHER</span></div></div>
        <div><p className="eyebrow">함께 보는 우리 반려견 건강 기록</p><h1>{mode === 'login' ? '다시 만나서 반가워요' : '같이 기록을 시작해요'}</h1></div>
        <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage('') }}>로그인</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage('') }}>회원가입</button></div>
        <form onSubmit={submit}>
          {mode === 'signup' && <label>이름<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="가족에게 표시할 이름" /></label>}
          <label>이메일<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></label>
          <label>비밀번호<input required minLength="6" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="6자 이상" /></label>
          {error && <p className="form-message error">{error}</p>}
          {message && <p className="form-message success">{message}</p>}
          <button className="primary-button full" disabled={Boolean(busy)}>{busy === 'email' ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}</button>
        </form>
        {enabledProviders.length > 0 && (
          <section className="social-login-section" aria-label="소셜 계정 로그인">
            <div className="auth-divider"><span>또는</span></div>
            <div className="social-login-list">
              {enabledProviders.map((item) => {
                const ProviderIcon = socialIcons[item.id]
                return (
                  <button key={item.id} type="button" className={`social-login-button ${item.id}`} disabled={Boolean(busy)} onClick={() => continueWithSocial(item)}>
                    <ProviderIcon />
                    <span>{busy === item.id ? '로그인 연결 중…' : `${item.label}로 계속하기`}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
        {import.meta.env.DEV && enabledProviders.length === 0 && <p className="oauth-dev-note">소셜 로그인은 <code>VITE_AUTH_*_ENABLED=true</code>로 설정한 공급자만 표시됩니다.</p>}
        <small className="access-note">로그인 전에는 반려견과 건강 데이터를 불러오지 않습니다.</small>
      </section>
    </main>
  )
}

function WorkspaceSetup({ session, workspace }) {
  const displayName = workspace.profile?.display_name || session.user.email?.split('@')[0] || '우리'
  const [name, setName] = useState(`${displayName}의 가족`)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const create = async (migrate = false) => {
    setBusy(migrate ? 'migrate' : 'create')
    setError('')
    try {
      const householdId = await workspace.actions.createHousehold(name.trim())
      if (migrate) await workspace.actions.migrateLegacy(householdId)
    } catch (actionError) {
      setError(actionError.message || '가족 공간을 만들지 못했어요.')
    } finally {
      setBusy('')
    }
  }

  const accept = async (id) => {
    setBusy(id)
    setError('')
    try { await workspace.actions.acceptInvitation(id) } catch (actionError) { setError(actionError.message || '초대를 수락하지 못했어요.') } finally { setBusy('') }
  }

  return (
    <main className="access-screen">
      <section className="access-card workspace-card">
        <div className="brand-lockup"><div className="brand-mark"><PawPrint size={22} /></div><div><strong>도케</strong><span>DOG CARE, TOGETHER</span></div></div>
        <h1>가족 공간을 선택해 주세요</h1>
        <p>활성 구성원만 이 공간의 모든 반려견과 건강 기록을 볼 수 있어요.</p>
        {workspace.pendingInvitations.length > 0 && <div className="pending-invite-list"><h2>받은 초대</h2>{workspace.pendingInvitations.map((invite) => <article key={invite.id}><div><strong>{invite.households?.name || '초대된 가족 공간'}</strong><span>{invite.invited_email} · {new Date(invite.expires_at).toLocaleDateString('ko-KR')}까지</span></div><button disabled={Boolean(busy)} onClick={() => accept(invite.id)}>{busy === invite.id ? '수락 중…' : '초대 수락'}</button></article>)}</div>}
        <div className="setup-divider"><span>또는 새로 만들기</span></div>
        <label className="setup-label">가족 공간 이름<input required value={name} onChange={(event) => setName(event.target.value)} maxLength="80" /></label>
        {error && <p className="form-message error">{error}</p>}
        {workspace.legacyAvailable ? (
          <div className="legacy-choice"><div><strong>기존 춘식 기록을 내 가족 공간으로 옮길까요?</strong><p>동의하면 가족 공간을 만든 뒤 이 브라우저의 로컬 기록을 한 번만 업로드해요.</p></div><button className="primary-button full" disabled={!name.trim() || Boolean(busy)} onClick={() => create(true)}>{busy === 'migrate' ? '옮기는 중…' : '가족 공간 만들고 기록 옮기기'}</button><button className="secondary-button" disabled={!name.trim() || Boolean(busy)} onClick={() => create(false)}>기록 없이 시작</button></div>
        ) : <button className="primary-button full" disabled={!name.trim() || Boolean(busy)} onClick={() => create(false)}>{busy === 'create' ? '만드는 중…' : '새 가족 공간 만들기'}</button>}
        <button className="text-action" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> 로그아웃</button>
      </section>
    </main>
  )
}

function EmptyPetState({ household, isOwner, onAdd, onLogout, sheet, closeSheet, onSave }) {
  return (
    <main className="access-screen">
      <section className="access-card centered">
        <div className="brand-mark"><PawPrint size={22} /></div>
        <p className="eyebrow">{household.name}</p><h1>등록된 반려견이 없어요</h1>
        <p>{isOwner ? '첫 반려견을 추가하면 가족과 건강 기록을 시작할 수 있어요.' : '가족 공간 관리자에게 반려견 등록을 요청해 주세요.'}</p>
        {isOwner && <button className="primary-button full" onClick={onAdd}><Plus size={17} /> 반려견 추가</button>}
        <button className="text-action" onClick={onLogout}><LogOut size={15} /> 로그아웃</button>
      </section>
      {sheet?.type === 'pet-add' && <AddPetSheet onClose={closeSheet} onSave={onSave} />}
    </main>
  )
}

function DokeApp({ session }) {
  const [activeTab, setActiveTab] = useState('home')
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const workspace = useDokeData(session)

  if (workspace.loading) return <AppLoading label="가족 공간을 불러오고 있어요" />
  if (workspace.error) return <ErrorScreen message={workspace.error} onRetry={workspace.actions.reload} />
  if (!workspace.household) return <WorkspaceSetup session={session} workspace={workspace} />

  const data = { pets: workspace.pets, selectedPetId: workspace.selectedPetId, events: workspace.events, hospitalRecords: workspace.hospitalRecords }

  const profile = data.pets.find((pet) => pet.id === data.selectedPetId) || data.pets[0]
  if (!profile) {
    return (
      <EmptyPetState
        household={workspace.household}
        isOwner={workspace.isOwner}
        onAdd={() => setSheet({ type: 'pet-add' })}
        onLogout={() => supabase.auth.signOut()}
        sheet={sheet}
        closeSheet={() => setSheet(null)}
        onSave={async (newPet) => {
          try {
            await workspace.actions.createPet({ ...defaultProfile, ...newPet })
            setSheet(null)
          } catch (error) {
            setToast(error.message || '반려견을 추가하지 못했어요')
          }
        }}
      />
    )
  }
  const events = data.events.filter((event) => event.petId === profile.id)
  const allHospitalRecords = data.hospitalRecords.filter((record) => record.petId === profile.id)
  const mealRoutines = workspace.mealRoutines.filter((routine) => routine.petId === profile.id).sort((a, b) => a.timeMinutes - b.timeMinutes)
  const todayMealRecords = events.filter((event) => event.source === 'meal_record' && event.localDate === getLocalDateKey())
  const vomitCount = events.filter((event) => event.type === 'vomit').length
  const totalSpent = allHospitalRecords.reduce((sum, record) => sum + (record.amount || 0), 0)

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const registerPetPhoto = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('이미지 파일을 선택해 주세요')
      return
    }
    try {
      const resized = await resizeImage(file)
      await workspace.actions.updatePet({ ...profile, photo: resized })
      notify(`${profile.name} 사진을 등록했어요`)
    } catch (error) {
      notify(error.message || '사진을 불러오지 못했어요')
    }
  }

  const addEvent = async (form) => {
    const recordType = recordTypes.find((item) => item.id === form.type) || customRecordType
    const observedValues = recordType.fields.map((field) => form[field.key]).filter(Boolean)
    const isCustom = form.type === 'custom'
    const occurredAt = new Date()
    occurredAt.setHours(Math.floor(form.timeMinutes / 60), form.timeMinutes % 60, 0, 0)
    try {
      if (form.type === 'meal') {
        const amountMatch = String(form.amount || '').match(/\d+(?:\.\d+)?/)
        await workspace.actions.createMealRecord({ petId: profile.id, routineId: form.routineId || null, routineTimeMinutes: form.routineTimeMinutes ?? null, occurredAt: occurredAt.toISOString(), localDate: getLocalDateKey(occurredAt), foodName: form.appearance.trim() || '음식 미입력', amountGrams: amountMatch ? Number(amountMatch[0]) : null, plannedAmountGrams: form.plannedAmountGrams == null ? (amountMatch ? Number(amountMatch[0]) : null) : Number(form.plannedAmountGrams), status: 'confirmed', note: form.note, photo: form.photo || '' })
      } else {
        await workspace.actions.createTimeline({ petId: profile.id, type: form.type, occurredAt: occurredAt.toISOString(), details: { title: isCustom ? form.title.trim() : recordType.label, detail: isCustom ? (form.note.trim() || '내용 미기록') : (observedValues.join(' · ') || '세부 내용 미기록'), note: isCustom ? '' : form.note }, photo: form.photo || '' })
      }
      setSheet(null)
      notify(`${isCustom ? form.title.trim() : recordType.label} 기록을 저장했어요`)
    } catch (error) {
      notify(error.message || '기록을 저장하지 못했어요')
    }
  }

  const confirmRoutineMeal = async (routine, status = 'confirmed') => {
    const now = new Date()
    try {
      await workspace.actions.createMealRecord({ petId: profile.id, routineId: routine.id, routineTimeMinutes: routine.timeMinutes, occurredAt: now.toISOString(), localDate: getLocalDateKey(now), foodName: routine.foodName, amountGrams: status === 'skipped' ? null : routine.amountGrams, plannedAmountGrams: routine.amountGrams, status, note: '', photo: '' })
      notify(status === 'skipped' ? '건너뛴 식사로 기록했어요' : `${routine.foodName} ${routine.amountGrams}g을 먹인 것으로 기록했어요`)
    } catch (error) {
      notify(error.message || '식사 확인 기록을 저장하지 못했어요')
      throw error
    }
  }

  const addManualHospitalRecord = async (form) => {
    const amount = form.cost ? Number(form.cost) : null
    try {
      await workspace.actions.createHospital({ petId: profile.id, visitedAt: new Date(`${form.visitDate}T12:00:00`).toISOString(), hospital: form.hospital.trim(), reason: form.reason.trim(), medication: form.medication.trim(), amount, photo: form.photo || '', details: { source: 'manual', status: '직접 기록', diagnosis: form.reason.trim(), opinion: form.opinion.trim(), treatment: form.treatment.trim(), items: form.treatment.trim() || '검사·처치 미입력', memo: form.memo.trim() } })
      setSheet(null)
      notify('병원 방문 기록을 저장했어요')
    } catch (error) {
      notify(error.message || '병원 기록을 저장하지 못했어요')
    }
  }

  const addScannedHospitalRecord = async (photo) => {
    const now = new Date()
    try {
      await workspace.actions.createHospital({ petId: profile.id, visitedAt: now.toISOString(), hospital: '', reason: '영수증·처방전 촬영', medication: '', amount: null, photo, details: { source: 'document', status: '서류 등록', diagnosis: '서류 내용을 확인해 주세요', items: '첨부 서류 1장' } })
      setSheet(null)
      notify(`${profile.name}의 병원 서류를 등록했어요`)
    } catch (error) {
      notify(error.message || '병원 서류를 등록하지 못했어요')
    }
  }

  const updateEvent = async (form) => {
    const record = sheet.event
    const occurredAt = new Date(record.occurredAt)
    occurredAt.setHours(Math.floor(form.timeMinutes / 60), form.timeMinutes % 60, 0, 0)
    try {
      await workspace.actions.updateTimeline({ id: record.id, occurredAt: occurredAt.toISOString(), details: { title: record.title, detail: form.detail.trim() || '세부 내용 미기록', note: form.note.trim() }, photo: form.photo, photoPath: record.photoPath })
      setSheet(null)
      notify('내 기록을 수정했어요')
    } catch (error) {
      notify(error.message || '기록을 수정하지 못했어요')
    }
  }

  const updateHospitalRecord = async (form) => {
    const record = sheet.record
    try {
      await workspace.actions.updateHospital({ id: record.id, visitedAt: new Date(`${form.visitDate}T12:00:00`).toISOString(), hospital: form.hospital.trim(), reason: form.reason.trim(), medication: form.medication.trim(), amount: form.cost ? Number(form.cost) : null, photo: form.photo, photoPath: record.photoPath, details: { source: record.source || 'manual', status: record.status || '직접 기록', diagnosis: form.reason.trim(), opinion: form.opinion.trim(), treatment: form.treatment.trim(), items: form.treatment.trim() || '검사·처치 미입력', memo: form.memo.trim() } })
      setSheet(null)
      notify('병원 기록을 수정했어요')
    } catch (error) {
      notify(error.message || '병원 기록을 수정하지 못했어요')
    }
  }

  const saveProfile = async (nextProfile) => {
    try {
      await workspace.actions.updatePet(nextProfile)
      notify('프로필을 저장했어요')
    } catch (error) {
      notify(error.message || '프로필을 저장하지 못했어요')
    }
  }

  const saveMealRoutines = async (routines) => {
    await workspace.actions.replaceMealRoutines(profile.id, routines)
    notify(`${profile.name}의 식사 루틴을 저장했어요`)
    setSheet(sheet?.returnTo === 'meal' ? { type: 'meal' } : null)
  }

  const closeMealRoutine = () => setSheet(sheet?.returnTo === 'meal' ? { type: 'meal' } : null)

  const openAccount = () => {
    setSheet(null)
    setActiveTab('account')
  }

  const addPet = async (newPet) => {
    try {
      await workspace.actions.createPet({ ...defaultProfile, ...newPet })
      setSheet(null)
      setActiveTab('home')
      notify(`${newPet.name} 프로필을 추가했어요`)
    } catch (error) {
      notify(error.message || '반려견을 추가하지 못했어요')
    }
  }

  const selectPet = (petId) => {
    try {
      workspace.actions.selectPet(petId)
      setSheet(null)
    } catch (error) {
      notify(error.message)
    }
  }

  const deleteEvent = async (id) => {
    try {
      const target = events.find((event) => event.id === id)
      if (target?.source === 'meal_record') await workspace.actions.deleteMealRecord(id)
      else await workspace.actions.deleteTimeline(id)
      notify('기록을 삭제했어요')
    } catch (error) {
      notify(error.message || '기록을 삭제하지 못했어요')
    }
  }

  const migrateLegacy = async () => {
    try {
      await workspace.actions.migrateLegacy()
      notify('기존 기록을 가족 공간으로 옮겼어요')
    } catch (error) {
      notify(error.message || '기존 기록을 옮기지 못했어요')
    }
  }

  const copyBriefing = async () => {
    const latestMedicine = events.find((event) => event.type === 'medicine')
    const latestHospital = allHospitalRecords[0]
    const text = `${profile.name} · ${profile.breed || '견종 미입력'} · ${profile.sex || '성별 미입력'} · ${getAgeLabel(profile.birthDate)} · ${profile.weight || '-'}kg\n중성화: ${profile.neutered || '미입력'} · 알레르기: ${profile.allergies || '기록 없음'}\n\n[최근 기록]\n- 최근 구토 ${vomitCount}회\n- 최근 투약: ${latestMedicine?.detail || '기록 없음'}\n- 최근 병원 방문: ${latestHospital ? `${latestHospital.date} ${latestHospital.reason || latestHospital.diagnosis}` : '기록 없음'}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      notify('진료 브리핑을 복사했어요')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      notify('복사하지 못했어요. 다시 시도해 주세요')
    }
  }

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="brand">
          <div className="brand-mark"><PawPrint size={21} strokeWidth={2.2} /></div>
          <div className="brand-copy">
            <strong>도케</strong>
            <span>DOG CARE, TOGETHER</span>
            <p>가족과 함께 기록하는<br />우리 강아지 건강관리</p>
          </div>
        </div>
        <button className="side-pet-card" onClick={() => setSheet({ type: 'pet-switcher' })}>
          <PetAvatar photo={profile.photo} name={profile.name} large />
          <div className="side-pet-copy">
            <strong>{profile.name}</strong>
            <p>{profile.breed} · {getAgeLabel(profile.birthDate)}</p>
          </div>
          <ChevronDown size={16} />
        </button>
        <nav className="side-nav" aria-label="주 메뉴">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
          ))}
        </nav>
        <div className="side-help">
          <HeartPulse size={20} />
          <strong>응급 상황인가요?</strong>
          <p>반복 구토와 무기력이 함께 나타나면 바로 병원에 문의하세요.</p>
          <button className="sidebar-logout" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> 로그아웃</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-brand">
          <div className="brand-mark"><PawPrint size={19} strokeWidth={2.2} /></div>
          <div className="brand-copy"><strong>도케</strong><span>DOG CARE, TOGETHER</span><p>가족과 함께 기록하는 우리 강아지 건강관리</p></div>
          <button className="mobile-pet-switch" onClick={() => setSheet({ type: 'pet-switcher' })}><PetAvatar photo={profile.photo} name={profile.name} /><span>{profile.name}</span><ChevronDown size={14} /></button>
        </div>
        {activeTab === 'home' && (
          <HomeScreen
            events={events}
            vomitCount={vomitCount}
            onQuickAdd={(type) => setSheet({ type })}
            onNavigate={setActiveTab}
            profile={profile}
            onScanDocument={() => setSheet({ type: 'receipt' })}
            memberCount={workspace.members.length}
            legacyAvailable={workspace.legacyAvailable && workspace.isOwner}
            onMigrate={migrateLegacy}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineScreen events={events} petName={profile.name} onChooseRecord={() => setSheet({ type: 'record-picker' })} onDelete={deleteEvent} onEdit={(event) => setSheet({ type: 'timeline-edit', event })} canEdit={(event) => event.source !== 'meal_record' && (workspace.isOwner || event.createdBy === session.user.id)} canDelete={(event) => workspace.isOwner || event.createdBy === session.user.id} />
        )}
        {activeTab === 'briefing' && (
          <BriefingScreen count={vomitCount} copied={copied} onCopy={copyBriefing} onPrint={() => window.print()} profile={profile} events={events} hospitalRecords={allHospitalRecords} />
        )}
        {activeTab === 'records' && (
          <RecordsScreen records={allHospitalRecords} total={totalSpent} onAdd={() => setSheet({ type: 'hospital-add-picker' })} onEdit={(record) => setSheet({ type: 'hospital-edit', record })} canEdit={(record) => workspace.isOwner || record.createdBy === session.user.id} />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen profile={profile} onSave={saveProfile} onPhotoChange={registerPetPhoto} canEdit={workspace.isOwner} mealRoutines={mealRoutines} onManageMealRoutines={() => setSheet({ type: 'meal-routine', returnTo: 'profile' })} />
        )}
        {activeTab === 'family' && (
          <FamilyShareScreen
            session={session}
            workspace={workspace}
            onInvite={() => setSheet({ type: 'family-invite' })}
            notify={notify}
          />
        )}
        {activeTab === 'account' && (
          <AccountScreen
            session={session}
            profile={workspace.profile}
            onBack={() => setActiveTab('home')}
            onSave={workspace.actions.updateAccountProfile}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
        ))}
      </nav>

      {sheet?.type === 'pet-switcher' ? (
        <PetSwitcherSheet pets={data.pets} selectedPetId={data.selectedPetId} onClose={() => setSheet(null)} onSelect={selectPet} onAdd={() => setSheet({ type: 'pet-add' })} canManage={workspace.isOwner} onAccount={openAccount} onLogout={() => supabase.auth.signOut()} />
      ) : sheet?.type === 'pet-add' ? (
        <AddPetSheet onClose={() => setSheet(null)} onSave={addPet} />
      ) : sheet?.type === 'family-invite' ? (
        <InviteFamilySheet session={session} workspace={workspace} onClose={() => setSheet(null)} />
      ) : sheet?.type === 'receipt' ? (
        <ReceiptSheet onClose={() => setSheet(null)} onSave={addScannedHospitalRecord} />
      ) : sheet?.type === 'record-picker' ? (
        <RecordTypeSheet petName={profile.name} onClose={() => setSheet(null)} onSelect={(type) => setSheet({ type })} />
      ) : sheet?.type === 'hospital-add-picker' ? (
        <HospitalAddSheet onClose={() => setSheet(null)} onSelect={(type) => setSheet({ type })} />
      ) : sheet?.type === 'hospital-manual' ? (
        <ManualHospitalSheet onClose={() => setSheet(null)} onSave={addManualHospitalRecord} />
      ) : sheet?.type === 'hospital-edit' ? (
        <ManualHospitalSheet initial={sheet.record} onClose={() => setSheet(null)} onSave={updateHospitalRecord} />
      ) : sheet?.type === 'timeline-edit' ? (
        <EditTimelineSheet event={sheet.event} onClose={() => setSheet(null)} onSave={updateEvent} />
      ) : sheet?.type === 'meal-routine' ? (
        <MealRoutineSheet petName={profile.name} routines={mealRoutines} focusRoutineId={sheet.focusRoutineId} onClose={closeMealRoutine} onSave={saveMealRoutines} />
      ) : sheet ? (
        <LogSheet type={sheet.type} onClose={() => setSheet(null)} onSave={addEvent} mealRoutines={mealRoutines} todayMealRecords={todayMealRecords} initialMeal={sheet.initialMeal || null} onConfirmRoutine={(routine) => confirmRoutineMeal(routine, 'confirmed')} onSkipRoutine={(routine) => confirmRoutineMeal(routine, 'skipped')} onModifyRoutine={workspace.isOwner ? (routine) => setSheet({ type: 'meal-routine', returnTo: 'meal', focusRoutineId: routine.id }) : null} onManageMealRoutines={workspace.isOwner ? () => setSheet({ type: 'meal-routine', returnTo: 'meal' }) : null} />
      ) : null}

      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  )
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const image = new Image()
      image.onerror = reject
      image.onload = () => {
        const maxSize = 512
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function PetAvatar({ photo, name = '반려견', large = false, onPhotoChange, profile = false }) {
  const content = photo ? <img src={photo} alt={`${name} 프로필`} /> : <span>{name.slice(0, 2)}</span>
  if (onPhotoChange) {
    return (
      <label className={`pet-avatar editable ${large ? 'large' : ''} ${profile ? 'profile-photo' : ''}`} title={`${name} 사진 등록 또는 변경`}>
        {content}
        <input type="file" accept="image/*" onChange={(event) => onPhotoChange(event.target.files?.[0])} />
        <i className="avatar-camera"><Camera size={profile ? 16 : 10} strokeWidth={2.5} /></i>
      </label>
    )
  }
  return <div className={`pet-avatar ${large ? 'large' : ''}`}>{content}</div>
}

function PetSwitcherSheet({ pets, selectedPetId, onClose, onSelect, onAdd, canManage, onAccount, onLogout }) {
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bottom-sheet pet-switcher-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header record-picker-header">
          <div><p>건강 기록 대상</p><h2>반려견 선택</h2><span>선택한 반려견의 기록만 화면에 표시돼요.</span></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <div className="pet-option-list">
          {pets.map((pet) => (
            <button key={pet.id} className={pet.id === selectedPetId ? 'selected' : ''} onClick={() => onSelect(pet.id)}>
              <PetAvatar photo={pet.photo} name={pet.name} large />
              <span><strong>{pet.name}</strong><small>{pet.breed || '견종 미입력'} · {getAgeLabel(pet.birthDate)}</small></span>
              {pet.id === selectedPetId ? <i><Check size={15} /> 선택됨</i> : <ChevronRight size={17} />}
            </button>
          ))}
        </div>
        {canManage && <button className="add-pet-button" onClick={onAdd}><Plus size={18} /> 반려견 추가</button>}
        <div className="pet-switcher-account-menu">
          <button type="button" onClick={onAccount}><UserRound size={18} /><span><strong>내 계정</strong><small>표시 이름과 로그인 정보를 확인해요.</small></span><ChevronRight size={17} /></button>
          <button type="button" className="logout" onClick={onLogout}><LogOut size={18} /><span><strong>로그아웃</strong><small>이 기기에서 도케 사용을 마쳐요.</small></span></button>
        </div>
      </div>
    </div>
  )
}

function AddPetSheet({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', photo: '', breed: '', sex: '', birthDate: '', weight: '', neutered: '', allergies: '', memo: '' })
  const [photoName, setPhotoName] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const attachPhoto = async (file) => {
    if (!file) return
    setPhotoName(file.name)
    try {
      update('photo', await resizeImage(file))
    } catch {
      setPhotoName('')
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet add-pet-sheet" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-icon green"><PawPrint size={21} /></div>
          <div><p>새로운 가족 등록</p><h2>반려견 추가</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <div className="add-pet-photo-row">
          <label className="pet-avatar editable profile-photo">
            {form.photo ? <img src={form.photo} alt="새 반려견 프로필 미리보기" /> : <PawPrint size={27} />}
            <input type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />
            <i className="avatar-camera"><Camera size={16} /></i>
          </label>
          <div><strong>대표 사진</strong><p>{photoName || '선택 사항 · 정사각형으로 자동 조정돼요.'}</p></div>
        </div>
        <label><span>이름 <em>필수</em></span><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="반려견 이름" /></label>
        <div className="form-columns">
          <label>견종<input value={form.breed} onChange={(event) => update('breed', event.target.value)} placeholder="예: 비숑 프리제" /></label>
          <label>성별<select value={form.sex} onChange={(event) => update('sex', event.target.value)}><option value="">선택 안 함</option><option>수컷</option><option>암컷</option></select></label>
          <label>생년월일<input type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label>
          <label>몸무게<div className="unit-input"><input type="number" min="0.1" step="0.1" value={form.weight} onChange={(event) => update('weight', event.target.value)} placeholder="4.2" /><span>kg</span></div></label>
          <label className="full-field">중성화 여부<select value={form.neutered} onChange={(event) => update('neutered', event.target.value)}><option value="">선택 안 함</option><option>완료</option><option>하지 않음</option><option>예정</option><option>모름</option></select></label>
        </div>
        <label>알레르기·특이사항<textarea value={form.allergies} onChange={(event) => update('allergies', event.target.value)} placeholder="없으면 비워두세요" /></label>
        <button className="primary-button full" type="submit">추가하고 이 반려견 선택</button>
      </form>
    </div>
  )
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
      <span>{item.label}</span>
    </button>
  )
}

function Header({ eyebrow, title, action = true, onBack }) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {onBack ? <button className="icon-button" aria-label="이전 화면" onClick={onBack}><ArrowLeft size={21} /></button> : action && <button className="icon-button" aria-label="알림"><Bell size={21} /><span className="notification-dot" /></button>}
    </header>
  )
}

function accountDisplayName(profile, session) {
  const metadata = session.user.user_metadata || {}
  return profile?.display_name || metadata.display_name || metadata.full_name || metadata.name || metadata.nickname || session.user.email?.split('@')[0] || '사용자'
}

function accountAvatarUrl(profile, session) {
  const metadata = session.user.user_metadata || {}
  return profile?.avatar_url || metadata.avatar_url || metadata.picture || metadata.profile_image || ''
}

function accountProviderLabel(session) {
  const provider = session.user.app_metadata?.provider || session.user.identities?.[0]?.provider || 'email'
  const labels = { email: '이메일', google: 'Google', kakao: '카카오', naver: '네이버', 'custom:naver': '네이버' }
  return `${labels[provider] || '소셜'} 계정으로 로그인 중`
}

function AccountAvatar({ photo, name }) {
  const initials = String(name || '사용자').trim().slice(0, 2).toUpperCase()
  return (
    <div className="account-avatar" aria-label={`${name} 프로필 이미지`}>
      <span>{initials}</span>
      {photo && <img src={photo} alt="" referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}
    </div>
  )
}

function AccountScreen({ session, profile, onBack, onSave }) {
  const resolvedName = accountDisplayName(profile, session)
  const [displayName, setDisplayName] = useState(resolvedName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDisplayName(resolvedName)
  }, [resolvedName])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await onSave(displayName)
      setMessage('내 계정 정보를 저장했어요.')
    } catch (saveError) {
      setError(saveError.message || '계정 정보를 저장하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen account-screen">
      <Header eyebrow="가족에게 표시되는 사용자 정보" title="내 계정" action={false} onBack={onBack} />
      <p className="account-intro">가족과 함께 기록할 내 정보를 관리해요.</p>

      <section className="account-hero">
        <AccountAvatar photo={accountAvatarUrl(profile, session)} name={displayName || resolvedName} />
        <div><span>도케 사용자</span><h2>{displayName || '표시 이름을 입력해 주세요'}</h2><p>{session.user.email}</p></div>
      </section>

      <section className="account-card">
        <form onSubmit={submit}>
          <label>표시 이름<input required maxLength="50" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="가족에게 표시할 이름" /></label>
          <label>이메일 주소<input disabled type="email" value={session.user.email || ''} /></label>
          <div className="account-login-method"><span>로그인 방식</span><strong>{accountProviderLabel(session)}</strong></div>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message success" role="status">{message}</p>}
          <div className="account-actions">
            <button type="button" className="logout-button" disabled={busy} onClick={() => supabase.auth.signOut()}><LogOut size={17} /> 로그아웃</button>
            <button type="submit" className="primary-button" disabled={busy || !displayName.trim()}><Save size={17} /> {busy ? '저장 중…' : '변경사항 저장'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FamilyShareScreen({ session, workspace, onInvite, notify }) {
  const pending = workspace.invitations.filter((item) => item.status === 'PENDING')
  const otherPending = workspace.pendingInvitations.filter((item) => item.household_id !== workspace.household.id)

  const revoke = async (id) => {
    try { await workspace.actions.revokeInvitation(id); notify('대기 중인 초대를 취소했어요') } catch (error) { notify(error.message) }
  }
  const remove = async (member) => {
    const name = member.profile?.display_name || member.profile?.email || '구성원'
    if (!window.confirm(`${name}님을 이 가족 공간에서 내보낼까요?`)) return
    try { await workspace.actions.removeMember(member.id); notify('가족 구성원을 내보냈어요') } catch (error) { notify(error.message) }
  }
  const accept = async (id) => {
    try { await workspace.actions.acceptInvitation(id); notify('가족 초대를 수락했어요') } catch (error) { notify(error.message) }
  }

  return (
    <div className="screen family-screen">
      <Header eyebrow="초대받은 사람만 함께" title="가족과 공유" />
      <section className="family-summary">
        <div className="family-summary-icon"><UsersRound size={24} /></div>
        <div><span>현재 가족 공간</span><h2>{workspace.household.name}</h2><p>초대한 사람과 이 공간의 모든 반려견 건강 기록을 함께 관리해요.</p></div>
        <strong>{workspace.members.length}명</strong>
      </section>

      {workspace.households.length > 1 && <section className="household-switch"><h3>내 가족 공간</h3><div>{workspace.households.map((household) => <button key={household.id} className={household.id === workspace.household.id ? 'active' : ''} onClick={() => workspace.actions.selectHousehold(household.id)}>{household.name}{household.id === workspace.household.id && <Check size={14} />}</button>)}</div></section>}

      {otherPending.length > 0 && <section className="family-section"><div className="family-section-heading"><div><p className="eyebrow">받은 초대</p><h2>참여 대기 중인 공간</h2></div></div><div className="member-list">{otherPending.map((invite) => <article key={invite.id}><div className="member-avatar"><Mail size={17} /></div><div><strong>{invite.households?.name || '초대된 가족 공간'}</strong><span>{invite.invited_email}</span></div><button className="member-action" onClick={() => accept(invite.id)}>수락</button></article>)}</div></section>}

      <section className="family-section">
        <div className="family-section-heading"><div><p className="eyebrow">활성 구성원</p><h2>함께 관리하는 사람</h2></div>{workspace.isOwner && <button className="outline-small" onClick={onInvite}><Plus size={15} /> 가족 초대</button>}</div>
        <div className="member-list">
          {workspace.members.map((member) => {
            const memberName = member.profile?.display_name || member.profile?.email || '가족 구성원'
            return <article key={member.id}><div className="member-avatar">{memberName.slice(0, 1)}</div><div><strong>{memberName}{member.user_id === session.user.id && ' (나)'}</strong><span>{member.profile?.email || ''} · {new Date(member.joined_at).toLocaleDateString('ko-KR')} 참여</span></div><b className={`role-badge ${member.role.toLowerCase()}`}>{member.role === 'OWNER' ? '관리자' : '구성원'}</b>{workspace.isOwner && member.role !== 'OWNER' && <button className="member-action danger" onClick={() => remove(member)}>내보내기</button>}</article>
          })}
        </div>
      </section>

      {workspace.isOwner && <section className="family-section"><div className="family-section-heading"><div><p className="eyebrow">초대 관리</p><h2>대기 중인 사용자</h2></div></div>{pending.length ? <div className="member-list">{pending.map((invite) => <article key={invite.id}><div className="member-avatar"><Mail size={17} /></div><div><strong>{invite.invited_email}</strong><span>{new Date(invite.expires_at).toLocaleDateString('ko-KR')}까지 · 대기 중</span></div><button className="member-action danger" onClick={() => revoke(invite.id)}>취소</button></article>)}</div> : <div className="family-empty">대기 중인 초대가 없어요.</div>}</section>}

      {!workspace.isOwner && <p className="permission-note">구성원은 반려견과 기록을 보고 새 기록을 추가할 수 있어요. 초대·내보내기와 반려견 프로필 수정은 관리자만 할 수 있습니다.</p>}
      <button className="logout-button" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> {session.user.email} 로그아웃</button>
    </div>
  )
}

function InviteFamilySheet({ session, workspace, onClose }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await workspace.actions.invite(email.trim(), session.access_token)
      setResult(response.deliveryMessage)
    } catch (actionError) {
      setError(actionError.message || '초대를 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet invite-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div className="sheet-title-icon green"><Mail size={20} /></div><div><p>{workspace.household.name}</p><h2>가족 초대</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={21} /></button></div>
        <p className="invite-description">입력한 이메일로 초대 레코드를 만들고, 서버 메일 설정이 완료된 경우 가입 링크를 발송해요.</p>
        {!result && <label>초대할 이메일<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="family@example.com" /></label>}
        {error && <p className="form-message error">{error}</p>}
        {result ? <><p className="form-message success">{result}</p><button type="button" className="primary-button full" onClick={onClose}>확인</button></> : <button className="primary-button full" disabled={busy}>{busy ? '초대 만드는 중…' : '초대 보내기'}</button>}
        <small className="access-note">초대를 수락하기 전에는 반려견과 건강 데이터에 접근할 수 없습니다.</small>
      </form>
    </div>
  )
}

function HomeScreen({ events, vomitCount, onQuickAdd, onNavigate, profile, onScanDocument, memberCount, legacyAvailable, onMigrate }) {
  const latestMeal = events.find((event) => event.type === 'meal' && event.mealStatus !== 'skipped')
  const mealMatch = latestMeal?.detail?.match(/\d+(?:\.\d+)?\s*g/i)
  const mealGrams = mealMatch ? mealMatch[0].replace(/[^\d.]/g, '') : null
  const lastRecord = events[0]
  const latestMedicine = events.find((event) => event.type === 'medicine')
  const activityRecorded = events.some((event) => event.type === 'activity')
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

  return (
    <div className="screen home-screen">
      <Header eyebrow={todayLabel} title={<>좋은 아침이에요, <span>{profile.name} 보호자님</span></>} />

      {legacyAvailable && (
        <section className="migration-banner">
          <div><strong>기존 {profile.name} 기록을 내 가족 공간으로 옮길까요?</strong><p>이 브라우저의 프로필·타임라인·병원 기록을 한 번만 안전하게 이전해요.</p></div>
          <button onClick={onMigrate}>기록 옮기기</button>
        </section>
      )}

      <section className="condition-card">
        <div className="condition-topline">
          <PetAvatar photo={profile.photo} name={profile.name} />
          <div className="condition-title">
            <p>{profile.name}의 오늘</p>
            <h2>{events.length ? '오늘 기록을 확인해 주세요' : '오늘 상태를 기록해 주세요'}</h2>
          </div>
          <button className="more-button" aria-label="더 보기"><MoreHorizontal size={21} /></button>
        </div>
        <div className="condition-stats">
          <div><strong>{profile.weight || '—'}{profile.weight && <small>kg</small>}</strong><span>현재 몸무게</span></div>
          <div><strong>{mealGrams || '—'}{mealGrams && <small>g</small>}</strong><span>최근 식사량</span></div>
          <div><strong>{activityRecorded ? '기록됨' : '미기록'}</strong><span>활동량</span></div>
        </div>
        <div className="care-message">
          <Sparkles size={17} />
          <div>
            <p><strong>기록 기반 관찰</strong> · {vomitCount > 0 ? '구토 기록이 있어 식사량과 활력을 함께 살펴봐요.' : '현재 선택한 반려견의 기록만 모아 보여드려요.'}</p>
            <span>{latestMedicine ? `최근 투약 · ${latestMedicine.detail}` : '다음 행동 · 오늘 상태를 간단히 기록해 보세요.'}</span>
          </div>
        </div>
      </section>

      <section className="shared-care-card">
        <div className="shared-care-heading">
          <div className="shared-care-title"><span><UsersRound size={18} /></span><div><p>초대된 가족만 볼 수 있어요</p><h2>최근 가족 활동</h2></div></div>
          <strong className="pending-pill">{memberCount}명 참여</strong>
        </div>
        <div className="shared-care-details">
          <div><span>마지막 기록</span><strong>{lastRecord ? `${honorificName(lastRecord.author || '보호자')} · ${lastRecord.time?.replace('오늘 ', '')}` : '아직 기록이 없어요'}</strong></div>
          <div><span>공유 범위</span><strong>이 가족 공간의 활성 구성원</strong></div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">빠른 기록</p><h2>지금 어떤 일이 있었나요?</h2></div>
        </div>
        <div className="quick-grid">
          {symptoms.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className="quick-item" onClick={() => onQuickAdd(item.id)}>
                <span className={`quick-icon ${item.color}`}><Icon size={23} /></span>
                <span>{item.label}</span>
                <Plus size={16} className="quick-plus" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="document-scan-card">
        <div className="document-scan-icon"><Camera size={21} /></div>
        <div className="document-scan-copy"><span>AI 병원 서류 정리</span><h2>병원 다녀오셨나요?</h2><p>처방전이나 영수증을 촬영하면 진료·약 정보를 자동으로 정리해드려요.</p></div>
        <button onClick={onScanDocument}>서류 촬영하기 <ChevronRight size={15} /></button>
      </section>

      <section className="section-block">
        <div className="section-heading inline">
          <div><p className="eyebrow">최근 기록</p><h2>오늘의 타임라인</h2></div>
          <button className="text-button" onClick={() => onNavigate('timeline')}>전체 보기 <ChevronRight size={16} /></button>
        </div>
        <div className="timeline-list compact">
          {events.slice(0, 3).map((event) => <TimelineItem key={event.id} event={event} />)}
        </div>
      </section>

      <section className="briefing-banner">
        <div className="banner-icon"><Stethoscope size={22} /></div>
        <div className="briefing-banner-copy"><span>수의사에게 바로 보여주세요</span><strong>{profile.name}의 최근 건강 요약</strong><p>최근 구토 기록, 식사량, 복용약, 체중 변화가 포함돼요.</p></div>
        <button onClick={() => onNavigate('briefing')}>공유용 리포트 만들기 <ChevronRight size={15} /></button>
      </section>
    </div>
  )
}

function TimelineScreen({ events, petName, onChooseRecord, onDelete, onEdit, canEdit, canDelete }) {
  const [filter, setFilter] = useState('all')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const filtered = filter === 'all' ? events : events.filter((event) => event.type === filter)
  const grouped = filtered.reduce((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event]
    return acc
  }, {})
  Object.values(grouped).forEach((items) => items.sort((a, b) => getEventTimeMinutes(b) - getEventTimeMinutes(a)))

  return (
    <div className="screen">
      <Header eyebrow={`${petName}의 하루를 한눈에`} title="건강 타임라인" />
      <div className="filter-row">
        {[['all', '전체'], ...symptoms.map((item) => [item.id, item.label])].map(([id, label]) => (
          <button key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
        <button className={showMoreFilters ? 'selected' : ''} onClick={() => setShowMoreFilters((value) => !value)}><SlidersHorizontal size={13} /> 더보기</button>
      </div>
      {showMoreFilters && (
        <div className="more-filter-row" aria-label="추가 기록 필터">
          {[...additionalRecordTypes, customRecordType].map((item) => (
            <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
      )}
      <div className="timeline-groups">
        {filtered.length === 0 && <div className="timeline-empty"><Clock3 size={22} /><p>이 유형의 기록이 아직 없어요.</p><span>아래 기록 추가 버튼으로 첫 기록을 남겨보세요.</span></div>}
        {Object.entries(grouped).map(([date, items]) => (
          <section key={date}>
            <div className="date-divider"><span>{date}</span><i /></div>
            <div className="timeline-list">
              {items.map((event) => <TimelineItem key={`${event.source || 'timeline'}-${event.id}`} event={event} onDelete={canDelete(event) ? onDelete : undefined} onEdit={canEdit(event) ? onEdit : undefined} />)}
            </div>
          </section>
        ))}
      </div>
      <button className="floating-add" onClick={onChooseRecord}><Plus size={22} /> 기록 추가</button>
    </div>
  )
}

function TimelineItem({ event, onDelete, onEdit }) {
  const type = recordTypes.find((item) => item.id === event.type) || customRecordType
  const Icon = type.icon
  const routineMeal = event.source === 'meal_record' && Number.isFinite(event.routineTimeMinutes)
  return (
    <article className="timeline-item">
      <div className={`timeline-icon ${type.color}`}><Icon size={19} /></div>
      <div className="timeline-copy">
        <div className={`timeline-title ${routineMeal ? 'routine-meal' : ''}`}><strong>{event.title}</strong><time>{routineMeal ? formatRoutineTime(event.routineTimeMinutes) : event.time.replace(`${event.date} `, '')}</time></div>
        <p>{event.detail}</p>
        {event.author && <small className="timeline-author">{honorificName(event.author)}이 기록{event.authorCreatedAtLabel ? ` · 작성 ${event.authorCreatedAtLabel}` : ''}</small>}
        {event.note && <span>{event.note}</span>}
        {event.photo && <img className="timeline-photo" src={event.photo} alt={`${event.title} 첨부 사진`} />}
      </div>
      {(onEdit || onDelete) && <div className="record-card-actions">{onEdit && <button className="edit-button" onClick={() => onEdit(event)} aria-label="기록 수정"><Pencil size={15} /></button>}{onDelete && <button className="delete-button" onClick={() => onDelete(event.id)} aria-label="기록 삭제"><Trash2 size={16} /></button>}</div>}
    </article>
  )
}

function BriefingScreen({ count, copied, onCopy, onPrint, profile, events, hospitalRecords }) {
  const [period, setPeriod] = useState('24시간')
  const latestVomit = events.find((event) => event.type === 'vomit')
  const latestMeal = events.find((event) => event.type === 'meal')
  const latestWater = events.find((event) => event.type === 'water')
  const latestActivity = events.find((event) => event.type === 'activity')
  const latestMedicine = events.find((event) => event.type === 'medicine')
  const latestHospital = hospitalRecords[0]
  return (
    <div className="screen briefing-screen">
      <Header eyebrow="병원에 가기 전 준비" title="진료 브리핑" />
      <div className="briefing-intro">
        <div className="briefing-pet"><PetAvatar photo={profile.photo} name={profile.name} /><div><strong>{profile.name}</strong><p>{profile.breed} · {getAgeLabel(profile.birthDate)} · {profile.weight || '-'}kg</p></div></div>
        <div className="period-control">
          {['24시간', '3일', '7일'].map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>)}
        </div>
      </div>

      <article className="briefing-document">
        <div className="document-heading">
          <div><span>자동 요약</span><h2>{count > 0 ? '최근 구토 기록 요약' : `${profile.name}의 최근 건강 요약`}</h2></div>
          <span className="generated-badge"><Sparkles size={14} /> 기록 기반</span>
        </div>
        <div className="document-alert"><Activity size={19} /><p>{count > 0 ? <>최근 {period} 동안 구토가 <strong>{count}회</strong> 기록됐습니다.</> : <>선택한 기간에 구토 기록이 없습니다.</>}</p></div>
        <BriefingSection title="기본 정보">
          <ul>
            <li><span>성별 · 중성화</span><strong>{profile.sex || '미입력'} · {profile.neutered || '미입력'}</strong></li>
            <li><span>현재 몸무게</span><strong>{profile.weight ? `${profile.weight}kg` : '미입력'}</strong></li>
            <li><span>알레르기</span><strong>{profile.allergies || '기록 없음'}</strong></li>
          </ul>
        </BriefingSection>
        {latestVomit && <BriefingSection title="증상 경과"><ul><li><span>마지막 구토</span><strong>{latestVomit.time}</strong></li><li><span>보호자 관찰</span><strong>{latestVomit.detail}</strong></li><li><span>메모</span><strong>{latestVomit.note || '기록 없음'}</strong></li></ul></BriefingSection>}
        <BriefingSection title="식사 및 활동">
          <ul>
            <li><span>최근 식사</span><strong>{latestMeal?.detail || '기록 없음'}</strong></li>
            <li><span>최근 음수</span><strong>{latestWater?.detail || '기록 없음'}</strong></li>
            <li><span>최근 활동</span><strong>{latestActivity?.detail || '기록 없음'}</strong></li>
          </ul>
        </BriefingSection>
        {latestMedicine && <BriefingSection title="최근 투약"><div className="medicine-row"><div className="medicine-icon"><Pill size={18} /></div><div><strong>{latestMedicine.detail}</strong><p>{latestMedicine.time}</p></div></div></BriefingSection>}
        {latestHospital && <BriefingSection title="최근 병원 방문"><ul><li><span>방문일 · 병원</span><strong>{latestHospital.date} · {latestHospital.hospital}</strong></li><li><span>방문 이유</span><strong>{latestHospital.reason || latestHospital.diagnosis}</strong></li></ul></BriefingSection>}
        <div className="question-box"><strong>기록 사용 안내</strong><p>이 요약은 {profile.name}의 기록만 모은 자료예요. 진료 시 실제 상태와 함께 수의사에게 보여주세요.</p></div>
      </article>
      <div className="briefing-actions">
        <button className="secondary-button" onClick={onPrint}><FileText size={18} /> PDF 저장</button>
        <button className="primary-button" onClick={onCopy}>{copied ? <Check size={18} /> : <Share2 size={18} />}{copied ? '복사했어요' : '공유하기'}</button>
      </div>
    </div>
  )
}

function BriefingSection({ title, children }) {
  return <section className="document-section"><h3>{title}</h3>{children}</section>
}

function ProfileScreen({ profile, onSave, onPhotoChange, canEdit, mealRoutines = [], onManageMealRoutines }) {
  const [draft, setDraft] = useState(profile)

  useEffect(() => {
    setDraft(profile)
  }, [profile.id])

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...draft, photo: profile.photo })
  }

  return (
    <div className="screen profile-screen">
      <Header eyebrow="건강 기록의 기준 정보" title="반려견 프로필" />

      <section className="profile-hero">
        <PetAvatar photo={profile.photo} name={draft.name || '반려견'} onPhotoChange={canEdit ? onPhotoChange : undefined} profile />
        <div>
          <span>대표 사진</span>
          <h2>{draft.name || '이름을 입력해 주세요'}</h2>
          <p>{canEdit ? '사진은 여기에서만 등록하거나 변경할 수 있어요.' : '가족 공간 관리자만 프로필을 수정할 수 있어요.'}</p>
        </div>
      </section>

      <form className="profile-form" onSubmit={submit}>
        <fieldset className="profile-fieldset" disabled={!canEdit}>
        <section className="profile-form-section">
          <div className="profile-section-title"><span>01</span><div><h3>기본 정보</h3><p>진료 기록과 브리핑에 표시돼요.</p></div></div>
          <div className="profile-grid">
            <label className="full-field">이름 <input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="예: 춘식" /></label>
            <label>품종 <input required list="dog-breeds" value={draft.breed} onChange={(event) => update('breed', event.target.value)} placeholder="예: 비숑 프리제" /></label>
            <datalist id="dog-breeds"><option value="비숑 프리제" /><option value="포메라니안" /><option value="말티즈" /><option value="푸들" /><option value="골든 리트리버" /><option value="믹스견" /></datalist>
            <label>생년월일 <input type="date" value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label>
            <div className="full-field profile-field-group">
              <span>성별</span>
              <div className="choice-row">
                {['수컷', '암컷'].map((sex) => <button type="button" key={sex} className={draft.sex === sex ? 'selected' : ''} onClick={() => update('sex', sex)}>{sex}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section className="profile-form-section">
          <div className="profile-section-title"><span>02</span><div><h3>건강 정보</h3><p>병원 방문 시 필요한 기본 정보예요.</p></div></div>
          <div className="profile-grid">
            <label>현재 몸무게 <div className="unit-input"><input type="number" min="0.1" max="100" step="0.1" value={draft.weight} onChange={(event) => update('weight', event.target.value)} placeholder="4.2" /><span>kg</span></div></label>
            <label>중성화 여부 <select value={draft.neutered} onChange={(event) => update('neutered', event.target.value)}><option>완료</option><option>하지 않음</option><option>예정</option><option>모름</option></select></label>
            <label className="full-field">알레르기 <input value={draft.allergies} onChange={(event) => update('allergies', event.target.value)} placeholder="없으면 비워두세요" /></label>
            <label className="full-field">동물등록번호 <input value={draft.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value)} placeholder="선택 입력" /></label>
          </div>
        </section>

        <section className="profile-form-section">
          <div className="profile-section-title"><span>03</span><div><h3>보호자 메모</h3><p>성격이나 병원이 알아야 할 점을 남겨주세요.</p></div></div>
          <label className="profile-memo"><textarea value={draft.memo} onChange={(event) => update('memo', event.target.value)} placeholder="예: 낯선 사람을 무서워하고, 닭고기에 민감해요." /></label>
        </section>

        </fieldset>

        <section className="profile-form-section meal-routine-profile-card">
          <div className="profile-section-title"><span>04</span><div><h3>식사 루틴</h3><p>자주 먹는 시간과 1회 급여량을 빠른 기록에 사용해요.</p></div></div>
          {mealRoutines.length > 0 ? (
            <div className="meal-routine-summary-list">{mealRoutines.map((routine) => <span key={routine.id} className={routine.active ? '' : 'inactive'}><Clock3 size={14} /> {formatRoutineTime(routine.timeMinutes)} · {routine.foodName} {routine.amountGrams}g{!routine.active && ' · 중지됨'}</span>)}</div>
          ) : <p className="meal-routine-empty">등록된 식사 루틴이 없어요.</p>}
          {canEdit && <button type="button" className="secondary-button meal-routine-manage-button" onClick={onManageMealRoutines}><SlidersHorizontal size={16} /> 식사 루틴 관리</button>}
        </section>

        {canEdit && <div className="profile-save-bar">
          <p>{draft.birthDate ? `${getAgeLabel(draft.birthDate)} · ` : ''}{draft.breed || '품종 미입력'} · {draft.weight ? `${draft.weight}kg` : '몸무게 미입력'}</p>
          <button className="primary-button" type="submit"><Save size={18} /> 프로필 저장</button>
        </div>}
      </form>
    </div>
  )
}

function RecordsScreen({ records, total, onAdd, onEdit, canEdit }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <div className="screen records-screen">
      <Header eyebrow="흩어진 서류 없이 한곳에" title="병원 기록" />
      <section className="expense-card">
        <div><p>최근 3개월 병원비</p><strong>{formatWon(total)}</strong></div>
        <div className="expense-meta"><span>총 {records.length}번 방문</span><span>월평균 {formatWon(Math.round(total / 3))}</span></div>
      </section>
      <div className="section-heading inline records-heading">
        <div><p className="eyebrow">진료 내역</p><h2>최근 방문</h2></div>
        <button className="outline-small" onClick={onAdd}><Plus size={15} /> 기록 추가</button>
      </div>
      <div className="record-list">
        {records.length === 0 && <div className="records-empty"><Stethoscope size={23} /><strong>아직 병원 기록이 없어요</strong><p>이 반려견의 첫 방문 기록을 추가해 보세요.</p></div>}
        {records.map((record) => (
          <article className="record-card" key={record.id}>
            <div className="record-date"><CalendarDays size={18} /><span>{record.date}</span><span className={`status-pill ${record.source === 'manual' ? 'manual' : ''}`}>{record.status}</span></div>
            <h3>{record.hospital}</h3>
            <div className="diagnosis"><Stethoscope size={17} /><div><span>{record.source ? '방문 이유' : '진단'}</span><strong>{record.reason || record.diagnosis}</strong></div></div>
            <p>{record.items}</p>
            <small className="timeline-author">{honorificName(record.author)}이 기록{record.authorCreatedAtLabel ? ` · 작성 ${record.authorCreatedAtLabel}` : ''}</small>
            {expanded === record.id && (
              record.source === 'manual' ? (
                <div className="record-detail manual-record-detail">
                  {record.opinion && <span><b>진료 내용·소견</b>{record.opinion}</span>}
                  {record.treatment && <span><b>검사·처치</b>{record.treatment}</span>}
                  {record.medication && <span><b>처방약</b>{record.medication}</span>}
                  {record.memo && <span><b>메모</b>{record.memo}</span>}
                  {record.photo && <img src={record.photo} alt="병원 방문 첨부 사진" />}
                </div>
              ) : record.source === 'document' ? (
                <div className="record-detail manual-record-detail">
                  <span><b>등록 방식</b>영수증·처방전 촬영</span>
                  {record.photo && <img src={record.photo} alt="등록한 병원 서류" />}
                </div>
              ) : (
                <div className="record-detail">
                  <span><b>결제 방법</b> 신용카드</span>
                  <span><b>보관 서류</b> 진료비 영수증 · 처방전</span>
                </div>
              )
            )}
            <div className="record-footer"><div>{record.amount ? <strong>{formatWon(record.amount)}</strong> : <span className="cost-missing">비용 미입력</span>}</div><div className="record-footer-actions">{canEdit(record) && <button onClick={() => onEdit(record)}><Pencil size={13} /> 수정</button>}<button onClick={() => setExpanded(expanded === record.id ? null : record.id)}>{expanded === record.id ? '접기' : '상세 보기'} <ChevronRight size={15} className={expanded === record.id ? 'rotate' : ''} /></button></div></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function RecordTypeSheet({ petName, onClose, onSelect }) {
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bottom-sheet record-type-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header record-picker-header">
          <div><p>건강 기록 추가</p><h2>무엇을 기록할까요?</h2><span>{petName}의 오늘 상태를 간단히 남겨보세요.</span></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>

        <section className="record-picker-section">
          <h3>기본 기록</h3>
          <div className="record-type-grid">
            {symptoms.map((item) => <RecordTypeButton key={item.id} item={item} onClick={() => onSelect(item.id)} />)}
          </div>
        </section>

        <section className="record-picker-section">
          <h3>추천 추가 기록</h3>
          <div className="record-type-grid">
            {additionalRecordTypes.map((item) => <RecordTypeButton key={item.id} item={item} onClick={() => onSelect(item.id)} />)}
          </div>
        </section>

        <button className="custom-record-button" onClick={() => onSelect('custom')}>
          <span className="sheet-title-icon blue"><FileText size={20} /></span>
          <span><strong>직접 입력</strong><small>목욕, 귀 청소, 기침, 피부 상태 등 원하는 내용을 기록해요.</small></span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

function RecordTypeButton({ item, onClick }) {
  const Icon = item.icon
  return (
    <button className="record-type-button" onClick={onClick}>
      <span className={`sheet-title-icon ${item.color}`}><Icon size={20} /></span>
      <strong>{item.label}</strong>
    </button>
  )
}

function LogSheet({ type, onClose, onSave, mealRoutines = [], todayMealRecords = [], initialMeal = null, onConfirmRoutine, onSkipRoutine, onModifyRoutine, onManageMealRoutines }) {
  const selected = recordTypes.find((item) => item.id === type) || customRecordType
  const isCustom = type === 'custom'
  const [form, setForm] = useState(() => {
    const currentTime = getCurrentTimeParts()
    return {
      type,
      title: '',
      ...currentTime,
      time: formatTimeParts(currentTime.period, currentTime.hour, currentTime.minute),
      timeMinutes: toTimeMinutes(currentTime.period, currentTime.hour, currentTime.minute),
      appearance: initialMeal?.foodName || '',
      amount: initialMeal ? `${initialMeal.amountGrams}g` : '',
      routineId: initialMeal?.id || '',
      routineTimeMinutes: initialMeal?.timeMinutes ?? null,
      plannedAmountGrams: initialMeal?.amountGrams ?? null,
      note: '',
      photo: '',
    }
  })
  const [photoName, setPhotoName] = useState('')
  const [routineBusy, setRoutineBusy] = useState('')
  const Icon = selected.icon
  const activeMealRoutines = mealRoutines.filter((routine) => routine.active)

  const updateTime = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      return {
        ...next,
        time: formatTimeParts(next.period, next.hour, next.minute),
        timeMinutes: toTimeMinutes(next.period, next.hour, next.minute),
      }
    })
  }

  const attachPhoto = async (file) => {
    if (!file) return
    setPhotoName(file.name)
    try {
      const photo = await resizeImage(file)
      setForm((current) => ({ ...current, photo }))
    } catch {
      setPhotoName('')
    }
  }

  const runRoutineAction = async (routine, action) => {
    setRoutineBusy(`${routine.id}-${action}`)
    try {
      if (action === 'confirmed') await onConfirmRoutine(routine)
      else await onSkipRoutine(routine)
    } catch {
      // 상위 화면에서 사용자 메시지를 표시합니다.
    } finally {
      setRoutineBusy('')
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className={`sheet-title-icon ${selected.color}`}><Icon size={21} /></div>
          <div><p>{isCustom ? '나만의 기록' : '관찰 기록'}</p><h2>{isCustom ? '직접 입력 기록하기' : `${selected.label} 기록하기`}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        {isCustom && <label>기록 제목<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 귀 청소, 기침, 피부 상태" /></label>}
        {type === 'meal' && (activeMealRoutines.length > 0 || onManageMealRoutines) && (
          <section className="meal-routine-quick-select">
            <div><span>오늘의 예정 식사</span>{onManageMealRoutines && <button type="button" onClick={onManageMealRoutines}><SlidersHorizontal size={14} /> 관리</button>}</div>
            {activeMealRoutines.length > 0 ? (
              <div className="scheduled-meal-list">
                {activeMealRoutines.map((routine) => {
                  const record = todayMealRecords.find((item) => item.routineId === routine.id)
                  const pendingStatus = routine.timeMinutes > new Date().getHours() * 60 + new Date().getMinutes() ? 'scheduled' : 'unrecorded'
                  const status = record?.mealStatus || pendingStatus
                  const statusLabel = { scheduled: '예정', unrecorded: '기록되지 않음', confirmed: '완료', skipped: '건너뜀' }[status]
                  return (
                    <article className={`scheduled-meal-card ${status}`} key={routine.id}>
                      <div className="scheduled-meal-copy"><div><strong>{formatRoutineTime(routine.timeMinutes)}</strong><span className={`meal-status ${status}`}>{statusLabel}</span></div><p>{routine.foodName} · 기본 {routine.amountGrams}g</p>{record && <small>실제 확인 · {record.time.replace('오늘 ', '')}{record.mealStatus === 'confirmed' && record.amountGrams != null ? ` · ${record.amountGrams}g` : ''}</small>}</div>
                      {!record && <div className={`scheduled-meal-actions ${onModifyRoutine ? '' : 'two-actions'}`}><button type="button" className="confirm" disabled={Boolean(routineBusy)} onClick={() => runRoutineAction(routine, 'confirmed')}>{routineBusy === `${routine.id}-confirmed` ? '저장 중…' : '먹였어요'}</button>{onModifyRoutine && <button type="button" onClick={() => onModifyRoutine(routine)}>수정</button>}<button type="button" className="skip" disabled={Boolean(routineBusy)} onClick={() => runRoutineAction(routine, 'skipped')}>{routineBusy === `${routine.id}-skipped` ? '저장 중…' : '건너뜀'}</button></div>}
                      {record && onModifyRoutine && <div className="scheduled-meal-actions single-action"><button type="button" onClick={() => onModifyRoutine(routine)}>이 루틴 수정</button></div>}
                    </article>
                  )
                })}
              </div>
            ) : <p>활성화된 루틴이 없어요. 직접 기록하거나 루틴을 등록해 주세요.</p>}
          </section>
        )}
        {type === 'meal' && <div className="direct-meal-divider"><span>{initialMeal ? '내용을 수정해 실제 식사로 기록' : '루틴과 무관한 식사 직접 기록'}</span></div>}
        <div className="time-input-field">
          <span className="time-input-label">{type === 'weight' ? '측정 시간' : '발생 시간'}</span>
          <div className="time-input-row">
            <div className="time-period-toggle" aria-label="오전 또는 오후 선택">
              {['오전', '오후'].map((period) => <button type="button" key={period} aria-pressed={form.period === period} className={form.period === period ? 'selected' : ''} onClick={() => updateTime('period', period)}>{period}</button>)}
            </div>
            <div className="time-select-group">
              <select aria-label="시 선택" value={form.hour} onChange={(event) => updateTime('hour', event.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select>
              <span>시</span>
              <select aria-label="분 선택" value={form.minute} onChange={(event) => updateTime('minute', event.target.value)}>{Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select>
              <span>분</span>
            </div>
          </div>
        </div>
        {!isCustom && selected.fields.length > 0 && (
          <div className={`form-columns ${selected.fields.length === 1 ? 'single' : ''}`}>
            {selected.fields.map((field) => (
              <label key={field.key}>{field.label}<input placeholder={field.placeholder} value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /></label>
            ))}
          </div>
        )}
        <label>{isCustom ? '내용 또는 메모' : '메모'}<textarea placeholder={isCustom ? '관찰하거나 관리한 내용을 남겨주세요' : '보호자가 관찰한 상황이나 특이사항을 남겨주세요'} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <label className="photo-button">
          <input type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />
          {photoName ? <Check size={18} /> : <Camera size={18} />} {photoName || '사진 첨부하기 (선택)'}
        </label>
        <button className="primary-button full" type="submit">기록 저장</button>
      </form>
    </div>
  )
}

function mealRoutineDraft(routine = {}) {
  const parts = getTimePartsFromMinutes(routine.timeMinutes ?? 390)
  const id = routine.id || crypto.randomUUID()
  return {
    key: id,
    id,
    ...parts,
    foodName: routine.foodName || '사료',
    amountGrams: routine.amountGrams == null ? '24' : String(routine.amountGrams),
    active: routine.active !== false,
  }
}

function MealRoutineSheet({ petName, routines, focusRoutineId = '', onClose, onSave }) {
  const [rows, setRows] = useState(() => routines.map(mealRoutineDraft))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const updateRow = (key, field, value) => setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row))
  const removeRow = (key) => setRows((current) => current.filter((row) => row.key !== key))
  const addRow = () => {
    if (rows.length >= 12) {
      setError('식사 루틴은 최대 12회까지 등록할 수 있어요.')
      return
    }
    const last = rows[rows.length - 1]
    const nextMinutes = last ? (toTimeMinutes(last.period, last.hour, last.minute) + 360) % 1440 : 390
    setRows((current) => [...current, mealRoutineDraft({ timeMinutes: nextMinutes, foodName: last?.foodName || '사료', amountGrams: last?.amountGrams || 24 })])
    setError('')
  }
  const loadExample = () => {
    setRows([390, 720, 1050, 1380].map((timeMinutes) => mealRoutineDraft({ timeMinutes, foodName: '사료', amountGrams: 24, active: true })))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const normalized = rows.map((row) => ({ id: row.id, timeMinutes: toTimeMinutes(row.period, row.hour, row.minute), foodName: row.foodName.trim(), amountGrams: Number(row.amountGrams), active: row.active })).sort((a, b) => a.timeMinutes - b.timeMinutes)
    if (normalized.some((routine) => !routine.foodName)) {
      setError('각 식사의 사료 또는 음식 이름을 입력해 주세요.')
      return
    }
    if (normalized.some((routine) => !Number.isFinite(routine.amountGrams) || routine.amountGrams <= 0)) {
      setError('각 식사의 급여량을 0보다 큰 값으로 입력해 주세요.')
      return
    }
    if (new Set(normalized.map((routine) => routine.timeMinutes)).size !== normalized.length) {
      setError('같은 시간의 식사 루틴이 중복되어 있어요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (saveError) {
      setError(saveError.message || '식사 루틴을 저장하지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet meal-routine-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-icon green"><Apple size={21} /></div>
          <div><p>{petName}의 반복 일정</p><h2>식사 루틴 관리</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <p className="meal-routine-description">평소 식사 시간과 1회 급여량을 등록하면 식사 기록에 바로 불러올 수 있어요.</p>

        {rows.length === 0 ? (
          <div className="meal-routine-editor-empty"><Apple size={23} /><strong>등록된 식사 시간이 없어요</strong><p>직접 추가하거나 4회 식사 예시를 불러와 시작해 보세요.</p></div>
        ) : (
          <div className="meal-routine-editor-list">
            {rows.map((row, index) => (
              <div className={`meal-routine-editor-row ${row.id === focusRoutineId ? 'editing-target' : ''}`} key={row.key}>
                <strong className="meal-routine-index">{index + 1}</strong>
                <div className="meal-routine-row-fields">
                  <div className="routine-time-control">
                    <div className="routine-period-toggle">{['오전', '오후'].map((period) => <button type="button" key={period} className={row.period === period ? 'selected' : ''} onClick={() => updateRow(row.key, 'period', period)}>{period}</button>)}</div>
                    <select aria-label={`${index + 1}번째 식사 시`} value={row.hour} onChange={(event) => updateRow(row.key, 'hour', event.target.value)}>{Array.from({ length: 12 }, (_, hour) => hour + 1).map((hour) => <option key={hour} value={hour}>{hour}시</option>)}</select>
                    <select aria-label={`${index + 1}번째 식사 분`} value={row.minute} onChange={(event) => updateRow(row.key, 'minute', event.target.value)}>{Array.from({ length: 12 }, (_, minute) => String(minute * 5).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}분</option>)}</select>
                  </div>
                  <label className="routine-food-field">사료·음식<input autoFocus={row.id === focusRoutineId} required maxLength="80" value={row.foodName} onChange={(event) => updateRow(row.key, 'foodName', event.target.value)} placeholder="예: 주식 사료" /></label>
                  <label>1회 급여량<div className="unit-input"><input required type="number" min="0.1" max="999" step="0.1" inputMode="decimal" value={row.amountGrams} onChange={(event) => updateRow(row.key, 'amountGrams', event.target.value)} /><span>g</span></div></label>
                  <button type="button" className={`routine-active-toggle ${row.active ? 'active' : ''}`} onClick={() => updateRow(row.key, 'active', !row.active)}><Check size={14} /> {row.active ? '사용 중' : '사용 안 함'}</button>
                </div>
                <button type="button" className="routine-remove-button" aria-label={`${index + 1}번째 식사 삭제`} onClick={() => removeRow(row.key)}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="meal-routine-editor-actions">
          <button type="button" className="secondary-button" onClick={addRow}><Plus size={16} /> 식사 시간 추가</button>
          {routines.length === 0 && <button type="button" className="text-button" onClick={loadExample}>오전 6:30부터 4회 예시 불러오기</button>}
        </div>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary-button full" type="submit" disabled={busy}>{busy ? '저장 중…' : rows.length ? `하루 ${rows.length}회 루틴 저장` : '등록된 루틴 모두 삭제'}</button>
      </form>
    </div>
  )
}

function EditTimelineSheet({ event, onClose, onSave }) {
  const occurred = new Date(event.occurredAt)
  const hour24 = occurred.getHours()
  const initialPeriod = hour24 >= 12 ? '오후' : '오전'
  const [form, setForm] = useState({
    period: initialPeriod,
    hour: String(hour24 % 12 || 12),
    minute: String(occurred.getMinutes()).padStart(2, '0'),
    timeMinutes: hour24 * 60 + occurred.getMinutes(),
    detail: event.detail || '',
    note: event.note || '',
    photo: event.photo || '',
  })
  const [photoName, setPhotoName] = useState(event.photo ? '기존 첨부 사진 유지' : '')

  const updateTime = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value }
    return { ...next, timeMinutes: toTimeMinutes(next.period, next.hour, next.minute) }
  })
  const attachPhoto = async (file) => {
    if (!file) return
    setPhotoName(file.name)
    try {
      const photo = await resizeImage(file)
      setForm((current) => ({ ...current, photo }))
    } catch {
      setPhotoName(event.photo ? '기존 첨부 사진 유지' : '')
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
      <form className="bottom-sheet" onSubmit={(submitEvent) => { submitEvent.preventDefault(); onSave(form) }}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div className="sheet-title-icon green"><Pencil size={20} /></div><div><p>내가 작성한 기록</p><h2>{event.title} 수정</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={21} /></button></div>
        <div className="time-input-field"><span className="time-input-label">발생 시간</span><div className="time-input-row"><div className="time-period-toggle">{['오전', '오후'].map((period) => <button type="button" key={period} className={form.period === period ? 'selected' : ''} onClick={() => updateTime('period', period)}>{period}</button>)}</div><div className="time-select-group"><select aria-label="시 선택" value={form.hour} onChange={(changeEvent) => updateTime('hour', changeEvent.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select><span>시</span><select aria-label="분 선택" value={form.minute} onChange={(changeEvent) => updateTime('minute', changeEvent.target.value)}>{Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select><span>분</span></div></div></div>
        <label>관찰 내용<input required value={form.detail} onChange={(changeEvent) => setForm({ ...form, detail: changeEvent.target.value })} /></label>
        <label>메모<textarea value={form.note} onChange={(changeEvent) => setForm({ ...form, note: changeEvent.target.value })} /></label>
        <label className="photo-button"><input type="file" accept="image/*" onChange={(changeEvent) => attachPhoto(changeEvent.target.files?.[0])} />{photoName ? <Check size={18} /> : <Camera size={18} />} {photoName || '사진 첨부하기 (선택)'}</label>
        <button className="primary-button full" type="submit">수정 내용 저장</button>
      </form>
    </div>
  )
}

function HospitalAddSheet({ onClose, onSelect }) {
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bottom-sheet hospital-add-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header record-picker-header">
          <div><p>방문 기록 남기기</p><h2>병원 기록 추가</h2><span>영수증을 촬영하거나 방문 내용을 직접 남길 수 있어요.</span></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <div className="hospital-method-list">
          <button onClick={() => onSelect('receipt')}>
            <span className="method-icon green"><Camera size={22} /></span>
            <span><strong>영수증·처방전 촬영</strong><small>사진을 추가해 진료와 비용 정보를 정리해요.</small></span>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => onSelect('hospital-manual')}>
            <span className="method-icon blue"><ClipboardList size={22} /></span>
            <span><strong>직접 기록하기</strong><small>사진이 없어도 병원 방문 내용을 간단히 남길 수 있어요.</small></span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualHospitalSheet({ onClose, onSave, initial = null }) {
  const baseDate = initial?.visitedAt ? new Date(initial.visitedAt) : new Date()
  const localDate = new Date(baseDate.getTime() - baseDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const [form, setForm] = useState({ visitDate: localDate, hospital: initial?.hospital === '병원명 미입력' ? '' : initial?.hospital || '', reason: initial?.reason || '', opinion: initial?.opinion || '', treatment: initial?.treatment || '', medication: initial?.medication || '', cost: initial?.amount == null ? '' : String(initial.amount), memo: initial?.memo || '', photo: initial?.photo || '' })
  const [photoName, setPhotoName] = useState(initial?.photo ? '기존 첨부 사진 유지' : '')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const attachPhoto = async (file) => {
    if (!file) return
    setPhotoName(file.name)
    try {
      update('photo', await resizeImage(file))
    } catch {
      setPhotoName('')
    }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet manual-hospital-sheet" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-icon green"><Stethoscope size={21} /></div>
          <div><p>보호자가 들은 내용을 그대로</p><h2>{initial ? '병원 방문 기록 수정' : '병원 방문 직접 기록'}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <div className="form-columns">
          <label><span>방문 날짜 <em>필수</em></span><input required type="date" value={form.visitDate} onChange={(event) => update('visitDate', event.target.value)} /></label>
          <label>병원명<input value={form.hospital} onChange={(event) => update('hospital', event.target.value)} placeholder="예: 다정한 동물병원" /></label>
        </div>
        <label><span>방문 이유 <em>필수</em></span><input required value={form.reason} onChange={(event) => update('reason', event.target.value)} placeholder="예: 구토 증상 상담" /></label>
        <label>진료 내용·소견<textarea value={form.opinion} onChange={(event) => update('opinion', event.target.value)} placeholder="병원에서 들은 내용을 그대로 적어주세요" /></label>
        <div className="form-columns">
          <label>검사·처치<input value={form.treatment} onChange={(event) => update('treatment', event.target.value)} placeholder="예: 진찰, 복부 X-ray" /></label>
          <label>처방약<input value={form.medication} onChange={(event) => update('medication', event.target.value)} placeholder="예: 가스모틴 ½정" /></label>
        </div>
        <label>진료비<div className="unit-input"><input inputMode="numeric" value={form.cost ? Number(form.cost).toLocaleString('ko-KR') : ''} onChange={(event) => update('cost', event.target.value.replace(/\D/g, ''))} placeholder="예: 86,400" /><span>원</span></div></label>
        <label>메모<textarea value={form.memo} onChange={(event) => update('memo', event.target.value)} placeholder="예: 다음 주 재진 권고" /></label>
        <label className="photo-button">
          <input type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />
          {photoName ? <Check size={18} /> : <Camera size={18} />} {photoName || '처방전·약 봉투·안내문 첨부 (선택)'}
        </label>
        <div className="form-safety-note"><FileText size={16} /><p>의학적 판단이 아닌, 병원에서 들은 내용을 가족과 공유하기 위한 기록이에요.</p></div>
        <button className="primary-button full" type="submit">{initial ? '수정 내용 저장' : '병원 기록 저장'}</button>
      </form>
    </div>
  )
}

function ReceiptSheet({ onClose, onSave }) {
  const [fileName, setFileName] = useState('')
  const [photo, setPhoto] = useState('')
  const attachPhoto = async (file) => {
    if (!file) return
    setFileName(file.name)
    try {
      setPhoto(await resizeImage(file))
    } catch {
      setFileName('')
    }
  }
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bottom-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-icon blue"><ReceiptText size={21} /></div>
          <div><p>병원 기록</p><h2>영수증·처방전 촬영</h2></div>
          <button className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <label className={`upload-area ${fileName ? 'has-file' : ''}`}>
          <input type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />
          {fileName ? <><Check size={26} /><strong>{fileName}</strong><span>사진을 선택했어요</span></> : <><Camera size={30} /><strong>영수증이나 처방전을 선택하세요</strong><span>이번 버전에서는 사진을 안전하게 보관해드려요</span></>}
        </label>
        <div className="privacy-note"><FileText size={17} /><p>사진은 진료 기록 정리에만 사용되며, 언제든 삭제할 수 있어요.</p></div>
        <button className="primary-button full" disabled={!photo} onClick={() => onSave(photo)}>서류 등록하기</button>
      </div>
    </div>
  )
}

export { loadInitialData }
export default App
