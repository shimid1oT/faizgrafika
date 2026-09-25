-- =====================================================================
-- MIGRASI v5 — FaizGrafika Store
-- Jalankan di SQL Editor Supabase. Aman dijalankan berkali-kali.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Izinkan admin menghapus pesanan (RLS) — dibutuhkan fitur "Hapus
--    Pesanan" untuk pesanan berstatus Dibatalkan di panel admin.
-- ---------------------------------------------------------------------
drop policy if exists "Enable delete for orders" on orders;
create policy "Enable delete for orders" on orders for delete using (true);

-- ---------------------------------------------------------------------
-- 2) Izinkan admin menghapus file di Storage bucket "customer-uploads"
--    (dibutuhkan fitur "Hapus File" & saat pesanan Dibatalkan dihapus).
--    Tanpa policy ini, upload/lihat file tetap jalan seperti biasa,
--    tapi proses HAPUS file akan gagal diam-diam.
-- ---------------------------------------------------------------------
drop policy if exists "Enable delete for customer-uploads" on storage.objects;
create policy "Enable delete for customer-uploads" on storage.objects
    for delete using (bucket_id = 'customer-uploads');

-- ---------------------------------------------------------------------
-- 3) Tabel pengaturan toko: alamat, koordinat peta, nomor WA admin, logo.
--    Hanya 1 baris (id selalu = 1) yang dipakai & diedit dari panel admin.
-- ---------------------------------------------------------------------
create table if not exists site_settings (
    id int primary key default 1,
    store_address text not null default 'Jl. Jakub Ponto, RT. 20 RW. 06, Desa Sangkanhurip, Kec. Cigandamekar, Kabupaten Kuningan, Jawa Barat 45556',
    maps_lat numeric not null default -6.890111,
    maps_lng numeric not null default 108.505784,
    admin_wa text not null default '6289676707976',
    logo_url text,
    updated_at timestamptz not null default now(),
    constraint site_settings_single_row check (id = 1)
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
drop policy if exists "Enable read access for site_settings" on site_settings;
drop policy if exists "Enable update for site_settings" on site_settings;
create policy "Enable read access for site_settings" on site_settings for select using (true);
create policy "Enable update for site_settings" on site_settings for update using (true) with check (true);

-- =====================================================================
-- SELESAI.
-- =====================================================================
