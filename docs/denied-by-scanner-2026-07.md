# Denied by scanner — 2026-07-14

Answering the specific question: is there anyone who was **denied** a certificate, a CME credit, or FMAS/MMAS certification eligibility **because** the check-in scanner lost their scan? Not "does a contradiction exist" (that's `silent-drops-2026-07.md`) — did the contradiction actually **block** something for a real person.

Read-only against prod. Nothing changed.

## Bottom line

**No larger or separate population than the 75 already reported. What this file adds is the actual denial mechanism, and one specific person inside the 75 who needs more than the planned fix.**

- CME credit assignment and FMAS/MMAS pass/fail computation: traced through the code, **neither reads `checked_in` at all**. There is no automatic denial path here. (Details below, Channels 2–3.)
- The one concrete, reproducible denial mechanism that exists is the certificate **self-service download** gate, which does hard-block on `checked_in`. It affects 74 of the 75 already-known registrations (Channel 1).
- The 75th — Shashi Prakash Mishra, 124 FMAS — **passed** his exam (not just "has a result"), has **no certificate at all** (nothing to even be blocked from), and is still being auto-reminded as of yesterday. (Channel 5.)

This does not outrank or replace the retroactive-correction work you already asked for — it's the same 75, with proof that the contradiction has a real consequence for most of them, plus one specific person whose fix is not "flip `checked_in`" but "generate his certificate." Both go into the next doc.

## Channel 1 — certificate self-service download (proven, code-level, live right now)

`src/app/api/certificate/[regNumber]/download/route.ts:132-134`:
```
if (!registration.checked_in) {
  return 403 "You must check in at the event before downloading your certificate"
}
```
Mirrored client-side in the delegate portal, `src/app/my/page.tsx:1392-1414` (locks the button, toasts "Check in at the venue first").

Certificate **generation** (`/api/certificates/generate`) and the admin candidate-picker (`src/app/events/[eventId]/certificates/generate/page.tsx:84-91`) are **not** gated by `checked_in` — they filter only on `status = 'confirmed'`. So a cert can exist in the system for someone the scanner marked absent; they just can't pull it themselves.

Query: `certificate_generated_at IS NOT NULL AND checked_in = false AND certificate_downloaded_at IS NULL AND` no WhatsApp delivery recorded, excluding online participants.

| Event | Registrations |
|---|---|
| MMAS Hernia | 34 |
| 122 FMAS Skill Course and FMAS Exam | 18 |
| 127 FMAS Course | 6 |
| 126 FMAS Delhi | 8 |
| AMASI NextGen: Nurturing the Future - YCM HOSPITAL | 8 |
| **Total** | **74** |

This is exactly the 75 from `silent-drops-2026-07.md` minus the 1 (Mishra, no cert exists to block — see Channel 5). Every row here shares one caveat already flagged in that doc: `certificate_generated_at` timestamps cluster identically per event (e.g. all 34 MMAS Hernia rows share one second) — that's a bulk-generate run across the whole confirmed roster, **not** per-person proof of attendance. So I can't independently confirm all 74 actually attended. What I *can* confirm: if any of them clicks their download link today, the gate above returns 403, citing a `checked_in` value this whole investigation thread has already shown is unreliable.

## Channel 2 — CME credit lists

Grepped "CME" repo-wide. It's a session-level feature (`session_cme` table, assigned by admins to sessions for speaker credit), summed per speaker in `src/app/speaker/[token]/dashboard/route.ts:116-234`. Attendance fields are read there only for **display**, never to include/exclude a session from the credit sum. **No `checked_in` filter found anywhere in the CME code path.**

## Channel 3 — FMAS/MMAS certification eligibility

`exam_result` (`pass|fail|absent|withheld`) is set manually by an examiner via `PATCH /api/examination/registrations` (`src/app/events/[eventId]/examination/results/page.tsx`, `src/app/api/examination/send-pass-email/route.ts`). **Nothing computes or overwrites `exam_result` from `checked_in` automatically.**

One soft coupling exists: `src/app/events/[eventId]/examination/page.tsx:705` shows a "Mark Absent" button only when `!exam_result && !checked_in` — a convenience affordance an examiner can click, not an automatic effect. Investigated below (Channel 4) whether it was used on anyone who was actually present.

## Channel 4 — investigated the worst-case hypothesis: wrongly-failed candidates

Searched for anyone `checked_in = false` AND `exam_result = 'absent'` OR `fail` with remarks containing "Absent" (the exact shape the Channel-3 button produces). Found 3, cross-checked against **every** other presence signal in the schema (check-in record on any list for the event, badge print-station pickup, podium check-in):

| Registration | Event | Exam result | Any check-in record | Badge pickup | Podium check-in | Badge downloaded (remote) |
|---|---|---|---|---|---|---|
| 122A1123 — Ishita Rathore | 122 FMAS | absent | 0 | 0 | 0 | — |
| 126A1228 — Puja Yadav | 126 FMAS Delhi | fail, remarks "Absent" | 0 | 0 | 0 | 2026-06-25 |
| 126A1105 — Smriti Yadav | 126 FMAS Delhi | fail, remarks "Absent" | 0 | 0 | 0 | 2026-06-21 |

**Zero on-site corroboration for all three.** The two remote badge downloads happened days before the event and don't establish physical attendance at the exam itself (this is the same weak signal `silent-drops-2026-07.md` already flagged as unreliable). I cannot substantiate a claim that any of these three were wrongly failed by the scanner — the complete absence of any presence signal is at least as consistent with genuine absence as with a scanner-caused drop. Reporting them for completeness, not as proven harm.

## Channel 5 — the one proven case

`exam_result = 'pass'` is the cleanest possible presence signal available: you cannot pass a practical/viva exam you didn't sit. Searching for `checked_in = false AND exam_result = 'pass'` across every event returns exactly **one** person — and he's already inside the 75 (`silent-drops-2026-07.md`'s row for "124 FMAS Skill Course and FMAS Exam": 1 registration, proven only by `exam_result`, no certificate). This channel doesn't add a new person; it adds detail about which one of the 75 he is and why he matters more than the raw table shows:

**Shashi Prakash Mishra — reg. 124A1237, "124 FMAS Skill Course and FMAS Exam"**
- `exam_result: pass` (viva 10, theory 60, practical 10, publication 5)
- `checked_in: false`, zero check-in records on any list, zero badge pickup, zero podium check-in
- `certificate_generated_at: null`, `certificate_downloaded_at: null` — **no certificate exists at all**, not even a blocked one
- `email_sent_pass: 2026-05-18` — the pass notification went out over 8 weeks ago
- `last_reminder_sent: 2026-07-10` — the system is **still auto-reminding him as of 4 days ago**, evidently about something he cannot complete
- One caveat on the exam record itself: `remarks: "without Exam"` on the marks JSON — worded ambiguously (could mean a waiver/credit pass rather than a sat exam); I'm flagging it rather than resolving it, since it cuts against my own "definitely sat the exam" reading and I won't guess which it means.

He needs a different fix than the retroactive-correction plan (which only flips `checked_in`/`checked_in_at`) — flipping his `checked_in` won't produce a certificate; someone has to run generation for him specifically. Flagging this for the next doc rather than acting on it.

## What this changes about the plan

Nothing about sequencing — it confirms the 75 is worth correcting (74 of them are concretely blocked from self-service download right now, not just inconsistent on paper) and adds exactly one line item (Mishra needs a certificate generated, not just a `checked_in` flip) to carry into `docs/retroactive-checkins-2026-07.md`, which is next.
