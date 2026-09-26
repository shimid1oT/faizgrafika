const express = require('express');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const { createAdminToken, requireAdmin } = require('./auth');

const app = express();
app.use(cors());
// Kompres semua respons (JSON API & file statis saat jalan via server.js) agar lebih ringan & cepat dikirim ke browser.
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// Sajikan file statis (index.html, admin.html, dll) — dipakai saat jalan di localhost.
// Di Vercel, folder /public sudah otomatis disajikan sebagai static asset, baris ini tidak mengganggu.
// maxAge menambahkan cache di browser untuk asset statis (CSS/JS/HTML) selama sesi berjalan.
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m', etag: true }));

// Endpoint publik yang datanya jarang berubah (produk, banner, metode pembayaran) boleh di-cache
// sebentar di browser/CDN Vercel supaya kunjungan berikutnya tidak selalu menunggu round-trip ke Supabase.
function publicCache(req, res, next) {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    next();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('[FaizGrafika] SUPABASE_URL / SUPABASE_ANON_KEY belum diisi di .env — cek README bagian "Jalankan di Localhost".');
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);

// Upload file pelanggan (Print Dokumen / Fotocopy) — disimpan di memori dulu, lalu dikirim ke Supabase Storage.
// Batas 8MB per file (perhatikan juga batas body Vercel Serverless Function ~4.5MB pada plan gratis).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const UPLOAD_BUCKET = 'customer-uploads';
const CATEGORIES_REQUIRE_UPLOAD = ['Cetak Dokumen', 'Fotocopy'];

