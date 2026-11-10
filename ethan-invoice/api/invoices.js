import { Account, Client, Functions, TablesDB } from 'node-appwrite';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { randomBytes } from 'node:crypto';

const DATABASE_ID = 'ethan_business_db';
const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'ethan-business';
const READ_ROLES = ['owner', 'admin', 'manager', 'accountant'];
const WRITE_ROLES = ['owner', 'admin', 'manager', 'accountant'];

let pool;
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('Neon database connection is not configured.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      ssl: { rejectUnauthorized: true }
    });
    attachDatabasePool(pool);
  }
  return pool;
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}
function readHeader(req, key) {
  return req.headers?.[key] ?? req.headers?.[key.toLowerCase()];
}
function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function amount(value, label, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new Error(label + ' must be a valid amount.');
  return roundMoney(n);
}
function mapRow(row) {
  return { ...row, $id: row.id, $createdAt: row.created_at, $updatedAt: row.updated_at };
}
function mapInvoice(row) {
  return mapRow({
    ...row,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    tax_amount: Number(row.tax_amount),
    total_amount: Number(row.total_amount),
    amount_paid: Number(row.amount_paid)
  });
}
function mapItem(row) {
  return mapRow({
    ...row,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total)
  });
}
function mapPayment(row) {
  return mapRow({ ...row, amount: Number(row.amount) });
}
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function authenticatedWorkspace(req, teamId) {
  const auth = String(readHeader(req, 'authorization') || '').replace(/^Bearer\\s+/i, '').trim();
  if (!auth) fail('Please sign in to continue.', 401);

  const userClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setJWT(auth);
  const account = new Account(userClient);
  const functions = new Functions(userClient);
  const tables = new TablesDB(userClient);
  const user = await account.get();
  if (String(user.email || '').trim().toLowerCase() !== 'abayomipeteroyenuga@gmail.com') {
    fail('ETHAN INVOICE is restricted to the authorised administrator.', 403);
  }

  if (!teamId || String(teamId).length > 36) fail('A valid business workspace is required.');

  // Ask the existing, server-authorized Ethan Business API to verify the caller's
  // active team membership and exact business roles. This API uses its own scoped
  // Appwrite execution key; no privileged Appwrite key is exposed to Vercel.
  const execution = await functions.createExecution({
    functionId: 'ethan-business-api',
    body: JSON.stringify({ action: 'list_my_businesses' }),
    async: false
  });
  if (Number(execution.responseStatusCode || 500) >= 400) {
    fail('Your Ethan business membership could not be verified. Please sign in again.', 403);
  }
  let membershipResponse = {};
  try {
    membershipResponse = JSON.parse(execution.responseBody || '{}');
  } catch {
    fail('The business membership service returned an invalid response.', 502);
  }
  const business = (membershipResponse.businesses || []).find(
    item => String(item.teamId || item.$id) === String(teamId)
  );
  if (!membershipResponse.ok || !business || business.status !== 'active') {
    fail('You are not an active member of this business.', 403);
  }
  const roles = Array.isArray(business.roles) ? business.roles : [];
  if (!roles.length) fail('Your active business role could not be verified.', 403);

  return { user, userClient, tables, business, roles, teamId: String(teamId) };
}

async function ensureCustomer(ctx, customerId) {
  if (!customerId) fail('Choose a customer before creating the invoice.');
  const customer = await ctx.tables.getRow({
    databaseId: DATABASE_ID,
    tableId: 'customers',
    rowId: String(customerId)
  }).catch(() => null);
  if (!customer || customer.business_id !== ctx.teamId || customer.status === 'inactive') {
    fail('The selected customer does not belong to this business or is inactive.', 400);
  }
  return customer;
}

async function listRecords(ctx, tableId) {
  const p = getPool();
  const limit = 500;
  if (tableId === 'invoices') {
    const result = await p.query(
      'SELECT * FROM public.invoices WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2',
      [ctx.teamId, limit]
    );
    return result.rows.map(mapInvoice);
  }
  if (tableId === 'invoice_items') {
    const result = await p.query(
      'SELECT * FROM public.invoice_items WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2',
      [ctx.teamId, limit]
    );
    return result.rows.map(mapItem);
  }
  if (tableId === 'invoice_payments') {
    const result = await p.query(
      'SELECT * FROM public.invoice_payments WHERE business_id = $1 ORDER BY received_at DESC LIMIT $2',
      [ctx.teamId, limit]
    );
    return result.rows.map(mapPayment);
  }
  fail('This record type is not available from ETHAN INVOICE.');
}

