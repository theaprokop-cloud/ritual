// GET /api/page?url=https://...
// Načte stránku produktu z e-shopu a vrátí { title, brand, image, text }.
// Text se pak posílá Claudovi, aby z něj vytáhl název, značku a složení.
// Některé e-shopy (např. s ochranou Cloudflare) načtení blokují – appka pak
// použije screenshot nebo vložený text.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { getUser, deny, fetchWithTimeout } from './_lib.js';

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i;
const MAX_REDIRECTS = 5;

// Je IP adresa soukromá / lokální / vyhrazená? (IPv4 i IPv6)
function isPrivateIp(ip) {
  ip = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const m4 = ip.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m4) {
    const [a, b] = [+m4[1], +m4[2]];
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) return true; // IPv4-mapped v hex tvaru
    return /^(fc|fd|fe[89ab]|ff)/.test(ip);
  }
  return true; // neznámý formát = radši ne
}

// Smí server tuhle adresu načíst? Kontroluje protokol, jméno i to, kam se jméno přeloží.
async function isAllowed(u) {
  if (!/^https?:$/.test(u.protocol)) return false;
  if (u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (PRIVATE_HOST.test(host)) return false;
  if (isIP(host)) return false; // přímé IP adresy nepouštíme vůbec
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return m ? decode(m[1]) : '';
};

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user || !user.id) return deny(res, 401, 'Nejsi přihlášená.');

  let u;
  try { u = new URL(String(req.query.url || '')); } catch { return deny(res, 400, 'Neplatný odkaz.'); }
  if (!(await isAllowed(u))) return deny(res, 400, 'Tenhle odkaz načíst nejde.');

  try {
    // Přesměrování procházíme ručně, aby se každá další adresa znovu zkontrolovala.
    let r;
    for (let hop = 0; ; hop++) {
      r = await fetchWithTimeout(u.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'cs,en;q=0.8',
        },
        redirect: 'manual',
      });
      if (r.status < 300 || r.status >= 400) break;
      const loc = r.headers.get('location');
      if (!loc || hop >= MAX_REDIRECTS) return deny(res, 502, 'E-shop stránku nevydal.');
      u = new URL(loc, u);
      if (!(await isAllowed(u))) return deny(res, 400, 'Tenhle odkaz načíst nejde.');
    }
    if (!r.ok) return deny(res, 502, 'E-shop stránku nevydal.');
    let html = await r.text();
    if (html.length > 3_000_000) html = html.slice(0, 3_000_000);

    let brand = '', ldName = '', ldImage = '';
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const data = JSON.parse(m[1].trim());
        const list = Array.isArray(data) ? data : data['@graph'] || [data];
        for (const it of list) {
          if (it && /Product/i.test(String(it['@type']))) {
            ldName = ldName || it.name || '';
            brand = brand || (typeof it.brand === 'string' ? it.brand : it.brand && it.brand.name) || '';
            const img = Array.isArray(it.image) ? it.image[0] : it.image;
            ldImage = ldImage || (typeof img === 'string' ? img : img && img.url) || '';
          }
        }
      } catch {}
    }

    const title = ldName || meta(html, 'og:title') || decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '');
    const image = ldImage || meta(html, 'og:image');
    const text = decode(
      html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    ).replace(/\s+/g, ' ').trim();

    // Upřednostni část textu kolem složení
    const i = text.search(/ingredients|složení|inci|zloženie/i);
    const focus = i >= 0 ? text.slice(Math.max(0, i - 200), i + 4000) : '';
    const out = (focus ? focus + ' … ' : '') + text.slice(0, 3000);

    return res.status(200).json({ title, brand, image: image ? new URL(image, u).toString() : '', text: out.slice(0, 8000) });
  } catch (e) {
    return deny(res, 502, 'Stránku se nepodařilo načíst.');
  }
}
