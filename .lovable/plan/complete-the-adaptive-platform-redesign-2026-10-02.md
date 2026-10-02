# Complete the adaptive platform redesign

## Build
- Move Shorts, watch, profiles, rooms, shop, Studio, upload, focus, notifications, settings, search, and information pages into the shared RiseUp app layout.
- Keep Shorts immersive while adapting its navigation and controls for phone, tablet, desktop, and TV-sized screens.
- Make layout density device-specific: bottom navigation on phones, icon rail on tablets, full sidebar on desktop, and wider content/controls on TV.
- Gate like, comment, follow, subscribe, save, join, create, and purchase actions for signed-out viewers with the shared sign-in prompt.
- Add a guest viewing allowance with an early warning and a blocking sign-up-or-shop prompt when the allowance is exhausted.

## Quality
- Add route-specific page metadata where missing.
- Check phone, tablet, laptop, and TV widths for overflow, overlap, broken controls, and runtime errors.
- Fix any build or browser errors found during verification.

## Technical details
- Reuse `AppShell` as the single responsive layout authority rather than duplicating headers and mobile navigation.
- Extend the existing auth-gate provider with persisted guest-view allowance state so watch and Shorts share one limit.
- Preserve existing realtime queries, upload behavior, routes, and media playback logic.
