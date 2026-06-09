import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { formatTime, todayISO } from '../lib/time'
import { buildAppointmentMessage, buildWhatsAppUrl } from '../lib/whatsapp'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'

export default function Dashboard() {
  const { shop } = useShop()
  const [stats, setStats] = useState({ today: 0, customers: 0, revenue: 0, occupancy: 0 })
  const [todayAppts, setTodayAppts] = useState([])
  const [employeeLoad, setEmployeeLoad] = useState([])
  const [weekChart, setWeekChart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadDashboard = useCallback(async () => {
    if (!shop) return

    setError('')
    const today = todayISO()
    const monthStart = format(new Date(), 'yyyy-MM-01')

    const [todayRes, monthRes, employeesRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, employees(name), services(name, price)')
        .eq('shop_id', shop.id)
        .eq('appointment_date', today)
        .order('created_at', { ascending: false })
        .order('start_time', { ascending: false }),
      supabase
        .from('appointments')
        .select('customer_phone, services(price), status')
        .eq('shop_id', shop.id)
        .gte('appointment_date', monthStart)
        .neq('status', 'cancelled'),
      supabase.from('employees').select('id, name').eq('shop_id', shop.id).eq('is_active', true),
    ])

    if (todayRes.error || monthRes.error || employeesRes.error) {
      setError(todayRes.error?.message || monthRes.error?.message || employeesRes.error?.message)
      setLoading(false)
      return
    }

    const todayData = todayRes.data || []
    const phones = [...new Set(todayData.map(a => a.customer_phone).filter(Boolean))]
    let noShowCounts = {}

    if (phones.length > 0) {
      const { data: noShows } = await supabase
        .from('appointments')
        .select('customer_phone')
        .eq('shop_id', shop.id)
        .eq('status', 'no_show')
        .in('customer_phone', phones)

      noShowCounts = (noShows || []).reduce((counts, item) => {
        counts[item.customer_phone] = (counts[item.customer_phone] || 0) + 1
        return counts
      }, {})
    }

    const enrichedTodayData = todayData.map(appointment => ({
      ...appointment,
      customer_no_show_count: noShowCounts[appointment.customer_phone] || 0,
    }))
    const activeTodayData = enrichedTodayData.filter(a => a.status !== 'cancelled' && a.status !== 'no_show')
    const monthData = monthRes.data || []
    const employees = employeesRes.data || []

    const uniqueCustomers = new Set(monthData.map(a => a.customer_phone)).size
    const revenue = monthData
      .filter(a => a.status === 'done')
      .reduce((sum, a) => sum + (Number(a.services?.price) || 0), 0)

    const totalSlots = employees.length * 22
    const occupancy = totalSlots > 0 ? Math.round((activeTodayData.length / totalSlots) * 100) : 0

    const empLoad = employees.map(emp => {
      const count = activeTodayData.filter(a => a.employee_id === emp.id).length
      return { name: emp.name.split(' ')[0], count, max: 10 }
    })

    const weekData = Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const label = format(subDays(new Date(), 6 - i), 'EEE')
      return { day: label, count: 0, date: d }
    })

    const { data: weekAppts } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('shop_id', shop.id)
      .gte('appointment_date', weekData[0].date)
      .neq('status', 'cancelled')

    weekData.forEach(w => {
      w.count = (weekAppts || []).filter(a => a.appointment_date === w.date).length
    })

    setTodayAppts(enrichedTodayData)
    setStats({ today: activeTodayData.length, customers: uniqueCustomers, revenue, occupancy })
    setEmployeeLoad(empLoad)
    setWeekChart(weekData)
    setLoading(false)
  }, [shop])

  useEffect(() => {
    if (!shop) return

    loadDashboard()

    const channel = supabase
      .channel(`dashboard-appointments-live-${shop.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `shop_id=eq.${shop.id}`,
      }, () => loadDashboard())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shop, loadDashboard])

  async function updateStatus(id, status) {
    setError('')
    const { error: statusError } = await supabase.from('appointments').update({ status }).eq('id', id).eq('shop_id', shop.id)
    if (statusError) {
      setError(statusError.message)
      return false
    }
    await loadDashboard()
    return true
  }

  async function updateStatusAndNotify(appointment, status) {
    const updated = await updateStatus(appointment.id, status)
    if (!updated) return
    const message = buildAppointmentMessage({ shopName: shop.name, appointment, status })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openWhatsApp(appointment, status = appointment.status) {
    const message = buildAppointmentMessage({ shopName: shop.name, appointment, status })
    const url = buildWhatsAppUrl(appointment.customer_phone, message)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleDeleteAppt() {
    if (!deleteTarget) return
    setError('')
    setDeleting(true)

    const { error: deleteError } = await supabase.from('appointments').delete().eq('id', deleteTarget.id).eq('shop_id', shop.id)
    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    setTodayAppts(prev => prev.filter(a => a.id !== deleteTarget.id))
    setDeleteTarget(null)
    await loadDashboard()
    setDeleting(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
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
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">Dashboard</h1>
        <p className="text-cream-muted">{shop.name} — genel bakış</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Bugünkü Randevu', value: stats.today, suffix: '' },
          { label: 'Aylık Müşteri', value: stats.customers, suffix: '' },
          { label: 'Aylık Gelir', value: stats.revenue, suffix: '₺', mono: true },
          { label: 'Doluluk', value: stats.occupancy, suffix: '%' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-sm text-cream-muted">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold text-gold ${s.mono ? 'font-mono' : ''}`}>
              {s.mono ? new Intl.NumberFormat('tr-TR').format(s.value) : s.value}{s.suffix}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Son 7 Gün">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weekChart}>
              <XAxis dataKey="day" stroke="#A8A095" fontSize={12} />
              <YAxis stroke="#A8A095" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,168,76,0.3)' }} />
              <Line type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={2} dot={{ fill: '#C9A84C' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Personel Doluluk (Bugün)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={employeeLoad}>
              <XAxis dataKey="name" stroke="#A8A095" fontSize={12} />
              <YAxis stroke="#A8A095" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(201,168,76,0.3)' }} />
              <Bar dataKey="count" fill="#C9A84C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title={`Bugünün Randevuları`}>
        {todayAppts.length === 0 ? (
          <p className="text-sm text-cream-muted">Bugün randevu yok.</p>
        ) : (
          <div className="space-y-2">
            {todayAppts.map(a => (
              <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-gold/10 px-4 py-3">
                <div className="min-w-0">
                  <span className="font-mono text-gold">{formatTime(a.start_time)}</span>
                  <span className="ml-3 text-cream">{a.customer_name}</span>
                  <span className="ml-2 text-sm text-cream-muted">{a.employees?.name} · {a.services?.name}</span>
                  {a.customer_no_show_count >= 2 && (
                    <p className="mt-1 text-xs font-medium text-orange-300">
                      Risk: Bu numara daha once {a.customer_no_show_count} kez gelmedi.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge status={a.status} />
                  {a.status === 'pending' && <Button size="sm" onClick={() => updateStatusAndNotify(a, 'confirmed')}>Onayla</Button>}
                  {a.status === 'confirmed' && <Button size="sm" onClick={() => updateStatus(a.id, 'done')}>Geldi</Button>}
                  {a.status !== 'cancelled' && a.status !== 'done' && a.status !== 'no_show' && (
                    <Button variant="secondary" size="sm" onClick={() => updateStatus(a.id, 'no_show')}>Gelmedi</Button>
                  )}
                  {a.status !== 'cancelled' && a.status !== 'done' && a.status !== 'no_show' && (
                    <Button variant="secondary" size="sm" onClick={() => updateStatus(a.id, 'cancelled')}>Iptal</Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => openWhatsApp(a)}>WhatsApp</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(a)}>Sil</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link to="/dashboard/appointments" className="mt-3 inline-block text-sm text-gold hover:underline">
          Tüm randevular →
        </Link>
      </Card>
    </div>
  )
}
