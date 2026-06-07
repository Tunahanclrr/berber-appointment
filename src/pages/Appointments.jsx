import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { addMinutes, formatPrice, formatTime, generateTimeSlots, isOverlapping, todayISO } from '../lib/time'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import { buildAppointmentMessage, buildWhatsAppUrl } from '../lib/whatsapp'
import { notifyAppointmentCreated } from '../lib/pushNotifications'

const VIEWS = ['tum', 'liste', 'gunluk', 'haftalik']

function emptyAppointment() {
  return {
    id: null,
    customerName: '',
    customerPhone: '',
    employeeId: '',
    serviceIds: [],
    appointmentDate: todayISO(),
    startTime: '09:00',
    status: 'pending',
    notes: '',
  }
}

export default function Appointments() {
  const { shop } = useShop()
  const [appointments, setAppointments] = useState([])
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('liste')
  const [date, setDate] = useState(todayISO())
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [form, setForm] = useState(emptyAppointment)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    done: appointments.filter(a => a.status === 'done').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }), [appointments])

  const selectedServices = form.serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean)
  const totalDuration = selectedServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0)
  const totalPrice = selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0)
  const timeSlots = useMemo(() => generateTimeSlots(totalDuration || 30), [totalDuration])

  function getServiceIdsFromAppointment(appointment) {
    const ids = new Set()
    if (appointment.service_id) ids.add(appointment.service_id)

    const servicesLine = appointment.notes?.match(/Secilen hizmetler:\s*(.+)/i)?.[1]
    if (servicesLine) {
      const names = servicesLine.split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
      services.forEach(service => {
        if (names.includes(service.name.toLowerCase())) ids.add(service.id)
      })
    }

    return Array.from(ids)
  }

  function buildAppointmentNotes() {
    const summaryLines = [
      `Secilen hizmetler: ${selectedServices.map(service => service.name).join(', ')}`,
      `Toplam sure: ${totalDuration} dk`,
      `Toplam ucret: ${formatPrice(totalPrice)}`,
    ]
    const customNotes = form.notes
      .split('\n')
      .filter(line =>
        !line.startsWith('Secilen hizmetler:') &&
        !line.startsWith('Toplam sure:') &&
        !line.startsWith('Toplam ucret:')
      )
      .join('\n')
      .trim()

    return [...summaryLines, customNotes].filter(Boolean).join('\n')
  }

  async function load() {
    setError('')
    setLoading(true)

    let query = supabase
      .from('appointments')
      .select('*, employees(name), services(name, duration, price)')
      .eq('shop_id', shop.id)
      .order('appointment_date')
      .order('start_time')

    if (view === 'liste' || view === 'gunluk') {
      query = query.eq('appointment_date', date)
    } else if (view === 'haftalik') {
      const weekEnd = new Date(date)
      weekEnd.setDate(weekEnd.getDate() + 6)
      query = query.gte('appointment_date', date).lte('appointment_date', weekEnd.toISOString().split('T')[0])
    }

    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterEmployee) query = query.eq('employee_id', filterEmployee)

    const { data, error: loadError } = await query
    if (loadError) {
      setError(loadError.message)
      setAppointments([])
      setLoading(false)
      return
    }

    let result = data || []
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.customer_name?.toLowerCase().includes(q) ||
        a.customer_phone?.includes(q)
      )
    }

    setAppointments(result)
    setLoading(false)
  }

  async function loadUpcoming() {
    if (!shop) return

    const { data } = await supabase
      .from('appointments')
      .select('*, employees(name), services(name, duration, price)')
      .eq('shop_id', shop.id)
      .gte('appointment_date', todayISO())
      .neq('status', 'cancelled')
      .order('appointment_date')
      .order('start_time')
      .limit(8)

    setUpcomingAppointments(data || [])
  }

  useEffect(() => {
    if (!shop) return
    Promise.all([
      supabase.from('employees').select('id, name').eq('shop_id', shop.id).eq('is_active', true).order('name'),
      supabase.from('services').select('id, name, duration, price').eq('shop_id', shop.id).order('name'),
    ]).then(([empRes, svcRes]) => {
      setEmployees(empRes.data || [])
      setServices(svcRes.data || [])
    })
  }, [shop])

  useEffect(() => {
    if (shop) load()
  }, [shop, date, filterStatus, filterEmployee, view, search])

  useEffect(() => {
    if (shop) loadUpcoming()
  }, [shop])

  useEffect(() => {
    if (!shop?.id) return

    const channel = supabase
      .channel(`shop-appointments-live-${shop.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `shop_id=eq.${shop.id}`,
      }, () => {
        load()
        loadUpcoming()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shop?.id, date, filterStatus, filterEmployee, view, search])

  function openAddModal() {
    setModalMode('add')
    setForm(emptyAppointment())
    setShowModal(true)
  }

  function openEditModal(appointment) {
    setModalMode('edit')
    setForm({
      id: appointment.id,
      customerName: appointment.customer_name || '',
      customerPhone: appointment.customer_phone || '',
      employeeId: appointment.employee_id || '',
      serviceIds: getServiceIdsFromAppointment(appointment),
      appointmentDate: appointment.appointment_date || todayISO(),
      startTime: formatTime(appointment.start_time) || '09:00',
      status: appointment.status || 'pending',
      notes: appointment.notes || '',
    })
    setShowModal(true)
  }

  async function updateStatus(id, status) {
    setError('')
    const { error: statusError } = await supabase.from('appointments').update({ status }).eq('id', id).eq('shop_id', shop.id)
    if (statusError) {
      setError(statusError.message)
      return false
    }
    await load()
    await loadUpcoming()
    return true
  }

  async function updateStatusAndNotify(appointment, status) {
    const updated = await updateStatus(appointment.id, status)
    if (!updated) return
    const message = buildAppointmentMessage({
      shopName: shop.name,
      appointment,
      status,
    })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openWhatsApp(appointment, status = appointment.status) {
    const message = buildAppointmentMessage({
      shopName: shop.name,
      appointment,
      status,
    })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleDeleteAppt(id) {
    if (!confirm('Bu randevuyu kalici olarak silmek istiyor musun?')) return

    setError('')
    const { error: deleteError } = await supabase.from('appointments').delete().eq('id', id).eq('shop_id', shop.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await load()
    await loadUpcoming()
  }

  async function handleSaveAppt() {
    if (!form.customerName.trim() || !form.customerPhone.trim() || !form.employeeId || form.serviceIds.length === 0) {
      alert('Tum alanlari doldurunuz.')
      return
    }

    setSaving(true)
    setError('')

    const startTime = form.startTime
    const endTime = addMinutes(form.startTime, totalDuration || 30)
    let conflictQuery = supabase
      .from('appointments')
      .select('id, start_time, end_time, services(duration)')
      .eq('shop_id', shop.id)
      .eq('employee_id', form.employeeId)
      .eq('appointment_date', form.appointmentDate)
      .neq('status', 'cancelled')

    if (modalMode === 'edit') conflictQuery = conflictQuery.neq('id', form.id)

    const { data: conflicts, error: conflictError } = await conflictQuery
    if (conflictError) {
      setError(conflictError.message)
      setSaving(false)
      return
    }

    const hasConflict = (conflicts || []).some(appointment => {
      const appointmentStart = formatTime(appointment.start_time)
      if (!appointmentStart) return false
      const appointmentEnd = formatTime(appointment.end_time) || addMinutes(appointmentStart, appointment.services?.duration || 30)
      return isOverlapping(startTime, endTime, appointmentStart, appointmentEnd)
    })

    if (hasConflict) {
      setError('Bu personelin secilen saat araliginda randevusu var.')
      setSaving(false)
      return
    }

    const payload = {
      shop_id: shop.id,
      employee_id: form.employeeId,
      service_id: form.serviceIds[0],
      customer_name: form.customerName.trim(),
      customer_phone: form.customerPhone.trim(),
      appointment_date: form.appointmentDate,
      start_time: startTime,
      end_time: endTime,
      status: form.status,
      notes: buildAppointmentNotes(),
    }

    const saveResult = modalMode === 'edit'
      ? await supabase.from('appointments').update(payload).eq('id', form.id).eq('shop_id', shop.id)
      : await supabase.from('appointments').insert(payload).select('id').single()

    const { data: createdAppointment, error: saveError } = saveResult

    if (saveError) {
      setError(saveError.message)
    } else {
      if (modalMode === 'add') notifyAppointmentCreated(createdAppointment?.id)
      setShowModal(false)
      setForm(emptyAppointment())
      await load()
      await loadUpcoming()
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <Card className="my-auto w-full max-w-2xl">
            <h2 className="mb-4 font-display text-xl font-bold text-cream">
              {modalMode === 'edit' ? 'Randevu Duzenle' : 'Randevu Ekle'}
            </h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Musteri Adi" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                <Input label="Telefon" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
                <Select label="Personel" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Seciniz</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
                <Input label="Tarih" type="date" value={form.appointmentDate} onChange={e => setForm({ ...form, appointmentDate: e.target.value })} />
                <Select label="Durum" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Bekliyor</option>
                  <option value="confirmed">Onaylandi</option>
                  <option value="done">Tamamlandi</option>
                  <option value="cancelled">Iptal</option>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-cream-muted">Saat</label>
                  <span className="text-xs text-cream-muted">
                    Secili: <span className="font-mono text-gold">{form.startTime}</span>
                    {totalDuration > 0 && ` - ${addMinutes(form.startTime, totalDuration)}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-6">
                  {timeSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setForm({ ...form, startTime: slot })}
                      className={`rounded-lg border px-2 py-2.5 font-mono text-sm transition ${
                        form.startTime === slot
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-gold/20 bg-navy-light text-cream hover:border-gold/50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-cream-muted">Hizmetler</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map(service => {
                    const selected = form.serviceIds.includes(service.id)
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          serviceIds: selected
                            ? prev.serviceIds.filter(id => id !== service.id)
                            : [...prev.serviceIds, service.id],
                        }))}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          selected ? 'border-gold bg-gold/10 text-cream' : 'border-gold/20 bg-navy-light text-cream-muted hover:text-cream'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{service.name}</span>
                          <span className="font-mono text-xs text-gold">{service.duration} dk</span>
                        </div>
                        <p className="mt-1 text-xs text-cream-muted">{formatPrice(service.price)}</p>
                      </button>
                    )
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-sm text-cream-muted">
                    {selectedServices.length} hizmet - {totalDuration} dk - {formatPrice(totalPrice)}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-cream-muted">Not</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-gold/20 bg-navy-light px-3 py-2.5 text-sm text-cream placeholder:text-cream-muted/50 outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Randevu notu"
                />
              </div>
              <div className="flex flex-col gap-2 pt-2 min-[420px]:flex-row">
                <Button className="flex-1" onClick={handleSaveAppt} disabled={saving}>
                  {saving ? 'Kaydediliyor...' : modalMode === 'edit' ? 'Guncelle' : 'Ekle'}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                  Iptal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">Randevular</h1>
          <p className="text-cream-muted">Tum randevulari ekle, onayla, duzenle ve sil</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition sm:flex-none ${
                view === v ? 'bg-gold/15 text-gold' : 'text-cream-muted hover:text-cream'
              }`}
            >
              {v === 'tum' ? 'tum randevular' : v}
            </button>
          ))}
          <Button size="sm" className="w-full sm:w-auto" onClick={openAddModal}>+ Randevu Ekle</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Toplam', value: summary.total },
          { label: 'Bekliyor', value: summary.pending },
          { label: 'Onayli', value: summary.confirmed },
          { label: 'Tamam', value: summary.done },
          { label: 'Iptal', value: summary.cancelled },
        ].map(item => (
          <Card key={item.label} className="p-4">
            <p className="text-sm text-cream-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gold">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card title="Yaklasan Randevular">
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-cream-muted">Yaklasan randevu yok.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingAppointments.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 bg-navy/40 px-4 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-gold">{a.appointment_date}</span>
                    <span className="font-mono text-cream">{formatTime(a.start_time)}</span>
                    <Badge status={a.status} />
                  </div>
                  <p className="mt-1 font-medium text-cream">{a.customer_name}</p>
                  <p className="text-sm text-cream-muted">{a.employees?.name} - {a.services?.name}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEditModal(a)}>Duzenle</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Tarih" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Select label="Durum" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tumu</option>
            <option value="pending">Bekliyor</option>
            <option value="confirmed">Onaylandi</option>
            <option value="done">Tamamlandi</option>
            <option value="cancelled">Iptal</option>
          </Select>
          <Select label="Personel" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
            <option value="">Tumu</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Input label="Ara" value={search} onChange={e => setSearch(e.target.value)} placeholder="Isim veya telefon" />
        </div>
      </Card>

      {loading ? <Loading /> : appointments.length === 0 ? (
        <Card><p className="text-sm text-cream-muted">Randevu bulunamadi.</p></Card>
      ) : view === 'haftalik' ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-3">
            {employees.map(emp => (
              <div key={emp.id} className="w-56 shrink-0">
                <p className="mb-2 text-center text-sm font-medium text-gold">{emp.name}</p>
                <div className="space-y-2">
                  {appointments.filter(a => a.employee_id === emp.id).map(a => (
                    <div key={a.id} className="rounded-lg border border-gold/20 bg-navy-light p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-gold">{formatTime(a.start_time)}</p>
                        <Badge status={a.status} />
                      </div>
                      <p className="mt-1 font-medium text-cream">{a.customer_name}</p>
                      <p className="text-cream-muted">{a.appointment_date}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => openEditModal(a)}>Duzenle</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteAppt(a.id)}>Sil</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg text-gold">{formatTime(a.start_time)}</span>
                    <Badge status={a.status} />
                  </div>
                  <p className="mt-1 font-medium text-cream">{a.customer_name}</p>
                  <p className="text-sm text-cream-muted">
                    {a.customer_phone} - {a.employees?.name} - {a.services?.name}
                    {view === 'liste' && ` - ${a.appointment_date}`}
                  </p>
                  {a.notes && <p className="mt-2 text-sm text-cream-muted">{a.notes}</p>}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  {a.status === 'pending' && <Button size="sm" onClick={() => updateStatusAndNotify(a, 'confirmed')}>Onayla</Button>}
                  {a.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus(a.id, 'done')}>Tamamla</Button>}
                  {a.status !== 'cancelled' && a.status !== 'done' && (
                    <Button variant="secondary" size="sm" onClick={() => updateStatus(a.id, 'cancelled')}>Iptal</Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => openWhatsApp(a)}>WhatsApp</Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(a)}>Duzenle</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteAppt(a.id)}>Sil</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
