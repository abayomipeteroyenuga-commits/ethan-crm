import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams,
  Users,
} from 'node-appwrite';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'ethan_business_db';
const TABLES = {
  businesses: 'businesses',
  members: 'business_members',
  branches: 'branches',
};

function response(res, status, payload) {
  return res.json(payload, status);
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'business';
}

function safeString(value, maxLength) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

function clientForRequest(req) {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || 'ethan-business';
  const apiKey = req.headers?.['x-appwrite-key'];
  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Function service credentials are not available.');
  }
  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

async function authenticatedContext(req) {
  const jwt = req.headers?.['x-appwrite-user-jwt'];
  if (!jwt) return { error: 'Sign in to continue.' };

  const client = clientForRequest(req);
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || 'ethan-business';
  const userClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const account = new Account(userClient);
  const user = await account.get();
  if (!user || user.status !== true) return { error: 'Your account is not available.' };
  if (String(user.email || '').trim().toLowerCase() !== 'abayomipeteroyenuga@gmail.com') {
    return { error: 'Ethan CRM onboarding is restricted to the authorised administrator.' };
  }

  return {
    client,
    user,
    userId: user.$id,
    tablesDB: new TablesDB(client),
    teams: new Teams(client),
  };
}

async function listBusinesses(ctx) {
  const memberships = await ctx.tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.members,
    queries: [
      Query.equal('user_id', ctx.userId),
      Query.equal('status', 'active'),
      Query.limit(100),
    ],
  });

  const results = [];
  for (const membership of memberships.rows ?? []) {
    try {
      const business = await ctx.tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.businesses,
        rowId: membership.business_id,
      });
      results.push({
        id: business.$id,
        name: business.business_name,
        slug: business.slug,
        industry: business.industry ?? '',
        currency: business.currency,
        timezone: business.timezone,
        status: business.status,
        role: membership.role,
        teamId: membership.team_id,
      });
    } catch (err) {
      // Ignore stale membership rows; never expose records outside this user's membership list.
    }
  }

  return results;
}

