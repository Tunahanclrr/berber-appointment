import { supabase } from './supabase'

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const PUSH_FUNCTION_URL = import.meta.env.VITE_PUSH_FUNCTION_URL
let cachedPublicVapidKey = ''

function isLocalDevHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneWebApp() {
  return window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches
}

function urlBase64ToUint8Array(base64String) {
  const cleanKey = String(base64String || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s/g, '')

  if (!cleanKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY bos gorunuyor.')
  }

  const padding = '='.repeat((4 - (cleanKey.length % 4)) % 4)
  const base64 = (cleanKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  let rawData = ''

  try {
    rawData = window.atob(base64)
  } catch {
    throw new Error('VITE_VAPID_PUBLIC_KEY gecersiz. Public key tek satir olmali; private key buraya yazilmaz.')
  }

  if (rawData.length !== 65) {
    throw new Error('VITE_VAPID_PUBLIC_KEY public key olmali. Private key veya eksik key girilmis gorunuyor.')
  }

  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export function getPushSupportStatus() {
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Bu tarayici service worker desteklemiyor.' }
  if (!window.isSecureContext) return { supported: false, reason: 'Bildirim icin HTTPS gerekir. Localhost test icin uygundur.' }
  if (isIosDevice() && !isStandaloneWebApp()) {
    return {
      supported: false,
      reason: 'iPhone bildirimleri Safari sekmesinde calismaz. Safari Paylas butonundan "Ana Ekrana Ekle" de, sonra uygulamayi ana ekrandaki ikonundan acip Bildirimleri Ac butonuna bas.',
    }
  }
  if (!('PushManager' in window)) {
    return {
      supported: false,
      reason: isIosDevice()
        ? 'iPhone icin iOS 16.4 veya ustu gerekir. Siteyi Ana Ekrana ekleyip ikonundan actigindan emin ol.'
        : 'Bu tarayici push bildirim desteklemiyor.',
    }
  }
  if (!('Notification' in window)) return { supported: false, reason: 'Bu tarayici bildirim desteklemiyor.' }
  return { supported: true, reason: '' }
}

async function getPublicVapidKey() {
  if (cachedPublicVapidKey) return cachedPublicVapidKey

  const buildKey = String(PUBLIC_VAPID_KEY || '').trim()
  if (buildKey) {
    cachedPublicVapidKey = buildKey
    return cachedPublicVapidKey
  }

  const response = await fetch('/.netlify/functions/public-config')
  if (response.ok) {
    const data = await response.json().catch(() => null)
    const runtimeKey = String(data?.vapidPublicKey || '').trim()
    if (runtimeKey) {
      cachedPublicVapidKey = runtimeKey
      return cachedPublicVapidKey
    }
  }

  throw new Error('VAPID public key bulunamadi. Netlify environment icinde VAPID_PUBLIC_KEY veya VITE_VAPID_PUBLIC_KEY ekli olmali.')
}

export async function getStaffPushSubscriptionStatus() {
  const support = getPushSupportStatus()
  if (!support.supported) return { enabled: false, reason: support.reason }
  if (Notification.permission !== 'granted') return { enabled: false, reason: 'Bildirim izni bekleniyor.' }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  return {
    enabled: Boolean(subscription),
    reason: subscription ? '' : 'Bu cihazda bildirim aboneligi yok.',
  }
}

export async function enableStaffPushNotifications({ shopId, employeeId }) {
  const support = getPushSupportStatus()
  if (!support.supported) throw new Error(support.reason)
  if (!shopId || !employeeId) throw new Error('Personel oturumu eksik. Cikis yapip tekrar giris yap.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Bildirim izni verilmedi. Tarayici ayarlarindan izin verebilirsin.')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const publicVapidKey = await getPublicVapidKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      shop_id: shopId,
      employee_id: employeeId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) throw error
  return true
}

export async function showStaffAppointmentNotification(appointment, eventType = 'created') {
  try {
    const support = getPushSupportStatus()
    if (!support.supported || Notification.permission !== 'granted') return false

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const time = String(appointment?.start_time || '').slice(0, 5)
    const body = [
      appointment?.customer_name || 'Yeni musteri',
      appointment?.appointment_date,
      time,
    ].filter(Boolean).join(' - ')

    const isUpdated = eventType === 'updated'
    await registration.showNotification(isUpdated ? 'Randevu guncellendi' : 'Yeni randevu alindi', {
      body: isUpdated ? `${appointment?.customer_name || 'Musteri'} randevu saatini guncelledi. ${body}` : (body || 'Yeni bir randevu olusturuldu.'),
      icon: '/berber-logo-png.png',
      badge: '/berber-logo-png.png',
      tag: `appointment-${eventType}-${appointment?.id || Date.now()}`,
      data: {
        url: appointment?.id ? `/staff/dashboard?appointmentId=${appointment.id}` : '/staff/dashboard',
        appointmentId: appointment?.id,
      },
      requireInteraction: true,
    })

    return true
  } catch (error) {
    console.warn('Yerel bildirim gosterilemedi:', error)
    return false
  }
}

export async function notifyAppointmentCreated(appointmentId) {
  return notifyAppointmentEvent(appointmentId, 'created')
}

export async function notifyAppointmentUpdated(appointmentId, eventType) {
  return notifyAppointmentEvent(appointmentId, eventType)
}

async function notifyAppointmentEvent(appointmentId, eventType = 'created') {
  if (!appointmentId) return
  if (isLocalDevHost() && !PUSH_FUNCTION_URL) return

  try {
    await invokePushSender({ appointment_id: appointmentId, event_type: eventType })
    return true
  } catch (error) {
    console.warn('Push bildirimi gonderilemedi:', error)
    return false
  }
}

export async function sendTestStaffPushNotification(shopId, employeeId) {
  if (!shopId) throw new Error('Dukkan bilgisi eksik.')
  if (!employeeId) throw new Error('Personel bilgisi eksik.')

  const data = await invokePushSender({ test_shop_id: shopId, test_employee_id: employeeId })
  if (!data?.ok) throw new Error(data?.error || 'Test bildirimi gonderilemedi.')
  if (!data.sent) throw new Error('Kayitli bildirim cihazi bulunamadi. Once Bildirimleri Ac butonuna bas.')

  return data
}

async function invokePushSender(body) {
  const errors = []
  const netlifyUrls = [
    String(PUSH_FUNCTION_URL || '').trim(),
    isLocalDevHost() ? '' : '/.netlify/functions/send-appointment-push',
  ].filter(Boolean)

  for (const url of netlifyUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => null)
      if (response.ok) return data

      errors.push(`${url}: ${data?.error || `HTTP ${response.status}`}`)
    } catch (error) {
      errors.push(`${url}: ${error.message}`)
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-appointment-push', { body })
    if (error) throw error
    return data
  } catch (error) {
    errors.push(`Supabase Edge Function: ${error.message}`)
  }

  throw new Error([
    'Push gonderici calismiyor.',
    ...errors,
    'Netlify kullanacaksan siteyi Netlify Functions ile deploy et veya localde netlify dev calistir.',
    'Supabase kullanacaksan send-appointment-push Edge Function deploy edilmis ve secrets eklenmis olmali.',
  ].join(' '))
}
