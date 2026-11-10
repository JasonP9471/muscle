import { createClient } from '@supabase/supabase-js'
import { cloudConfig } from '../../config/cloud'

export const supabaseClient = createClient(cloudConfig.supabaseUrl, cloudConfig.publishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})
