import { RefreshCw } from 'lucide-react'
import type { Range } from '../lib/calc'
import { money, toISO } from '../lib/format'
import type { Operation } from '../lib/types'
import { Switch } from './ui'

export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastmonth' | 'all' | 'custom'

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'lastmonth', label: 'Mês passado' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Escolher datas' },
]

export function rangeFor(p: Preset, custom: Range): Range {
  const now = new Date()
  const d = (offset: number) => toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
  switch (p) {
    case 'today': return { from: d(0), to: d(0) }
    case 'yesterday': return { from: d(-1), to: d(-1) }
    // igual ao Gerenciador do Meta: não conta o dia de hoje
    case '7d': return { from: d(-7), to: d(-1) }
    case '30d': return { from: d(-30), to: d(-1) }
    case 'month': return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: d(0) }
    case 'lastmonth': return {
      from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
    case 'all': return { from: '2000-01-01', to: '2999-12-31' }
    case 'custom': return custom
  }
}

export interface FilterState {
  preset: Preset
  custom: Range
  op: string // 'all' ou id da operação
  product: string // 'all' ou nome do pacote
}

function ago(d: Date | null, now: number) {
  if (!d) return 'Carregando…'
  const s = Math.round((now - d.getTime()) / 1000)
  if (s < 60) return 'Atualizado agora mesmo'
  const m = Math.round(s / 60)
  return `Atualizado há ${m} min`
}

/** Cartão de filtros do topo, no jeito da UTMify: período, operação e pacote. */
export function FilterCard({ title, f, set, ops, products, updatedAt, now, refreshing, onRefresh, allowAllOps = true, showProduct = true }: {
  title: string
  f: FilterState
  set: (patch: Partial<FilterState>) => void
  ops: Operation[]
  products: string[]
  updatedAt: Date | null
  now: number
  refreshing: boolean
  onRefresh: () => void
  allowAllOps?: boolean
  showProduct?: boolean
}) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-line-dark">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{ago(updatedAt, now)}</p>
        </div>
        <button className="btn-primary h-10 shrink-0 px-5" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-3 ${showProduct ? 'lg:grid-cols-3' : ''}`}>
        <div>
          <label className="label">Período</label>
          <select className="input" value={f.preset} onChange={(e) => set({ preset: e.target.value as Preset })}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Operação</label>
          <select className="input" value={f.op} onChange={(e) => set({ op: e.target.value })}>
            {allowAllOps && <option value="all">Todas</option>}
            {ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        {showProduct && (
          <div className="col-span-2 lg:col-span-1">
            <label className="label">Pacotes</label>
            <select className="input" value={f.product} onChange={(e) => set({ product: e.target.value })}>
              <option value="all">Qualquer</option>
              {products.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        {f.preset === 'custom' && (
          <>
            <div>
              <label className="label">De</label>
              <input type="date" className="input" value={f.custom.from} onChange={(e) => set({ custom: { ...f.custom, from: e.target.value } })} />
            </div>
            <div>
              <label className="label">Até</label>
              <input type="date" className="input" value={f.custom.to} onChange={(e) => set({ custom: { ...f.custom, to: e.target.value } })} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/** Liga/desliga cada despesa para ver o lucro com e sem ela. */
export function ExpenseToggles({ names: all, amounts, disabled, toggle }: {
  names: string[]; amounts: Record<string, number>; disabled: Set<string>; toggle: (name: string) => void
}) {
  const names = [...new Set([...all, ...Object.keys(amounts)])]
  if (!names.length) return null
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-line-dark">
      {names.map((n) => {
        const on = !disabled.has(n)
        return (
          <li key={n} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${on ? '' : 'text-zinc-400 line-through'}`}>{n}</p>
              <p className="text-xs text-zinc-500">{money(amounts[n] ?? 0)} no período</p>
            </div>
            <Switch on={on} onChange={() => toggle(n)} label={n} />
          </li>
        )
      })}
    </ul>
  )
}
