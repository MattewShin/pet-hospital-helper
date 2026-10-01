import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'

const parseArray = (key) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

const parseObject = (key) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function dateLabel(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (todayKey(date) === todayKey(today)) return '오늘'
  if (todayKey(date) === todayKey(yesterday)) return '어제'
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`
}

function localTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value))
}

function timeMinutes(value) {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function petNotesToFields(notes) {
  try {
    const parsed = JSON.parse(notes || '{}')
    return { allergies: parsed.allergies || '', memo: parsed.memo || '' }
  } catch {
    return { allergies: notes || '', memo: '' }
  }
}

function petFromRow(row, photoUrl = '') {
  const notes = petNotesToFields(row.notes)
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    photo: photoUrl,
    photoPath: row.photo_url || '',
    breed: row.breed || '',
    sex: row.sex || '',
    birthDate: row.birth_date || '',
    weight: row.weight == null ? '' : String(row.weight),
    neutered: row.neutered || '',
    registrationNumber: row.registration_number || '',
    allergies: notes.allergies,
    memo: notes.memo,
  }
}

function timelineFromRow(row, author) {
  const detail = row.details || {}
  const label = dateLabel(row.occurred_at)
  return {
    id: row.id,
    petId: row.pet_id,
    createdBy: row.created_by,
    type: row.record_type,
    occurredAt: row.occurred_at,
    title: detail.title || row.record_type,
    detail: detail.detail || '세부 내용 미기록',
    note: detail.note || '',
    date: label,
    time: `${label} ${localTime(row.occurred_at)}`,
    timeMinutes: timeMinutes(row.occurred_at),
    author: author?.display_name || author?.email || '가족',
    authorCreatedAt: row.created_at,
    authorCreatedAtLabel: `${dateLabel(row.created_at)} ${localTime(row.created_at)}`,
    photoPath: row.photo_url || '',
    photo: '',
  }
}

function mealRecordFromRow(row, author) {
  const label = dateLabel(row.occurred_at)
  const skipped = row.status === 'skipped'
  return {
    id: row.id,
    petId: row.pet_id,
    createdBy: row.created_by,
    source: 'meal_record',
    type: 'meal',
    routineId: row.routine_id || '',
    routineTimeMinutes: row.routine_time_minutes == null ? null : Number(row.routine_time_minutes),
    localDate: row.local_date,
    mealStatus: row.status,
    foodName: row.food_name,
    amountGrams: row.amount_grams == null ? null : Number(row.amount_grams),
    plannedAmountGrams: row.planned_amount_grams == null ? null : Number(row.planned_amount_grams),
    occurredAt: row.occurred_at,
    title: skipped ? '식사 건너뜀' : '식사',
    detail: skipped ? `${row.food_name} · 건너뜀` : `${row.food_name} · ${Number(row.amount_grams)}g`,
    note: row.note || '',
    date: label,
    time: `${label} ${localTime(row.occurred_at)}`,
    timeMinutes: timeMinutes(row.occurred_at),
    author: author?.display_name || author?.email || '가족',
    authorCreatedAt: row.created_at,
    authorCreatedAtLabel: `${dateLabel(row.created_at)} ${localTime(row.created_at)}`,
    photoPath: row.photo_url || '',
    photo: '',
  }
}

function hospitalFromRow(row, author) {
  const detail = row.details || {}
  return {
    id: row.id,
    petId: row.pet_id,
    createdBy: row.created_by,
    source: detail.source || 'cloud',
    status: detail.status || '진료 기록',
    date: dateLabel(row.visited_at),
    visitedAt: row.visited_at,
    hospital: row.hospital_name || '병원명 미입력',
    reason: row.visit_reason,
    diagnosis: detail.diagnosis || row.visit_reason,
    opinion: detail.opinion || '',
    treatment: detail.treatment || '',
    items: detail.items || detail.treatment || '검사·처치 미입력',
    medication: row.prescription || '',
    amount: row.cost == null ? null : Number(row.cost),
    memo: detail.memo || '',
    author: author?.display_name || author?.email || '가족',
    authorCreatedAt: row.created_at,
    authorCreatedAtLabel: `${dateLabel(row.created_at)} ${localTime(row.created_at)}`,
    photoPath: row.photo_url || '',
    photo: '',
  }
}

async function signedMediaUrl(path) {
  if (!path) return ''
  if (path.startsWith('data:') || path.startsWith('http')) return path
  const { data } = await supabase.storage.from('pet-media').createSignedUrl(path, 60 * 60)
  return data?.signedUrl || ''
}

async function uploadDataUrl(householdId, userId, dataUrl, category) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl || null
  const blob = await (await fetch(dataUrl)).blob()
  const extension = blob.type.includes('png') ? 'png' : 'jpg'
  const path = `${householdId}/${userId}/${category}-${Date.now()}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('pet-media').upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw error
  return path
}

