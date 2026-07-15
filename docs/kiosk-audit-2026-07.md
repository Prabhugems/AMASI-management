# Kiosk audit against PRs #101–#105 — 2026-07-14

You asked whether `/api/kiosk/checkin` (the unattended self-check-in kiosk, `src/app/kiosk/[eventId]/[listId]/page.tsx`) is carrying any other pre-#101/#104/#105 defect. Checked all five.

## #101 — already-checked-in is a success, not an error; wrong-event guard
**Already fixed, independently.** `src/app/api/kiosk/checkin/route.ts:76-92` already returns `success:true, alreadyCheckedIn:true` on a repeat scan — this route never had the #101 bug. Wrong-event is structurally impossible here rather than separately guarded: the registration search itself is scoped `.eq("event_id", eventId)` (line 56), so there's no code path that can return a registration from a different event in the first place.

## #102 — neutralize `allow_multiple_checkins`, catch the 23505
**Already fixed.** Lines 70-92 (existing-record check, ignores the flag) and 105-117 (23505 caught, treated as a successful idempotent check-in) both match the #102 pattern exactly, with a comment citing it. Your fear that this route "may still hard-error on a repeat" isn't borne out by the code — it doesn't.

One loose end: the *frontend* still fetches `allow_multiple_checkins` in its list query (`src/app/kiosk/[eventId]/[listId]/page.tsx:90`) but never reads it anywhere in the component. Dead, harmless, consistent with the CLAUDE.md note that the column itself is scheduled for a post-AMASICON drop.

## #103 — types regen
Not applicable per-route; this route doesn't touch any of the tables/columns that were affected by the stale-types fallout.

## #104 — `list_purpose` entry/collection
**Was missing — fixed today.** The route never read `list_purpose` at all. Per your call (lean b), I didn't port the full amber-card two-branch UI (option a) — I hard-blocked instead: `src/app/api/kiosk/checkin/route.ts:39-47` now returns `403` with "Self check-in isn't available for this list. Please see a staff member." for any list where `list_purpose = 'collection'`, before any registration lookup happens. Verified the frontend handles this correctly without changes — `handleCheckin` (`page.tsx:162`) parses the JSON body unconditionally regardless of HTTP status and renders `data.message` verbatim, so the 403 message displays exactly as intended.

Not done, optional: the frontend doesn't fetch `list_purpose` itself, so a delegate can still type an entry and get rejected rather than the page proactively hiding the input for a collection list. Backend block is airtight either way; this would just be a UX polish (show "see staff" upfront instead of after one failed attempt). Didn't do it to keep this landed today — say the word if you want the upfront version too.

## #105 — queue mode (continuous camera, per-code dedup, feed, session counter)
**Not applicable — different input mechanism entirely, not a gap.** This page has no camera/QR-decode loop at all (confirmed: no `Html5Qrcode` or video element anywhere in the file). "Scan" here means a hardware barcode/QR scanner emulating a fast keyboard burst into a text input, auto-submitted via keystroke-timing detection (`page.tsx:238-259`, `MANUAL_MIN_LEN`/`SCANNER_MAX_AVG_GAP_MS`/`AUTO_SUBMIT_IDLE_MS`). The specific bug #105 fixed — the camera decode loop silently stopping mid-burst — has no equivalent here because there's no camera loop to stop. Each hardware scan is one complete HTTP round-trip, independent of any others; nothing about volume/speed can silently drop a scan the way it did on the staff scanner.

## Bottom line
Only one real gap existed (#104, list_purpose) and it's fixed — kiosk is now entry-only by design, permanently, per your lean (b). Everything else you were worried about (repeat-scan 500, allow_multiple_checkins) was already handled before today.
