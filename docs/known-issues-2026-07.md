# Known issues — captured 2026-07-15, NOT to be fixed before AMASICON

Per instruction: this is a capture-and-park doc. Nothing below has been touched. Everything here waits for September.

## `logEmail()` silently fails on every call — column mismatch, not a flake

**Found while confirming Mishra's certificate email.** Resend confirmed delivery, `certificate_generated_at` was set — but the `email_logs` tracking row never appeared. This is the same "action succeeded, record didn't, nothing threw" shape as the check-in silent drops, one table over.

### Root cause — confirmed, not guessed

`logEmail()` (`src/lib/email-tracking.ts:26-57`) inserts into `email_logs` with these keys:
```ts
{
  resend_email_id: params.resendEmailId,
  email_type: params.emailType,
  from_email: params.fromEmail,
  to_email: params.toEmail,
  subject: params.subject,
  event_id: params.eventId || null,
  registration_id: params.registrationId || null,
  status: "sent",
  sent_at: new Date().toISOString(),
  metadata: params.metadata || {},
}
```

The live `email_logs` table (checked via `information_schema.columns`) actually has:
```
id, registration_id, event_id, recipient_email, subject, template_type,
status, provider, provider_message_id, error, sent_at, created_at
```

**Four of the ten keys `logEmail()` writes don't exist on the table at all**: `resend_email_id` (table has `provider_message_id`), `email_type` (table has `template_type`), `from_email` (not on the table), `to_email` (table has `recipient_email`), `metadata` (not on the table). Every call is a guaranteed PostgREST "column does not exist" error.

### Why it's silent

`logEmail()` catches its own failure twice and swallows both:
- `if (error) { console.error("Failed to log email:", error); return null }` (line 47-50)
- `catch (err) { console.error("Error logging email:", err); return null }` (line 53-56)

Every caller ignores the return value. In `src/app/api/certificates/email/route.ts:201-216`: `if (result.id) { await logEmail({...}) }` — the awaited call's `null`/failure is never checked, so the route still returns `{success: true, ...}` to the client regardless. `console.error` on Vercel goes to function logs nobody was watching for this.

### Blast radius — confirmed empirically, not just by reading code

`email_logs` has exactly **190 rows total**, and every single one has `template_type = 'badge'`, `provider = 'resend'` — that's the *other* insert path (a one-off script, `scripts/125-send-confirmation-badge-2026-07-08.mjs`, which happens to use the correct current column names: `recipient_email`, `provider`, `provider_message_id`). **Zero rows in this table's entire history came from `logEmail()`.** This isn't an intermittent bug — it has a 100% failure rate, for as long as this table has existed in its current shape, across all 6 call sites:
- `src/app/api/certificates/email/route.ts`
- `src/app/api/email/travel-itinerary/route.ts`
- `src/app/api/email/faculty-reminder/route.ts`
- `src/app/api/email/faculty-invitation/route.ts`
- `src/app/api/email/request-travel-details/route.ts`
- `src/app/api/email/feedback-reminder/route.ts`

Every email actually sent through any of these six routes (all of them appear to work — Resend/whatever provider does the real send, that part isn't broken) has never once been recorded in `email_logs`. Whatever admin UI reads this table for delivery/open/click stats has been looking at an empty picture for these six email types the entire time.

### The forensic number, split — 913 is a ceiling, not a finding

`certificate_generated_at` doesn't record which of two mechanisms set it, so the raw 913 conflates two populations: bulk `/api/certificates/generate` (no email ever attempted — no `email_logs` row is *expected*, not a defect) and `/api/certificates/email` (an email genuinely was sent — a row *should* exist). There's no dedicated column saying which; the split below uses a proxy — **bulk `/generate` runs share one identical `certificate_generated_at` timestamp across every registration in the batch** (confirmed pattern from `docs/silent-drops-2026-07.md` — e.g. all 34 MMAS Hernia certs share one exact millisecond), while `/email` only ever fires for one registration at a time, so its timestamp won't be shared by any sibling in the same event.

```sql
WITH no_log AS (
  SELECT r.id, r.event_id, r.certificate_generated_at
  FROM registrations r
  WHERE r.certificate_generated_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM email_logs el WHERE el.registration_id = r.id)
)
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE sibling_count > 1) AS shared_timestamp,
  count(*) FILTER (WHERE sibling_count = 1) AS unique_timestamp
FROM (
  SELECT nl.*, (SELECT count(*) FROM registrations r2
                WHERE r2.event_id = nl.event_id
                  AND r2.certificate_generated_at = nl.certificate_generated_at) AS sibling_count
  FROM no_log nl
) x;
```

| | Count | What it means |
|---|---|---|
| **Total (the raw 913)** | 913 | Everything with a cert but no tracking row |
| **Shared timestamp (bulk signature)** | **909** | Timestamp shared with ≥1 other registration in the same event — bulk `/generate`, no email attempted. **Expected. Not a defect. Not part of the real gap.** |
| **Unique timestamp (ambiguous)** | **4** | Timestamp belongs to only that one registration in its event — consistent with an individual `/email` send (real tracking gap) but **cannot be fully distinguished** from a `/generate` call made for a single person (also legitimately not a gap). |

**So: of the scary-looking 913, 909 are explained and not a problem. Only 4 are genuinely unresolved.** They are:

| Reg. # | Attendee | Event | Timestamp |
|---|---|---|---|
| MMAS-BA1063 | Pratik Abhishek | MMAS Hernia | 2026-03-06 17:05:48.567+00 |
| SPK-20260214-1657 | Manoranjan Kushwaha | 122 FMAS Skill Course and FMAS Exam | 2026-03-14 06:57:16.9+00 |
| 125A1209 | Pathik Shit | 125th AMASI Skill Course and FMAS Exam | 2026-06-27 04:31:03.285+00 |
| **124A1237** | **Shashi Prakash Mishra** | 124 FMAS Skill Course and FMAS Exam | **2026-07-15 04:40:38.216+00** |

The last row is not a historical artifact — it's this session's own certificate send for Mishra (`docs/retroactive-checkins-2026-07.md`), caught live: Resend confirmed delivery, `certificate_generated_at` set, and — exactly as this whole section describes — no `email_logs` row appeared for it either. First-hand confirmation the bug is current, not legacy.

**What September needs to fully resolve the remaining 4:** something outside this database that records an actual send attempt independent of `email_logs` — e.g., Resend's own dashboard/API send history queried by recipient email + approximate timestamp, or Vercel function logs from around each timestamp (the swallowed error is logged via `console.error`, so it may still be sitting in Vercel's log retention window for the two 2026-06/07 ones, though likely expired for the 2026-03 ones by September). Without one of those, these 4 stay labeled "ambiguous, small, and bounded" — a lead, not a conclusion.

### Fix shape (post-AMASICON, not now)

Not a hard problem — `logEmail()`'s insert needs its keys rewritten to match the actual `email_logs` columns (`resend_email_id`→`provider_message_id`, `email_type`→`template_type`, `from_email`→ drop (not on table), `to_email`→`recipient_email`, `metadata`→ drop or add the column). Six call sites, zero of which need their own changes — they all go through the one shared helper.
