import { BRAND, colors } from '@engie/shared';

/**
 * Service worker for the customer web app, served at /app/sw.js (scope /app/). It only handles web push:
 * show the notification, and on tap focus the open app (or open it) at the message's page.
 * Plain ES2017 so every phone browser runs it as-is.
 */
export const SERVICE_WORKER_JS = `/* ${BRAND.vendorName} demo: web push for the customer app */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'New message', body: event.data ? event.data.text() : '' }; }
  var title = data.title || ${JSON.stringify(BRAND.utilityName)};
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    icon: '/staff/brand/powerconnect-mark-192.png',
    badge: '/staff/brand/powerconnect-mark-64.png',
    data: { url: data.url || '/app' }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.location.origin + '/app') === 0 && 'focus' in c) {
        return c.focus().then(function (w) { return w && 'navigate' in w ? w.navigate(url) : w; });
      }
    }
    return self.clients.openWindow(url);
  }));
});
`;

/** Web app manifest: lets iPhones "Add to Home Screen" (needed for web push on iOS) and gives Android an app icon. */
export function appManifest(): string {
  return JSON.stringify({
    name: `${BRAND.utilityName} ${BRAND.appName}`,
    short_name: BRAND.appName,
    start_url: '/app/',
    scope: '/app/',
    display: 'standalone',
    background_color: colors.navy,
    theme_color: colors.navy,
    icons: [
      { src: '/staff/brand/powerconnect-mark-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/staff/brand/powerconnect-mark-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}

/** Tags added to the customer app's index.html <head> for the manifest and home-screen icon. */
export const APP_HEAD_TAGS =
  `<link rel="manifest" href="/app/manifest.webmanifest"><meta name="theme-color" content="${colors.navy}">` +
  '<meta name="apple-mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/staff/brand/powerconnect-mark-192.png">';
