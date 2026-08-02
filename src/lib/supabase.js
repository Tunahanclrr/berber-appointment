import { createClient } from '@supabase/supabase-js'

// VITE_SUPABASE_URI onceki Vercel kurulumlarinda kullanilan addir.
const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URI
const key = import.meta.env.VITE_ANON_KEY

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL ve VITE_ANON_KEY .env dosyasında tanımlı olmalı.')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