async function createInvoice(ctx, body) {
  if (!WRITE_ROLES.some(role => ctx.roles.includes(role))) fail('Your business role cannot create invoices.', 403);
  await ensureCustomer(ctx, body.customerId);

  if (body.branchId) {
    await ctx.tables.getRow({ databaseId: DATABASE_ID, tableId: 'branches', rowId: String(body.branchId) })
      .then(row => { if (row.business_id !== ctx.teamId) fail('The selected branch does not belong to this business.'); })
      .catch(error => { if (error.status) throw error; fail('The selected branch could not be verified.'); });
  }

  const inputItems = Array.isArray(body.items) ? body.items : [];
  if (!inputItems.length || inputItems.length > 100) fail('Add at least one invoice line item.');
  const items = inputItems.map((item, index) => {
    const description = String(item.description || '').trim().slice(0, 180);
    if (!description) fail('Invoice item ' + (index + 1) + ' needs a description.');
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) fail('Invoice item quantities must be greater than zero.');
    const unitPrice = amount(item.unitPrice, 'Unit price');
    return { description, quantity, unitPrice, lineTotal: roundMoney(quantity * unitPrice) };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = amount(body.discountAmount || 0, 'Discount');
  const tax = amount(body.taxAmount || 0, 'Tax');
  if (discount > subtotal) fail('Discount cannot exceed the subtotal.');
  const total = roundMoney(subtotal - discount + tax);
  if (total < 0) fail('Invoice total cannot be negative.');

  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (Number.isNaN(issueDate.getTime())) fail('Enter a valid invoice date.');
  if (dueDate && Number.isNaN(dueDate.getTime())) fail('Enter a valid due date.');
  if (dueDate && dueDate < issueDate) fail('Due date cannot be earlier than the invoice date.');

  const datePart = issueDate.toISOString().slice(0, 10).replaceAll('-', '');
  const invoiceNumber = 'INV-' + datePart + '-' + randomBytes(3).toString('hex').toUpperCase();
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO public.invoices
       (business_id, team_id, branch_id, invoice_number, customer_id, issue_date, due_date,
        subtotal, discount_amount, tax_amount, total_amount, amount_paid, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,'unpaid',$12,$13)
       RETURNING *`,
      [ctx.teamId, ctx.teamId, body.branchId || null, invoiceNumber, String(body.customerId),
       issueDate.toISOString(), dueDate?.toISOString() || null, subtotal, discount, tax,
       total, String(body.notes || '').slice(0, 2000) || null, ctx.user.$id]
    );
    const invoice = inserted.rows[0];
    for (const item of items) {
      await client.query(
        `INSERT INTO public.invoice_items (business_id, team_id, invoice_id, description, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ctx.teamId, ctx.teamId, invoice.id, item.description, item.quantity, item.unitPrice, item.lineTotal]
      );
    }
    await client.query('COMMIT');
    return mapInvoice(invoice);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') fail('This invoice number already exists. Please try again.');
    throw error;
  } finally {
    client.release();
  }
}

async function recordPayment(ctx, body) {
  if (!WRITE_ROLES.some(role => ctx.roles.includes(role))) fail('Your business role cannot record invoice payments.', 403);
  const invoiceId = String(body.invoiceId || '');
  if (!invoiceId) fail('Invoice identifier is required.');
  const paymentAmount = amount(body.amount, 'Payment amount', 0.01);
  const method = String(body.paymentMethod || 'cash').slice(0, 32);
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT * FROM public.invoices WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [invoiceId, ctx.teamId]
    );
    const invoice = found.rows[0];
    if (!invoice) fail('Invoice not found.', 404);
    const balance = roundMoney(Number(invoice.total_amount) - Number(invoice.amount_paid));
    if (paymentAmount > balance) fail('Payment exceeds the outstanding balance of ' + balance.toFixed(2) + '.');
    const paid = roundMoney(Number(invoice.amount_paid) + paymentAmount);
    const status = paid >= Number(invoice.total_amount) ? 'paid' : 'partial';
    await client.query(
      'UPDATE public.invoices SET amount_paid = $1, status = $2, updated_at = now() WHERE id = $3 AND business_id = $4',
      [paid, status, invoiceId, ctx.teamId]
    );
    const payment = await client.query(
      `INSERT INTO public.invoice_payments
       (business_id, team_id, invoice_id, amount, payment_method, reference, notes, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ctx.teamId, ctx.teamId, invoiceId, paymentAmount, method,
       String(body.reference || '').slice(0, 100) || null,
       String(body.notes || '').slice(0, 2000) || null, ctx.user.$id]
    );
    await client.query('COMMIT');
    return { amountPaid: paid, outstanding: roundMoney(Number(invoice.total_amount) - paid), status, payment: mapPayment(payment.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  if (req.method === 'GET') {
    try {
      const check = await getPool().query('SELECT current_database() AS database_name, 1 AS healthy');
      return json(res, 200, { ok: true, service: 'ETHAN INVOICE API', database: check.rows[0].database_name });
    } catch (error) {
      console.error('ETHAN INVOICE health check failed:', error);
      return json(res, 503, { ok: false, message: 'Invoice database is unavailable.' });
    }
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(body.action || '');
    const teamId = String(body.teamId || '');
    if (!action) fail('Action is required.');
    const ctx = await authenticatedWorkspace(req, teamId);
    if (!READ_ROLES.some(role => ctx.roles.includes(role))) fail('Your business role cannot access invoices.', 403);

    if (action === 'list_records') {
      const tableId = String(body.tableId || '');
      const records = await listRecords(ctx, tableId);
      return json(res, 200, { ok: true, records, total: records.length });
    }
    if (action === 'create_invoice') {
      const invoice = await createInvoice(ctx, body);
      return json(res, 201, { ok: true, invoice });
    }
    if (action === 'record_invoice_payment') {
      const result = await recordPayment(ctx, body);
      return json(res, 200, { ok: true, ...result });
    }
    fail('Unknown ETHAN INVOICE action.');
  } catch (error) {
    console.error('ETHAN INVOICE API error:', error);
    return json(res, error.status || 500, {
      ok: false,
      message: error.status ? error.message : 'The invoice service could not complete the request.'
    });
  }
}
