import { supabase } from './supabase'
import type { DailyEntry, Expense } from './types'

type Result = { error: { message: string } | null }

/** Grava (ou cria) o lançamento do dia de uma operação. */
export function saveEntry(opId: string, day: string, patch: Partial<DailyEntry>, exists: boolean): PromiseLike<Result> {
  return supabase.from('daily_entries').upsert(
    { operation_id: opId, day, ...(exists ? {} : { ad_spend: 0, revenue: 0 }), ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'operation_id,day' },
  )
}

/** Define o valor de uma despesa diária (ex.: editor) num dia. Zero apaga o lançamento. */
export async function setDailyExpense(opId: string, categoryId: string, day: string, amount: number, expenses: Expense[]): Promise<Result> {
  const existing = expenses.filter((x) => x.category_id === categoryId && x.day === day)
  if (existing.length === 1 && amount > 0) {
    return supabase.from('expenses').update({ amount }).eq('id', existing[0].id)
  }
  if (existing.length) {
    const r = await supabase.from('expenses').delete().in('id', existing.map((x) => x.id))
    if (r.error) return r
  }
  if (amount > 0) return supabase.from('expenses').insert({ operation_id: opId, category_id: categoryId, day, amount })
  return { error: null }
}
