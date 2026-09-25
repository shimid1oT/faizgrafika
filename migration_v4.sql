-- =====================================================================
-- MIGRASI v4 — FaizGrafika Store
-- PENTING: Ini memperbaiki bug "status pesanan tidak tersimpan".
-- Penyebabnya: tabel `orders` punya RLS aktif tapi belum ada policy UPDATE,
-- jadi Supabase diam-diam menolak setiap perubahan status dari panel admin
-- (tidak error, tapi juga tidak benar-benar menyimpan perubahannya).
-- Jalankan file ini di SQL Editor Supabase. Aman dijalankan berkali-kali.
-- =====================================================================

drop policy if exists "Enable update for orders" on orders;
create policy "Enable update for orders" on orders for update using (true) with check (true);

-- =====================================================================
-- SELESAI. Setelah ini, coba ubah status pesanan lagi dari panel admin —
-- sekarang seharusnya benar-benar tersimpan ke database.
-- =====================================================================
