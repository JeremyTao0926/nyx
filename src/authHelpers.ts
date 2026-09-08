export const NATIVE_AUTH_CALLBACK = "nyx://auth/callback";

export function getOAuthRedirectUrl(native: boolean, origin: string): string {
  return native ? NATIVE_AUTH_CALLBACK : `${origin.replace(/\/$/, "")}/auth/callback`;
}

export function normalizePhoneNumber(countryCode: string, value: string): string | null {
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasInternationalPrefix) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const localDigits = digits.replace(/^0+/, "");
  const prefixDigits = countryCode.replace(/\D/g, "");
  const combined = `${prefixDigits}${localDigits}`;
  return combined.length >= 8 && combined.length <= 15 ? `+${combined}` : null;
}

export function getAuthCallbackParams(url: string): {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
} {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return {
    code: parsed.searchParams.get("code"),
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    error:
      parsed.searchParams.get("error_description") ||
      parsed.searchParams.get("error") ||
      hash.get("error_description") ||
      hash.get("error"),
  };
}
