// NYX Service Worker — Web Push Handler
const CACHE = 'nyx-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push received ──
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  const { title, body, icon, tag, url, senderAvatar } = data;

  const options = {
    body,
    icon: senderAvatar || icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: tag || 'nyx-msg',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: url || '/' },
    actions: [
      { action: 'open', title: '回覆' },
      { action: 'dismiss', title: '關閉' },
    ],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Open new tab
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
