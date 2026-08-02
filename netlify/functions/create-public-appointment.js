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

async function saveCustomer(supabase, { shopId, name, phone }) {
  const customerName = String(name || '').trim()
  const customerPhone = normalizePhone(phone)
  if (!shopId || !customerName || !customerPhone) return

  const { error } = await supabase
    .from('customers')
    .upsert({
      shop_id: shopId,
      name: customerName,
      phone: customerPhone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,phone' })

  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error
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

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getDayHours(workingHours, dateStr) {
  const date = new Date(`${dateStr}T12:00:00`)
  const key = DAY_KEYS[date.getDay()]
  return workingHours?.[key]
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

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URI
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

    const [{ data: employee, error: employeeError }, { data: shop, error: shopError }] = await Promise.all([
      supabase
        .from('employees')
        .select('id, working_hours')
        .eq('id', employeeId)
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('shops')
        .select('working_hours')
        .eq('id', shopId)
        .single(),
    ])

    if (employeeError || !employee) throw new Error('Personel bulunamadi.')
    if (shopError || !shop) throw new Error('Dukkan bulunamadi.')

    const [{ data: selectedServices, error: servicesError }, { data: employeeServices, error: employeeServicesError }] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, duration, price')
        .eq('shop_id', shopId)
        .in('id', serviceIds),
      supabase
        .from('employee_services')
        .select('*')
        .eq('employee_id', employeeId),
    ])

    if (servicesError) throw servicesError
    if (employeeServicesError) throw employeeServicesError

    const assignments = employeeServices || []
    const assignedByServiceId = new Map(assignments.map(item => [item.service_id, item]))

    if (assignments.length > 0 && serviceIds.some(serviceId => !assignedByServiceId.has(serviceId))) {
      throw new Error('Secilen hizmet bu personele tanimli degil.')
    }

    const effectiveServices = (selectedServices || []).map(service => {
      const assignment = assignedByServiceId.get(service.id)
      return {
        ...service,
        duration: assignment?.duration ?? service.duration,
        price: assignment?.price ?? service.price,
      }
    })

    if (effectiveServices.length !== serviceIds.length) {
      throw new Error('Hizmet bilgisi bulunamadi.')
    }

    const totalDuration = effectiveServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0)
    const totalPrice = effectiveServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0)
    const endTime = addMinutes(startTime, totalDuration || 30)
    const dayHours = getDayHours(employee.working_hours || shop.working_hours, appointmentDate)

    if (!dayHours?.open || startTime < dayHours.start || endTime > dayHours.end) {
      throw new Error('Secilen personel bu saatte calismiyor.')
    }

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
      `Secilen hizmetler: ${effectiveServices.map(service => service.name).join(', ')}`,
      `Toplam sure: ${totalDuration} dk`,
      `Toplam ucret: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalPrice)}`,
    ].join('\n')

    const { data: createdAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        shop_id: shopId,
        employee_id: employeeId,
        service_id: effectiveServices[0].id,
        customer_name: customerName,
        customer_phone: customerPhone,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        notes,
      })
      .select('id, appointment_code')
      .single()

    if (insertError) throw insertError

    await saveCustomer(supabase, {
      shopId,
      name: customerName,
      phone: customerPhone,
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        appointmentId: createdAppointment.id,
        appointmentCode: createdAppointment.appointment_code,
      }),
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: error.message }),
    }
  }
}
