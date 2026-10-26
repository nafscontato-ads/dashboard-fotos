import { useMemo, useState } from 'react'
import type { Data } from '../lib/useData'
import { dayLabel, parseMoney, toISO, todayISO } from '../lib/format'
import { saveEntry, setDailyExpense } from '../lib/mutations'
import { supabase } from '../lib/supabase'
import type { Operation } from '../lib/types'
import { Modal } from './ui'

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toISO(d) }
const fmt = (v: number | null | undefined) => (v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

/**
 * Balanço do dia: gasto, retorno, vendas e despesas diárias (editor) de cada operação numa tela só.
 * Começa em "ontem", porque o fechamento é feito depois da meia-noite.
 */
export function DayClose({ ops, data, onClose, onSaved }: { ops: Operation[]; data: Data; onClose: () => void; onSaved: () => void }) {
  const [day, setDay] = useState(yesterday())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // operação que já recebe vendas do Zap Data: o retorno vem dos comprovantes e não é digitado
  const autoRevenue = (opId: string) => data.sales.some((x) => x.operation_id === opId)
  const dailyCats = (opId: string) => data.categories.filter((c) => c.operation_id === opId && c.kind === 'manual' && c.show_in_daily)

  // valores já gravados no dia escolhido, pra editar em cima
  const initial = useMemo(() => {
    const v: Record<string, string> = {}
    for (const o of ops) {
      const e = data.entries.find((x) => x.operation_id === o.id && x.day === day)
      v[`${o.id}:spend`] = fmt(e?.ad_spend)
      v[`${o.id}:revenue`] = fmt(e?.revenue)
      v[`${o.id}:sales`] = e?.sales_count == null ? '' : String(e.sales_count)
      for (const c of dailyCats(o.id)) {
        const sum = data.expenses.filter((x) => x.category_id === c.id && x.day === day).reduce((s, x) => s + Number(x.amount), 0)
        v[`${o.id}:${c.id}`] = fmt(sum)
      }
    }
    return v
  }, [day, ops, data])
  const [vals, setVals] = useState<Record<string, string>>({})
  const val = (k: string) => vals[`${day}|${k}`] ?? initial[k] ?? ''
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [`${day}|${k}`]: v }))

  async function save() {
    setBusy(true)
    setErr(null)
    for (const o of ops) {
      const exists = data.entries.some((x) => x.operation_id === o.id && x.day === day)
      const sales = val(`${o.id}:sales`)
      const r = await saveEntry(o.id, day, autoRevenue(o.id)
        ? { ad_spend: parseMoney(val(`${o.id}:spend`)) }
        : {
            ad_spend: parseMoney(val(`${o.id}:spend`)),
            revenue: parseMoney(val(`${o.id}:revenue`)),
            sales_count: sales === '' ? null : Number(sales),
          }, exists)
      if (r.error) { setErr(`${o.name}: ${r.error.message}`); setBusy(false); return }
      for (const c of dailyCats(o.id)) {
        const r2 = await setDailyExpense(o.id, c.id, day, parseMoney(val(`${o.id}:${c.id}`)), data.expenses)
        if (r2.error) { setErr(`${o.name}: ${r2.error.message}`); setBusy(false); return }
      }
    }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal title="Balanço do dia" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Dia</label>
          <input type="date" className="input w-auto" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} />
        </div>
        <p className="pb-2 text-sm text-zinc-500">{dayLabel(day)} · campo vazio conta como zero</p>
      </div>
      <div className="space-y-4">
        {ops.map((o) => (
          <div key={o.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} /> {o.name}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Gasto tráfego (sem imposto)" value={val(`${o.id}:spend`)} onChange={(v) => set(`${o.id}:spend`, v)} />
              <Field label={autoRevenue(o.id) ? 'Retorno (automático)' : 'Retorno'} value={val(`${o.id}:revenue`)} onChange={(v) => set(`${o.id}:revenue`, v)} disabled={autoRevenue(o.id)} />
              <Field label={autoRevenue(o.id) ? 'Vendas (automático)' : 'Vendas (qtd)'} value={val(`${o.id}:sales`)} onChange={(v) => set(`${o.id}:sales`, v.replace(/\D/g, ''))} numeric disabled={autoRevenue(o.id)} />
              {dailyCats(o.id).map((c) => (
                <Field key={c.id} label={`${c.name} (pago)`} value={val(`${o.id}:${c.id}`)} onChange={(v) => set(`${o.id}:${c.id}`, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      <button className="btn-primary mt-4 w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar balanço'}</button>
    </Modal>
  )
}

function Field({ label, value, onChange, numeric, disabled }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; disabled?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input text-right tabular-nums" inputMode={numeric ? 'numeric' : 'decimal'} placeholder={numeric ? '—' : '0,00'} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Lança uma despesa avulsa (Zap Data, verificado, editor, outra) em qualquer operação. */
export function QuickExpense({ ops, data, defaultOp, onClose, onSaved }: { ops: Operation[]; data: Data; defaultOp?: string; onClose: () => void; onSaved: () => void }) {
  const [opId, setOpId] = useState(defaultOp ?? ops[0]?.id ?? '')
  const cats = data.categories.filter((c) => c.operation_id === opId && c.kind === 'manual')
  const [catId, setCatId] = useState('')
  const [day, setDay] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const chosen = cats.find((c) => c.id === catId) ? catId : cats[0]?.id ?? ''

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const v = parseMoney(amount)
    if (v <= 0) return setErr('Coloque o valor.')
    let category = chosen
    if (chosen === '__new') {
      if (!newName.trim()) return setErr('Dê um nome pra nova despesa.')
      const { data: c, error } = await supabase.from('expense_categories')
        .insert({ operation_id: opId, name: newName.trim(), kind: 'manual', sort: 99 }).select('id').single()
      if (error) return setErr(error.message)
      category = c.id
    }
    const { error } = await supabase.from('expenses').insert({ operation_id: opId, category_id: category, day, amount: v, note: note || null })
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <Modal title="Lançar despesa" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="label">Operação</label>
          <select className="input" value={opId} onChange={(e) => { setOpId(e.target.value); setCatId('') }}>
            {ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Despesa</label>
          <select className="input" value={chosen} onChange={(e) => setCatId(e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ Nova despesa…</option>
          </select>
        </div>
        {chosen === '__new' && <input className="input" placeholder="Nome (ex.: Chip, ChatGPT)" value={newName} onChange={(e) => setNewName(e.target.value)} />}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Data do pagamento</label>
            <input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="label">Valor</label>
            <input autoFocus className="input" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <input className="input" placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary w-full">Lançar despesa</button>
      </form>
    </Modal>
  )
}

/** Gasto com anúncio de um dia, pra operação que ainda não puxa do Meta sozinha (Op 02). */
export function AdSpend({ ops, data, defaultOp, onClose, onSaved }: { ops: Operation[]; data: Data; defaultOp?: string; onClose: () => void; onSaved: () => void }) {
  const [opId, setOpId] = useState(defaultOp ?? ops[0]?.id ?? '')
  const [day, setDay] = useState(yesterday())
  const current = data.entries.find((x) => x.operation_id === opId && x.day === day)
  const [amount, setAmount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const shown = amount ?? fmt(current?.ad_spend)
  const v = parseMoney(shown)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await saveEntry(opId, day, { ad_spend: v }, !!current)
    setBusy(false)
    if (r.error) return setErr(r.error.message)
    onSaved()
  }

  return (
    <Modal title="Gasto com anúncio" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="label">Operação</label>
          <select className="input" value={opId} onChange={(e) => { setOpId(e.target.value); setAmount(null) }}>
            {ops.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Dia</label>
            <input type="date" className="input" value={day} max={todayISO()} onChange={(e) => { setDay(e.target.value); setAmount(null) }} />
          </div>
          <div>
            <label className="label">Valor gasto (sem imposto)</label>
            <input autoFocus className="input text-right tabular-nums" inputMode="decimal" placeholder="0,00" value={shown} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          {dayLabel(day)} · use o valor "Valor usado" do Gerenciador do Meta. O imposto de 12,15% ({(v * 0.1215).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) entra sozinho.
          {current ? ' Esse dia já tem valor: salvar troca pelo novo.' : ''}
        </p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary h-11 w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar gasto'}</button>
      </form>
    </Modal>
  )
}
