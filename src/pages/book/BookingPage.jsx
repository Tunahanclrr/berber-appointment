import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { addMinutes, formatPrice, todayISO } from '../../lib/time'
import { computeAvailableSlots } from '../../lib/slots'
import { notifyAppointmentCreated } from '../../lib/pushNotifications'
import { getTurkishMobileError, normalizeTurkishMobile } from '../../lib/phone'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PhoneInput from '../../components/ui/PhoneInput'
import Card from '../../components/ui/Card'
import Loading from '../../components/ui/Loading'

const STEPS = ['Hizmet', 'Tarih & Saat', 'Onayla']

export default function BookingPage() {
  const { slug } = useParams()
  const [step, setStep] = useState(0)
  const [shop, setShop] = useState(null)
  const [services, setServices] = useState([])
  const [employees, setEmployees] = useState([])
  const [employeeServices, setEmployeeServices] = useState([])
  const [booked, setBooked] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [serviceIds, setServiceIds] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const selectedServices = serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean)
  const selectedService = selectedServices[0]
  const totalDuration = selectedServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0)
  const totalPrice = selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0)
  const selectedEmployee = employees.find(e => e.id === employeeId)

  const employeesForService = serviceIds.length > 0
    ? (() => {
        return employees.filter(emp => {
          return serviceIds.every(serviceId => {
            const assignedIds = new Set(
              employeeServices
                .filter(es => es.service_id === serviceId)
                .map(es => es.employee_id)
            )
            return assignedIds.size === 0 || assignedIds.has(emp.id)
          })
        })
      })()
    : employees

  const baseAvailability = computeAvailableSlots({
    date,
    duration: totalDuration || 30,
    workingHours: shop?.working_hours,
    bookedAppointments: booked,
    employeeId,
  })
  const slots = employeeId ? baseAvailability.slots : []
  const closed = baseAvailability.closed

  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(new Date(), i)
    return format(d, 'yyyy-MM-dd')
  })

  useEffect(() => {
    async function load() {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!shopData) {
        setError('Dukkan bulunamadi.')
        setLoading(false)
        return
      }

      const [svcRes, empRes, esRes] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', shopData.id).order('name'),
        supabase.from('employees').select('*').eq('shop_id', shopData.id).eq('is_active', true).order('name'),
        supabase.from('employee_services').select('*'),
      ])

      setShop(shopData)
      setServices(svcRes.data || [])
      setEmployees(empRes.data || [])
      const empIds = new Set((empRes.data || []).map(e => e.id))
      setEmployeeServices((esRes.data || []).filter(es => empIds.has(es.employee_id)))
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!shop || !date || !employeeId) {
      setBooked([])
      setStartTime('')
      return
    }

    async function loadBooked() {
      const { data } = await supabase
        .from('appointments')
        .select('employee_id, start_time, end_time, status, services(duration)')
        .eq('shop_id', shop.id)
        .eq('appointment_date', date)
        .neq('status', 'cancelled')
        .or(`employee_id.eq.${employeeId},employee_id.is.null`)

      setBooked(data || [])
      setStartTime('')
    }
    loadBooked()
  }, [shop, date, employeeId])

  async function createAppointmentFallback() {
    const normalizedPhone = normalizeTurkishMobile(customerPhone)
    const endTime = addMinutes(startTime, totalDuration)
    const notes = [
      `Secilen hizmetler: ${selectedServices.map(service => service.name).join(', ')}`,
      `Toplam sure: ${totalDuration} dk`,
      `Toplam ucret: ${formatPrice(totalPrice)}`,
    ].join('\n')

    const { data: createdAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        shop_id: shop.id,
        employee_id: employeeId,
        service_id: selectedService.id,
        customer_name: customerName.trim(),
        customer_phone: normalizedPhone,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        notes,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return {
      appointmentId: createdAppointment.id,
    }
  }

  async function handleSubmit() {
    setError('')

    if (!employeeId) {
      setError('Lutfen personel seciniz.')
      return
    }

    if (!startTime) {
      setError('Lutfen musait bir saat seciniz.')
      return
    }

    const phoneError = getTurkishMobileError(customerPhone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/.netlify/functions/create-public-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          employeeId,
          serviceIds,
          customerName,
          customerPhone: normalizeTurkishMobile(customerPhone),
          appointmentDate: date,
          startTime,
        }),
      })

      const responseText = await response.text()
      const result = responseText ? JSON.parse(responseText) : null

      if (!response.ok || !result?.ok) {
        if (response.status === 404) {
          const fallbackResult = await createAppointmentFallback()
          notifyAppointmentCreated(fallbackResult.appointmentId)
          setSuccess(true)
          return
        }

        throw new Error(result?.error || 'Randevu olusturulamadi.')
      }

      notifyAppointmentCreated(result.appointmentId)
      setSuccess(true)
    } catch (submitError) {
      setError(submitError.message || 'Randevu olusturulamadi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading text="Dukkan yukleniyor..." />

  if (error && !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-4">
        <Card className="max-w-md text-center">
          <p className="text-red-400">{error}</p>
          <Link to="/book" className="mt-4 inline-block text-gold hover:underline">Geri don</Link>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-navy">
        <header className="border-b border-gold/10 px-4 py-4 text-center">
          <Link to="/book" className="absolute left-4 top-4 text-sm text-cream-muted hover:text-gold">Yeni Randevu</Link>
          <h1 className="font-display text-xl font-bold text-cream">{shop.name}</h1>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-20">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="glass w-full max-w-md rounded-2xl p-5 text-center sm:p-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-3xl text-emerald-300">
              OK
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold text-cream">Randevun Alindi</h1>
            <p className="mt-3 text-cream-muted">Randevu bilgilerin asagida.</p>

            <div className="mt-8 space-y-4 rounded-xl border border-gold/20 bg-gold/5 p-6 text-left">
              <div className="flex justify-between gap-4 border-b border-gold/10 pb-3">
                <span className="text-sm text-cream-muted">Dukkan</span>
                <span className="text-right font-semibold text-cream">{shop.name}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gold/10 pb-3">
                <span className="text-sm text-cream-muted">Hizmet</span>
                <span className="text-right font-semibold text-cream">{selectedServices.map(service => service.name).join(', ')}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gold/10 pb-3">
                <span className="text-sm text-cream-muted">Personel</span>
                <span className="text-right font-semibold text-cream">{selectedEmployee?.name}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gold/10 pb-3">
                <span className="text-sm text-cream-muted">Tarih & Saat</span>
                <div className="text-right">
                  <p className="font-semibold text-cream">{format(new Date(date + 'T12:00'), 'd MMMM yyyy', { locale: tr })}</p>
                  <p className="font-mono font-semibold text-gold">{startTime}</p>
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-sm text-cream-muted">Fiyat</span>
                <span className="text-lg font-bold text-gold">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Link to="/book"><Button className="w-full">Baska Randevu Al</Button></Link>
              <Link to="/"><Button variant="secondary" className="w-full">Ana Sayfaya Don</Button></Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <header className="sticky top-0 z-10 border-b border-gold/10 bg-navy/95 px-4 py-6 text-center backdrop-blur">
        <Link to="/book" className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-cream-muted transition hover:text-gold">Geri</Link>
        <h1 className="font-display text-2xl font-bold text-cream">{shop.name}</h1>
        <p className="mt-1 text-sm text-cream-muted">Online Randevu Sistemi</p>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <div className="sticky top-20 -mx-4 mb-8 flex items-center justify-center gap-2 overflow-x-auto bg-navy/90 px-4 py-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                i <= step ? 'bg-gold text-navy' : 'border border-gold/20 bg-navy-light text-cream-muted'
              }`}>
                {i + 1}
              </div>
              <span className={`hidden text-xs transition sm:inline ${i <= step ? 'text-gold' : 'text-cream-muted'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-px w-6 transition ${i < step ? 'bg-gold' : 'bg-gold/20'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="mb-4 font-display text-lg text-cream">Hizmet Sec</h2>
              {services.length === 0 ? (
                <p className="text-cream-muted">Henuz hizmet eklenmemis.</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {services.map(svc => {
                      const selected = serviceIds.includes(svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => {
                            setServiceIds(prev => selected ? prev.filter(id => id !== svc.id) : [...prev, svc.id])
                            setEmployeeId('')
                            setStartTime('')
                          }}
                          className={`glass flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:border-gold/50 ${
                            selected ? 'border-gold ring-1 ring-gold/30' : ''
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-cream">{svc.name}</p>
                            <p className="mt-1 text-sm text-cream-muted">
                              <span className="font-mono">{svc.duration} dk</span> - {formatPrice(svc.price)}
                            </p>
                          </div>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs ${
                            selected ? 'border-gold bg-gold text-navy' : 'border-gold/30 text-cream-muted'
                          }`}>
                            {selected ? 'OK' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedServices.length > 0 && (
                    <Card>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-cream-muted">{selectedServices.length} hizmet secildi</span>
                        <span className="font-mono text-gold">{totalDuration} dk</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-4 text-sm">
                        <span className="text-cream-muted">Toplam</span>
                        <span className="font-semibold text-gold">{formatPrice(totalPrice)}</span>
                      </div>
                    </Card>
                  )}

                  <Button className="w-full" disabled={selectedServices.length === 0} onClick={() => setStep(1)}>
                    Devam
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div>
                <h2 className="mb-3 font-display text-lg text-cream">Personel Sec</h2>
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  {employeesForService.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setEmployeeId(emp.id)
                        setStartTime('')
                      }}
                      className={`glass rounded-xl p-4 text-center transition ${employeeId === emp.id ? 'border-gold ring-1 ring-gold/30' : ''}`}
                    >
                      <span className="text-2xl">Usta</span>
                      <p className="mt-1 text-sm font-medium text-cream">{emp.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-display text-lg text-cream">Tarih Sec</h2>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {calendarDays.map(d => {
                    const dayName = format(new Date(d + 'T12:00'), 'EEE', { locale: tr })
                    const dayNum = format(new Date(d + 'T12:00'), 'd')
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDate(d)
                          setStartTime('')
                        }}
                        className={`shrink-0 rounded-xl px-3 py-2 text-center transition ${
                          date === d ? 'bg-gold text-navy' : 'glass text-cream-muted hover:text-cream'
                        }`}
                      >
                        <p className="text-[10px] uppercase">{dayName}</p>
                        <p className="font-mono text-lg font-bold">{dayNum}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-display text-lg text-cream">Saat Sec</h2>
                {!employeeId ? (
                  <p className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-sm text-cream-muted">
                    Saatleri gormek icin once personel sec.
                  </p>
                ) : closed ? (
                  <p className="text-sm text-cream-muted">Bu gun kapali.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4">
                    {slots.map(({ time, available }) => (
                      <button
                        key={time}
                        type="button"
                        disabled={!available}
                        onClick={() => available && setStartTime(time)}
                        className={`rounded-lg border px-2 py-2.5 font-mono text-sm transition ${
                          !available
                            ? 'cursor-not-allowed border-red-500/40 bg-red-500/15 text-red-300 line-through'
                            : startTime === time
                              ? 'border-gold bg-gold/15 text-gold'
                              : 'border-gold/20 text-cream hover:border-gold/50'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-cream-muted">
                  <span className="text-red-300 line-through">Kirmizi</span> = dolu, tiklanamaz - Altin = musait
                </p>
              </div>

              <div className="flex flex-col gap-3 min-[380px]:flex-row">
                <Button variant="secondary" onClick={() => setStep(0)}>Geri</Button>
                <Button className="flex-1" disabled={!employeeId || !startTime} onClick={() => setStep(2)}>Devam</Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <Card title="Randevu Ozeti">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Hizmetler</span><span className="text-right text-cream">{selectedServices.map(service => service.name).join(', ')}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Sure</span><span className="font-mono text-cream">{totalDuration} dk</span></div>
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Fiyat</span><span className="text-gold">{formatPrice(totalPrice)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Personel</span><span className="text-right text-cream">{selectedEmployee?.name}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Tarih</span><span className="text-right text-cream">{format(new Date(date + 'T12:00'), 'd MMM yyyy', { locale: tr })}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-cream-muted">Saat</span><span className="font-mono text-gold">{startTime}</span></div>
                </div>
              </Card>

              <Input label="Ad Soyad" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
              <PhoneInput
                label="Telefon"
                value={customerPhone}
                onChange={setCustomerPhone}
                required
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex flex-col gap-3 min-[380px]:flex-row">
                <Button variant="secondary" onClick={() => setStep(1)}>Geri</Button>
                <Button
                  className="flex-1"
                  disabled={submitting || !customerName || !customerPhone}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Aliniyor...' : 'Randevu Al'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
