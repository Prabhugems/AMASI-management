# Retroactive check-in correction — 2026-07-14 (revised)

**STATUS as of 2026-07-15: the 74-row batch below is STILL HELD, unsigned, NOT EXECUTED. Only Mishra (originally row 19 of the 75) has been applied, as an explicitly-authorized standalone exception — his row is no longer part of the batch you're being asked to sign off on.** Do not read Mishra's correction as precedent for the other 74 running: the batch below requires Hon. Secretary sign-off before it runs, full stop. I have not and will not run the batch SQL myself without that sign-off.

**Reconciliation — why this file now holds 74, not 75:** the count changed by exactly one, for exactly one stated reason: Mishra (124A1237) was removed after being applied standalone on 2026-07-15 (see "What this corrects" below for the values used). No other row was added, removed, or reclassified. 75 − 1 (Mishra, applied) = 74 (still held).

**Revision note:** this replaces the earlier version of this doc, which used the certificate-batch-generation timestamp as `checked_in_at`. Per your explicit instruction, that's gone — a batch-job timestamp on a certification record reads as fabricated attendance. New rule below.

## What this corrects, and what it explicitly does not

This corrects `checked_in` / `checked_in_at` for the 75 registrations identified in `docs/silent-drops-2026-07.md` and given a concrete consequence in `docs/denied-by-scanner-2026-07.md` (74 of them are blocked from self-service certificate download right now, solely by `checked_in = false`).

**75 is the provable floor, not the total.** Anyone the scanner silently dropped who has no certificate, no exam, and no other logged artifact is invisible to every method used in this thread. Correcting these 75 does not mean the problem was 75 people; it means these are the 75 we can currently prove.

