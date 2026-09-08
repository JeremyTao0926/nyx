# App Review Notes

NYX is an adults-only dating and social discovery app. The onboarding enforces age 18+ and the server rejects profile birth dates that do not meet this requirement.

## Demo access

- Username: APP_REVIEW_DEMO_EMAIL
- Password: APP_REVIEW_DEMO_PASSWORD
- The account must remain active and must already have onboarding completed, sample matches, and chat history.

## Features to review

- Location is optional. If permission is declined, Profile → Edit Profile → Location supports manual city search.
- Nearby users can be viewed as cards or on a map. The New tab intentionally has no map toggle.
- User-generated content can be reported and users can be blocked from profile/chat menus. Text and uploaded photos are screened before posting.
- Account deletion: My Profile → General Settings → Delete Account.
- Premium uses Apple In-App Purchase on iOS. The paywall includes Restore Purchases. Web checkout is never shown in the native iOS build.
- Push notifications are requested only after the user enables them in General Settings.

## Subscription products

- nyx_premium_monthly
- nyx_premium_plus_monthly
- RevenueCat entitlement: premium

## Sign-in methods

- Email/password
- Sign in with Google
- Sign in with Apple
- Phone number with one-time SMS code

First-time Google, Apple, and phone users must complete a display name, unique username, and an 18+ birth date before the discovery interface is available. OAuth opens in the iOS system browser and returns through the registered `nyx://auth/callback` URL scheme.
