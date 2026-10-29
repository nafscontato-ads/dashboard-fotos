-- Rodar SÓ quando a Op 02 for conectada à BM nova.
-- Protege o gasto já lançado à mão: o Meta só mexe nos dias a partir da data abaixo.
alter table public.meta_connections add column if not exists sync_from date;
update public.meta_connections set sync_from = '2026-10-30'  -- troque pela data do 1º dia na BM nova
where operation_id = 'fda70a10-99c2-412c-9d8c-28c3f0a10259';
