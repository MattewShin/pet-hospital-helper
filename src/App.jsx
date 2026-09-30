import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Apple,
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  Home,
  MapPin,
  MoreHorizontal,
  PawPrint,
  Pill,
  Plus,
  ReceiptText,
  Save,
  Share2,
  Sparkles,
  Stethoscope,
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

const symptoms = [
  { id: 'vomit', label: '구토', icon: Activity, color: 'coral' },
  { id: 'meal', label: '식사', icon: Apple, color: 'green' },
  { id: 'medicine', label: '투약', icon: Pill, color: 'blue' },
  { id: 'stool', label: '배변', icon: Sparkles, color: 'amber' },
]

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

const hospitalRecords = [
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

const navItems = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'timeline', label: '타임라인', icon: Clock3 },
  { id: 'briefing', label: '진료 브리핑', icon: ClipboardList },
  { id: 'records', label: '병원 기록', icon: ReceiptText },
  { id: 'profile', label: '프로필', icon: UserRound },
]

const formatWon = (value) => `${value.toLocaleString('ko-KR')}원`

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(() => {
    try {
      const saved = window.localStorage.getItem('chunsik-care-profile')
      const legacyPhoto = window.localStorage.getItem('chunsik-care-photo') || ''
      return saved ? { ...defaultProfile, ...JSON.parse(saved) } : { ...defaultProfile, photo: legacyPhoto }
    } catch {
      return defaultProfile
    }
  })
  const [events, setEvents] = useState(() => {
    try {
      const saved = window.localStorage.getItem('chunsik-care-events')
      if (!saved) return initialEvents
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed)
        ? parsed.map((event, index) => ({ ...event, author: event.author || (index % 2 === 0 ? 'Theo님' : '배우자님') }))
        : initialEvents
    } catch {
      return initialEvents
    }
  })
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  const vomitCount = events.filter((event) => event.type === 'vomit').length
  const totalSpent = hospitalRecords.reduce((sum, record) => sum + record.amount, 0)

  useEffect(() => {
    window.localStorage.setItem('chunsik-care-events', JSON.stringify(events))
  }, [events])

  useEffect(() => {
    window.localStorage.setItem('chunsik-care-profile', JSON.stringify(profile))
  }, [profile])

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
      setProfile((current) => ({ ...current, photo: resized }))
      notify('춘식이 사진을 등록했어요')
    } catch {
      notify('사진을 불러오지 못했어요')
    }
  }

  const addEvent = (form) => {
    const symptom = symptoms.find((item) => item.id === form.type)
    const detailMap = {
      vomit: `${form.appearance || '형태 미기록'} · ${form.amount || '양 미기록'}`,
      meal: `${form.appearance || '사료'} · ${form.amount || '섭취량 미기록'}`,
      medicine: `${form.appearance || '약 이름 미기록'} · ${form.amount || '용량 미기록'}`,
      stool: `${form.appearance || '상태 미기록'} · ${form.amount || '양 미기록'}`,
    }
    setEvents((current) => [
      {
        id: Date.now(),
        type: form.type,
        title: symptom.label,
        time: `오늘 ${form.time || '방금'}`,
        detail: detailMap[form.type],
        note: form.note,
        date: '오늘',
        author: '나',
      },
      ...current,
    ])
    setSheet(null)
    notify(`${symptom.label} 기록을 저장했어요`)
  }

  const copyBriefing = async () => {
    const text = `${profile.name} · ${profile.breed} · ${profile.sex} · ${getAgeLabel(profile.birthDate)} · ${profile.weight || '-'}kg\n중성화: ${profile.neutered} · 알레르기: ${profile.allergies || '기록 없음'}\n\n[내원 이유]\n최근 반복되는 구토 증상\n\n[최근 경과]\n- 최근 24시간 구토 ${vomitCount}회\n- 마지막 구토: 오늘 오전 8:42\n- 노란색 거품, 소량\n- 식욕은 평소의 약 80%\n\n[복용 중인 약]\n위장약(가스모틴 1/2정), 하루 2회`
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
        <div className="side-pet-card">
          <PetAvatar photo={profile.photo} name={profile.name} large />
          <div>
            <strong>{profile.name}</strong>
            <p>{profile.breed} · {getAgeLabel(profile.birthDate)}</p>
          </div>
        </div>
        <nav className="side-nav" aria-label="주 메뉴">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
          ))}
        </nav>
        <div className="side-help">
          <HeartPulse size={20} />
          <strong>응급 상황인가요?</strong>
          <p>반복 구토와 무기력이 함께 나타나면 바로 병원에 문의하세요.</p>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-brand">
          <div className="brand-mark"><PawPrint size={19} strokeWidth={2.2} /></div>
          <div className="brand-copy"><strong>도케</strong><span>DOG CARE, TOGETHER</span><p>가족과 함께 기록하는 우리 강아지 건강관리</p></div>
        </div>
        {activeTab === 'home' && (
          <HomeScreen
            events={events}
            vomitCount={vomitCount}
            onQuickAdd={(type) => setSheet({ type })}
            onNavigate={setActiveTab}
            profile={profile}
            onScanDocument={() => setSheet({ type: 'receipt' })}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineScreen events={events} onQuickAdd={(type) => setSheet({ type })} onDelete={(id) => setEvents((items) => items.filter((event) => event.id !== id))} />
        )}
        {activeTab === 'briefing' && (
          <BriefingScreen count={vomitCount} copied={copied} onCopy={copyBriefing} onPrint={() => window.print()} profile={profile} />
        )}
        {activeTab === 'records' && (
          <RecordsScreen records={hospitalRecords} total={totalSpent} onAdd={() => setSheet({ type: 'receipt' })} />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen profile={profile} onSave={(nextProfile) => { setProfile(nextProfile); notify('프로필을 저장했어요') }} onPhotoChange={registerPetPhoto} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
        ))}
      </nav>

      {sheet?.type === 'receipt' ? (
        <ReceiptSheet onClose={() => setSheet(null)} onSave={() => { setSheet(null); notify('영수증을 보관함에 추가했어요') }} />
      ) : sheet ? (
        <LogSheet type={sheet.type} onClose={() => setSheet(null)} onSave={addEvent} />
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

function NavButton({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
      <span>{item.label}</span>
    </button>
  )
}

function Header({ eyebrow, title, action = true }) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {action && <button className="icon-button" aria-label="알림"><Bell size={21} /><span className="notification-dot" /></button>}
    </header>
  )
}

