// Recebe uma venda do Zap Data (depois que a IA leu o comprovante) e registra na operação certa.
// POST /functions/v1/registrar-venda   header: x-token: <token da operação>
// corpo: { "valor": "49,90", "nome_pagador": "...", "telefone": "...", "id_comprovante": "...", "data_hora": "2026-10-26T14:03:00-03:00" }
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-token, authorization, apikey',
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[^\d,.-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return Number(s)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, erro: 'use POST' }, 405)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return json({ ok: false, erro: 'corpo precisa ser JSON' }, 400) }

  const url = new URL(req.url)
  const token = req.headers.get('x-token') ?? url.searchParams.get('token') ?? String(body.token ?? '')
  if (!token) return json({ ok: false, erro: 'falta o token da operação' }, 401)

  const valor = parseValor(body.valor ?? body.amount)
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100000) return json({ ok: false, erro: 'valor inválido' }, 400)

  // comprovante que a IA marcou como falso não entra
  const valido = body.comprovante_valido ?? body.valido
  if (valido === false || valido === 'false' || valido === 'nao' || valido === 'não') {
    return json({ ok: false, erro: 'comprovante marcado como inválido, venda não registrada' }, 422)
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: op } = await db.from('operations').select('id, name').eq('ingest_token', token).maybeSingle()
  if (!op) return json({ ok: false, erro: 'token não confere com nenhuma operação' }, 401)

  const paidAt = body.data_hora ? new Date(String(body.data_hora)) : new Date()
  const { data, error } = await db.from('sales').insert({
    operation_id: op.id,
    amount: Math.round(valor * 100) / 100,
    paid_at: isNaN(paidAt.getTime()) ? new Date().toISOString() : paidAt.toISOString(),
    payer_name: body.nome_pagador ? String(body.nome_pagador).slice(0, 120) : null,
    customer_phone: body.telefone ? String(body.telefone).slice(0, 40) : null,
    receipt_id: body.id_comprovante ? String(body.id_comprovante).slice(0, 120) : null,
    source: 'zapdata',
    raw: body,
  }).select('id').single()

  if (error) {
    // mesmo comprovante mandado duas vezes
    if (error.code === '23505') return json({ ok: true, duplicado: true, operacao: op.name })
    return json({ ok: false, erro: error.message }, 500)
  }
  return json({ ok: true, venda_id: data.id, operacao: op.name, valor })
})
