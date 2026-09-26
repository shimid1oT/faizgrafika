-- =====================================================================
-- MIGRASI v7 — FaizGrafika Store
-- Fitur: Badge notifikasi "Pesanan Baru" di panel admin.
-- Jalankan di SQL Editor Supabase SETELAH migration_v6.sql. Aman dijalankan berkali-kali.
-- =====================================================================

-- Menandai pesanan yang belum pernah dibuka/dilihat admin di panel Pesanan Masuk.
-- Default TRUE (pesanan baru dianggap belum dilihat), lalu diubah jadi FALSE otomatis
-- oleh aplikasi saat admin membuka tab "Pesanan Masuk".
alter table orders add column if not exists is_new boolean not null default true;

-- Pesanan yang sudah ada sebelum migrasi ini dianggap sudah "dilihat" (supaya badge
-- tidak langsung penuh dengan pesanan lama saat pertama kali migrasi dijalankan).
update orders set is_new = false where is_new is null or is_new = true;

-- =====================================================================
-- SELESAI.
-- =====================================================================
