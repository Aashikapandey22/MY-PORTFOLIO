# My personal internet world

Aashika Pandey's Y2K-inspired portfolio, kept as a plain HTML/CSS/vanilla-JavaScript frontend and extended with an optional Node/Express + Supabase backend.

## Frontend-only preview

The public pages still work without a database:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. The project archive shows an honest empty state and the contact form explains that the backend is not configured.

## Full-stack local setup

Prerequisites: Node.js 20+ and a Supabase project.

```bash
npm install
cp .env.example .env
npm start
```

The Express server serves the existing frontend and API from `http://localhost:4173`.

Required environment variables:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — the service-role key is server-only and must never be put in frontend code.
- `ADMIN_USER_IDS` — comma-separated UUIDs of Supabase Auth users allowed to use `/admin`.
- `PUBLIC_ORIGIN` — the exact public frontend/server origin used by CORS.
- `RESEND_API_KEY`, `CONTACT_NOTIFICATION_TO`, and `CONTACT_NOTIFICATION_FROM` — optional Resend notification settings. Messages are still stored if notification delivery is unavailable.

Never commit `.env`; `.gitignore` excludes it. `.env.example` contains placeholders only.

## Supabase database setup

1. Create a Supabase project and enable Email/password Auth.
2. In the Supabase SQL editor, run [`migrations/001_initial.sql`](migrations/001_initial.sql).
3. Create the first administrator in Supabase Auth. Copy that user's UUID into `ADMIN_USER_IDS` and insert it into `public.admin_users`:

```sql
insert into public.admin_users (user_id) values ('AUTH_USER_UUID');
```

The backend checks `ADMIN_USER_IDS` on every protected request, while Supabase RLS policies use `public.is_admin()` for database authorization. Anonymous users can only receive published projects through the API and cannot read messages or modify projects.

## Backend features

- `GET /api/projects` — published projects with pagination.
- `GET /api/projects/:slugOrId` — one published project.
- `POST /api/messages` — server-validated, rate-limited contact submission with honeypot and timing checks.
- `/admin` — authenticated project management and contact inbox.
- Admin project create, edit, publish/unpublish, reorder, and delete.
- Admin message listing, details, read, and archive status.
- Helmet security headers, restrictive CORS, JSON body limits, generic public errors, and separate login/message rate limits.

The public project page uses API records when available and preserves the existing empty state when the database is unavailable. The contact page does not claim email delivery unless Resend is configured; a successful database save remains successful if notification delivery fails.

## Tests

```bash
npm test
```

The included tests cover project/message validation and public-project field filtering. Full API, RLS, Auth, persistence, and email tests require installed dependencies plus a configured Supabase/Resend environment and should be run against a non-production project.

## Existing design

The loader, numbered intro, curtain pull-string reveal, navigation, About page, profile photo, Skills.EXE marquee, social URLs, desktop interactions, theme toggle, scroll reveals, progress indicator, and back-to-top control remain in the existing frontend files.
