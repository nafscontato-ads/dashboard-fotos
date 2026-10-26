import type { Session } from '@supabase/supabase-js'
import { ClipboardList, KeyRound, RefreshCw, LayoutDashboard, LogOut, Menu, Moon, Plus, Receipt, Settings as Gear, Sun, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import DailyChart from './components/Chart'
import DailyTable from './components/DailyTable'
import Expenses from './components/Expenses'
import { ExpenseToggles, PeriodPicker, rangeFor, type Preset } from './components/Filters'
import Kpis from './components/Kpis'
import Login from './components/Login'
import { DayClose, QuickExpense } from './components/QuickActions'
import Sales from './components/Sales'
import Settings from './components/Settings'
import { Empty, Modal, Section, tone } from './components/ui'
import { computeDays, groupByMonth, myShareOf, totalsOf, type Range } from './lib/calc'
import { money, monthLabel, pct, ratio, todayISO } from './lib/format'
import { supabase } from './lib/supabase'
import { useData } from './lib/useData'

function stored<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function store(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* modo privado */ } }

type View = { kind: 'summary' } | { kind: 'op'; id: string }

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  if (!session) return <Login />
  return <Dashboard email={session.user.email ?? ''} userId={session.user.id} />
}

function Dashboard({ email, userId }: { email: string; userId: string }) {
  const { data, loading, error, live, reload } = useData(true)
  const [view, setView] = useState<View>(() => stored<View>('view', { kind: 'summary' }))
  const [preset, setPreset] = useState<Preset>(() => stored<Preset>('preset', 'month'))
  const [custom, setCustom] = useState<Range>(() => stored<Range>('custom', { from: todayISO().slice(0, 8) + '01', to: todayISO() }))
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(stored<string[]>('disabled', [])))
  const [hiddenOps, setHiddenOps] = useState<Set<string>>(() => new Set(stored<string[]>('hiddenOps', [])))
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [menu, setMenu] = useState(false)
  const [newOp, setNewOp] = useState(false)
  const [pwd, setPwd] = useState(false)
  const [settings, setSettings] = useState(false)
  const [dayClose, setDayClose] = useState(false)
  const [quickExp, setQuickExp] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => store('view', view), [view])
  useEffect(() => store('preset', preset), [preset])
  useEffect(() => store('custom', custom), [custom])
  useEffect(() => store('disabled', [...disabled]), [disabled])
  useEffect(() => store('hiddenOps', [...hiddenOps]), [hiddenOps])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('tema', dark ? 'dark' : 'light') } catch { /* ignore */ }
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#09090b' : '#fafafa')
  }, [dark])

  const range = rangeFor(preset, custom)
  const ops = data.operations
  const current = view.kind === 'op' ? ops.find((o) => o.id === view.id) : undefined
  useEffect(() => { if (view.kind === 'op' && !loading && !current) setView({ kind: 'summary' }) }, [view, loading, current])

  const scopeOps = current ? [current] : ops.filter((o) => !hiddenOps.has(o.id))
  const rows = useMemo(
    () => computeDays(scopeOps, data.entries, data.categories, data.expenses, range, disabled),
    [scopeOps, data, range.from, range.to, disabled],
  )
  // "minha parte": soma o lucro de cada operação vezes a minha % nela
  const totals = useMemo(() => {
    const t = totalsOf(rows, disabled)
    t.myProfit = scopeOps.reduce((s, o) => {
      const r = computeDays([o], data.entries, data.categories, data.expenses, range, disabled)
      return s + totalsOf(r, disabled).profit * myShareOf(data.members, o.id, email)
    }, 0)
    return t
  }, [rows, scopeOps, data, range.from, range.to, disabled, email])
  const allOn = useMemo(() => totalsOf(rows, new Set()), [rows])
  const saved = allOn.expenses - totals.expenses

  const toggle = (n: string) => setDisabled((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })
  const role = current && data.members.find((m) => m.operation_id === current.id && m.email.toLowerCase() === email.toLowerCase())?.role
  const canEdit = role === 'owner' || role === 'editor'
  const go = (v: View) => { setView(v); setMenu(false) }
  const editableOps = ops.filter((o) => ['owner', 'editor'].includes(data.members.find((m) => m.operation_id === o.id && m.email.toLowerCase() === email.toLowerCase())?.role ?? ''))
  const actionOps = current ? editableOps.filter((o) => o.id === current.id) : editableOps
  // puxa o gasto do Meta agora (só operações com o Meta conectado respondem)
  async function syncMeta() {
    setSyncing(true)
    setSyncMsg(null)
    const parts: string[] = []
    for (const o of actionOps) {
      const { data: r } = await supabase.functions.invoke('sincronizar-meta', { body: { operation_id: o.id, days: 2 } })
      const res = r?.results?.[0]
      if (res?.ok) parts.push(`${o.name}: atualizado`)
      else if (res?.erro) parts.push(`${o.name}: ${res.erro}`)
    }
    setSyncMsg(parts.length ? parts.join(' · ') : 'Nenhuma operação com o Meta conectado ainda (Configurar / integrações).')
    setSyncing(false)
    reload()
  }
  const catNames = [...new Set(data.categories.filter((c) => scopeOps.some((o) => o.id === c.operation_id)).map((c) => c.name))]

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 pt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <svg viewBox="0 0 32 32" width="18" height="18"><path d="M6 23l6-7 5 4 9-11" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <span className="font-semibold">Operações</span>
        <span className={`ml-auto h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-zinc-400'}`} title={live ? 'Sincronizando ao vivo' : 'Conectando…'} />
      </div>
      <button onClick={() => go({ kind: 'summary' })}
        className={`btn justify-start ${view.kind === 'summary' ? 'bg-zinc-100 dark:bg-zinc-800' : 'btn-ghost'}`}>
        <LayoutDashboard size={16} /> Resumo
      </button>
      <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Operações</p>
      {ops.map((o) => (
        <button key={o.id} onClick={() => go({ kind: 'op', id: o.id })}
          className={`btn justify-start text-left ${view.kind === 'op' && view.id === o.id ? 'bg-zinc-100 dark:bg-zinc-800' : 'btn-ghost'}`}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
          <span className="truncate">{o.name}</span>
        </button>
      ))}
      <button className="btn-ghost justify-start text-indigo-600 dark:text-indigo-400" onClick={() => { setNewOp(true); setMenu(false) }}>
        <Plus size={16} /> Nova operação
      </button>
      <div className="mt-auto space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="truncate px-3 text-xs text-zinc-500">{email}</p>
        <button className="btn-ghost w-full justify-start" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />} Modo {dark ? 'claro' : 'escuro'}</button>
        <button className="btn-ghost w-full justify-start" onClick={() => setPwd(true)}><KeyRound size={16} /> Trocar senha</button>
        <button className="btn-ghost w-full justify-start" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sair</button>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenu(false)}>
          <aside className="h-full w-72 bg-white dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Menu">{menu ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-base font-semibold sm:text-xl">{current ? current.name : 'Resumo geral'}</h1>
            {current && role && <p className="text-xs text-zinc-500">{role === 'viewer' ? 'Você só visualiza' : `Sua parte: ${myShareOf(data.members, current.id, email) * 100}% do lucro`}</p>}
          </div>
          <PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
        </header>
        {actionOps.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setDayClose(true)}><ClipboardList size={16} /> Balanço do dia</button>
            <button className="btn-outline" onClick={() => setQuickExp(true)}><Receipt size={16} /> Lançar despesa</button>
            <button className="btn-outline" disabled={syncing} onClick={syncMeta}><RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Atualizar gasto do Meta</button>
            <button className="btn-outline" onClick={() => setNewOp(true)}><Plus size={16} /> Nova operação</button>
            {current && <button className="btn-outline" onClick={() => setSettings(true)}><Gear size={16} /> Configurar / integrações</button>}
          </div>
        )}

        {syncMsg && <p className="mb-3 rounded-xl bg-zinc-100 p-2.5 text-sm dark:bg-zinc-800">{syncMsg}</p>}
        {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Erro ao carregar: {error}</p>}

        {!loading && !ops.length ? (
          <Section title="Comece por aqui"><Empty>Você ainda não tem operações. Clique em <b>Nova operação</b>.</Empty></Section>
        ) : (
          <div className="space-y-4">
            {!current && ops.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Operações no resumo:</span>
                {ops.map((o) => {
                  const on = !hiddenOps.has(o.id)
                  return (
                    <button key={o.id} className={`chip ${on ? 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800' : 'border-zinc-200 text-zinc-400 line-through dark:border-zinc-800'}`}
                      onClick={() => setHiddenOps((s) => { const x = new Set(s); if (x.has(o.id)) x.delete(o.id); else x.add(o.id); return x })}>
                      <span className="h-2 w-2 rounded-full" style={{ background: on ? o.color : '#a1a1aa' }} /> {o.name}
                    </button>
                  )
                })}
              </div>
            )}
            <ExpenseToggles names={catNames} amounts={allOn.byCategory} disabled={disabled} toggle={toggle} />
            {saved > 0.004 && (
              <p className="rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Sem as despesas desligadas, o lucro sobe <b>{money(saved)}</b> (de {money(allOn.profit)} para {money(totals.profit)}).
              </p>
            )}
            <Kpis t={totals} showMine={!current || (myShareOf(data.members, current.id, email) < 1)} saved={saved} />
            <Section title="Dia a dia: gasto × retorno × lucro">{rows.length ? <DailyChart rows={rows} /> : <Empty>Sem dados no período.</Empty>}</Section>

            {current ? (
              <>
                <Section title="Lançamentos do dia" right={<span className="text-xs text-zinc-500">salva sozinho e aparece na hora pro sócio</span>}>
                  <DailyTable opId={current.id} rows={rows} entries={data.entries} categories={data.categories} expenses={data.expenses} canEdit={canEdit} onChanged={reload} />
                </Section>
                <div className="grid gap-4 2xl:grid-cols-2">
                  <Section title="Despesas lançadas">
                    <Expenses opId={current.id} categories={data.categories} expenses={data.expenses} range={range} canEdit={canEdit} onChanged={reload} />
                  </Section>
                  <Section title="Vendas registradas pelo Zap Data">
                    <Sales sales={data.sales.filter((s) => s.operation_id === current.id && s.paid_at.slice(0, 10) >= range.from && s.paid_at.slice(0, 10) <= range.to)} />
                  </Section>
                </div>
              </>
            ) : (
              <SummaryTables ops={scopeOps} data={data} range={range} disabled={disabled} email={email} open={(id) => go({ kind: 'op', id })} />
            )}
          </div>
        )}
      </main>

      {newOp && <NewOperation userId={userId} onClose={() => setNewOp(false)} onCreated={(id) => { setNewOp(false); reload().then(() => go({ kind: 'op', id })) }} />}
      {dayClose && <DayClose ops={actionOps} data={data} onClose={() => setDayClose(false)} onSaved={() => { setDayClose(false); reload() }} />}
      {quickExp && <QuickExpense ops={actionOps} data={data} defaultOp={current?.id} onClose={() => setQuickExp(false)} onSaved={() => { setQuickExp(false); reload() }} />}
      {pwd && <ChangePassword onClose={() => setPwd(false)} />}
      {settings && current && (
        <Settings op={current} members={data.members} isOwner={role === 'owner'} canEdit={canEdit} onClose={() => setSettings(false)} onChanged={reload}
          onDeleted={() => { setSettings(false); go({ kind: 'summary' }); reload() }} />
      )}
    </div>
  )
}

