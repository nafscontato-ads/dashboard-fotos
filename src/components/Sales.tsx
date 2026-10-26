import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { money } from '../lib/format'
import type { Product, Sale } from '../lib/types'
import { Empty } from './ui'

const hourOf = (iso: string) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' })) % 24

export default function Sales({ sales, products }: { sales: Sale[]; products: Product[] }) {
  if (!sales.length) return <Empty>As vendas aparecem aqui quando o Zap Data mandar os comprovantes.</Empty>
  const nameOf = new Map(products.map((p) => [p.id, p.name]))
  const byHour = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, vendas: 0, valor: 0 }))
  for (const s of sales) { const b = byHour[hourOf(s.paid_at)]; b.vendas++; b.valor += Number(s.amount) }
  const best = [...byHour].sort((a, b) => b.vendas - a.vendas)[0]
  const total = sales.reduce((s, x) => s + Number(x.amount), 0)
  const dark = document.documentElement.classList.contains('dark')
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-white/5"><p className="text-xs text-zinc-500">Vendas</p><p className="font-semibold">{sales.length}</p></div>
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-white/5"><p className="text-xs text-zinc-500">Ticket</p><p className="font-semibold">{money(total / sales.length)}</p></div>
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-white/5"><p className="text-xs text-zinc-500">Pico</p><p className="font-semibold">{best.h}</p></div>
      </div>
      <div className="mt-3 h-36">
        <ResponsiveContainer>
          <BarChart data={byHour}>
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: dark ? '#a1a1aa' : '#71717a' }} tickLine={false} axisLine={false} interval={3} />
            <Tooltip formatter={(v, n) => (n === 'valor' ? money(Number(v)) : v)} contentStyle={{ borderRadius: 10, fontSize: 12, background: dark ? '#1e1e1e' : '#fff', border: 'none' }} />
            <Bar dataKey="vendas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-line-dark">
        {[...sales].reverse().slice(0, 100).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate font-medium">{(s.product_id && nameOf.get(s.product_id)) || 'Sem pacote'}</span>
              <span className="block truncate text-xs text-zinc-500">
                {new Date(s.paid_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {s.payer_name || 'cliente'}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{money(Number(s.amount))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
