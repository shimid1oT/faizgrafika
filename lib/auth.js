const jwt = require('jsonwebtoken');

// PENTING: isi ADMIN_JWT_SECRET di .env / Environment Variables Vercel dengan
// string acak yang panjang & rahasia (misal hasil `openssl rand -hex 32`).
// Kalau tidak diisi, dipakai nilai default HANYA untuk memudahkan tes di localhost —
// JANGAN pernah deploy ke produksi tanpa mengganti ini.
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-only-secret-ganti-sebelum-deploy';
const TOKEN_TTL = '12h';

function createAdminToken(username) {
    return jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyAdminToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return payload && payload.role === 'admin' ? payload : null;
    } catch (err) {
        return null;
    }
}

// Middleware: taruh di endpoint yang hanya boleh diakses admin yang sudah login.
// Frontend wajib kirim header: Authorization: Bearer <token>
function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token ? verifyAdminToken(token) : null;

    if (!payload) {
        return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah habis. Silakan login ulang.' });
    }
    req.admin = payload;
    next();
}

module.exports = { createAdminToken, verifyAdminToken, requireAdmin, JWT_SECRET };
