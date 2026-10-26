import { Copy, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { SUPABASE_URL, supabase } from '../lib/supabase'
import type { Member, Operation, Role } from '../lib/types'
import { Modal } from './ui'

const ROLES: Record<Role, string> = { owner: 'Dono', editor: 'Edita', viewer: 'Só vê' }
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#84cc16']

export default function Settings({ op, members, isOwner, onClose, onChanged, onDeleted }: {
  op: Operation; members: Member[]; isOwner: boolean; onClose: () => void; onChanged: () => void; onDeleted: () => void
}) {
  const [name, setName] = useState(op.name)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [inv, setInv] = useState({ email: '', name: '', share: '50', role: 'editor' as Role, password: '' })
  const mine = members.filter((m) => m.operation_id === op.id)
  const webhook = `${SUPABASE_URL}/functions/v1/registrar-venda`

  const done = (error: { message: string } | null, ok?: string) => { setErr(error?.message ?? null); setMsg(error ? null : ok ?? null); onChanged() }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.rpc('invite_member', {
      p_operation: op.id, p_email: inv.email, p_name: inv.name || null,
      p_share: Number(inv.share.replace(',', '.')) || 0, p_role: inv.role, p_temp_password: inv.password || null,
    })
    done(error, data
      ? `Conta criada. Mande pra ${inv.name || inv.email}: o link do painel, e-mail ${inv.email} e senha ${inv.password}.`
      : `${inv.email} já tinha conta e agora vê essa operação.`)
    if (!error) setInv({ email: '', name: '', share: '50', role: 'editor', password: '' })
  }

  return (
    <Modal title="Configurações da operação" onClose={onClose} wide>
      <div className="space-y-6">
        <div>
          <label className="label">Nome</label>
          <div className="flex gap-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary" onClick={async () => done((await supabase.from('operations').update({ name }).eq('id', op.id)).error, 'Nome salvo.')}>Salvar</button>
          </div>
          <div className="mt-2 flex gap-2">
            {COLORS.map((c) => (
              <button key={c} aria-label={`Cor ${c}`} onClick={async () => done((await supabase.from('operations').update({ color: c }).eq('id', op.id)).error)}
                className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ${op.color === c ? 'ring-2 ring-zinc-400' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Quem tem acesso</p>
          <ul className="space-y-2">
            {mine.map((m) => (
              <li key={m.email} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-sm dark:border-zinc-800">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{m.display_name || m.email}</span>
                  <span className="block truncate text-xs text-zinc-500">{m.email} · {ROLES[m.role]}</span>
                </span>
                {isOwner ? (
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    parte
                    <input className="input w-16 text-right" defaultValue={String(m.share_pct)}
                      onBlur={async (e) => done((await supabase.from('operation_members').update({ share_pct: Number(e.target.value.replace(',', '.')) || 0 }).eq('operation_id', op.id).eq('email', m.email)).error)} />%
                  </label>
                ) : <span className="text-xs text-zinc-500">{m.share_pct}% do lucro</span>}
                {isOwner && m.role !== 'owner' && (
                  <button className="btn-ghost p-1.5 text-zinc-400 hover:text-rose-600" aria-label="Remover acesso"
                    onClick={async () => confirm(`Tirar o acesso de ${m.email}?`) && done((await supabase.from('operation_members').delete().eq('operation_id', op.id).eq('email', m.email)).error)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <form onSubmit={invite} className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <p className="col-span-2 text-sm font-medium">Dar acesso a um sócio</p>
              <input className="input col-span-2 sm:col-span-1" type="email" required placeholder="E-mail" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
              <input className="input col-span-2 sm:col-span-1" placeholder="Nome (ex.: Messias)" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} />
              <input className="input" placeholder="% do lucro" value={inv.share} onChange={(e) => setInv({ ...inv, share: e.target.value })} />
              <select className="input" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as Role })}>
                <option value="editor">Pode editar</option>
                <option value="viewer">Só visualizar</option>
                <option value="owner">Dono (pode dar acesso)</option>
              </select>
              <input className="input col-span-2" placeholder="Senha provisória (se a pessoa ainda não tem conta)" value={inv.password} onChange={(e) => setInv({ ...inv, password: e.target.value })} />
              <button className="btn-primary col-span-2"><UserPlus size={16} /> Dar acesso</button>
            </form>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold">Registrar vendas automaticamente (Zap Data)</p>
          <p className="mb-2 text-xs text-zinc-500">
            No final do fluxo de pagamento, depois que a IA ler o comprovante, adicione uma requisição HTTP POST com estes dados.
            A venda soma no faturamento do dia na hora, pra todo mundo.
          </p>
          <Copyable label="URL" value={webhook} />
          <Copyable label="Token desta operação (header x-token)" value={op.ingest_token} />
          <Copyable label="Corpo (JSON)" value={'{ "valor": "49,90", "nome_pagador": "...", "telefone": "...", "id_comprovante": "..." }'} />
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {msg && <p className="rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{msg}</p>}

        {isOwner && (
          <button className="btn-outline text-rose-600" onClick={async () => {
            if (prompt(`Para apagar, digite o nome da operação: ${op.name}`) !== op.name) return
            const { error } = await supabase.from('operations').delete().eq('id', op.id)
            if (error) setErr(error.message); else onDeleted()
          }}>
            <Trash2 size={15} /> Apagar operação
          </button>
        )}
      </div>
    </Modal>
  )
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="mb-2">
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <code className="input truncate font-mono text-xs">{value}</code>
        <button className="btn-outline px-2.5" aria-label="Copiar" onClick={() => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200) }}>
          {ok ? '✓' : <Copy size={15} />}
        </button>
      </div>
    </div>
  )
}
