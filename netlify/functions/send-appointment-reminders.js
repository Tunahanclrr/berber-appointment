import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const config = {
  schedule: '*/15 * * * *',
}

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} Netlify environment icinde eksik`)
  return value
}

function dateInTurkey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDaysISO(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00+03:00`)
  date.setDate(date.getDate() + days)
  return dateInTurkey(date)
}

function appointmentDateTime(appointment) {
  return new Date(`${appointment.appointment_date}T${String(appointment.start_time || '00:00').slice(0, 5)}:00+03:00`)
}

async function sendPushes(supabase, subscriptions, payload, targetEmployeeId) {
  const targetedSubscriptions = (subscriptions || []).filter(subscription => subscription.employee_id === targetEmployeeId)
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
      }, payload)
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

export async function handler() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = required('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = required('VAPID_PRIVATE_KEY')
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:destek@randevuzamani.com'

    if (!supabaseUrl) throw new Error('SUPABASE_URL veya VITE_SUPABASE_URL Netlify environment icinde eksik')

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const today = dateInTurkey()
    const tomorrow = addDaysISO(today, 1)
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        shop_id,
        employee_id,
        customer_name,
        appointment_date,
        start_time,
        status,
        notes,
        reminder_24h_sent_at,
        reminder_2h_sent_at,
        shops(name),
        employees(name),
        services(name)
      `)
      .in('appointment_date', [today, tomorrow])
      .in('status', ['pending', 'confirmed'])
      .not('employee_id', 'is', null)

    if (appointmentsError) throw appointmentsError

    const due = []
    const now = new Date()
    for (const appointment of appointments || []) {
      const minutesUntil = Math.round((appointmentDateTime(appointment).getTime() - now.getTime()) / 60000)
      if (!appointment.reminder_24h_sent_at && minutesUntil >= 1425 && minutesUntil <= 1455) {
        due.push({ appointment, type: '24h', column: 'reminder_24h_sent_at', label: 'yarin' })
      }
      if (!appointment.reminder_2h_sent_at && minutesUntil >= 105 && minutesUntil <= 135) {
        due.push({ appointment, type: '2h', column: 'reminder_2h_sent_at', label: '2 saat sonra' })
      }
    }

    if (due.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, checked: appointments?.length || 0, sent: 0 }) }
    }

    const shopIds = [...new Set(due.map(item => item.appointment.shop_id))]
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('id, shop_id, endpoint, p256dh, auth, employee_id')
      .in('shop_id', shopIds)

    if (subscriptionsError) throw subscriptionsError

    let sent = 0
    let failed = 0
    for (const item of due) {
      const { appointment, type, column, label } = item
      const serviceName = appointment.notes?.match(/Secilen hizmetler:\s*(.+)/i)?.[1] || appointment.services?.name || 'Hizmet'
      const payload = JSON.stringify({
        title: type === '24h' ? 'Yarin randevun var' : 'Randevu yaklasiyor',
        body: `${appointment.customer_name} - ${label} ${String(appointment.start_time).slice(0, 5)} - ${serviceName}`,
        tag: `appointment-reminder-${type}-${appointment.id}`,
        data: {
          url: `/staff/dashboard?appointmentId=${appointment.id}`,
          appointmentId: appointment.id,
          shopName: appointment.shops?.name,
          employeeName: appointment.employees?.name,
          reminderType: type,
        },
      })

      const result = await sendPushes(supabase, subscriptions || [], payload, appointment.employee_id)
      sent += result.sent
      failed += result.failed

      await supabase
        .from('appointments')
        .update({ [column]: new Date().toISOString() })
        .eq('id', appointment.id)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, checked: appointments?.length || 0, due: due.length, sent, failed }),
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: error.message }),
    }
  }
}
