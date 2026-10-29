-- Protege o gasto já lançado à mão quando uma operação muda de BM / conecta o Meta depois.
-- Toda conexão nova do Meta passa a valer só do dia em que foi conectada pra frente:
-- os dias anteriores ficam com o gasto que já está no painel.
alter table public.meta_connections
  add column if not exists sync_from date default ((now() at time zone 'America/Sao_Paulo')::date);

-- a Op 03 já está conectada desde o começo: continua podendo corrigir qualquer dia
update public.meta_connections set sync_from = null
where operation_id = 'ce3688a2-7a82-4d90-9bca-9c94b80f3e7d';

select operation_id, sync_from from public.meta_connections;
