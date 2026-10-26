import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { dayLabel, money, parseMoney, todayISO } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Expense, ExpenseCategory } from '../lib/types'
import { Empty, Modal } from './ui'

export default function Expenses({ opId, categories, expenses, range, canEdit, onChanged }: {
  opId: string
  categories: ExpenseCategory[]
  expenses: Expense[]
  range: { from: string; to: string }
  canEdit: boolean
  onChanged: () => void
}) {
  const cats = categories.filter((c) => c.operation_id === opId)
  const manual = cats.filter((c) => c.kind === 'manual')
  const [catId, setCatId] = useState(manual.find((c) => !c.show_in_daily)?.id ?? manual[0]?.id ?? '')
  const [day, setDay] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [manage, setManage] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const list = expenses
    .filter((x) => x.operation_id === opId && x.day >= range.from && x.day <= range.to)
    .sort((a, b) => b.day.localeCompare(a.day))
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '?'

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const v = parseMoney(amount)
    if (!catId || v <= 0) return setErr('Escolha a despesa e o valor.')
    const { error } = await supabase.from('expenses').insert({ operation_id: opId, category_id: catId, day, amount: v, note: note || null })
    setErr(error?.message ?? null)
    if (!error) { setAmount(''); setNote('') }
    onChanged()
  }

  async function remove(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    onChanged()
  }

  return (
    <div>
      {canEdit && (
        <form onSubmit={add} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_1fr_1fr_1.4fr_auto]">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Despesa</label>
            <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
              {manual.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="label">Valor</label>
            <input className="input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Observação</label>
            <input className="input" placeholder="opcional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
            <button className="btn-primary w-full"><Plus size={16} /> Lançar</button>
          </div>
        </form>
      )}
      {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
      {canEdit && (
        <button className="btn-outline mb-3 text-xs" onClick={() => setManage(true)}>Tipos de despesa (criar, % do imposto…)</button>
      )}
      {!list.length ? <Empty>Nenhuma despesa lançada nesse período.</Empty> : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-zinc-500">{dayLabel(x.day)}</span>
              <span className="flex-1 truncate">{catName(x.category_id)}{x.note ? <span className="text-zinc-500"> · {x.note}</span> : null}</span>
              <span className="tabular-nums font-medium">{money(Number(x.amount))}</span>
              {canEdit && <button className="btn-ghost p-1.5 text-zinc-400 hover:text-rose-600" onClick={() => remove(x.id)} aria-label="Apagar"><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      {manage && <Categories opId={opId} cats={cats} onClose={() => setManage(false)} onChanged={onChanged} />}
    </div>
  )
}

function Categories({ opId, cats, onClose, onChanged }: { opId: string; cats: ExpenseCategory[]; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'manual' | 'percent_spend'>('manual')
  const [rate, setRate] = useState('')
  const [daily, setDaily] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const done = (error: { message: string } | null) => { setErr(error?.message ?? null); onChanged() }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('expense_categories').insert({
      operation_id: opId, name: name.trim(), kind,
      rate: kind === 'percent_spend' ? parseMoney(rate) : null,
      show_in_daily: kind === 'manual' && daily, sort: cats.length,
    })
    done(error)
    if (!error) { setName(''); setRate('') }
  }

  return (
    <Modal title="Tipos de despesa" onClose={onClose}>
      <ul className="mb-4 space-y-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-sm dark:border-zinc-800">
            <span className="flex-1">
              <span className="font-medium">{c.name}</span>
              <span className="block text-xs text-zinc-500">
                {c.kind === 'percent_spend' ? `% sobre o investido` : c.show_in_daily ? 'valor por dia (coluna na tabela)' : 'lançamento avulso'}
              </span>
            </span>
            {c.kind === 'percent_spend' && (
              <input
                className="input w-20 text-right" defaultValue={String(c.rate ?? '').replace('.', ',')}
                onBlur={async (e) => done((await supabase.from('expense_categories').update({ rate: parseMoney(e.target.value) }).eq('id', c.id)).error)}
              />
            )}
            {c.kind === 'manual' && (
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input type="checkbox" checked={c.show_in_daily}
                  onChange={async (e) => done((await supabase.from('expense_categories').update({ show_in_daily: e.target.checked }).eq('id', c.id)).error)} />
                coluna
              </label>
            )}
            <button className="btn-ghost p-1.5 text-zinc-400 hover:text-rose-600" aria-label="Apagar"
              onClick={async () => confirm(`Apagar "${c.name}" e todos os lançamentos dela?`) && done((await supabase.from('expense_categories').delete().eq('id', c.id)).error)}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-sm font-medium">Nova despesa</p>
        <input className="input" placeholder="Nome (ex.: Chip, Ferramenta de IA)" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as 'manual' | 'percent_spend')}>
          <option value="manual">Valor em reais (lança quando paga)</option>
          <option value="percent_spend">% sobre o investido no Meta</option>
        </select>
        {kind === 'percent_spend'
          ? <input className="input" placeholder="% (ex.: 12,15)" value={rate} onChange={(e) => setRate(e.target.value)} />
          : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} /> Mostrar como coluna diária na tabela</label>}
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary w-full"><Plus size={16} /> Criar</button>
      </form>
    </Modal>
  )
}
