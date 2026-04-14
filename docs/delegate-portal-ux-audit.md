# Delegate Portal (`/my`) — UX Audit

**Date:** 2026-04-14
**Scope:** `src/app/my/page.tsx` (~2700 lines), `/my/addons` sub-page
**Live:** collegeofmas.org.in/my

---

## 1. Search / Entry View

### Pain Points

| Issue | Severity | Detail |
|-------|----------|--------|
| **Generic "AI slop" aesthetic** | High | Purple-on-dark gradient, generic User icon, indigo accent — indistinguishable from every AI-generated landing page. No brand identity (AMASI logo, org colors, surgical/medical context). |
| **No input type hints** | Medium | Single text input for email/phone/reg# but no `inputMode` attribute. Mobile users get a full QWERTY keyboard even when typing a phone number. No smart detection to toggle keyboard. |
| **Error state is weak** | Medium | Red box inside the white card is easy to miss. No animation or shake to draw attention. Error clears only on next submission, not on re-typing. |
| **Pending payments block is overwhelming** | High | When a payment is pending, the search form card balloons with amber boxes, verify forms, Razorpay ID inputs — all crammed into the same card. First-time users see a wall of text before they even understand what happened. |
| **No recent lookup memory** | Low | Delegates visit this page repeatedly (before event, during check-in, after event for certificate). No localStorage memory of their last lookup to auto-fill. |
| **Ambient orbs are decorative noise** | Low | Two blurred circles add nothing to comprehension or brand. They pulse on separate timers creating subtle visual jitter. |

### Mobile Responsiveness

- Input is `text-lg text-center` which is fine, but the `py-4` button below it creates a 56px touch target stacked directly below — no breathing room.
- On screens < 375px the "Enter your Email, Phone, or Registration Number" label wraps awkwardly to 3 lines.
- The pending payment verify form has a `font-mono` Razorpay ID input that overflows on narrow screens.

### Visual Hierarchy

- The User icon in the glass square is the largest visual element but communicates nothing. The eye goes: icon → title → subtitle → form. Should be: title → subtitle → form (the action).
- "AMASI Command Center" title from the page metadata conflicts with the on-page "Delegate Portal" heading — two different names for the same thing.
- The gradient button and the white card fight for attention equally — button should dominate.

---

## 2. Multiple Events Selection View

### Pain Points

| Issue | Severity | Detail |
|-------|----------|--------|
| **No visual differentiation between events** | High | All event cards look identical — white rectangles with the same layout. When a delegate has 3-4 registrations, they scan by reading text only. No color coding, no status indicators, no date proximity hints. |
| **Back button says "Search again" with a rotated ArrowRight** | Low | Using `ArrowRight` with `rotate-180` instead of `ArrowLeft` is a code smell and the text "Search again" implies the first search failed. Should be "Back" or "New lookup". |
| **No event status context** | Medium | Cards show date and city but not whether the event is upcoming, ongoing, or past. A delegate with 4 registrations can't quickly find "the one happening tomorrow." |
| **Pending payments section is duplicated** | Medium | Same amber payment block from the search view appears here too, but with no actionability — just says "Select a registration above to verify." Confusing redundancy. |

### Mobile Responsiveness

- Event cards are fine on mobile (full-width, good tap targets).
- The `max-w-lg` container works well here.

### Visual Hierarchy

- The Calendar icon in the header is generic. Should reflect the count or the user's identity.
- Registration number (`font-mono text-xs text-gray-400`) is too de-emphasized — delegates often identify events by reg number, not name.

---

## 3. Delegate Detail View

### Pain Points

| Issue | Severity | Detail |
|-------|----------|--------|
| **Massive monolithic scroll** | High | The detail view is a single endless scroll with 10+ sections. No tabs, no anchoring, no visual separation between "your info" and "actions." Delegates looking for their certificate must scroll past QR code, status rows, addons, abstracts, and feedback forms. |
| **Download buttons grid is buried** | High | The most-used actions (download badge, download certificate) are in a 2-4 column grid in the middle of the page, below the delegate card, abstracts section, AND feedback forms. Delegates have to scroll significantly to find them. |
| **Certificate gating UX is confusing** | High | Certificate button shows "Submit feedback first" but the feedback form is ABOVE the button in the scroll order. The delegate sees the locked button, doesn't know what to do, scrolls UP, finds the form, submits it, then scrolls DOWN again. No visual connection between cause and effect. |
| **QR code is always visible (when not checked in)** | Medium | The QR code takes significant vertical space in the delegate card. Before the event day, it's useless. Only becomes relevant at the venue. Should be collapsible or date-aware. |
| **Pull-to-refresh fights with scroll** | Medium | On mobile, pull-to-refresh via Framer Motion drag can conflict with native scroll and browser pull-to-refresh. The `touch-pan-x` class only prevents horizontal interference. |
| **Status rows use inconsistent spacing** | Low | Some rows have `border-b border-gray-100`, the last one doesn't. The payment retry block breaks the row pattern with a colored background box. |
| **Floating help button overlaps content** | Medium | Fixed bottom-right FAB with pulsing red dot is always visible, even when the user is actively reading the help section. It also overlaps the last few lines of content on shorter screens. |
| **`alert()` used for payment errors** | Medium | `handleRetryPayment` uses `alert()` for success/failure messages instead of the toast system used everywhere else. Jarring inconsistency. |
| **Abstract section uses raw `any` types everywhere** | Low | Not a UX issue per se, but the abstracts and feedback components are full of `any` types suggesting they were bolted on quickly. Edge cases likely not handled. |

### Mobile Responsiveness

