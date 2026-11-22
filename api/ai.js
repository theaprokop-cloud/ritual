// POST /api/ai  { prompt: string, images?: [{ media_type, data(base64) }] }
// Pošle dotaz Claudovi přes Anthropic API a vrátí { text }.
// Každý uživatel má denní limit (AI_DAILY_LIMIT), počítá se v tabulce ai_usage.

import { getUser, admin, deny } from './_lib.js';

const LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '10', 10);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') return deny(res, 405, 'Method not allowed');

  const user = await getUser(req);
  if (!user || !user.id) return deny(res, 401, 'Nejsi přihlášená.');

  const { prompt, images = [] } = req.body || {};
  if (typeof prompt !== 'string' || !prompt || prompt.length > 30000)
    return deny(res, 400, 'Neplatný dotaz.');
  if (!Array.isArray(images) || images.length > 3)
    return deny(res, 400, 'Maximálně 3 obrázky.');

  // Denní limit (atomicky v databázi)
  const day = new Date().toISOString().slice(0, 10);
  const lr = await admin('/rest/v1/rpc/ai_use', {
    method: 'POST',
    body: JSON.stringify({ p_user: user.id, p_day: day, p_limit: LIMIT }),
  });
  if (lr.ok) {
    const allowed = await lr.json();
    if (allowed === false)
      return deny(res, 429, `Dnešní limit AI (${LIMIT}×) je vyčerpaný. Zítra zase.`);
  } else {
    // Když limit nejde ověřit, dotaz raději odmítni (jinak by se dal obejít).
    console.error('ai_use failed', await lr.text());
    return deny(res, 503, 'AI je teď nedostupná, zkus to za chvíli.');
  }

  const content = [
    ...images.map((i) => ({
      type: 'image',
      source: { type: 'base64', media_type: i.media_type || 'image/jpeg', data: i.data },
    })),
    { type: 'text', text: prompt },
  ];

  try {
    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Model nejdřív přemýšlí a i to se počítá do max_tokens –
        // s malým limitem se odpověď (JSON) utne uprostřed.
        max_tokens: 16000,
        output_config: { effort: 'low' },
        // Když bezpečnostní filtr dotaz odmítne, API ho zkusí na záložním modelu.
        fallbacks: 'default',
        system:
          'Jsi asistentka skincare appky Rituál. Odpovídáš výhradně validním JSON bez dalšího textu. Nejsi lékařka a nestanovuješ diagnózy.',
        messages: [{ role: 'user', content }],
      }),
    });
    const j = await ar.json();
    if (!ar.ok) {
      console.error('anthropic error', j);
      return deny(res, 502, 'AI teď neodpověděla, zkus to za chvíli.');
    }
    if (j.stop_reason === 'max_tokens') {
      console.error('anthropic max_tokens', j.usage);
      return deny(res, 502, 'Odpověď AI byla moc dlouhá a nedošla celá. Zkus to znovu.');
    }
    if (j.stop_reason === 'refusal') {
      console.error('anthropic refusal', j.stop_details);
      return deny(res, 422, 'AI tenhle dotaz odmítla zpracovat. Zkus jinou fotku nebo text.');
    }
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return deny(res, 502, 'AI teď neodpověděla, zkus to za chvíli.');
  }
}

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
