const json = (response, status, body) => {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, 405, { error: 'GET 요청만 지원합니다.' })

  const authorization = request.headers.authorization
  if (!authorization?.match(/^Bearer\s+\S+/i)) {
    return json(response, 401, { error: '네이버 access token이 필요합니다.' })
  }

  try {
    const naverResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: authorization },
    })
    const payload = await naverResponse.json().catch(() => null)
    const profile = payload?.response

    if (!naverResponse.ok || payload?.resultcode !== '00' || !profile?.id) {
      return json(response, 401, { error: '네이버 사용자 정보를 확인하지 못했습니다.' })
    }
    if (!profile.email || !/^\S+@\S+\.\S+$/.test(profile.email)) {
      return json(response, 422, {
        error: 'email_consent_required',
        error_description: '도케 가족 초대에는 이메일이 필요합니다. 네이버 로그인 동의 화면에서 이메일 제공을 허용해 주세요.',
      })
    }

    // Custom OAuth가 읽을 수 있도록 네이버의 response 중첩 구조를 표준 claim으로 평탄화합니다.
    // Naver가 email_verified 값을 제공하지 않으므로 임의로 true라고 주장하지 않습니다.
    return json(response, 200, {
      sub: `naver:${profile.id}`,
      email: String(profile.email).trim().toLowerCase(),
      name: profile.name || profile.nickname || '',
      nickname: profile.nickname || profile.name || '',
      picture: profile.profile_image || '',
    })
  } catch {
    return json(response, 502, { error: '네이버 사용자 정보 서버에 연결하지 못했습니다.' })
  }
}
