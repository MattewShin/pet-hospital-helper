import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isEnabled = (value) => String(value || '').toLowerCase() === 'true'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

// OAuth 공급자 설정이 끝난 버튼만 노출합니다. 이 값들은 공개 여부 플래그일 뿐
// Client Secret 같은 인증 정보가 아니며, 실제 공급자 권한은 Supabase에서 관리합니다.
export const socialAuthProviders = [
  { id: 'google', provider: 'google', label: 'Google', enabled: isEnabled(import.meta.env.VITE_AUTH_GOOGLE_ENABLED) },
  { id: 'naver', provider: 'custom:naver', label: '네이버', enabled: isEnabled(import.meta.env.VITE_AUTH_NAVER_ENABLED) },
  { id: 'kakao', provider: 'kakao', label: '카카오', enabled: isEnabled(import.meta.env.VITE_AUTH_KAKAO_ENABLED) },
]
