# Burst-scan telemetry — confirms the silent-miss bug (2026-07-13)

Investigation for the queue-mode rebuild (items 4+6, Q1–Q6). Instrumented the real decode-gating logic temporarily (not committed — reverted after this run), reproduced with disposable fixtures in the shared Supabase project, cleaned up afterward. No code changes shipped from this file; it's a report only.

## What was instrumented

- Every camera decode attempt: the code, timestamp, whether the camera was actually armed (`__cameraArmed`, toggled by the real `startScanner`/`stopScanner`/`handleScan` camera-stop calls — not simulated), cooldown state, repeat-window state, and the resulting verdict.
- A test hook (`window.__debugFeedDecode`) that drives the real, unmodified `handleCameraDecode` closure — the actual production gating logic, not a reimplementation.

## Test 1 — two-card handoff (earlier, smaller run)

Card 1 scanned, then repeatedly "re-sighted" (simulating it lingering in the volunteer's hand) up to and past the 7-second repeat-window:

```
t≈0ms     CARD1 decoded → ACCEPTED → POST /api/verify/CARD1 → 200 OK
t≈5100ms  CARD1 re-sighted → SUPPRESSED_REPEAT_WINDOW (5102ms < 7000)
t≈5900ms  CARD1 re-sighted → SUPPRESSED_REPEAT_WINDOW (5902ms)
t≈6900ms  CARD1 re-sighted → SUPPRESSED_REPEAT_WINDOW (6901ms — still just under)
t≈7100ms  CARD1 re-sighted → msSinceLast:7101 (>7000) → ACCEPTED (again!)
                → POST /api/verify/CARD1 → 200 OK  (2nd hit on the same badge)
t≈7150ms  CARD2 presented → cooldownActive:true → SUPPRESSED_COOLDOWN
                → NO network request. Ever. For this pass.
```

Confirmed via the network log: exactly two `POST /api/verify/CARD1` requests, zero for CARD2's token, for the whole run.

## Test 2 — realistic 20-card burst (this round, the one you asked for)

20 distinct registrations, each "presented" to the camera for ~600ms (4 decode attempts at 150ms apart, matching the scanner's `fps: 10`), then swapped to the next card — a volunteer flipping through a stack at a natural, fast pace. Total real elapsed time: **12.36 seconds** for all 20 presentations (~618ms/card). Real wall-clock timers throughout (not accelerated or frozen).

**Result: 3 of 20 cards actually got checked in. 17 of 20 (85%) never did.**

| Metric | Count |
|---|---|
| Physical card presentations | 20 |
| Total decode attempts (4 per card) | 80 |
| `ACCEPTED` (reached `/api/verify`) | distinct: **3** |
| `NOT_FED_CAMERA_OFF` (camera literally not capturing at that instant) | 59 |
| `SUPPRESSED_COOLDOWN` | 20 |
| `SUPPRESSED_REPEAT_WINDOW` | 0 (never got that far) |

Verified independently against the database — `checkin_records` for this fixture's event:

| registration_number | checked_in_at |
|---|---|
| ZZTEST-B01 | 11:13:52.366 |
| ZZTEST-B13 | 11:13:58.652 |
| ZZTEST-B16 | 11:14:00.452 |

Cards 2–12, 14–15, 17–20 (17 of 20) have **no checkin_records row at all**. There is no error, no red screen, no failed-scan entry anywhere — those decode attempts simply never reached the camera's active window (`NOT_FED_CAMERA_OFF`), because the camera is switched off for the ~5 seconds after every accepted scan and again during the ~2 second cooldown. A volunteer physically waving 20 badges past the lens in 12 seconds gets **3 confirmations and 17 silences** — and nothing on screen distinguishes "silently missed" from "just hasn't been scanned yet."

## Conclusion

Confirms your diagnosis on all four points, and confirms it's worse than the two-card test alone suggested:

1. **`AUTO_CONTINUE_MS`/camera-stop-on-result is the dominant effect** — 59 of 80 attempts (74%) never even reached the decode-gating logic, because the camera hardware itself was off. This is the majority failure mode in a real burst, not the 7-second stale-rescan edge case (which Test 1 isolated separately).
2. **The global `scanCooldownRef` compounds it** — every accepted scan (including a stale re-trigger) imposes a further 2s window during which even a *different* card is dropped.
3. **The repeat-window (7s) mechanism is real but secondary** in a fast burst — most cards never survive long enough in the cycle to reach that check at all.
4. **Card-drop is silent and total** — no error state, no audit log row, no visible distinction from "not yet scanned." A volunteer has no way to know 17 of 20 delegates in this run walked in unregistered.

This is the quantified case for Q1/Q2 (camera never stops; per-code map, not a global cooldown) and Q6 (a session counter is the only thing that would have made this visible in real time — "Scanned: 20" vs the list showing 3 would have been an immediate, visible red flag).
