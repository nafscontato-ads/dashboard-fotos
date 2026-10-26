const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0)
export const moneyShort = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${num.format(Math.round(v / 100) / 10)} mil` : brl.format(v)
export const pct = (v: number) => (Number.isFinite(v) ? `${num.format(v * 100)}%` : '—')
export const ratio = (v: number) => (Number.isFinite(v) && v !== 0 ? num.format(Math.round(v * 100) / 100) : '—')

// aceita "1.159", "54,90", "R$ 1.403,00", "502.29"
export function parseMoney(input: string): number {
  let s = String(input).replace(/[^\d,.-]/g, '')
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${WEEK[dt.getDay()]}`
}
export const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const todayISO = () => toISO(new Date())

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
