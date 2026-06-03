// NYX Web Push — Client side

const VAPID_PUBLIC = 'BF2EDLbL292Wn-EuER8fWLbBFCjnoEOlqqP9d9jNNEjREmTYduDh4XtziaX3b9uvEpNMcnaDQbYTXVhe6woPxQM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function initPush(userId: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;
    const applicationServerKey: ArrayBuffer = urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    await savePushSubscription(userId, sub);
    return sub;
  } catch (e) {
    console.error('Push init failed:', e);
    return null;
  }
}

async function savePushSubscription(userId: string, sub: PushSubscription) {
  const { sb } = await import('./utils');
  const payload = sub.toJSON();
  await sb.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: payload.endpoint,
    p256dh: (payload.keys as Record<string, string>)?.p256dh,
    auth: (payload.keys as Record<string, string>)?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
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

export function onNotificationClick(cb: (url: string) => void) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'NOTIFICATION_CLICK') cb(e.data.url as string);
  });
}
