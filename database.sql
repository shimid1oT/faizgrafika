-- Jalankan SQL ini di SQL Editor Supabase Anda (Project Baru ATAU project lokal via Supabase CLI)

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  price numeric not null,
  stock text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Catatan: "items" menyimpan daftar barang di keranjang saat checkout, contoh isinya:
-- [{"name":"Cetak Undangan Hardcover","price":150000,"qty":2,"subtotal":300000}]
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  order_code text unique not null,
  buyer_name text not null,
  buyer_wa text not null,
  payment_method text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text default 'Menunggu Pembayaran',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kebijakan Akses Publik (RLS aktif, tapi dibuka untuk kemudahan toko awal.
-- Untuk produksi jangka panjang, sebaiknya insert/update/delete produk dipindah ke
-- endpoint yang diverifikasi admin, bukan langsung dari browser publik.)
alter table products enable row level security;
alter table orders enable row level security;

drop policy if exists "Enable read access for all users" on products;
drop policy if exists "Enable insert/update/delete for all users" on products;
create policy "Enable read access for all users" on products for select using (true);
create policy "Enable insert/update/delete for all users" on products for all using (true);

drop policy if exists "Enable read access for orders" on orders;
drop policy if exists "Enable insert for orders" on orders;
drop policy if exists "Enable update for orders" on orders;
create policy "Enable read access for orders" on orders for select using (true);
create policy "Enable insert for orders" on orders for insert with check (true);
create policy "Enable update for orders" on orders for update using (true) with check (true);
