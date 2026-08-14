import { Capacitor } from "@capacitor/core";

export const isNativeApp = Capacitor.isNativePlatform();
export const isIOSNative = Capacitor.getPlatform() === "ios";
