import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useStaffStore } from '../../store/staffStore'
import { addMinutes, formatPrice, formatTime, generateTimeSlots, isOverlapping, todayISO } from '../../lib/time'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Loading from '../../components/ui/Loading'
import { buildAppointmentMessage, buildWhatsAppUrl } from '../../lib/whatsapp'
import {
  enableStaffPushNotifications,
  getStaffPushSubscriptionStatus,
  notifyAppointmentCreated,
  sendTestStaffPushNotification,
  showStaffAppointmentNotification,
} from '../../lib/pushNotifications'
import { formatTurkishMobile, getTurkishMobileError, normalizeTurkishMobile } from '../../lib/phone'

function emptyAppointment(employeeId = '') {
  return {
    id: null,
    customerName: '',
    customerPhone: '',
    serviceIds: [],
    appointmentDate: todayISO(),
    startTime: '09:00',
    status: 'pending',
    notes: '',
    employeeId,
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate()
  const { token, employeeId, employeeName, shopId, shopName, clearSession } = useStaffStore()
  const [appointments, setAppointments] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [form, setForm] = useState(() => emptyAppointment(employeeId))
  const [saving, setSaving] = useState(false)
  const [pushStatus, setPushStatus] = useState('')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [testPushLoading, setTestPushLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const today = todayISO()

  const filteredAppointments = useMemo(() => {
    let result = appointments
    if (filterStatus) result = result.filter(a => a.status === filterStatus)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.customer_name?.toLowerCase().includes(q) ||
        a.customer_phone?.includes(q) ||
        a.service_name?.toLowerCase().includes(q) ||
        a.services?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [appointments, filterStatus, search])

  const stats = useMemo(() => ({
    today: appointments.filter(a => a.appointment_date === today && a.status !== 'cancelled').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    done: appointments.filter(a => a.status === 'done').length,
  }), [appointments, today])

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

  function isMissingRpc(rpcError) {
    return rpcError?.code === 'PGRST202' || rpcError?.code === 'PGRST204' || rpcError?.message?.includes('Could not find the function')
  }

  function normalizeAppointment(appointment) {
    return {
      ...appointment,
      service_id: appointment.service_id,
      employee_name: appointment.employee_name || appointment.employees?.name,
      service_name: appointment.service_name || appointment.services?.name,
      service_price: appointment.service_price ?? appointment.services?.price,
    }
  }

  async function loadWithDirectQuery() {
    if (!employeeId || !shopId) {
      throw new Error('Personel oturumu eksik. Lutfen tekrar giris yapin.')
    }

    const { data, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        employee_id,
        service_id,
        customer_name,
        customer_phone,
        appointment_date,
        start_time,
        end_time,
        status,
        notes,
        employees(name),
        services(name, duration, price)
      `)
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date')
      .order('start_time')

    if (queryError) throw queryError
    return (data || []).map(normalizeAppointment)
  }

  async function loadEmployeeAppointmentsWithoutShop() {
    if (!employeeId) return []

    const { data, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        employee_id,
        service_id,
        customer_name,
        customer_phone,
        appointment_date,
        start_time,
        end_time,
        status,
        notes,
        employees(name),
        services(name, duration, price)
      `)
      .eq('employee_id', employeeId)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date')
      .order('start_time')

    if (queryError) throw queryError
    return (data || []).map(normalizeAppointment)
  }

  async function loadVisibleAppointmentsFallback() {
    const { data, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        shop_id,
        employee_id,
        service_id,
        customer_name,
        customer_phone,
        appointment_date,
        start_time,
        end_time,
        status,
        notes,
        employees(name),
        services(name, duration, price)
      `)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date')
      .order('start_time')

    if (queryError) throw queryError

    return (data || [])
      .filter(appointment => employeeId && appointment.employee_id === employeeId)
      .map(normalizeAppointment)
  }

  async function load() {
    setError('')
    setLoading(true)

    if (!token) {
      setError('Personel oturumu bulunamadi. Lutfen tekrar giris yapin.')
      setLoading(false)
      return
    }

    let directAppointments = null

    if (employeeId && shopId) {
      try {
        directAppointments = await loadWithDirectQuery()
        if (directAppointments.length > 0) {
          setAppointments(directAppointments)
          setLoading(false)
          return
        }
      } catch (directError) {
        setError(directError.message)
      }
    }

    let employeeOnlyAppointments = null

    if (employeeId) {
      try {
        employeeOnlyAppointments = await loadEmployeeAppointmentsWithoutShop()
        if (employeeOnlyAppointments.length > 0) {
          setAppointments(employeeOnlyAppointments)
          setLoading(false)
          return
        }
      } catch (employeeOnlyError) {
        setError(employeeOnlyError.message)
      }
    }

    let visibleFallbackAppointments = null

    try {
      visibleFallbackAppointments = await loadVisibleAppointmentsFallback()
      if (visibleFallbackAppointments.length > 0) {
        setAppointments(visibleFallbackAppointments)
        setLoading(false)
        return
      }
    } catch (visibleFallbackError) {
      setError(visibleFallbackError.message)
    }

    const emptyResult = directAppointments || employeeOnlyAppointments || visibleFallbackAppointments || []
    setAppointments(emptyResult)
    if (emptyResult.length === 0) {
      setError(`Staff randevu sorgusu bos dondu. Oturum: ${shopName || 'Dukkan yok'} / ${employeeName || 'Personel yok'}. shopId=${shopId || '-'} employeeId=${employeeId || '-'}. Supabase staff oturumu appointments tablosunu okuyamiyor. SUPABASE_SETUP.sql dosyasini SQL Editor'da calistirip personel panelinden cik-gir yap.`)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!shopId) return
    supabase
      .from('services')
      .select('id, name, duration, price')
      .eq('shop_id', shopId)
      .order('name')
      .then(({ data, error: servicesError }) => {
        if (servicesError) setError(servicesError.message)
        setServices(data || [])
      })
  }, [shopId])

  useEffect(() => {
    if (token) load()
  }, [token, employeeId, shopId, dateFrom, dateTo])

  useEffect(() => {
    if (!token) return

    getStaffPushSubscriptionStatus()
      .then(status => {
        setPushEnabled(status.enabled)
        if (status.enabled) setPushStatus('Bildirimler acik. Yeni randevular bu cihaza gelecek.')
      })
      .catch(() => setPushEnabled(false))
  }, [token])

  useEffect(() => {
    if (!token || !shopId) return

    const channel = supabase
      .channel(`staff-appointments-live-${shopId}-${employeeId || 'all'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `shop_id=eq.${shopId}`,
      }, payload => {
        const changedEmployeeId = payload.new?.employee_id || payload.old?.employee_id
        if (changedEmployeeId && changedEmployeeId !== employeeId) return

        if (payload.eventType === 'INSERT') {
          showStaffAppointmentNotification(payload.new)
        }
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [token, employeeId, shopId, dateFrom, dateTo])

  function openAddModal() {
    setModalMode('add')
    setForm(emptyAppointment(employeeId))
    setShowModal(true)
  }

  function openEditModal(appointment) {
    setModalMode('edit')
    setForm({
      id: appointment.id,
      customerName: appointment.customer_name || '',
      customerPhone: formatTurkishMobile(appointment.customer_phone || ''),
      serviceIds: getServiceIdsFromAppointment(appointment),
      appointmentDate: appointment.appointment_date || todayISO(),
      startTime: formatTime(appointment.start_time) || '09:00',
      status: appointment.status || 'pending',
      notes: appointment.notes || '',
      employeeId,
    })
    setShowModal(true)
  }

  async function updateStatus(id, status) {
    setError('')

    const { error: rpcError } = await supabase.rpc('employee_update_appointment_status', {
      p_token: token,
      p_appointment_id: id,
      p_status: status,
    })

    if (rpcError && isMissingRpc(rpcError)) {
      const { error: fallbackError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .eq('shop_id', shopId)
        .eq('employee_id', employeeId)

      if (fallbackError) {
        setError(fallbackError.message)
        return false
      }
    } else if (rpcError) {
      setError(rpcError.message)
      return false
    }

    await load()
    return true
  }

  async function updateStatusAndNotify(appointment, status) {
    const updated = await updateStatus(appointment.id, status)
    if (!updated) return
    const message = buildAppointmentMessage({
      shopName,
      appointment,
      status,
    })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openWhatsApp(appointment, status = appointment.status) {
    const message = buildAppointmentMessage({
      shopName,
      appointment,
      status,
    })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleSaveAppt() {
    if (!form.customerName.trim() || !form.customerPhone.trim() || form.serviceIds.length === 0) {
      alert('Musteri, telefon ve hizmet alanlari zorunlu.')
      return
    }

    const phoneError = getTurkishMobileError(form.customerPhone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    setSaving(true)
    setError('')

    const startTime = form.startTime
    const endTime = addMinutes(form.startTime, totalDuration || 30)
    let conflictQuery = supabase
      .from('appointments')
      .select('id, start_time, end_time, services(duration)')
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)
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
      setError('Bu saat araliginda randevun var.')
      setSaving(false)
      return
    }

    const payload = {
      shop_id: shopId,
      employee_id: employeeId,
      service_id: form.serviceIds[0],
      customer_name: form.customerName.trim(),
      customer_phone: normalizeTurkishMobile(form.customerPhone),
      appointment_date: form.appointmentDate,
      start_time: startTime,
      end_time: endTime,
      status: form.status,
      notes: buildAppointmentNotes(),
    }

    const saveResult = modalMode === 'edit'
      ? await supabase.from('appointments').update(payload).eq('id', form.id).eq('shop_id', shopId).eq('employee_id', employeeId)
      : await supabase.from('appointments').insert(payload).select('id').single()

    const { data: createdAppointment, error: saveError } = saveResult

    if (saveError) {
      setError(saveError.message)
    } else {
      if (modalMode === 'add') notifyAppointmentCreated(createdAppointment?.id)
      setShowModal(false)
      await load()
    }

    setSaving(false)
  }

  async function handleDeleteAppt() {
    if (!deleteTarget) return
    setError('')
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    setDeleteTarget(null)
    setAppointments(prev => prev.filter(appointment => appointment.id !== deleteTarget.id))
    await load()
    setDeleting(false)
  }

  async function handleEnablePush() {
    setPushLoading(true)
    setPushStatus('')

    try {
      await enableStaffPushNotifications({ shopId, employeeId })
      setPushEnabled(true)
      setPushStatus('Bildirimler acildi. Yeni randevular bu telefona gelecek.')
    } catch (pushError) {
      setPushEnabled(false)
      setPushStatus(pushError.message)
    }

    setPushLoading(false)
  }

  async function handleTestPush() {
    setTestPushLoading(true)
    setPushStatus('')

    try {
      const result = await sendTestStaffPushNotification(shopId, employeeId)
      setPushStatus(`Test bildirimi gonderildi. Giden cihaz: ${result.sent}`)
    } catch (pushError) {
      setPushStatus(pushError.message)
    }

    setTestPushLoading(false)
  }

  async function handleLogout() {
    await supabase.rpc('employee_logout', { p_token: token })
    clearSession()
    navigate('/staff/login')
  }

  if (loading) return <Loading />

  return (
    <div className="min-h-dvh bg-navy">
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="font-display text-xl font-bold text-cream">Randevu silinsin mi?</h2>
            <p className="mt-2 text-sm text-cream-muted">
              {deleteTarget.customer_name} randevusu kalici olarak silinecek.
            </p>
            <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Vazgec
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDeleteAppt} disabled={deleting}>
                {deleting ? 'Siliniyor...' : 'Sil'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <Card className="my-auto w-full max-w-2xl">
            <h2 className="mb-4 font-display text-xl font-bold text-cream">
              {modalMode === 'edit' ? 'Randevu Duzenle' : 'Randevu Ekle'}
            </h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Musteri Adi" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                <Input
                  label="Telefon"
                  value={form.customerPhone}
                  onChange={e => setForm({ ...form, customerPhone: formatTurkishMobile(e.target.value) })}
                  placeholder="05xx xxx xx xx"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={14}
                />
                <Select label="Durum" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Bekliyor</option>
                  <option value="confirmed">Onaylandi</option>
                  <option value="done">Tamamlandi</option>
                  <option value="cancelled">Iptal</option>
                </Select>
                <Input label="Tarih" type="date" value={form.appointmentDate} onChange={e => setForm({ ...form, appointmentDate: e.target.value })} />
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

      <header className="border-b border-gold/10 bg-navy-light/70 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-cream-muted">{shopName}</p>
            <h1 className="font-display text-2xl font-bold text-cream">Personel Paneli</h1>
            <p className="text-sm text-cream-muted">
              Merhaba, {employeeName} - {format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="secondary" size="sm" onClick={handleEnablePush} disabled={pushLoading || pushEnabled}>
              {pushLoading ? 'Aciliyor...' : pushEnabled ? 'Bildirimler Acik' : 'Bildirimleri Ac'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleTestPush} disabled={testPushLoading || !pushEnabled}>
              {testPushLoading ? 'Gonderiliyor...' : 'Test Bildirimi'}
            </Button>
            <Button size="sm" onClick={openAddModal}>+ Randevu Ekle</Button>
            <Button variant="secondary" size="sm" onClick={handleLogout}>Cikis</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {pushStatus && (
          <div className="rounded-lg border border-gold/10 bg-navy-light px-3 py-2 text-sm text-cream-muted">
            {pushStatus}
          </div>
        )}

        <div className="rounded-lg border border-gold/10 bg-gold/5 px-3 py-2 text-xs text-cream-muted">
          Aktif oturum: {shopName || 'Dukkan yok'} / {employeeName || 'Personel yok'} · shopId: {shopId || '-'} · employeeId: {employeeId || '-'}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Bugun', value: stats.today },
            { label: 'Bekliyor', value: stats.pending },
            { label: 'Onayli', value: stats.confirmed },
            { label: 'Tamamlandi', value: stats.done },
          ].map(item => (
            <Card key={item.label}>
              <p className="text-sm text-cream-muted">{item.label}</p>
              <p className="mt-1 text-3xl font-bold text-gold">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="Baslangic" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input label="Bitis" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <Select label="Durum" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Tumu</option>
              <option value="pending">Bekliyor</option>
              <option value="confirmed">Onaylandi</option>
              <option value="done">Tamamlandi</option>
              <option value="cancelled">Iptal</option>
            </Select>
            <Input label="Ara" value={search} onChange={e => setSearch(e.target.value)} placeholder="Isim, telefon, hizmet" />
            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={load}>Yenile</Button>
            </div>
          </div>
        </Card>

        <Card title="Randevularim">
          {filteredAppointments.length === 0 ? (
            <div className="space-y-2 text-sm text-cream-muted">
              <p>Randevu yok.</p>
              {!employeeId && (
                <p className="text-amber-400">
                  Personel kimligi oturumda eksik gorunuyor. Cikis yapip tekrar personel girisi yaparsan randevular eslesir.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredAppointments.map(appointment => (
                <div key={appointment.id} className="flex min-h-full flex-col rounded-lg border border-gold/10 bg-navy/50 p-4">
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="block font-mono text-xl font-semibold text-gold">{formatTime(appointment.start_time)}</span>
                          <span className="text-sm text-cream-muted">{appointment.appointment_date}</span>
                        </div>
                        <Badge status={appointment.status} />
                      </div>
                      <p className="mt-1 font-medium text-cream">{appointment.customer_name}</p>
                      <p className="text-sm text-cream-muted">{appointment.customer_phone}</p>
                      {appointment.employee_name && (
                        <p className="text-sm text-cream-muted">Personel: {appointment.employee_name}</p>
                      )}
                      {appointment.service_name && (
                        <p className="text-sm text-cream-muted">
                          {appointment.service_name} - {formatPrice(appointment.service_price)}
                        </p>
                      )}
                      {appointment.notes && <p className="mt-2 text-sm text-cream-muted">{appointment.notes}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status === 'pending' && (
                        <Button size="sm" className="w-full" onClick={() => updateStatusAndNotify(appointment, 'confirmed')}>Onayla</Button>
                      )}
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status === 'confirmed' && (
                        <Button size="sm" className="w-full" onClick={() => updateStatus(appointment.id, 'done')}>Tamamla</Button>
                      )}
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status !== 'cancelled' && appointment.status !== 'done' && (
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => updateStatus(appointment.id, 'cancelled')}>Iptal</Button>
                      )}
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => openWhatsApp(appointment)}>WhatsApp</Button>
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && (
                        <>
                          <Button variant="secondary" size="sm" className="w-full" onClick={() => openEditModal(appointment)}>Duzenle</Button>
                          <Button variant="danger" size="sm" className="w-full" onClick={() => setDeleteTarget(appointment)}>Sil</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
