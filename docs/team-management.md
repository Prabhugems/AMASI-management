# Team Management

Reference documentation for the Team Management module in AMASI Faculty Management.

Team Management lets admins invite collaborators, assign fine-grained permissions, scope access to specific events, and audit what each member does. It is distinct from `users` (Supabase auth accounts) and `faculty` (speakers/invited experts) — team members are internal staff/coordinators who operate the platform.

---

## Architecture Overview

```
auth.users ──┐
             ├──(email match)──> team_members ──> usePermissions() ──> feature gates
users ───────┘                        │
                                      ├──> team_invitations (onboarding)
                                      ├──> team_activity_logs (audit trail)
                                      └──> team_access_logs   (module access)
```

- **Source of truth for permissions**: `team_members` table.
- **Role mapping**: `team_members.role` is mapped to `users.platform_role` via `src/lib/auth/role-mapping.ts`.
- **Empty arrays = "all"**: An empty `permissions` array means full access; an empty `event_ids` array means access to every event.

---

## Database Schema

### `team_members`
Migration: `supabase/migrations/20260116_add_team_members.sql`

| Column       | Type        | Notes                                                 |
| ------------ | ----------- | ----------------------------------------------------- |
| `id`         | UUID (PK)   | Auto-generated                                        |
| `email`      | TEXT UNIQUE | Primary identifier; links to `auth.users` by email    |
| `name`       | TEXT        |                                                       |
| `phone`      | TEXT        | Nullable                                              |
| `role`       | TEXT        | `admin` \| `coordinator` \| `travel`                  |
| `notes`      | TEXT        | Internal notes                                        |
| `event_ids`  | UUID[]      | Empty = all events; otherwise scoped                  |
| `permissions`| JSONB/TEXT[]| Empty = full access; otherwise restricted module list |
| `is_active`  | BOOLEAN     | Default `true`                                        |
| `invited_by` | UUID        | FK → `auth.users(id)`                                 |
| `accepted_at`| TIMESTAMPTZ | Set when invite is accepted                           |
| `created_at` | TIMESTAMPTZ |                                                       |
| `updated_at` | TIMESTAMPTZ |                                                       |

Indexes: `idx_team_members_email`, `idx_team_members_role`.
RLS: authenticated read/write; service role full access (API routes bypass via admin client).

### `team_invitations`
Migration: `supabase/migrations/20260330_enhance_team_module.sql`

| Column        | Type        | Notes                                                   |
| ------------- | ----------- | ------------------------------------------------------- |
| `id`          | UUID (PK)   |                                                         |
| `email`       | TEXT        |                                                         |
| `name`        | TEXT        | Nullable                                                |
| `role`        | TEXT        | Default `coordinator`                                   |
| `permissions` | JSONB       |                                                         |
| `event_ids`   | UUID[]      |                                                         |
| `invited_by`  | UUID        | FK → `auth.users(id)`                                   |
| `token`       | TEXT UNIQUE | 64-char hex, used in invite link                        |
| `status`      | TEXT        | `pending` \| `accepted` \| `expired` \| `revoked`       |
| `accepted_at` | TIMESTAMPTZ | Nullable                                                |
| `expires_at`  | TIMESTAMPTZ | Default `NOW() + 7 days`                                |
| `created_at`  | TIMESTAMPTZ |                                                         |
| `updated_at`  | TIMESTAMPTZ |                                                         |

Indexes: `idx_team_invitations_token`, `idx_team_invitations_email`.

### `team_activity_logs`
Migration: `supabase/migrations/20260330_enhance_team_module.sql`

