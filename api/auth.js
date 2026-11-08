import { Account, Client, ID } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const PROJECT = process.env.APPWRITE_PROJECT_ID || 'ethan-business';
const COOKIE_NAME = 'ethan_crm_session_v2';
const LEGACY_COOKIE_NAME = 'ethan_crm_session';
const PENDING_COOKIE_NAME = 'ethan_crm_otp';
const RECOVERY_COOKIE_NAME = 'ethan_crm_recovery';
const OTP_TTL_SECONDS = 15 * 60;
const RECOVERY_TTL_SECONDS = 15 * 60;

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
    if (index < 0 || item.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); }
    catch { return item.slice(index + 1).trim(); }
  }
  return '';
}

function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${LEGACY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${RECOVERY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ]);
}

function setSessionCookie(res, session) {
  const expiry = new Date(session.expire).getTime();
  const maxAge = Number.isFinite(expiry)
    ? Math.max(60, Math.floor((expiry - Date.now()) / 1000))
    : 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(session.secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
    `${LEGACY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${RECOVERY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ]);
}

function setPendingCookie(res, pending, token) {
  const tokenExpiry = new Date(token?.expire || 0).getTime();
  const remaining = Number.isFinite(tokenExpiry) && tokenExpiry > Date.now()
    ? Math.floor((tokenExpiry - Date.now()) / 1000)
    : OTP_TTL_SECONDS;
  const maxAge = Math.max(60, Math.min(OTP_TTL_SECONDS, remaining));
  const value = encodeURIComponent(JSON.stringify({
    userId: String(pending.userId),
    email: String(pending.email).toLowerCase(),
    phrase: String(token?.phrase || ''),
    issuedAt: Date.now(),
  }));
  res.setHeader('Set-Cookie', [
    `${PENDING_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${LEGACY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${RECOVERY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ]);
  return maxAge;
}

function readPendingCookie(req) {
  const raw = readCookie(req, PENDING_COOKIE_NAME);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value?.userId || !value?.email || !Number.isFinite(value?.issuedAt)) return null;
    if (Date.now() - value.issuedAt > OTP_TTL_SECONDS * 1000) return null;
    return value;
  } catch {
    return null;
  }
}


function setRecoveryCookie(res, pending, token) {
  const tokenExpiry = new Date(token?.expire || 0).getTime();
  const remaining = Number.isFinite(tokenExpiry) && tokenExpiry > Date.now()
    ? Math.floor((tokenExpiry - Date.now()) / 1000)
    : RECOVERY_TTL_SECONDS;
  const maxAge = Math.max(60, Math.min(RECOVERY_TTL_SECONDS, remaining));
  const value = encodeURIComponent(JSON.stringify({
    userId: String(pending.userId),
    email: String(pending.email).toLowerCase(),
    phrase: String(token?.phrase || ''),
    issuedAt: Date.now(),
  }));
  res.setHeader('Set-Cookie', [
    `${RECOVERY_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
    `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${LEGACY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ]);
  return maxAge;
}

function readPendingRecoveryCookie(req) {
  const raw = readCookie(req, RECOVERY_COOKIE_NAME);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value?.userId || !value?.email || !Number.isFinite(value?.issuedAt)) return null;
    if (Date.now() - value.issuedAt > RECOVERY_TTL_SECONDS * 1000) return null;
    return value;
  } catch {
    return null;
  }
}

