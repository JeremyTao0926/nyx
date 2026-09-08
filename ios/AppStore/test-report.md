# NYX iOS Preflight Test Report

Updated: 2026-09-08

## Current result

The web application and iOS wrapper pass the automated checks that can run on Windows. Public and signed-out UI flows have also been checked across representative iPhone viewport sizes. The release is **not yet fully accepted for App Store submission** because authenticated flows, native permissions, APNs, StoreKit purchases, and archive signing still require a dedicated QA account plus a real iPhone/TestFlight build.

## Automated checks

| Check | Result | Notes |
| --- | --- | --- |
| Unit and release-contract tests | Pass | 63/63 tests across 11 files, including OAuth, phone normalization, age boundaries, city ranking, matching, avatars, simulation batching/prompts, Premium visibility, subscription security, Edge Function syntax, and iOS release configuration. |
| TypeScript + production web build | Pass | `npm run build`. |
| Full repository lint | Pass | `npm run lint -- --no-cache` reports 0 errors and 0 warnings. |
| Production dependency audit | Pass | 0 production vulnerabilities from `npm audit --omit=dev`. |
| Capacitor iOS sync | Pass | `npm run ios:sync` built the web assets and synced all six native plugins, including the system browser used for OAuth. |
| Xcode simulator build | Pass | The macOS 15 GitHub Actions run compiled the Debug app for a generic iPhone Simulator with signing disabled. |

The full repository lint is green. The production dependency audit is clean. The development-only audit reports three moderate findings in Capacitor CLI's `xcode` → `uuid` chain; npm's proposed fix force-downgrades Capacitor CLI, so it was not applied without a compatible upstream release.

## Responsive UI coverage

The signed-out landing, login, registration, privacy, terms, and support interfaces were checked at these CSS viewport sizes:

- 320×568 (small iPhone)
- 375×667
- 375×812
- 393×852
- 430×932 (large iPhone)
- 375×420 (keyboard-reduced viewport stress case)

Verified outcomes:

- No horizontal document overflow.
- No artificial empty area below the app shell.
- Switching from the landing screen to login no longer preserves a hidden outer-container scroll offset; the shell stays at `scrollTop = 0`.
- Login and registration actions remain visible and usable at the smallest size.
- Registration has one consistent back control with a minimum 44×44-point target.
- Public legal/support pages remain scrollable and readable.

Browser viewport emulation does not prove native safe-area, Dynamic Type, camera, photo picker, location prompt, or on-screen keyboard behavior. Those remain part of the TestFlight matrix below.

## Functional TestFlight matrix

Use a dedicated non-production QA account and test on at least one small-screen iPhone and one current 6.7/6.9-inch iPhone.

- [ ] Register, reject under-18 birth date, confirm email, restore pending avatar, and finish onboarding.
- [ ] Sign in, sign out, reset password, relaunch, and verify session restoration.
- [ ] Sign in with Google and Apple, cancel each provider once, verify the iOS deep-link return, and complete the mandatory social profile screen.
- [ ] Request, reject, expire, resend, and successfully verify a phone OTP; confirm SMS rate limiting and CAPTCHA behavior.
- [ ] Allow and deny location; search cities manually; move the map pin; verify city/province/country text; confirm text relevance before distance ordering.
- [ ] Verify Nearby map toggle only appears on Nearby; tap another user's marker and confirm the profile fully covers the map.
- [ ] Exercise recommendation, nearby, and newly joined sorting with seeded users at known coordinates and creation dates.
- [ ] Swipe until free and Premium limits are reached; test duplicate swipes, matches, block, report, and last-active privacy.
- [ ] Send text and images, use camera and photo picker, receive messages, check unread counts, typing state, and foreground/background transitions.
- [ ] Receive APNs notifications in sandbox and production/TestFlight environments and verify notification taps open the intended screen.
- [ ] Purchase Premium and Premium+, restore purchases after reinstall, switch accounts, test cancellation/grace period/expiration, and verify server entitlements.
- [ ] Confirm Premium and Premium+ badges appear on the subscriber's own profile and to other users in discovery, profile detail, chat list, and chat header; confirm expired memberships show no badge.
- [ ] Have both users answer Daily Spark and a shared encounter at nearly the same time; verify exactly one memory and one counter increment are created.
- [ ] Delete the account, then prove the deleted credentials can no longer sign in and associated user data is removed.
- [ ] Check VoiceOver labels/focus order, Dynamic Type, Reduce Motion, contrast, and 44-point touch targets.
- [ ] Test offline launch, slow network, API errors, image upload failures, interrupted purchases, and app termination/relaunch.
- [ ] Archive in Release mode, inspect Apple's Privacy Report, upload to App Store Connect, and clear every validation warning.

## Release blockers outside this Windows repository

- Apple Developer team, certificates, App ID capabilities, agreements, tax/banking, and App Store Connect metadata.
- RevenueCat/App Store Connect product configuration and production secrets.
- Supabase schema migration and Edge Function deployment.
- Google OAuth, Apple Developer/Services ID, and SMS-provider credentials plus Supabase provider enablement.
- Public privacy, terms, and support URLs.
- Signed archive, TestFlight installation, real-device QA, screenshots, and reviewer demo account.

## Production probe on 2026-09-08

The production project did not yet expose the new database RPCs, and the following new Edge Functions returned 404 when checked: `groq-proxy`, `moderate-content`, `delete-account`, `sync-revenuecat-entitlement`, `revenuecat-webhook`, and `schedule-downgrade`. This is why AI and newly completed paid/security flows cannot be considered live until the backend deployment checklist above is completed.
