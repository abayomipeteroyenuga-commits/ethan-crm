# ETHAN CRM

**Manage. Connect. Grow.**

ETHAN CRM is a responsive customer relationship management app and installable PWA for managing companies, contacts, leads, sales opportunities, tasks and follow-ups. It is branded for Ethan Digital Academy and ALLON-MAADIAH INTERNATIONAL LIMITED.

## Included modules

- Business overview dashboard
- Companies and contacts
- Lead tracking and lead sources
- Sales pipeline, deal values and stages
- Tasks and follow-up reminders
- Customer activity history
- Appwrite sign-in, registration and business workspaces
- Installable Progressive Web App (PWA)

## Project files

Keep this structure at the root of the Git repository:

```text
api/                 Vercel serverless API routes
public/              PWA icon, manifest and service worker
src/                 Appwrite CRM and onboarding logic
app.js               Browser application
app.css              Application styles
index.html           Application entry point
package.json         Project dependencies and build command
vercel.json          Vercel function and asset configuration
```

## Backend configuration

This build uses the existing Appwrite project and database so it does not require a new Appwrite project. CRM records are kept in separate `crm_*` tables and the existing ETHAN BUSINESS interface is not replaced.

Appwrite project: `ethan-business`

Database: `ethan_business_db`

CRM tables required:

- `crm_companies`
- `crm_contacts`
- `crm_pipelines`
- `crm_pipeline_stages`
- `crm_leads`
- `crm_deals`
- `crm_tasks`
- `crm_activities`

The Appwrite Web platform must allow the hostname `crm.ethandigitalacademy.org`.

## Upload to GitHub

1. Download and extract this ZIP on your computer.
2. Create or open the GitHub repository you want to use for ETHAN CRM.
3. Upload the **contents** of the extracted folder to the repository root. Do not upload the ZIP as one file, and do not leave all files inside an extra nested `ethan-crm/` folder.
4. Confirm that `index.html`, `package.json`, `api/`, `src/` and `public/` are visible at the repository root.
5. Commit the files to the repository's default branch.

## Connect the Git repository to Vercel

1. In Vercel, import the ETHAN CRM Git repository. Prefer the existing Vercel project named `ethan-crm` if that is the project you have already configured.
2. Set the project root directory to `./`.
3. Use the Vite framework preset, build command `npm run build`, and output directory `dist`.
4. Use Node.js 22 or newer.
5. Confirm the environment variables below are set for the environments you will deploy (Production, and Preview if you are testing preview deployments).
6. Deploy and check the Vercel build logs before attaching or testing the custom domain.

## Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. The API key must be server-side only; never add it to `app.js`, commit it to Git, or expose it as a `VITE_` variable.

```env
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=ethan-business
APPWRITE_DATABASE_ID=ethan_business_db
APPWRITE_API_KEY=YOUR_SERVER_ONLY_APPWRITE_KEY
```

If you use the already configured `ethan-crm` Vercel project, check that its existing server-side `APPWRITE_API_KEY` is still present rather than creating or exposing another key.

## Connect the custom domain

After a successful deployment, open **Vercel → Project → Settings → Domains** and add:

`crm.ethandigitalacademy.org`

Use the exact DNS record and target displayed by Vercel for this project. DNS targets can vary by domain/project configuration, so do not substitute a guessed value. Keep the Appwrite Web platform hostname aligned with the domain.

## Build locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run build
```

Vercel should build the frontend into `dist` and deploy the `api/` serverless functions.

## Security and release checks

- Browser users authenticate with Appwrite and pass a short-lived Appwrite JWT to the Vercel API routes.
- The Appwrite API key is read only by server-side Vercel functions.
- CRM requests require active Appwrite Team membership in the selected business workspace.
- CRM records are scoped by business workspace, and role-based permissions are applied by the API.
- Do not consider the app production-ready until you test registration, sign-in, workspace creation, and create/edit/delete flows for CRM records.
