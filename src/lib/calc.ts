import type { DailyEntry, Expense, ExpenseCategory, Member, Operation } from './types'

export interface Range { from: string; to: string }

export interface DayRow {
  day: string
  spend: number
  revenue: number
  sales: number | null
  byCategory: Record<string, number> // nome da categoria -> valor
  tax: number // imposto Meta (categorias em % sobre o gasto), ligado ou não
  expenses: number // só as despesas ligadas
  profit: number // lucro líquido com as despesas ligadas
}

export interface Totals {
  spend: number
  revenue: number
  sales: number
  hasSales: boolean
  expenses: number
  byCategory: Record<string, number>
  tax: number
  taxOn: boolean
  grossProfit: number // retorno - gasto
  profit: number // lucro líquido
  myProfit: number
  days: number
}

const inRange = (d: string, r: Range) => d >= r.from && d <= r.to

/**
 * Junta os lançamentos de várias operações por dia, aplicando só as despesas ligadas.
 * `disabled` guarda os NOMES das categorias desligadas, assim "Editor (Valtécio)"
 * desliga em todas as operações de uma vez.
 */
export function computeDays(
  ops: Operation[],
  entries: DailyEntry[],
  categories: ExpenseCategory[],
  expenses: Expense[],
  range: Range,
  disabled: Set<string>,
): DayRow[] {
  const opIds = new Set(ops.map((o) => o.id))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const rows = new Map<string, DayRow>()
  const row = (day: string) => {
    let r = rows.get(day)
    if (!r) {
      r = { day, spend: 0, revenue: 0, sales: null, byCategory: {}, tax: 0, expenses: 0, profit: 0 }
      rows.set(day, r)
    }
    return r
  }

  for (const e of entries) {
    if (!opIds.has(e.operation_id) || !inRange(e.day, range)) continue
    const r = row(e.day)
    r.spend += Number(e.ad_spend)
    r.revenue += Number(e.revenue)
    if (e.sales_count != null) r.sales = (r.sales ?? 0) + e.sales_count
    for (const c of categories) {
      if (c.operation_id !== e.operation_id || c.kind !== 'percent_spend') continue
      const v = (Number(e.ad_spend) * Number(c.rate ?? 0)) / 100
      r.byCategory[c.name] = (r.byCategory[c.name] ?? 0) + v
      r.tax += v
    }
  }
  for (const x of expenses) {
    if (!opIds.has(x.operation_id) || !inRange(x.day, range)) continue
    const c = catById.get(x.category_id)
    if (!c) continue
    const r = row(x.day)
    r.byCategory[c.name] = (r.byCategory[c.name] ?? 0) + Number(x.amount)
  }
  for (const r of rows.values()) {
    r.expenses = Object.entries(r.byCategory).reduce((s, [k, v]) => (disabled.has(k) ? s : s + v), 0)
    r.profit = r.revenue - r.spend - r.expenses
  }
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export function totalsOf(rows: DayRow[], disabled: Set<string>, myShare = 1, taxNames: string[] = ['Imposto Meta']): Totals {
  const t: Totals = {
    spend: 0, revenue: 0, sales: 0, hasSales: false, expenses: 0, byCategory: {}, tax: 0, taxOn: true,
    grossProfit: 0, profit: 0, myProfit: 0, days: rows.length,
  }
  for (const r of rows) {
    t.spend += r.spend
    t.revenue += r.revenue
    t.tax += r.tax
    if (r.sales != null) { t.sales += r.sales; t.hasSales = true }
    for (const [k, v] of Object.entries(r.byCategory)) t.byCategory[k] = (t.byCategory[k] ?? 0) + v
  }
  t.expenses = Object.entries(t.byCategory).reduce((s, [k, v]) => (disabled.has(k) ? s : s + v), 0)
  t.taxOn = !taxNames.some((n) => disabled.has(n))
  t.grossProfit = t.revenue - t.spend
  t.profit = t.grossProfit - t.expenses
  t.myProfit = t.profit * myShare
  return t
}

/** Minha parte (0–1) numa operação, pelo e-mail logado. */
export function myShareOf(members: Member[], opId: string, email: string) {
  const m = members.find((x) => x.operation_id === opId && x.email.toLowerCase() === email.toLowerCase())
  return m ? Number(m.share_pct) / 100 : 0
}

export function groupByMonth(rows: DayRow[]) {
  const map = new Map<string, DayRow[]>()
  for (const r of rows) {
    const k = r.day.slice(0, 7)
    map.set(k, [...(map.get(k) ?? []), r])
  }
  return map
}
