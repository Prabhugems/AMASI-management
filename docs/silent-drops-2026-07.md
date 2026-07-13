# Silent-drop forensics — 2026-07-13

Numbers only, per your instruction. Nothing remediated, nothing deleted, nothing changed. All queries read-only against the shared prod DB.

## Method 1 — within-event dependency chain (Registration/Kit → downstream list)

Logic: a registration with a `checkin_record` on a downstream list but none on the upstream list, within the same event, is a proven silent drop on the upstream list — physically impossible to reach the downstream list otherwise.

**This test only applies where an event's lists actually form that kind of hard gate.** I did not apply it to meal lists (Breakfast/Lunch/Dinner are independent choices, not a dependency chain) or to `Attendance`/`Testing`/`Registration Counter`-only events (no second list to test against). Two events had a genuine, defensible chain:

| Event | Chain tested | Proven drops found |
|---|---|---|
| 126 FMAS Delhi | Registration Kit (266 check-ins) → Question Paper B (11) / Question Surgery B (37) | **0** |
| 125th AMASI Skill Course and FMAS Exam | Registration Kit (231) → Head set checked in (9) | **0** |

**Zero proven drops by this method.** This does not mean the bug didn't happen — it means nobody who reached these specific downstream lists had a *total* absence of any record on the upstream one. It's a narrow test: it only catches someone who skipped the upstream list entirely, not someone whose first scan attempt silently failed but who was successfully scanned on a retry (which leaves a normal-looking record with no visible trace of the earlier miss).

Every other event has only one list with any check-in activity at all (127 FMAS Course, 122 FMAS Skill Course, MMAS Hernia's "Registration" list, both AMASI NextGen events, Testing Phase) — no within-event chain exists to test.

## Method 2 — cross-check against certificate/exam ground truth

This is the strongest signal found. `registrations.checked_in = false` cross-checked against three independent proof-of-participation fields: `exam_result`, `certificate_generated_at`, `certificate_downloaded_at`. Excludes `participation_mode = 'online'` registrations (correctly never expected to check in physically).

| Event | Registrations flagged | has_exam_result | has_cert_generated | has_cert_downloaded |
|---|---|---|---|---|
| MMAS Hernia | 34 (of 55 total; 21 excluded as online) | 0 | 34 | 0 |
| 122 FMAS Skill Course and FMAS Exam | 18 | 1 | 18 | 0 |
| 126 FMAS Delhi | 8 | 2 | 8 | 0 |
| AMASI NextGen: Nurturing the Future - YCM HOSPITAL | 8 | 0 | 8 | 0 |
| 127 FMAS Course | 6 | 0 | 6 | 0 |
| 124 FMAS Skill Course and FMAS Exam | 1 | 1 | 0 | 0 |
| **Total** | **75** | | | |

**75 registrations, 6 events: a certificate exists and/or an exam result is recorded for someone our system shows as never having checked in to the event.**

Important caveats on this number:
- `certificate_generated_at` means the certificate **file was created** — it does not by itself confirm the delegate actually received/downloaded it (no `has_cert_downloaded` hits at all in this dataset, across any event, suggests certificates here are generated in bulk and pushed via email/WhatsApp rather than self-service-downloaded; I did not trace delivery logs for this pass).
- This proves a **contradiction between two independent systems** (certificate/exam pipeline vs. check-in status), not a specific cause. The burst-scan bug is a plausible mechanism — consistent with the near-total silent-drop rate found in the telemetry test (`docs/telemetry-burst-scan-2026-07.md`) — but a static snapshot like this can't attribute causation with certainty. A silent drop, by definition, writes **zero rows anywhere** (no `checkin_audit_log` entry either), so there is no timestamp to correlate it against a specific burst window. This number is the best available proxy, not a reconstruction of when/how each one happened.

## Method 3 — badge print-station pickup

`print_jobs.picked_up_at` (a delegate physically collecting a printed badge at an on-site kiosk) cross-checked against `checked_in = false`, excluding online participants.

**0 discrepancies found.** Everyone who picked up a printed badge also has a check-in record.

## Method 4 — abstract presenter podium check-in

`abstract_presenter_checkins.checked_in_at` (a presenter checking in at the podium before their talk) cross-checked against `checked_in = false` on their registration.

**0 discrepancies found.**

## Other "they were definitely there" signals in the schema (per your ask — you may not know all of these)

- `print_jobs.printed_at` / `picked_up_at` — badge print-station activity (checked, Method 3, clean).
- `abstract_presenter_checkins.checked_in_at` / `presentation_started_at` / `presentation_ended_at` — podium check-in for presenters specifically (checked, Method 4, clean).
- `registrations.exam_result` / `exam_marks` / `exam_total_marks` — exam grading (checked, part of Method 2).
- `registrations.certificate_generated_at` / `certificate_downloaded_at` — certificate pipeline (checked, part of Method 2 — this is the one with the finding).
- `registrations.badge_generated_at` / `badge_downloaded_by_delegate_at` — badge generation/self-download. **Not checked in this pass** — `badge_downloaded_by_delegate_at` can plausibly be triggered remotely (email link) rather than only on-site, so it's a weaker presence signal than print-station pickup; flagging its existence rather than asserting a number.
- `form_submissions.submitted_at` — generic form submission timestamps (e.g. feedback forms). **Not checked** — forms aren't inherently onsite-only, would need per-form classification to use as a presence signal; out of scope for this pass unless you want it added.
- `event_faculty.badge_printed` / `participants.badge_printed` — same idea as `print_jobs` but on different tables (faculty and a separate/legacy `participants` table, not `registrations`). Not cross-checked against delegate check-in data since they're a different population.

## Certification/CME eligibility flag

Every event in the Method 2 table except one is named as an FMAS/MMAS exam-based certification course (122/124/126/127 FMAS, MMAS Hernia) — these are certification programs where exam pass + attendance verification typically gates the certificate. **AMASI NextGen: Nurturing the Future — YCM HOSPITAL** is not an exam-certification event by name (reads as a CME/outreach session) but shows the identical pattern (8 registrations with a certificate generated despite `checked_in=false`) — flagging it since you specifically asked not to have this filtered by assumption.

## Denominators — full attendance picture for every event in scope

| Event | Total confirmed | checked_in=true | checked_in=false | checked_in=false, expected onsite |
|---|---|---|---|---|
| 126 FMAS Delhi | 273 | 265 | 8 | 8 |
| 125th AMASI Skill Course and FMAS Exam | 270 | 231 | 39 | 39 |
| 124 FMAS Skill Course and FMAS Exam | 234 | 233 | 1 | 1 |
| 127 FMAS Course | 224 | 195 | 29 | 29 |
| 122 FMAS Skill Course and FMAS Exam | 189 | 171 | 18 | 18 |
| MMAS Hernia | 120 | 65 | 55 | 34 |
| AMASI NextGen - BJ MEDICAL COLLEGE | 35 | 35 | 0 | 0 |
| AMASI NextGen: Nurturing the Future - YCM HOSPITAL | 35 | 27 | 8 | 8 |

`checked_in=false, expected onsite` is everyone not marked checked-in, minus registrations correctly marked `participation_mode='online'`. This is the full pool that *could* contain silent drops — the 75 in Method 2 (a subset of this pool, not the whole thing) are the ones we can independently prove were actually present via an unrelated system.
