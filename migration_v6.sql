-- =====================================================================
-- MIGRASI v6 — FaizGrafika Store
-- Fitur: VARIASI PRODUK (mis. "Luxury Eco 01", "Luxury Eco 02", dst.)
-- Jalankan di SQL Editor Supabase. Aman dijalankan berkali-kali.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) Tabel varian produk. Satu produk bisa punya banyak varian.
--    - price   : opsional. Kalau kosong (NULL), varian ikut harga/promo produk induk.
--    - stock   : opsional. Kalau kosong, varian ikut stok produk induk (hanya info tampilan).
--    - image_url : opsional. Kalau kosong, dipakai foto produk induk.
-- ---------------------------------------------------------------------
create table if not exists product_variants (
    id uuid default gen_random_uuid() primary key,
    product_id uuid not null references products(id) on delete cascade,
    name text not null,
    price numeric,
    stock text,
    image_url text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx on product_variants(product_id);

alter table product_variants enable row level security;
drop policy if exists "Enable read access for all users" on product_variants;
drop policy if exists "Enable write for all users" on product_variants;
create policy "Enable read access for all users" on product_variants for select using (true);
-- Catatan: sama seperti tabel products/banners, penulisan sebenarnya sudah dijaga di level API
-- (harus login admin), policy "all" ini konsisten dengan pola RLS terbuka yang sudah dipakai di app.
create policy "Enable write for all users" on product_variants for all using (true);

-- =====================================================================
-- SELESAI. Setelah ini, buka panel admin > Edit Produk untuk menambahkan
-- varian pada produk yang diinginkan (opsional, produk tanpa varian
-- tetap berjalan seperti biasa).
-- =====================================================================