- Download buttons grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` — on mobile (2 cols), if there are 5 buttons (invitation, badge, cert, FMAS, receipt), the last one sits alone and looks odd.
- Certificate dispatch banner: the `sm:flex-row` responsive change means on mobile it stacks vertically, but the "Fill Now →" button becomes full-width which is actually good.
- Event banner is only `h-20` on mobile — almost invisible. Logo overlap at `-mt-12` means the logo sits mostly in the banner area, cutting into it awkwardly on small screens.
- Countdown timer numbers (`text-2xl sm:text-3xl`) are fine, but the colon separators are vertically misaligned with the numbers.

### Visual Hierarchy

- The delegate's name and avatar get the most visual weight, but after the first visit this is the least useful information. The delegate already knows who they are — they need actions.
- Registration number in the dashed box is prominent (good) but competes with the QR code section directly below.
- Download buttons all look identical in weight — Badge, Certificate, Invitation, Receipt all have the same card size, icon size, and emphasis. Certificate (the most-wanted item post-event) should be visually louder.
- The "Need Help?" section is visually similar to the other white cards but serves a fundamentally different purpose (support vs. information). No visual differentiation.

---

## 4. Component-Level Improvement Opportunities

### `CheckinQRCode`
- Renders to canvas without any fallback. If QRCode lib fails, nothing shows.
- Fixed `size={160}` doesn't scale with screen size.
- No "tap to enlarge" for venue scanning.

### `PullToRefresh`
- Uses Framer Motion `useMotionValue` which is heavy for this purpose.
- The spinner overlay is `absolute top-0` which can cause layout shift.
- No visual cue that pull-to-refresh is available (users don't discover it).

### `FloatingHelpButton`
- Red dot with `animate-ping` is aggressive — suggests an unread notification, not a help action. Misleading affordance.
- Should hide when the help section is in viewport.

### `DelegateHelpForm`
- Category dropdown has 8 options but no "smart" suggestion based on context (e.g., if payment is pending, default to "Payment Issue").
- Reply input is a single-line `<input>` — awkward for longer messages.
- No character count or limit feedback.

### `EventFeedbackForms`
- Form expands inline which pushes all content below it far down. On mobile, submitting a long form means the user loses their scroll position.
- Pre-fill logic uses `.find()` twice for the same field — minor inefficiency but also fragile.

### `AbstractSubmissions`
- Status colors are hardcoded in a local object — should share with the admin side.
- "Submit Your First Abstract" link navigates away from the portal with no way back except browser back button.

---

## 5. Prioritized Improvements

### HIGH Priority

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| H1 | **Redesign search view with brand identity** — Replace generic User icon + purple gradient with AMASI branding, medical/surgical visual context, distinctive typography. Make it look like it belongs to a professional medical association, not a generic SaaS. | Brand trust, first impression | Medium |
| H2 | **Add quick-action bar to detail view** — Sticky or top-positioned action buttons (Badge, Certificate, Receipt) so delegates don't scroll past 5 sections to download. | Task completion speed | Medium |
| H3 | **Fix certificate gating flow** — When cert is locked, show inline explanation with direct link/scroll to the blocking feedback form. After form submission, auto-scroll to the now-unlocked cert button. | Reduces confusion & support requests | Medium |
| H4 | **Simplify pending payment UX in search view** — Move payment verify flow to a separate step/modal instead of cramming it into the search card. | Reduces cognitive overload | Medium |
| H5 | **Add event status indicators to multi-event selection** — Color-coded badges (upcoming/today/past), sort by date proximity, highlight "happening now." | Event findability | Low |
| H6 | **Replace `alert()` calls with toast** — In `handleRetryPayment`, use `toast.success`/`toast.error` instead of `alert()`. | Consistency | Very Low |

### MEDIUM Priority

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| M1 | **Make QR code collapsible/date-aware** — Hide QR by default before event day, show expanded on event day and day before. | Reduces scroll length | Low |
| M2 | **Improve mobile banner height and logo overlap** — Increase banner to `h-28` on mobile, adjust logo offset. | Visual polish | Low |
| M3 | **Add `inputMode` to search input** — Detect if input looks like a phone number and hint mobile keyboard. | Mobile UX | Low |
| M4 | **Hide floating help button when help section is visible** — Use IntersectionObserver. | Reduces UI noise | Low |
| M5 | **Remove aggressive ping animation from help button** — Replace with subtle pulse or remove entirely. | Reduces visual noise | Very Low |
| M6 | **Add localStorage recent lookup** — Remember last email/phone for quick re-access. | Repeat visit speed | Low |

### LOW Priority

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| L1 | **Refactor to separate component files** — Split 2700-line file into SearchView, EventListView, DetailView, etc. | Maintainability | High |
| L2 | **Add tap-to-enlarge for QR code** — Modal overlay with larger QR for easy scanning. | Venue UX | Low |
| L3 | **Smart category default in help form** — Pre-select category based on registration state. | Minor convenience | Low |
| L4 | **Use textarea for help reply input** — Allow multi-line replies. | Minor improvement | Very Low |
| L5 | **Fix countdown colon alignment** — Vertically center the `:` separators with numbers. | Visual polish | Very Low |

---

## Summary

The biggest UX problems are:
1. **Generic, brandless visual identity** — looks like every other AI-generated portal
2. **Buried primary actions** — downloads require excessive scrolling
3. **Confusing certificate gating** — cause and effect are separated by scroll distance
4. **Overloaded search view** — payment recovery crammed into the initial card

The page is functionally complete and handles many edge cases well (payment retry, abstract revisions, feedback gating, help requests with threading). The issues are primarily about **information architecture and visual design**, not missing features.
