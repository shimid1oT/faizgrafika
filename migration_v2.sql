-- =====================================================================
-- MIGRASI v2 — FaizGrafika Store
-- Jalankan file ini di SQL Editor Supabase (Project > SQL Editor > New Query)
-- SETELAH database.sql (v1) sudah pernah dijalankan sebelumnya.
-- Semua perintah aman dijalankan berkali-kali (idempotent).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) PRODUCTS: tambah deskripsi, promo/diskon, ringkasan rating
-- ---------------------------------------------------------------------
alter table products add column if not exists description text default '';
alter table products add column if not exists discount_price numeric;
alter table products add column if not exists discount_active boolean not null default false;
alter table products add column if not exists rating_avg numeric not null default 0;
alter table products add column if not exists rating_count integer not null default 0;

-- ---------------------------------------------------------------------
-- 2) REVIEWS: ulasan & rating bintang ala Shopee (per produk)
-- ---------------------------------------------------------------------
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists reviews_product_id_idx on reviews(product_id);

alter table reviews enable row level security;
drop policy if exists "Enable read access for all users" on reviews;
drop policy if exists "Enable insert for all users" on reviews;
create policy "Enable read access for all users" on reviews for select using (true);
create policy "Enable insert for all users" on reviews for insert with check (true);

-- ---------------------------------------------------------------------
-- 3) BANNERS: banner/gambar promo beranda, diatur dari panel admin
-- ---------------------------------------------------------------------
create table if not exists banners (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  link_url text default '',
  title text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table banners enable row level security;
drop policy if exists "Enable read access for all users" on banners;
drop policy if exists "Enable write for all users" on banners;
create policy "Enable read access for all users" on banners for select using (true);
-- Catatan: insert/update/delete banner sebenarnya sudah dijaga di level API (harus login admin / JWT valid).
-- Policy "all" di bawah ini tetap dibuka di level DB (konsisten dengan products/orders di database.sql v1)
-- karena aplikasi memakai supabase anon key yang sama untuk semua operasi.
create policy "Enable write for all users" on banners for all using (true);

-- ---------------------------------------------------------------------
-- 4) PAYMENT METHODS: opsi metode pembayaran yang dikelola admin,
--    ditampilkan di checkout & disertakan dalam broadcast WhatsApp
-- ---------------------------------------------------------------------
create table if not exists payment_methods (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  detail text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table payment_methods enable row level security;
drop policy if exists "Enable read access for all users" on payment_methods;
drop policy if exists "Enable write for all users" on payment_methods;
create policy "Enable read access for all users" on payment_methods for select using (true);
create policy "Enable write for all users" on payment_methods for all using (true);

-- Isi contoh metode pembayaran awal (boleh diedit/dihapus lewat panel admin nanti)
insert into payment_methods (label, detail, sort_order)
select * from (values
  ('Transfer BCA', 'a.n. Faiz Grafika — 1234567890', 1),
  ('Transfer Mandiri', 'a.n. Faiz Grafika — 0987654321', 2),
  ('QRIS', 'Scan QRIS di toko / diminta ke Admin', 3),
  ('Bayar di Toko (COD)', 'Ambil & bayar langsung di lokasi', 4)
) as v(label, detail, sort_order)
where not exists (select 1 from payment_methods);

-- ---------------------------------------------------------------------
-- 5) ORDERS: simpan biodata tambahan (khusus pesanan Undangan)
-- ---------------------------------------------------------------------
alter table orders add column if not exists biodata jsonb default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 6) STORAGE: bucket untuk upload file pelanggan (Print Dokumen & Fotocopy)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('customer-uploads', 'customer-uploads', true)
on conflict (id) do nothing;

drop policy if exists "Public read customer-uploads" on storage.objects;
drop policy if exists "Public insert customer-uploads" on storage.objects;
create policy "Public read customer-uploads" on storage.objects
  for select using (bucket_id = 'customer-uploads');
create policy "Public insert customer-uploads" on storage.objects
  for insert with check (bucket_id = 'customer-uploads');

-- =====================================================================
-- SELESAI. Setelah ini jalan, lanjutkan ke README bagian "Setup v2"
-- untuk mengisi ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_JWT_SECRET.
-- =====================================================================
