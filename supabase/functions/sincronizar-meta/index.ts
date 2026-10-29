// Puxa o gasto do Meta Ads (últimos 7 dias, ou os últimos N dias) e grava no "Gasto com tráfego" de cada operação conectada.
// Chamado de hora em hora pelo agendador do banco (header x-cron-secret) ou pelo botão "Sincronizar agora" (login do usuário).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const GRAPH = 'https://graph.facebook.com/v23.0'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// datas no fuso de São Paulo
const spDay = (offset: number) => {
  const d = new Date(Date.now() + offset * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

interface Conn { operation_id: string; ad_account_id: string; campaign_filter: string | null; access_token: string; sync_from?: string | null }

async function spendByDay(c: Conn, since: string, until: string): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_name,spend',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: c.access_token,
  })
  if (c.campaign_filter) {
    params.set('filtering', JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: c.campaign_filter }]))
  }
  const out: Record<string, number> = {}
  let url: string | null = `${GRAPH}/act_${c.ad_account_id}/insights?${params}`
  while (url) {
    const r = await fetch(url)
    const body = await r.json()
    if (!r.ok || body.error) throw new Error(body.error?.message ?? `Meta respondeu ${r.status}`)
    for (const row of body.data ?? []) out[row.date_start] = (out[row.date_start] ?? 0) + Number(row.spend ?? 0)
    url = body.paging?.next ?? null
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({})) as { operation_id?: string; days?: number }
  // 7 dias por padrão: se o Meta ficar fora do ar uns dias, quando voltar corrige os dias que ficaram pra trás
  const days = Math.min(Math.max(Number(body.days) || 7, 7), 90)

  // quem está chamando: o agendador (segredo) ou um sócio logado
  let only: string | null = null
  const cron = req.headers.get('x-cron-secret')
  const { data: secret } = await db.from('app_config').select('value').eq('key', 'cron_secret').maybeSingle()
  if (!cron || !secret?.value || cron !== secret.value) {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u?.user?.email || !body.operation_id) return json({ ok: false, erro: 'não autorizado' }, 401)
    const { data: m } = await db.from('operation_members').select('role')
      .eq('operation_id', body.operation_id).ilike('email', u.user.email).maybeSingle()
    if (!m || m.role === 'viewer') return json({ ok: false, erro: 'sem permissão nessa operação' }, 403)
    only = body.operation_id
  }

  let q = db.from('meta_connections').select('*')
  if (only) q = q.eq('operation_id', only)
  const { data: conns, error } = await q
  if (error) return json({ ok: false, erro: error.message }, 500)

  const until = spDay(0)
  const baseSince = spDay(-(days - 1))
  const results = []
  for (const c of (conns ?? []) as Conn[]) {
    try {
      const since = c.sync_from && c.sync_from > baseSince ? c.sync_from : baseSince
      const byDay = await spendByDay(c, since, until)
      // dias sem gasto no período viram zero, pra não ficar valor velho
      for (let i = days - 1; i >= 0; i--) {
        const day = spDay(-i)
        // dias antes da conta atual (ex.: operação que mudou de BM) ficam com o gasto já lançado
        if (c.sync_from && day < c.sync_from) continue
        const spend = Math.round((byDay[day] ?? 0) * 100) / 100
        const { data: cur } = await db.from('daily_entries').select('id').eq('operation_id', c.operation_id).eq('day', day).maybeSingle()
        if (cur) await db.from('daily_entries').update({ ad_spend: spend, updated_at: new Date().toISOString() }).eq('id', cur.id)
        // dia novo só é criado nos últimos 7 dias; no "puxar 30 dias" só corrige dias que já existem
        else if (spend > 0 && i < 7) await db.from('daily_entries').insert({ operation_id: c.operation_id, day, ad_spend: spend, revenue: 0 })
      }
      const total = Object.values(byDay).reduce((s, v) => s + v, 0)
      await db.from('meta_connections').update({ last_sync_at: new Date().toISOString(), last_error: null, last_result: { since, until, total, byDay } }).eq('operation_id', c.operation_id)
      results.push({ operation_id: c.operation_id, ok: true, total })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await db.from('meta_connections').update({ last_sync_at: new Date().toISOString(), last_error: msg }).eq('operation_id', c.operation_id)
      results.push({ operation_id: c.operation_id, ok: false, erro: msg })
    }
  }
  return json({ ok: true, since: baseSince, until, results })
})
