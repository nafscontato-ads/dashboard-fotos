import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { money, parseMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Product, Sale } from '../lib/types'
import { Empty, Switch } from './ui'

const fmt = (v: number | null) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))

/** Cadastro dos pacotes de uma operação. A venda é ligada ao pacote pelo valor pago. */
export function ProductList({ opId, products, canEdit, onChanged }: { opId: string; products: Product[]; canEdit: boolean; onChanged: () => void }) {
  const list = products.filter((p) => p.operation_id === opId)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function update(p: Product, patch: Partial<Product>) {
    const { error } = await supabase.from('products').update(patch).eq('id', p.id)
    setErr(error?.message ?? null)
    onChanged()
  }
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const v = parseMoney(price)
    if (!name.trim() || v <= 0) return setErr('Coloque o nome e o preço.')
    const { error } = await supabase.from('products').insert({
      operation_id: opId, name: name.trim(), price: v, promo_price: Math.round(v * 50) / 100, sort: list.length + 1,
    })
    setErr(error?.message ?? null)
    if (!error) { setName(''); setPrice('') }
    onChanged()
  }
  async function remove(p: Product) {
    if (!confirm(`Apagar o pacote "${p.name}"? As vendas dele ficam sem pacote.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    setErr(error?.message ?? null)
    onChanged()
  }

  return (
    <div>
      {!list.length ? <Empty>Nenhum pacote cadastrado nessa operação.</Empty> : (
        <ul className="divide-y divide-zinc-100 dark:divide-line-dark">
          {list.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex items-center gap-2">
                <input className="input h-9 flex-1 font-medium" defaultValue={p.name} disabled={!canEdit}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.name && update(p, { name: e.target.value.trim() })} />
                <Switch on={p.active} onChange={() => canEdit && update(p, { active: !p.active })} label="Ativo" />
                {canEdit && <button className="btn-ghost p-2 text-zinc-400" onClick={() => remove(p)} aria-label="Apagar"><Trash2 size={16} /></button>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-500">Preço
                  <input className="input mt-1 h-9 text-zinc-900 dark:text-zinc-100" inputMode="decimal" defaultValue={fmt(p.price)} disabled={!canEdit}
                    onBlur={(e) => { const v = parseMoney(e.target.value); if (v > 0 && v !== Number(p.price)) update(p, { price: v }) }} />
                </label>
                <label className="text-xs text-zinc-500">Preço na promoção
                  <input className="input mt-1 h-9 text-zinc-900 dark:text-zinc-100" inputMode="decimal" defaultValue={fmt(p.promo_price)} disabled={!canEdit} placeholder="sem promoção"
                    onBlur={(e) => { const v = e.target.value.trim() ? parseMoney(e.target.value) : null; if (v !== (p.promo_price == null ? null : Number(p.promo_price))) update(p, { promo_price: v }) }} />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-line-dark">
          <input className="input min-w-0 flex-[2]" placeholder="Novo pacote (ex.: Premium · 20 fotos)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input w-28 flex-1" inputMode="decimal" placeholder="Preço" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn-primary h-11"><Plus size={16} /> Adicionar</button>
        </form>
      )}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
    </div>
  )
}

/** Vendas por pacote no período (barras horizontais). */
export function SalesByProduct({ sales, products }: { sales: Sale[]; products: Product[] }) {
  const nameOf = new Map(products.map((p) => [p.id, p.name]))
  const by = new Map<string, { n: number; v: number }>()
  for (const s of sales) {
    const k = (s.product_id && nameOf.get(s.product_id)) || 'Sem pacote'
    const b = by.get(k) ?? { n: 0, v: 0 }
    b.n++; b.v += Number(s.amount)
    by.set(k, b)
  }
  const rows = [...by.entries()].sort((a, b) => b[1].v - a[1].v)
  if (!rows.length) return <Empty>Sem vendas por comprovante no período.</Empty>
  const max = Math.max(...rows.map(([, b]) => b.v))
  return (
    <ul className="space-y-3">
      {rows.map(([k, b]) => (
        <li key={k}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{k}</span>
            <span className="shrink-0 tabular-nums"><b>{money(b.v)}</b> <span className="text-zinc-500">· {b.n}</span></span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-white/5">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${(b.v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
