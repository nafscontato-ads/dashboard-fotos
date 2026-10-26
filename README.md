# Painel das Operações (dashboard-fotos)

Painel para acompanhar as operações de venda de fotos: investido no Meta, retorno, despesas e lucro líquido de cada operação, com resumo geral, acesso por sócio e sincronização em tempo real.

- **Front:** React + Vite + Tailwind + Recharts, instalável como app (PWA) no iPhone, Android e PC.
- **Banco:** Supabase (projeto `tbdipwdxadqisoqnbwhq`, plano grátis), com regras de acesso por operação (RLS) e Realtime.
- **Vendas automáticas:** Edge Function `registrar-venda` (em `supabase/functions`) recebe as vendas do Zap Data.

## Como as contas funcionam
- **Lucro líquido** = retorno − investido − despesas ligadas.
- **Imposto Meta** = 12,15% sobre o investido (ajustável em "Tipos de despesa").
- **Editor (Valtécio)** aparece como coluna na tabela diária.
- Zap Data, Verificado e outras despesas são lançadas na data em que foram pagas.
- Cada despesa pode ser **desligada** nos filtros pra ver o lucro sem ela.
- **Minha parte** = lucro de cada operação × a % do sócio logado nela.

## Rodar localmente
```bash
npm install
npm run dev
```
A chave do Supabase usada no front é a publicável (segura pra ficar no navegador); quem pode ver o quê é decidido pelo banco.

## Registrar venda pelo Zap Data
`POST https://tbdipwdxadqisoqnbwhq.supabase.co/functions/v1/registrar-venda`
Header `x-token: <token da operação>` (fica em Configurar, dentro da operação). Corpo JSON:
```json
{ "valor": "49,90", "nome_pagador": "Maria", "telefone": "5511...", "id_comprovante": "E1234...", "comprovante_valido": true }
```
Comprovante repetido (mesmo `id_comprovante`) não conta duas vezes. `comprovante_valido: false` é recusado.
