import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DayRow } from '../lib/calc'
import { dayLabel, money, shortDay } from '../lib/format'

export default function DailyChart({ rows }: { rows: DayRow[] }) {
  const dark = document.documentElement.classList.contains('dark')
  const grid = dark ? '#2c2c2e' : '#e4e4e7'
  const axis = dark ? '#a1a1aa' : '#71717a'
  return (
    <div className="h-56 w-full sm:h-72">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(v)}`} />
          <Tooltip
            formatter={(v) => money(Number(v))}
            labelFormatter={(l) => dayLabel(String(l))}
            contentStyle={{ borderRadius: 12, border: `1px solid ${grid}`, background: dark ? '#1e1e1e' : '#fff', fontSize: 12 }}
            cursor={{ fill: dark ? '#ffffff0d' : '#0000000a' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar dataKey="spend" name="Gasto tráfego" fill="#a1a1aa" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="revenue" name="Retorno" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Line dataKey="profit" name="Lucro líquido" stroke="#10b981" strokeWidth={2.5} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
