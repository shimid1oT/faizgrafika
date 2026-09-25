-- =====================================================================
-- MIGRASI v3 — FaizGrafika Store
-- Jalankan file ini di SQL Editor Supabase SETELAH migration_v2.sql.
-- Aman dijalankan berkali-kali (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PRODUCTS: dukungan banyak foto per produk (slider di halaman detail)
--    image_url lama tetap dipakai sebagai foto sampul/thumbnail di grid.
-- ---------------------------------------------------------------------
alter table products add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 2) ORDERS: pisahkan status jadi "Status Pembayaran" & "Status Pesanan"
--    Kolom "status" lama TIDAK dihapus (biar aman), tapi sudah tidak
--    dipakai lagi oleh aplikasi setelah migrasi ini.
-- ---------------------------------------------------------------------
alter table orders add column if not exists payment_status text not null default 'Menunggu Pembayaran';
alter table orders add column if not exists order_status text not null default 'Diproses';

-- Pindahkan data status lama ke kolom baru yang sesuai
update orders set payment_status = 'Lunas' where status = 'Lunas' and payment_status = 'Menunggu Pembayaran';
update orders set order_status = status where status in ('Diproses', 'Selesai', 'Dibatalkan');

-- =====================================================================
-- SELESAI.
-- =====================================================================
