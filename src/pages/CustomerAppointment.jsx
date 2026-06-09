import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { formatPrice, formatTime } from '../lib/time'
import { formatTurkishMobile, getTurkishMobileError, normalizeTurkishMobile } from '../lib/phone'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import PhoneInput from '../components/ui/PhoneInput'

function canCancelAppointment(appointment) {
  if (!appointment || ['cancelled', 'done', 'no_show'].includes(appointment.status)) return false

  const startDate = new Date(`${appointment.appointment_date}T${formatTime(appointment.start_time) || '00:00'}:00`)
  const twoHoursBefore = new Date(startDate.getTime() - 2 * 60 * 60 * 1000)
  return new Date() < twoHoursBefore
}

export default function CustomerAppointment() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  async function findAppointment() {
    setError('')
    setAppointment(null)

    const phoneError = getTurkishMobileError(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    if (!code.trim()) {
      setError('Randevu kodunu gir.')
      return
    }

    setLoading(true)
    const { data, error: findError } = await supabase
      .from('appointments')
      .select('*, shops(name), employees(name), services(name, price, duration)')
      .eq('customer_phone', normalizeTurkishMobile(phone))
      .eq('appointment_code', code.trim().toUpperCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      setError(findError.message)
    } else if (!data) {
      setError('Bu telefon ve kod ile randevu bulunamadi.')
    } else {
      setAppointment(data)
    }

    setLoading(false)
  }

  async function cancelAppointment() {
    if (!appointment || !canCancelAppointment(appointment)) return

    setCancelling(true)
    setError('')

    const { error: cancelError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)
      .eq('customer_phone', normalizeTurkishMobile(phone))
      .eq('appointment_code', code.trim().toUpperCase())

    if (cancelError) {
      setError(cancelError.message)
    } else {
      setAppointment(prev => ({ ...prev, status: 'cancelled' }))
    }

    setCancelling(false)
  }

  const cancellable = canCancelAppointment(appointment)

  return (
    <div className="min-h-dvh bg-navy px-4 py-6">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-cream">Randevumu Goruntule</h1>
            <p className="text-sm text-cream-muted">Telefon numaran ve randevu kodunla kontrol et.</p>
          </div>
          <Link to="/book" className="text-sm text-gold hover:underline">Randevu al</Link>
        </div>

        <Card>
          <div className="space-y-4">
            <PhoneInput label="Telefon" value={phone} onChange={value => setPhone(formatTurkishMobile(value))} />
            <Input
              label="Randevu Kodu"
              value={code}
              onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="123456"
              autoComplete="one-time-code"
            />
            <Button className="w-full" onClick={findAppointment} disabled={loading}>
              {loading ? 'Araniyor...' : 'Randevumu Bul'}
            </Button>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {appointment && (
          <Card title="Randevu Bilgileri">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-cream-muted">Durum</span>
                <Badge status={appointment.status} />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Dukkan</span>
                <span className="text-right font-medium text-cream">{appointment.shops?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Personel</span>
                <span className="text-right font-medium text-cream">{appointment.employees?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Hizmet</span>
                <span className="text-right font-medium text-cream">{appointment.services?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Tarih</span>
                <span className="text-right text-cream">{format(new Date(`${appointment.appointment_date}T12:00`), 'd MMMM yyyy', { locale: tr })}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Saat</span>
                <span className="font-mono text-gold">{formatTime(appointment.start_time)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream-muted">Fiyat</span>
                <span className="font-semibold text-gold">{formatPrice(appointment.services?.price || 0)}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Button variant="danger" className="w-full" onClick={cancelAppointment} disabled={!cancellable || cancelling}>
                {cancelling ? 'Iptal ediliyor...' : 'Randevuyu Iptal Et'}
              </Button>
              {!cancellable && appointment.status !== 'cancelled' && (
                <p className="text-xs text-cream-muted">
                  Randevuya 2 saatten az kaldiysa veya randevu tamamlandiysa musteri iptali kapanir.
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
