import { describe, expect, it } from "vitest";
import { getAuthCallbackParams, getOAuthRedirectUrl, normalizePhoneNumber } from "./authHelpers";

describe("authentication helpers", () => {
  it("uses a web callback for browser OAuth", () => {
    expect(getOAuthRedirectUrl(false, "https://nyx-gamma.vercel.app/"))
      .toBe("https://nyx-gamma.vercel.app/auth/callback");
  });

  it("uses the NYX deep link for native OAuth", () => {
    expect(getOAuthRedirectUrl(true, "capacitor://localhost")).toBe("nyx://auth/callback");
  });

  it("normalizes local and international phone numbers", () => {
    expect(normalizePhoneNumber("+852", "9123 4567")).toBe("+85291234567");
    expect(normalizePhoneNumber("+1", "+886 912-345-678")).toBe("+886912345678");
    expect(normalizePhoneNumber("+852", "123")).toBeNull();
  });

  it("reads PKCE and token callback payloads", () => {
    expect(getAuthCallbackParams("nyx://auth/callback?code=abc").code).toBe("abc");
    expect(getAuthCallbackParams("nyx://auth/callback#access_token=a&refresh_token=r"))
      .toMatchObject({ accessToken: "a", refreshToken: "r" });
  });
});
