import type { Totals } from '../lib/calc'
import { money, pct, ratio } from '../lib/format'
import { tone } from './ui'

function Kpi({ label, value, hint, className = '', muted, wide, onClick }: {
  label: string; value: string; hint?: string; className?: string; muted?: boolean; wide?: boolean; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className={`card min-w-0 px-4 py-3.5 ${wide ? 'col-span-2 lg:col-span-1' : ''} ${muted ? 'opacity-60' : ''} ${onClick ? 'cursor-pointer active:scale-[.99]' : ''}`}>
      <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 truncate text-[19px] font-bold tabular-nums tracking-tight sm:text-2xl ${muted ? 'line-through' : ''} ${className}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export default function Kpis({ t, showMine, saved, onExpenses }: { t: Totals; showMine: boolean; saved: number; onExpenses?: () => void }) {
  const roas = t.spend ? t.revenue / t.spend : NaN
  const margin = t.revenue ? t.profit / t.revenue : NaN
  const ticket = t.hasSales && t.sales ? t.revenue / t.sales : NaN
  const opex = t.expenses - (t.taxOn ? t.tax : 0)
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <Kpi label="Faturamento" value={money(t.revenue)} hint={t.days ? `média ${money(t.revenue / t.days)}/dia` : undefined} />
      <Kpi label="Gastos com anúncios" value={money(t.spend)} hint={`depositado ${money(t.spend + t.tax)}`} />
      <Kpi label="Lucro líquido" value={money(t.profit)} className={tone(t.profit)} hint={`margem ${pct(margin)}`} />
      {showMine && <Kpi label="Minha parte" value={money(t.myProfit)} className={tone(t.myProfit)} hint="pela % de cada operação" />}
      <Kpi label="ROAS" value={ratio(roas)} hint="faturamento ÷ gasto" />
      <Kpi label="Imposto Meta" value={money(t.tax)} muted={!t.taxOn} hint="12,15% do gasto" onClick={onExpenses} />
      <Kpi label="Despesas" value={money(opex)} hint={saved > 0 ? `${money(saved)} desligadas` : 'editor, Zap Data…'} onClick={onExpenses} />
      <Kpi label="Vendas" value={t.hasSales ? String(t.sales) : '—'} hint={t.hasSales ? `ticket ${money(ticket)}` : 'ainda sem vendas'} />
      {!showMine && <Kpi label="Lucro por dia" value={money(t.days ? t.profit / t.days : 0)} className={tone(t.profit)} hint={`${t.days} dia(s)`} />}
    </div>
  )
}

/** Cartões quando um pacote está filtrado: só o que dá pra separar por pacote. */
export function ProductKpis({ revenue, count, totalRevenue }: { revenue: number; count: number; totalRevenue: number }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi label="Faturamento do pacote" value={money(revenue)} />
        <Kpi label="Vendas" value={String(count)} />
        <Kpi label="Ticket médio" value={count ? money(revenue / count) : '—'} />
        <Kpi label="Fatia do faturamento" value={pct(totalRevenue ? revenue / totalRevenue : NaN)} hint="das vendas por comprovante" />
      </div>
      <p className="px-1 text-xs text-zinc-500">Gasto com anúncio e despesas são da operação inteira, por isso não aparecem por pacote.</p>
    </div>
  )
}
