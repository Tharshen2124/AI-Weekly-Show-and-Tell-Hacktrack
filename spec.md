# Build Spec — Community Meetup Tracker (HackTrack v3)

> **Audience:** a coding agent building this project from scratch in an empty repo.
> **Provenance:** this is a rebuild of `hacktrackmmu-frontend-v2` (Next.js Pages Router + Rails API).
> Same product, same domain, modernized stack, **no onboarding feature**, and the backend is now
> owned by this project instead of an external Rails service.

---

## 1. What this product is

A private dashboard for a small hacker/maker community. Members give talks about their projects at
recurring meetups. The app records who is in the community, which meetups happened, what projects
exist, and what was said about each project at each meetup — then surfaces derived engagement
signals (how long someone has been active, how long since they last spoke).

There are exactly **four entities**: Member, Meetup, Project, Update. Every screen is a view over
those four.

Access is gated by a **single shared password** (two passwords: one admin, one member). There are no
per-user accounts. Everyone who knows the member password can read; everyone who knows the admin
password can write.

### 1.1 Goals

- Full CRUD over Members, Meetups, Projects, Updates for admins.
- Read-only browsing for non-admins.
- Fast, live-updating UI — a write in one tab reflects in another without a manual refresh.
- Cheap to run: no always-on server, no per-seat billing.
- Mobile-usable (the community checks it on phones during meetups).

### 1.2 Non-goals — do not build these

- **Onboarding.** The source project had an `/onboarding` page with a prospective-member pipeline
  (registered → contacted → first talk given), a table with inline edit, bulk status filtering, and
  delete-member modals. **None of it is in scope.** Do not create the route, the nav entry, or the
  components.
- Per-user accounts, sign-up, password reset, OAuth.
- Email/Discord notifications.
- File uploads or member avatars.
- Public (unauthenticated) views. Everything except the landing page and login requires a token.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15+, App Router** | React 19, TypeScript strict. Not Pages Router. |
| Styling | **Tailwind CSS v4** | CSS-first config (`@theme` in `globals.css`), no `tailwind.config.ts`. |
| Backend + DB | **Convex** | Schema, queries, mutations, actions, and crons all live in `convex/`. |
| Data fetching | **`convex/react`** (`useQuery` / `useMutation`) | Replaces SWR entirely. Do **not** add SWR, React Query, or axios. |
| Client state | **Zustand** | Auth/session state only. Everything else is server state via Convex. |
| Icons | **lucide-react** | |
| Animation | **motion** (successor to framer-motion) | Landing page + modal transitions only. Keep it light. |
| Dates | **dayjs** | |
| Validation | **Convex validators (`v.*`)** server-side; **Zod** for form input client-side | |
| Cookies | **js-cookie** | Session token + admin flag. |
| Hosting | Vercel (frontend) + Convex Cloud (backend) | Both have usable free tiers. |

### 2.1 On Cloudflare Workers

Convex functions **are** the backend — they run on Convex's own infrastructure, are callable directly
from the React client with live subscriptions, and need no separate HTTP layer. Adding a Worker in
front would mean giving up reactivity and hand-rolling the transport. So: **do not build a Worker for
normal CRUD.**

Reserve Workers for the two things Convex functions can't do well from the browser:

- a public, unauthenticated HTTP endpoint (e.g. a future signup webhook), and
- scheduled jobs that must run on a non-Convex schedule.

If either becomes necessary, the Worker calls Convex via `ConvexHttpClient` with a server-side deploy
key. Nothing in this spec requires one on day 1. (Convex crons cover scheduled work; see §5.7.)

---

## 3. Domain model

All IDs are Convex `Id<"table">`. All timestamps are epoch milliseconds (`v.number()`) unless the
field is a calendar date, in which case it's an ISO `YYYY-MM-DD` string — meetup dates are calendar
dates and must not shift across timezones.

### 3.1 `members`

