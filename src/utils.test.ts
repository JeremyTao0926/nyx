import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests exercise pure helpers. Stub the module-level Supabase client so
// CI does not need production credentials just to import utils.ts.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { authErrorMessage, calcAge, calcCompletion, formatLocation, haversine, mbtiCompatibility, onlineStatus, searchCities, sortExploreCandidates, zodiacSign } from "./utils";
import type { UserProfile } from "./types";

describe("matching", () => {
  it("does not assign the old 75% fallback to unrelated MBTI pairs", () => {
    expect(mbtiCompatibility("INFP", "ESFP").score).toBe(55);
    expect(mbtiCompatibility("INFP", "ENFJ").score).toBe(96);
  });

  it("adds real shared interests without exceeding 99", () => {
    expect(mbtiCompatibility("INFP", "ENFJ", ["旅行"], ["旅行"]).score).toBe(99);
    expect(mbtiCompatibility("INFP", "ESFP", ["旅行", "音樂"], ["旅行", "音樂"]).score).toBe(61);
  });
});

describe("authentication errors", () => {
  it("localizes credential and confirmation failures", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe("帳號或密碼錯誤");
    expect(authErrorMessage(new Error("Email not confirmed"))).toBe("請先確認信箱中的驗證郵件");
  });

  it("replaces low-level network errors with an actionable message", () => {
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toBe("暫時無法連接服務，請檢查網路後再試");
  });
});

describe("birthday handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0));
  });

  afterEach(() => vi.useRealTimers());

  it("enforces the 18th birthday boundary in local time", () => {
    expect(calcAge("2008-09-01")).toBe(18);
    expect(calcAge("2008-09-02")).toBe(17);
    expect(calcAge("2008-02-30")).toBeNull();
    expect(calcAge("not-a-date")).toBeNull();
  });

  it("keeps date-only zodiac calculation timezone safe", () => {
    expect(zodiacSign("2000-09-01")).toBe("處女座");
  });
});

describe("last active display", () => {
  const now = new Date(2026, 8, 2, 0, 10).getTime();

  it("distinguishes online, minutes ago, and the previous calendar day", () => {
    expect(onlineStatus(new Date(now - 4 * 60_000).toISOString(), false, now)).toMatchObject({ label: "在線", dot: true });
    expect(onlineStatus(new Date(now - 20 * 60_000).toISOString(), false, now).label).toBe("20分鐘前");
    expect(onlineStatus(new Date(2026, 8, 1, 22, 30).toISOString(), false, now).label).toBe("昨天 22:30");
  });

  it("honors privacy and rejects invalid timestamps", () => {
    expect(onlineStatus(new Date(now).toISOString(), true, now).label).toBe("");
    expect(onlineStatus("invalid", false, now).label).toBe("");
  });
});

describe("distance and completion", () => {
  it("calculates representative city distance", () => {
    expect(haversine(34.0522, -118.2437, 34.0122, -117.6889)).toBeGreaterThan(40);
    expect(haversine(34.0522, -118.2437, 34.0122, -117.6889)).toBeLessThan(60);
  });

  it("calculates profile completion from actual fields", () => {
    const profile = { display_name: "A", birthday: "2000-01-01", hobbies: [], photos: [] } as unknown as UserProfile;
    expect(calcCompletion(profile)).toBe(29);
  });
});

describe("explore tab ordering", () => {
  const candidates = [
    { id: "far-new", score: 95, distance: 80, createdAt: "2026-09-02T00:00:00Z" },
    { id: "near-old", score: 60, distance: 4, createdAt: "2026-08-01T00:00:00Z" },
    { id: "unknown-location", score: 70, createdAt: "2026-09-01T00:00:00Z" },
  ];

  it("uses recommendation score for the recommendation tab", () => {
    expect(sortExploreCandidates(candidates, "recommend").map(item => item.id)).toEqual(["far-new", "unknown-location", "near-old"]);
  });

  it("uses distance for nearby and leaves unknown locations last", () => {
    expect(sortExploreCandidates(candidates, "nearby").map(item => item.id)).toEqual(["near-old", "far-new", "unknown-location"]);
  });

  it("uses account creation time for newly joined", () => {
    expect(sortExploreCandidates(candidates, "new").map(item => item.id)).toEqual(["far-new", "unknown-location", "near-old"]);
  });
});

describe("city search ranking", () => {
  const nominatimResults = [
    {
      display_name: "Santa Bárbara, Chihuahua, México",
      lat: "28.1", lon: "-106.0",
      address: { town: "Santa Bárbara", state: "Chihuahua", country: "México" },
    },
    {
      display_name: "Chino, San Bernardino County, California, United States",
      lat: "34.0122", lon: "-117.6889",
      address: { city: "Chino", state: "California", country: "United States" },
    },
    {
      display_name: "Chino, Nagano, Japan",
      lat: "35.9956", lon: "138.1589",
      address: { city: "Chino", state: "Nagano", country: "Japan" },
    },
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => nominatimResults }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("formats place names from the smallest useful area to country", () => {
    expect(formatLocation("Chino", "California", "United States")).toBe("Chino, California, United States");
    expect(formatLocation("Singapore", "Singapore", "Singapore")).toBe("Singapore");
  });

  it("always puts textual matches before unrelated geocoder results", async () => {
    const results = await searchCities("chino");
    expect(results.map(result => result.name)).toEqual(["Chino", "Chino", "Santa Bárbara"]);
  });

  it("uses distance only after text relevance and preserves city-to-country hierarchy", async () => {
    const results = await searchCities("chino", { lat: 34.0522, lon: -118.2437 });
    expect(results[0]).toMatchObject({ name: "Chino", state: "California", country: "United States" });
    expect(results[1]).toMatchObject({ name: "Chino", state: "Nagano", country: "Japan" });
    expect(results[2].name).toBe("Santa Bárbara");
  });
});
