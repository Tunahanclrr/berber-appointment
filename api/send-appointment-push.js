import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} Vercel Environment Variables icinde eksik`)
  return value
}

async function sendPushes(supabase, subscriptions, payload, targetEmployeeId = null) {
  const targeted = targetEmployeeId
    ? subscriptions.filter(subscription => subscription.employee_id === targetEmployeeId)
    : subscriptions
  const unique = Array.from(new Map(targeted.map(item => [item.endpoint, item])).values())
  const results = await Promise.allSettled(unique.map(subscription => webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, payload, { TTL: 60 * 60 * 24, urgency: 'high' })))

  const expiredIds = results
    .map((result, index) => ({ result, subscription: unique[index] }))
    .filter(({ result }) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode))
    .map(({ subscription }) => subscription.id)
  if (expiredIds.length) await supabase.from('push_subscriptions').delete().in('id', expiredIds)

  return {
    total: unique.length,
    sent: results.filter(result => result.status === 'fulfilled').length,
    failed: results.filter(result => result.status === 'rejected').length,
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ ok: false, error: 'POST gerekli' })
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URI
    if (!supabaseUrl) throw new Error('SUPABASE_URL Vercel Environment Variables icinde eksik')

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:destek@berberrandevu.com',
      required('VAPID_PUBLIC_KEY'),
      required('VAPID_PRIVATE_KEY')
    )
    const supabase = createClient(supabaseUrl, required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    })
    const body = request.body || {}

    if (body.test_shop_id) {
      const { data, error } = await supabase.from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, employee_id').eq('shop_id', body.test_shop_id)
      if (error) throw error
      const result = await sendPushes(supabase, data || [], JSON.stringify({
        title: 'Test bildirimi',
        body: 'Bildirim sistemi calisiyor. Yeni randevular bu cihaza gelecek.',
        tag: `test-${Date.now()}`,
        data: { url: '/staff/dashboard' },
      }), body.test_employee_id || null)
      return response.status(200).json({ ok: true, mode: 'test', ...result })
    }

    if (!body.appointment_id) throw new Error('appointment_id gerekli')
    const { data: appointment, error: appointmentError } = await supabase.from('appointments').select(`
      id, shop_id, employee_id, customer_name, appointment_date, start_time,
      shops(name), employees(name), services(name)
    `).eq('id', body.appointment_id).single()
    if (appointmentError) throw appointmentError

    const { data: subscriptions, error: subscriptionsError } = await supabase.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, employee_id').eq('shop_id', appointment.shop_id)
    if (subscriptionsError) throw subscriptionsError

    const eventType = body.event_type || 'created'
    const serviceName = appointment.services?.name || 'Hizmet'
    const notification = {
      created: { title: 'Yeni randevu alindi', body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)} - ${serviceName}` },
      rescheduled: { title: 'Musteri randevuyu guncelledi', body: `${appointment.customer_name} yeni saatini ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)} olarak secti.` },
      cancelled: { title: 'Musteri randevuyu iptal etti', body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)}` },
    }[eventType] || { title: 'Randevu guncellendi', body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)}` }
    const targetEmployeeId = ['rescheduled', 'cancelled'].includes(eventType) ? null : appointment.employee_id
    const result = await sendPushes(supabase, subscriptions || [], JSON.stringify({
      ...notification,
      tag: `appointment-${eventType}-${appointment.id}`,
      data: { url: `/staff/dashboard?appointmentId=${appointment.id}`, appointmentId: appointment.id },
    }), targetEmployeeId)
    return response.status(200).json({ ok: true, ...result })
  } catch (error) {
    return response.status(400).json({ ok: false, error: error.message || 'Push bildirimi gonderilemedi' })
  }
}
