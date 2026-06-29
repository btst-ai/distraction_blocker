## 1. Fix auto-refresh reset in popup.js

- [ ] 1.1 Add `lastTodayTimelineLen` tracker variable at the top of popup.js (near `timelineOffset`)
- [ ] 1.2 In `loadState()`, remove the unconditional `timelineOffset = 0` reset and replace with snap-back logic: if `timelineOffset > 0` and today's timeline length grew, reset to 0 and update `lastTodayTimelineLen`

## 2. Time-travelling indicator in popup.js

- [ ] 2.1 In `updateTimeline()`, replace the `readOnlyHint` string with the "🕰️ Time travelling" badge HTML
- [ ] 2.2 In `updateTimeline()`, toggle the `timeline-traveling` CSS class on `#timelineHeader` based on `isReadOnly`
- [ ] 2.3 Apply the same badge in the empty-day branch of `updateTimeline()` so empty past days also show the indicator

## 3. CSS styles

- [ ] 3.1 Add `.timeline-tt-badge` styles to popup.css (pill background, colour, font-size)
- [ ] 3.2 Add `#timelineHeader.timeline-traveling` styles to popup.css (subtle background tint)

## 4. Build

- [ ] 4.1 Run the project build script to regenerate dist/
