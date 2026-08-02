import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.107.0'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function requireEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} secret eksik`)
  return value
}

async function sendPushes(admin: ReturnType<typeof createClient>, subscriptions: any[], payload: string, targetEmployeeId: string | null = null) {
  const targetedSubscriptions = targetEmployeeId
    ? (subscriptions || []).filter(subscription => subscription.employee_id === targetEmployeeId)
    : subscriptions || []

  const relatedSubscriptions = Array.from(
    new Map(targetedSubscriptions.map(subscription => [subscription.endpoint, subscription])).values()
  )

  const results = await Promise.allSettled(
    relatedSubscriptions.map(subscription =>
      webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload, {
        TTL: 60 * 60 * 24,
        urgency: 'high',
      }).catch(error => {
        console.error('Push send failed', {
          subscriptionId: subscription.id,
          statusCode: error?.statusCode,
          body: error?.body,
          message: error?.message,
        })
        throw error
      })
    )
  )

  const expiredIds = results
    .map((result, index) => ({ result, subscription: relatedSubscriptions[index] }))
    .filter(({ result }) =>
      result.status === 'rejected' &&
      (result.reason?.statusCode === 404 || result.reason?.statusCode === 410)
    )
    .map(({ subscription }) => subscription.id)

  const failures = results
    .map((result, index) => ({ result, subscription: relatedSubscriptions[index] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ result, subscription }) => ({
      subscriptionId: subscription.id,
      statusCode: result.reason?.statusCode || null,
      message: result.reason?.message || 'Bilinmeyen push hatasi',
      body: result.reason?.body || null,
    }))

  if (expiredIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return {
    total: relatedSubscriptions.length,
    sent: results.filter(result => result.status === 'fulfilled').length,
    failed: results.filter(result => result.status === 'rejected').length,
    failures,
  }
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = requireEnv('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = requireEnv('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:destek@berberrandevu.com'

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const body = await req.json()
    const { appointment_id, test_shop_id, test_employee_id, event_type = 'created' } = body

    if (test_shop_id) {
      const { data: subscriptions, error: subscriptionsError } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, employee_id')
        .eq('shop_id', test_shop_id)

      if (subscriptionsError) throw subscriptionsError

      const result = await sendPushes(admin, subscriptions || [], JSON.stringify({
        title: 'Test bildirimi',
        body: 'Bildirim sistemi calisiyor. Yeni randevular bu cihaza gelecek.',
        tag: `test-${Date.now()}`,
        data: { url: '/staff/dashboard' },
      }), test_employee_id || null)

      return new Response(JSON.stringify({ ok: true, mode: 'test', ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!appointment_id) throw new Error('appointment_id gerekli')

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(`
        id,
        shop_id,
        employee_id,
        customer_name,
        customer_phone,
        appointment_date,
        start_time,
        status,
        shops(name),
        employees(name),
        services(name)
      `)
      .eq('id', appointment_id)
      .single()

    if (appointmentError) throw appointmentError
    if (!appointment) throw new Error('Randevu bulunamadi')

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, employee_id')
      .eq('shop_id', appointment.shop_id)

    if (subscriptionsError) throw subscriptionsError

    const shopName = appointment.shops?.name || 'Dukkan'
    const employeeName = appointment.employees?.name || 'Personel'
    const serviceName = appointment.services?.name || 'Hizmet'

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
    }[event_type] || {
      title: 'Randevu guncellendi',
      body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)}`,
    }

    const payload = JSON.stringify({
      ...notification,
      tag: `appointment-${event_type}-${appointment.id}`,
      data: {
        url: `/staff/dashboard?appointmentId=${appointment.id}`,
        appointmentId: appointment.id,
        shopName,
        employeeName,
      },
    })

    // Musteri degisiklikleri, randevu atamasi fark etmeksizin dukkanin tum kayitli cihazlarina gider.
    const targetEmployeeId = ['rescheduled', 'cancelled'].includes(event_type) ? null : appointment.employee_id
    const result = await sendPushes(admin, subscriptions || [], payload, targetEmployeeId || null)

    return new Response(JSON.stringify({
      ok: true,
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
