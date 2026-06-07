export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function normalizeTurkishMobile(value) {
  let digits = digitsOnly(value)

  if (digits.startsWith('90')) digits = `0${digits.slice(2)}`
  if (digits.length === 10 && digits.startsWith('5')) digits = `0${digits}`
  if (digits.length > 11) digits = digits.slice(0, 11)

  return digits
}

export function formatTurkishMobile(value) {
  const digits = normalizeTurkishMobile(value)
  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 7),
    digits.slice(7, 9),
    digits.slice(9, 11),
  ].filter(Boolean)

  return parts.join(' ')
}

export function formatTurkishMobileLocal(value) {
  const digits = normalizeTurkishMobile(value).replace(/^0/, '')
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean)

  return parts.join(' ')
}

export function formatTurkishMobileFromLocal(value) {
  let digits = digitsOnly(value)
  if (digits.startsWith('90')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  return formatTurkishMobile(`0${digits}`)
}

export function isValidTurkishMobile(value) {
  return /^05\d{9}$/.test(normalizeTurkishMobile(value))
}

export function getTurkishMobileError(value) {
  if (!String(value || '').trim()) return 'Telefon numarasi gerekli.'
  if (!isValidTurkishMobile(value)) return 'Lutfen 05xx xxx xx xx formatinda gecerli bir cep telefonu gir.'
  return ''
}
