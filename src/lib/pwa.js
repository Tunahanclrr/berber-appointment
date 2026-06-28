export const BOOKING_PWA_PATH_KEY = 'randevu-zamani-booking-pwa-path'

export function isStandaloneWebApp() {
  return window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches
}

export function getSavedBookingPath() {
  const path = localStorage.getItem(BOOKING_PWA_PATH_KEY) || ''
  return path.startsWith('/book/') ? path : ''
}

export function rememberBookingPath(path) {
  if (!path?.startsWith('/book/')) return
  localStorage.setItem(BOOKING_PWA_PATH_KEY, path)
  setBookingManifest(path)
}

export function setBookingManifest(startUrl) {
  const manifest = {
    name: 'Randevu Zamani',
    short_name: 'Randevu',
    description: 'Randevu alma ekrani',
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#F8FAFC',
    orientation: 'portrait',
    icons: [
      {
        src: '/berber-logo-png.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }

  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return

  link.setAttribute(
    'href',
    `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`
  )
}

export function isLockedBookingPwa() {
  return isStandaloneWebApp() && Boolean(getSavedBookingPath())
}
