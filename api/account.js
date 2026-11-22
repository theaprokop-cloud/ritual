// DELETE /api/account
// Trvale smaže přihlášeného uživatele. Díky "on delete cascade" v databázi
// se smažou i všechny jeho produkty, deník, procedury a profil (GDPR).

import { getUser, admin, deny } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return deny(res, 405, 'Method not allowed');
  const user = await getUser(req);
  if (!user || !user.id) return deny(res, 401, 'Nejsi přihlášená.');

  const r = await admin(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' });
  if (!r.ok) {
    console.error('delete user failed', await r.text());
    return deny(res, 500, 'Účet se nepodařilo smazat. Zkus to znovu.');
  }
  return res.status(200).json({ ok: true });
}
