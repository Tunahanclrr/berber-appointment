import { createClient } from '@supabase/supabase-js'

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

function normalizePhone(value = '') {
  const digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length === 12) return `0${digits.slice(2)}`
  if (digits.startsWith('5') && digits.length === 10) return `0${digits}`
  return digits
}

function addMinutes(time, minutes) {
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number)
  const date = new Date(2000, 0, 1, hour || 0, minute || 0)
  date.setMinutes(date.getMinutes() + Number(minutes || 0))
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function minutesOf(time) {
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

function isOverlapping(startA, endA, startB, endB) {
  return minutesOf(startA) < minutesOf(endB) && minutesOf(endA) > minutesOf(startB)
}

async function verifyTurnstile(token, remoteIp) {
  const secret = required('TURNSTILE_SECRET_KEY')

  const formData = new URLSearchParams()
  formData.set('secret', secret)
  formData.set('response', token || '')
  if (remoteIp) formData.set('remoteip', remoteIp)

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  })
  const result = await response.json()

  if (!result.success) {
    throw new Error('Guvenlik dogrulamasi basarisiz. Sayfayi yenileyip tekrar dene.')
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
    const body = JSON.parse(event.body || '{}')

    if (body.website) {
      throw new Error('Randevu istegi reddedildi.')
    }

    await verifyTurnstile(
      body.turnstileToken,
      event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.headers['x-forwarded-for']
    )

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL veya VITE_SUPABASE_URL Netlify environment icinde eksik')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const shopId = body.shopId
    const employeeId = body.employeeId
    const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.filter(Boolean) : []
    const customerName = String(body.customerName || '').trim()
    const customerPhone = normalizePhone(body.customerPhone)
    const appointmentDate = body.appointmentDate
    const startTime = String(body.startTime || '').slice(0, 5)

    if (!shopId || !employeeId || serviceIds.length === 0 || !customerName || !customerPhone || !appointmentDate || !startTime) {
      throw new Error('Eksik randevu bilgisi.')
    }

    if (!/^05\d{9}$/.test(customerPhone)) {
      throw new Error('Gecerli bir Turkiye cep telefonu gir.')
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { count: rapidCount, error: rapidError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('customer_phone', customerPhone)
      .gte('created_at', twoMinutesAgo)

    if (rapidError) throw rapidError
    if ((rapidCount || 0) >= 2) {
      throw new Error('Cok hizli randevu denemesi yapildi. Lutfen biraz bekleyip tekrar dene.')
    }

    const { count: dailyCount, error: dailyError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('customer_phone', customerPhone)
      .eq('appointment_date', appointmentDate)
      .neq('status', 'cancelled')

    if (dailyError) throw dailyError
    if ((dailyCount || 0) >= 5) {
      throw new Error('Bu telefon numarasi ile bugun icin cok fazla randevu alindi. Lutfen dukkanla iletisime gec.')
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .single()

    if (employeeError || !employee) throw new Error('Personel bulunamadi.')

    const { data: selectedServices, error: servicesError } = await supabase
      .from('services')
      .select('id, name, duration, price')
      .eq('shop_id', shopId)
      .in('id', serviceIds)

    if (servicesError) throw servicesError
    if (!selectedServices || selectedServices.length !== serviceIds.length) {
      throw new Error('Hizmet bilgisi bulunamadi.')
    }

    const totalDuration = selectedServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0)
    const totalPrice = selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0)
    const endTime = addMinutes(startTime, totalDuration || 30)

    const { data: conflicts, error: conflictError } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, services(duration)')
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)
      .eq('appointment_date', appointmentDate)
      .neq('status', 'cancelled')

    if (conflictError) throw conflictError

    const hasConflict = (conflicts || []).some(appointment => {
      const conflictStart = String(appointment.start_time || '').slice(0, 5)
      const conflictEnd = String(appointment.end_time || '').slice(0, 5) || addMinutes(conflictStart, appointment.services?.duration || 30)
      return isOverlapping(startTime, endTime, conflictStart, conflictEnd)
    })

    if (hasConflict) {
      throw new Error('Bu saat az once doldu, baska saat sec.')
    }

    const notes = [
      `Secilen hizmetler: ${selectedServices.map(service => service.name).join(', ')}`,
      `Toplam sure: ${totalDuration} dk`,
      `Toplam ucret: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalPrice)}`,
    ].join('\n')

    const { data: createdAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        shop_id: shopId,
        employee_id: employeeId,
        service_id: selectedServices[0].id,
        customer_name: customerName,
        customer_phone: customerPhone,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        notes,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, appointmentId: createdAppointment.id }),
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: error.message }),
    }
  }
}