```ts
members: defineTable({
  name: v.string(),
  email: v.string(),
  contactNumber: v.optional(v.string()),
  discordTag: v.optional(v.string()),
  status: v.union(
    v.literal("registered"),
    v.literal("contacted"),
    v.literal("first_talk_given"),
    v.literal("never_active"),
    v.literal("active"),
    v.literal("socially_active"),
    v.literal("was_active"),
    v.literal("was_socially_active"),
    v.literal("terminated"),
    v.literal("duplicate"),
  ),
  comment: v.optional(v.string()),
  registerDate: v.string(),      // YYYY-MM-DD
  active: v.boolean(),           // convenience flag; true for active | socially_active
})
  .index("by_status", ["status"])
  .index("by_name", ["name"])
  .searchIndex("search_name", { searchField: "name", filterFields: ["status"] })
```

Status display labels (UI must show these, never the raw snake_case):

| value | label |
|---|---|
| `registered` | Registered |
| `contacted` | Contacted |
| `first_talk_given` | First Talk Given |
| `never_active` | Never Active |
| `active` | Active |
| `socially_active` | Socially Active |
| `was_active` | Was Active |
| `was_socially_active` | Was Socially Active |
| `terminated` | Terminated |
| `duplicate` | Duplicate |

> The first three statuses are vestigial pipeline states. Keep them as valid values (existing data
> uses them, and an admin may set one manually) but build **no** workflow UI around them.

### 3.2 `meetups`

```ts
meetups: defineTable({
  date: v.string(),              // YYYY-MM-DD
  category: v.union(
    v.literal("regular_meetup"),
    v.literal("hackathon"),
    v.literal("off_record_meetup"),
  ),
  number: v.number(),            // sequence number, independent per category
  hostId: v.optional(v.id("members")),
})
  .index("by_category_and_date", ["category", "date"])
  .index("by_date", ["date"])
```

**Numbering rule:** regular meetups and hackathons each maintain their own independent counter.
Meetup #47 and Hackathon #12 can coexist. When an admin opens the "New Meetup" form, the number field
must pre-fill with `max(number for that category) + 1`, and must **re-pre-fill when the category
radio changes**. The number stays editable (the source project allowed backfilling gaps).

`off_record_meetup` meetups exist in the data but are excluded from meetup listings and from all
derived metrics. They are only reachable by direct link.

### 3.3 `projects`

```ts
projects: defineTable({
  name: v.string(),
  category: v.union(
    v.literal("project"),
    v.literal("mini_project"),
    v.literal("group_project"),
  ),
  completed: v.boolean(),
})
  .index("by_name", ["name"])

projectMembers: defineTable({          // many-to-many join
  projectId: v.id("projects"),
  memberId: v.id("members"),
})
  .index("by_project", ["projectId"])
  .index("by_member", ["memberId"])
  .index("by_project_and_member", ["projectId", "memberId"])
```

A project has **one or more** members (`group_project` is the multi-member case, but the join table
handles all categories uniformly). Creating a project with zero members is a validation error.

### 3.4 `updates`

An Update is "member M talked about project P at meetup T". This is the core record.

```ts
updates: defineTable({
  meetupId: v.id("meetups"),
  projectId: v.id("projects"),
  memberId: v.id("members"),
  category: v.union(v.literal("idea_talk"), v.literal("progress_talk")),
  description: v.string(),
})
  .index("by_meetup", ["meetupId"])
  .index("by_member", ["memberId"])
  .index("by_project", ["projectId"])
  .index("by_member_and_meetup", ["memberId", "meetupId"])
```

Constraint: the selected project must be one the selected member belongs to. Enforce server-side in
the mutation, and enforce client-side by filtering the project dropdown to the chosen member's
projects (the project select stays disabled until a member is chosen).

### 3.5 `sessions`

```ts
sessions: defineTable({
  token: v.string(),             // crypto-random, 32 bytes hex
  isAdmin: v.boolean(),
  expiresAt: v.number(),         // epoch ms
})
  .index("by_token", ["token"])
```

### 3.6 Derived member metrics — compute these, don't store them

The source project's API returned these on each member and every card displays them. There is no
backend computing them anymore, so **this project must compute them**. Define them in a shared helper
(`convex/lib/metrics.ts`) and return them from the member queries. Definitions:

