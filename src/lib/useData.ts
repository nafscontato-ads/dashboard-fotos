import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { DailyEntry, Expense, ExpenseCategory, Member, Operation, Product, Sale } from './types'

export interface Data {
  operations: Operation[]
  members: Member[]
  entries: DailyEntry[]
  categories: ExpenseCategory[]
  expenses: Expense[]
  sales: Sale[]
  products: Product[]
}

const empty: Data = { operations: [], members: [], entries: [], categories: [], expenses: [], sales: [], products: [] }

async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < 1000) return out
  }
}

/** Carrega tudo que o usuário pode ver e recarrega sozinho quando alguém muda algo (Supabase Realtime). */
export function useData(enabled: boolean) {
  const [data, setData] = useState<Data>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    try {
      const [operations, members, entries, categories, expenses, sales, products] = await Promise.all([
        fetchAll<Operation>('operations', 'created_at'),
        fetchAll<Member>('operation_members', 'created_at'),
        fetchAll<DailyEntry>('daily_entries', 'day'),
        fetchAll<ExpenseCategory>('expense_categories', 'sort'),
        fetchAll<Expense>('expenses', 'day'),
        fetchAll<Sale>('sales', 'paid_at'),
        // pacotes: se a tabela ainda não existe, o painel funciona sem eles
        fetchAll<Product>('products', 'sort').catch(() => [] as Product[]),
      ])
      setData({ operations, members, entries, categories, expenses, sales, products })
      setUpdatedAt(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // várias mudanças seguidas viram um único recarregamento
  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(reload, 250)
  }, [reload])

  useEffect(() => {
    if (!enabled) return
    reload()
    const channel = supabase.channel('painel')
    for (const table of ['operations', 'operation_members', 'daily_entries', 'expense_categories', 'expenses', 'sales']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    }
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'))
    // canal separado: se a tabela de pacotes ainda não foi criada, não derruba o resto
    const extra = supabase.channel('painel-pacotes').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, schedule).subscribe()
    // ao voltar pro app (celular), garante que está atualizado
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(extra)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
    }
  }, [enabled, reload, schedule])

  return { data, loading, error, live, reload, updatedAt }
}
