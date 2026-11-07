import { Account, Client, ID } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const PROJECT = process.env.APPWRITE_PROJECT_ID || 'ethan-business';
const COOKIE_NAME = 'ethan_crm_session';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const item of raw.split(';')) {
    const index = item.indexOf('=');
    if (index < 0) continue;
    if (item.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); }
    catch { return item.slice(index + 1).trim(); }
  }
  return '';
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

function setCookie(res, session) {
  const expiry = new Date(session.expire).getTime();
  const maxAge = Number.isFinite(expiry)
    ? Math.max(60, Math.floor((expiry - Date.now()) / 1000))
    : 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(session.secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

function sameOrigin(req) {
  const origin = req.headers?.origin;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === String(host).split(',')[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

function publicUser(user) {
  return { id: user.$id, name: user.name || '', email: user.email || '' };
}

function userMessage(error, action) {
  const type = String(error?.type || '').toLowerCase();
  const code = Number(error?.code || error?.status || 0);
  if (type.includes('user_already_exists') || code === 409) {
    return 'An account with this email already exists. Switch to Sign in.';
  }
  if (type.includes('user_invalid_credentials') || type.includes('user_not_found') || code === 401) {
    return 'The email address or password is incorrect.';
  }
  if (type.includes('password') || type.includes('user_password')) {
    return 'The password must contain at least 8 characters.';
  }
  if (code === 429) return 'Too many attempts. Please wait a little and try again.';
  if (action === 'register' && code === 400) {
    return 'Please check your name, email address and password, then try again.';
  }
  return 'The authentication request could not be completed. Please try again.';
}

function publicClient() {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
}

async function startSession(email, password, res) {
  const session = await new Account(publicClient()).createEmailPasswordSession({ email, password });
  if (!session?.secret) throw new Error('Appwrite did not return a session token.');
  setCookie(res, session);

  const sessionClient = publicClient().setSession(session.secret);
  const user = await new Account(sessionClient).get();
  return publicUser(user);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Vary', 'Cookie');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
  if (!sameOrigin(req)) {
    return res.status(403).json({ success: false, message: 'This request origin is not allowed.' });
  }

  const body = parseBody(req);
  const action = String(body.action || '');
  const sessionSecret = readCookie(req, COOKIE_NAME);

  try {
    if (action === 'register') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (name.length < 2 || name.length > 128) {
        return res.status(400).json({ success: false, message: 'Enter your full name (2–128 characters).' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      }
      if (password.length < 8 || password.length > 256) {
        return res.status(400).json({ success: false, message: 'Your password must be at least 8 characters.' });
      }

      const account = new Account(publicClient());
      await account.create({ userId: ID.unique(), email, password, name });
      try {
        const user = await startSession(email, password, res);
        return res.status(201).json({ success: true, user, message: 'Your Ethan account has been created.' });
      } catch (sessionError) {
        clearCookie(res);
        return res.status(202).json({
          success: true,
          requiresSignIn: true,
          message: 'Your account was created. Please sign in with your new email and password.',
        });
      }
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Enter your email address and password.' });
      }
      const user = await startSession(email, password, res);
      return res.status(200).json({ success: true, user, message: 'Signed in successfully.' });
    }

    if (action === 'me') {
      if (!sessionSecret) return res.status(401).json({ success: false, message: 'No active session.' });
      try {
        const account = new Account(publicClient().setSession(sessionSecret));
        const user = await account.get();
        return res.status(200).json({ success: true, user: publicUser(user) });
      } catch {
        clearCookie(res);
        return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
      }
    }

    if (action === 'logout') {
      if (sessionSecret) {
        try {
          const account = new Account(publicClient().setSession(sessionSecret));
          await account.deleteSession({ sessionId: 'current' });
        } catch {
          // The browser session cookie is cleared even if Appwrite has already expired the session.
        }
      }
      clearCookie(res);
      return res.status(200).json({ success: true, message: 'Signed out.' });
    }

    if (action === 'recovery') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      }
      // Appwrite redirect URLs must belong to a registered platform. The current
      // production CRM hostname is registered; Preview hostnames are not available
      // on this project's current Appwrite plan.
      await new Account(publicClient()).createRecovery({
        email,
        url: 'https://crm.ethandigitalacademy.org',
      });
      return res.status(200).json({
        success: true,
        message: 'A password reset email has been requested. Open the link from your email to continue.',
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown authentication action.' });
  } catch (error) {
    console.error('ETHAN CRM authentication error', {
      action,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });
    return res.status(Number(error?.code) >= 400 && Number(error?.code) < 600 ? Number(error.code) : 400)
      .json({ success: false, message: userMessage(error, action) });
  }
}