function SummaryTables({ ops, data, range, disabled, email, open }: {
  ops: ReturnType<typeof useData>['data']['operations']; data: ReturnType<typeof useData>['data']; range: Range; disabled: Set<string>; email: string; open: (id: string) => void
}) {
  const perOp = ops.map((o) => {
    const t = totalsOf(computeDays([o], data.entries, data.categories, data.expenses, range, disabled), disabled)
    return { o, t, share: myShareOf(data.members, o.id, email) }
  })
  const allDays = computeDays(ops, data.entries, data.categories, data.expenses, { from: '2000-01-01', to: '2999-12-31' }, disabled)
  const months = [...groupByMonth(allDays).entries()].reverse()
  const th = 'px-2 py-2 text-right font-medium'
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Section title="Por operação (período escolhido)">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <th className="px-2 py-2 text-left font-medium">Operação</th><th className={th}>Gasto tráfego</th><th className={th}>Imposto Meta</th><th className={th}>Retorno</th><th className={th}>Outras despesas</th><th className={th}>Lucro</th><th className={th}>ROAS</th><th className={th}>Minha parte</th>
            </tr></thead>
            <tbody>
              {perOp.map(({ o, t, share }) => (
                <tr key={o.id} className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40" onClick={() => open(o.id)}>
                  <td className="px-2 py-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} /><span className="truncate">{o.name}</span></span></td>
                  <td className="px-2 text-right tabular-nums">{money(t.spend)}</td>
                  <td className="px-2 text-right tabular-nums">{money(t.tax)}</td>
                  <td className="px-2 text-right tabular-nums">{money(t.revenue)}</td>
                  <td className="px-2 text-right tabular-nums">{money(t.expenses - (t.taxOn ? t.tax : 0))}</td>
                  <td className={`px-2 text-right font-medium tabular-nums ${tone(t.profit)}`}>{money(t.profit)}</td>
                  <td className="px-2 text-right tabular-nums">{ratio(t.spend ? t.revenue / t.spend : NaN)}</td>
                  <td className={`px-2 text-right tabular-nums ${tone(t.profit * share)}`}>{money(t.profit * share)} <span className="text-xs text-zinc-500">({share * 100}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Mês a mês (operações marcadas)">
        {!months.length ? <Empty>Sem dados.</Empty> : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-2 py-2 text-left font-medium">Mês</th><th className={th}>Gasto tráfego</th><th className={th}>Imposto Meta</th><th className={th}>Retorno</th><th className={th}>Outras despesas</th><th className={th}>Lucro líquido</th><th className={th}>Margem</th>
              </tr></thead>
              <tbody>
                {months.map(([m, rs]) => {
                  const t = totalsOf(rs, disabled)
                  return (
                    <tr key={m} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="px-2 py-2 font-medium">{monthLabel(m)}</td>
                      <td className="px-2 text-right tabular-nums">{money(t.spend)}</td>
                      <td className="px-2 text-right tabular-nums">{money(t.tax)}</td>
                      <td className="px-2 text-right tabular-nums">{money(t.revenue)}</td>
                      <td className="px-2 text-right tabular-nums">{money(t.expenses - (t.taxOn ? t.tax : 0))}</td>
                      <td className={`px-2 text-right font-medium tabular-nums ${tone(t.profit)}`}>{money(t.profit)}</td>
                      <td className="px-2 text-right tabular-nums">{pct(t.revenue ? t.profit / t.revenue : NaN)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function NewOperation({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const id = crypto.randomUUID()
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
    const { error } = await supabase.from('operations').insert({ id, name: name.trim(), created_by: userId, color: colors[Math.floor(Math.random() * colors.length)] })
    if (error) setErr(error.message); else onCreated(id)
  }
  return (
    <Modal title="Nova operação" onClose={onClose}>
      <form onSubmit={create} className="space-y-3">
        <input autoFocus className="input" placeholder="Ex.: Op 04 iPhone - Studio" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-zinc-500">Ela já vem com Imposto Meta (12,15%), Editor (Valtécio), Zap Data e Verificado Instagram. Você pode mudar depois.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary w-full">Criar operação</button>
      </form>
    </Modal>
  )
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Modal title="Trocar senha" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await supabase.auth.updateUser({ password: p })
        setMsg(error ? error.message : 'Senha trocada.')
      }}>
        <input className="input" type="password" minLength={6} placeholder="Nova senha (mín. 6)" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" />
        {msg && <p className="text-sm">{msg}</p>}
        <button className="btn-primary w-full">Salvar</button>
      </form>
    </Modal>
  )
}
