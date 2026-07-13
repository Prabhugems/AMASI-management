# Queue mode (items 4+6) — scope confirmation, before building

Written to a file per your instruction — nothing pasted to terminal. This is the full Q1–Q6 scope for the combined 4+6 PR, restated in one place so nothing drops out of a chat reply again.

- [ ] **Q1 — camera never stops.** No `stopScanner()` call tied to a result being shown. The camera runs continuously from mount until the volunteer navigates away.
- [ ] **Q2 — delete the global `scanCooldownRef`.** Replaced by `Map<code, timestamp>`: same code seen again within 60s → ignored. Any other code → processed instantly, no throttle, no wait. This is the change that makes 20-cards-in-20-seconds possible; every other change is secondary to this one.
- [ ] **Q3 — scan feed, not a result screen.** Replaces `lastResult` (singular) with a `scanFeed: FeedEntry[]`, capped at ~10, newest on top. No dismiss button, no auto-continue timer, nothing to clear — nothing "takes over" the screen. The camera view and the feed are both visible at once, permanently.
- [ ] **Q4 — tone fires on decode, not on server response.** The sound plays the instant a code is accepted by the Map check (Q2), before the `/api/verify` round-trip resolves. In a burst, the volunteer is listening, not watching, and needs the tone tied to "the camera saw something," not "the network replied."
- [ ] **Q5 — every feed entry keyed to its scanned code.** No entry is ever "whatever the last response happened to be" — each `FeedEntry` carries the code (or resolved `registration_id`) it came from, set at creation and never overwritten by an unrelated later response.
- [ ] **Q6 — a session counter, and it is NOT the stats bar.**
  - Existing stats bar = check-ins recorded against the **list**: "450 / 2,000". Server truth, shared across every device scanning that list.
  - Q6 = scans accepted on **this device, this session**: "Scanned: 17". Client-side, per-device, resets on reload.
  - These stay on screen **simultaneously**, both visible at all times. One is not a substitute for the other: if a card is silently dropped (per the telemetry above), the list total is just quietly lower — nobody is watching a shared aggregate closely enough to notice one missing delegate. Only a session count the volunteer can check against the physical stack in their hand ("I scanned 20, it says 17") surfaces a silent miss in real time. That comparison is the entire point of Q6 and cannot be done with the stats bar alone.

## Also in this PR (item 6, unchanged from earlier)
- Hard-gated volunteer name + desk label modal on first open of the access link (per your explicit call — no skip option), with a "change" link in the header to correct a typo without reloading.
- Persisted to `localStorage` keyed by access token, sent as `performed_by`/`device_info` on every `/api/verify` call and every offline-queue flush.
- Feeds the "Desk 2" slot already reserved in the amber "ALREADY CHECKED IN" card's copy (shipped in #101) — currently that card only shows a timestamp.

## Also confirmed
- Full 5s/1.5s dismiss timing and the `AUTO_CONTINUE_MS`/`SCAN_REPEAT_WINDOW_MS` pair are deleted entirely, not tuned. Queue mode has no "hold" concept at all.
- No schema changes needed for 4+6 (unlike the amber hotfix, which needs the `list_purpose` column).
- Offline behavior unchanged in spirit — the per-code Map and the feed are client state; actual check-ins still go through the existing `enqueueScan`/`flushQueue` IndexedDB path from the offline scan queue.
- The searchable attendee list (original item 4 framing) ships as a **second tab**, not the home screen. Queue mode (camera + feed + counters) is the default view on open.

## Status of everything else in flight
- **#102** (neutralize `allow_multiple_checkins`) — merged, deployed.
- **#103** (types regen, 20 errors fixed) — merged, deployed.
- **Amber hotfix (`list_purpose`)** — still blocked on your entry/collection classification of the 18-list backfill table in `docs/audit-2026-07.md`. Ships first, per your explicit order, once that comes back.
- **Telemetry** — delivered in `docs/telemetry-burst-scan-2026-07.md` (two-card handoff test + the 20-card burst you asked for this round: 3 of 20 actually recorded, 17 silently dropped).
- **Audit numbers** (wrong_event count, the 2,205 delta histogram) — in `docs/audit-2026-07.md`, committed to `main` at `3ce07ad`.

Order stands: amber hotfix → (types regen, already merged) → 4+6 with Q1–Q6. Waiting on your classification to start the amber hotfix; once that's done, this file is the spec I'll build 4+6 from unless you want to change something in the checklist above.
