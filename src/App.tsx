import type { Session } from '@supabase/supabase-js'
import {
  BadgeDollarSign, Boxes, CalendarDays, ChevronRight, ClipboardList, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Plug, Plus, Receipt,
  RefreshCw, ShoppingBag, Sun,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import DailyChart from './components/Chart'
import DailyTable from './components/DailyTable'
import Expenses from './components/Expenses'
import { ExpenseToggles, FilterCard, rangeFor, type FilterState } from './components/Filters'
import Kpis, { ProductKpis } from './components/Kpis'
import Login from './components/Login'
import { ProductList, SalesByProduct } from './components/Products'
import { AdSpend, DayClose, QuickExpense } from './components/QuickActions'
import Sales from './components/Sales'
import Settings from './components/Settings'
import { Empty, Modal, Section, tone } from './components/ui'
import { computeDays, groupByMonth, myShareOf, totalsOf, type Range } from './lib/calc'
import { money, monthLabel, pct, ratio, todayISO } from './lib/format'
import { supabase } from './lib/supabase'
import type { Operation } from './lib/types'
import { useData, type Data } from './lib/useData'

function stored<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function store(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* modo privado */ } }

type Page = 'resumo' | 'vendas' | 'lancamentos' | 'despesas' | 'pacotes' | 'operacoes'
const PAGES: { id: Page; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: 'resumo', label: 'Resumo', short: 'Resumo', icon: LayoutDashboard },
  { id: 'vendas', label: 'Vendas', short: 'Vendas', icon: ShoppingBag },
  { id: 'lancamentos', label: 'Lançamentos do dia', short: 'Dias', icon: CalendarDays },
  { id: 'despesas', label: 'Despesas', short: 'Despesas', icon: Receipt },
  { id: 'pacotes', label: 'Pacotes', short: 'Pacotes', icon: Boxes },
  { id: 'operacoes', label: 'Operações e integrações', short: 'Operações', icon: Plug },
]
const DOCK: Page[] = ['resumo', 'vendas', 'lancamentos', 'despesas']

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

function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" width={size * 0.56} height={size * 0.56}><path d="M6 23l6-7 5 4 9-11" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  )
}

