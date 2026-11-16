/*
 * ENGIE360 demo service worker: shows web-push notifications and opens the app when one is tapped.
 * It does not cache anything, so the demo always loads fresh files.
 * Push payload: { title, body, url, tag? } (PushPayload in shared/contract.ts).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'MijnENGIE';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Reuse an open tab of the app when there is one.
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