function generateOrderCode() {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-${stamp}-${rand}`;
}

// ================= ADMIN AUTH =================

// Kredensial admin disimpan di Environment Variables (bukan tabel) demi kesederhanaan
// & keamanan (tidak ada endpoint publik yang bisa membaca/mengubah kredensial ini).
// ADMIN_PASSWORD_HASH dibuat dengan: node scripts/generate-admin-hash.js "password-anda"
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const validUsername = process.env.ADMIN_USERNAME;
        const validHash = process.env.ADMIN_PASSWORD_HASH;

        if (!validUsername || !validHash) {
            return res.status(500).json({ error: 'Admin belum dikonfigurasi. Set ADMIN_USERNAME & ADMIN_PASSWORD_HASH di environment variables.' });
        }
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password wajib diisi.' });
        }

        const usernameOk = username === validUsername;
        const passwordOk = usernameOk && await bcrypt.compare(password, validHash);

        if (!usernameOk || !passwordOk) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        const token = createAdminToken(username);
        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dipakai admin.html untuk cek token masih valid saat halaman dibuka
app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ success: true, username: req.admin.username });
});

// ================= PRODUCTS =================

// Ambil semua varian produk sekali jalan, lalu kelompokkan per product_id.
// Dipakai untuk menempelkan `variants: [...]` ke setiap produk tanpa query berulang (N+1).
async function attachVariants(products) {
    const list = Array.isArray(products) ? products : [products];
    if (list.length === 0) return products;

    const ids = list.map((p) => p.id);
    const { data: variants, error } = await supabase
        .from('product_variants')
        .select('*')
        .in('product_id', ids)
        .order('sort_order', { ascending: true });
    if (error) throw error;

    const byProduct = {};
    (variants || []).forEach((v) => {
        if (!byProduct[v.product_id]) byProduct[v.product_id] = [];
        byProduct[v.product_id].push(v);
    });

    list.forEach((p) => { p.variants = byProduct[p.id] || []; });
    return products;
}

app.get('/api/products', publicCache, async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        await attachVariants(data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Versi khusus panel admin: TANPA cache, supaya tambah/edit/hapus produk langsung
// terlihat perubahannya tanpa perlu refresh berkali-kali (beda dari /api/products publik di atas
// yang sengaja di-cache 30 detik demi kecepatan toko untuk pengunjung).
app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        await attachVariants(data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Detail 1 produk + daftar ulasannya (dipakai halaman product.html)
app.get('/api/products/:id', publicCache, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: product, error: prodErr } = await supabase.from('products').select('*').eq('id', id).single();
        if (prodErr || !product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

        const { data: reviews, error: revErr } = await supabase
            .from('reviews')
            .select('*')
            .eq('product_id', id)
            .order('created_at', { ascending: false });
        if (revErr) throw revErr;

        await attachVariants(product);

        res.json({ ...product, reviews: reviews || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= VARIASI PRODUK (mis. "Luxury Eco 01", "Luxury Eco 02", dst.) =================

// Simpan ulang SELURUH daftar varian sebuah produk sekali jalan (dipakai panel admin saat
// klik "Simpan Perubahan" di form edit produk). Varian lama dihapus, lalu diganti yang baru —
// pola ini konsisten dengan cara `image_urls` disimpan ulang di endpoint PUT /api/products/:id.
app.put('/api/admin/products/:id/variants', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const variants = Array.isArray(req.body.variants) ? req.body.variants : [];

        const { error: delErr } = await supabase.from('product_variants').delete().eq('product_id', id);
        if (delErr) throw delErr;

        const rows = variants
            .map((v, i) => ({
                product_id: id,
                name: String(v.name || '').trim(),
                price: v.price !== undefined && v.price !== null && v.price !== '' ? Number(v.price) : null,
                stock: v.stock ? String(v.stock) : null,
                image_url: v.image_url || null,
                sort_order: i,
            }))
            .filter((v) => v.name.length > 0);

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('product_variants').insert(rows);
            if (insErr) throw insErr;
        }

        const { data: saved, error: fetchErr } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .order('sort_order', { ascending: true });
        if (fetchErr) throw fetchErr;

        res.json({ success: true, data: saved || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', requireAdmin, async (req, res) => {
    try {
        const { name, category, price, stock, image_url, image_urls, description, discount_price, discount_active } = req.body;
        if (!name || !category || price === undefined || !stock) {
            return res.status(400).json({ error: 'Nama, kategori, harga, dan stok wajib diisi.' });
        }
        const urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : [];
        // image_url (sampul/thumbnail) dipakai di grid & kartu produk; kalau tidak diisi manual, pakai foto pertama dari image_urls.
        const cover = image_url || urls[0] || null;
        const payload = { name, category, price, stock, image_url: cover, image_urls: urls, description: description || '' };
        if (discount_price !== undefined && discount_price !== null && discount_price !== '') payload.discount_price = Number(discount_price);
        if (discount_active !== undefined) payload.discount_active = !!discount_active;
        const { data, error } = await supabase
            .from('products')
            .insert([payload])
            .select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update produk — dipakai juga untuk atur promo/diskon dari panel admin
app.put('/api/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['name', 'category', 'price', 'stock', 'image_url', 'image_urls', 'description', 'discount_price', 'discount_active'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diubah.' });
        }
        const { data, error } = await supabase.from('products').update(updates).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= REVIEWS & RATING (ala Shopee) =================

app.post('/api/products/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewer_name, rating, comment } = req.body || {};

        const ratingNum = Number(rating);
        if (!reviewer_name || !ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Nama, dan rating (1-5 bintang) wajib diisi.' });
        }

        const { error: insertErr } = await supabase
            .from('reviews')
            .insert([{ product_id: id, reviewer_name, rating: ratingNum, comment: comment || '' }]);
        if (insertErr) throw insertErr;

        // Hitung ulang rata-rata rating & jumlah ulasan produk
        const { data: allReviews, error: fetchErr } = await supabase
            .from('reviews')
            .select('rating')
            .eq('product_id', id);
        if (fetchErr) throw fetchErr;

        const count = allReviews.length;
        const avg = count > 0 ? allReviews.reduce((s, r) => s + r.rating, 0) / count : 0;

        await supabase
            .from('products')
            .update({ rating_avg: Number(avg.toFixed(2)), rating_count: count })
            .eq('id', id);

        res.json({ success: true, rating_avg: Number(avg.toFixed(2)), rating_count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= UPLOAD FILE PELANGGAN (Print Dokumen / Fotocopy) =================

// ================= PENGATURAN TOKO (alamat, maps, WA admin, logo) =================

// Publik: dipakai footer toko & fallback nomor WA admin
app.get('/api/settings', publicCache, async (req, res) => {
    try {
        const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        res.json(data || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const { store_address, maps_lat, maps_lng, admin_wa, logo_url } = req.body;
        const updates = { updated_at: new Date().toISOString() };
        if (store_address !== undefined) updates.store_address = store_address;
        if (maps_lat !== undefined && maps_lat !== '') updates.maps_lat = Number(maps_lat);
        if (maps_lng !== undefined && maps_lng !== '') updates.maps_lng = Number(maps_lng);
        if (admin_wa !== undefined) updates.admin_wa = String(admin_wa).replace(/[^0-9]/g, '');
        if (logo_url !== undefined) updates.logo_url = logo_url;

        const { data, error } = await supabase.from('site_settings').update(updates).eq('id', 1).select();
        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Baris pengaturan tidak ditemukan (jalankan migration_v5.sql).' });
        }
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });

        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
            .from(UPLOAD_BUCKET)
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(filePath);

        res.json({ success: true, file_url: publicUrlData.publicUrl, file_name: req.file.originalname });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengunggah file: ' + err.message });
    }
});

// ================= BANNERS (promo homepage, diatur admin) =================

// Publik: hanya banner aktif, untuk ditampilkan di beranda
app.get('/api/banners', publicCache, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: semua banner (termasuk nonaktif) untuk dikelola
app.get('/api/admin/banners', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('banners').select('*').order('sort_order', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/banners', requireAdmin, async (req, res) => {
    try {
        const { image_url, link_url, title, sort_order } = req.body;
        if (!image_url) return res.status(400).json({ error: 'URL gambar banner wajib diisi.' });
        const { data, error } = await supabase
            .from('banners')
            .insert([{ image_url, link_url: link_url || '', title: title || '', sort_order: sort_order || 0 }])
            .select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/banners/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['image_url', 'link_url', 'title', 'sort_order', 'is_active'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const { data, error } = await supabase.from('banners').update(updates).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= PAYMENT METHODS (dikelola admin, tampil di checkout + broadcast WA) =================

app.get('/api/payment-methods', publicCache, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/payment-methods', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('payment_methods').select('*').order('sort_order', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/payment-methods', requireAdmin, async (req, res) => {
    try {
        const { label, detail, sort_order } = req.body;
        if (!label) return res.status(400).json({ error: 'Nama metode pembayaran wajib diisi.' });
        const { data, error } = await supabase
            .from('payment_methods')
            .insert([{ label, detail: detail || '', sort_order: sort_order || 0 }])
            .select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/payment-methods/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['label', 'detail', 'sort_order', 'is_active'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const { data, error } = await supabase.from('payment_methods').update(updates).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/payment-methods/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('payment_methods').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= ORDERS (KERANJANG / CHECKOUT) =================

// Buat pesanan baru dari isi keranjang
app.post('/api/orders', async (req, res) => {
    try {
        const { buyer_name, buyer_wa, payment_method, items, biodata } = req.body;

        if (!buyer_name || !buyer_wa || !payment_method) {
            return res.status(400).json({ error: 'Nama, WhatsApp, dan metode pembayaran wajib diisi.' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Keranjang masih kosong.' });
        }

        // Validasi: item dari kategori Cetak Dokumen / Fotocopy wajib menyertakan file_url
        const missingUpload = items.find(
            (i) => CATEGORIES_REQUIRE_UPLOAD.includes(i.category) && !i.file_url
        );
        if (missingUpload) {
            return res.status(400).json({ error: `Mohon unggah file untuk item "${missingUpload.name}" sebelum checkout.` });
        }

        const cleanItems = items.map((i) => {
            const price = Number(i.price) || 0;
            const qty = Math.max(1, Number(i.qty) || 1);
            const item = { name: String(i.name), price, qty, subtotal: price * qty };
            if (i.category) item.category = String(i.category);
            if (i.variant) item.variant = String(i.variant); // nama varian yang dipilih pembeli (kalau produk punya varian)
            // Harga asli sebelum diskon (kalau ada) — dipakai untuk laporan penjualan
            if (i.original_price !== undefined && i.original_price !== null && Number(i.original_price) > price) {
                item.original_price = Number(i.original_price);
            }
            if (i.file_url) { item.file_url = String(i.file_url); item.file_name = String(i.file_name || 'file'); }
            if (i.note) item.note = String(i.note).slice(0, 1000); // catatan konsumen (mis. detail desain banner/logo)
            return item;
        });
        const total_amount = cleanItems.reduce((sum, i) => sum + i.subtotal, 0);
        const order_code = generateOrderCode();

        const { data, error } = await supabase
            .from('orders')
            .insert([{ order_code, buyer_name, buyer_wa, payment_method, items: cleanItems, total_amount, biodata: biodata || {} }])
            .select()
            .single();
        if (error) throw error;

        res.json({ success: true, order: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Daftar pesanan (dipakai panel admin) — dilindungi login admin
app.get('/api/orders', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jumlah pesanan yang belum pernah dibuka admin (dipakai badge notifikasi "Pesanan Masuk" — dipoll berkala oleh panel admin)
app.get('/api/admin/orders/unseen-count', requireAdmin, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const { count, error } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('is_new', true);
        if (error) throw error;
        res.json({ count: count || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tandai semua pesanan yang sedang "baru" sebagai sudah dilihat — dipanggil otomatis saat admin membuka tab "Pesanan Masuk"
app.post('/api/admin/orders/mark-seen', requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase.from('orders').update({ is_new: false }).eq('is_new', true);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lacak status pesanan pakai nomor invoice (untuk pengunjung, bukan admin) — dipanggil dari header toko.
// Hanya mengembalikan field yang aman ditampilkan ke pembeli (tidak termasuk seluruh detail item/biodata).
app.get('/api/orders/track/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_code, buyer_name, buyer_wa, payment_status, order_status, total_amount, created_at')
            .eq('order_code', code)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Nomor pesanan tidak ditemukan. Periksa kembali nomor invoice Anda.' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update status pesanan — dipisah jadi 2 kolom independen:
// payment_status (Menunggu Pembayaran / Lunas / COD) dan order_status (Diproses / Selesai / Dibatalkan).
// Kirim salah satu atau keduanya sekaligus di body.
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status, order_status } = req.body;
        const updates = {};
        if (payment_status) updates.payment_status = payment_status;
        if (order_status) updates.order_status = order_status;
        // Kalau pembayaran ditandai batal/ditolak, status pesanan otomatis ikut "Dibatalkan"
        // (dijaga juga di sisi server, bukan cuma di UI admin, supaya konsisten lewat jalur mana pun).
        if (payment_status === 'Dibatalkan/Ditolak') {
            updates.order_status = 'Dibatalkan';
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Status wajib diisi.' });
        }
        const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Pesanan tidak ditemukan atau gagal diperbarui (cek kebijakan RLS tabel orders di Supabase).' });
        }
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ekstrak path file di dalam bucket dari public URL Supabase Storage (dipakai untuk hapus file)
function extractStoragePaths(items) {
    const marker = `/${UPLOAD_BUCKET}/`;
    return (Array.isArray(items) ? items : [])
        .filter(i => i.file_url)
        .map(i => {
            const idx = i.file_url.indexOf(marker);
            return idx !== -1 ? i.file_url.slice(idx + marker.length) : null;
        })
        .filter(Boolean);
}

// Hapus pesanan permanen — HANYA untuk pesanan berstatus "Dibatalkan" (dijaga di server, bukan cuma di UI admin).
// Juga best-effort menghapus file terkait di storage supaya tidak menumpuk.
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: order, error: fetchErr } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
        if (order.order_status !== 'Dibatalkan') {
            return res.status(400).json({ error: 'Hanya pesanan berstatus "Dibatalkan" yang bisa dihapus.' });
        }

        const paths = extractStoragePaths(order.items);
        if (paths.length > 0) {
            await supabase.storage.from(UPLOAD_BUCKET).remove(paths).catch(() => {}); // best-effort
        }

        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Hapus file yang diunggah pelanggan pada sebuah pesanan (supaya tidak menumpuk di Supabase Storage).
// HANYA diizinkan untuk pesanan berstatus "Selesai" atau "Dibatalkan".
app.delete('/api/orders/:id/files', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: order, error: fetchErr } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
        if (!['Selesai', 'Dibatalkan'].includes(order.order_status)) {
            return res.status(400).json({ error: 'File hanya bisa dihapus untuk pesanan berstatus "Selesai" atau "Dibatalkan".' });
        }

        const items = Array.isArray(order.items) ? order.items : [];
        const paths = extractStoragePaths(items);
        if (paths.length === 0) return res.json({ success: true, deleted: 0 });

        const { error: removeErr } = await supabase.storage.from(UPLOAD_BUCKET).remove(paths);
        if (removeErr) throw removeErr;

        // Bersihkan juga referensi file_url/file_name di data pesanan biar tidak nyantol link mati
        const cleanedItems = items.map(({ file_url, file_name, ...rest }) => rest);
        await supabase.from('orders').update({ items: cleanedItems }).eq('id', id);

        res.json({ success: true, deleted: paths.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Detail satu pesanan (dipakai halaman nota untuk dicetak — TETAP PUBLIK agar pembeli bisa buka tanpa login)
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
        res.json(data);
    } catch (err) {
        res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }
});

module.exports = app;
