## ADDED Requirements

### Requirement: Timeline offset persists across auto-refresh
The system SHALL preserve the user's selected timeline day (timelineOffset) across the 1-second auto-refresh cycle. Auto-refresh SHALL update `currentState` data without resetting the displayed day.

#### Scenario: Viewing past day survives refresh
- **WHEN** the user navigates to a past day via ◀
- **THEN** the timeline SHALL continue displaying that past day after the 1-second auto-refresh fires

#### Scenario: Fresh popup open always starts on today
- **WHEN** the popup is opened
- **THEN** the timeline SHALL display today (timelineOffset = 0)

### Requirement: Auto-return to today on new timeline event
The system SHALL automatically return the view to today if the user is browsing a past day and a new event is recorded to today's timeline (break or goal completion).

#### Scenario: New event snaps view back to today
- **WHEN** the user is viewing a past day (timelineOffset > 0)
- **AND** a new break or goal event is appended to today's timeline
- **THEN** the view SHALL snap back to today (timelineOffset = 0) on the next auto-refresh

#### Scenario: No snap when today's timeline is unchanged
- **WHEN** the user is viewing a past day (timelineOffset > 0)
- **AND** no new events have been added to today's timeline
- **THEN** the view SHALL remain on the selected past day

### Requirement: Time-travelling indicator shown for past days
The system SHALL display a visible indicator in the timeline header whenever the user is viewing a past day, so they know the view is not live.

#### Scenario: Badge shown on past day
- **WHEN** the user is viewing a past day (timelineOffset > 0)
- **THEN** a "🕰️ Time travelling" badge SHALL appear in the timeline header

#### Scenario: Header tint shown on past day
- **WHEN** the user is viewing a past day (timelineOffset > 0)
- **THEN** the timeline header element SHALL have a visually distinct background tint

#### Scenario: Indicator absent on today
- **WHEN** the user is viewing today (timelineOffset = 0)
- **THEN** no time-travelling badge or tint SHALL be present