**Mishra (124A1237) is no longer in this batch — already applied standalone, 2026-07-15.** His was the one row with a clean, individually-real timestamp (`email_sent_pass`, not a batch artifact), and his certificate email was blocked on it (the download link he'd be sent 403s on `checked_in=false`), so it was corrected ahead of the other 74 rather than waiting on this sign-off: `checked_in=true`, `checked_in_at='2026-05-18T13:54:03.843Z'`, one `checkin_audit_log` row (`action='retro_correction'`). Backup was NOT taken via the table below for his row — if this needs undoing, revert him individually (his prior state was `checked_in=false, checked_in_at=NULL, notes=NULL`). His certificate-email send is tracked separately and is still pending as of this doc's last edit.

**The remaining 74 in this file are unaffected — same rule, same sign-off requirement.**

## The revised timestamp rule

Your rule, applied exactly as given:
- **Exam exists → `checked_in_at` = exam submission timestamp.** A real human act.
- **No exam → `checked_in_at` = event start date @ 09:00 local, and `notes` says "APPROXIMATE — reconstructed, no precise attendance evidence."**
- Never a batch-job timestamp.

Two things I had to resolve to apply this, flagged rather than silently decided:

**1. There is no `exam_submitted_at` column.** I checked `information_schema.columns` on `registrations` — the only exam-related fields are `exam_result`, `exam_marks` (jsonb), `exam_total_marks`, plus the generic `updated_at`. `updated_at` is not usable as "exam submission timestamp" — I checked, and it has the exact same batch problem as the certificate timestamp: all 8 "126 FMAS Delhi" rows share one identical `updated_at` (2026-06-21T16:20:08.219367Z), and three "122 FMAS" rows share another (2026-03-02T06:17:05.378688Z). That's a bulk import/grading-run touch, not an individual moment. The only row with a genuinely individual, non-batch timestamp tied to its exam outcome is Mishra's: `exam_marks->>'email_sent_pass'` = `2026-05-18T13:54:03.843Z`, the actual pass-notification send time. That's the one row this branch applies to.

**2. Three rows technically have a non-null `exam_result` but it's adverse, not a pass:** Ishita Rathore (122 FMAS, `exam_result: absent`), Puja Yadav and Smriti Yadav (126 FMAS Delhi, `exam_result: fail`, marks JSON literally says `"remarks":"Absent"`). Using their exam record as the "real human act" proof would mean citing a record that says they were absent to justify marking them checked-in — that's self-contradicting, not a correction. I did not use it. These three are certificate-proven anyway (all three have `certificate_generated_at` set, which is what actually qualified them for the 75 in the first place), so I've routed them through the "no exam" branch instead — approximate, event-start-date, flagged. If you want them handled differently, say so; I didn't feel entitled to guess past what the rule anticipated.

**Net effect: Mishra got the one real, individual timestamp and has already been applied standalone (see above). All 74 rows remaining in this file get the approximate event-start-date fallback, explicitly labeled as such in `notes`.** That's a much less precise-looking result than the last version of this doc, and that's deliberate — precise-looking and wrong was the problem.

**Timezone:** "local" is taken as IST (UTC+05:30) — every event in this set is an India-based AMASI conference. `09:00 local` = `03:30:00Z`.

## Provenance rule (unchanged from before) and one deviation from your spec

Your spec: `checked_in_by = 'SYSTEM: retroactive correction 2026-07 (scanner defect)'`. **`registrations` has no `checked_in_by` column** (checked — only `checked_in`/`checked_in_at` exist). The identifying string goes on `checkin_audit_log.performed_by` instead, which is the column that exists for exactly this. Every corrected registration gets one `checkin_audit_log` row, `action = 'retro_correction'`, `success = true`. (Not `'retroactive_correction'` as originally specced — `checkin_audit_log.action` is `varchar(20)` and that string is 22 characters; found this by the column erroring on insert, not by inspection. `'retro_correction'` fits, at 17.)

`notes` is appended (not overwritten) with: `[SYSTEM 2026-07 retroactive correction — see docs/silent-drops-2026-07.md, artifact: <proof note>]`.

## The 74 remaining rows (Mishra, row 19 in the original 75, already applied — see above)

| # | Event | Reg. # | Attendee | Proof used | `checked_in_at` |
|---|---|---|---|---|---|
| 1 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-9561 | Chirag Parikh | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 2 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-3516 | Dhaval Mangukiya | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 3 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-5621 | Harish Chauhan | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 4 | 122 FMAS Skill Course and FMAS Exam | 122A1123 | Ishita Rathore | exam_result=absent, not usable as proof — APPROXIMATE | 2026-03-06T03:30:00Z |
| 5 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-5192 | Kalpesh Jani | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 6 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-8118 | Kedar Patil | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 7 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-9842 | Keyur Bhatt | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 8 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-4232 | Mustaque Qureshi | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 9 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-8149 | Rajesh Kumar Shrivastava | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 10 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-8470 | Rajesh Mahida | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 11 | 122 FMAS Skill Course and FMAS Exam | 122A1083 | Roopa Nagraj | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 12 | 122 FMAS Skill Course and FMAS Exam | 122A1033 | Saili Lad | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 13 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-4320 | Sandeep Sabnis | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 14 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-4519 | Senthilnathan P | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 15 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-2027 | Shaishav Patel | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 16 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-7139 | Sharad Sharma | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 17 | 122 FMAS Skill Course and FMAS Exam | SPK-20260214-6463 | Vikram Lotwala | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 18 | 122 FMAS Skill Course and FMAS Exam | 122A1143 | Vivek Patil | no exam — APPROXIMATE | 2026-03-06T03:30:00Z |
| 20 | 126 FMAS Delhi | 126A1128 | Abhishek Dagar | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 21 | 126 FMAS Delhi | 126A1008 | Hemlata Saxena | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 22 | 126 FMAS Delhi | 126A1228 | Puja Yadav | exam_result=fail ("Absent" remark), not usable as proof — APPROXIMATE | 2026-06-26T03:30:00Z |
| 23 | 126 FMAS Delhi | 126A1068 | Punya Jha | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 24 | 126 FMAS Delhi | 126A1105 | Smriti Yadav | exam_result=fail ("Absent" remark), not usable as proof — APPROXIMATE | 2026-06-26T03:30:00Z |
| 25 | 126 FMAS Delhi | 126A1100 | Sonali Jain | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 26 | 126 FMAS Delhi | 126A1047 | Vijayesh Mokal | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 27 | 126 FMAS Delhi | 126A1108 | Yash Chaudhari | no exam — APPROXIMATE | 2026-06-26T03:30:00Z |
| 28 | 127 FMAS Course | 127A1170 | Kadviben Bhojabhai Chavda | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 29 | 127 FMAS Course | 127A1167 | Sahil Kumar | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 30 | 127 FMAS Course | 127A1169 | Shrey Satyen Samant | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 31 | 127 FMAS Course | 127A1044 | Sneha Ninama | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 32 | 127 FMAS Course | 127A1179 | V Sreeveni | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 33 | 127 FMAS Course | 127A1102 | Vidhi Singh | no exam — APPROXIMATE | 2026-07-03T03:30:00Z |
| 34 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1001 | Akshaya Ashok Kumar | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 35 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1023 | Anshu Singh | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 36 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1020 | Apurv Butiyani | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 37 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1015 | Deepa Ankushe | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 38 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1009 | Diksha Kogurwar | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 39 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1002 | Dinnesh Kandregula | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 40 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1005 | Sharayu Gaikwad | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 41 | AMASI NextGen: Nurturing the Future - YCM HOSPITAL | NG- YCMA1017 | Shweta Inamdar | no exam — APPROXIMATE | 2026-02-14T03:30:00Z |
| 42 | MMAS Hernia | MMAS-BF1001 | Akash Pati | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 43 | MMAS Hernia | MMAS-BF1002 | Amaresh Mishra | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 44 | MMAS Hernia | MMAS-BF1003 | Amit Acharya | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 45 | MMAS Hernia | MMAS-BF1004 | Ashok K Sahoo | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 46 | MMAS Hernia | MMAS-BF1005 | B M Das | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 47 | MMAS Hernia | MMAS-BF1006 | Bana B Mishra | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 48 | MMAS Hernia | MMAS-BF1009 | Bikash Bihary Tripathy | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 49 | MMAS Hernia | MMAS-BF1010 | Bikram Rout | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 50 | MMAS Hernia | MMAS-BF1011 | Biswarup Bose | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 51 | MMAS Hernia | MMAS-BA1047 | Deepak Rashmi Kadam | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 52 | MMAS Hernia | MMAS-BA1037 | Golam Sarwar | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 53 | MMAS Hernia | MMAS-BF1016 | Jayant Biswal | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 54 | MMAS Hernia | MMAS-BF1017 | Jayant Kumar Dash | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 55 | MMAS Hernia | MMAS-BF1022 | Manash Ranjan Sahoo | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 56 | MMAS Hernia | MMAS-BF1023 | Mithilesh K Sinha | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 57 | MMAS Hernia | MMAS-BF1024 | Monika Gureh | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 58 | MMAS Hernia | MMAS-BF1025 | P. Senthilnathan | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 59 | MMAS Hernia | MMAS-BF1026 | Parthasarathi | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 60 | MMAS Hernia | MMAS-BF1028 | Prabhu B | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 61 | MMAS Hernia | MMAS-BF1029 | Pradeep Kumar Singh | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 62 | MMAS Hernia | MMAS-BF1030 | Prakash Kumar Sasmal | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 63 | MMAS Hernia | MMAS-BA1039 | Rahul Ranjan | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 64 | MMAS Hernia | MMAS-BF1034 | Rajesh Kumar Shrivastava | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 65 | MMAS Hernia | MMAS-BF1035 | Ranjit K Sahu | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 66 | MMAS Hernia | MMAS-BF1036 | Rashmi Sahoo | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 67 | MMAS Hernia | MMAS-BF1038 | S Manwar Ali | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 68 | MMAS Hernia | MMAS-BF1039 | Sameer Rege | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 69 | MMAS Hernia | MMAS-BF1040 | Shakti Prasad Sahoo | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 70 | MMAS Hernia | MMAS-BF1041 | Shantanu Kumar Sahu | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 71 | MMAS Hernia | MMAS-BF1043 | Sreejoy Patnaik | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 72 | MMAS Hernia | MMAS-BF1044 | Srikant Patro | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 73 | MMAS Hernia | MMAS-BF1046 | Tamonas Chaudhuri | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 74 | MMAS Hernia | MMAS-BF1047 | Tushar Subhadarshan Mishra | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |
| 75 | MMAS Hernia | MMAS-BF1048 | Varghese C J | no exam — APPROXIMATE | 2026-02-27T03:30:00Z |

Row 60 ("Prabhu B", MMAS-BF1028) shares an email domain pattern with the operator of this session — flagged only so it isn't missed during sign-off; treated identically to the other 74.

## The correction SQL — NOT RUN

```sql
BEGIN;

-- Snapshot exact prior state of the 74 rows before touching them (Mishra
-- already applied standalone, 2026-07-15 — not in this list).
CREATE TABLE retroactive_checkin_correction_2026_07_backup AS
SELECT id, checked_in, checked_in_at, notes
FROM registrations
WHERE id IN (
  '5a719653-251d-4725-aa1a-e7f71857748c','e14676e0-2ea1-45a7-9bb3-5d343afcf510',
  '8eed6621-c6f4-472d-a876-cd74d7d997bc','6a83fadf-eb95-4b66-aae0-5660c318bbe0',
  '02be8730-c586-43d1-9343-8c93cc6760a6','4f2f440c-82d8-4898-8a4a-1038a0888d29',
  'de6a22fa-f474-40a9-be72-76a5cf9c309f','27c5d74b-c5c8-47d3-8209-ca39e18bfa97',
  'a366ffe3-d285-4aa7-b5b3-f07002d63d8d','cfaef945-b05b-4da7-b798-7cbb9a42c0a6',
  '0daa9d1a-5da5-4afe-8c45-534138b52cc7','9fe47122-1e90-4f33-b38b-d743a6a93d14',
  '2739c9f9-c3af-4c4e-8c94-dbac2da6669c','38ab87f1-67c7-48e0-ada0-f12dc0a7f283',
  'b19dae43-3402-40b8-9ea5-b0c39e7dda5c','bacbda57-7c29-4b7e-859c-3f872e2002b6',
  '4e700e8b-3253-4483-ad59-9fa53bdb2f8b','baace564-105c-4954-b450-97bab82a6e8c',
  '5b4dbbca-85a6-406f-b676-b321fe67a864','132a51b3-f003-4f55-b16d-7c4c3440615b',
  '1d9c7a7e-f2e1-445c-a161-b2b5cd348df2','996560bd-c127-4bbc-8446-13004e8c018f',
  '514cabac-76c0-49bc-b874-c92f6d78c940','4cb383f4-2efa-4ccf-8656-cb74cc1c7d99',
  '56eee2d0-b350-4e61-8810-ca7b0fc8dc52','a54f06c7-fc47-46de-bffb-3f556a47fce9',
  '5e08ba40-bd50-41ff-b885-5e6efa2a0189','6cc964e8-ad35-4a93-8454-ce22988005c6',
  '8053b3a4-df02-4e88-8bee-bb57bd5646b6','7838529a-51dd-47be-8d95-033536b598c9',
  '48732094-6ab1-472d-a76f-31200f91b076','6198a24b-0f00-4019-b969-c94e9f6eba02',
  '982423d6-5d4c-4be9-a225-8abe111b519d','ffa2c991-545d-4109-b036-2b9749743322',
  'a1c5255f-413d-405c-8694-29864140e40c','2f125dee-c10e-445e-a6f9-148b898d9988',
  'b3a18cba-9730-421b-80ca-31eea54bef43','1b253e34-bc72-45a3-9cc1-f4b4b3e2cc83',
  '37f3e80c-0c64-42a2-a362-a97c59b1835f','82bcac88-7dcb-48f6-8902-fee65f931901',
  '81837d94-382c-4151-a724-776b1a923f87','22eb2800-9113-4bf5-872a-0189d78e2b96',
  'e51794f7-a529-4a2d-babb-b07bb9eda607','3872f561-5c39-4a9b-a438-58e73fa0c98f',
  'f6ee5401-5729-4a46-a3ed-2db28bf6ac57','703af897-f7b3-46bb-a9e4-baf3ca7db6c7',
  'af182a66-9c89-4433-bd54-93caa3199087','da448ffc-cb2a-4553-99c6-4c73e3919aad',
  'bf766a29-c184-4eb0-9f99-45c0c21532c2','223aac45-9e43-4727-a035-c7067de3dd29',
  'ac9c62e8-4aa7-4dd1-b8d7-d40af35ea57a','35374c60-4f55-47bd-b05d-af2dcc2422eb',
  '800bd6e3-c575-4c7d-b090-8b104647d970','cc30279d-2921-4424-9bc3-84184c80281e',
  '07a4466b-0c1b-4c3d-b880-469ece2b50d6','f17e8ffb-caae-4590-a5c7-716acbf58350',
  '18f25e9b-4c21-46ed-aca2-0485a08bb04a','40a769c7-1173-4723-8ff7-77c0522a49d6',
  'b1de4243-29e4-4c80-8c6e-fe6b6be84c6d','67078bb1-2571-44ee-ab4c-1d72b8d95f2c',
  '2e088a22-d1ed-4d35-8784-f462791e8f57','6f575164-f860-4d69-b56e-e86678c1cccc',
  'e0533412-eada-4137-8b4f-659c572e1969','cd8bae43-ef3d-4732-b1c6-6dc02fcd2258',
  '40320d8a-eacf-4744-b894-6aca029a4faa','9cba2025-3211-4fbf-b1c2-b1477e5144f0',
  '7d7cf905-5b88-430e-892e-5cd5d086f7c7','0d0aa845-479c-44c9-aceb-371261f41f9e',
  'cfe19f35-07a7-4cfe-a0be-e3933a0cdeb7','08ddfe9c-6ca9-4544-a5d1-7aadc438d67f',
  'ff1d587c-2a53-42d5-99f7-cc0e0ab2effc','f4865678-58ee-44db-8180-3f2a5f4a2c7a',
  '25bb70d9-2c73-4e92-a658-0eff3b411c64','3d944fef-692f-4f23-99d7-34a6ec786acb'
);
-- Sanity check: must read exactly 74. If it doesn't, STOP.
-- SELECT count(*) FROM retroactive_checkin_correction_2026_07_backup;

CREATE TEMP TABLE corrections_2026_07 (
  registration_id uuid, event_id uuid, checked_in_at timestamptz, approximate boolean, proof_note text
);
INSERT INTO corrections_2026_07 (registration_id, event_id, checked_in_at, approximate, proof_note)
VALUES
  ('5a719653-251d-4725-aa1a-e7f71857748c'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('e14676e0-2ea1-45a7-9bb3-5d343afcf510'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('8eed6621-c6f4-472d-a876-cd74d7d997bc'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('6a83fadf-eb95-4b66-aae0-5660c318bbe0'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'exam_result=absent, not usable as attendance proof'),
  ('02be8730-c586-43d1-9343-8c93cc6760a6'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('4f2f440c-82d8-4898-8a4a-1038a0888d29'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('de6a22fa-f474-40a9-be72-76a5cf9c309f'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('27c5d74b-c5c8-47d3-8209-ca39e18bfa97'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('a366ffe3-d285-4aa7-b5b3-f07002d63d8d'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('cfaef945-b05b-4da7-b798-7cbb9a42c0a6'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('0daa9d1a-5da5-4afe-8c45-534138b52cc7'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('9fe47122-1e90-4f33-b38b-d743a6a93d14'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('2739c9f9-c3af-4c4e-8c94-dbac2da6669c'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('38ab87f1-67c7-48e0-ada0-f12dc0a7f283'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('b19dae43-3402-40b8-9ea5-b0c39e7dda5c'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('bacbda57-7c29-4b7e-859c-3f872e2002b6'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('4e700e8b-3253-4483-ad59-9fa53bdb2f8b'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('baace564-105c-4954-b450-97bab82a6e8c'::uuid,'9f1e659b-6809-4502-b3c1-b0a98175e813'::uuid,'2026-03-06T03:30:00Z'::timestamptz,true,'no exam record'),
  ('5b4dbbca-85a6-406f-b676-b321fe67a864'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('132a51b3-f003-4f55-b16d-7c4c3440615b'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('1d9c7a7e-f2e1-445c-a161-b2b5cd348df2'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'exam_result=fail ("Absent" remark), not usable as attendance proof'),
  ('996560bd-c127-4bbc-8446-13004e8c018f'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('514cabac-76c0-49bc-b874-c92f6d78c940'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'exam_result=fail ("Absent" remark), not usable as attendance proof'),
  ('4cb383f4-2efa-4ccf-8656-cb74cc1c7d99'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('56eee2d0-b350-4e61-8810-ca7b0fc8dc52'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('a54f06c7-fc47-46de-bffb-3f556a47fce9'::uuid,'8e497ba9-f83b-4a66-9be5-1714f0d8669b'::uuid,'2026-06-26T03:30:00Z'::timestamptz,true,'no exam record'),
  ('5e08ba40-bd50-41ff-b885-5e6efa2a0189'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('6cc964e8-ad35-4a93-8454-ce22988005c6'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('8053b3a4-df02-4e88-8bee-bb57bd5646b6'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('7838529a-51dd-47be-8d95-033536b598c9'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('48732094-6ab1-472d-a76f-31200f91b076'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('6198a24b-0f00-4019-b969-c94e9f6eba02'::uuid,'81d9da71-c745-4897-bb47-f363207a6223'::uuid,'2026-07-03T03:30:00Z'::timestamptz,true,'no exam record'),
  ('982423d6-5d4c-4be9-a225-8abe111b519d'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('ffa2c991-545d-4109-b036-2b9749743322'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('a1c5255f-413d-405c-8694-29864140e40c'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('2f125dee-c10e-445e-a6f9-148b898d9988'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('b3a18cba-9730-421b-80ca-31eea54bef43'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('1b253e34-bc72-45a3-9cc1-f4b4b3e2cc83'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('37f3e80c-0c64-42a2-a362-a97c59b1835f'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('82bcac88-7dcb-48f6-8902-fee65f931901'::uuid,'9411e669-9280-46a7-be7f-e02dd1e5767f'::uuid,'2026-02-14T03:30:00Z'::timestamptz,true,'no exam record'),
  ('81837d94-382c-4151-a724-776b1a923f87'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('22eb2800-9113-4bf5-872a-0189d78e2b96'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('e51794f7-a529-4a2d-babb-b07bb9eda607'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('3872f561-5c39-4a9b-a438-58e73fa0c98f'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('f6ee5401-5729-4a46-a3ed-2db28bf6ac57'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('703af897-f7b3-46bb-a9e4-baf3ca7db6c7'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('af182a66-9c89-4433-bd54-93caa3199087'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('da448ffc-cb2a-4553-99c6-4c73e3919aad'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('bf766a29-c184-4eb0-9f99-45c0c21532c2'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('223aac45-9e43-4727-a035-c7067de3dd29'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('ac9c62e8-4aa7-4dd1-b8d7-d40af35ea57a'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('35374c60-4f55-47bd-b05d-af2dcc2422eb'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('800bd6e3-c575-4c7d-b090-8b104647d970'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('cc30279d-2921-4424-9bc3-84184c80281e'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('07a4466b-0c1b-4c3d-b880-469ece2b50d6'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('f17e8ffb-caae-4590-a5c7-716acbf58350'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('18f25e9b-4c21-46ed-aca2-0485a08bb04a'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('40a769c7-1173-4723-8ff7-77c0522a49d6'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('b1de4243-29e4-4c80-8c6e-fe6b6be84c6d'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('67078bb1-2571-44ee-ab4c-1d72b8d95f2c'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('2e088a22-d1ed-4d35-8784-f462791e8f57'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('6f575164-f860-4d69-b56e-e86678c1cccc'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('e0533412-eada-4137-8b4f-659c572e1969'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('cd8bae43-ef3d-4732-b1c6-6dc02fcd2258'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('40320d8a-eacf-4744-b894-6aca029a4faa'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('9cba2025-3211-4fbf-b1c2-b1477e5144f0'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('7d7cf905-5b88-430e-892e-5cd5d086f7c7'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('0d0aa845-479c-44c9-aceb-371261f41f9e'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('cfe19f35-07a7-4cfe-a0be-e3933a0cdeb7'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('08ddfe9c-6ca9-4544-a5d1-7aadc438d67f'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('ff1d587c-2a53-42d5-99f7-cc0e0ab2effc'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('f4865678-58ee-44db-8180-3f2a5f4a2c7a'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('25bb70d9-2c73-4e92-a658-0eff3b411c64'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record'),
  ('3d944fef-692f-4f23-99d7-34a6ec786acb'::uuid,'8db2c778-c96d-46da-ac20-00604e764853'::uuid,'2026-02-27T03:30:00Z'::timestamptz,true,'no exam record');

-- Sanity check: must read exactly 74. If it doesn't, STOP.
-- SELECT count(*) FROM corrections_2026_07;

UPDATE registrations r
SET
  checked_in = true,
  checked_in_at = c.checked_in_at,
  notes = COALESCE(r.notes || E'\n', '')
    || '[SYSTEM 2026-07 retroactive correction — see docs/silent-drops-2026-07.md, artifact: ' || c.proof_note
    || CASE WHEN c.approximate THEN '. APPROXIMATE — reconstructed, no precise attendance evidence.' ELSE '.' END
    || ']'
FROM corrections_2026_07 c
WHERE r.id = c.registration_id;

INSERT INTO checkin_audit_log (event_id, checkin_list_id, registration_id, action, performed_by, performed_via, success)
SELECT c.event_id, NULL, c.registration_id, 'retro_correction',
  'SYSTEM: retroactive correction 2026-07 (scanner defect)', 'admin_backfill', true
FROM corrections_2026_07 c;

DROP TABLE corrections_2026_07;

-- STOP HERE. Verify counts before committing:
-- SELECT count(*) FROM registrations WHERE checked_in = true AND notes ILIKE '%retroactive correction%'; -- expect 74 (Mishra already applied, separate row)
-- SELECT count(*) FROM checkin_audit_log WHERE action = 'retro_correction'; -- expect 75 total (74 from this run + Mishra's already-applied row)

COMMIT;
```

## Undo — single reversible script

```sql
BEGIN;

UPDATE registrations r
SET checked_in = b.checked_in,
    checked_in_at = b.checked_in_at,
    notes = b.notes
FROM retroactive_checkin_correction_2026_07_backup b
WHERE r.id = b.id;

-- Note: this deletes ONLY the 74 audit rows from this batch run. Mishra's
-- audit row (already applied standalone) shares the same performed_by string
-- but is NOT in retroactive_checkin_correction_2026_07_backup, so undoing
-- this batch will not touch him — that's intentional; undo him separately
-- if needed (see the note in "What this corrects" above for his prior state).
DELETE FROM checkin_audit_log
WHERE action = 'retro_correction'
  AND performed_by = 'SYSTEM: retroactive correction 2026-07 (scanner defect)'
  AND registration_id IN (SELECT id FROM retroactive_checkin_correction_2026_07_backup);

DROP TABLE retroactive_checkin_correction_2026_07_backup;

COMMIT;
```

## Before this runs

- [ ] Hon. Secretary sign-off
- [ ] Confirm the 3 flagged rows (Ishita Rathore, Puja Yadav, Smriti Yadav) should be treated as "no usable exam proof" per my reasoning above, not some other treatment
- [ ] Confirm IST is the right "local" for all 6 events
- [ ] Separately confirm Mishra's certificate has been issued (tracked outside this file)
- [ ] After sign-off, run the backup-table count check (=75) before the UPDATE/INSERT, and both post-run count checks (=75) before COMMIT
