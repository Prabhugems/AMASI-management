# checkin_lists classification proposal — 2026-07-14

All 18 real `checkin_lists` rows (no ZZTEST leftovers found — the test-fixture cleanup from earlier in this thread held). Classification is by name-pattern heuristic only, cross-checked against check-in volume where it disambiguates. **Nothing has been changed** — `list_purpose` for every row is still `'collection'`, the fail-safe default from the `20260713_checkin_lists_list_purpose.sql` backfill. This is a proposal to review, not an applied change.

| Event | List | Current `list_purpose` | Check-ins | Proposed |
|---|---|---|---|---|
| 121 FMAS Patna | Breakfast | collection | 6 | collection (no change) |
| 121 FMAS Patna | Dinner | collection | 2 | collection (no change) |
| 121 FMAS Patna | Lunch | collection | 1 | collection (no change) |
| 121 FMAS Patna | Gyne course | collection | 0 | **REVIEW BY HAND** |
| 121 FMAS Patna | Online testing | collection | 0 | **DEACTIVATE** |
| 121 FMAS Patna | Testing | collection | 5 | **DEACTIVATE** |
| 122 FMAS Skill Course and FMAS Exam | Registration | collection | 171 | **entry** |
| 125th AMASI Skill Course and FMAS Exam | Head set checked in | collection | 9 | collection (no change) |
| 125th AMASI Skill Course and FMAS Exam | Registration Kit | collection | 231 | collection (no change) |
| 126 FMAS Delhi | Question Paper B | collection | 11 | collection (no change) |
| 126 FMAS Delhi | Question Surgery B | collection | 37 | collection (no change) |
| 126 FMAS Delhi | Registration Kit | collection | 266 | collection (no change) |
| 127 FMAS Course | Registration Kit | collection | 186 | collection (no change) |
| AMASI NextGen - BJ MEDICAL COLLEGE | Attendance | collection | 35 | **entry** |
| AMASI NextGen: Nurturing the Future - YCM HOSPITAL | Attendance | collection | 27 | **entry** |
| MMAS Hernia | Registration | collection | 65 | **entry** |
| MMAS Hernia | Blaz | collection | 0 | **REVIEW BY HAND** |
| Testing Phase | Registration Counter | collection | 1 | **entry**, but see note below |

## Changes proposed (7 of 18)

- **4 → `entry`**: "Registration" (122 FMAS, MMAS Hernia), "Attendance" (both NextGen events). These are the front-door/roster lists — a repeat scan should say "let them in," not "already collected." High confidence, high check-in volume backs the name.
- **2 → `DEACTIVATE`**: "Online testing" and "Testing" on 121 FMAS Patna. Read as internal QA lists left in a production event, not real delegate-facing lists. "Testing" has 5 check-ins on it though — worth a quick look at who scanned it and when before disabling, in case it's actually in active use under a misleading name.
- **2 → `REVIEW BY HAND`**: "Gyne course" (121 FMAS Patna) and "Blaz" (MMAS Hernia). Both have zero check-ins and a name that gives no signal either way — I won't guess, per your standing instruction.

## One extra flag, outside the list-classification question

The event itself named **"Testing Phase"** (containing the "Registration Counter" list) reads like a leftover dev/QA event, not a real conference — separate from any individual list's purpose. If it's not a real event, the fix isn't reclassifying its one list, it's whether the event should exist in the events table at all. Flagging, not acting — that's a bigger decision than a `list_purpose` value.

## Proposed SQL — NOT RUN

```sql
UPDATE checkin_lists SET list_purpose = 'entry' WHERE id IN (
  '4bda1a55-37cf-4817-9c34-f8b2e6a1243f', -- 122 FMAS: Registration
  '967ca6cd-0ab7-4040-b2d6-3410beca7e48', -- BJ Medical College: Attendance
  'db56dc82-b3ea-4906-8259-9cda8015b807', -- YCM NextGen: Attendance
  '66355f0a-8b7d-43f1-ab80-b5ef6f279a0f'  -- MMAS Hernia: Registration
);
-- 'Registration Counter' (50f463ab-3864-4bc5-828c-134ee45b8172, Testing Phase)
-- deliberately excluded from the entry UPDATE above pending your call on
-- whether the event itself should exist.

-- No UPDATE proposed for DEACTIVATE / REVIEW BY HAND — those aren't
-- list_purpose values (the column only accepts 'entry'|'collection'); they're
-- your action items: hide/disable the two Testing lists, and hand-decide
-- 'Gyne course' and 'Blaz' once you know what those lists were actually for.
```

Say the word if you want me to run the 4-row `entry` UPDATE — it's a small, reversible, additive change (single-column update, four rows, easy to flip back), unlike the 75-row retroactive correction which still needs sign-off.
