import { createClient } from '@supabase/supabase-js'

// Chave publicável: pode ficar no front, o acesso é protegido pelas regras (RLS) do banco.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://tbdipwdxadqisoqnbwhq.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_lDjxWkouQnEViknasVpwjw_WdN4gw7E'

export const supabase = createClient(url, key)
export const SUPABASE_URL = url
