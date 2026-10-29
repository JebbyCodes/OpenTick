const C = 'opentick-v__VERSION__';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(__FILES__))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
// network first so updates show up immediately; cache is the offline fallback
self.addEventListener('fetch', e => {
  // only the app's own files: never touch cross-origin requests (sync servers), or failures would turn into index.html and credentials-protected data would be cached
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});

// tapping a reminder brings OpenTick to the front
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { for (const c of list) { if ('focus' in c) return c.focus(); } return self.clients.openWindow ? self.clients.openWindow('./') : undefined; }));
});
