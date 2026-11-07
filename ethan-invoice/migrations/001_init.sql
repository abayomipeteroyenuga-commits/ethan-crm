-- ETHAN INVOICE — Neon Postgres initial schema
-- Tenant data is scoped by business_id. Access is enforced by /api/invoices
-- after Appwrite user and team membership validation.

CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id text NOT NULL,
  team_id text NOT NULL,
  branch_id text,
  invoice_number varchar(60) NOT NULL,
  customer_id text NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz,
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status varchar(24) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_paid_not_over_total CHECK (amount_paid <= total_amount),
  CONSTRAINT invoices_business_number_unique UNIQUE (business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id text NOT NULL,
  team_id text NOT NULL,
  invoice_id text NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description varchar(180) NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id text NOT NULL,
  team_id text NOT NULL,
  invoice_id text NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method varchar(32) NOT NULL,
  reference varchar(100),
  notes text,
  received_by text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_business_created_idx ON public.invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_business_customer_idx ON public.invoices (business_id, customer_id);
CREATE INDEX IF NOT EXISTS invoices_business_status_due_idx ON public.invoices (business_id, status, due_date);
CREATE INDEX IF NOT EXISTS invoice_items_business_invoice_idx ON public.invoice_items (business_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_business_invoice_idx ON public.invoice_payments (business_id, invoice_id, received_at DESC);
