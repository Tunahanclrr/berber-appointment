import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.107.0'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:destek@berberrandevu.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { appointment_id } = await req.json()
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

    const relatedSubscriptions = (subscriptions || []).filter(subscription =>
      !subscription.employee_id || subscription.employee_id === appointment.employee_id
    )

    const shopName = appointment.shops?.name || 'Dukkan'
    const employeeName = appointment.employees?.name || 'Personel'
    const serviceName = appointment.services?.name || 'Hizmet'

    const payload = JSON.stringify({
      title: 'Yeni randevu alindi',
      body: `${appointment.customer_name} - ${appointment.appointment_date} ${String(appointment.start_time).slice(0, 5)} - ${serviceName}`,
      tag: `appointment-${appointment.id}`,
      data: {
        url: '/staff/dashboard',
        appointmentId: appointment.id,
        shopName,
        employeeName,
      },
    })

    const results = await Promise.allSettled(
      relatedSubscriptions.map(subscription =>
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
      .map((result, index) => ({ result, subscription: relatedSubscriptions[index] }))
      .filter(({ result }) =>
        result.status === 'rejected' &&
        (result.reason?.statusCode === 404 || result.reason?.statusCode === 410)
      )
      .map(({ subscription }) => subscription.id)

    if (expiredIds.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', expiredIds)
    }

    return new Response(JSON.stringify({
      ok: true,
      sent: results.filter(result => result.status === 'fulfilled').length,
      failed: results.filter(result => result.status === 'rejected').length,
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
