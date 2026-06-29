## Context

`popup.js` runs a `setInterval` every 1 second that calls `loadState()`. That function fetches fresh extension state and then runs `timelineOffset = 0` unconditionally before calling `updateUI()`. The timeline navigation buttons update `timelineOffset` and call `updateTimeline()` directly, so they work — but the very next auto-refresh tick resets the offset and re-renders today.

The fix is entirely within the popup layer (`popup.js` + `popup.css`). No background script changes needed.

## Goals / Non-Goals

**Goals:**
- Preserve `timelineOffset` across auto-refresh ticks.
- Snap back to today only when a genuinely new event lands in today's timeline.
- Show a clear visual indicator (badge + header tint) while viewing a past day.

**Non-Goals:**
- Changing the 1-second refresh interval.
- Persisting the selected day across popup close/open.
- Modifying the background script or storage schema.

## Decisions

**Detect new events by timeline length, not by timestamp comparison.**
Compare `currentState.todayTimeline.length` against a module-level counter `lastTodayTimelineLen`. If the length grew while `timelineOffset > 0`, snap back to today and update the counter. This is O(1), requires no deep comparison, and handles the case where the popup opens mid-day with existing events (baseline is set on first load while `timelineOffset === 0`, so no false snap on open).

Alternative considered: compare the last event timestamp. Rejected — requires a defined sort order and doesn't handle the edge case of events being trimmed/deduped.

**Toggle a CSS class on `#timelineHeader` for the tint, not inline styles.**
The existing code already uses `timelineHeader.innerHTML` to write the label. Adding a class toggle (`timeline-traveling`) keeps styling out of JS and makes it easy to override in CSS.

**Replace `(read-only)` hint with the "🕰️ Time travelling" badge.**
The old `(read-only)` hint is grey and subtle. The new badge carries both the emoji and a coloured background pill, making the non-live state unmissable without being intrusive.

## Risks / Trade-offs

- [Risk] If a future refactor adds a reason to legitimately reset `timelineOffset` in `loadState()`, the developer must remember to also reset `lastTodayTimelineLen`. Mitigation: the two lines are adjacent and the intent is documented in the commit.
- [Trade-off] Snap-back is triggered by `todayTimeline` growing, not by the specific event type. If the extension ever adds non-break/non-goal event types to `todayTimeline`, those would also trigger a snap. Acceptable given current scope.

## Migration Plan

No data migration. The change is purely additive to the popup layer. Rebuild `dist/` and reload the unpacked extension.