function HomeScreen({ events, vomitCount, onQuickAdd, onNavigate, profile, onScanDocument }) {
  const latestMeal = events.find((event) => event.type === 'meal')
  const mealMatch = latestMeal?.detail?.match(/\d+(?:\.\d+)?\s*g/i)
  const mealGrams = mealMatch ? mealMatch[0].replace(/[^\d.]/g, '') : null
  const lastRecord = events[0]

  return (
    <div className="screen home-screen">
      <Header eyebrow="9월 30일 수요일" title={<>좋은 아침이에요, <span>{profile.name} 보호자님</span></>} />

      <section className="condition-card">
        <div className="condition-topline">
          <PetAvatar photo={profile.photo} name={profile.name} />
          <div className="condition-title">
            <p>{profile.name}의 오늘</p>
            <h2>조금 더 지켜봐 주세요</h2>
          </div>
          <button className="more-button" aria-label="더 보기"><MoreHorizontal size={21} /></button>
        </div>
        <div className="condition-stats">
          <div><strong>{profile.weight || '—'}{profile.weight && <small>kg</small>}</strong><span>현재 몸무게</span></div>
          <div><strong>{mealGrams || '—'}{mealGrams && <small>g</small>}</strong><span>최근 식사량</span></div>
          <div><strong>보통</strong><span>활동량</span></div>
        </div>
        <div className="care-message">
          <Sparkles size={17} />
          <div>
            <p><strong>기록 기반 관찰</strong> · 어제 구토 기록이 있어 오늘 식사량과 활력을 함께 살펴봐요.</p>
            <span>다음 행동 · 저녁 위장약을 오후 6:30에 챙겨주세요.</span>
          </div>
        </div>
      </section>

      <section className="shared-care-card">
        <div className="shared-care-heading">
          <div className="shared-care-title"><span><UsersRound size={18} /></span><div><p>가족과 함께</p><h2>오늘의 공동 돌봄</h2></div></div>
          <strong className="pending-pill">1건 대기</strong>
        </div>
        <div className="shared-care-details">
          <div><span>마지막 기록</span><strong>{lastRecord?.author || 'Theo님'} · {lastRecord?.time?.replace('오늘 ', '') || '오전 8:42'}</strong></div>
          <div><span>다음 할 일</span><strong>저녁 위장약 · 오후 6:30</strong></div>
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

function TimelineScreen({ events, onQuickAdd, onDelete }) {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? events : events.filter((event) => event.type === filter)
  const grouped = filtered.reduce((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event]
    return acc
  }, {})

  return (
    <div className="screen">
      <Header eyebrow="춘식이의 하루를 한눈에" title="건강 타임라인" />
      <div className="filter-row">
        {[['all', '전체'], ...symptoms.map((item) => [item.id, item.label])].map(([id, label]) => (
          <button key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <div className="timeline-groups">
        {Object.entries(grouped).map(([date, items]) => (
          <section key={date}>
            <div className="date-divider"><span>{date}</span><i /></div>
            <div className="timeline-list">
              {items.map((event) => <TimelineItem key={event.id} event={event} onDelete={onDelete} />)}
            </div>
          </section>
        ))}
      </div>
      <button className="floating-add" onClick={() => onQuickAdd('vomit')}><Plus size={22} /> 기록 추가</button>
    </div>
  )
}

function TimelineItem({ event, onDelete }) {
  const type = symptoms.find((item) => item.id === event.type) || symptoms[0]
  const Icon = type.icon
  return (
    <article className="timeline-item">
      <div className={`timeline-icon ${type.color}`}><Icon size={19} /></div>
      <div className="timeline-copy">
        <div className="timeline-title"><strong>{event.title}</strong><time>{event.time.replace(`${event.date} `, '')}</time></div>
        <p>{event.detail}</p>
        {event.author && <small className="timeline-author">{event.author} 기록</small>}
        {event.note && <span>{event.note}</span>}
      </div>
      {onDelete && <button className="delete-button" onClick={() => onDelete(event.id)} aria-label="기록 삭제"><Trash2 size={16} /></button>}
    </article>
  )
}

function BriefingScreen({ count, copied, onCopy, onPrint, profile }) {
  const [period, setPeriod] = useState('24시간')
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
          <div><span>자동 요약</span><h2>반복되는 구토 증상</h2></div>
          <span className="generated-badge"><Sparkles size={14} /> 기록 기반</span>
        </div>
        <div className="document-alert"><Activity size={19} /><p>최근 {period} 동안 구토가 <strong>{count}회</strong> 기록됐습니다.</p></div>
        <BriefingSection title="기본 정보">
          <ul>
            <li><span>성별 · 중성화</span><strong>{profile.sex} · {profile.neutered}</strong></li>
            <li><span>현재 몸무게</span><strong>{profile.weight ? `${profile.weight}kg` : '미입력'}</strong></li>
            <li><span>알레르기</span><strong>{profile.allergies || '기록 없음'}</strong></li>
          </ul>
        </BriefingSection>
        <BriefingSection title="증상 경과">
          <ul>
            <li><span>마지막 증상</span><strong>오늘 오전 8:42</strong></li>
            <li><span>구토 양상</span><strong>노란색 거품, 소량</strong></li>
            <li><span>동반 증상</span><strong>특이사항 없음</strong></li>
          </ul>
        </BriefingSection>
        <BriefingSection title="식사 및 활동">
          <ul>
            <li><span>식사량</span><strong>평소의 약 80%</strong></li>
            <li><span>음수량</span><strong>평소와 비슷함</strong></li>
            <li><span>활동량</span><strong>보통</strong></li>
          </ul>
        </BriefingSection>
        <BriefingSection title="복용 중인 약">
          <div className="medicine-row"><div className="medicine-icon"><Pill size={18} /></div><div><strong>가스모틴 ½정</strong><p>하루 2회 · 식후 30분</p></div></div>
        </BriefingSection>
        <div className="question-box"><strong>수의사에게 물어볼 것</strong><p>공복성 구토일 가능성이 있는지, 사료 급여 간격을 조절해야 하는지 궁금해요.</p></div>
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

function ProfileScreen({ profile, onSave, onPhotoChange }) {
  const [draft, setDraft] = useState(profile)

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...draft, photo: profile.photo })
  }

  return (
    <div className="screen profile-screen">
      <Header eyebrow="건강 기록의 기준 정보" title="반려견 프로필" />

      <section className="profile-hero">
        <PetAvatar photo={profile.photo} name={draft.name || '반려견'} onPhotoChange={onPhotoChange} profile />
        <div>
          <span>대표 사진</span>
          <h2>{draft.name || '이름을 입력해 주세요'}</h2>
          <p>사진은 여기에서만 등록하거나 변경할 수 있어요.</p>
        </div>
      </section>

      <form className="profile-form" onSubmit={submit}>
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

        <div className="profile-save-bar">
          <p>{draft.birthDate ? `${getAgeLabel(draft.birthDate)} · ` : ''}{draft.breed || '품종 미입력'} · {draft.weight ? `${draft.weight}kg` : '몸무게 미입력'}</p>
          <button className="primary-button" type="submit"><Save size={18} /> 프로필 저장</button>
        </div>
      </form>
    </div>
  )
}

function RecordsScreen({ records, total, onAdd }) {
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
        <button className="outline-small" onClick={onAdd}><Plus size={15} /> 영수증 추가</button>
      </div>
      <div className="record-list">
        {records.map((record) => (
          <article className="record-card" key={record.id}>
            <div className="record-date"><CalendarDays size={18} /><span>{record.date}</span><span className="status-pill">{record.status}</span></div>
            <h3>{record.hospital}</h3>
            <div className="diagnosis"><Stethoscope size={17} /><div><span>진단</span><strong>{record.diagnosis}</strong></div></div>
            <p>{record.items}</p>
            {expanded === record.id && (
              <div className="record-detail">
                <span><b>결제 방법</b> 신용카드</span>
                <span><b>보관 서류</b> 진료비 영수증 · 처방전</span>
              </div>
            )}
            <div className="record-footer"><strong>{formatWon(record.amount)}</strong><button onClick={() => setExpanded(expanded === record.id ? null : record.id)}>{expanded === record.id ? '접기' : '상세 보기'} <ChevronRight size={15} className={expanded === record.id ? 'rotate' : ''} /></button></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function LogSheet({ type, onClose, onSave }) {
  const selected = symptoms.find((item) => item.id === type)
  const [form, setForm] = useState({ type, time: new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }), appearance: '', amount: '', note: '' })
  const [photoName, setPhotoName] = useState('')
  const placeholders = useMemo(() => ({
    vomit: ['예: 노란색 거품', '예: 소량'],
    meal: ['예: 건식 사료', '예: 42g, 80%'],
    medicine: ['예: 가스모틴', '예: ½정'],
    stool: ['예: 무른 변', '예: 보통'],
  })[type], [type])
  const Icon = selected.icon

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="bottom-sheet" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className={`sheet-title-icon ${selected.color}`}><Icon size={21} /></div>
          <div><p>빠른 기록</p><h2>{selected.label} 기록하기</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <label>발생 시간<input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
        <div className="form-columns">
          <label>{type === 'medicine' ? '약 이름' : type === 'meal' ? '종류' : '상태'}<input placeholder={placeholders[0]} value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.target.value })} /></label>
          <label>{type === 'medicine' ? '복용량' : type === 'meal' ? '섭취량' : '양'}<input placeholder={placeholders[1]} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        </div>
        <label>메모<textarea placeholder="상황이나 특이사항을 남겨주세요" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <label className="photo-button">
          <input type="file" accept="image/*" onChange={(e) => setPhotoName(e.target.files?.[0]?.name || '')} />
          {photoName ? <Check size={18} /> : <Camera size={18} />} {photoName || '사진도 함께 남기기'}
        </label>
        <button className="primary-button full" type="submit">기록 저장</button>
      </form>
    </div>
  )
}

function ReceiptSheet({ onClose, onSave }) {
  const [fileName, setFileName] = useState('')
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bottom-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title-icon blue"><ReceiptText size={21} /></div>
          <div><p>병원 기록</p><h2>영수증 추가하기</h2></div>
          <button className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <label className={`upload-area ${fileName ? 'has-file' : ''}`}>
          <input type="file" accept="image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
          {fileName ? <><Check size={26} /><strong>{fileName}</strong><span>사진을 선택했어요</span></> : <><Camera size={30} /><strong>영수증을 촬영하거나 선택하세요</strong><span>병원명, 진료일, 금액을 자동으로 읽어드려요</span></>}
        </label>
        <div className="privacy-note"><FileText size={17} /><p>사진은 진료 기록 정리에만 사용되며, 언제든 삭제할 수 있어요.</p></div>
        <button className="primary-button full" disabled={!fileName} onClick={onSave}>영수증 분석하기</button>
      </div>
    </div>
  )
}

export default App
