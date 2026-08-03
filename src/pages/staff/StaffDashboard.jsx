import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { addDays, addMonths, endOfMonth, format, getDay, startOfMonth, subMonths } from 'date-fns'
import { tr } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useStaffStore } from '../../store/staffStore'
import { addMinutes, formatPrice, formatTime, isOverlapping, todayISO } from '../../lib/time'
import { getAppointmentDurationLabel, getAppointmentPriceLabel, getAppointmentPriceValue, getAppointmentServiceName } from '../../lib/appointmentSummary'
import { getEffectiveWorkingHours, getWorkingHoursForDate, generateSlots } from '../../lib/slots'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Filter, Plus, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Loading from '../../components/ui/Loading'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import CustomerQuickPick from '../../components/CustomerQuickPick'
import { buildAppointmentMessage, buildWhatsAppUrl } from '../../lib/whatsapp'
import {
  enableStaffPushNotifications,
  getStaffPushSubscriptionStatus,
  notifyAppointmentCreated,
  sendTestStaffPushNotification,
  showStaffAppointmentNotification,
  syncStaffPushNotifications,
} from '../../lib/pushNotifications'
import { formatTurkishMobile, getTurkishMobileError, normalizeTurkishMobile } from '../../lib/phone'
import { loadCustomerOptions, upsertCustomer } from '../../lib/customers'

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

function addDaysISO(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + days)
  return format(date, 'yyyy-MM-dd')
}

