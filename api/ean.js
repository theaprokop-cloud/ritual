// GET /api/ean?code=3401399694216
// Dohledá produkt podle čárového kódu v otevřené databázi Open Beauty Facts.
// Vrací { found, name, brand, ingredients, image }.

import { getUser, deny, fetchWithTimeout } from './_lib.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user || !user.id) return deny(res, 401, 'Nejsi přihlášená.');

  const code = String(req.query.code || '').replace(/\D/g, '');
  if (code.length < 8 || code.length > 14) return deny(res, 400, 'Neplatný kód.');

  try {
    const r = await fetchWithTimeout(
      `https://world.openbeautyfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_cs,product_name_en,brands,ingredients_text,ingredients_text_en,image_front_url,image_url`,
      { headers: { 'User-Agent': 'Ritual/0.1 (beta skincare app)' } }
    );
    if (!r.ok) return res.status(200).json({ found: false });
    const j = await r.json();
    const p = j && j.product;
    if (!p || j.status === 0) return res.status(200).json({ found: false });
    return res.status(200).json({
      found: true,
      name: p.product_name_cs || p.product_name || p.product_name_en || '',
      brand: (p.brands || '').split(',')[0].trim(),
      ingredients: p.ingredients_text_en || p.ingredients_text || '',
      image: p.image_front_url || p.image_url || '',
    });
  } catch (e) {
    return res.status(200).json({ found: false });
  }
}
