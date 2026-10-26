import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { DayRow } from '../lib/calc'
import { dayLabel, money, parseMoney, ratio, todayISO } from '../lib/format'
import { saveEntry as saveEntryM, setDailyExpense } from '../lib/mutations'
import { supabase } from '../lib/supabase'
import type { DailyEntry, Expense, ExpenseCategory } from '../lib/types'
import { Empty, tone } from './ui'

function MoneyCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
  return (
    <input
      className="cell-input"
      inputMode="decimal"
      placeholder="0,00"
      value={shown}
      disabled={disabled}
      onFocus={(e) => { setDraft(shown); requestAnimationFrame(() => e.target.select()) }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={() => {
        if (draft !== null) {
          const v = parseMoney(draft)
          if (Math.abs(v - value) > 0.001) onSave(v)
        }
        setDraft(null)
      }}
    />
  )
}

function IntCell({ value, onSave, disabled }: { value: number | null; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value == null ? '' : String(value))
  return (
    <input
      className="cell-input w-16"
      inputMode="numeric"
      placeholder="—"
      value={shown}
      disabled={disabled}
      onFocus={() => setDraft(shown)}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={() => {
        if (draft !== null) {
          const v = draft === '' ? null : Number(draft)
          if (v !== value) onSave(v)
        }
        setDraft(null)
      }}
    />
  )
}

export default function DailyTable({ opId, rows, entries, categories, expenses, canEdit, onChanged }: {
  opId: string
  rows: DayRow[]
  entries: DailyEntry[]
  categories: ExpenseCategory[]
  expenses: Expense[]
  canEdit: boolean
  onChanged: () => void
}) {
  const [newDay, setNewDay] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)
  const dailyCats = categories.filter((c) => c.operation_id === opId && c.kind === 'manual' && c.show_in_daily)
  const pctCats = categories.filter((c) => c.operation_id === opId && c.kind === 'percent_spend')
  const entryOf = (day: string) => entries.find((e) => e.operation_id === opId && e.day === day)

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    setErr(error ? error.message : null)
    onChanged()
  }

  const saveEntry = (day: string, patch: Partial<DailyEntry>) => run(saveEntryM(opId, day, patch, !!entryOf(day)))
  const saveDailyExpense = (day: string, cat: ExpenseCategory, amount: number) => run(setDailyExpense(opId, cat.id, day, amount, expenses))

  const removeDay = async (day: string) => {
    if (!confirm(`Apagar o lançamento de ${dayLabel(day)}? (despesas do dia também)`)) return
    const ids = expenses.filter((x) => x.operation_id === opId && x.day === day && dailyCats.some((c) => c.id === x.category_id)).map((x) => x.id)
    if (ids.length) await supabase.from('expenses').delete().in('id', ids)
    run(supabase.from('daily_entries').delete().eq('operation_id', opId).eq('day', day))
  }

  const sorted = [...rows].reverse()

  return (
    <div>
      {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
      {!rows.length ? <Empty>Nenhum lançamento nesse período.</Empty> : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-2 py-2 text-left font-medium">Dia</th>
                <th className="px-2 py-2 text-right font-medium">Gasto tráfego</th>
                <th className="px-2 py-2 text-right font-medium">Retorno</th>
                <th className="px-2 py-2 text-right font-medium">Vendas</th>
                {dailyCats.map((c) => <th key={c.id} className="px-2 py-2 text-right font-medium">{c.name}</th>)}
                {pctCats.map((c) => <th key={c.id} className="px-2 py-2 text-right font-medium">{c.name} ({String(c.rate).replace('.', ',')}%)</th>)}
                <th className="px-2 py-2 text-right font-medium">Lucro líquido</th>
                <th className="px-2 py-2 text-right font-medium">ROAS</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const e = entryOf(r.day)
                return (
                  <tr key={r.day} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium">{dayLabel(r.day)}</td>
                    <td className="px-1 text-right"><MoneyCell value={Number(e?.ad_spend ?? 0)} disabled={!canEdit} onSave={(v) => saveEntry(r.day, { ad_spend: v })} /></td>
                    <td className="px-1 text-right"><MoneyCell value={Number(e?.revenue ?? 0)} disabled={!canEdit} onSave={(v) => saveEntry(r.day, { revenue: v })} /></td>
                    <td className="px-1 text-right"><IntCell value={e?.sales_count ?? null} disabled={!canEdit} onSave={(v) => saveEntry(r.day, { sales_count: v })} /></td>
                    {dailyCats.map((c) => (
                      <td key={c.id} className="px-1 text-right">
                        <MoneyCell value={r.byCategory[c.name] ?? 0} disabled={!canEdit} onSave={(v) => saveDailyExpense(r.day, c, v)} />
                      </td>
                    ))}
                    {pctCats.map((c) => <td key={c.id} className="px-2 text-right tabular-nums text-zinc-500">{money(r.byCategory[c.name] ?? 0)}</td>)}
                    <td className={`px-2 text-right font-medium tabular-nums ${tone(r.profit)}`}>{money(r.profit)}</td>
                    <td className="px-2 text-right tabular-nums text-zinc-500">{ratio(r.spend ? r.revenue / r.spend : NaN)}</td>
                    {canEdit && (
                      <td className="px-1 text-right">
                        <button className="btn-ghost p-1.5 text-zinc-400 hover:text-rose-600" onClick={() => removeDay(r.day)} aria-label="Apagar dia"><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 dark:border-line-dark">
          <div>
            <label className="label">Falta algum dia na lista? Adicione aqui</label>
            <input type="date" className="input w-auto" value={newDay} onChange={(e) => setNewDay(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => saveEntry(newDay, {})}><Plus size={16} /> Adicionar dia</button>
        </div>
      )}
    </div>
  )
}