function Dashboard({ email, userId }: { email: string; userId: string }) {
  const { data, loading, error, live, reload, updatedAt } = useData(true)
  const [page, setPage] = useState<Page>(() => stored<Page>('pagina', 'resumo'))
  const [f, setF] = useState<FilterState>(() => ({
    preset: 'month', custom: { from: todayISO().slice(0, 8) + '01', to: todayISO() }, op: 'all', product: 'all',
    ...stored<Partial<FilterState>>('filtros', {}),
  }))
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(stored<string[]>('disabled', [])))
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [drawer, setDrawer] = useState(false)
  const [actions, setActions] = useState(false)
  const [newOp, setNewOp] = useState(false)
  const [pwd, setPwd] = useState(false)
  const [settings, setSettings] = useState<string | null>(null)
  const [dayClose, setDayClose] = useState(false)
  const [quickExp, setQuickExp] = useState(false)
  const [adSpend, setAdSpend] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => store('pagina', page), [page])
  useEffect(() => store('filtros', f), [f])
  useEffect(() => store('disabled', [...disabled]), [disabled])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('tema', dark ? 'dark' : 'light') } catch { /* ignore */ }
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1e1e1e' : '#ffffff')
  }, [dark])

  const ops = data.operations
  const range = rangeFor(f.preset, f.custom)
  const setFilter = (patch: Partial<FilterState>) => setF((s) => ({ ...s, ...patch }))
  const current = f.op === 'all' ? undefined : ops.find((o) => o.id === f.op)
  useEffect(() => { if (f.op !== 'all' && !loading && !current) setFilter({ op: 'all' }) }, [f.op, loading, current])
  const scopeOps = useMemo(() => (current ? [current] : ops), [current, ops])
  const pageOp = current ?? ops[0] // telas que precisam de uma operação só

  const roleOf = (opId: string) => data.members.find((m) => m.operation_id === opId && m.email.toLowerCase() === email.toLowerCase())?.role
  const canEditOp = (opId: string) => ['owner', 'editor'].includes(roleOf(opId) ?? '')
  const editableOps = ops.filter((o) => canEditOp(o.id))
  const actionOps = current ? editableOps.filter((o) => o.id === current.id) : editableOps

  const rows = useMemo(() => computeDays(scopeOps, data.entries, data.categories, data.expenses, range, disabled), [scopeOps, data, range.from, range.to, disabled])
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
  const showMine = scopeOps.some((o) => myShareOf(data.members, o.id, email) < 1)

  const scopeIds = new Set(scopeOps.map((o) => o.id))
  const sales = data.sales.filter((s) => scopeIds.has(s.operation_id) && s.paid_at.slice(0, 10) >= range.from && s.paid_at.slice(0, 10) <= range.to)
  const scopeProducts = data.products.filter((p) => scopeIds.has(p.operation_id))
  const productNames = [...new Set(scopeProducts.map((p) => p.name))]
  const productIds = new Set(scopeProducts.filter((p) => p.name === f.product).map((p) => p.id))
  const productSales = f.product === 'all' ? sales : sales.filter((s) => s.product_id && productIds.has(s.product_id))
  const catNames = [...new Set(data.categories.filter((c) => scopeIds.has(c.operation_id)).map((c) => c.name))]
  const toggle = (n: string) => setDisabled((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })

  // botão Atualizar: puxa o gasto do Meta das operações conectadas e recarrega tudo
  async function refresh() {
    setSyncing(true)
    const errs: string[] = []
    for (const o of actionOps) {
      const { data: r } = await supabase.functions.invoke('sincronizar-meta', { body: { operation_id: o.id, days: 2 } })
      const res = r?.results?.[0]
      if (res && !res.ok) errs.push(`${o.name}: ${res.erro}`)
    }
    await reload()
    setSyncing(false)
    if (errs.length) setToast(`Meta: ${errs.join(' · ')}`)
  }

  const go = (p: Page) => { setPage(p); setDrawer(false) }
  // telas com cartão de filtros já mostram o título no cartão; o topo fica com o nome do app
  const title = ['pacotes', 'operacoes'].includes(page) ? PAGES.find((p) => p.id === page)!.label : 'Painel das operações'
  const filterProps = { f, set: setFilter, ops, products: productNames, updatedAt, now, refreshing: syncing, onRefresh: refresh }

  const navItem = (p: (typeof PAGES)[number]) => {
    const Icon = p.icon
    const on = page === p.id
    return (
      <button key={p.id} onClick={() => go(p.id)}
        className={`btn w-full justify-start gap-3 py-2.5 ${on ? 'bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'btn-ghost'}`}>
        <Icon size={18} /> {p.label}
      </button>
    )
  }
  const menuContent = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        <Logo />
        <span className="text-[17px] font-semibold">Operações</span>
        <span className={`ml-auto h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-zinc-400'}`} title={live ? 'Ao vivo' : 'Conectando…'} />
      </div>
      {PAGES.map(navItem)}
      <div className="mt-auto space-y-1 border-t border-zinc-200 pt-3 dark:border-line-dark">
        <p className="truncate px-3 pb-1 text-xs text-zinc-500">{email}</p>
        <button className="btn-ghost w-full justify-start gap-3" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />} Modo {dark ? 'claro' : 'escuro'}</button>
        <button className="btn-ghost w-full justify-start gap-3" onClick={() => { setPwd(true); setDrawer(false) }}><KeyRound size={18} /> Trocar senha</button>
        <button className="btn-ghost w-full justify-start gap-3" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sair</button>
      </div>
    </nav>
  )

  let body: ReactNode
  if (!loading && !ops.length) {
    body = <Section title="Comece por aqui"><Empty>Você ainda não tem operações. Toque no botão roxo e em <b>Nova operação</b>.</Empty></Section>
  } else if (page === 'resumo') {
    body = (
      <>
        <FilterCard title="Resumo" {...filterProps} />
        {editableOps.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn-outline h-11 bg-white dark:bg-panel-dark" onClick={() => setAdSpend(true)}><BadgeDollarSign size={17} /> Gasto com anúncio</button>
            <button className="btn-outline h-11 bg-white dark:bg-panel-dark" onClick={() => setQuickExp(true)}><Receipt size={17} /> Despesa</button>
          </div>
        )}
        {f.product === 'all' ? (
          <>
            <Kpis t={totals} showMine={showMine} saved={saved} onExpenses={() => go('despesas')} />
            {saved > 0.004 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Com despesas desligadas: lucro {money(totals.profit)} (com todas seria {money(allOn.profit)}).
              </p>
            )}
            <Section title="Dia a dia">{rows.length ? <DailyChart rows={rows} /> : <Empty>Sem dados no período.</Empty>}</Section>
          </>
        ) : (
          <ProductKpis revenue={productSales.reduce((s, x) => s + Number(x.amount), 0)} count={productSales.length} totalRevenue={sales.reduce((s, x) => s + Number(x.amount), 0)} />
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <Section title="Vendas por pacote"><SalesByProduct sales={sales} products={data.products} /></Section>
          {!current && ops.length > 1
            ? <Section title="Por operação"><PerOperation ops={ops} data={data} range={range} disabled={disabled} email={email} open={(id) => setFilter({ op: id })} /></Section>
            : <Section title="Mês a mês"><Monthly ops={scopeOps} data={data} disabled={disabled} /></Section>}
        </div>
        {!current && ops.length > 1 && <Section title="Mês a mês"><Monthly ops={scopeOps} data={data} disabled={disabled} /></Section>}
      </>
    )
  } else if (page === 'vendas') {
    body = (
      <>
        <FilterCard title="Vendas" {...filterProps} />
        <Section title="Vendas pelos comprovantes"><Sales sales={productSales} products={data.products} /></Section>
      </>
    )
  } else if (page === 'lancamentos' && pageOp) {
    const opRows = computeDays([pageOp], data.entries, data.categories, data.expenses, range, disabled)
    body = (
      <>
        <FilterCard title="Lançamentos" {...filterProps} f={{ ...f, op: pageOp.id }} allowAllOps={false} showProduct={false} />
        <Section title={pageOp.name} right={<span className="text-xs text-zinc-500">toque no valor pra editar</span>}>
          <DailyTable opId={pageOp.id} rows={opRows} entries={data.entries} categories={data.categories} expenses={data.expenses} canEdit={canEditOp(pageOp.id)} onChanged={reload} />
        </Section>
      </>
    )
  } else if (page === 'despesas') {
    body = (
      <>
        <FilterCard title="Despesas" {...filterProps} showProduct={false} />
        <Section title="Despesas na conta" right={<span className="text-xs text-zinc-500">desligue pra ver o lucro sem ela</span>}>
          <ExpenseToggles names={catNames} amounts={allOn.byCategory} disabled={disabled} toggle={toggle} />
          {saved > 0.004 && <p className="mt-2 text-[13px] text-amber-700 dark:text-amber-300">Sem as desligadas, o lucro sobe {money(saved)}.</p>}
        </Section>
        {scopeOps.map((o) => (
          <Section key={o.id} title={`Lançadas · ${o.name}`}>
            <Expenses opId={o.id} categories={data.categories} expenses={data.expenses} range={range} canEdit={canEditOp(o.id)} onChanged={reload} />
          </Section>
        ))}
      </>
    )
  } else if (page === 'pacotes') {
    body = (
      <>
        <div className="card p-4 text-[13px] text-zinc-600 dark:text-zinc-300">
          Cada venda que chega pelo comprovante é ligada ao pacote pelo valor pago (preço cheio ou da promoção).
          Quando dois pacotes têm o mesmo preço, vale o primeiro da lista.
        </div>
        {!data.products.length && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Os pacotes aparecem aqui depois de rodar o arquivo <b>pacotes.sql</b> no SQL Editor do Supabase.
          </p>
        )}
        {ops.map((o) => (
          <Section key={o.id} title={o.name}><ProductList opId={o.id} products={data.products} canEdit={canEditOp(o.id)} onChanged={reload} /></Section>
        ))}
      </>
    )
  } else if (page === 'operacoes') {
    body = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Operações</h2>
          <button className="btn-primary" onClick={() => setNewOp(true)}><Plus size={16} /> Nova</button>
        </div>
        {ops.map((o) => {
          const role = roleOf(o.id)
          return (
            <div key={o.id} className="card p-4">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: o.color }} />
                <p className="min-w-0 flex-1 truncate font-semibold">{o.name}</p>
              </div>
              <p className="mt-1 text-[13px] text-zinc-500">
                {role === 'viewer' ? 'Você só visualiza' : `Sua parte: ${myShareOf(data.members, o.id, email) * 100}% do lucro`}
                {' · '}{data.members.filter((m) => m.operation_id === o.id).length} pessoa(s)
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-outline" onClick={() => { setFilter({ op: o.id }); go('resumo') }}>Ver resumo</button>
                <button className="btn-outline" onClick={() => setSettings(o.id)}><Plug size={15} /> Integrações</button>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white lg:block dark:border-line-dark dark:bg-panel-dark">{menuContent}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)] dark:border-line-dark dark:bg-panel-dark">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <div className="lg:hidden"><Logo size={30} /></div>
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
            <button className="btn-ghost p-2" onClick={() => setDark(!dark)} aria-label="Tema">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <main className="scroll-area flex-1">
          <div className="mx-auto max-w-6xl space-y-3 px-3 pt-3 pb-[calc(150px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:space-y-4 lg:pb-24">
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Erro ao carregar: {error}</p>}
            {body}
          </div>
        </main>
      </div>

      {/* barra de baixo no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-line-dark dark:bg-panel-dark/95">
        {DOCK.map((id) => {
          const p = PAGES.find((x) => x.id === id)!
          const Icon = p.icon
          const on = page === id
          return (
            <button key={id} onClick={() => go(id)} className={`flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] ${on ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
              <Icon size={22} strokeWidth={on ? 2.3 : 1.8} /> {p.short}
            </button>
          )
        })}
        <button onClick={() => setDrawer(true)} className={`flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] ${['pacotes', 'operacoes'].includes(page) ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
          <Menu size={22} /> Menu
        </button>
      </nav>

      {/* botão roxo de lançar */}
      {editableOps.length > 0 && (
        <button onClick={() => setActions(true)} aria-label="Lançar"
          className="fixed right-4 bottom-[calc(74px+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 active:scale-95 lg:right-8 lg:bottom-8">
          <ClipboardList size={24} />
        </button>
      )}

      {toast && (
        <div className="fixed inset-x-3 top-[calc(64px+env(safe-area-inset-top))] z-[70] mx-auto max-w-md rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900" onClick={() => setToast(null)}>{toast}</div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="flex h-full w-[82%] max-w-xs flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:bg-panel-dark" onClick={(e) => e.stopPropagation()}>
            {menuContent}
          </aside>
        </div>
      )}

      {actions && (
        <Modal title="O que você quer lançar?" onClose={() => setActions(false)}>
          <div className="space-y-2">
            <ActionItem icon={<BadgeDollarSign size={20} />} title="Gasto com anúncio" sub="Quanto gastou no Meta no dia (Op 02, que não puxa sozinha)"
              onClick={() => { setActions(false); setAdSpend(true) }} />
            <ActionItem icon={<ClipboardList size={20} />} title="Balanço do dia" sub="Gasto, editor e despesas do dia, de todas as operações"
              onClick={() => { setActions(false); setDayClose(true) }} />
            <ActionItem icon={<Receipt size={20} />} title="Despesa avulsa" sub="Zap Data, verificado ou outra despesa"
              onClick={() => { setActions(false); setQuickExp(true) }} />
            <ActionItem icon={<RefreshCw size={20} />} title="Atualizar gasto do Meta" sub="Puxa agora o gasto das operações conectadas"
              onClick={() => { setActions(false); refresh().then(() => setToast('Gasto do Meta atualizado.')) }} />
            <ActionItem icon={<Plus size={20} />} title="Nova operação" sub="Cria uma operação com as despesas padrão"
              onClick={() => { setActions(false); setNewOp(true) }} />
          </div>
        </Modal>
      )}

      {newOp && <NewOperation userId={userId} onClose={() => setNewOp(false)} onCreated={(id) => { setNewOp(false); reload().then(() => { setFilter({ op: id }); go('resumo') }) }} />}
      {dayClose && <DayClose ops={actionOps} data={data} onClose={() => setDayClose(false)} onSaved={() => { setDayClose(false); reload(); setToast('Balanço salvo.') }} />}
      {quickExp && <QuickExpense ops={actionOps} data={data} defaultOp={current?.id} onClose={() => setQuickExp(false)} onSaved={() => { setQuickExp(false); reload(); setToast('Despesa lançada.') }} />}
      {adSpend && <AdSpend ops={actionOps} data={data} defaultOp={current?.id} onClose={() => setAdSpend(false)} onSaved={() => { setAdSpend(false); reload(); setToast('Gasto salvo.') }} />}
      {pwd && <ChangePassword onClose={() => setPwd(false)} />}
      {settings && ops.find((o) => o.id === settings) && (
        <Settings op={ops.find((o) => o.id === settings)!} members={data.members} isOwner={roleOf(settings) === 'owner'} canEdit={canEditOp(settings)}
          onClose={() => setSettings(null)} onChanged={reload}
          onDeleted={() => { setSettings(null); setFilter({ op: 'all' }); reload() }} />
      )}
    </div>
  )
}

