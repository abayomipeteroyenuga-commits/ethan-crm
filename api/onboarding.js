import onboardingMain from '../src/onboarding-main.js';

function header(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function cookie(req, name) {
  const raw = String(header(req, 'cookie') || '');
  for (const item of raw.split(';')) {
    const index = item.indexOf('=');
    if (index < 0 || item.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); }
    catch { return item.slice(index + 1).trim(); }
  }
  return '';
}

function sameOrigin(req) {
  const origin = header(req, 'origin');
  const hosts = [header(req, 'x-forwarded-host'), header(req, 'host')]
    .filter(Boolean)
    .map(value => String(value).split(',')[0].trim().toLowerCase());
  if (!origin || !hosts.length) return false;
  try { return hosts.includes(new URL(origin).host.toLowerCase()); }
  catch { return false; }
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const jwt = String(header(req, 'authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const session = cookie(req, 'ethan_crm_session_v2');
  if (!jwt && !session) return res.status(401).json({ success: false, error: 'Sign in to continue.' });
  if (session && !sameOrigin(req)) return res.status(403).json({ success: false, error: 'This request origin is not allowed.' });
  if (!process.env.APPWRITE_API_KEY) {
    return res.status(500).json({ success: false, error: 'Onboarding service configuration is incomplete.' });
  }

  const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  const path = String(body._path || '/businesses');
  const method = String(body._method || 'POST').toUpperCase();
  delete body._path;
  delete body._method;

  const mockReq = {
    headers: {
      'x-appwrite-user-jwt': jwt,
      'x-appwrite-user-session': session,
      'x-appwrite-user-id': String(header(req, 'x-appwrite-user-id') || ''),
      'x-appwrite-key': process.env.APPWRITE_API_KEY,
    },
    bodyJson: body,
    bodyText: JSON.stringify(body),
    method,
    path,
    query: req.query || {},
    queryString: '',
  };
  const mockRes = {
    json(payload, status = 200) {
      if (!res.writableEnded) return res.status(status).json(payload);
    },
    text(payload, status = 200) {
      if (!res.writableEnded) return res.status(status).send(payload);
    },
    empty(status = 204) {
      if (!res.writableEnded) return res.status(status).end();
    },
  };

  try {
    await onboardingMain({ req: mockReq, res: mockRes, log: console.log, error: console.error });
    if (!res.writableEnded) return res.status(500).json({ success: false, error: 'Onboarding service did not return a response.' });
  } catch (error) {
    console.error('ETHAN CRM onboarding error', error);
    if (!res.writableEnded) return res.status(500).json({ success: false, error: 'The workspace request could not be completed.' });
  }
}
