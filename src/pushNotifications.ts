// NYX Web Push — Client side

// Your VAPID public key (generated)
const VAPID_PUBLIC = 'BF2EDLbL292Wn-EuER8fWLbBFCjnoEOlqqP9d9jNNEjREmTYduDh4XtziaX3b9uvEpNMcnaDQbYTXVhe6woPxQM';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

/** Register SW + subscribe to push. Returns subscription or null. */
export async function initPush(userId: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  try {
    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Request permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });

    // Save subscription to Supabase
    await savePushSubscription(userId, sub);
    return sub;
  } catch (e) {
    console.error('Push init failed:', e);
    return null;
  }
}

/** Save subscription endpoint to DB */
async function savePushSubscription(userId: string, sub: PushSubscription) {
  const { sb } = await import('./utils');
  const payload = sub.toJSON();
  await sb.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: payload.endpoint,
    p256dh: payload.keys?.p256dh,
    auth: payload.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/** Unsubscribe (e.g. on logout) */
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

/** Listen for notification click messages from SW */
export function onNotificationClick(cb: (url: string) => void) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'NOTIFICATION_CLICK') cb(e.data.url);
  });
}
