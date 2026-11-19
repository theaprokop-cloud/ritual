# Rituál – návod, jak rozjet samostatnou verzi

Tenhle projekt je Rituál převedený z Clauda do samostatné webové appky s vlastním přihlášením na pozvánku. Počítej zhruba s jedním odpolednem. Všechno níže zvládneš s Claude Code: otevři v něm složku projektu a pracuj krok po kroku, klidně mu vkládej jednotlivé body tohohle návodu.

> Názvy tlačítek v Supabase a Vercelu se občas mění. Když něco nesedí, napiš Claude Code, co vidíš na obrazovce, a poradí ti.

---

## Co budeš potřebovat

| Služba | K čemu | Cena na betu |
|---|---|---|
| **GitHub** | uložení kódu | zdarma |
| **Supabase** | přihlášení a databáze | bezplatný tarif |
| **Vercel** | hosting appky a serverové funkce | bezplatný tarif |
| **Claude Console** (console.anthropic.com) | klíč k AI | platí se za použití |
| **Claude Code** | práce s kódem | v rámci tvého předplatného Claude |

---

## 1. Supabase: databáze a přihlášení

1. Na **supabase.com** si založ účet a nový projekt.
   - **Region vyber v EU** (např. Frankfurt). Kvůli GDPR je to důležité.
   - Heslo k databázi si ulož do správce hesel.
2. Otevři **SQL Editor → New query**, vlož celý obsah souboru `supabase/schema.sql` a dej **Run**. Vzniknou tabulky a pravidla, díky kterým každý vidí jen svoje data.
3. **Authentication → Sign In / Providers → Email:**
   - nech zapnuté přihlášení e-mailem,
   - **vypni „Allow new users to sign up“**, aby se nikdo nemohl registrovat sám a účty vznikaly jen na pozvánku.
4. **Project Settings → API** (nebo „API Keys“): poznamenej si
   - **Project URL** (`https://….supabase.co`),
   - **anon / public key** (veřejný),
   - **service_role key**: ten je **tajný**, nikomu ho neposílej a nedávej ho do `config.js`.

## 2. Klíč k Claude API

1. Na **console.anthropic.com** si vytvoř účet a přidej platební kartu.
2. **Nastav si měsíční limit útraty** (Billing / Limits), třeba na pár set korun. Je to pojistka, kdyby se něco pokazilo.
3. **API Keys → Create Key** a klíč si ulož (`sk-ant-…`). Je **tajný**.

## 3. Doplň konfiguraci

Otevři soubor `config.js` a místo `XXXX` vlož **Project URL** a **anon key** ze Supabase. Nic jiného tam nepatří.

## 4. Nahraj projekt na GitHub

V Claude Code napiš například:

> „Inicializuj v téhle složce git repozitář, vytvoř na mém GitHubu soukromý repozitář *ritual* a nahraj tam kód. Zkontroluj, že se nenahrává soubor .env.“

## 5. Vercel: zveřejnění appky

1. Na **vercel.com** se přihlas přes GitHub a dej **Add New → Project**. Vyber repozitář *ritual*.
2. Framework nech **Other**. Build nastavovat nemusíš, appka žádný build nepotřebuje.
3. V **Environment Variables** přidej (hodnoty máš z kroků 1 a 2, vzor je v `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `AI_DAILY_LIMIT` (třeba `10`, tolik AI dotazů denně na jednoho člověka)
   - `ANTHROPIC_MODEL`: volitelné, výchozí je `claude-sonnet-5-5`
4. Dej **Deploy**. Dostaneš adresu typu `ritual-xyz.vercel.app`.

## 6. Propoj Supabase s adresou appky

V Supabase: **Authentication → URL Configuration**
- **Site URL:** adresa z Vercelu (`https://ritual-xyz.vercel.app`)
- **Redirect URLs:** přidej stejnou adresu

Bez tohohle by odkazy v e-mailech (pozvánka, nové heslo) vedly jinam.

## 7. Pozvi sebe a otestuj

1. Supabase → **Authentication → Users → Invite user** → tvůj e-mail.
2. Klikni na odkaz v e-mailu, nastav si heslo a projdi úvodní nastavení.
3. **Přenes svá data ze staré verze:** ve staré appce v Claudovi otevři Profil a dej **Zkopírovat zálohu**. V nové appce pak Profil → **Nahrát zálohu** → vložit → Nahrát.
4. Na iPhonu otevři adresu v Safari → **Sdílet → Přidat na plochu**.
5. Vyzkoušej: sken EAN, odkaz z e-shopu, ranní diagnostiku a odhlášení s novým přihlášením.

## 8. Než pozveš beta testerky

- [ ] **Doplň zásady ochrany osobních údajů** (`soukromi.html`, žlutá místa) a nech je zkontrolovat odborníka na GDPR. Appka zpracovává selfie, údaje o cyklu, alergie a léky, tedy údaje o zdraví.
- [ ] Rozhodni, kdo je správce údajů (ty jako osoba, nebo firma).
- [ ] Zkontroluj podmínky Supabase, Vercelu a Anthropic API ohledně zpracování dat (DPA).
- [ ] Vestavěné e-maily Supabase mají nízký limit odeslaných zpráv. Pro víc pozvánek nastav vlastní SMTP (např. Resend). Claude Code ti s tím pomůže.
- [ ] Volitelně si připoj vlastní doménu ve Vercelu (Settings → Domains).

## 9. Jak pokračovat v Claude Code

V souboru `CLAUDE.md` je popis architektury a pravidel, Claude Code si ho přečte sám. Příklady zadání:

- „Přesuň selfie z tabulky days do privátního bucketu v Supabase Storage.“
- „Přidej push notifikace na ranní a večerní rutinu.“
- „Napiš testy pro detekci látek ve složení a kontrolu konfliktů.“
- „Uprav texty úvodní obrazovky na tyhle: …“

---

### Co je v projektu

```
index.html            appka (vše v jednom souboru)
config.js             veřejná konfigurace Supabase
soukromi.html         návrh zásad ochrany osobních údajů
api/ai.js             AI přes Claude API + denní limit
api/ean.js            dohledání produktu podle čárového kódu
api/page.js           načtení stránky z e-shopu
api/account.js        smazání účtu a všech dat
api/_lib.js           sdílené funkce
supabase/schema.sql   databáze a zabezpečení
.env.example          vzor tajných proměnných pro Vercel
CLAUDE.md             kontext pro Claude Code
```

### Co se oproti verzi v Claudovi změnilo

- Vlastní přihlášení e-mailem a heslem, účty na pozvánku, odhlášení a smazání účtu.
- **Sken EAN** dohledá produkt v databázi Open Beauty Facts, často i se složením a fotkou.
- **Odkaz z e-shopu** appka zkusí načíst sama. Když to e-shop zablokuje, pomůže screenshot.
- **UV index** je živý z předpovědi (Open-Meteo). Odhad se použije, jen když předpověď nejde načíst.
- AI má denní limit na uživatelku a platí se z tvého API klíče.
- Souhlas se zpracováním údajů v úvodním nastavení.
- Záloha jde nejen zkopírovat, ale i nahrát zpátky.