function legacyOccurredAt(record) {
  const date = new Date()
  if (record.date === '어제') date.setDate(date.getDate() - 1)
  const match = record.time?.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/)
  if (match) {
    let hour = Number(match[2]) % 12
    if (match[1] === '오후') hour += 12
    date.setHours(hour, Number(match[3]), 0, 0)
  }
  return date.toISOString()
}

function legacyVisitedAt(record) {
  const match = String(record.visitDate || record.date || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).toISOString() : new Date().toISOString()
}

export function readLegacyData() {
  const pets = parseArray('doke-pets-v1')
  const legacyProfile = parseObject('chunsik-care-profile')
  const legacyPhoto = window.localStorage.getItem('chunsik-care-photo') || ''
  const fallbackPet = (legacyProfile || legacyPhoto) ? [{ name: '춘식', ...legacyProfile, photo: legacyProfile?.photo || legacyPhoto, id: 'pet-chunsik' }] : null
  const resolvedPets = pets?.length ? pets : fallbackPet
  if (!resolvedPets?.length) return null
  return {
    pets: resolvedPets,
    events: parseArray('doke-events-v2') || parseArray('chunsik-care-events') || [],
    hospitalRecords: parseArray('doke-hospital-records-v2') || parseArray('doke-manual-hospital-records') || [],
  }
}

