import { formatPrice, formatTime } from './time'
import { getAppointmentPriceValue, getAppointmentServiceName } from './appointmentSummary'

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
    reminder_24h: 'icin hatirlatmadir',
    reminder_2h: 'icin hatirlatmadir',
  }[status] || 'guncellenmistir'

  const serviceName = getAppointmentServiceName(appointment)
  const price = getAppointmentPriceValue(appointment)
  const date = appointment.appointment_date
  const time = formatTime(appointment.start_time)

  return [
    `Merhaba ${appointment.customer_name},`,
    status === 'reminder_24h' || status === 'reminder_2h'
      ? `${shopName || 'Berber'} randevunuz ${statusText}.`
      : `${shopName || 'Berber'} randevunuz ${statusText}.`,
    `Hizmet: ${serviceName}`,
    `Tarih: ${date}`,
    `Saat: ${time}`,
    price != null ? `Ucret: ${formatPrice(price)}` : '',
    appointment.appointment_code ? `Randevu kodunuz: ${appointment.appointment_code}` : '',
    appointment.appointment_code ? 'Bu kodu kimseyle paylasmayin.' : '',
    'Gorusmek uzere.',
  ].filter(Boolean).join('\n')
}
