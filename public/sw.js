/* Service worker FityoraStore: hanya untuk notifikasi push Author. Tidak menyimpan cache apa pun. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Push dikirim tanpa isi (tidak ada data pesanan lewat layanan push), jadi teks bersifat tetap.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('FityoraStore — Pesanan Baru', {
      body: 'Ada pesanan masuk. Ketuk untuk membuka dashboard dan memeriksa pembayaran.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'new-order',
      renotify: true,
      requireInteraction: true,
      data: { url: '/?admin=1' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
