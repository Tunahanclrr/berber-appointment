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

  const notificationData = event.notification.data || {}
  const appointmentId = notificationData.appointmentId
  const targetPath = notificationData.url || (
    appointmentId
      ? `/staff/dashboard?appointmentId=${encodeURIComponent(appointmentId)}`
      : '/staff/dashboard'
  )
  // iOS/Android tarayicilarinda goreli adres bazen PWA'nin ana ekranina
  // doner. Tam adres hem yeni pencere hem acik pencere icin guvenilirdir.
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      try {
        const navigatedClient = await client.navigate(targetUrl)
        if (navigatedClient && 'focus' in navigatedClient) {
          return navigatedClient.focus()
        }
      } catch {
        // Acik pencere yonlendirilemiyorsa asagida yeni pencere acilir.
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl)
    }
  })())
})
