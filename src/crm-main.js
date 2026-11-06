import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams
} from 'node-appwrite';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'ethan_business_db';
const TABLES = new Set([
  'branches', 'categories', 'products', 'customers', 'suppliers',
  'stock_movements', 'sales', 'sale_items', 'invoices', 'invoice_items', 'invoice_payments',
  'expenses', 'bookings', 'staff_attendance', 'audit_logs', 'business_members',
  'crm_companies', 'crm_contacts', 'crm_pipelines', 'crm_pipeline_stages',
  'crm_leads', 'crm_deals', 'crm_tasks', 'crm_activities'
]);

const READ_ROLES = {
  branches: ['owner', 'admin', 'manager', 'cashier', 'inventory'],
  categories: ['owner', 'admin', 'manager', 'inventory', 'cashier', 'staff'],
  products: ['owner', 'admin', 'manager', 'inventory', 'cashier', 'staff'],
  customers: ['owner', 'admin', 'manager', 'cashier', 'accountant', 'staff'],
  suppliers: ['owner', 'admin', 'manager', 'inventory', 'accountant'],
  stock_movements: ['owner', 'admin', 'manager', 'inventory', 'accountant'],
  sales: ['owner', 'admin', 'manager', 'cashier', 'accountant'],
  sale_items: ['owner', 'admin', 'manager', 'cashier', 'accountant'],
  invoices: ['owner', 'admin', 'manager', 'accountant'],
  invoice_items: ['owner', 'admin', 'manager', 'accountant'],
  invoice_payments: ['owner', 'admin', 'manager', 'accountant'],
  expenses: ['owner', 'admin', 'manager', 'accountant'],
  bookings: ['owner', 'admin', 'manager', 'staff'],
  staff_attendance: ['owner', 'admin', 'manager'],
  audit_logs: ['owner', 'admin'],
  business_members: ['owner', 'admin'],
  crm_companies: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_contacts: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_pipelines: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_pipeline_stages: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_leads: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_deals: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_tasks: ['owner', 'admin', 'manager', 'accountant', 'staff'],
  crm_activities: ['owner', 'admin', 'manager', 'accountant', 'staff']
};

const CREATE_ROLES = {
  branches: ['owner', 'admin', 'manager'],
  categories: ['owner', 'admin', 'manager', 'inventory'],
  products: ['owner', 'admin', 'manager', 'inventory'],
  customers: ['owner', 'admin', 'manager', 'cashier', 'staff'],
  suppliers: ['owner', 'admin', 'manager', 'inventory', 'accountant'],
  expenses: ['owner', 'admin', 'manager', 'accountant'],
  bookings: ['owner', 'admin', 'manager', 'staff'],
  staff_attendance: ['owner', 'admin', 'manager'],
  crm_companies: ['owner', 'admin', 'manager', 'staff'],
  crm_contacts: ['owner', 'admin', 'manager', 'staff'],
  crm_pipelines: ['owner', 'admin', 'manager'],
  crm_pipeline_stages: ['owner', 'admin', 'manager'],
  crm_leads: ['owner', 'admin', 'manager', 'staff'],
  crm_deals: ['owner', 'admin', 'manager'],
  crm_tasks: ['owner', 'admin', 'manager', 'staff'],
  crm_activities: ['owner', 'admin', 'manager', 'staff']
};

const EDIT_ROLES = {
  branches: ['owner', 'admin', 'manager'],
  categories: ['owner', 'admin', 'manager', 'inventory'],
  products: ['owner', 'admin', 'manager', 'inventory'],
  customers: ['owner', 'admin', 'manager', 'cashier', 'staff'],
  suppliers: ['owner', 'admin', 'manager', 'inventory', 'accountant'],
  expenses: ['owner', 'admin', 'manager', 'accountant'],
  bookings: ['owner', 'admin', 'manager', 'staff'],
  invoices: ['owner', 'admin', 'manager', 'accountant'],
  crm_companies: ['owner', 'admin', 'manager'],
  crm_contacts: ['owner', 'admin', 'manager', 'staff'],
  crm_pipelines: ['owner', 'admin', 'manager'],
  crm_pipeline_stages: ['owner', 'admin', 'manager'],
  crm_leads: ['owner', 'admin', 'manager', 'staff'],
  crm_deals: ['owner', 'admin', 'manager'],
  crm_tasks: ['owner', 'admin', 'manager', 'staff'],
  crm_activities: ['owner', 'admin', 'manager', 'staff']
};

