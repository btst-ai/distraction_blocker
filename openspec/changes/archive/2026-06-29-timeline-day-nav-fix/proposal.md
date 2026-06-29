## Why

The v1.4 timeline day-navigation feature is broken: clicking ◀ to view a past day works for ~1 second, then the view snaps back to today. The root cause is a 1-second auto-refresh that unconditionally resets `timelineOffset = 0` on every tick. Users cannot browse past timeline days at all.

## What Changes

- Remove the unconditional `timelineOffset = 0` reset in `loadState()`.
- Add smart snap-back: only return to today when a new timeline event is recorded (detected by today's timeline length growing), not on every refresh.
- Add a "🕰️ Time travelling" badge + subtle header tint whenever the user is viewing a past day, so the non-live state is visually obvious.

## Capabilities

### New Capabilities
- `timeline-day-navigation`: Stable browsing of past timeline days via ◀ / ▶, with a "time travelling" indicator and smart auto-return to today on new events.

### Modified Capabilities
<!-- none: no existing specs to update -->

## Impact

- `src/popup/popup.js`: tracker variable, `loadState()` snap-back logic, header badge + class toggle in `updateTimeline()`.
- `src/popup/popup.css`: badge and tinted-header styles.
- `dist/` must be rebuilt after changes.
