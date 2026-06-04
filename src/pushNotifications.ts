// NYX Web Push — Client side

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

export async function initPush(userId: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    // Register SW — don't await ready here, it can hang
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // Wait max 5s for SW to be ready
    await withTimeout(navigator.serviceWorker.ready, 5000);

    // Only ask permission if not already granted (avoid repeated prompts)
    const perm = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
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
  } catch (e) {
    // Silently fail — push is non-critical, must not affect app functionality
    return null;
  }
}

async function savePushSubscription(userId: string, sub: PushSubscription) {
  try {
    const { sb } = await import('./utils');
    const payload = sub.toJSON();
    await sb.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: payload.endpoint,
      p256dh: (payload.keys as Record<string, string>)?.p256dh,
      auth: (payload.keys as Record<string, string>)?.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {}
}

export async function removePush(userId: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    const { sb } = await import('./utils');
    await sb.from('push_subscriptions').delete().eq('user_id', userId);
  } catch {}
}