const FIELDS = {
  branches: ['branch_name', 'branch_code', 'address', 'phone', 'manager_user_id', 'is_default', 'status'],
  categories: ['name', 'description', 'status'],
  products: ['branch_id', 'category_id', 'name', 'sku', 'barcode', 'description', 'unit', 'cost_price', 'selling_price', 'stock_quantity', 'reorder_level', 'track_stock', 'status'],
  customers: ['branch_id', 'name', 'phone', 'email', 'address', 'customer_type', 'notes', 'opening_balance', 'status'],
  suppliers: ['name', 'contact_person', 'phone', 'email', 'address', 'notes', 'status'],
  expenses: ['branch_id', 'category', 'description', 'amount', 'payment_method', 'expense_date', 'receipt_file_id'],
  bookings: ['branch_id', 'customer_id', 'customer_name', 'customer_phone', 'service_name', 'staff_user_id', 'starts_at', 'ends_at', 'amount', 'status', 'notes'],
  staff_attendance: ['user_id', 'branch_id', 'attendance_date', 'check_in', 'check_out', 'status', 'notes'],
  invoices: ['customer_id', 'issue_date', 'due_date', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'amount_paid', 'status', 'notes'],
  crm_companies: ['name', 'industry', 'website', 'email', 'phone', 'address', 'annual_revenue', 'employee_count', 'source', 'status'],
  crm_contacts: ['company_id', 'first_name', 'last_name', 'full_name', 'job_title', 'email', 'phone', 'mobile', 'source', 'status', 'tags', 'notes', 'last_contacted_at'],
  crm_pipelines: ['name', 'is_default'],
  crm_pipeline_stages: ['pipeline_id', 'name', 'stage_order', 'probability', 'color', 'is_won', 'is_lost'],
  crm_leads: ['contact_id', 'company_id', 'title', 'source', 'status', 'estimated_value', 'currency', 'probability', 'assigned_to', 'description', 'next_follow_up'],
  crm_deals: ['pipeline_id', 'stage_id', 'contact_id', 'company_id', 'title', 'value', 'currency', 'probability', 'expected_close_date', 'status', 'assigned_to', 'lost_reason'],
  crm_tasks: ['title', 'description', 'related_type', 'related_id', 'assigned_to', 'due_at', 'priority', 'status', 'completed_at'],
  crm_activities: ['type', 'subject', 'description', 'related_type', 'related_id', 'occurred_at', 'duration_minutes', 'outcome']
};

function response(status, body, res) {
  return res.json(body, status);
}

function cleanObject(input, allowed) {
  const output = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
  }
  return output;
}

