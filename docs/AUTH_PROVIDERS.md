# NYX authentication provider setup

The app supports email/password, Google OAuth, Sign in with Apple, and phone OTP through the existing Supabase project.

## Redirect URLs

Add all of these to Supabase **Authentication → URL Configuration → Redirect URLs**:

- `https://nyx-gamma.vercel.app/auth/callback`
- `http://localhost:5173/auth/callback`
- `nyx://auth/callback`

The iOS URL scheme is declared in `ios/App/App/Info.plist`. OAuth opens in the iOS system browser and returns to the app through `nyx://auth/callback`.

## Google

1. Create a Google OAuth **Web application** client.
2. Use `https://xouzteiydlzrxnicudua.supabase.co/auth/v1/callback` as the Google authorized redirect URI.
3. Add the production web origin, `https://nyx-gamma.vercel.app`, as an authorized JavaScript origin.
4. Save the Google client ID and secret in the Supabase Google provider and enable it.
5. Keep scopes to `openid`, email, and profile unless the app gains a feature that needs more.

## Apple

1. In Apple Developer, enable **Sign in with Apple** for App ID `com.jeremytao.nyx`.
2. Create a Services ID for web OAuth and associate it with the App ID.
3. Set the Services ID domain to `xouzteiydlzrxnicudua.supabase.co` and its return URL to `https://xouzteiydlzrxnicudua.supabase.co/auth/v1/callback`.
4. Create and securely retain the Sign in with Apple `.p8` key, then configure the Services ID, Team ID, Key ID, and generated client secret in Supabase.
5. Rotate the Apple OAuth client secret before its six-month expiry.

## Phone OTP

1. Configure a supported SMS provider under **Authentication → Providers → Phone** (for example Twilio).
2. Enable phone sign-in only after the sender/number can deliver in every launch country.
3. Configure CAPTCHA and conservative OTP rate limits before production to prevent SMS abuse and unexpected costs.

## Database migration

Apply `supabase/migrations/20260908000000_social_phone_auth_profiles.sql` before enabling the providers. It permits an OAuth/phone identity to be created without a birthday, generates a collision-safe temporary username, and keeps users out of the app until the mandatory 18+ profile completion screen is finished.

Never commit provider secrets, Apple `.p8` files, SMS tokens, or a Supabase service-role key.