function ActionItem({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 p-3 text-left active:bg-zinc-50 dark:border-line-dark dark:active:bg-white/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-xs text-zinc-500">{sub}</span>
      </span>
      <ChevronRight size={18} className="text-zinc-400" />
    </button>
  )
}

function PerOperation({ ops, data, range, disabled, email, open }: {
  ops: Operation[]; data: Data; range: Range; disabled: Set<string>; email: string; open: (id: string) => void
}) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-line-dark">
      {ops.map((o) => {
        const t = totalsOf(computeDays([o], data.entries, data.categories, data.expenses, range, disabled), disabled)
        const share = myShareOf(data.members, o.id, email)
        return (
          <li key={o.id} className="cursor-pointer py-3 first:pt-0 last:pb-0" onClick={() => open(o.id)}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
              <span className={`text-sm font-semibold tabular-nums ${tone(t.profit)}`}>{money(t.profit)}</span>
            </div>
            <p className="mt-0.5 pl-[18px] text-xs text-zinc-500">
              Fat. {money(t.revenue)} · Gasto {money(t.spend)} · ROAS {ratio(t.spend ? t.revenue / t.spend : NaN)}
              {share < 1 && <> · minha parte <span className={tone(t.profit * share)}>{money(t.profit * share)}</span></>}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function Monthly({ ops, data, disabled }: { ops: Operation[]; data: Data; disabled: Set<string> }) {
  const allDays = computeDays(ops, data.entries, data.categories, data.expenses, { from: '2000-01-01', to: '2999-12-31' }, disabled)
  const months = [...groupByMonth(allDays).entries()].reverse()
  if (!months.length) return <Empty>Sem dados.</Empty>
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-line-dark">
      {months.map(([m, rs]) => {
        const t = totalsOf(rs, disabled)
        return (
          <li key={m} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium capitalize">{monthLabel(m)}</span>
              <span className={`text-sm font-semibold tabular-nums ${tone(t.profit)}`}>{money(t.profit)}</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Fat. {money(t.revenue)} · Gasto {money(t.spend)} · Imposto {money(t.tax)} · Despesas {money(t.expenses - (t.taxOn ? t.tax : 0))} · margem {pct(t.revenue ? t.profit / t.revenue : NaN)}
            </p>
          </li>
        )
      })}
    </ul>
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
        <p className="text-xs text-zinc-500">Ela já vem com Imposto Meta (12,15%), Editor (Valtécio), Zap Data, Verificado Instagram e a tabela de pacotes. Dá pra mudar depois.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn-primary h-11 w-full">Criar operação</button>
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
        <button className="btn-primary h-11 w-full">Salvar</button>
      </form>
    </Modal>
  )
}
