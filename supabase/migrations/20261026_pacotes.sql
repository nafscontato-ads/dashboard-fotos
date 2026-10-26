-- Pacotes (produtos) de cada operação. Cada venda que chega dos comprovantes
-- é ligada ao pacote pelo valor pago (preço cheio ou preço da promoção de 50%).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  promo_price numeric(10,2),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_operation_idx on public.products(operation_id);

alter table public.products enable row level security;
drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;
create policy products_select on public.products for select using (public.is_member(operation_id));
create policy products_insert on public.products for insert with check (public.is_member(operation_id, array['owner','editor']));
create policy products_update on public.products for update using (public.is_member(operation_id, array['owner','editor']));
create policy products_delete on public.products for delete using (public.is_member(operation_id, array['owner','editor']));

alter table public.sales add column if not exists product_id uuid references public.products(id) on delete set null;

-- descobre o pacote pelo valor (vale o primeiro da lista quando dois pacotes têm o mesmo preço)
create or replace function public.match_product(op uuid, amount numeric)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.products p
  where p.operation_id = op and p.active
    and (abs(p.price - amount) < 0.01 or abs(coalesce(p.promo_price, -1) - amount) < 0.01)
  order by abs(p.price - amount) < 0.01 desc, p.sort, p.created_at
  limit 1
$$;

create or replace function public._sale_set_product()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is null then
    new.product_id := public.match_product(new.operation_id, new.amount);
  end if;
  return new;
end $$;
drop trigger if exists sale_set_product on public.sales;
create trigger sale_set_product before insert on public.sales
  for each row execute function public._sale_set_product();

-- tabela de preços padrão (promoção = 50% para os 10 primeiros)
create or replace function public._default_products(op uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.products (operation_id, name, price, promo_price, sort)
  select op, v.name, v.price, round(v.price / 2, 2), v.sort
  from (values
    ('Artificial · 3 fotos', 14.90, 1),
    ('Artificial · 5 fotos', 19.90, 2),
    ('Artificial · 10 fotos', 29.90, 3),
    ('Premium · 3 fotos', 29.90, 4),
    ('Premium · 5 fotos', 49.90, 5),
    ('Premium · 10 fotos', 69.90, 6)
  ) as v(name, price, sort)
  where not exists (select 1 from public.products p where p.operation_id = op)
$$;

create or replace function public._operation_default_products()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._default_products(new.id);
  return new;
end $$;
drop trigger if exists operation_default_products on public.operations;
create trigger operation_default_products after insert on public.operations
  for each row execute function public._operation_default_products();

revoke execute on function public._sale_set_product() from public, anon, authenticated;
revoke execute on function public._operation_default_products() from public, anon, authenticated;
revoke execute on function public._default_products(uuid) from public, anon, authenticated;

select public._default_products(id) from public.operations;
update public.sales set product_id = public.match_product(operation_id, amount) where product_id is null;

alter publication supabase_realtime add table public.products;