function clearRecoveryCookie(res) {
  res.setHeader('Set-Cookie', [
    `${RECOVERY_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ]);
}

function sameOrigin(req) {
  const origin = req.headers?.origin;
  const hosts = [req.headers?.['x-forwarded-host'], req.headers?.host]
    .filter(Boolean)
    .map(value => String(value).split(',')[0].trim().toLowerCase());
  if (!origin || !hosts.length) return false;
  try {
    return hosts.includes(new URL(origin).host.toLowerCase());
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
  if (type.includes('user_invalid_token') || type.includes('token_invalid') || type.includes('user_token_expired') || (action === 'completeRecovery' && type.includes('user_not_found'))) {
    return 'That code is incorrect or has expired. Request a new code and try again.';
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

// Appwrite returns session secrets to server-side SDKs authenticated with an API key.
// The key must include sessions.write; it is configured only in Vercel server env vars.
function adminClient() {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) throw new Error('Authentication service is not configured: APPWRITE_API_KEY is missing.');
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
}

async function createEmailOtp(userId, email, res) {
  const token = await new Account(adminClient()).createEmailToken({
    userId,
    email,
    phrase: true,
  });
  if (!token?.userId) throw new Error('Appwrite did not return an email verification token.');
  setPendingCookie(res, { userId: token.userId, email }, token);
  return {
    success: true,
    requiresOtp: true,
    email,
    securityPhrase: token.phrase || '',
    message: 'We sent a six-digit security code to your email. Enter it below to finish signing in.',
  };
}

async function startPasswordThenOtp(email, password, res) {
  // Validate the password first. The temporary session is never sent to the browser.
  const temporarySession = await new Account(adminClient()).createEmailPasswordSession({ email, password });
  if (!temporarySession?.secret) throw new Error('Appwrite did not return a temporary authentication session.');

  let user;
  const temporaryAccount = new Account(publicClient().setSession(temporarySession.secret));
  try {
    user = await temporaryAccount.get();
  } finally {
    // Do not leave a password-only session active while the user is being challenged.
    await temporaryAccount.deleteSession({ sessionId: 'current' }).catch((error) => {
      console.error('ETHAN CRM temporary session cleanup failed', {
        code: error?.code,
        type: error?.type,
      });
    });
  }
  return createEmailOtp(user.$id, user.email || email, res);
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
  const pending = readPendingCookie(req);
  const recoveryPending = readPendingRecoveryCookie(req);

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

      const created = await new Account(publicClient()).create({
        userId: ID.unique(),
        email,
        password,
        name,
      });
      const result = await createEmailOtp(created.$id, email, res);
      return res.status(201).json({
        ...result,
        message: 'Your account has been created. We sent a six-digit code to verify your email and finish signing in.',
      });
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address and password.' });
      }
      const result = await startPasswordThenOtp(email, password, res);
      return res.status(200).json(result);
    }

    if (action === 'verifyOtp') {
      if (!pending) {
        clearAuthCookies(res);
        return res.status(401).json({ success: false, message: 'Your verification request has expired. Sign in again to receive a new code.' });
      }
      const otp = String(body.otp || '').trim();
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: 'Enter the six-digit code sent to your email.' });
      }
      const session = await new Account(adminClient()).createSession({
        userId: pending.userId,
        secret: otp,
      });
      if (!session?.secret) throw new Error('Appwrite did not return a verified session.');
      const user = await new Account(publicClient().setSession(session.secret)).get();
      setSessionCookie(res, session);
      return res.status(200).json({
        success: true,
        user: publicUser(user),
        message: 'Code verified. You are signed in.',
      });
    }

    if (action === 'resendOtp') {
      if (!pending) {
        clearAuthCookies(res);
        return res.status(401).json({ success: false, message: 'Your verification request has expired. Sign in again to receive a new code.' });
      }
      const result = await createEmailOtp(pending.userId, pending.email, res);
      return res.status(200).json({
        success: true,
        securityPhrase: result.securityPhrase,
        message: 'A new six-digit code has been sent. Use the newest email.',
      });
    }

    if (action === 'cancelOtp') {
      res.setHeader('Set-Cookie', [
        `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      ]);
      return res.status(200).json({ success: true });
    }

    if (action === 'me') {
      if (!sessionSecret) return res.status(401).json({ success: false, message: 'No active session.' });
      try {
        const account = new Account(publicClient().setSession(sessionSecret));
        const user = await account.get();
        return res.status(200).json({ success: true, user: publicUser(user) });
      } catch {
        clearAuthCookies(res);
        return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
      }
    }

    if (action === 'logout') {
      if (sessionSecret) {
        try {
          const account = new Account(publicClient().setSession(sessionSecret));
          await account.deleteSession({ sessionId: 'current' });
        } catch {
          // Clear local cookies even if Appwrite has already expired the session.
        }
      }
      clearAuthCookies(res);
      return res.status(200).json({ success: true, message: 'Signed out.' });
    }

    if (action === 'recovery') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      }
      const token = await new Account(publicClient()).createRecoveryOTP({
        email,
        phrase: true,
      });
      if (!token?.userId) throw new Error('Appwrite did not return a password recovery token.');
      setRecoveryCookie(res, { userId: token.userId, email }, token);
      return res.status(200).json({
        success: true,
        securityPhrase: token.phrase || '',
        message: 'If an account exists for this email, a six-digit password reset code is on its way. The code is valid for 15 minutes.',
      });
    }

    if (action === 'resendRecovery') {
      if (!recoveryPending) {
        clearRecoveryCookie(res);
        return res.status(401).json({ success: false, message: 'Your password reset request has expired. Request a new code.' });
      }
      const token = await new Account(publicClient()).createRecoveryOTP({
        email: recoveryPending.email,
        phrase: true,
      });
      if (!token?.userId) throw new Error('Appwrite did not return a password recovery token.');
      setRecoveryCookie(res, { userId: token.userId, email: recoveryPending.email }, token);
      return res.status(200).json({
        success: true,
        securityPhrase: token.phrase || '',
        message: 'A new password reset code has been requested. Use the newest email.',
      });
    }

    if (action === 'completeRecovery') {
      if (!recoveryPending) {
        clearRecoveryCookie(res);
        return res.status(401).json({ success: false, message: 'Your password reset request has expired. Request a new code.' });
      }
      const otp = String(body.otp || '').trim();
      const password = String(body.password ?? '');
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: 'Enter the six-digit code from your password reset email.' });
      }
      if (password.length < 8 || password.length > 256) {
        return res.status(400).json({ success: false, message: 'Your new password must be at least 8 characters.' });
      }
      await new Account(publicClient()).updateRecoveryOTP({
        userId: recoveryPending.userId,
        secret: otp,
        password,
      });
      clearRecoveryCookie(res);
      return res.status(200).json({
        success: true,
        message: 'Your password has been reset. Sign in with your new password.',
      });
    }

    if (action === 'cancelRecovery') {
      clearRecoveryCookie(res);
      return res.status(200).json({ success: true, message: 'Password reset cancelled.' });
    }

    return res.status(400).json({ success: false, message: 'Unknown authentication action.' });
  } catch (error) {
    console.error('ETHAN CRM authentication error', {
      action,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });
    const errorCode = Number(error?.code);
    const status = Number.isFinite(errorCode) && errorCode >= 400 && errorCode < 600 ? errorCode : 500;
    return res.status(status).json({ success: false, message: userMessage(error, action) });
  }
}
