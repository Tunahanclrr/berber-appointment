import { formatPrice, formatTime } from './time'

export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('90')) return digits
  if (digits.startsWith('0')) return `90${digits.slice(1)}`
  if (digits.length === 10) return `90${digits}`
  return digits
}

export function getShopWhatsAppPhone(shop) {
  return shop?.working_hours?.whatsapp?.phone || ''
}

export function buildWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone)
  if (!normalized) return ''
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function buildAppointmentMessage({ shopName, appointment, status = 'confirmed' }) {
  const statusText = {
    confirmed: 'onaylanmistir',
    done: 'tamamlanmistir',
    cancelled: 'iptal edilmistir',
    pending: 'alinmistir',
  }[status] || 'guncellenmistir'

  const servicesLine = appointment.notes?.match(/Secilen hizmetler:\s*(.+)/i)?.[1]
  const serviceName = servicesLine || appointment.service_name || appointment.services?.name || 'Hizmet'
  const price = appointment.service_price ?? appointment.services?.price
  const date = appointment.appointment_date
  const time = formatTime(appointment.start_time)

  return [
    `Merhaba ${appointment.customer_name},`,
    `${shopName || 'Berber'} randevunuz ${statusText}.`,
    `Hizmet: ${serviceName}`,
    `Tarih: ${date}`,
    `Saat: ${time}`,
    price != null ? `Ucret: ${formatPrice(price)}` : '',
    'Gorusmek uzere.',
  ].filter(Boolean).join('\n')
}