- **`progressTalkCount`** — number of that member's updates with `category === "progress_talk"`.
- **`ideaTalkCount`** — same for `idea_talk`.
- **`totalUpdates`** — sum of the member's updates across all their projects.
- **`durationActive`** — human string ("1 year 3 months", "4 months", "New") measured from the
  earlier of `registerDate` and the member's first update's meetup date, to today. Return `"New"` if
  under one month.
- **`avgTimeBetweenTalks`** — average gap, in days, between consecutive updates by that member
  ordered by meetup date, rendered as a human string ("~35 days"). Return `null` when the member has
  fewer than 2 updates; the UI shows `N/A` (see §7.5, `NullTextIndicator`).
- **`meetupsSinceLastTalk`** — count of `regular_meetup` meetups whose date is strictly after the
  member's most recent update's meetup date. If the member has no updates, this is the count of
  regular meetups since their `registerDate`. This is the community's "who's gone quiet" signal, so
  it must be correct — write unit tests for it.

`off_record_meetup` is excluded from every metric above.

---

## 4. Auth

Shared-password model, carried over deliberately. No accounts.

### 4.1 Flow

1. `/login` posts the password to the `auth.login` Convex mutation.
2. The mutation compares it against `ADMIN_PASSWORD` and `MEMBER_PASSWORD` (Convex environment
   variables, never `NEXT_PUBLIC_*` — the source project leaked both passwords into the client
   bundle; **do not repeat that**).
3. On match, it inserts a `sessions` row with a random token, `isAdmin` set accordingly, and
   `expiresAt` = now + 30 days if "Remember me" was checked, else now + 12 hours.
4. It returns `{ token, isAdmin, expiresAt }`.
5. The client stores the token in a cookie (`token`), plus `isAdmin` and `validUntil` cookies for
   optimistic UI, and mirrors all three into the Zustand store.
6. Every subsequent query/mutation takes `token` as its first argument. A shared
   `requireSession(ctx, token)` helper resolves it, rejects expired/unknown tokens, and returns
   `{ isAdmin }`. A `requireAdmin` wrapper additionally rejects non-admins.
7. `auth.logout` deletes the session row; the client clears cookies and redirects to `/login`.

### 4.2 Rules the agent must not get wrong

- **Every write mutation calls `requireAdmin`.** Hiding a button is not authorization. Assume a
  non-admin will call the mutation directly.
- Passwords are compared with a constant-time comparison, and only ever inside Convex functions.
- Client-side route protection is UX, not security: a layout-level guard redirects to `/login` when
  the token cookie is absent, and the server still validates on every call.
- Cookies are read only after mount (see §7.1 hydration rule).
- A Convex cron (§5.7) deletes expired sessions daily.

---

## 5. Backend function surface (`convex/`)

Naming: `convex/<entity>.ts`, exporting `list`, `get`, `create`, `update`, `remove`. Every function
takes `token: v.string()` as its first arg.

### 5.1 `auth.ts`
- `login({ password, rememberMe })` → `{ token, isAdmin, expiresAt }` | throws `"Invalid password"`.
- `logout({ token })` → `null`.
- `check({ token })` → `{ valid: boolean, isAdmin: boolean }`. Used to validate a restored cookie on
  app load.

### 5.2 `members.ts`
- `list({ token, statuses?, sortBy?, page?, pageSize? })` → `{ data: MemberWithMetrics[], totalPages, total }`.
  - `statuses`: array of status literals. Default `["active", "socially_active"]`.
  - `sortBy`: `"recent_talks"` (default — most recently active first) | `"name_asc"` | `"name_desc"` |
    `"longest_silent"` (highest `meetupsSinceLastTalk` first) | `"most_talks"`.
  - Page size 24.
- `search({ token, query })` → `MemberWithMetrics[]`, via the search index, capped at 50, no
  pagination.
