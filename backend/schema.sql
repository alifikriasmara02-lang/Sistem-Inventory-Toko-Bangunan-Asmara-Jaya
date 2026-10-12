create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit text not null default 'pcs',
  price numeric(14,2) not null default 0 check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 5 check (minimum_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('in','out')),
  quantity integer not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_supplier_id_idx on public.products(supplier_id);
create index if not exists stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);

create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare delta integer;
begin
  delta := case when new.movement_type = 'in' then new.quantity else -new.quantity end;
  update public.products
  set stock_quantity = stock_quantity + delta, updated_at = now()
  where id = new.product_id and stock_quantity + delta >= 0;
  if not found then
    if not exists (select 1 from public.products where id = new.product_id) then
      raise exception 'Produk tidak ditemukan';
    end if;
    raise exception 'Stok tidak mencukupi untuk barang keluar';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_movement_updates_product on public.stock_movements;
create trigger stock_movement_updates_product after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

grant usage on schema public to authenticated;
grant select on public.categories, public.suppliers, public.products, public.stock_movements to authenticated;
grant insert on public.categories, public.suppliers, public.products, public.stock_movements to authenticated;

drop policy if exists categories_authenticated_select on public.categories;
create policy categories_authenticated_select on public.categories
for select to authenticated using (true);
drop policy if exists categories_authenticated_insert on public.categories;
create policy categories_authenticated_insert on public.categories
for insert to authenticated with check (length(trim(name)) > 0);

drop policy if exists suppliers_authenticated_select on public.suppliers;
create policy suppliers_authenticated_select on public.suppliers
for select to authenticated using (true);
drop policy if exists suppliers_authenticated_insert on public.suppliers;
create policy suppliers_authenticated_insert on public.suppliers
for insert to authenticated with check (length(trim(name)) > 0);

drop policy if exists products_authenticated_select on public.products;
create policy products_authenticated_select on public.products
for select to authenticated using (true);
drop policy if exists products_authenticated_insert on public.products;
create policy products_authenticated_insert on public.products
for insert to authenticated with check (true);

drop policy if exists movements_authenticated_select on public.stock_movements;
create policy movements_authenticated_select on public.stock_movements
for select to authenticated using (true);
drop policy if exists movements_authenticated_insert on public.stock_movements;
create policy movements_authenticated_insert on public.stock_movements
for insert to authenticated with check (true);

insert into public.categories (name,description) values
 ('Semen & Mortar','Semen, mortar, dan bahan perekat'),
 ('Besi & Baja','Besi beton, baja ringan, dan kawat'),
 ('Cat & Pelapis','Cat interior, eksterior, dan pelapis'),
 ('Pipa & Sanitasi','Pipa dan perlengkapan sanitasi'),
 ('Perkakas','Peralatan tangan dan perlengkapan kerja'),
 ('Kayu & Papan','Kayu, plywood, dan material papan')
on conflict (name) do nothing;

insert into public.suppliers (name,contact_name,phone,email) values
 ('PT Sumber Bahan Utama','Budi Santoso','0812-3456-7890','sales@sumberbahan.co.id'),
 ('CV Mitra Konstruksi','Rina Wijaya','0813-4567-8901','order@mitrakonstruksi.co.id'),
 ('UD Berkah Material','Agus Pratama','0815-6789-0123','berkah.material@example.com')
on conflict (name) do nothing;