function getAppointmentDateTime(appointment) {
  return new Date(`${appointment.appointment_date}T${formatTime(appointment.start_time) || '00:00'}:00`)
}

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token, employeeId, employeeName, shopId, shopName, clearSession } = useStaffStore()
  const [appointments, setAppointments] = useState([])
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [shopWorkingHours, setShopWorkingHours] = useState(null)
  const [employeeWorkingHours, setEmployeeWorkingHours] = useState(null)
  const [commissionRate, setCommissionRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
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
  const [slotConflicts, setSlotConflicts] = useState([])
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const today = todayISO()
  const highlightedAppointmentId = searchParams.get('appointmentId')
  const personalSales = useMemo(() => appointments
    .filter(appointment => appointment.status === 'done')
    .reduce((sum, appointment) => sum + (getAppointmentPriceValue(appointment) || 0), 0), [appointments])
  const personalReceivable = personalSales * commissionRate / 100

  function setQuickRange(range) {
    const todayDate = todayISO()
    if (range === 'today') {
      setDateFrom(todayDate)
      setDateTo(todayDate)
      setSelectedDate(todayDate)
      setCalendarMonth(startOfMonth(new Date()))
    } else if (range === 'week') {
      setDateFrom(todayDate)
      setDateTo(addDaysISO(todayDate, 6))
      setSelectedDate('')
    } else if (range === 'month') {
      setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
      setSelectedDate('')
      setCalendarMonth(startOfMonth(new Date()))
    } else {
      setDateFrom('2000-01-01')
      setDateTo('2099-12-31')
      setSelectedDate('')
    }
  }

  function changeCalendarMonth(amount) {
    const nextMonth = startOfMonth(addMonths(calendarMonth, amount))
    setCalendarMonth(nextMonth)
    setDateFrom(format(nextMonth, 'yyyy-MM-dd'))
    setDateTo(format(endOfMonth(nextMonth), 'yyyy-MM-dd'))
    setSelectedDate('')
  }

  function selectCalendarDate(date) {
    const isoDate = format(date, 'yyyy-MM-dd')
    setSelectedDate(isoDate)
    // Takvimdeki tum gunlerin doluluk bilgisi gorunmeye devam etsin diye
    // veri ay bazinda yuklenir; liste sadece secilen gunu gosterir.
    const month = startOfMonth(date)
    setCalendarMonth(month)
    setDateFrom(format(month, 'yyyy-MM-dd'))
    setDateTo(format(endOfMonth(month), 'yyyy-MM-dd'))
  }

  const filteredAppointments = useMemo(() => {
    let result = appointments
    if (selectedDate) result = result.filter(a => a.appointment_date === selectedDate)
    if (filterStatus) result = result.filter(a => a.status === filterStatus)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.customer_name?.toLowerCase().includes(q) ||
        a.customer_phone?.includes(q) ||
        getAppointmentServiceName(a).toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) => {
      if (selectedDate) return String(a.start_time || '').localeCompare(String(b.start_time || ''))
      if (highlightedAppointmentId) {
        if (a.id === highlightedAppointmentId) return -1
        if (b.id === highlightedAppointmentId) return 1
      }

      const createdDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0)
      if (createdDiff) return createdDiff
      const dateDiff = String(b.appointment_date || '').localeCompare(String(a.appointment_date || ''))
      if (dateDiff) return dateDiff
      return String(b.start_time || '').localeCompare(String(a.start_time || ''))
    })
  }, [appointments, selectedDate, filterStatus, search, highlightedAppointmentId])

  const appointmentsByDate = useMemo(() => appointments.reduce((map, appointment) => {
    const key = appointment.appointment_date
    if (!key) return map
    map.set(key, [...(map.get(key) || []), appointment])
    return map
  }, new Map()), [appointments])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const dayCount = endOfMonth(calendarMonth).getDate()
    const leadingDays = (getDay(monthStart) + 6) % 7
    return Array.from({ length: leadingDays + dayCount }, (_, index) => {
      if (index < leadingDays) return null
      return addDays(monthStart, index - leadingDays)
    })
  }, [calendarMonth])

  const stats = useMemo(() => ({
    today: appointments.filter(a => a.appointment_date === today && a.status !== 'cancelled' && a.status !== 'no_show').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    done: appointments.filter(a => a.status === 'done').length,
  }), [appointments, today])

  const reminderAppointments = useMemo(() => {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    return appointments
      .filter(appointment => ['pending', 'confirmed'].includes(appointment.status))
      .filter(appointment => {
        const appointmentTime = getAppointmentDateTime(appointment)
        return appointmentTime >= now && appointmentTime <= tomorrow
      })
      .sort((a, b) => getAppointmentDateTime(a) - getAppointmentDateTime(b))
      .slice(0, 6)
  }, [appointments])

  const customerOptions = useMemo(() => customers, [customers])

  const selectedServices = form.serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean)
  const totalDuration = selectedServices.reduce((sum, service) => sum + (Number(service.duration) || 0), 0)
  const totalPrice = selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0)
  const timeSlots = useMemo(() => {
    const duration = totalDuration || 30
    const dayHours = getWorkingHoursForDate(
      getEffectiveWorkingHours(shopWorkingHours, employeeWorkingHours),
      form.appointmentDate
    )
    if (!dayHours?.open) return []
    return generateSlots(dayHours.start, dayHours.end, 30).filter(slot => addMinutes(slot, duration) <= dayHours.end)
  }, [shopWorkingHours, employeeWorkingHours, form.appointmentDate, totalDuration])
  const slotStates = useMemo(() => timeSlots.map(slot => {
    const end = addMinutes(slot, totalDuration || 30)
    const booked = slotConflicts.some(appointment => {
      const appointmentStart = formatTime(appointment.start_time)
      if (!appointmentStart) return false
      const appointmentEnd = formatTime(appointment.end_time) || addMinutes(appointmentStart, appointment.services?.duration || 30)
      return isOverlapping(slot, end, appointmentStart, appointmentEnd)
    })

    return { time: slot, booked }
  }), [timeSlots, slotConflicts, totalDuration])

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

  function normalizeAppointment(appointment) {
    return {
      ...appointment,
      service_id: appointment.service_id,
      employee_name: appointment.employee_name || appointment.employees?.name,
      service_name: getAppointmentServiceName(appointment),
      service_price: getAppointmentPriceValue(appointment),
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
        created_at,
        customer_name,
        customer_phone,
        appointment_code,
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
      .order('created_at', { ascending: false })
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })

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
        created_at,
        customer_name,
        customer_phone,
        appointment_code,
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
      .order('created_at', { ascending: false })
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })

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
        created_at,
        customer_name,
        customer_phone,
        appointment_code,
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
      .order('created_at', { ascending: false })
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })

    if (queryError) throw queryError

    return (data || [])
      .filter(appointment => employeeId && appointment.employee_id === employeeId)
      .map(normalizeAppointment)
  }

  async function loadHighlightedAppointment() {
    if (!highlightedAppointmentId || !employeeId || !shopId) return null

    const { data, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        employee_id,
        service_id,
        created_at,
        customer_name,
        customer_phone,
        appointment_code,
        appointment_date,
        start_time,
        end_time,
        status,
        notes,
        employees(name),
        services(name, duration, price)
      `)
      .eq('id', highlightedAppointmentId)
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (queryError) throw queryError
    return data ? normalizeAppointment(data) : null
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
      } catch {
        // Sorgu bir sonraki güvenli geri dönüş yöntemiyle devam eder.
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
      } catch {
        // Sorgu bir sonraki güvenli geri dönüş yöntemiyle devam eder.
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
    } catch {
      // Boş liste göstermek, teknik veritabanı ayrıntılarını personele göstermemekten daha uygundur.
    }

    const emptyResult = directAppointments || employeeOnlyAppointments || visibleFallbackAppointments || []
    setAppointments(emptyResult)
    setLoading(false)
  }

  useEffect(() => {
    if (!shopId) return
    Promise.all([
      supabase
        .from('services')
        .select('id, name, duration, price')
        .eq('shop_id', shopId)
        .order('name'),
      supabase
        .from('shops')
        .select('working_hours')
        .eq('id', shopId)
        .maybeSingle(),
      employeeId
        ? supabase
          .from('employees')
          .select('working_hours, commission_rate')
          .eq('id', employeeId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([servicesRes, shopRes, employeeRes]) => {
      // Arka plan verisi yüklenemezse teknik ayrıntıları personele gösterme.
      setServices(servicesRes.data || [])
      setShopWorkingHours(shopRes.data?.working_hours || null)
       setEmployeeWorkingHours(employeeRes.data?.working_hours || null)
       setCommissionRate(Number(employeeRes.data?.commission_rate || 0))
    })
  }, [shopId, employeeId])

  useEffect(() => {
    if (!shopId || !employeeId) return

    loadCustomerOptions({ supabase, shopId, employeeId, limit: 200 })
      .then(setCustomers)
      .catch(() => {})
  }, [shopId, employeeId])

  useEffect(() => {
    if (token) load()
  }, [token, employeeId, shopId, dateFrom, dateTo])

  // Push bildirimiyle gelindiginde randevu mevcut ay/yukleme araliginin
  // disinda olsa bile dogrudan bulunur, ilgili gune gecilir ve kart vurgulanir.
  useEffect(() => {
    if (!token || !highlightedAppointmentId || !shopId || !employeeId) return

    let cancelled = false
    loadHighlightedAppointment()
      .then(appointment => {
        if (cancelled || !appointment) return

        const appointmentDate = new Date(`${appointment.appointment_date}T12:00:00`)
        const month = startOfMonth(appointmentDate)
        setSelectedDate(appointment.appointment_date)
        setCalendarMonth(month)
        setDateFrom(format(month, 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(month), 'yyyy-MM-dd'))
        setAppointments(current => current.some(item => item.id === appointment.id)
          ? current.map(item => item.id === appointment.id ? appointment : item)
          : [...current, appointment])
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [token, highlightedAppointmentId, shopId, employeeId])

  useEffect(() => {
    if (!showModal || !shopId || !employeeId || !form.appointmentDate) {
      setSlotConflicts([])
      return
    }

    let cancelled = false
    let query = supabase
      .from('appointments')
      .select('id, start_time, end_time, services(duration)')
      .eq('shop_id', shopId)
      .eq('employee_id', employeeId)
      .eq('appointment_date', form.appointmentDate)
      .neq('status', 'cancelled')

    if (modalMode === 'edit' && form.id) query = query.neq('id', form.id)

    query.then(({ data, error: slotError }) => {
      if (cancelled) return
      if (slotError) {
        setError(slotError.message)
        setSlotConflicts([])
        return
      }
      setSlotConflicts(data || [])
    })

    return () => {
      cancelled = true
    }
  }, [showModal, shopId, employeeId, form.appointmentDate, form.id, modalMode])

  useEffect(() => {
    if (!highlightedAppointmentId || loading) return

    const appointmentCard = document.getElementById(`appointment-${highlightedAppointmentId}`)
    appointmentCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightedAppointmentId, filteredAppointments.length, loading])

  useEffect(() => {
    if (!token) return

    if (!shopId || !employeeId) return

    syncStaffPushNotifications({ shopId, employeeId })
      .then(status => {
        setPushEnabled(status.enabled)
        if (status.enabled) {
          setPushStatus(status.synced
            ? 'Bildirimler bu personel hesabi icin etkinlestirildi. Yeni randevular bu telefona gelecek.'
            : 'Bildirimler acik. Yeni randevular bu cihaza gelecek.')
        }
      })
      .catch(() => {
        // Izin acik olsa bile hesap bazli abonelik okunamazsa butonla tekrar
        // baglanabilsin; "acik" goruntusu verilmeyecek.
        getStaffPushSubscriptionStatus({ shopId, employeeId })
          .then(status => {
            setPushEnabled(status.enabled)
            if (status.reason) setPushStatus(status.reason)
          })
          .catch(() => setPushEnabled(false))
      })
  }, [token, shopId, employeeId])

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
        } else if (payload.eventType === 'UPDATE') {
          const scheduleChanged = payload.old && (
            payload.old.appointment_date !== payload.new.appointment_date ||
            payload.old.start_time !== payload.new.start_time ||
            payload.old.end_time !== payload.new.end_time
          )
          if (scheduleChanged) showStaffAppointmentNotification(payload.new, 'updated')
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

  function fillCustomer(customer) {
    setForm(prev => ({
      ...prev,
      customerName: customer.name || prev.customerName,
      customerPhone: customer.phone || prev.customerPhone,
    }))
  }

  async function updateStatus(id, status) {
    setError('')

    const { error: rpcError } = await supabase.rpc('employee_update_appointment_status', {
      p_token: token,
      p_appointment_id: id,
      p_status: status,
    })

    if (rpcError) {
      // Eski Supabase kurulumlarinda RPC bulunmayabilir veya personel
      // oturumu yenilenmis olabilir. Tablo politikasi izin verdigi surece
      // ayni personelin (ya da atanmamis) randevusunu dogrudan guncelle.
      const { error: fallbackError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .eq('shop_id', shopId)
        .or(`employee_id.eq.${employeeId},employee_id.is.null`)

      if (fallbackError) {
        setError(fallbackError.message || rpcError.message)
        return false
      }
    }

    await load()
    return true
  }

  async function updateStatusAndNotify(appointment, status) {
    const message = buildAppointmentMessage({
      shopName,
      appointment,
      status,
    })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)

    // Mobil tarayicilar, await sonrasinda acilan pencereyi pop-up olarak
    // engelleyebilir. Tiklama aninda bos pencereyi ayirip onay basariliysa
    // WhatsApp adresine yonlendiriyoruz.
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const whatsappWindow = url && !isMobile ? window.open('', '_blank') : null
    if (whatsappWindow) whatsappWindow.opener = null

    const updated = await updateStatus(appointment.id, status)
    if (!updated) {
      whatsappWindow?.close()
      return
    }

    if (url && isMobile) {
      // Mobil/PWA'da ayni sekmede acmak, pop-up engeline takilmadan
      // WhatsApp uygulamasina gecis yapar.
      window.location.assign(url)
    } else if (whatsappWindow && url) {
      whatsappWindow.location.replace(url)
    } else if (url) {
      // Tarayici bos pencereyi de engellerse, ayni sekmede WhatsApp'i ac.
      window.location.assign(url)
    }
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
      await upsertCustomer({
        supabase,
        shopId,
        name: form.customerName,
        phone: form.customerPhone,
      })
      setCustomers(await loadCustomerOptions({ supabase, shopId, employeeId, limit: 200 }))
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
      // Yenileme, gecersiz kalmis tarayici endpointlerini de degistirir.
      await enableStaffPushNotifications({ shopId, employeeId, renewSubscription: true })
      setPushEnabled(true)
      setPushStatus('Bildirimler acildi. Yeni randevular bu telefona gelecek.')
    } catch (pushError) {
      setPushEnabled(false)
      setPushStatus(pushError.message || 'Bildirimler yenilenemedi. Telefon bildirim iznini kontrol edip tekrar dene.')
    }

    setPushLoading(false)
  }

  async function handleTestPush() {
    setTestPushLoading(true)
    setPushStatus('')

    try {
      // Testten hemen once aktif personel/cihaz eslesmesini tekrar kaydet.
      await enableStaffPushNotifications({ shopId, employeeId })
      const result = await sendTestStaffPushNotification(shopId, employeeId)
      setPushStatus(`Test bildirimi gonderildi. Giden cihaz: ${result.sent}`)
    } catch (pushError) {
      setPushStatus(pushError.message || 'Test bildirimi gonderilemedi. Lutfen tekrar dene.')
    }

    setTestPushLoading(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.rpc('employee_logout', { p_token: token })
    clearSession()
    navigate('/staff/login')
    setLoggingOut(false)
  }

  if (loading) return <Loading />

  return (
    <div className="min-h-dvh bg-navy">
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Cikis yapilsin mi?"
        message="Personel hesabindan cikis yapmak istediginize emin misiniz?"
        confirmText="Cikis yap"
        loading={loggingOut}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <Card className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-b-none p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-xl" glass={false}>
            <div className="flex items-center justify-between gap-3 border-b border-gold/10 px-4 py-3 sm:px-5">
              <h2 className="font-display text-xl font-bold text-cream">
                {modalMode === 'edit' ? 'Randevu Duzenle' : 'Randevu Ekle'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-cream-muted transition hover:bg-blue-50 hover:text-cream"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <CustomerQuickPick
                    customers={customerOptions}
                    onSelect={fillCustomer}
                    onError={setError}
                  />
                </div>
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
                  <option value="done">Geldi</option>
                  <option value="no_show">Gelmedi</option>
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
                  {slotStates.map(slot => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={slot.booked}
                      onClick={() => !slot.booked && setForm({ ...form, startTime: slot.time })}
                      className={`rounded-lg border px-2 py-2.5 font-mono text-sm transition disabled:cursor-not-allowed ${
                        slot.booked
                          ? 'border-red-500 bg-red-50 text-red-700 opacity-100'
                          : form.startTime === slot.time
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-gold/20 bg-navy-light text-cream hover:border-gold/50'
                      }`}
                    >
                      <span className={`block ${slot.booked ? 'line-through' : ''}`}>{slot.time}</span>
                      {slot.booked && <span className="mt-0.5 block text-[10px] font-sans">Dolu</span>}
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
              <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-gold/10 bg-navy-light px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] min-[420px]:flex-row sm:-mx-5 sm:px-5">
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
            <a
              href="#staff-calendar"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gold/25 bg-white px-3 py-2 text-sm leading-tight text-cream sm:hidden"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Takvim
            </a>
            <Button variant="secondary" size="sm" className="w-full sm:hidden" onClick={() => setShowFilters(prev => !prev)}>
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtrele
            </Button>
            <Button variant="secondary" size="sm" onClick={handleEnablePush} disabled={pushLoading}>
              {pushLoading ? 'Yenileniyor...' : pushEnabled ? 'Bildirimleri Yenile' : 'Bildirimleri Ac'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleTestPush} disabled={testPushLoading || !pushEnabled}>
              {testPushLoading ? 'Gonderiliyor...' : 'Test Bildirimi'}
            </Button>
            <Link to="/staff/finance"><Button variant="secondary" size="sm">Hesabim</Button></Link>
            <Button size="sm" className="hidden sm:inline-flex" onClick={openAddModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Randevu Ekle
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowLogoutConfirm(true)}>Cikis</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            İşlem tamamlanamadı. Lütfen tekrar dene.
          </div>
        )}

        {pushStatus && (
          <div className="rounded-lg border border-gold/10 bg-navy-light px-3 py-2 text-sm text-cream-muted">
            {pushStatus}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-xl border border-gold/20 bg-navy-light p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-cream">Telefon bildirimleri</p>
            <p className="mt-1 text-sm text-cream-muted">Uygulama kapalıyken de bildirim almak için cihaz kaydını yenile.</p>
          </div>
          <Button onClick={handleEnablePush} disabled={pushLoading} className="w-full shrink-0 sm:w-auto">
            {pushLoading ? 'Yenileniyor...' : 'Bildirimleri Yenile'}
          </Button>
        </section>

        <Card className="border-gold/20 bg-gold/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-cream">Hesabim</p>
              <p className="text-xs text-cream-muted">Secili randevu araligindaki tamamlanan islemler.</p>
            </div>
            <div className="flex gap-5 text-sm">
              <div><p className="text-cream-muted">Toplam is</p><p className="font-bold text-cream">{formatPrice(personalSales)}</p></div>
              <div><p className="text-cream-muted">Hak edis (%{commissionRate})</p><p className="font-bold text-emerald-600">{formatPrice(personalReceivable)}</p></div>
            </div>
          </div>
        </Card>

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

        <Card title="Hatirlatmalar">
          {reminderAppointments.length === 0 ? (
            <p className="text-sm text-cream-muted">Onumuzdeki 24 saat icinde hatirlatilacak randevu yok.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reminderAppointments.map(appointment => (
                <div key={appointment.id} className="rounded-lg border border-gold/10 bg-gold/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-cream">{appointment.customer_name}</p>
                      <p className="mt-1 text-sm text-cream-muted">
                        {appointment.appointment_date} - <span className="font-mono text-gold">{formatTime(appointment.start_time)}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-cream-muted">{getAppointmentServiceName(appointment)}</p>
                    </div>
                    <Bell className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                  </div>
                  <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => openWhatsApp(appointment, 'reminder_2h')}>
                    WhatsApp Hatirlat
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div id="staff-calendar" className="scroll-mt-4">
        <Card className="border-gold/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <CalendarDays className="h-5 w-5 text-gold" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-semibold text-cream">Randevu Takvimi</h2>
                <p className="text-xs text-cream-muted">Bir gun secerek o gunun randevularini gor.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => changeCalendarMonth(-1)} aria-label="Onceki ay">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-35 text-center text-sm font-semibold text-cream">
                {format(calendarMonth, 'MMMM yyyy', { locale: tr })}
              </span>
              <Button variant="secondary" size="sm" onClick={() => changeCalendarMonth(1)} aria-label="Sonraki ay">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-cream-muted sm:text-xs">
            {['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />
              const isoDate = format(date, 'yyyy-MM-dd')
              const dayAppointments = appointmentsByDate.get(isoDate) || []
              const activeCount = dayAppointments.filter(item => !['cancelled', 'no_show'].includes(item.status)).length
              const isSelected = isoDate === selectedDate
              const isToday = isoDate === today

              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => selectCalendarDate(date)}
                  className={`min-h-14 rounded-lg border p-1 text-left transition active:scale-95 sm:min-h-18 sm:p-2 ${
                    isSelected
                      ? 'border-gold bg-gold/15 ring-1 ring-gold/40'
                      : isToday
                        ? 'border-gold/50 bg-gold/5 hover:border-gold'
                        : 'border-gold/10 bg-navy/40 hover:border-gold/50'
                  }`}
                  aria-label={`${format(date, 'd MMMM yyyy', { locale: tr })}, ${activeCount} randevu`}
                >
                  <span className={`block font-mono text-xs sm:text-sm ${isSelected || isToday ? 'text-gold' : 'text-cream'}`}>{format(date, 'd')}</span>
                  {activeCount > 0 && (
                    <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1 py-0.5 text-[10px] font-bold text-navy">
                      {activeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-cream-muted">
            <span>{selectedDate ? `${format(new Date(`${selectedDate}T12:00:00`), 'd MMMM yyyy, EEEE', { locale: tr })} secili.` : 'Ay icindeki tum randevular listeleniyor.'}</span>
            {selectedDate && <Button size="sm" variant="secondary" onClick={() => setSelectedDate('')}>Gun filtresini kaldir</Button>}
          </div>
        </Card>
        </div>

        <Card className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ['today', 'Bugun'],
              ['week', 'Bu hafta'],
              ['month', 'Bu ay'],
              ['all', 'Tum randevular'],
            ].map(([range, label]) => (
              <Button key={range} type="button" variant="secondary" size="sm" onClick={() => setQuickRange(range)}>
                {label}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={filterStatus === 'pending' ? 'border-gold bg-gold/15 text-gold' : ''}
              onClick={() => {
                setSelectedDate('')
                setFilterStatus(current => current === 'pending' ? '' : 'pending')
              }}
            >
              Onay bekleyenler
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="Baslangic" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedDate('') }} />
            <Input label="Bitis" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedDate('') }} />
            <Select label="Durum" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Tumu</option>
              <option value="pending">Onay bekleyen</option>
              <option value="confirmed">Onaylandi</option>
              <option value="done">Geldi</option>
              <option value="no_show">Gelmedi</option>
              <option value="cancelled">Iptal</option>
            </Select>
            <Input label="Ara" value={search} onChange={e => setSearch(e.target.value)} placeholder="Isim, telefon, hizmet" />
            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={load}>Yenile</Button>
            </div>
          </div>
        </Card>

        <Card title={selectedDate ? `${format(new Date(`${selectedDate}T12:00:00`), 'd MMMM', { locale: tr })} randevularim` : 'Randevularim'}>
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
              {filteredAppointments.map(appointment => {
                const isHighlighted = appointment.id === highlightedAppointmentId

                return (
                <div
                  id={`appointment-${appointment.id}`}
                  key={appointment.id}
                  className={`flex min-h-full flex-col rounded-lg border p-4 transition ${
                    isHighlighted
                      ? 'border-gold bg-gold/10 shadow-lg shadow-gold/10 ring-1 ring-gold/40'
                      : 'border-gold/10 bg-navy/50'
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="block font-mono text-xl font-semibold text-gold">{formatTime(appointment.start_time)}</span>
                          <span className="text-sm text-cream-muted">{appointment.appointment_date}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isHighlighted && (
                            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-gold">
                              Yeni bildirim
                            </span>
                          )}
                          <Badge status={appointment.status} />
                        </div>
                      </div>
                      <p className="mt-1 font-medium text-cream">{appointment.customer_name}</p>
                      <p className="text-sm text-cream-muted">{appointment.customer_phone}</p>
                      {appointment.employee_name && (
                        <p className="text-sm text-cream-muted">Personel: {appointment.employee_name}</p>
                      )}
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-gold/10 bg-gold/5 p-2 text-xs">
                        <div>
                          <p className="text-cream-muted">Hizmetler</p>
                          <p className="mt-0.5 line-clamp-2 font-medium text-cream">{getAppointmentServiceName(appointment)}</p>
                        </div>
                        <div>
                          <p className="text-cream-muted">Sure</p>
                          <p className="mt-0.5 font-mono font-medium text-cream">{getAppointmentDurationLabel(appointment) || '-'}</p>
                        </div>
                        <div>
                          <p className="text-cream-muted">Toplam</p>
                          <p className="mt-0.5 font-semibold text-gold">{getAppointmentPriceLabel(appointment) || '-'}</p>
                        </div>
                      </div>
                      {appointment.notes && <p className="mt-2 text-sm text-cream-muted">{appointment.notes}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status === 'pending' && (
                        <Button size="sm" className="w-full" onClick={() => updateStatusAndNotify(appointment, 'confirmed')}>Onayla</Button>
                      )}
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status === 'confirmed' && (
                        <Button size="sm" className="w-full" onClick={() => updateStatus(appointment.id, 'done')}>Geldi</Button>
                      )}
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && appointment.status !== 'cancelled' && appointment.status !== 'done' && appointment.status !== 'no_show' && (
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => updateStatus(appointment.id, 'cancelled')}>Iptal</Button>
                      )}
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => openWhatsApp(appointment)}>WhatsApp</Button>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => openWhatsApp(appointment, 'reminder_2h')}>Hatirlat</Button>
                      {(appointment.employee_id === employeeId || !appointment.employee_id) && (
                        <>
                          <Button variant="secondary" size="sm" className="w-full" onClick={() => openEditModal(appointment)}>Duzenle</Button>
                          <Button variant="danger" size="sm" className="w-full" onClick={() => setDeleteTarget(appointment)}>Sil</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </Card>
        <button
          type="button"
          onClick={openAddModal}
          className="fixed bottom-6 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-blue-600/25 transition hover:bg-gold-light sm:hidden"
          aria-label="Randevu ekle"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      </main>
    </div>
  )
}
