import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CalendarClock, Check, CheckCircle2, Clock, Copy, LockKeyhole, Scissors, ShieldCheck, Store, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addMinutes, formatTime } from '../lib/time'
import { computeAvailableSlots } from '../lib/slots'
import { getAppointmentDurationLabel, getAppointmentPriceLabel, getAppointmentServiceName } from '../lib/appointmentSummary'
import { notifyAppointmentUpdated } from '../lib/pushNotifications'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

function getAppointmentStartDate(appointment) {
  if (!appointment) return null
  return new Date(`${appointment.appointment_date}T${formatTime(appointment.start_time) || '00:00'}:00`)
}

function canManageAppointment(appointment) {
  if (!appointment || ['cancelled', 'done', 'no_show'].includes(appointment.status)) return false

  const startDate = getAppointmentStartDate(appointment)
  const twoHoursBefore = new Date(startDate.getTime() - 2 * 60 * 60 * 1000)
  return new Date() < twoHoursBefore
}

function getAppointmentDurationMinutes(appointment) {
  const noteDuration = String(getAppointmentDurationLabel(appointment) || '').match(/\d+/)?.[0]
  const duration = Number(noteDuration || appointment?.services?.duration || 30)
  return Number.isFinite(duration) && duration > 0 ? duration : 30
}

function formatDateLabel(dateStr) {
  return format(new Date(`${dateStr}T12:00`), 'd MMMM yyyy, EEEE', { locale: tr })
}

