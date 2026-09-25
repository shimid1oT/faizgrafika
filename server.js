// Entry point untuk menjalankan aplikasi di LOCALHOST (npm start).
// Di Vercel, entry point yang dipakai adalah api/index.js — keduanya berbagi logic yang sama dari lib/app.js.
const app = require('./lib/app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ FaizGrafika Store berjalan di http://localhost:${PORT}`);
    console.log(`   Panel Admin: http://localhost:${PORT}/admin.html`);
});
