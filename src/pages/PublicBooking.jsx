import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  addMinutes,
  formatPrice,
  formatTime,
  generateTimeSlots,
  isOverlapping,
  todayISO,
} from '../lib/time'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import { notifyAppointmentCreated } from '../lib/pushNotifications'

export default function PublicBooking() {
  const { shopId } = useParams()
  const [shop, setShop] = useState(null)
  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [employeeServices, setEmployeeServices] = useState([])
  const [bookedSlots, setBookedSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const selectedService = services.find(s => s.id === serviceId)

  const availableEmployees = useMemo(() => {
    if (!serviceId) return employees
    const allowed = new Set(
      employeeServices.filter(es => es.service_id === serviceId).map(es => es.employee_id)
    )
    if (allowed.size === 0) return employees
    return employees.filter(e => allowed.has(e.id))
  }, [employees, employeeServices, serviceId])

  const timeSlots = useMemo(() => {
    if (!selectedService) return []
    const slots = generateTimeSlots(selectedService.duration)
    if (!employeeId) return slots

    return slots.filter(slot => {
      const end = addMinutes(slot, selectedService.duration)
      return !bookedSlots.some(b =>
        isOverlapping(slot, end, b.start_time.slice(0, 5), b.end_time.slice(0, 5))
      )
    })
  }, [selectedService, employeeId, bookedSlots])

  useEffect(() => {
    async function loadShop() {
      const [shopRes, empRes, svcRes, esRes] = await Promise.all([
        supabase.from('shops').select('*').eq('id', shopId).single(),
        supabase.from('employees').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
        supabase.from('services').select('*').eq('shop_id', shopId).order('name'),
        supabase.from('employee_services').select('*'),
      ])

      if (shopRes.error) {
        setError('Dükkan bulunamadı veya erişim izni yok.')
        setLoading(false)
        return
      }

      setShop(shopRes.data)
      setEmployees(empRes.data || [])
      setServices(svcRes.data || [])
      const empIds = new Set((empRes.data || []).map(e => e.id))
      setEmployeeServices((esRes.data || []).filter(es => empIds.has(es.employee_id)))
      setLoading(false)
    }
    loadShop()
  }, [shopId])

  useEffect(() => {
    if (!employeeId || !date) return

    async function loadBooked() {
      const { data } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('employee_id', employeeId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled')

      setBookedSlots(data || [])
      setStartTime('')
    }
    loadBooked()
  }, [employeeId, date])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const endTime = addMinutes(startTime, selectedService.duration)

    const { data: createdAppointment, error: err } = await supabase.from('appointments').insert({
      shop_id: shopId,
      employee_id: employeeId,
      service_id: serviceId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
    }).select('id').single()

    if (err) {
      setError(err.message.includes('dolu') ? 'Bu saat dolu, başka bir saat seç.' : err.message)
    } else {
      notifyAppointmentCreated(createdAppointment?.id)
      setSuccess(true)
    }
    setSubmitting(false)
  }

  if (loading) return <Loading text="Dükkan yükleniyor..." />

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <Card className="max-w-md text-center">
          <span className="text-5xl">✅</span>
          <h1 className="mt-4 text-xl font-bold text-zinc-100">Randevun Alındı!</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {shop.name} — {date} saat {formatTime(startTime)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Onay için sizi arayacaklar.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <span className="text-4xl">✂️</span>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">{shop?.name}</h1>
          <p className="text-sm text-zinc-400">Online randevu al</p>
        </div>

        {services.length === 0 || employees.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500">
              Bu dükkan henüz randevu almaya hazır değil. Dükkan sahibi personel ve hizmet eklemeli.
            </p>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <Select
                label="Hizmet Seç"
                value={serviceId}
                onChange={e => { setServiceId(e.target.value); setEmployeeId(''); setStartTime('') }}
                required
              >
                <option value="">Seçiniz</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.duration} dk — {formatPrice(s.price)}
                  </option>
                ))}
              </Select>
            </Card>

            {serviceId && (
              <Card>
                <Select
                  label="Berber Seç"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Seçiniz</option>
                  {availableEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </Select>
                {availableEmployees.length === 0 && (
                  <p className="mt-2 text-xs text-amber-400">Bu hizmeti veren personel yok.</p>
                )}
              </Card>
            )}

            {employeeId && (
              <Card className="space-y-4">
                <Input
                  label="Tarih"
                  type="date"
                  min={todayISO()}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />

                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-300">Saat Seç</p>
                  {timeSlots.length === 0 ? (
                    <p className="text-sm text-zinc-500">Bu tarihte uygun saat yok.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4">
                      {timeSlots.map(slot => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setStartTime(slot)}
                          className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                            startTime === slot
                              ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                              : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {startTime && (
              <Card className="space-y-4">
                <Input
                  label="Ad Soyad"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Adınız"
                  required
                />
                <Input
                  label="Telefon"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  required
                />
              </Card>
            )}

            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
            )}

            {startTime && customerName && customerPhone && (
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Randevu alınıyor...' : 'Randevu Al'}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
