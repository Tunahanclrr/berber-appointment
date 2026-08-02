self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: 'Yeni randevu',
      body: event.data ? event.data.text() : 'Yeni bir randevu olusturuldu.',
    }
  }

  const title = payload.title || 'Yeni randevu'
  const options = {
    body: payload.body || 'Yeni bir randevu olusturuldu.',
    icon: '/berber-logo-png.png',
    badge: '/berber-logo-png.png',
    tag: payload.tag || `appointment-${Date.now()}`,
    data: payload.data || { url: '/staff/dashboard' },
    requireInteraction: true,
    renotify: true,
    silent: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/staff/dashboard'

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      if ('focus' in client) {
        client.navigate(targetUrl)
        return client.focus()
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl)
    }
  })())
})
