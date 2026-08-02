import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} Netlify environment icinde eksik`)
  return value
}

async function sendPushes(supabase, subscriptions, payload, targetEmployeeId = null) {
  const targetedSubscriptions = targetEmployeeId
    ? (subscriptions || []).filter(subscription => subscription.employee_id === targetEmployeeId)
    : subscriptions || []

  const uniqueSubscriptions = Array.from(
    new Map(targetedSubscriptions.map(subscription => [subscription.endpoint, subscription])).values()
  )

  const results = await Promise.allSettled(
    uniqueSubscriptions.map(subscription =>
      webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload, {
        TTL: 60 * 60 * 24,
        urgency: 'high',
      })
    )
  )

  const expiredIds = results
    .map((result, index) => ({ result, subscription: uniqueSubscriptions[index] }))
    .filter(({ result }) =>
      result.status === 'rejected' &&
      (result.reason?.statusCode === 404 || result.reason?.statusCode === 410)
    )
    .map(({ subscription }) => subscription.id)

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return {
    total: uniqueSubscriptions.length,
    sent: results.filter(result => result.status === 'fulfilled').length,
    failed: results.filter(result => result.status === 'rejected').length,
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'ok' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST gerekli' }) }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = required('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = required('VAPID_PRIVATE_KEY')
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:destek@berberrandevu.com'

    if (!supabaseUrl) throw new Error('SUPABASE_URL veya VITE_SUPABASE_URL Netlify environment icinde eksik')

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const body = JSON.parse(event.body || '{}')

    if (body.test_shop_id) {
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, employee_id')
        .eq('shop_id', body.test_shop_id)

      if (error) throw error

      const result = await sendPushes(supabase, subscriptions || [], JSON.stringify({
        title: 'Test bildirimi',
        body: 'Bildirim sistemi calisiyor. Yeni randevular bu cihaza gelecek.',
        tag: `test-${Date.now()}`,
        data: { url: '/staff/dashboard' },
      }), body.test_employee_id || null)

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'test', ...result }) }
    }

    if (!body.appointment_id) throw new Error('appointment_id gerekli')

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id,
        shop_id,
        employee_id,
        customer_name,
        appointment_date,
        start_time,
        shops(name),
        employees(name),
        services(name)
      `)
      .eq('id', body.appointment_id)
      .single()

    if (appointmentError) throw appointmentError
    if (!appointment) throw new Error('Randevu bulunamadi')

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, employee_id')
      .eq('shop_id', appointment.shop_id)

    if (subscriptionsError) throw subscriptionsError

    const serviceName = appointment.services?.name || 'Hizmet'
    const eventType = body.event_type || 'created'
    const notification = {
      created: {
        title: 'Yeni randevu alindi',
        body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)} - ${serviceName}`,
      },
      rescheduled: {
        title: 'Musteri randevuyu guncelledi',
        body: `${appointment.customer_name} yeni saatini ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)} olarak secti.`,
      },
      cancelled: {
        title: 'Musteri randevuyu iptal etti',
        body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)}`,
      },
    }[eventType] || {
      title: 'Randevu guncellendi',
      body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)}`,
    }
    // Musteri tarafindaki degisiklikler dukkan sahibinin de dahil oldugu tum kayitli cihazlara gider.
    // Yeni randevular ise yalnizca randevunun atandigi personele gonderilmeye devam eder.
    const targetEmployeeId = ['rescheduled', 'cancelled'].includes(eventType) ? null : appointment.employee_id
    const result = await sendPushes(supabase, subscriptions || [], JSON.stringify({
      ...notification,
      tag: `appointment-${eventType}-${appointment.id}`,
      data: {
        url: `/staff/dashboard?appointmentId=${appointment.id}`,
        appointmentId: appointment.id,
        shopName: appointment.shops?.name,
        employeeName: appointment.employees?.name,
      },
    }), targetEmployeeId || null)

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...result }) }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: error.message }),
    }
  }
}
