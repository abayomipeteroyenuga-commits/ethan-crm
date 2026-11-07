# ETHAN INVOICE

**BILL. TRACK. GET PAID.**

ETHAN INVOICE is an installable invoicing workspace for businesses using the ETHAN BUSINESS ecosystem.

## Features
- Appwrite account sign-in and business workspace selection
- Invoice creation with multiple items, due dates, discounts and configurable tax
- Product and customer lookup from ETHAN BUSINESS
- Paid, partially paid, unpaid and overdue tracking
- Partial/full payment recording and payment history
- Invoice printing and PDF export through the browser print dialog
- WhatsApp payment reminders and invoice summary copy
- Customer management, receivables dashboard and CSV export
- Responsive desktop/mobile Progressive Web App

## Stack
- Vite
- Appwrite Web SDK 18
- Existing Appwrite project: `ethan-business`
- Existing database: `ethan_business_db`
- Existing functions: `ethan-business-api`, `ethan-business-onboarding`

## Deploy
Vercel project root: `ethan-invoice`
Build command: `npm run build`
Output directory: `dist`

This app uses existing Appwrite invoice tables and backend actions. It does not seed sample invoices or change existing ETHAN BUSINESS records.
