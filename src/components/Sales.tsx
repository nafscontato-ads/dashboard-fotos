import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { money } from '../lib/format'
import type { Sale } from '../lib/types'
import { Empty } from './ui'

const hourOf = (iso: string) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' })) % 24

export default function Sales({ sales }: { sales: Sale[] }) {
  if (!sales.length) return <Empty>As vendas aparecem aqui quando o Zap Data começar a mandar os comprovantes (veja Configurações da operação).</Empty>
  const byHour = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, vendas: 0, valor: 0 }))
  for (const s of sales) { const b = byHour[hourOf(s.paid_at)]; b.vendas++; b.valor += Number(s.amount) }
  const best = [...byHour].sort((a, b) => b.vendas - a.vendas)[0]
  const total = sales.reduce((s, x) => s + Number(x.amount), 0)
  const dark = document.documentElement.classList.contains('dark')
  return (
    <div>
      <p className="mb-2 text-sm text-zinc-500">
        {sales.length} vendas · ticket médio {money(total / sales.length)} · horário que mais vende: <b className="text-zinc-800 dark:text-zinc-100">{best.h}</b>
      </p>
      <div className="h-40">
        <ResponsiveContainer>
          <BarChart data={byHour}>
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: dark ? '#a1a1aa' : '#71717a' }} tickLine={false} axisLine={false} interval={2} />
            <Tooltip formatter={(v, n) => (n === 'valor' ? money(Number(v)) : v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: dark ? '#18181b' : '#fff' }} />
            <Bar dataKey="vendas" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 max-h-64 divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-800">
        {[...sales].reverse().slice(0, 50).map((s) => (
          <li key={s.id} className="flex justify-between py-1.5">
            <span className="text-zinc-500">{new Date(s.paid_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {s.payer_name || 'cliente'}</span>
            <span className="font-medium tabular-nums">{money(Number(s.amount))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