export default function CustomerAppointment() {
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [appointment, setAppointment] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [bookedAppointments, setBookedAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const manageable = canManageAppointment(appointment)
  const duration = getAppointmentDurationMinutes(appointment)
  const calendarDays = useMemo(() => Array.from({ length: 30 }, (_, index) => {
    const date = addDays(new Date(), index)
    return format(date, 'yyyy-MM-dd')
  }), [])

  const availability = useMemo(() => {
    if (!appointment || !selectedDate) return { slots: [], closed: false }

    return computeAvailableSlots({
      date: selectedDate,
      duration,
      workingHours: appointment.shops?.working_hours,
      employeeWorkingHours: appointment.employees?.working_hours,
      bookedAppointments,
      employeeId: appointment.employee_id,
    })
  }, [appointment, bookedAppointments, duration, selectedDate])

  useEffect(() => {
    if (!appointment || !selectedDate) {
      setBookedAppointments([])
      return
    }

    let cancelled = false

    supabase
      .from('appointments')
      .select('id, employee_id, start_time, end_time, status, services(duration)')
      .eq('shop_id', appointment.shop_id)
      .eq('appointment_date', selectedDate)
      .neq('status', 'cancelled')
      .or(`employee_id.eq.${appointment.employee_id},employee_id.is.null`)
      .then(({ data, error: bookedError }) => {
        if (cancelled) return
        if (bookedError) {
          setError(bookedError.message)
          setBookedAppointments([])
          return
        }
        setBookedAppointments((data || []).filter(item => item.id !== appointment.id))
      })

    return () => {
      cancelled = true
    }
  }, [appointment, selectedDate])

  async function findAppointment() {
    setError('')
    setMessage('')
    setAppointment(null)
    setSelectedDate('')
    setSelectedTime('')

    if (!code.trim()) {
      setError('Randevu kodunu gir.')
      return
    }

    setLoading(true)
    const { data, error: findError } = await supabase
      .from('appointments')
      .select('*, shops(name, working_hours), employees(name, working_hours), services(name, price, duration)')
      .eq('appointment_code', code.trim().toUpperCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      setError(findError.message)
    } else if (!data) {
      setError('Bu kodla bir randevu bulunamadi. Kodu kontrol edip tekrar dene.')
    } else {
      setAppointment(data)
      setSelectedDate(data.appointment_date)
      setSelectedTime(formatTime(data.start_time))
    }

    setLoading(false)
  }

  async function cancelAppointment() {
    if (!appointment || !manageable) return

    setCancelling(true)
    setError('')
    setMessage('')

    const { error: cancelError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)
      .eq('appointment_code', code.trim().toUpperCase())

    if (cancelError) {
      setError(cancelError.message)
    } else {
      setAppointment(prev => ({ ...prev, status: 'cancelled' }))
      setMessage('Randevun iptal edildi.')
      notifyAppointmentUpdated(appointment.id, 'cancelled')
    }

    setCancelling(false)
  }

  async function rescheduleAppointment() {
    if (!appointment || !manageable || !selectedDate || !selectedTime) return

    setRescheduling(true)
    setError('')
    setMessage('')

    const endTime = addMinutes(selectedTime, duration)
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        appointment_date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        status: 'pending',
      })
      .eq('id', appointment.id)
      .eq('appointment_code', code.trim().toUpperCase())

    if (updateError) {
      setError(updateError.message)
    } else {
      setAppointment(prev => ({
        ...prev,
        appointment_date: selectedDate,
        start_time: selectedTime,
        end_time: endTime,
        status: 'pending',
      }))
      setMessage('Randevu saatin guncellendi. Isletme onayi icin bekliyor.')
      notifyAppointmentUpdated(appointment.id, 'rescheduled')
    }

    setRescheduling(false)
  }

  const originalTime = appointment ? `${appointment.appointment_date}-${formatTime(appointment.start_time)}` : ''
  const selectedTimeKey = `${selectedDate}-${selectedTime}`
  const hasTimeChanged = appointment && selectedDate && selectedTime && selectedTimeKey !== originalTime

  async function copyAppointmentCode() {
    if (!appointment?.appointment_code) return
    try {
      await navigator.clipboard.writeText(appointment.appointment_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kod kopyalanamadi. Lutfen manuel olarak kopyala.')
    }
  }

  return (
    <div className="min-h-dvh bg-navy px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gold">Randevu yonetimi</p>
            <h1 className="font-display text-3xl font-extrabold text-cream">Randevunu goruntule, ertele veya iptal et</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cream-muted">Randevu kodunla randevunu goruntule, ertele veya iptal et.</p>
          </div>
          <Link to="/book" className="text-sm font-semibold text-gold hover:underline">Yeni randevu al</Link>
        </div>

        {!appointment ? (
          <div className="mx-auto max-w-xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}
          <Card className="shadow-lg shadow-slate-200/60">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/10 bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-gold" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-cream">Randevu kodun yeterli</p>
                    <p className="mt-1 text-xs leading-5 text-cream-muted">Randevu alirken sana verilen kodu girerek bilgilerine ulasabilirsin.</p>
                  </div>
                </div>
              </div>
              <Input
                label="Randevu Kodu"
                value={code}
                onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="ABC123"
                autoComplete="one-time-code"
                className="font-mono text-lg tracking-widest"
              />
              <Button className="w-full" onClick={findAppointment} disabled={loading}>
                {loading ? 'Araniyor...' : 'Randevumu Bul'}
              </Button>
              <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-cream-muted">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                Bu kod randevuna erisim saglar. Guvenligin icin kimseyle paylasma.
              </div>
            </div>
          </Card>
          <Card className="mt-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Kodunu gir'],
                ['2', 'Randevunu gor'],
                ['3', 'Ertele veya iptal et'],
              ].map(([number, label]) => (
                <div key={number} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-white">{number}</span>
                  <p className="mt-2 text-sm font-semibold text-cream">{label}</p>
                </div>
              ))}
            </div>
          </Card>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {message}
              </div>
            )}

              <Card title="Randevu Bilgileri">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gold/10 bg-gold/5 p-4 sm:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-cream-muted">Randevu kodu</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          <p className="font-mono text-2xl font-bold tracking-widest text-gold">{appointment.appointment_code}</p>
                          <Button variant="secondary" size="sm" onClick={copyAppointmentCode} aria-label="Randevu kodunu kopyala">
                            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                            {copied ? 'Kopyalandi' : 'Kopyala'}
                          </Button>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-cream-muted"><LockKeyhole className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Bu kodu kimseyle paylasma.</p>
                      </div>
                      <Badge status={appointment.status} />
                    </div>
                  </div>

                  {[
                    [Store, 'Dukkan', appointment.shops?.name],
                    [UserRound, 'Personel', appointment.employees?.name],
                    [Scissors, 'Hizmet', getAppointmentServiceName(appointment)],
                    [Clock, 'Sure / Fiyat', `${getAppointmentDurationLabel(appointment) || `${duration} dk`} - ${getAppointmentPriceLabel(appointment) || '-'}`],
                  ].map(([Icon, label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                      <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
                      <p className="mt-3 text-xs font-semibold uppercase text-cream-muted">{label}</p>
                      <p className="mt-1 font-semibold text-cream">{value || '-'}</p>
                    </div>
                  ))}

                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                    <CalendarClock className="h-5 w-5 text-gold" aria-hidden="true" />
                    <p className="mt-3 text-xs font-semibold uppercase text-cream-muted">Mevcut tarih ve saat</p>
                    <p className="mt-1 font-semibold text-cream">{formatDateLabel(appointment.appointment_date)}</p>
                    <p className="mt-1 font-mono text-xl font-bold text-gold">{formatTime(appointment.start_time)}</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-gold/10 pt-5">
                  <h2 className="font-display text-xl font-bold text-cream">Randevuyu ertele</h2>
                  <p className="mt-1 text-sm text-cream-muted">
                    Musait bir tarih ve saat sec. Degisiklikten sonra randevu tekrar onay bekler.
                  </p>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {calendarDays.map(day => (
                      <button
                        key={day}
                        type="button"
                        disabled={!manageable}
                        onClick={() => {
                          setSelectedDate(day)
                          setSelectedTime('')
                        }}
                        className={`shrink-0 rounded-xl px-3 py-2 text-center transition disabled:opacity-50 ${
                          selectedDate === day ? 'bg-gold text-white' : 'border border-gold/10 bg-white text-cream-muted hover:text-cream'
                        }`}
                      >
                        <p className="text-[10px] uppercase">{format(new Date(`${day}T12:00`), 'EEE', { locale: tr })}</p>
                        <p className="font-mono text-lg font-bold">{format(new Date(`${day}T12:00`), 'd')}</p>
                      </button>
                    ))}
                  </div>

                  {availability.closed ? (
                    <p className="mt-3 rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-sm text-cream-muted">Secilen gun kapali.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5">
                      {availability.slots.map(slot => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!manageable || !slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`rounded-lg border px-2 py-2.5 font-mono text-sm transition disabled:cursor-not-allowed ${
                            !slot.available
                              ? 'border-red-500/30 bg-red-500/10 text-red-300 line-through'
                              : selectedTime === slot.time
                                ? 'border-gold bg-gold/15 text-gold'
                                : 'border-gold/20 bg-white text-cream hover:border-gold/50'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Button
                      className="w-full"
                      onClick={rescheduleAppointment}
                      disabled={!manageable || !hasTimeChanged || rescheduling}
                    >
                      {rescheduling ? 'Guncelleniyor...' : 'Yeni Saate Ertele'}
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={cancelAppointment}
                      disabled={!manageable || cancelling}
                    >
                      {cancelling ? 'Iptal ediliyor...' : 'Randevuyu Iptal Et'}
                    </Button>
                  </div>

                  {!manageable && appointment.status !== 'cancelled' && (
                    <p className="mt-3 text-xs text-cream-muted">
                      Randevuya 2 saatten az kaldiysa veya randevu tamamlandiysa musteri degisikligi kapanir.
                    </p>
                  )}
                </div>
              </Card>
          </div>
        )}
      </div>
    </div>
  )
}
