const DEFAULT_SUPABASE_URL = 'https://hthpdsxnbykkqgiyciwj.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vWgEfJ1H9FnuqCg3nBDKfw_3Fe46L7F'
const TRAINOS_APP_URL = 'https://trainos-pilot.jayp94.chatgpt.site'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const cloudConfig = {
  supabaseUrl: (configuredUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, ''),
  publishableKey: configuredKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  appUrl: TRAINOS_APP_URL,
  enabled: import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'false' && import.meta.env.VITE_DEMO_MODE !== 'true',
} as const
