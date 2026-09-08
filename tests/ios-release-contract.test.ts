import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("iOS release contract", () => {
  it("declares every permission used by the app", () => {
    const info = source("ios/App/App/Info.plist");
    expect(info).toContain("NSCameraUsageDescription");
    expect(info).toContain("NSPhotoLibraryUsageDescription");
    expect(info).toContain("NSLocationWhenInUseUsageDescription");
  });

  it("enables App Store purchases, push, and Sign in with Apple", () => {
    const project = source("ios/App/App.xcodeproj/project.pbxproj");
    const entitlements = source("ios/App/App/App.entitlements");
    expect(project).toContain("com.apple.InAppPurchase");
    expect(project).toContain("com.apple.Push");
    expect(project).toContain("com.apple.SignInWithApple");
    expect(entitlements).toContain("aps-environment");
    expect(entitlements).toContain("com.apple.developer.applesignin");
  });

  it("bundles RevenueCat and raster app icons", () => {
    const swiftPackage = source("ios/App/CapApp-SPM/Package.swift");
    expect(swiftPackage).toContain("RevenuecatPurchasesCapacitor");
    for (const size of ["180", "192", "512", "1024"]) {
      expect(existsSync(new URL(`../public/appicon/icon-${size}.png`, import.meta.url))).toBe(true);
    }
  });
});
