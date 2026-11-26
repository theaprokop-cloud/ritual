# Rituál – kontext pro Claude Code

Osobní skincare deník (uzavřená beta, vlastní projekt Thei). UI je **česky**, uživatelce se tyká.

## Architektura
- `index.html` – celá appka v jednom souboru (HTML + CSS + vanilla JS, bez build kroku).
  Pořadí v `<script>`: utils → doménová data (CATS, ACTIVES, ALLERG, CONCERNS, TREAT…) →
  storage (Supabase) → auth → logika (rozvrh, konflikty, cyklus, UV) → obrázky & AI →
  views (`viewToday`, `viewProducts`, `viewTreatments`, `viewSkin`, `viewInsights`, `viewProfile`)
  → onboarding → delegované eventy (`data-act`, `data-change`, `data-input`).
- `config.js` – veřejná konfigurace Supabase (URL + anon key). Žádná tajemství.
- `api/*.js` – Vercel Functions (Node 18+, ESM, jen `fetch`, žádné závislosti):
  - `ai.js` – proxy na Anthropic Messages API, denní limit přes RPC `ai_use`.
  - `ean.js` – Open Beauty Facts podle čárového kódu.
  - `page.js` – načte stránku e-shopu (JSON-LD, og:*, text kolem „ingredients/složení“).
  - `account.js` – smazání účtu (admin API, kaskádně smaže data).
  - `_lib.js` – sdílené helpery (není endpoint).
- `supabase/schema.sql` – tabulky `profiles`, `products`, `days`, `treatments`, `ai_usage` + RLS.
- `soukromi.html` – **pracovní návrh** zásad ochrany osobních údajů (doplnit s právníkem).

## Datový model
Každá tabulka ukládá dokument v `data jsonb`, struktura odpovídá objektům v JS:
- profil: `name, gender, skinType, sens, concerns[], words[], goals, allergies[], allergyText, city, cycleOn, periodStarts[], cycleLen, periodLen, consentAt, onboarded, routineAi, skinReport{at,n,data}, wishlist[], hairOn, hairType, scalp, hairFlags[], washFreq, hairAvoid[], fcTone(hravy|jemny), guide{}`
- produkt: `id, area(skin|hair), name, brand, category, ean, url, ingredients, ingSource, actives[], am, pm, any, stepAm, stepPm, when[], freq{type:daily|days|interval|asneeded, days[], every, start}, goal, hw(wash|extra|daily – jen vlasy), opened, pao, expiry, weeks, low, archived, photo, notes`
- den: `date, am{pid:true}, pm{}, extra{}, pick{am:{krok:pid}}, hair{pid:true}, washMark, noWash, washPlan, hairState[], condition 1–5, concerns[], sleep, stress, food[], activity[], env[], meds, notes, selfie(dataURL), ai{}, forecast{text,tips[{k,t}],src(ai|rules),sig,tone,n,at}, dismissed[]`
- procedura: `id, type, custom, date, time, place, price, pause, reaction, notes, repeat`

## Pravidla
- Nikdy nevypínej RLS a nedávej `SUPABASE_SERVICE_ROLE_KEY` ani `ANTHROPIC_API_KEY` do frontendu.
- AI prompty vždy chtějí odpověď **jen jako JSON**; parsuje se přes `parseLoose`.
- Kontroly konfliktů a alergenů jsou pravidla v kódu (ne AI) – AI je volitelná nadstavba.
- Design: bílé pozadí, EB Garamond (nadpisy, kurzíva pro akcent), Inter (UI), šedé pill štítky
  `.chip` / vybrané `.chip.on`, tlačítka `.btn` (obrys) a `.btn.dark`. Žádné nové barvy bez důvodu.
- Testuj vždy i v **Safari na iPhonu** (skryté `<input type=date>` a `fetch(data:)` tam nefungují).
- Zdravotní údaje (selfie, cyklus, alergie, léky) = zvláštní kategorie GDPR.

## Klíčové funkce (kde hledat)
- Střídané kroky rutiny: `routineItems`, `suggestAlt`, `currentAlt`, akce `altDone`/`altOpen`/`altPick`.
- Kontroly: `analyzeSlot` (konflikty látek), `allergyHits`, `hairAvoidHits`, `inciItems`/`inciHas`.
- Cyklus: `periodStarts`, `cycleLength`, `cycleInfo`. Procedury: `aftercare`, `viewTreatments`.
- Denní předpověď (nahradila Skin Score): `forecastData` (Do/Don't + „Proč?“ = pravidla), `genForecast` (text od Clauda max 3× denně, cache v `days.forecast`, při chybě `forecastRuleText`), `forecastCard`, `streakInfo`. Do = max 1 tip s produktem + 2 tipy mimo kosmetiku (`lifeCats` střídá kategorie `LIFE` podle data, text píše Claude spolu s předpovědí, záloha `LIFE_FB`, neopakuje tipy z posledních 14 dní). Počasí: `fetchUV` → `uvLive.temp/hum`, `wxToday`.
- Skin report: `skinStats`, `reportPromptBase`, `runReport`, `renderReport`, wishlist (`wishAdd`, `wishBuy`).
- Vlasy: `hairProducts`, `washInfo`, `washInterval`, `viewHairProducts`, sekce „vlasy“ ve `viewToday`.
- API `api/ean.js` zůstává, ale sken čárového kódu je z UI odstraněný (na přání).

## Roadmapa (nápady)
0. Automatické produktové fotky k doporučením ze skin reportu (Open Beauty Facts → image search API), uložit do Storage.
0. Doporučení střídaných krémů podle skutečné teploty (Open-Meteo `temperature_2m`).
1. Selfie přesunout z `days.data` do Supabase Storage (privátní bucket) – šetří databázi.
2. Push notifikace (PWA na iOS 16.4+ po přidání na plochu) pro rutinu a procedury.
3. Rozdělit `index.html` na moduly, přidat testy pro `analyzeSlot`, `detectActives`, `cycleInfo`.
4. Vlastní SMTP (např. Resend) pro spolehlivé e-maily s pozvánkami.
5. Admin pohled pro zvaní beta testerek a přehled využití AI.
