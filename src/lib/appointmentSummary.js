import { formatPrice } from './time'

function getNoteValue(notes, label) {
  const match = String(notes || '').match(new RegExp(`${label}:\\s*(.+)`, 'i'))
  return match?.[1]?.trim() || ''
}

function parsePriceText(value) {
  const cleaned = String(value || '').replace(/[^\d,.-]/g, '')
  if (!cleaned) return null

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function getAppointmentServiceName(appointment) {
  return (
    getNoteValue(appointment?.notes, 'Secilen hizmetler') ||
    appointment?.service_name ||
    appointment?.services?.name ||
    'Hizmet'
  )
}

export function getAppointmentPriceValue(appointment) {
  const notePrice = parsePriceText(getNoteValue(appointment?.notes, 'Toplam ucret'))
  if (notePrice != null) return notePrice

  const price = appointment?.service_price ?? appointment?.services?.price
  const numericPrice = Number(price)
  return Number.isFinite(numericPrice) ? numericPrice : null
}

export function getAppointmentPriceLabel(appointment) {
  const price = getAppointmentPriceValue(appointment)
  return price == null ? '' : formatPrice(price)
}

export function getAppointmentDurationLabel(appointment) {
  const noteDuration = getNoteValue(appointment?.notes, 'Toplam sure')
  if (noteDuration) return noteDuration

  const duration = appointment?.service_duration ?? appointment?.services?.duration
  const numericDuration = Number(duration)
  return Number.isFinite(numericDuration) ? `${numericDuration} dk` : ''
}