- `get({ token, id })` → member + metrics + their projects, each with that project's updates
  (each update carrying its meetup's date/number/category).
- `create` / `update` / `remove` — admin only. `remove` cascades: delete the member's updates and
  their `projectMembers` rows; delete any project left with zero members; null out `hostId` on any
  meetup they hosted. Cascade behavior must be covered by a test.

### 5.3 `meetups.ts`
- `list({ token, page?, pageSize? })` → `{ regularMeetups, hackathons, totalPages }`.
  Both arrays are date-descending, exclude `off_record_meetup`, and each meetup carries its host's
  name and its updates (each with member name, project name, category, description). Page size 28.
- `get({ token, id })`.
- `nextNumbers({ token })` → `{ regularMeetup: number, hackathon: number }` for form pre-fill.
- `hostOptions({ token })` → `{ yetToHost: MemberRef[], haveHosted: MemberRef[] }` — active members
  split by whether they've ever hosted, so the host dropdown can group them. Preserve this: choosing
  a host who hasn't hosted yet is a deliberate community habit.
- `create` / `update` / `remove` — admin only. `remove` also deletes that meetup's updates.

### 5.4 `projects.ts`
- `list({ token })` → all projects with member names and update counts.
- `create` / `update` / `remove` — admin only. `update` accepts a full `memberIds` array and
  reconciles the join table. `remove` deletes the project's updates too, and the UI must warn about
  that before calling it.

### 5.5 `updates.ts`
- `create` / `update` / `remove` — admin only. `create` validates the member–project relationship
  (§3.4).
- `formOptions({ token })` → `{ members: Array<{ id, name, projects: ProjectRef[] }>, meetups: Array<{ id, date, number, category }> }`.
  One round trip that powers the whole New Update form.

### 5.6 `dashboard.ts`
- `summary({ token })` → `{ recentMeetups: Meetup[4], recentHackathons: Meetup[4], activeMembers: MemberWithMetrics[8], stats }`
  where `stats` is `{ memberCount, meetupCount, projectCount, updateCount }`. One query for the whole
  dashboard, so the page has a single loading state.

### 5.7 `crons.ts`
- Daily: delete `sessions` rows where `expiresAt < now`.

---

## 6. Routes

App Router. `(dashboard)` is a route group carrying the shared shell (nav + auth guard).

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Landing page: full-bleed background image, animated per-letter title, tagline, Login button, footer. Redirect to `/dashboard` if a valid token cookie exists. |
| `/login` | public | Password field with show/hide toggle, "Remember me", submit. Rotating image carousel (5s interval) on the left half at `md+`. Toast on success and on invalid password. After ~5s of pending submit, show a muted "This may take a while…" line. Redirect to `/dashboard` if already logged in. |
| `/(dashboard)/dashboard` | member | Stats row, admin control panel, then Meetups / Hackathons / Active Members sections — 4 cards each with a "View All" link. |
| `/(dashboard)/members` | member | Paginated member grid, search, status filter, sort. |
| `/(dashboard)/members/[id]` | member | Member detail: metrics, projects, per-project update history. |
| `/(dashboard)/members/[id]/edit` | **admin** | Edit member form. |
| `/(dashboard)/meetups` | member | Paginated, two sections: Regular Meetups and Hackathons. |
| `/(dashboard)/meetups/[id]` | member | Meetup detail with its updates. |
| `/(dashboard)/projects` | member | **New in this project** — the source app had no project list page; projects were only reachable through member cards. Table/grid of all projects: name, category, members, update count, completed. Admin gets inline edit/delete. |

There is **no `/onboarding` route.**

---

## 7. Frontend requirements

### 7.1 Shell and hydration

`(dashboard)/layout.tsx` renders the nav bar and guards the route. Auth state lives in cookies, which
don't exist during SSR — so the layout must render `null` (not a spinner, not a flash of the page)
until a mount effect has hydrated the Zustand store from cookies. Getting this wrong produces
hydration mismatches; the source project handled it with an `isHydrated` flag and that pattern should
carry over.

Nav bar: logo (swaps light/dark variant), links to Dashboard / Members / Meetups / Projects, an "Admin
Mode" indicator when `isAdmin`, and Logout. Below `lg`, collapse into a slide-in sidebar with an
overlay.

### 7.2 Dark mode

Full light/dark support, class-based (`dark:`), defaulting to the OS preference with a manual toggle
persisted to `localStorage`. Every surface, border, and input needs both variants — this was
retrofitted awkwardly in the source project (hardcoded `#111` / `#222` / `#333` / `#555` everywhere);
here, define semantic Tailwind v4 theme tokens (`--color-surface`, `--color-surface-raised`,
`--color-border`, …) in `globals.css` and use those instead of raw hex.

### 7.3 Loading and error states

- Every list and card type gets a **skeleton** component matching its real layout's dimensions.
  Skeletons show on first load; they must **not** re-appear on background revalidation (Convex
  subscriptions make this the default — just don't reintroduce a manual `isLoading` that flickers).
- Mutations show a spinner inside the submitting button and disable it; they never block the page.
- A shared `ErrorState` component (illustration + message) for query failures, and an inline error
  banner inside modals.

### 7.4 Toasts

Global toast provider with `success` / `error` / `info` variants, auto-dismiss, stacked, animated in
and out. Every mutation reports its outcome through it. Toast copy is specific: "Successfully added
meetup!", "Error occurred, meetup was not saved." — never a bare "Error".

### 7.5 Shared components to build

- `ModalLayout` — portal, backdrop, click-outside and Escape to close, focus trap, scroll lock,
  animated enter/exit. Everything modal-shaped composes this.
- `SearchableDropdown` — single-select with a text filter, keyboard navigation (arrows, Enter, Escape),
  and **option groups** (needed for the host picker's "Yet To Host" / "Have Hosted" split).
- `MultiSelectDropdown` — same, multi-select with removable chips. Used for project members.
- `SubmitButton` — pending spinner + disabled state, one implementation used by every form.
- `NullTextIndicator` — renders a muted `N/A` for null metrics.
- `Pagination` — prev / "page – total" / next, disabled at bounds. On the members grid it's a fixed,
  floating pill at bottom-right; it hides entirely while a search is active.
- `StatusPill` — status label in a rounded outline chip.
- `ConfirmDialog` — replaces the source project's raw `window.confirm()` calls. Every destructive
  action routes through it, and its copy must name the cascade ("This will also delete N updates").

### 7.6 Cards

- **MemberCard** — name, status pill, project count, idea/progress talk counts, `durationActive`,
  `avgTimeBetweenTalks`, `meetupsSinceLastTalk`. Clicking opens a detail modal listing projects and
  their updates; admins get edit/delete affordances per project and per update inside it. Link out to
  the full member page.
- **MeetupCard** — "Meetup #N", formatted date, host name (or `N/A`), update count. Click opens a
  modal listing that meetup's updates, with admin edit/delete per update.
- **HackathonCard** — same shape, visually distinct, uses the hackathon number.
- **ProjectCard** — name, category, members, update count, completed state.

### 7.7 Admin control panel (dashboard)

Visible only when `isAdmin`. Three large action buttons opening modal forms:

1. **New Meetup** — number (pre-filled per §3.2), date (defaults to today), grouped host dropdown,
   category radios (Regular Meetup / Hackathon).
2. **New Project** — name, multi-select members, category radios, "Is project completed?" checkbox.
3. **New Update** — category radios (Idea Talk / Progress Talk), member select, project select
   (filtered to the member's projects; disabled until a member is chosen), meetup select showing
   dates, description textarea.

Every form: validates before submitting, names the specific missing field in its error toast, closes
on success, and resets its state when reopened.

### 7.8 Members page behavior

- Default status filter: **Active + Socially Active**. The active filter chips are visible next to the
  page title at `md+`.
- A filter popover offers status selection (including "All") and the sort options from §5.2.
- Search is debounced 300ms. While searching: results replace the grid, pagination hides, and clearing
  the box restores the filtered view.
- Changing a filter or sort resets to page 1.

### 7.9 Responsiveness

Grids: 1 column mobile → 2 at `md` → 4 at `xl`. Nav collapses at `lg`. Modals are full-width with
scrollable bodies on mobile. Test at 375px width — the community uses this on phones mid-meetup.

---

## 8. Build order

Each phase should end at a working, committed state.

1. **Scaffold** — Next.js + TS strict + Tailwind v4 + Convex init. Theme tokens, dark mode hook,
   `globals.css`.
2. **Schema + seed** — all tables and indexes from §3, plus a `seed` mutation generating ~40 members,
   ~50 meetups, ~30 projects, ~200 updates so every screen has realistic data from the start.
3. **Auth** — `auth.ts`, Zustand store, cookie handling, `/login`, route guard, `requireSession` /
   `requireAdmin` helpers.
4. **Metrics** — `convex/lib/metrics.ts` with unit tests (§3.6). Do this before the UI so cards have
   real numbers.
5. **Shell** — layout, nav, sidebar, toasts, modal layout, skeletons, error state.
6. **Read paths** — dashboard, members (filter/sort/search/paginate), meetups, projects, detail pages.
7. **Write paths** — control panel, all create modals, all edit forms, all deletes with confirms and
   cascades.
8. **Polish** — landing page animation, login carousel, responsive pass, empty states, a11y pass.

---

## 9. Acceptance criteria

The build is done when all of these hold:

- [ ] Logging in with the member password grants read access; **no** create/edit/delete control is
      visible, and calling a write mutation directly with a member token is rejected server-side.
- [ ] Logging in with the admin password grants full CRUD on all four entities.
- [ ] "Remember me" produces a session surviving a browser restart; without it the session expires in
      12 hours. An expired token redirects to `/login`.
- [ ] Creating a meetup in one browser tab makes it appear in a second tab without a refresh.
- [ ] The New Meetup number pre-fills correctly and changes when the category radio changes.
- [ ] A new update cannot be attached to a project its member doesn't belong to — enforced in the UI
      *and* rejected by the mutation.
- [ ] Deleting a project warns about its updates and removes them.
- [ ] Deleting a member cascades per §5.2 and leaves no orphaned rows.
- [ ] `meetupsSinceLastTalk`, `durationActive`, and `avgTimeBetweenTalks` are correct against the
      seed data and covered by unit tests; `off_record_meetup` never affects them.
- [ ] Members page: default filter is Active + Socially Active; sort options work; search is debounced
      and hides pagination; changing filters resets to page 1.
- [ ] Every page renders correctly in both light and dark mode at 375px, 768px, and 1440px.
- [ ] No hydration warnings in the console on any route.
- [ ] `ADMIN_PASSWORD` and `MEMBER_PASSWORD` do not appear anywhere in the client bundle
      (verify with a production build grep).
- [ ] There is no `/onboarding` route, nav entry, or component anywhere in the repo.
- [ ] `npm run build`, `npm run lint`, and the test suite all pass clean.

---

## 10. Environment

**Convex** (`npx convex env set`, server-side only):

```
ADMIN_PASSWORD=...
MEMBER_PASSWORD=...
```

**Next.js** (`.env.local`):

```
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

`NEXT_PUBLIC_CONVEX_URL` is the only public env var. If a third is ever needed, check whether it
belongs on the server instead.

---

## 11. Deliberate changes from the source project

Recorded so the agent doesn't "restore" them as missing features:

| Source behavior | Here | Why |
|---|---|---|
| `/onboarding` pipeline page | removed | Explicitly out of scope. |
| Passwords in `NEXT_PUBLIC_*` | Convex env vars | They were readable in the client bundle. |
| SWR + axios + manual `useState` fetching | Convex `useQuery` | Removes the manual loading/mutate plumbing and gives live updates. |
| `window.confirm()` for deletes | `ConfirmDialog` | Consistent, styleable, states the cascade. |
| Pages Router | App Router | Stack modernization. |
| Hardcoded hex colors in `dark:` variants | semantic theme tokens | Maintainability. |
| Hand-rolled `dateMod()` month switch | dayjs | The original had a `"Febuary"` typo shipped to users. |
| Projects reachable only via member cards | `/projects` page | Gap in the original. |
| Metrics computed by the Rails API | `convex/lib/metrics.ts` | No Rails backend anymore. |
