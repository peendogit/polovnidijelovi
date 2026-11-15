// Otvaranje SQLite baze: Node 22.13+ ima ugrađeni node:sqlite, a na starijem Node-u (npr. 20) koristi se paket better-sqlite3.
// Oba imaju isti način rada: db.prepare(sql).get/all/run(...), db.exec(sql), db.close().
export async function openDb(file) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    return new DatabaseSync(file);
  } catch (e) {
    let Better;
    try { Better = (await import('better-sqlite3')).default; }
    catch (err) {
      console.error(`\nOvaj Node.js (${process.versions.node}) nema ugrađeni SQLite, a paket better-sqlite3 se ne može učitati.\nRazlog: ${err.message}\nPopravka:  cd /var/www/polovnidijelovi && npm install better-sqlite3\n(ako javi grešku sa "gyp"/"make":  apt-get install -y build-essential python3  pa ponovi)\n`);
      process.exit(1);
    }
    return new Better(file);
  }
}
