import { Check } from 'lucide-react'
import type { Range } from '../lib/calc'
import { money, toISO } from '../lib/format'

export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastmonth' | 'all' | 'custom'

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
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
    case '7d': return { from: d(-6), to: d(0) }
    case '30d': return { from: d(-29), to: d(0) }
    case 'month': return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: d(0) }
    case 'lastmonth': return {
      from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
    case 'all': return { from: '2000-01-01', to: '2999-12-31' }
    case 'custom': return custom
  }
}

export function PeriodPicker({ preset, setPreset, custom, setCustom }: {
  preset: Preset; setPreset: (p: Preset) => void; custom: Range; setCustom: (r: Range) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {preset === 'custom' && (
        <>
          <input type="date" className="input w-auto" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <span className="text-xs text-zinc-500">até</span>
          <input type="date" className="input w-auto" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </>
      )}
    </div>
  )
}

/** Liga/desliga cada despesa para ver o lucro com e sem ela. */
export function ExpenseToggles({ amounts, disabled, toggle }: {
  amounts: Record<string, number>; disabled: Set<string>; toggle: (name: string) => void
}) {
  const names = Object.keys(amounts).sort()
  if (!names.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500">Despesas na conta:</span>
      {names.map((n) => {
        const on = !disabled.has(n)
        return (
          <button
            key={n}
            onClick={() => toggle(n)}
            title={on ? 'Clique para desligar e ver o lucro sem essa despesa' : 'Desligada: clique para voltar a contar'}
            className={`chip ${on
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'border-zinc-200 bg-transparent text-zinc-400 line-through dark:border-zinc-700'}`}
          >
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${on ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-zinc-400'}`}>
              {on && <Check size={10} strokeWidth={3} />}
            </span>
            {n} · {money(amounts[n])}
          </button>
        )
      })}
    </div>
  )
}
