# iOS Release Checklist

## Code and backend

- [ ] Apply src/schema_v3.sql to production Supabase.
- [ ] Apply supabase/migrations/20260908000000_social_phone_auth_profiles.sql before enabling social/phone auth.
- [ ] Configure Supabase redirect URLs, then enable and test Google, Apple, and phone providers using docs/AUTH_PROVIDERS.md.
- [ ] Deploy delete-account, groq-proxy, moderate-content, revenuecat-webhook, and send-push Edge Functions.
- [ ] Set GROQ_API_KEY, REVENUECAT_WEBHOOK_SECRET, REVENUECAT_SECRET_API_KEY, IOS_PREMIUM_PRODUCT_ID, IOS_PREMIUM_PLUS_PRODUCT_ID, APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID, APNS_ENV, VAPID_PUBLIC, VAPID_PRIVATE, and VAPID_SUBJECT secrets.
- [ ] Set VITE_REVENUECAT_IOS_API_KEY for the production build.
- [ ] After merging to main, enable GitHub Pages with GitHub Actions as the source and verify privacy.html, terms.html, and support.html publicly.

## Apple Developer and RevenueCat

- [ ] Register Bundle ID com.jeremytao.nyx and enable Push Notifications, In-App Purchase, and Sign in with Apple.
- [ ] Create an APNs .p8 key and use its Key ID and Team ID in Supabase secrets.
- [ ] Create the app record and subscription group in App Store Connect.
- [ ] Create nyx_premium_monthly and nyx_premium_plus_monthly, complete pricing/localization/review screenshot, and submit the first subscriptions with version 1.0.
- [ ] Connect App Store Connect to RevenueCat; create the premium entitlement and current offering packages premium and premium_plus.

## App Store Connect

- [ ] Complete agreements, banking, tax, DSA trader status, content rights, and availability.
- [ ] Complete the 2026 age-rating questionnaire and override to 18+ because NYX's terms require users to be adults.
- [ ] Enter App Privacy answers from privacy-labels.md and the live privacy URL.
- [ ] Enter metadata, support URL, review contact in international phone format, and a non-expiring demo account.
- [ ] Upload 1–10 portrait screenshots; use a supported 6.9-inch size such as 1320×2868 or 1290×2796 without transparency.
- [ ] Add Accessibility Nutrition Labels only for features verified on a real device.

## macOS signing and TestFlight

- [ ] On macOS, run npm ci, npm run ios:sync, and npm run ios:open.
- [ ] Select the Apple team, confirm automatic signing and Push Notifications capability, then archive the Release scheme.
- [ ] Generate and inspect the Privacy Report from the archive.
- [ ] Complete every real-device case in test-report.md with a dedicated non-production QA account on a small and large iPhone.
- [ ] Upload to App Store Connect, resolve validation warnings, then test IAP, restore, APNs, camera, photos, location denial/manual city, block/report, and account deletion on TestFlight.
- [ ] Add version 1.0 and both first subscriptions to the same review submission, then submit for review.
