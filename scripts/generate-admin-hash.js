// Cara pakai:
//   node scripts/generate-admin-hash.js "password_admin_anda"
// Hasilnya (ADMIN_PASSWORD_HASH) tinggal disalin ke file .env / Environment Variables Vercel.

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.log('Cara pakai: node scripts/generate-admin-hash.js "password_anda"');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nSalin baris berikut ke file .env (localhost) / Environment Variables (Vercel):\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