| Column        | Type        | Notes                              |
| ------------- | ----------- | ---------------------------------- |
| `id`          | UUID (PK)   |                                    |
| `actor_id`    | UUID        | Who performed the action           |
| `actor_email` | TEXT        |                                    |
| `action`      | TEXT        | See [Action Types](#action-types)  |
| `target_type` | TEXT        | Default `team_member`              |
| `target_id`   | UUID        | Nullable                           |
| `target_email`| TEXT        | Nullable                           |
| `metadata`    | JSONB       | Additional change context          |
| `ip_address`  | TEXT        | Nullable                           |
| `created_at`  | TIMESTAMPTZ |                                    |

Indexes on `actor_id`, `target_id`, `action`, `created_at`.

### `team_access_logs`
Tracks which modules a team member visits. Columns (inferred from `src/app/api/team/access-log/route.ts`):
`user_id`, `user_email`, `module`, `event_id`, `path`, `method`, `ip_address`, `user_agent`, `created_at`.

---

## API Routes

All routes live under `src/app/api/team/`. Unless noted, auth is enforced via `requireAdmin()` (event_admin / admin / super_admin).

### Team Members

| Method | Path                     | Auth         | Purpose                                                                 |
| ------ | ------------------------ | ------------ | ----------------------------------------------------------------------- |
| POST   | `/api/team`              | admin        | Create a team member directly. 409 on duplicate email.                  |
| PATCH  | `/api/team/[id]`         | admin        | Update `name`, `role`, `permissions`, `event_ids`, `is_active`, `notes`, `phone`. Emits role-change / activation notifications. |
| DELETE | `/api/team/[id]`         | super_admin  | Permanently delete member. Logs `team_member.deleted`.                  |
| GET    | `/api/team/status`       | authenticated| Merged view: team_members + auth `last_sign_in_at` + activity metrics.  |
| GET    | `/api/team/export`       | admin        | CSV export: Name, Email, Phone, Role, Permissions, Event Count, Status, Created, Last Active. |

Sources: `src/app/api/team/route.ts`, `src/app/api/team/[id]/route.ts`, `src/app/api/team/status/route.ts`, `src/app/api/team/export/route.ts`.

### Invitations

| Method | Path                                   | Auth   | Purpose                                                       |
| ------ | -------------------------------------- | ------ | ------------------------------------------------------------- |
| POST   | `/api/team/invite`                     | admin  | Create invite, send email with `{APP_URL}/team/accept-invite?token=…`. |
| GET    | `/api/team/invite`                     | admin  | List invitations, newest first.                               |
| POST   | `/api/team/invite/[id]/accept`         | public | Accept via token; creates team_member + sets `accepted_at`.   |
| POST   | `/api/team/invite/[id]/resend-invite`  | admin  | Resend email for a pending invite.                            |
| POST   | `/api/team/invite/[id]/revoke`         | admin  | Mark invite as `revoked`.                                     |

Errors: 404 unknown, 400 already processed, 410 expired, 409 duplicate.

Sources: `src/app/api/team/invite/route.ts`, `src/app/api/team/invite/[id]/accept/route.ts`, `src/app/api/team/invite/[id]/resend-invite/route.ts`, `src/app/api/team/invite/[id]/revoke/route.ts`.

### Audit & Access

| Method | Path                         | Auth          | Purpose                                                                                  |
| ------ | ---------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/team/[id]/activity`    | admin         | Activity logs for a member (as actor or target). Paginated (`limit` ≤ 200, `offset`).    |
| POST   | `/api/team/access-log`       | authenticated | Log a module visit. Rate-limited to 5 min per (user, module). Captures IP + user agent.  |
| GET    | `/api/team/access-log`       | super_admin   | Query access logs with filters: `user_id`, `user_email`, `module`, `event_id`, `from`, `to`, `limit`, `offset`. |
| GET    | `/api/team/permissions-schema` | admin       | Returns module list, actions, role templates for the UI.                                 |

Sources: `src/app/api/team/[id]/activity/route.ts`, `src/app/api/team/access-log/route.ts`, `src/app/api/team/permissions-schema/route.ts`.

---

## UI

| Route                          | File                                            | Purpose                                                                   |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `/team`                        | `src/app/team/page.tsx`                         | Main management UI: list, search, filter, add/edit/invite/deactivate/delete, tabs for members / pending invitations / activity / access logs, CSV export. |
| `/team/accept-invite`          | `src/app/team/accept-invite/page.tsx`           | Public invite acceptance (token in query string).                         |
| `/events/[eventId]/team`       | `src/app/events/[eventId]/team/page.tsx`        | Event-scoped team view.                                                   |
| `/team-login`                  | `src/app/team-login/page.tsx`                   | Team member login landing page.                                           |
| `/team-portal`                 | `src/app/team-portal/page.tsx`                  | Team member self-service portal.                                          |

### Components — `src/components/team/`

- **`pending-invitations.tsx`** — table of invitations with status badges, resend/revoke actions, expiry countdown.
- **`activity-log.tsx`** — timeline of member actions with icons, colors, and expandable metadata.
- **`access-log-viewer.tsx`** — per-module access summary (accessed vs. never accessed) for a member.
- **`category-permission-picker.tsx`** — hierarchical permission selector grouped by the 5 categories, with a full-access toggle and indeterminate state for partial selection.

---

## Roles & Permissions

### Roles (`team_members.role`)

| Role          | Description                                            | Mapped `platform_role` |
| ------------- | ------------------------------------------------------ | ---------------------- |
| `admin`       | Full system access; can manage team.                   | `admin`                |
| `coordinator` | Event-based access; permission-gated features.         | `event_admin`          |
| `travel`      | Travel & logistics focus.                              | `staff`                |
| _(other)_     | —                                                      | `member`               |

Mapping logic: `src/lib/auth/role-mapping.ts` (`mapTeamRoleToPlatformRole`).

### Permission Categories

Defined in `src/lib/team-constants.ts` — 22 modules across 5 categories:

1. **Event Operations** — Speakers, Program, Check-in Hub, Badges, Certificates, Print Station.
2. **Registration & Forms** — Registrations, Addons, Waitlist, Forms, Delegate Portal, Surveys, Leads.
3. **Travel & Logistics** — Flights, Hotels, Meals, Transfers, Visa Letters.
4. **Finance & Sponsors** — Sponsors, Budget.
5. **Advanced Modules** — Abstract Management, Examination.

Also exports `ROLE_PRESETS` (9 quick-apply templates: Administrator, Event Manager, Registration Manager, Program Coordinator, etc.) and helpers `getCategoryForPermission()`, `getCategoryPermissions()`, `detectPreset()`, `detectPresetForMember()`, `getRoleConfig()`.

### Access Rules

- **`permissions = []`** → full access to every module.
- **`permissions = [...modules]`** → restricted to listed modules.
- **`event_ids = []`** → access to every event.
- **`event_ids = [...uuids]`** → restricted to listed events.
- **`is_active = false`** → blocked regardless of role/permissions.

### `usePermissions` Hook

`src/hooks/use-permissions.ts` returns:

```ts
{
  permissions: Permission[],
  role: 'admin' | 'coordinator' | 'travel',
  isAdmin, isTeamUser, hasFullAccess, isEventScoped,
  eventIds: string[],
  hasPermission(p),
  hasAnyPermission(ps),
  hasAllPermissions(ps),
  hasEventAccess(eventId),
}
```

Data is read from `users` (for `is_super_admin` / `platform_role`) and `team_members` (for `role`, `permissions`, `event_ids`). Cached with a 5-minute stale time.

---

## Action Types

Emitted by `logTeamAction()` in `src/lib/team-audit.ts` and written to `team_activity_logs`:

- `team_member.created`
- `team_member.updated`
- `team_member.role_changed`
- `team_member.activated`
- `team_member.deactivated`
- `team_member.deleted`
- `team_member.invited`
- `team_member.invite_accepted`
- `team_member.invite_resent`
- `team_member.invite_revoked`

---

## Invitation Flow

1. Admin submits invite from `/team` → `POST /api/team/invite`.
2. Row inserted in `team_invitations` with 64-char hex `token` and `expires_at = NOW() + 7 days`.
3. Email sent via `teamInvitation()` template with link `{NEXT_PUBLIC_APP_URL}/team/accept-invite?token=…`.
4. Invitee opens the link → `/team/accept-invite` → `POST /api/team/invite/[id]/accept`.
5. On accept: `team_members` row created from invitation data, `team_invitations.status = 'accepted'`, `accepted_at` stamped, activity logged, redirect to `/login`.
6. Pending invitations can be **resent** or **revoked** from the UI; expired invitations return HTTP 410 on accept.

---

## Integration Points

- **Auth** — `requireAdmin()` / `requireSuperAdmin()` gate every mutating endpoint; team_members are auto-linked to `auth.users` by email.
- **Email** — invitations and role/status-change notifications via the standard email pipeline (`src/lib/email.ts`, `src/lib/email-templates.ts`).
- **Events** — `event_ids` on `team_members` and the event-scoped page at `/events/[eventId]/team`.
- **Users table** — `platform_role` is kept in sync via role mapping; `last_sign_in_at` and `last_active_at` feed the Login Status column.
- **Activity / audit** — `logTeamAction()` is fire-and-forget and writes to the dedicated `team_activity_logs` table (separate from general audit trail).

---

## Known Gotchas

1. **Empty arrays are meaningful.** `permissions: []` and `event_ids: []` mean "all", not "none". Always distinguish between `[]` and a populated restricted list in UI and API logic.
2. **Delete is super_admin only.** `PATCH /api/team/[id]` (deactivate) is admin-level; `DELETE` requires `super_admin`.
3. **Invite acceptance is public.** `POST /api/team/invite/[id]/accept` has no auth — security lives in the token + `expires_at` + status checks.
4. **Email linkage.** `team_members.email` is how the platform matches a logged-in user to their team permissions. Changing an auth email will break the link until the `team_members` row is updated.
5. **Access log rate limit.** `POST /api/team/access-log` swallows repeat hits within a 5-minute window per (user, module). Use the super_admin `GET` endpoint for historical queries.
6. **RLS vs. admin client.** API routes must use `createAdminClient()` to bypass RLS on writes, consistent with the rest of the codebase.
