// Sdílené pomocné funkce pro serverové API (Vercel Functions).
// Soubory začínající podtržítkem Vercel nepovažuje za samostatné endpointy.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''); // bez koncového lomítka
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ověří přihlášeného uživatele podle tokenu z hlavičky Authorization.
export async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON },
  });
  if (!r.ok) return null;
  return r.json();
}

// Volání Supabase s klíčem service role (jen na serveru, nikdy v prohlížeči).
export function admin(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

export function deny(res, code, error) {
  res.status(code).json({ error });
}

export async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
