import { createClient } from '@supabase/supabase-js'

const json = (response, status, body) => response.status(status).json(body)

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'POST 요청만 지원합니다.' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(response, 503, { error: '서버의 Supabase 환경 변수가 설정되지 않았습니다.' })
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return json(response, 401, { error: '로그인이 필요합니다.' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return json(response, 401, { error: '유효하지 않은 로그인 세션입니다.' })

  const householdId = String(request.body?.householdId || '')
  const invitedEmail = String(request.body?.email || '').trim().toLowerCase()
  if (!householdId || !/^\S+@\S+\.\S+$/.test(invitedEmail)) {
    return json(response, 400, { error: '가족 공간과 올바른 이메일을 입력해 주세요.' })
  }

  const { data: ownerMembership } = await admin
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', authData.user.id)
    .eq('role', 'OWNER')
    .eq('status', 'ACTIVE')
    .maybeSingle()
  if (!ownerMembership) return json(response, 403, { error: '관리자만 가족을 초대할 수 있습니다.' })

  const { data: invitation, error: insertError } = await admin
    .from('invitations')
    .insert({ household_id: householdId, invited_email: invitedEmail, role: 'MEMBER', created_by: authData.user.id })
    .select('id, invited_email, status, expires_at, created_at')
    .single()
  if (insertError) {
    const message = insertError.code === '23505' ? '이미 대기 중인 초대가 있습니다.' : insertError.message
    return json(response, 409, { error: message })
  }

  const appUrl = process.env.APP_URL || request.headers.origin
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(invitedEmail, {
    redirectTo: `${appUrl}/?invitation=${invitation.id}`,
    data: { invitation_id: invitation.id },
  })

  return json(response, 200, {
    invitation,
    emailSent: !emailError,
    deliveryMessage: emailError
      ? '초대 레코드는 생성됐지만 이메일은 발송되지 않았습니다. 기존 가입자는 로그인 후 대기 중 초대를 수락할 수 있습니다.'
      : '초대 이메일을 발송했습니다.',
  })
}
