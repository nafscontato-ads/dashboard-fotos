export type Role = 'owner' | 'editor' | 'viewer'

export interface Operation {
  id: string
  name: string
  color: string
  ingest_token: string
  created_by: string | null
  created_at: string
}

export interface Member {
  operation_id: string
  email: string
  display_name: string | null
  share_pct: number
  role: Role
}

export interface DailyEntry {
  id: string
  operation_id: string
  day: string
  ad_spend: number
  revenue: number
  sales_count: number | null
  notes: string | null
}

export interface ExpenseCategory {
  id: string
  operation_id: string
  name: string
  kind: 'percent_spend' | 'manual'
  rate: number | null
  show_in_daily: boolean
  sort: number
}

export interface Expense {
  id: string
  operation_id: string
  category_id: string
  day: string
  amount: number
  note: string | null
}

export interface Sale {
  id: string
  operation_id: string
  amount: number
  paid_at: string
  payer_name: string | null
  source: string
  product_id?: string | null
}

export interface Product {
  id: string
  operation_id: string
  name: string
  price: number
  promo_price: number | null
  active: boolean
  sort: number
}
