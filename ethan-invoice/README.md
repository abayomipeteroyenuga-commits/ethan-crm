# ETHAN INVOICE

**BILL. TRACK. GET PAID.**

ETHAN INVOICE is an installable invoicing workspace for businesses using the ETHAN ecosystem.

## Features
- Appwrite sign-in and Ethan business-workspace access
- Invoice creation with multiple items, due dates, discounts and configurable tax
- Shared customer and product catalogues from ETHAN BUSINESS
- Paid, partially paid, unpaid and overdue tracking
- Partial/full payment recording and payment history
- Invoice printing and PDF export through the browser print dialog
- WhatsApp payment reminders and invoice summary copy
- Customer management, receivables dashboard and CSV export
- Responsive desktop/mobile Progressive Web App

## Architecture

- **Frontend:** Vite, hosted on Vercel.
- **Invoice database:** Neon Postgres project `ETHAN INVOICE`, database `ethan_invoice`.
- **Authentication and business membership:** existing Appwrite project `ethan-business`.
- **Shared customers/products:** existing ETHAN BUSINESS API and catalogue.
- **Invoice API:** Vercel Node.js function at `/api/invoices`.
- **Connection:** `DATABASE_URL` is a sensitive Vercel environment variable. It must never be exposed to the browser.

Invoice records (`invoices`, `invoice_items`, `invoice_payments`) are tenant-scoped by `business_id` and are read/written only by the server API after the caller's Appwrite account, business row and team membership are validated. Do not add direct browser access to Neon.

## Neon schema

The live database tables are:
- `public.invoices`
- `public.invoice_items`
- `public.invoice_payments`

Schema changes should be kept in versioned SQL migration files and tested against a Neon branch before production.

## Deploy

Vercel project root: `ethan-invoice`
Build command: `npm run build`
Output directory: `dist`

Required environment variables:
- `DATABASE_URL` — Neon pooled connection string (sensitive)
- `APPWRITE_ENDPOINT` — Appwrite region endpoint
- `APPWRITE_PROJECT_ID` — `ethan-business`

Existing Appwrite authentication and the ETHAN BUSINESS catalogue remain the shared systems of record. This app does not seed demo invoices or modify unrelated ETHAN BUSINESS data.
