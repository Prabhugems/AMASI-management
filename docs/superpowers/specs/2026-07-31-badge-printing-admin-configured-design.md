# Badge printing — admin configures, volunteer just scans

**Date:** 31 July 2026
**Supersedes:** any design where the volunteer chooses a printer type

---

## 1. The principle

Every printing decision requires the printer physically in front of you —
paper size, whether the stock is blank or pre-printed, whether the template
fits. That is done once, weeks ahead, by the admin, with time to reprint and
adjust.

A volunteer with a queue in front of them has none of those things and must
not be asked. **The volunteer picks nothing about printing.** They connect
the cable, test once, then scan.

The admin hands over a tablet and a printer as a working unit.

---

## 2. Two print paths — both required

Only the first exists today, which is why an HP LaserJet silently failed.

### Path A — thermal, raw

Raw ESC/POS (or ZPL) over WebUSB, as built. Fast, no dialog. For thermal
label printers: DCode DC421 Pro, Zebra ZD230, and similar.

### Path B — any other printer

Render the badge as a correctly sized HTML page and call `window.print()`.
Goes through the operating system's print system, so it works with **any**
printer the device knows about — laser, inkjet, network. Shows a print
dialog.

This is the universal fallback from the original hardware plan and was never
built.

**The badge must come out the correct physical size in both paths.** Set the
page size in CSS `@page` for path B; do not rely on the print dialog's
scaling.

---

## 3. Admin settings — per station

Added to the station configuration. Keep this list short. Three things:

1. **Printer type** — Thermal (fast, no dialog) or Any other printer
   (browser print)
2. **Label / paper size** — width and height, with common presets
   (4×3", 4×6", A6)
3. **Badge template** — including whether the stock is blank or pre-printed

Do not add more options than these. Every extra setting is something to get
wrong at 11pm the night before the tablets ship.

`auto_print` stays as it is — on by default.

---

## 4. What the volunteer sees

1. Pick the job from the menu (a printer icon marks jobs that print)
2. **Printer screen** — connect the USB cable, tap Test Print, confirm a
   badge came out
3. Scan — the badge prints automatically

No printer type choice. No size choice. No template choice. Those are already
decided and must not be visible or changeable on the tablet.

### Printer screen requirements

- Appears **before** scanning starts, when a print-enabled job is picked —
  not on the success card after the first scan. The volunteer must never
  discover a printer problem with a delegate already standing there.
- **Test Print asks for confirmation**: "Did a badge come out?" Yes / No.
  Only Yes marks the printer ready. Bytes leaving over USB is not proof —
  the LaserJet accepted ESC/POS bytes at the transport level and reported
  success while printing nothing.
- **Skip** is allowed. Check-in still works; badges print later.
- Show the admin's phone number on this screen. The volunteer cannot fix a
  wrong setting and needs to know who to call.

### On the scan screen

Printer state lives in the persistent footer alongside queue depth and
online/offline. A mid-shift disconnection must be visible **before** the next
scan, not after it.

Two states only: **Printer ready**, or **Printer problem — call for help**.
Nothing in between. The volunteer cannot diagnose, so do not ask them to.

---

## 5. Print failure — the check-in still succeeded

If the badge fails to print, the delegate **is** checked in. The screen must
not read like the check-in failed, or the volunteer will rescan and create a
duplicate on top of a jam.

> **Checked in — badge did not print**
>
> Dr Ananya Deshmukh
>
> Check the printer: labels loaded, cable connected, lid closed.
>
> [Print again]   [Skip and continue]

"Skip and continue" matters: at a busy desk the volunteer must be able to
move on and sort the badge out later.

---

## 6. Reprint

Auto-print is on, so the volunteer needs a way to reprint after a jam or
misfeed. A persistent **Reprint last badge** action on the success and ready
screens — small, cornered, not competing with the scan flow.

Show what will reprint: "Reprint badge for Dr Ananya Deshmukh".

---

## 7. Print must be local-first

Same rule as the scan. The badge renders from the **cached delegate record**
and goes to the printer with **no network call**. If the print path fetches
anything from the server, the offline work in Stage 1 is undone — the scan
would succeed offline and the badge would never come out.

Applies to both paths.

---

## 8. Acceptance tests

1. Thermal printer, auto-print on → badge prints, correct physical size, no
   dialog
2. Non-thermal printer configured as "Any other printer" → badge prints
   through the OS at the correct size
3. Test Print with a printer that cannot print → volunteer answers No →
   printer is **not** marked ready
4. Printer unplugged mid-shift → footer shows the problem before the next
   scan
5. Print fails → check-in is still recorded; screen does not read as a
   check-in failure; Skip and continue works
6. **Offline** → badge still prints, from cached data, no network call
7. Collection job (Lunch) on a print-enabled station → no printer UI, no
   badge, as already verified
8. Reprint produces an identical badge

---

## 9. Out of scope

- Network printers on a different network from the tablet
- Volunteer-editable print settings of any kind
- More than the three admin settings in §3