export function useDokeData(session) {
  const user = session.user
  const [state, setState] = useState({ loading: true, error: '', households: [], household: null, membership: null, pets: [], selectedPetId: '', events: [], hospitalRecords: [], mealRoutines: [], members: [], invitations: [], pendingInvitations: [], profile: null, legacyAvailable: false })

  const load = useCallback(async () => {
    try {
      const [{ data: profile }, { data: memberships, error: membershipError }, { data: pendingInvitations }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('household_members').select('household_id, role, status, joined_at, households(id, name, owner_id, created_at)').eq('user_id', user.id).eq('status', 'ACTIVE'),
        supabase.from('invitations').select('*, households(id, name)').eq('status', 'PENDING').gt('expires_at', new Date().toISOString()),
      ])
      if (membershipError) throw membershipError
      const householdChoices = (memberships || []).map((membership) => ({ ...membership.households, membership }))
      const savedHouseholdId = window.localStorage.getItem('doke-selected-household-id')
      const household = householdChoices.find((item) => item.id === savedHouseholdId) || householdChoices[0] || null
      if (!household) {
        const { data: migration } = await supabase.from('data_migrations').select('id').eq('user_id', user.id).eq('source', 'doke-local-v1').maybeSingle()
        setState((current) => ({ ...current, loading: false, error: '', households: householdChoices, household: null, membership: null, pendingInvitations: pendingInvitations || [], profile, legacyAvailable: Boolean(readLegacyData() && !migration) }))
        return
      }
      window.localStorage.setItem('doke-selected-household-id', household.id)
      const membership = household.membership
      const { data: petRows, error: petsError } = await supabase.from('pets').select('*').eq('household_id', household.id).order('created_at')
      if (petsError) throw petsError
      const petIds = (petRows || []).map((pet) => pet.id)
      const [timelineResponse, mealRecordResponse, hospitalResponse, mealRoutineResponse, membersResponse, invitationsResponse, migrationResponse] = await Promise.all([
        petIds.length ? supabase.from('timeline_records').select('*').in('pet_id', petIds).order('occurred_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        petIds.length ? supabase.from('meal_records').select('*').in('pet_id', petIds).order('occurred_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        petIds.length ? supabase.from('hospital_records').select('*').in('pet_id', petIds).order('visited_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        petIds.length ? supabase.from('meal_routines').select('*').in('pet_id', petIds).order('time_minutes') : Promise.resolve({ data: [], error: null }),
        supabase.from('household_members').select('*').eq('household_id', household.id).eq('status', 'ACTIVE').order('joined_at'),
        supabase.from('invitations').select('*').eq('household_id', household.id).order('created_at', { ascending: false }),
        supabase.from('data_migrations').select('id').eq('user_id', user.id).eq('source', 'doke-local-v1').maybeSingle(),
      ])
      const firstError = [timelineResponse, mealRecordResponse, hospitalResponse, mealRoutineResponse, membersResponse, invitationsResponse].find((response) => response.error)?.error
      if (firstError) throw firstError
      const creatorIds = [...new Set([...(timelineResponse.data || []), ...(mealRecordResponse.data || []), ...(hospitalResponse.data || []), ...(membersResponse.data || [])].map((item) => item.created_by || item.user_id).filter(Boolean))]
      const { data: profileRows } = creatorIds.length ? await supabase.from('profiles').select('*').in('id', creatorIds) : { data: [] }
      const profileMap = new Map((profileRows || []).map((item) => [item.id, item]))
      const pets = await Promise.all((petRows || []).map(async (row) => petFromRow(row, await signedMediaUrl(row.photo_url))))
      const selectedPetKey = `doke-selected-pet-${household.id}`
      const savedPetId = window.localStorage.getItem(selectedPetKey)
      const selectedPetId = pets.some((pet) => pet.id === savedPetId) ? savedPetId : pets[0]?.id || ''
      if (selectedPetId) window.localStorage.setItem(selectedPetKey, selectedPetId)
      const timelineEvents = await Promise.all((timelineResponse.data || []).map(async (row) => ({ ...timelineFromRow(row, profileMap.get(row.created_by)), photo: await signedMediaUrl(row.photo_url) })))
      const mealEvents = await Promise.all((mealRecordResponse.data || []).map(async (row) => ({ ...mealRecordFromRow(row, profileMap.get(row.created_by)), photo: await signedMediaUrl(row.photo_url) })))
      const events = [...timelineEvents, ...mealEvents].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
      const hospitalRecords = await Promise.all((hospitalResponse.data || []).map(async (row) => ({ ...hospitalFromRow(row, profileMap.get(row.created_by)), photo: await signedMediaUrl(row.photo_url) })))
      const mealRoutines = (mealRoutineResponse.data || []).map((row) => ({ id: row.id, petId: row.pet_id, timeMinutes: row.time_minutes, foodName: row.food_name || '사료', amountGrams: Number(row.amount_grams), active: row.active !== false, sortOrder: row.sort_order }))
      const members = (membersResponse.data || []).map((member) => ({ ...member, profile: profileMap.get(member.user_id) || null }))
      setState({ loading: false, error: '', households: householdChoices, household, membership, pets, selectedPetId, events, hospitalRecords, mealRoutines, members, invitations: invitationsResponse.data || [], pendingInvitations: pendingInvitations || [], profile, legacyAvailable: Boolean(readLegacyData() && !migrationResponse.data) })
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || '데이터를 불러오지 못했습니다.' }))
    }
  }, [user.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel(`doke-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_records' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_records' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_records' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_routines' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, user.id])

  const householdId = state.household?.id
  const isOwner = state.membership?.role === 'OWNER'

  const actions = useMemo(() => ({
    async createHousehold(name) {
      const { data, error } = await supabase.rpc('create_household', { household_name: name })
      if (error) throw error
      window.localStorage.setItem('doke-selected-household-id', data)
      await load()
      return data
    },
    async selectHousehold(id) {
      window.localStorage.setItem('doke-selected-household-id', id)
      await load()
    },
    selectPet(id) {
      if (!state.pets.some((pet) => pet.id === id)) throw new Error('접근할 수 없는 반려견입니다.')
      window.localStorage.setItem(`doke-selected-pet-${householdId}`, id)
      setState((current) => ({ ...current, selectedPetId: id }))
    },
    async createPet(pet) {
      if (!isOwner) throw new Error('관리자만 반려견을 추가할 수 있습니다.')
      const photoPath = await uploadDataUrl(householdId, user.id, pet.photo, 'pet')
      const { data, error } = await supabase.from('pets').insert({ household_id: householdId, name: pet.name, photo_url: photoPath, breed: pet.breed || null, sex: pet.sex || null, birth_date: pet.birthDate || null, weight: pet.weight || null, neutered: pet.neutered || null, notes: JSON.stringify({ allergies: pet.allergies || '', memo: pet.memo || '' }) }).select('id').single()
      if (error) throw error
      window.localStorage.setItem(`doke-selected-pet-${householdId}`, data.id)
      await load()
      return data.id
    },
    async updatePet(pet) {
      if (!isOwner) throw new Error('관리자만 반려견 프로필을 수정할 수 있습니다.')
      const photoPath = pet.photo?.startsWith('data:') ? await uploadDataUrl(householdId, user.id, pet.photo, 'pet') : pet.photoPath || null
      const { error } = await supabase.from('pets').update({ name: pet.name, photo_url: photoPath, breed: pet.breed || null, sex: pet.sex || null, birth_date: pet.birthDate || null, weight: pet.weight || null, neutered: pet.neutered || null, registration_number: pet.registrationNumber || null, notes: JSON.stringify({ allergies: pet.allergies || '', memo: pet.memo || '' }) }).eq('id', pet.id)
      if (error) throw error
      await load()
    },
    async updateAccountProfile(displayName) {
      const normalizedName = String(displayName || '').trim()
      if (!normalizedName) throw new Error('표시 이름을 입력해 주세요.')
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: normalizedName })
        .eq('id', user.id)
      if (error) throw error
      await load()
    },
    async replaceMealRoutines(petId, routines) {
      if (!isOwner) throw new Error('관리자만 식사 루틴을 수정할 수 있습니다.')
      if (!state.pets.some((pet) => pet.id === petId)) throw new Error('접근할 수 없는 반려견입니다.')
      const routineItems = routines.map((routine) => ({ id: routine.id, timeMinutes: Number(routine.timeMinutes), foodName: routine.foodName, amountGrams: Number(routine.amountGrams), active: routine.active !== false }))
      const { error } = await supabase.rpc('replace_meal_routines', { target_pet_id: petId, routine_items: routineItems })
      if (error) throw error
      await load()
    },
    async createMealRecord(record) {
      const photoPath = await uploadDataUrl(householdId, user.id, record.photo, 'meal')
      const localDate = record.localDate || todayKey(new Date(record.occurredAt))
      const { error } = await supabase.from('meal_records').insert({
        pet_id: record.petId,
        routine_id: record.routineId || null,
        routine_time_minutes: record.routineTimeMinutes ?? null,
        created_by: user.id,
        occurred_at: record.occurredAt,
        local_date: localDate,
        food_name: record.foodName,
        amount_grams: record.amountGrams,
        planned_amount_grams: record.plannedAmountGrams,
        status: record.status,
        note: record.note || null,
        photo_url: photoPath,
      })
      if (error?.code === '23505') throw new Error('이 예정 식사는 오늘 이미 확인했어요.')
      if (error) throw error
      await load()
    },
    async deleteMealRecord(id) {
      const { error } = await supabase.from('meal_records').delete().eq('id', id)
      if (error) throw error
      await load()
    },
    async createTimeline(record) {
      const photoPath = await uploadDataUrl(householdId, user.id, record.photo, 'timeline')
      const { error } = await supabase.from('timeline_records').insert({ pet_id: record.petId, created_by: user.id, record_type: record.type, occurred_at: record.occurredAt, details: record.details, photo_url: photoPath })
      if (error) throw error
      await load()
    },
    async deleteTimeline(id) {
      const { error } = await supabase.from('timeline_records').delete().eq('id', id)
      if (error) throw error
      await load()
    },
    async updateTimeline(record) {
      const photoPath = record.photo?.startsWith('data:') ? await uploadDataUrl(householdId, user.id, record.photo, 'timeline') : record.photoPath || null
      const { error } = await supabase.from('timeline_records').update({ occurred_at: record.occurredAt, details: record.details, photo_url: photoPath, updated_at: new Date().toISOString() }).eq('id', record.id)
      if (error) throw error
      await load()
    },
    async createHospital(record) {
      const photoPath = await uploadDataUrl(householdId, user.id, record.photo, 'hospital')
      const { error } = await supabase.from('hospital_records').insert({ pet_id: record.petId, created_by: user.id, visited_at: record.visitedAt, hospital_name: record.hospital || null, visit_reason: record.reason, details: record.details || {}, prescription: record.medication || null, cost: record.amount, photo_url: photoPath })
      if (error) throw error
      await load()
    },
    async updateHospital(record) {
      const photoPath = record.photo?.startsWith('data:') ? await uploadDataUrl(householdId, user.id, record.photo, 'hospital') : record.photoPath || null
      const { error } = await supabase.from('hospital_records').update({ visited_at: record.visitedAt, hospital_name: record.hospital || null, visit_reason: record.reason, details: record.details || {}, prescription: record.medication || null, cost: record.amount, photo_url: photoPath, updated_at: new Date().toISOString() }).eq('id', record.id)
      if (error) throw error
      await load()
    },
    async invite(email, accessToken) {
      if (!isOwner) throw new Error('관리자만 가족을 초대할 수 있습니다.')
      const response = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ householdId, email }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || '초대를 만들지 못했습니다.')
      await load()
      return body
    },
    async revokeInvitation(id) {
      if (!isOwner) throw new Error('관리자만 초대를 취소할 수 있습니다.')
      const { error } = await supabase.from('invitations').update({ status: 'REVOKED' }).eq('id', id)
      if (error) throw error
      await load()
    },
    async removeMember(id) {
      if (!isOwner) throw new Error('관리자만 구성원을 내보낼 수 있습니다.')
      const member = state.members.find((item) => item.id === id)
      if (member?.role === 'OWNER') throw new Error('관리자는 내보낼 수 없습니다.')
      const { error } = await supabase.from('household_members').update({ status: 'REMOVED' }).eq('id', id)
      if (error) throw error
      await load()
    },
    async acceptInvitation(id) {
      const { data, error } = await supabase.rpc('accept_invitation', { invitation_id: id })
      if (error) throw error
      if (!data) throw new Error('초대가 만료되었어요. 관리자에게 새 초대를 요청해 주세요.')
      await load()
    },
    async migrateLegacy(targetHouseholdId = householdId) {
      const legacy = readLegacyData()
      if (!legacy) throw new Error('이전할 로컬 기록이 없습니다.')
      if (!targetHouseholdId) throw new Error('먼저 가족 공간을 만들어 주세요.')
      const petIdMap = new Map()
      for (const [petIndex, pet] of legacy.pets.entries()) {
        const legacyPetId = String(pet.id ?? `pet-${petIndex}`)
        const photoPath = await uploadDataUrl(targetHouseholdId, user.id, pet.photo, 'legacy-pet').catch(() => null)
        const { data, error } = await supabase.from('pets').upsert({ household_id: targetHouseholdId, legacy_id: legacyPetId, name: pet.name || '반려견', photo_url: photoPath, breed: pet.breed || null, sex: pet.sex || null, birth_date: pet.birthDate || null, weight: pet.weight || null, neutered: pet.neutered || null, registration_number: pet.registrationNumber || null, notes: JSON.stringify({ allergies: pet.allergies || '', memo: pet.memo || '' }) }, { onConflict: 'household_id,legacy_id' }).select('id, legacy_id').single()
        if (error) throw error
        petIdMap.set(String(data.legacy_id), data.id)
      }
      const fallbackPetId = petIdMap.values().next().value
      for (const [recordIndex, record] of legacy.events.entries()) {
        const petId = petIdMap.get(String(record.petId)) || fallbackPetId
        const photoPath = await uploadDataUrl(targetHouseholdId, user.id, record.photo, 'legacy-timeline').catch(() => null)
        const { error } = await supabase.from('timeline_records').upsert({ pet_id: petId, legacy_id: String(record.id ?? `timeline-${recordIndex}`), created_by: user.id, record_type: record.type || 'custom', occurred_at: legacyOccurredAt(record), details: { title: record.title, detail: record.detail, note: record.note, originalAuthor: record.author }, photo_url: photoPath }, { onConflict: 'pet_id,legacy_id' })
        if (error) throw error
      }
      for (const [recordIndex, record] of legacy.hospitalRecords.entries()) {
        const petId = petIdMap.get(String(record.petId)) || fallbackPetId
        const photoPath = await uploadDataUrl(targetHouseholdId, user.id, record.photo, 'legacy-hospital').catch(() => null)
        const { error } = await supabase.from('hospital_records').upsert({ pet_id: petId, legacy_id: String(record.id ?? `hospital-${recordIndex}`), created_by: user.id, visited_at: legacyVisitedAt(record), hospital_name: record.hospital || null, visit_reason: record.reason || record.diagnosis || '병원 방문', details: { source: record.source || 'legacy', status: record.status, diagnosis: record.diagnosis, opinion: record.opinion, treatment: record.treatment, items: record.items, memo: record.memo, originalAuthor: record.author }, prescription: record.medication || null, cost: record.amount || null, photo_url: photoPath }, { onConflict: 'pet_id,legacy_id' })
        if (error) throw error
      }
      const { error: migrationError } = await supabase.from('data_migrations').upsert({ user_id: user.id, household_id: targetHouseholdId, source: 'doke-local-v1' }, { onConflict: 'user_id,source' })
      if (migrationError) throw migrationError
      window.localStorage.setItem(`doke-cloud-migrated-${user.id}`, 'true')
      await load()
    },
    reload: load,
  }), [householdId, isOwner, load, session.access_token, state.members, state.pets, user.id])

  return { ...state, isOwner, actions }
}