function number(value, label, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new Error(`${label} must be a valid number.`);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function rowPermissions(teamId, tableId) {
  const readers = tableId === 'businesses' ? ['*'] : (READ_ROLES[tableId] || ['owner', 'admin']);
  const result = readers.includes('*')
    ? [Permission.read(Role.team(teamId))]
    : readers.map(role => Permission.read(Role.team(teamId, role)));
  for (const role of ['owner', 'admin']) {
    result.push(Permission.update(Role.team(teamId, role)));
    result.push(Permission.delete(Role.team(teamId, role)));
  }
  if (['products', 'categories', 'stock_movements'].includes(tableId)) {
    result.push(Permission.update(Role.team(teamId, 'inventory')));
  }
  if (['customers', 'bookings'].includes(tableId)) {
    result.push(Permission.update(Role.team(teamId, 'manager')));
  }
  if (['expenses', 'invoices', 'invoice_items', 'invoice_payments'].includes(tableId)) {
    result.push(Permission.update(Role.team(teamId, 'accountant')));
  }
  if (tableId.startsWith('crm_')) {
    for (const role of (EDIT_ROLES[tableId] || [])) result.push(Permission.update(Role.team(teamId, role)));
  }
  return result;
}

function assertRole(roles, allowed, message = 'Your business role does not permit this action.') {
  if (!roles.some(role => allowed.includes(role))) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
}

function makeRowId() {
  return ID.unique();
}

async function requireBusinessRow(tables, tableId, rowId, teamId, label = 'Record') {
  if (!rowId) return null;
  const record = await tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  if (record.business_id !== teamId) throw new Error(`${label} does not belong to this business.`);
  return record;
}

async function requireTeamMember(teams, teamId, userId, label = 'Team member') {
  if (!userId) return null;
  const page = await teams.listMemberships({
    teamId,
    queries: [Query.equal('userId', userId), Query.limit(5)]
  });
  const member = (page.memberships || []).find(item => item.userId === userId && item.joined);
  if (!member) throw new Error(`${label} must be an active member of this business.`);
  return member;
}

async function main({ req, res, log, error: logError }) {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || 'ethan-business';
  const userJwt = req.headers?.['x-appwrite-user-jwt'];
  const apiKey = req.headers?.['x-appwrite-key'];

  if (!userJwt || !apiKey) {
    return response(401, { ok: false, message: 'Please sign in to continue.' }, res);
  }

  const userClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(userJwt);
  const serviceClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const account = new Account(userClient);
  const teams = new Teams(serviceClient);
  const tables = new TablesDB(serviceClient);

  try {
    const user = await account.get();
    const body = req.bodyJson || {};
    const action = String(body.action || '');
    const teamId = String(body.teamId || '');
    if (!action) return response(400, { ok: false, message: 'Action is required.' }, res);

    if (action === 'list_my_businesses') {
      const myTeams = new Teams(userClient);
      const ownTeamPage = await myTeams.list({ queries: [Query.limit(100)] });
      const items = [];
      for (const t of ownTeamPage.teams || []) {
        try {
          const biz = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'businesses', rowId: t.$id });
          const membershipPage = await teams.listMemberships({ teamId: t.$id, queries: [Query.equal('userId', user.$id)] });
          const membership = (membershipPage.memberships || []).find(m => m.userId === user.$id && m.joined);
          if (membership) items.push({ ...biz, teamId: t.$id, roles: membership.roles || [] });
        } catch (e) {
          if (e.code !== 404) log(`Skipping team ${t.$id}: ${e.message}`);
        }
      }
      return response(200, { ok: true, businesses: items }, res);
    }

    if (!teamId || teamId.length > 36) {
      return response(400, { ok: false, message: 'A valid business workspace is required.' }, res);
    }

    const memberPage = await teams.listMemberships({
      teamId,
      queries: [Query.equal('userId', user.$id), Query.limit(20)]
    });
    const membership = (memberPage.memberships || []).find(m => m.userId === user.$id && m.joined);
    if (!membership) return response(403, { ok: false, message: 'You are not an active member of this business.' }, res);
    const roles = membership.roles || [];

    if (action === 'bootstrap_business') {
      assertRole(roles, ['owner'], 'Only the creator of the business workspace can complete initial setup.');
      const existing = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'businesses', rowId: teamId }).catch(e => {
        if (e.code === 404) return null;
        throw e;
      });
      if (existing) return response(409, { ok: false, message: 'This workspace has already been configured.' }, res);
      const businessName = String(body.businessName || '').trim();
      if (businessName.length < 2 || businessName.length > 160) throw new Error('Enter a business name between 2 and 160 characters.');
      const currency = String(body.currency || 'NGN').toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Choose a valid three-letter currency code.');
      const timezone = String(body.timezone || 'Africa/Lagos');

      const tx = await tables.createTransaction({ ttl: 60 });
      try {
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'businesses', rowId: teamId,
          data: {
            business_name: businessName,
            slug: businessName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || teamId,
            owner_user_id: user.$id,
            email: user.email || '',
            phone: String(body.phone || '').slice(0, 40),
            industry: String(body.industry || 'General business').slice(0, 100),
            currency, timezone,
            address: String(body.address || '').slice(0, 2000),
            status: 'active'
          },
          permissions: rowPermissions(teamId, 'businesses'),
          transactionId: tx.$id
        });
        const branchId = makeRowId();
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'branches', rowId: branchId,
          data: {
            business_id: teamId, team_id: teamId,
            branch_name: String(body.branchName || 'Main Branch').slice(0, 140),
            branch_code: 'MAIN', address: String(body.address || '').slice(0, 2000),
            manager_user_id: user.$id, is_default: true, status: 'active'
          },
          permissions: rowPermissions(teamId, 'branches'),
          transactionId: tx.$id
        });
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'business_members', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, user_id: user.$id,
            email: user.email || '', full_name: user.name || '', role: 'owner', status: 'active'
          },
          permissions: rowPermissions(teamId, 'business_members'),
          transactionId: tx.$id
        });
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'audit_logs', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, actor_user_id: user.$id,
            action: 'BUSINESS CREATED', entity_type: 'business', entity_id: teamId,
            details: JSON.stringify({ businessName }), occurred_at: new Date().toISOString()
          },
          permissions: rowPermissions(teamId, 'audit_logs'),
          transactionId: tx.$id
        });
        await tables.updateTransaction({ transactionId: tx.$id, commit: true });
      } catch (e) {
        await tables.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
        throw e;
      }
      const created = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'businesses', rowId: teamId });
      return response(201, { ok: true, business: created }, res);
    }

    const business = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'businesses', rowId: teamId });
    if (business.status !== 'active') return response(403, { ok: false, message: 'This business workspace is inactive.' }, res);

    if (action === 'get_business') return response(200, { ok: true, business }, res);

    if (action === 'crm_dashboard') {
      assertRole(roles, ['owner', 'admin', 'manager', 'accountant', 'staff']);
      const crmPage = async tableId => tables.listRows({
        databaseId: DATABASE_ID, tableId,
        queries: [Query.equal('business_id', teamId), Query.orderDesc('$createdAt'), Query.limit(100)]
      });
      const [companies, contacts, leads, deals, tasks, activities] = await Promise.all([
        crmPage('crm_companies'), crmPage('crm_contacts'), crmPage('crm_leads'),
        crmPage('crm_deals'), crmPage('crm_tasks'), crmPage('crm_activities')
      ]);
      const dealRows = deals.rows || [];
      const openDeals = dealRows.filter(d => !['won', 'lost', 'closed'].includes(String(d.status || '').toLowerCase()));
      const wonDeals = dealRows.filter(d => String(d.status || '').toLowerCase() === 'won');
      const taskRows = tasks.rows || [];
      const now = Date.now();
      const overdueTasks = taskRows.filter(t => t.status !== 'completed' && t.due_at && new Date(t.due_at).getTime() < now);
      const activeTasks = taskRows.filter(t => t.status !== 'completed');
      const sum = (rows, field) => rows.reduce((n, row) => n + Number(row[field] || 0), 0);
      return response(200, {
        ok: true,
        stats: {
          companies: companies.total || 0, contacts: contacts.total || 0, leads: leads.total || 0,
          openDeals: openDeals.length, pipelineValue: sum(openDeals, 'value'),
          weightedPipeline: openDeals.reduce((n, d) => n + Number(d.value || 0) * Number(d.probability || 0) / 100, 0),
          wonValue: sum(wonDeals, 'value'), activeTasks: activeTasks.length, overdueTasks: overdueTasks.length
        },
        recentActivities: (activities.rows || []).slice(0, 6),
        upcomingTasks: taskRows.filter(t => t.status !== 'completed').slice(0, 6),
        pipelineDeals: openDeals.slice(0, 100)
      }, res);
    }

    if (action === 'dashboard') {
      assertRole(roles, ['owner', 'admin', 'manager', 'accountant', 'cashier', 'inventory', 'staff']);
      const canSeeBusinessFinance = roles.some(role => ['owner', 'admin', 'manager', 'accountant'].includes(role));
      const canSeeSales = canSeeBusinessFinance || roles.includes('cashier');
      const canSeeStock = roles.some(role => ['owner', 'admin', 'manager', 'inventory', 'cashier'].includes(role));
      const tablePage = async tableId => tables.listRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [Query.equal('business_id', teamId), Query.orderDesc('$createdAt'), Query.limit(100)]
      });
      const [sales, products, customers, expenses, invoices, bookings] = await Promise.all([
        canSeeSales ? tablePage('sales') : Promise.resolve({ rows: [], total: 0 }),
        tablePage('products'),
        roles.some(role => ['owner','admin','manager','cashier','accountant','staff'].includes(role)) ? tablePage('customers') : Promise.resolve({ rows: [], total: 0 }),
        canSeeBusinessFinance ? tablePage('expenses') : Promise.resolve({ rows: [], total: 0 }),
        canSeeBusinessFinance ? tablePage('invoices') : Promise.resolve({ rows: [], total: 0 }),
        tablePage('bookings')
      ]);
      const scopedSales = roles.includes('cashier') && !canSeeBusinessFinance
        ? (sales.rows || []).filter(row => row.cashier_user_id === user.$id)
        : (sales.rows || []);
      const scopedBookings = roles.includes('staff') && !roles.some(role => ['owner','admin','manager'].includes(role))
        ? (bookings.rows || []).filter(row => row.staff_user_id === user.$id)
        : (bookings.rows || []);
      const sum = (rows, field) => (rows || []).reduce((total, row) => total + Number(row[field] || 0), 0);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: business.timezone || 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const todaysSales = scopedSales.filter(row => String(row.sold_at || '').slice(0, 10) === today && row.status !== 'void');
      const todayRevenue = sum(todaysSales, 'total_amount');
      const allRevenue = sum(scopedSales.filter(row => row.status !== 'void'), 'total_amount');
      const costOfGoods = scopedSales.filter(row => row.status !== 'void').reduce((n, row) => n + Number(row.cost_total || 0), 0);
      const totalExpenses = canSeeBusinessFinance ? sum(expenses.rows, 'amount') : 0;
      const lowStock = canSeeStock ? (products.rows || []).filter(p => p.track_stock && Number(p.stock_quantity || 0) <= Number(p.reorder_level || 0)) : [];
      const invoiceReceivables = canSeeBusinessFinance ? (invoices.rows || []).filter(i => !['paid', 'cancelled'].includes(i.status)).reduce((n, i) => n + Math.max(0, Number(i.total_amount || 0) - Number(i.amount_paid || 0)), 0) : 0;
      const saleReceivables = canSeeSales ? scopedSales.filter(s => ['partial','unpaid'].includes(s.status)).reduce((n,s) => n + Math.max(0,Number(s.total_amount||0)-Number(s.amount_paid||0)),0) : 0;
      const receivables = invoiceReceivables + saleReceivables;
      return response(200, {
        ok: true,
        stats: {
          todayRevenue: canSeeSales ? todayRevenue : 0,
          allRevenue: canSeeSales ? allRevenue : 0,
          totalExpenses,
          grossProfitEstimate: canSeeBusinessFinance ? allRevenue - costOfGoods : 0,
          salesCount: canSeeSales ? scopedSales.length : 0,
          productCount: products.total || 0,
          customerCount: customers.total || 0,
          invoiceCount: canSeeBusinessFinance ? invoices.total || 0 : 0,
          lowStockCount: lowStock.length,
          receivables: Math.max(0, receivables),
          upcomingBookings: scopedBookings.filter(b => b.starts_at && b.starts_at >= new Date().toISOString() && !['cancelled', 'completed'].includes(b.status)).length
        },
        recentSales: canSeeSales ? scopedSales.slice(0, 6) : [],
        lowStock: lowStock.slice(0, 8)
      }, res);
    }

    if (action === 'list_records') {
      const tableId = String(body.tableId || '');
      if (!TABLES.has(tableId) || !READ_ROLES[tableId]) throw new Error('This record type is not available.');
      assertRole(roles, READ_ROLES[tableId]);
      const queries = [Query.equal('business_id', teamId), Query.orderDesc('$createdAt'), Query.limit(Math.min(100, Math.max(1, Number(body.limit) || 100)))];
      if (body.status) queries.unshift(Query.equal('status', String(body.status)));
      const result = await tables.listRows({ databaseId: DATABASE_ID, tableId, queries });
      let scopedRows = result.rows || [];
      const financeAccess = roles.some(role => ['owner','admin','manager','accountant'].includes(role));
      if (tableId === 'sales' && roles.includes('cashier') && !financeAccess) {
        scopedRows = scopedRows.filter(row => row.cashier_user_id === user.$id);
      }
      if (tableId === 'sale_items' && roles.includes('cashier') && !financeAccess) {
        const ownSales = await tables.listRows({ databaseId: DATABASE_ID, tableId: 'sales', queries: [Query.equal('business_id', teamId), Query.equal('cashier_user_id', user.$id), Query.limit(100)] });
        const ownSaleIds = new Set((ownSales.rows || []).map(row => row.$id));
        scopedRows = scopedRows.filter(row => ownSaleIds.has(row.sale_id));
      }
      if (tableId === 'bookings' && roles.includes('staff') && !roles.some(role => ['owner','admin','manager'].includes(role))) {
        scopedRows = scopedRows.filter(row => row.staff_user_id === user.$id);
      }
      return response(200, { ok: true, records: scopedRows, total: scopedRows.length }, res);
    }

    if (action === 'create_record') {
      const tableId = String(body.tableId || '');
      if (!CREATE_ROLES[tableId] || !FIELDS[tableId]) throw new Error('This record type cannot be created from this screen.');
      assertRole(roles, CREATE_ROLES[tableId]);
      const data = cleanObject(body.data, FIELDS[tableId]);
      if (!Object.keys(data).length) throw new Error('Enter the required record information.');
      if (tableId === 'products') {
        data.cost_price = number(data.cost_price ?? 0, 'Cost price');
        data.selling_price = number(data.selling_price ?? 0, 'Selling price');
        data.stock_quantity = number(data.stock_quantity ?? 0, 'Opening stock');
        data.reorder_level = number(data.reorder_level ?? 0, 'Reorder level');
        if (!data.name) throw new Error('Product name is required.');
        data.track_stock = data.track_stock !== false;
        data.unit = data.unit || 'piece';
        data.status = data.status || 'active';
      }
      if (tableId === 'expenses') {
        data.amount = number(data.amount, 'Expense amount', 0.01);
        data.expense_date = data.expense_date || new Date().toISOString();
        data.payment_method = data.payment_method || 'cash';
      }
      if (tableId === 'customers') {
        data.opening_balance = number(data.opening_balance ?? 0, 'Opening balance');
        data.customer_type = data.customer_type || 'individual';
        data.status = data.status || 'active';
      }
      if (tableId === 'categories' || tableId === 'suppliers') data.status = data.status || 'active';
      if (tableId === 'bookings') {
        if (roles.includes('staff') && !roles.some(role => ['owner','admin','manager'].includes(role))) data.staff_user_id = user.$id;
        if (!data.customer_name || !data.service_name || !data.starts_at || !data.ends_at) throw new Error('Customer, service and booking times are required.');
        if (new Date(data.ends_at) <= new Date(data.starts_at)) throw new Error('The booking end time must be after the start time.');
        data.amount = number(data.amount ?? 0, 'Booking amount');
        data.status = data.status || 'booked';
      }
      if (tableId === 'branches') {
        data.status = data.status || 'active';
        if (data.manager_user_id) await requireTeamMember(teams, teamId, data.manager_user_id, 'Branch manager');
      }
      if (tableId === 'products') {
        if (data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
        if (data.category_id) await requireBusinessRow(tables, 'categories', data.category_id, teamId, 'Category');
      }
      if (tableId === 'customers' && data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
      if (tableId === 'expenses' && data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
      if (tableId === 'bookings') {
        if (data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
        if (data.customer_id) await requireBusinessRow(tables, 'customers', data.customer_id, teamId, 'Customer');
        if (data.staff_user_id) await requireTeamMember(teams, teamId, data.staff_user_id, 'Assigned staff member');
      }
      if (tableId === 'staff_attendance') {
        if (data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
        await requireTeamMember(teams, teamId, data.user_id, 'Attendance user');
      }
      data.business_id = teamId;
      if (!tableId.startsWith('crm_')) data.team_id = teamId;
      if (tableId.startsWith('crm_')) {
        if (['crm_companies', 'crm_contacts', 'crm_leads', 'crm_deals', 'crm_tasks', 'crm_activities'].includes(tableId)) data.owner_user_id = user.$id;
        if (['crm_companies', 'crm_contacts', 'crm_pipelines', 'crm_leads', 'crm_deals', 'crm_tasks', 'crm_activities'].includes(tableId)) data.created_by = user.$id;
        if (tableId === 'crm_contacts') {
          data.full_name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
          if (!data.full_name) throw new Error('Contact name is required.');
          if (data.company_id) await requireBusinessRow(tables, 'crm_companies', data.company_id, teamId, 'Company');
        }
        if (tableId === 'crm_leads') {
          data.currency = String(data.currency || business.currency || 'NGN').toUpperCase();
          if (data.contact_id) await requireBusinessRow(tables, 'crm_contacts', data.contact_id, teamId, 'Contact');
          if (data.company_id) await requireBusinessRow(tables, 'crm_companies', data.company_id, teamId, 'Company');
        }
        if (tableId === 'crm_deals') {
          if (data.contact_id) await requireBusinessRow(tables, 'crm_contacts', data.contact_id, teamId, 'Contact');
          if (data.company_id) await requireBusinessRow(tables, 'crm_companies', data.company_id, teamId, 'Company');
          await requireBusinessRow(tables, 'crm_pipelines', data.pipeline_id, teamId, 'Pipeline');
          const stage = await requireBusinessRow(tables, 'crm_pipeline_stages', data.stage_id, teamId, 'Pipeline stage');
          if (stage.pipeline_id !== data.pipeline_id) throw new Error('Select a stage from the selected pipeline.');
          data.currency = String(data.currency || business.currency || 'NGN').toUpperCase();
        }
        if (tableId === 'crm_pipeline_stages') await requireBusinessRow(tables, 'crm_pipelines', data.pipeline_id, teamId, 'Pipeline');
        if (tableId === 'crm_activities') data.occurred_at = data.occurred_at || new Date().toISOString();
        if (tableId === 'crm_tasks' && data.assigned_to) await requireTeamMember(teams, teamId, data.assigned_to, 'Assigned user');
      }
      if (tableId === 'expenses') data.created_by = user.$id;
      if (tableId === 'staff_attendance' && !roles.includes('owner') && !roles.includes('admin')) data.user_id = user.$id;
      const created = await tables.createRow({
        databaseId: DATABASE_ID, tableId, rowId: makeRowId(), data,
        permissions: rowPermissions(teamId, tableId)
      });
      if (tableId === 'products' && Number(data.stock_quantity) > 0) {
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'stock_movements', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, branch_id: data.branch_id || null,
            product_id: created.$id, movement_type: 'opening_stock', quantity: data.stock_quantity,
            unit_cost: data.cost_price, reference_type: 'product', reference_id: created.$id,
            notes: 'Opening stock balance', created_by: user.$id, occurred_at: new Date().toISOString()
          }, permissions: rowPermissions(teamId, 'stock_movements')
        });
      }
      return response(201, { ok: true, record: created }, res);
    }

    if (action === 'update_record') {
      const tableId = String(body.tableId || '');
      const rowId = String(body.rowId || '');
      if (!EDIT_ROLES[tableId] || !FIELDS[tableId]) throw new Error('This record type cannot be edited from this screen.');
      assertRole(roles, EDIT_ROLES[tableId]);
      if (!rowId) throw new Error('Record identifier is required.');
      const current = await tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
      if (current.business_id !== teamId) return response(404, { ok: false, message: 'Record not found.' }, res);
      const data = cleanObject(body.data, FIELDS[tableId]);
      if (!Object.keys(data).length) throw new Error('No editable changes were supplied.');
      if (data.branch_id) await requireBusinessRow(tables, 'branches', data.branch_id, teamId, 'Branch');
      if (data.category_id) await requireBusinessRow(tables, 'categories', data.category_id, teamId, 'Category');
      if (data.manager_user_id) await requireTeamMember(teams, teamId, data.manager_user_id, 'Branch manager');
      if (tableId.startsWith('crm_')) {
        if (data.company_id) await requireBusinessRow(tables, 'crm_companies', data.company_id, teamId, 'Company');
        if (data.contact_id) await requireBusinessRow(tables, 'crm_contacts', data.contact_id, teamId, 'Contact');
        if (data.pipeline_id) await requireBusinessRow(tables, 'crm_pipelines', data.pipeline_id, teamId, 'Pipeline');
        if (data.stage_id) await requireBusinessRow(tables, 'crm_pipeline_stages', data.stage_id, teamId, 'Pipeline stage');
        if (tableId === 'crm_contacts' && ('first_name' in data || 'last_name' in data)) {
          data.full_name = [data.first_name ?? current.first_name, data.last_name ?? current.last_name].filter(Boolean).join(' ').trim();
        }
        if (tableId === 'crm_tasks' && data.assigned_to) await requireTeamMember(teams, teamId, data.assigned_to, 'Assigned user');
      }
      if (tableId === 'products') {
        if ('cost_price' in data) data.cost_price = number(data.cost_price, 'Cost price');
        if ('selling_price' in data) data.selling_price = number(data.selling_price, 'Selling price');
        if ('reorder_level' in data) data.reorder_level = number(data.reorder_level, 'Reorder level');
        if ('stock_quantity' in data && Number(data.stock_quantity) !== Number(current.stock_quantity)) {
          throw new Error('Use Stock Adjustment to change on-hand quantities so the movement history remains accurate.');
        }
      }
      if (tableId === 'expenses' && 'amount' in data) data.amount = number(data.amount, 'Expense amount', 0.01);
      if (tableId === 'bookings' && 'amount' in data) data.amount = number(data.amount, 'Booking amount');
      const updated = await tables.updateRow({ databaseId: DATABASE_ID, tableId, rowId, data });
      return response(200, { ok: true, record: updated }, res);
    }

    if (action === 'adjust_stock') {
      assertRole(roles, ['owner', 'admin', 'manager', 'inventory']);
      const productId = String(body.productId || '');
      const quantity = number(body.quantity, 'Adjustment quantity', 0.01);
      const direction = body.direction === 'remove' ? -1 : 1;
      const product = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'products', rowId: productId });
      if (product.business_id !== teamId || !product.track_stock) return response(404, { ok: false, message: 'Stock-tracked product not found.' }, res);
      const updatedQty = money(Number(product.stock_quantity || 0) + direction * quantity);
      if (updatedQty < 0) throw new Error('Stock adjustment cannot make available stock negative.');
      const tx = await tables.createTransaction({ ttl: 60 });
      try {
        await tables.updateRow({ databaseId: DATABASE_ID, tableId: 'products', rowId: productId, data: { stock_quantity: updatedQty }, transactionId: tx.$id });
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'stock_movements', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, branch_id: product.branch_id || null,
            product_id: productId, movement_type: direction > 0 ? 'stock_in' : 'stock_out',
            quantity, unit_cost: product.cost_price, reference_type: 'adjustment',
            reference_id: null, notes: String(body.notes || 'Manual stock adjustment').slice(0, 2000),
            created_by: user.$id, occurred_at: new Date().toISOString()
          }, permissions: rowPermissions(teamId, 'stock_movements'), transactionId: tx.$id
        });
        await tables.updateTransaction({ transactionId: tx.$id, commit: true });
      } catch (e) {
        await tables.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
        throw e;
      }
      return response(200, { ok: true, quantity: updatedQty }, res);
    }

    if (action === 'create_sale') {
      assertRole(roles, ['owner', 'admin', 'manager', 'cashier']);
      const inputItems = Array.isArray(body.items) ? body.items : [];
      if (!inputItems.length || inputItems.length > 100) throw new Error('Add at least one item to the sale.');
      if (body.customerId) await requireBusinessRow(tables, 'customers', String(body.customerId), teamId, 'Customer');
      if (body.branchId) await requireBusinessRow(tables, 'branches', String(body.branchId), teamId, 'Branch');
      const lineItems = [];
      for (const item of inputItems) {
        const productId = String(item.productId || '');
        const qty = number(item.quantity, 'Item quantity', 0.0001);
        const product = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'products', rowId: productId });
        if (product.business_id !== teamId || product.status !== 'active') throw new Error('One of the selected products is unavailable. Refresh and try again.');
        if (product.track_stock && qty > Number(product.stock_quantity || 0)) throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}.`);
        const unitPrice = number(product.selling_price, `${product.name} price`);
        const unitCost = number(product.cost_price || 0, `${product.name} cost`);
        lineItems.push({ product, quantity: qty, unitPrice, unitCost, lineTotal: money(qty * unitPrice) });
      }
      const subtotal = money(lineItems.reduce((n, item) => n + item.lineTotal, 0));
      const discount = number(body.discountAmount || 0, 'Discount');
      const tax = number(body.taxAmount || 0, 'Tax');
      if (discount > subtotal) throw new Error('Discount cannot exceed the subtotal.');
      const total = money(subtotal - discount + tax);
      const paid = number(body.amountPaid ?? total, 'Amount received');
      if (paid > total) throw new Error('Amount received cannot exceed the total.');
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      const saleNumber = `SAL-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const tx = await tables.createTransaction({ ttl: 60 });
      let sale;
      try {
        sale = await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'sales', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, branch_id: body.branchId || lineItems[0].product.branch_id || null,
            sale_number: saleNumber, customer_id: body.customerId || null,
            subtotal, discount_amount: discount, tax_amount: tax, total_amount: total, amount_paid: paid,
            payment_method: String(body.paymentMethod || 'cash'), status, cashier_user_id: user.$id,
            notes: String(body.notes || '').slice(0, 2000), sold_at: new Date().toISOString(),
            cost_total: money(lineItems.reduce((n, item) => n + item.quantity * item.unitCost, 0))
          }, permissions: rowPermissions(teamId, 'sales'), transactionId: tx.$id
        });
        for (const item of lineItems) {
          await tables.createRow({
            databaseId: DATABASE_ID, tableId: 'sale_items', rowId: makeRowId(),
            data: {
              business_id: teamId, team_id: teamId, sale_id: sale.$id,
              product_id: item.product.$id, item_name: item.product.name, sku: item.product.sku || null,
              quantity: item.quantity, unit_price: item.unitPrice, unit_cost: item.unitCost,
              discount_amount: 0, line_total: item.lineTotal
            }, permissions: rowPermissions(teamId, 'sale_items'), transactionId: tx.$id
          });
          if (item.product.track_stock) {
            const nextQty = money(Number(item.product.stock_quantity || 0) - item.quantity);
            await tables.updateRow({
              databaseId: DATABASE_ID, tableId: 'products', rowId: item.product.$id,
              data: { stock_quantity: nextQty }, transactionId: tx.$id
            });
            await tables.createRow({
              databaseId: DATABASE_ID, tableId: 'stock_movements', rowId: makeRowId(),
              data: {
                business_id: teamId, team_id: teamId, branch_id: item.product.branch_id || null,
                product_id: item.product.$id, movement_type: 'sale', quantity: item.quantity,
                unit_cost: item.unitCost, reference_type: 'sale', reference_id: sale.$id,
                notes: `Sale ${saleNumber}`, created_by: user.$id, occurred_at: new Date().toISOString()
              }, permissions: rowPermissions(teamId, 'stock_movements'), transactionId: tx.$id
            });
          }
        }
        await tables.updateTransaction({ transactionId: tx.$id, commit: true });
      } catch (e) {
        await tables.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
        throw e;
      }
      return response(201, { ok: true, sale: { ...sale, sale_number: saleNumber, subtotal, total_amount: total, amount_paid: paid, status } }, res);
    }


    if (action === 'create_invoice') {
      assertRole(roles, ['owner', 'admin', 'manager', 'accountant']);
      const customerId = String(body.customerId || '');
      const customer = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'customers', rowId: customerId });
      if (customer.business_id !== teamId) throw new Error('The selected customer does not belong to this business.');
      if (body.branchId) await requireBusinessRow(tables, 'branches', String(body.branchId), teamId, 'Branch');
      const inputItems = Array.isArray(body.items) ? body.items : [];
      if (!inputItems.length || inputItems.length > 100) throw new Error('Add at least one invoice line item.');
      const items = inputItems.map(item => {
        const description = String(item.description || '').trim().slice(0, 180);
        if (!description) throw new Error('Every invoice item needs a description.');
        const quantity = number(item.quantity, 'Invoice quantity', 0.0001);
        const unitPrice = number(item.unitPrice, 'Unit price');
        return { description, quantity, unitPrice, lineTotal: money(quantity * unitPrice) };
      });
      const subtotal = money(items.reduce((n, item) => n + item.lineTotal, 0));
      const discount = number(body.discountAmount || 0, 'Discount');
      const tax = number(body.taxAmount || 0, 'Tax');
      if (discount > subtotal) throw new Error('Discount cannot exceed the subtotal.');
      const total = money(subtotal - discount + tax);
      const now = new Date();
      const invoiceNumber = `INV-${now.toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      const tx = await tables.createTransaction({ ttl: 60 });
      let invoice;
      try {
        invoice = await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'invoices', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, branch_id: body.branchId || null,
            invoice_number: invoiceNumber, customer_id: customerId,
            issue_date: body.issueDate || now.toISOString(), due_date: body.dueDate || null,
            subtotal, discount_amount: discount, tax_amount: tax, total_amount: total,
            amount_paid: 0, status: 'unpaid', notes: String(body.notes || '').slice(0,2000), created_by: user.$id
          }, permissions: rowPermissions(teamId, 'invoices'), transactionId: tx.$id
        });
        for (const item of items) {
          await tables.createRow({
            databaseId: DATABASE_ID, tableId: 'invoice_items', rowId: makeRowId(),
            data: { business_id: teamId, team_id: teamId, invoice_id: invoice.$id, description: item.description, quantity: item.quantity, unit_price: item.unitPrice, line_total: item.lineTotal },
            permissions: rowPermissions(teamId, 'invoice_items'), transactionId: tx.$id
          });
        }
        await tables.updateTransaction({ transactionId: tx.$id, commit: true });
      } catch (e) {
        await tables.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
        throw e;
      }
      return response(201, { ok: true, invoice: { ...invoice, invoice_number: invoiceNumber, subtotal, total_amount: total, status: 'unpaid' } }, res);
    }

    if (action === 'record_invoice_payment') {
      assertRole(roles, ['owner', 'admin', 'manager', 'accountant']);
      const invoiceId = String(body.invoiceId || '');
      const amount = number(body.amount, 'Payment amount', 0.01);
      const invoice = await tables.getRow({ databaseId: DATABASE_ID, tableId: 'invoices', rowId: invoiceId });
      if (invoice.business_id !== teamId) return response(404, { ok: false, message: 'Invoice not found.' }, res);
      const outstanding = money(Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0));
      if (amount > outstanding) throw new Error(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`);
      const paid = money(Number(invoice.amount_paid || 0) + amount);
      const status = paid >= Number(invoice.total_amount) ? 'paid' : 'partial';
      const tx = await tables.createTransaction({ ttl: 60 });
      try {
        await tables.updateRow({ databaseId: DATABASE_ID, tableId: 'invoices', rowId: invoiceId, data: { amount_paid: paid, status }, transactionId: tx.$id });
        await tables.createRow({
          databaseId: DATABASE_ID, tableId: 'invoice_payments', rowId: makeRowId(),
          data: {
            business_id: teamId, team_id: teamId, invoice_id: invoiceId, amount,
            payment_method: String(body.paymentMethod || 'cash'), reference: String(body.reference || '').slice(0,100) || null,
            notes: String(body.notes || '').slice(0,2000), received_by: user.$id, received_at: new Date().toISOString()
          }, permissions: rowPermissions(teamId, 'invoice_payments'), transactionId: tx.$id
        });
        await tables.updateTransaction({ transactionId: tx.$id, commit: true });
      } catch (e) {
        await tables.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
        throw e;
      }
      return response(200, { ok: true, amountPaid: paid, outstanding: money(Number(invoice.total_amount) - paid), status }, res);
    }

    if (action === 'delete_record') {
      const tableId = String(body.tableId || '');
      const rowId = String(body.rowId || '');
      const allowedDelete = ['categories', 'customers', 'suppliers', 'bookings', 'crm_companies', 'crm_contacts', 'crm_leads', 'crm_deals', 'crm_tasks', 'crm_activities', 'crm_pipelines', 'crm_pipeline_stages'];
      if (!allowedDelete.includes(tableId)) throw new Error('This record type cannot be deleted from this screen.');
      assertRole(roles, ['owner', 'admin', 'manager']);
      const current = await tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
      if (current.business_id !== teamId) return response(404, { ok: false, message: 'Record not found.' }, res);
      await tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId });
      return response(200, { ok: true }, res);
    }

    return response(400, { ok: false, message: 'Unknown ETHAN BUSINESS action.' }, res);
  } catch (e) {
    const status = e.status || (e.code === 401 ? 401 : e.code === 403 ? 403 : 400);
    logError(e?.stack || e?.message || String(e));
    return response(status, { ok: false, message: e?.message || 'The request could not be completed.' }, res);
  }
}

export default main;
