// NYX Web Push — Client side

import { isNativeApp } from './platform';
import { PushNotifications } from '@capacitor/push-notifications';

const VAPID_PUBLIC = 'BF2EDLbL292Wn-EuER8fWLbBFCjnoEOlqqP9d9jNNEjREmTYduDh4XtziaX3b9uvEpNMcnaDQbYTXVhe6woPxQM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Timeout wrapper — prevents navigator.serviceWorker.ready from hanging forever
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

export async function initPush(userId: string, requestPermission = true): Promise<PushSubscription | null> {
  if (isNativeApp) {
    await initNativePush(userId, requestPermission);
    return null;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    // Register SW — don't await ready here, it can hang
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // Wait max 5s for SW to be ready
    await withTimeout(navigator.serviceWorker.ready, 5000);

    // Only ask permission if not already granted (avoid repeated prompts)
    const perm = Notification.permission === 'granted'
      ? 'granted'
      : requestPermission ? await Notification.requestPermission() : Notification.permission;
    if (perm !== 'granted') return null;

    // Check for existing subscription first
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await savePushSubscription(userId, existing);
      return existing;
    }

    const applicationServerKey: ArrayBuffer = urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await savePushSubscription(userId, sub);
    return sub;
  } catch {
    // Silently fail — push is non-critical, must not affect app functionality
    return null;
  }
}

async function initNativePush(userId: string, requestPermission: boolean) {
  const { sb } = await import('./utils');
  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
    await sb.from('push_subscriptions').upsert({
      user_id: userId,
      platform: 'ios',
      device_token: deviceToken,
      endpoint: null,
      p256dh: null,
      auth: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  });
  await PushNotifications.addListener('registrationError', error => {
    console.error('APNs registration failed', error);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', action => {
    window.dispatchEvent(new CustomEvent('nyx:native-notification-click', { detail: action.notification.data }));
  });

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' && requestPermission) permission = await PushNotifications.requestPermissions();
  if (permission.receive === 'granted') await PushNotifications.register();
}

export async function getPushEnabled() {
  if (isNativeApp) return (await PushNotifications.checkPermissions()).receive === 'granted';
  return 'Notification' in window && Notification.permission === 'granted';
}

async function savePushSubscription(userId: string, sub: PushSubscription) {
  try {
    const { sb } = await import('./utils');
    const payload = sub.toJSON();
    await sb.from('push_subscriptions').upsert({
      user_id: userId,
      platform: 'web',
      device_token: null,
      endpoint: payload.endpoint,
      p256dh: (payload.keys as Record<string, string>)?.p256dh,
      auth: (payload.keys as Record<string, string>)?.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {
    // Push is optional; database/network failures must not block the app.
  }
}

export async function removePush(userId: string) {
  if (isNativeApp) {
    await PushNotifications.removeAllListeners();
    const { sb } = await import('./utils');
    await sb.from('push_subscriptions').delete().eq('user_id', userId).eq('platform', 'ios');
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    const { sb } = await import('./utils');
    await sb.from('push_subscriptions').delete().eq('user_id', userId);
  } catch {
    // The subscription may already be gone; keep notification opt-out idempotent.
  }
}
