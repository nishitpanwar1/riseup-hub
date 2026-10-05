# Rebuild RiseUp from the uploaded UI system

## Build
- Replace the current dark interface with the uploaded chalk-white, ember-orange RiseUp design system, typography, compact geometry, and flat bordered surfaces.
- Rebuild the shared desktop navigation, top search and account bar, tablet rail, and mobile header/tab bar so every existing page inherits the same responsive visual language.
- Match the supplied home, Shorts, rooms, shop, notifications, search, profile, upload, selling, live/studio, leaderboard, and wallet references while keeping all current live data and actions connected.
- Restyle watch, focus, settings, authentication, room detail, and information pages in the same system where the package has no supplied page.

## Preserve
- Keep realtime feeds, ranking, uploads, rooms, shop purchases, profiles, focus tracking, notifications, RichAds pre-rolls, Shorts ads, authentication gates, and guest viewing rules intact.
- Keep existing public URLs and mobile/desktop navigation working.

## Quality
- Add missing page metadata.
- Verify phone, tablet, laptop, and wide-screen layouts for overflow, overlap, interaction failures, and runtime errors.
- Fix all build and browser errors found during verification.

## Technical details
- Keep `AppShell` as the single responsive navigation and content-frame authority.
- Implement the uploaded tokens globally so existing screens change consistently without forking their data behavior.
- Reuse existing route logic and queries; change presentation and layout only unless wiring is required for an existing feature.
