# FaizGrafika - Web E-Commerce Cetak & Desain (Shopee Mobile-Friendly)

Paket lengkap fullstack website percetakan dan desain grafis, siap di-deploy ke **Vercel** dan terhubung ke database **Supabase (PostgreSQL)**.

## 🚀 Fitur Utama
1. **Frontend Mobile-Friendly (Ala Shopee)**: Desain modern, kategori instan, pencarian produk cepat.
2. **Keranjang Belanja (Cart)**: Tambah beberapa produk sekaligus, atur jumlah, lalu checkout satu kali.
3. **Checkout & Pembayaran via WhatsApp Admin**: Setelah checkout, pesanan tersimpan ke database dan pembeli otomatis diarahkan chat WhatsApp Admin untuk konfirmasi pembayaran (sementara manual).
4. **Halaman Nota (`nota.html`)**: Struk pembayaran otomatis per pesanan, bisa dicetak (tombol "Cetak Nota") atau disimpan sebagai bukti.
5. **Panel Admin**: CRUD produk + daftar **Pesanan Masuk** lengkap dengan link ke nota tiap pesanan.
6. **Backend Express.js**: satu logic (`lib/app.js`) dipakai baik untuk localhost maupun Vercel Serverless Function.

---

## 🗂️ Struktur Proyek
```
├── lib/
│   ├── app.js          -> Semua logic Express + koneksi Supabase (satu-satunya sumber kebenaran)
│   └── auth.js         -> Helper JWT untuk proteksi endpoint admin
├── scripts/
│   └── generate-admin-hash.js -> Utilitas membuat ADMIN_PASSWORD_HASH
├── server.js           -> Entry point untuk `npm start` di LOCALHOST
├── api/index.js         -> Entry point untuk Vercel (serverless function, /api/*)
├── public/
│   ├── index.html       -> Toko (produk, keranjang, checkout, banner promo, upload file, biodata Undangan)
│   ├── product.html      -> Detail produk + deskripsi + ulasan & rating bintang
│   ├── admin-login.html  -> Login admin
│   ├── admin.html        -> Panel admin (produk & promo, pesanan, banner, metode pembayaran)
│   └── nota.html         -> Struk pembayaran (dicetak per pesanan, termasuk file & biodata)
├── database.sql         -> Skema awal tabel `products` & `orders` (v1)
├── migration_v2.sql      -> Migrasi tambahan v2 (reviews, banners, payment_methods, dst.)
├── migration_v3.sql      -> Migrasi v3 (multi-foto produk, status pembayaran & status pesanan terpisah)
├── migration_v4.sql      -> Migrasi v4 (fix RLS update orders — WAJIB, tanpa ini status pesanan tidak tersimpan)
├── migration_v5.sql      -> Migrasi v5 (RLS delete orders & storage, tabel pengaturan toko: alamat/maps/WA admin/logo)
├── vercel.json           -> Konfigurasi routing untuk deploy Vercel
├── .env.example          -> Contoh semua environment variable yang dibutuhkan
└── .env                  -> Kredensial asli Anda (JANGAN di-commit ke git publik)
```

---

## 🛠️ 1. Setup Database di Supabase

Pilih salah satu:

