import { addMinutes, isOverlapping } from './time'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const DEFAULT_HOURS = {
  monday:    { open: true,  start: '09:00', end: '20:00' },
  tuesday:   { open: true,  start: '09:00', end: '20:00' },
  wednesday: { open: true,  start: '09:00', end: '20:00' },
  thursday:  { open: true,  start: '09:00', end: '20:00' },
  friday:    { open: true,  start: '09:00', end: '20:00' },
  saturday:  { open: true,  start: '10:00', end: '18:00' },
  sunday:    { open: false, start: '09:00', end: '18:00' },
}

export function getDayKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return DAY_KEYS[d.getDay()]
}

export function getWorkingHoursForDate(workingHours, dateStr) {
  const hours = workingHours || DEFAULT_HOURS
  const key = getDayKey(dateStr)
  return hours[key] || DEFAULT_HOURS[key]
}

export function generateSlots(start, end, interval = 30) {
  const slots = []
  let current = start
  while (current < end) {
    slots.push(current)
    current = addMinutes(current, interval)
  }
  return slots
}

function isToday(dateStr) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return dateStr === `${year}-${month}-${day}`
}

function currentTimeHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function computeAvailableSlots({ date, duration, workingHours, bookedAppointments, employeeId }) {
  const dayHours = getWorkingHoursForDate(workingHours, date)

  if (!dayHours.open) {
    return { slots: [], allSlots: [], closed: true }
  }

  const allSlots = generateSlots(dayHours.start, dayHours.end, 30)
    .filter(slot => addMinutes(slot, duration) <= dayHours.end)

  const relevant = bookedAppointments.filter(a => {
    if (a.status === 'cancelled') return false
    if (employeeId && a.employee_id && a.employee_id !== employeeId) return false
    return true
  })

  const normalizeTime = (time) => time?.slice(0, 5)
  const getAppointmentEnd = (appointment) => {
    const start = normalizeTime(appointment.start_time)
    const end = normalizeTime(appointment.end_time)
    if (end) return end

    const fallbackDuration =
      Number(appointment.services?.duration) ||
      Number(appointment.service_duration) ||
      30

    return start ? addMinutes(start, fallbackDuration) : ''
  }

  const slots = allSlots.map(slot => {
    const end = addMinutes(slot, duration)
    const isPast = isToday(date) && slot <= currentTimeHHMM()
    const isBooked = relevant.some(a => {
      const appointmentStart = normalizeTime(a.start_time)
      const appointmentEnd = getAppointmentEnd(a)
      if (!appointmentStart || !appointmentEnd) return false
      return isOverlapping(slot, end, appointmentStart, appointmentEnd)
    })
    return { time: slot, available: !isPast && !isBooked, end, past: isPast }
  })

  return { slots, allSlots, closed: false }
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}
