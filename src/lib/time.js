export function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function formatTime(time) {
  if (!time) return ''
  return time.slice(0, 5)
}

export function formatPrice(price) {
  if (price == null) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(price)
}

export function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const WORK_START = '09:00'
export const WORK_END = '20:00'
export const SLOT_INTERVAL = 30

export function generateTimeSlots(duration) {
  const slots = []
  let current = WORK_START
  while (addMinutes(current, duration) <= WORK_END) {
    slots.push(current)
    current = addMinutes(current, SLOT_INTERVAL)
  }
  return slots
}

export function isOverlapping(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2
}