### Opsi A — Supabase Cloud (paling mudah, direkomendasikan)
1. Buat akun gratis di [Supabase](https://supabase.com) dan buat Project baru.
2. Buka menu **SQL Editor**, salin isi file `database.sql`, klik **Run**.
3. Ambil kredensial di **Project Settings > API**: `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (anon/public key).
4. Struktur ini sama persis dipakai untuk testing di localhost maupun setelah deploy — tidak ada kode yang perlu diubah.

### Opsi B — Supabase Lokal via Supabase CLI (tanpa perlu project cloud, butuh Docker)
1. Install Docker Desktop (harus berjalan di background).
2. Install Supabase CLI: `npm install -g supabase` (atau lihat cara lain di [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)).
3. Di folder project, jalankan:
   ```bash
   npx supabase init
   npx supabase start
   ```
4. Terminal akan menampilkan `API URL` dan `anon key` lokal (biasanya `http://127.0.0.1:54321`). Salin ke `.env` Anda.
5. Jalankan isi `database.sql` lewat Studio lokal yang otomatis terbuka (`http://127.0.0.1:54323`) di menu SQL Editor.
6. Saat siap deploy ke produksi, cukup buat project Supabase Cloud (Opsi A) lalu jalankan ulang `database.sql` di sana, dan ganti isi `.env`/Environment Variables di Vercel dengan kredensial cloud.

---

## 💻 2. Jalankan di Localhost

1. Install dependencies:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env`, lalu isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (dari Opsi A atau B di atas).
3. Jalankan server:
   ```bash
   npm start
   ```
4. Buka:
   - Toko: `http://localhost:3000`
   - Panel Admin: `http://localhost:3000/admin.html` (tombol Admin di beranda sudah disembunyikan — buka langsung lewat URL ini, atau ketuk logo FAIZGRAFIKA di beranda 5x berturut-turut untuk diarahkan otomatis)
   - Nota contoh: otomatis muncul setelah checkout, atau lewat tombol "Lihat" di tabel Pesanan Masuk pada Admin.

> Sebelum ada produk, tambahkan dulu beberapa produk lewat halaman Admin agar toko tidak kosong.

**Jangan lupa** ganti nomor `ADMIN_WA_NUMBER` di dalam `public/index.html` (dekat bagian atas tag `<script>`) dengan nomor WhatsApp Admin toko Anda, format `62xxxxxxxxxxx` tanpa tanda `+`.

---

## ☁️ 3. Push ke GitHub & Deploy ke Vercel

1. Buat Repository baru di GitHub (misal: `faiz-grafika-store`), lalu push:
   ```bash
   git init
   git add .
   git commit -m "Initial commit FaizGrafika"
   git branch -M main
   git remote add origin https://github.com/USERNAME/faiz-grafika-store.git
   git push -u origin main
   ```
2. Login ke [Vercel](https://vercel.com) → **Add New > Project** → import repository tersebut.
3. Di bagian **Environment Variables**, tambahkan (gunakan kredensial Supabase Cloud, BUKAN yang lokal):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Klik **Deploy**. Vercel otomatis mendeteksi `api/index.js` sebagai serverless function dan menyajikan folder `public/` sebagai halaman statis (`vercel.json` sudah mengatur routing `/`, `/admin.html`, `/nota.html`, dan `/api/*`).
5. Setelah online, tes alur penuh: buka toko → tambah produk ke keranjang → checkout → pastikan redirect ke WhatsApp Admin & halaman nota tampil dengan benar → cek juga tabel **Pesanan Masuk** di `/admin.html`.

---

---

## 🆕 Setup v2 — Fitur Baru

Versi ini menambahkan: font brand Cinzel, login admin, deskripsi produk + ulasan & rating bintang, upload file pelanggan (Print Dokumen & Fotocopy), promo/diskon, banner promo beranda yang dikelola admin, serta broadcast biodata & opsi pembayaran untuk pesanan Undangan.

### 1) Jalankan migrasi database
Buka **SQL Editor** di Supabase, salin isi `migration_v2.sql`, klik **Run**. File ini aman dijalankan meski `database.sql` (v1) sudah pernah dijalankan sebelumnya — semua perintah bersifat idempotent (aman diulang) dan akan otomatis membuat:
- Kolom baru di tabel `products` (`description`, `discount_price`, `discount_active`, `rating_avg`, `rating_count`)
- Tabel `reviews` (ulasan & rating)
- Tabel `banners` (banner promo beranda)
- Tabel `payment_methods` (opsi metode pembayaran, terisi 4 contoh awal)
- Kolom `biodata` (jsonb) di tabel `orders`
- Storage bucket `customer-uploads` (untuk file yang diunggah pelanggan) beserta policy publiknya

### 2) Install dependency baru
```bash
npm install
```
Ini akan memasang `bcryptjs`, `jsonwebtoken`, dan `multer` yang baru ditambahkan ke `package.json`.

### 3) Buat kredensial admin
Panel admin (`/admin.html`) sekarang **wajib login**. Kredensial disimpan sebagai Environment Variable, bukan di database:
```bash
node scripts/generate-admin-hash.js "password_pilihan_anda"
```
Salin hasil `ADMIN_PASSWORD_HASH` yang muncul ke `.env` (localhost) atau ke **Environment Variables** di Vercel. Isi juga:
- `ADMIN_USERNAME` — bebas, contoh `admin`
- `ADMIN_JWT_SECRET` — string acak panjang & rahasia (contoh: `openssl rand -hex 32`)

Setelah itu, login lewat `/admin-login.html` menggunakan username & password tersebut.

### 4) Fitur per halaman
| Fitur | Lokasi |
|---|---|
| Font brand "Cinzel" | Otomatis aktif di semua halaman (Google Fonts) |
| Deskripsi produk + ulasan + rating bintang | Klik produk di beranda → `product.html` |
| Upload file (Print Dokumen / Fotocopy) | Muncul otomatis di modal Checkout saat keranjang berisi produk kategori tsb. |
| Promo/diskon produk | Panel Admin → tab **Produk & Promo** → isi "Harga Promo" & centang "Promo Aktif" |
| Banner promo beranda | Panel Admin → tab **Banner Promo** (mendukung beberapa banner bergantian otomatis) |
| Biodata & broadcast Undangan | Muncul otomatis di Checkout saat keranjang berisi produk kategori "Undangan"; ikut terkirim ke pesan WhatsApp Admin beserta semua opsi metode pembayaran aktif |
| Kelola metode pembayaran | Panel Admin → tab **Metode Pembayaran** |
| Update status pesanan | Panel Admin → tab **Pesanan Masuk** → dropdown status per baris |

### ⚠️ Catatan penting
- Endpoint tambah/ubah/hapus produk, banner, metode pembayaran, dan lihat semua pesanan sekarang **dilindungi login admin** (JWT). Endpoint publik (lihat produk, checkout, lihat nota per-ID, kirim ulasan) tetap terbuka seperti sebelumnya.
- Batas ukuran file upload: 8MB per file. Perhatikan juga batas body Vercel Serverless Function (~4.5MB pada plan gratis) — untuk file dokumen scan biasa umumnya masih aman, tapi untuk file besar sarankan pelanggan kompres dulu.
- `ADMIN_JWT_SECRET` **wajib diganti** sebelum deploy ke produksi — kode punya nilai default hanya untuk kemudahan tes di localhost dan TIDAK aman dipakai online.

---

## ✅ Checklist Kesiapan Deploy
- [x] Routing statis (`public/`) & API (`api/`) terpisah, sesuai konvensi Vercel Serverless.
- [x] Fitur keranjang (tambah, ubah qty, hapus item) sebelum checkout.
- [x] Checkout membuat 1 pesanan (bisa berisi banyak item) tersimpan ke Supabase.
- [x] Halaman nota per pesanan (`nota.html?id=...`) siap dicetak.
- [x] Panel admin bisa melihat daftar pesanan masuk + buka nota masing-masing.
- [x] Bisa dites 100% di localhost dengan struktur Supabase yang sama (cloud gratis atau CLI lokal).
- [x] Panel admin dilindungi login (JWT) — lihat bagian "Setup v2" di atas untuk membuat kredensialnya.
- [x] Deskripsi produk, ulasan & rating bintang, promo/diskon, banner beranda dinamis, upload file pelanggan, dan broadcast biodata Undangan sudah terintegrasi.
- [ ] **Wajib dilakukan sebelum go-live**: ganti nomor `ADMIN_WA_NUMBER` di `public/index.html`, isi produk asli lewat Admin, jalankan `migration_v2.sql` di Supabase, dan buat kredensial admin (lihat "Setup v2").
