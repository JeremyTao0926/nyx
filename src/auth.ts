import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { PluginListenerHandle } from "@capacitor/core";
import type { Provider } from "@supabase/supabase-js";
import { getAuthCallbackParams, getOAuthRedirectUrl } from "./authHelpers";
import { isNativeApp } from "./platform";
import { sb, SUPABASE_KEY, SUPABASE_URL } from "./utils";

export type NyxSocialProvider = Extract<Provider, "google" | "apple">;
export type AuthProviderAvailability = { google: boolean; apple: boolean; phone: boolean };

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  // Local visual QA can preview every flow without weakening production
  // provider checks or making paid SMS requests.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("auth-preview")) {
    return { google: true, apple: true, phone: true };
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!response.ok) throw new Error("無法讀取登入服務狀態");
  const settings = await response.json() as { external?: Partial<AuthProviderAvailability> };
  return {
    google: settings.external?.google === true,
    apple: settings.external?.apple === true,
    phone: settings.external?.phone === true,
  };
}

export async function signInWithSocialProvider(provider: NyxSocialProvider): Promise<void> {
  const redirectTo = getOAuthRedirectUrl(isNativeApp, window.location.origin);
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: isNativeApp,
    },
  });

  if (error) throw error;

  if (isNativeApp) {
    if (!data.url) throw new Error("無法開啟登入服務，請稍後再試");
    await Browser.open({ url: data.url, presentationStyle: "fullscreen" });
  }
}

async function completeNativeAuth(url: string): Promise<void> {
  const callback = getAuthCallbackParams(url);
  if (callback.error) throw new Error(decodeURIComponent(callback.error.replace(/\+/g, " ")));

  if (callback.code) {
    const { error } = await sb.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
  } else if (callback.accessToken && callback.refreshToken) {
    const { error } = await sb.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (error) throw error;
  } else {
    throw new Error("登入回傳資料不完整，請重新登入");
  }

  await Browser.close().catch(() => undefined);
}

export function listenForNativeAuthCallbacks(onError: (message: string) => void): () => void {
  if (!isNativeApp) return () => undefined;

  let listener: PluginListenerHandle | undefined;
  let disposed = false;
  const handleUrl = async (url?: string) => {
    if (!url?.startsWith("nyx://auth/callback")) return;
    try {
      await completeNativeAuth(url);
    } catch (error) {
      await Browser.close().catch(() => undefined);
      const message = error instanceof Error ? error.message : "登入失敗，請重新嘗試";
      onError(message);
    }
  };

  void CapacitorApp.addListener("appUrlOpen", ({ url }) => handleUrl(url)).then(handle => {
    if (disposed) void handle.remove();
    else listener = handle;
  });
  void CapacitorApp.getLaunchUrl().then(result => handleUrl(result?.url));

  return () => {
    disposed = true;
    if (listener) void listener.remove();
  };
}
