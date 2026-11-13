# polovnidijelovi.com

Polovni auto dijelovi i vozila za dijelove sa otpada iz cijele BiH.

- **Dijelovi**: pretraga po marki → modelu → generaciji (posebno facelift), nazivu dijela, kataloškom broju i gradu
- **Vozila za dijelove**: otpadi objavljuju vozila koja rastavljaju. Izabereš npr. Golf 6 i vidiš sve Golfove 6 na otpadima. Na svakom vozilu su dugmad „Pozovi“ i „Pitaj za dio“, a ispod liste je „Pitaj sve otpade“ (jedan upit ide svim otpadima koji imaju taj model)
- **Tražim dio**: kupac objavi šta traži, otpadi vide zahtjev (broj na ikoni) i šalju ponudu sa cijenom, a kupac poredi ponude i zove
- **Nalozi**: privatno lice ili auto otpad, profil otpada sa logom, oznaka „Provjeren otpad“ (dodjeljuje admin), „Šalje brzom poštom“
- **Kontakt**: Pozovi, Viber, WhatsApp, upit kroz sajt (stiže u Profil → Upiti)
- **Slike**: telefon sam smanji sliku prije slanja, pa je upload brz i na mobilnim podacima
- **Baza vozila**: 89 marki i 7.327 modela/generacija sa faceliftovima (iz baze otpada Delić). Korisnik može predložiti model koji fali („Nema mog modela?“), a admin ga dodaje u Administracija → Modeli
- **Google**: svaki oglas, vozilo i otpad ima svoj naslov i opis; `/sitemap.xml`; stranice modela tipa `/polovni-dijelovi/volkswagen/golf-7`
- **API za otpade**: program otpada može sam slati dijelove i vozila (vidi dolje)
- **Administracija** (`/admin`): brojke, korisnici (provjeren / blokiran / nova lozinka), novi modeli, prijave oglasa

Na Node.js 22.13 ili novijem ne treba nikakav paket (koristi ugrađeni SQLite). Na Node.js 20 pokreni jednom `npm install`.

## Instalacija na VPS (Termius)

```bash
# 1) Kod
cd /var/www && git clone https://github.com/peendogit/polovnidijelovi.git && cd polovnidijelovi
node -v            # ako je v20.x:  npm install

# 2) Podešavanja (port 3030, nasumičan tajni ključ)
cp .env.example .env
sed -i "s/promijeni-me/$(openssl rand -hex 24)/" .env

# 3) Pokretanje (prvo pokretanje samo napravi bazu i ubaci marke/modele)
pm2 start ecosystem.config.cjs && pm2 save

# 4) Domen: u Namecheap DNS dodaj A zapise  @ -> 158.220.96.229  i  www -> 158.220.96.229
#    sačekaj par minuta, pa:
bash tools/https-setup.sh polovnidijelovi.com

# 5) Automatsko ažuriranje sa GitHuba + dnevna kopija baze
(crontab -l 2>/dev/null; echo "* * * * * /var/www/polovnidijelovi/deploy.sh >> /var/log/polovnidijelovi-deploy.log 2>&1"; echo "15 3 * * * /var/www/polovnidijelovi/tools/backup.sh") | crontab -
```

**Prvi korisnik koji se registruje automatski postaje administrator.** Zato se registruj odmah nakon pokretanja. Drugog admina dodaješ sa:

```bash
npm run admin -- email@primjer.ba
```

Ako je port 3030 već zauzet, promijeni `PORT=` u `.env`, pa pokreni `pm2 restart polovnidijelovi` i ponovo `bash tools/https-setup.sh polovnidijelovi.com`.

Baza je u `data/polovnidijelovi.db`, slike su u `data/uploads/`, a kopije baze u `data/backup/` (čuvaju se 14 dana).

## API za otpade (automatsko slanje dijelova)

Otpad u **Profil → Postavke** napravi API ključ. Program otpada šalje JSON sa zaglavljem `X-Api-Key: pd_...`

```
POST /api/feed/vehicles
{ "items": [ { "ext_id": "440", "model_id": "791d9642-...", "year": 2018, "fuel": "dizel",
               "engine": "2.0 TDI", "engine_code": "CRL", "power_kw": 110,
               "images": ["https://dijelovi.delicauto.com/slike/440-1.jpg"] } ] }

POST /api/feed/parts
{ "items": [ { "ext_id": "9N32", "title": "Far prednji lijevi", "model_id": "791d9642-...",
               "year": 2018, "price": 180, "part_no": "5G0941005", "condition": "polovno",
               "vehicle_ext_id": "440", "images": ["https://.../9N32.jpg"] } ] }

POST /api/feed/remove
{ "kind": "parts", "ext_ids": ["9N32"] }        // prodato (za vozila: "kind": "vehicles")
```

- `ext_id` je šifra u programu otpada. Isti `ext_id` ažurira postojeći oglas, a ne pravi novi.
- `model_id` je isti ID modela kao u programu otpada Delić (tabela `car_model`). Umjesto njega može `"make": "VW", "model": "Golf 7"` (+ `year`), pa sajt sam nađe generaciju.
- Do 500 stavki po pozivu.

## Struktura

```
server/index.js        HTTP server, statički fajlovi, SEO
server/schema.sql      tabele
server/routes/*.js     API: dijelovi, vozila, zahtjevi, upiti, prodavci, upload, admin, feed
public/                aplikacija (index.html, app.css, js/)
data/vozila.sql        marke i modeli (ubacuju se pri prvom pokretanju)
```
