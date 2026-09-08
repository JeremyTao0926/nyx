import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, defaultAvatarForGender, resolveAvatar } from "./avatar";

describe("default profile avatars", () => {
  it("selects the matching gender illustration", () => {
    expect(defaultAvatarForGender("male")).toBe(DEFAULT_AVATAR.male);
    expect(defaultAvatarForGender("female")).toBe(DEFAULT_AVATAR.female);
  });

  it("uses a safe fallback for missing or invalid gender data", () => {
    expect(defaultAvatarForGender(null)).toBe(DEFAULT_AVATAR.male);
    expect(defaultAvatarForGender("unknown")).toBe(DEFAULT_AVATAR.male);
  });

  it("keeps uploaded avatars and replaces blank values", () => {
    expect(resolveAvatar(" https://example.com/avatar.jpg ", "female")).toBe("https://example.com/avatar.jpg");
    expect(resolveAvatar("", "female")).toBe(DEFAULT_AVATAR.female);
    expect(resolveAvatar(null, "male")).toBe(DEFAULT_AVATAR.male);
  });
});
