import type { Totals } from '../lib/calc'
import { money, pct, ratio } from '../lib/format'
import { tone } from './ui'

function Kpi({ label, value, hint, className = '' }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${className}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export default function Kpis({ t, showMine, saved }: { t: Totals; showMine: boolean; saved: number }) {
  const roas = t.spend ? t.revenue / t.spend : NaN
  const margin = t.revenue ? t.profit / t.revenue : NaN
  const ticket = t.hasSales && t.sales ? t.revenue / t.sales : NaN
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Faturamento (retorno)" value={money(t.revenue)} hint={t.days ? `média ${money(t.revenue / t.days)}/dia` : undefined} />
      <Kpi label="Investido no Meta" value={money(t.spend)} hint={`ROAS ${ratio(roas)}`} />
      <Kpi label="Despesas ligadas" value={money(t.expenses)} hint={saved > 0 ? `${money(saved)} desligadas` : 'imposto, editor, ferramentas…'} />
      <Kpi label="Lucro líquido" value={money(t.profit)} className={tone(t.profit)} hint={`margem ${pct(margin)}`} />
      {showMine && <Kpi label="Minha parte do lucro" value={money(t.myProfit)} className={tone(t.myProfit)} hint="pela % de cada operação" />}
      <Kpi label="Lucro bruto (retorno − investido)" value={money(t.grossProfit)} className={tone(t.grossProfit)} />
      <Kpi label="Lucro por dia" value={money(t.days ? t.profit / t.days : 0)} className={tone(t.profit)} hint={`${t.days} dia(s) no período`} />
      <Kpi label="Vendas · ticket médio" value={t.hasSales ? String(t.sales) : '—'} hint={t.hasSales ? `ticket ${money(ticket)}` : 'preencha a coluna Vendas'} />
    </div>
  )
}
