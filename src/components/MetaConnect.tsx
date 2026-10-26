import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

interface Conn { ad_account_id: string; campaign_filter: string | null; has_token: boolean; last_sync_at: string | null; last_error: string | null; last_result: { total?: number } | null }

/** Liga a operação a uma conta de anúncio do Meta pra puxar o gasto sozinho. */
export default function MetaConnect({ opId, canEdit, onSynced }: { opId: string; canEdit: boolean; onSynced: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null)
  const [account, setAccount] = useState('')
  const [filter, setFilter] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data } = await supabase.rpc('get_meta_connection', { p_operation: opId })
    const c = (data as Conn[] | null)?.[0] ?? null
    setConn(c)
    if (c) { setAccount(c.ad_account_id); setFilter(c.campaign_filter ?? '') }
  }
  useEffect(() => { load() }, [opId])

  async function sync(days: number) {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('sincronizar-meta', { body: { operation_id: opId, days } })
    const r = data?.results?.[0]
    if (error || !r?.ok) setMsg({ ok: false, text: r?.erro ?? error?.message ?? 'Não deu certo.' })
    else setMsg({ ok: true, text: `Gasto atualizado: ${money(r.total)} de ${data.since.split('-').reverse().join('/')} a ${data.until.split('-').reverse().join('/')}.` })
    setBusy(false)
    load()
    onSynced()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('set_meta_connection', { p_operation: opId, p_ad_account: account, p_filter: filter, p_token: token })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    setToken('')
    await load()
    sync(7)
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">Gasto do Meta automático</p>
      <p className="mb-2 text-xs text-zinc-500">
        De hora em hora o painel puxa o gasto de ontem e de hoje dessa conta e preenche o "Gasto com tráfego". O imposto continua sendo calculado em cima.
      </p>
      {conn && (
        <p className={`mb-2 rounded-xl p-2.5 text-xs ${conn.last_error ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
          Conectado à conta {conn.ad_account_id}{conn.campaign_filter ? `, campanhas com "${conn.campaign_filter}"` : ', todas as campanhas'}.
          {conn.last_sync_at && ` Última busca: ${new Date(conn.last_sync_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`}
          {conn.last_error && ` Erro: ${conn.last_error}`}
        </p>
      )}
      {canEdit && (
        <form onSubmit={save} className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">ID da conta de anúncio</label>
            <input className="input" placeholder="ex.: 1234567890" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div>
            <label className="label">Nome da campanha contém</label>
            <input className="input" placeholder="ex.: NAFS (vazio = todas)" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Token de acesso (usuário do sistema da BM)</label>
            <input className="input font-mono text-xs" type="password" autoComplete="off" placeholder={conn?.has_token ? 'já salvo (cole outro só se quiser trocar)' : 'EAAG...'} value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <button className="btn-primary col-span-2 sm:col-span-1" disabled={busy}>{conn ? 'Salvar' : 'Conectar Meta'}</button>
          {conn && (
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1">
              <button type="button" className="btn-outline flex-1" disabled={busy} onClick={() => sync(2)}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Sincronizar</button>
              <button type="button" className="btn-outline flex-1" disabled={busy} onClick={() => sync(30)}>Puxar 30 dias</button>
            </div>
          )}
          {conn && (
            <button type="button" className="btn-ghost col-span-2 justify-start text-xs text-rose-600" onClick={async () => {
              if (!confirm('Desconectar o Meta dessa operação? Os gastos já puxados ficam.')) return
              await supabase.rpc('remove_meta_connection', { p_operation: opId }); setConn(null); setAccount(''); setFilter('')
            }}>Desconectar</button>
          )}
        </form>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
    </div>
  )
}
