import { supabase } from './supabase'

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export function getPushSupportStatus() {
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Bu tarayici service worker desteklemiyor.' }
  if (!('PushManager' in window)) return { supported: false, reason: 'Bu tarayici push bildirim desteklemiyor.' }
  if (!('Notification' in window)) return { supported: false, reason: 'Bu tarayici bildirim desteklemiyor.' }
  if (!window.isSecureContext) return { supported: false, reason: 'Bildirim icin HTTPS gerekir. Localhost test icin uygundur.' }
  if (!PUBLIC_VAPID_KEY) return { supported: false, reason: 'VITE_VAPID_PUBLIC_KEY .env icinde eksik.' }
  return { supported: true, reason: '' }
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
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
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

export async function showStaffAppointmentNotification(appointment) {
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

    await registration.showNotification('Yeni randevu alindi', {
      body: body || 'Yeni bir randevu olusturuldu.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `appointment-${appointment?.id || Date.now()}`,
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
  if (!appointmentId) return

  try {
    await invokePushSender({ appointment_id: appointmentId })
  } catch (error) {
    console.warn('Push bildirimi gonderilemedi:', error)
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
  try {
    const response = await fetch('/.netlify/functions/send-appointment-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) return await response.json()

    const data = await response.json().catch(() => null)
    throw new Error(data?.error || `Netlify function hata verdi: ${response.status}`)
  } catch (netlifyError) {
    const { data, error } = await supabase.functions.invoke('send-appointment-push', { body })
    if (error) throw new Error(`${netlifyError.message}. Supabase Edge Function: ${error.message}`)
    return data
  }
}