async function createBusiness(ctx, body, log) {
  const businessName = safeString(body.businessName ?? body.business_name, 160);
  if (businessName.length < 2) {
    return { status: 400, body: { success: false, error: 'Business name must contain at least 2 characters.' } };
  }

  const currency = safeString(body.currency || 'NGN', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { status: 400, body: { success: false, error: 'Currency must be a 3-letter currency code.' } };
  }

  const timezone = safeString(body.timezone || 'Africa/Lagos', 60);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    return { status: 400, body: { success: false, error: 'Enter a valid time zone.' } };
  }

  const industry = safeString(body.industry, 100);
  const email = safeString(body.email || ctx.user.email, 254).toLowerCase();
  const phone = safeString(body.phone, 40);
  const address = safeString(body.address, 4000);
  const branchName = safeString(body.branchName || body.branch_name || 'Main Branch', 140);

  const businessId = ID.unique();
  // The business API uses the Team ID as the business workspace key.
  const teamId = businessId;
  const branchId = ID.unique();
  const memberRowId = ID.unique();
  const suffix = businessId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toLowerCase();
  const slug = `${slugify(businessName).slice(0, 72)}-${suffix}`.slice(0, 100);

  const teams = ctx.teams;
  const tablesDB = ctx.tablesDB;
  let teamCreated = false;
  const createdRows = [];

  try {
    // Each business has its own Appwrite Team, which is the membership boundary.
    await teams.create({ teamId, name: businessName });
    teamCreated = true;

    // A server-side membership is added immediately (no invitation email required).
    await teams.createMembership({
      teamId,
      userId: ctx.userId,
      email: ctx.user.email,
      roles: ['owner'],
      name: ctx.user.name || businessName,
    });

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.businesses,
      rowId: businessId,
      data: {
        business_name: businessName,
        slug,
        owner_user_id: ctx.userId,
        email,
        phone,
        industry,
        currency,
        timezone,
        address,
        status: 'active',
      },
      permissions: [
        Permission.read(Role.user(ctx.userId)),
        Permission.update(Role.user(ctx.userId)),
        Permission.delete(Role.user(ctx.userId)),
        Permission.read(Role.team(teamId)),
      ],
    });
    createdRows.push([TABLES.businesses, businessId]);

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.branches,
      rowId: branchId,
      data: {
        business_id: businessId,
        team_id: teamId,
        branch_name: branchName,
        branch_code: 'MAIN',
        address,
        phone,
        manager_user_id: ctx.userId,
        is_default: true,
        status: 'active',
      },
      permissions: [
        Permission.read(Role.user(ctx.userId)),
        Permission.update(Role.user(ctx.userId)),
        Permission.delete(Role.user(ctx.userId)),
        Permission.read(Role.team(teamId)),
      ],
    });
    createdRows.push([TABLES.branches, branchId]);

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.members,
      rowId: memberRowId,
      data: {
        business_id: businessId,
        team_id: teamId,
        user_id: ctx.userId,
        email,
        full_name: safeString(ctx.user.name, 160),
        role: 'owner',
        status: 'active',
        branch_ids: [branchId],
      },
      permissions: [
        Permission.read(Role.user(ctx.userId)),
        Permission.update(Role.user(ctx.userId)),
        Permission.read(Role.team(teamId)),
      ],
    });
    createdRows.push([TABLES.members, memberRowId]);

    return {
      status: 201,
      body: {
        success: true,
        message: 'Business workspace created.',
        business: {
          id: businessId,
          name: businessName,
          slug,
          currency,
          timezone,
          status: 'active',
          role: 'owner',
          teamId,
          defaultBranch: { id: branchId, name: branchName },
        },
      },
    };
  } catch (err) {
    log(`Business onboarding failed for user ${ctx.userId}: ${err?.message || 'unknown error'}`);
    for (const [tableId, rowId] of createdRows.reverse()) {
      try {
        await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId });
      } catch (cleanupError) {
        log(`Cleanup warning for ${tableId}/${rowId}: ${cleanupError?.message || 'unknown error'}`);
      }
    }
    if (teamCreated) {
      try {
        await teams.delete({ teamId });
      } catch (cleanupError) {
        log(`Team cleanup warning for ${teamId}: ${cleanupError?.message || 'unknown error'}`);
      }
    }
    return {
      status: 500,
      body: { success: false, error: 'The business workspace could not be created. No partial workspace should be used; please retry.' },
    };
  }
}

export default async ({ req, res, log, error }) => {
  const path = (req.path || '/').replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && path === '/health') {
    return response(res, 200, {
      success: true,
      service: 'ETHAN BUSINESS Onboarding API',
      status: 'ready',
      tagline: 'MANAGE. GROW. SUCCEED.',
    });
  }

  const ctx = await authenticatedContext(req).catch((err) => {
    error(`Authentication lookup failed: ${err?.message || 'unknown error'}`);
    return { error: 'Unable to verify your session. Please sign in again.' };
  });

  if (ctx.error) {
    return response(res, 401, { success: false, error: ctx.error });
  }

  if (req.method === 'GET' && path === '/me') {
    return response(res, 200, {
      success: true,
      user: { id: ctx.userId, name: ctx.user.name, email: ctx.user.email },
      businesses: await listBusinesses(ctx),
    });
  }

  if (req.method === 'GET' && path === '/businesses') {
    return response(res, 200, {
      success: true,
      businesses: await listBusinesses(ctx),
    });
  }

  if (req.method === 'POST' && path === '/businesses') {
    let body = req.bodyJson;
    if (!body && req.bodyText) {
      try { body = JSON.parse(req.bodyText); } catch { body = null; }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return response(res, 400, { success: false, error: 'Send a valid JSON request body.' });
    }
    const result = await createBusiness(ctx, body, log);
    return response(res, result.status, result.body);
  }

  return response(res, 404, { success: false, error: 'Endpoint not found.' });
};
