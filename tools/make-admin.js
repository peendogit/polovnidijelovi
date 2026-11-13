// Upotreba:  npm run admin -- email@primjer.ba
import '../server/env.js';
const { get, run } = await import('../server/db.js');
const email = process.argv[2];
if (!email) { console.log('Upotreba: npm run admin -- email@primjer.ba'); process.exit(1); }
const u = get('SELECT id, name FROM users WHERE email=?', email);
if (!u) { console.log('Nema korisnika sa tim emailom. Prvo se registruj na sajtu.'); process.exit(1); }
run('UPDATE users SET is_admin=1 WHERE id=?', u.id);
console.log(`${u.name} je sada administrator.`);
process.exit(0);
