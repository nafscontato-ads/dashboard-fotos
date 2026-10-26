-- Conexão de cada operação com uma conta de anúncio do Meta (o token fica escondido, só as funções leem).
create table if not exists public.meta_connections (
  operation_id uuid primary key references public.operations(id) on delete cascade,
  ad_account_id text not null,
  campaign_filter text,
  access_token text not null,
  last_sync_at timestamptz,
  last_error text,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
alter table public.meta_connections enable row level security;

create or replace function public.get_meta_connection(p_operation uuid)
returns table(ad_account_id text, campaign_filter text, has_token boolean, last_sync_at timestamptz, last_error text, last_result jsonb)
language sql stable security definer set search_path = public as $$
  select c.ad_account_id, c.campaign_filter, c.access_token <> '', c.last_sync_at, c.last_error, c.last_result
  from public.meta_connections c
  where c.operation_id = p_operation and public.is_member(p_operation);
$$;

create or replace function public.set_meta_connection(p_operation uuid, p_ad_account text, p_filter text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare acc text := regexp_replace(coalesce(p_ad_account,''), '[^0-9]', '', 'g');
begin
  if not public.is_member(p_operation, array['owner','editor']) then
    raise exception 'Sem permissão pra configurar essa operação';
  end if;
  if acc = '' then raise exception 'Informe o ID da conta de anúncio'; end if;
  if nullif(trim(coalesce(p_token,'')),'') is null and not exists (select 1 from public.meta_connections where operation_id = p_operation) then
    raise exception 'Cole o token de acesso da BM';
  end if;
  insert into public.meta_connections(operation_id, ad_account_id, campaign_filter, access_token)
  values (p_operation, acc, nullif(trim(p_filter),''), coalesce(trim(p_token),''))
  on conflict (operation_id) do update set
    ad_account_id = excluded.ad_account_id,
    campaign_filter = excluded.campaign_filter,
    access_token = coalesce(nullif(trim(p_token),''), public.meta_connections.access_token),
    last_error = null,
    updated_at = now();
end $$;

create or replace function public.remove_meta_connection(p_operation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_operation, array['owner','editor']) then
    raise exception 'Sem permissão';
  end if;
  delete from public.meta_connections where operation_id = p_operation;
end $$;

grant execute on function public.get_meta_connection(uuid) to authenticated;
grant execute on function public.set_meta_connection(uuid,text,text,text) to authenticated;
grant execute on function public.remove_meta_connection(uuid) to authenticated;

-- Busca automática do gasto do Meta de hora em hora (minuto 5)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security; -- sem políticas: só o servidor lê
insert into public.app_config(key, value) values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

select cron.unschedule('sincronizar-meta') where exists (select 1 from cron.job where jobname = 'sincronizar-meta');
select cron.schedule('sincronizar-meta', '5 * * * *', $$
  select net.http_post(
    url := 'https://tbdipwdxadqisoqnbwhq.supabase.co/functions/v1/sincronizar-meta',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')),
    body := '{"days": 2}'::jsonb
  );
$$);
