# HackTrack

A private meetup tracker for a small hacker/maker community: members, meetups,
projects, and the talks ("updates") given about each project — with derived
engagement signals like *meetups since last talk*.

Built per [`spec.md`](./spec.md) with **Next.js 16 (App Router)**, **Convex**,
**Tailwind CSS v4**, and **Zustand**. UI design (cream / dark-teal palette,
Newsreader serif headings, Inter body, Space Grotesk brand) is modeled on
[malaysian.ai](https://www.malaysian.ai/).

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure and push the Convex backend (creates `.env.local` with
   `NEXT_PUBLIC_CONVEX_URL`):

   ```bash
   npx convex dev --once
   ```

3. Set the shared passwords (server-side only — never `NEXT_PUBLIC_*`):

   ```bash
   npx convex env set ADMIN_PASSWORD <admin password>
   npx convex env set MEMBER_PASSWORD <member password>
   ```

4. Seed demo data (~40 members, ~50 meetups, ~30 projects, ~200 updates):

   ```bash
   npx convex run seed
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

Log in at `/login` with either password. The admin password unlocks full CRUD;
the member password is read-only.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (run `npx convex dev` alongside for live function pushes) |
| `npm run build` | Production build |
| `npm test` | Vitest: metrics unit tests + Convex function tests (auth, cascades) |
| `npm run lint` | ESLint |

## Architecture notes

- **Auth**: shared-password sessions stored in Convex (`sessions` table); every
  query/mutation takes a `token` and re-validates it server-side
  (`convex/lib/session.ts`). Write mutations require an admin session.
- **Metrics**: derived per-member engagement metrics are computed (never
  stored) in `convex/lib/metrics.ts`; `off_record_meetup` is excluded from all
  of them.
- **Live UI**: Convex subscriptions — a write in one tab appears in others
  without refresh.
- **Theme**: semantic Tailwind v4 tokens in `src/app/globals.css`, class-based
  dark mode defaulting to the OS preference.
