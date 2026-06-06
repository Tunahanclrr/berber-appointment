import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { formatTime, todayISO } from '../lib/time'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Loading from '../components/ui/Loading'

export default function Dashboard() {
  const { shop } = useShop()
  const [stats, setStats] = useState({ today: 0, customers: 0, revenue: 0, occupancy: 0 })
  const [todayAppts, setTodayAppts] = useState([])
  const [employeeLoad, setEmployeeLoad] = useState([])
  const [weekChart, setWeekChart] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shop) return

    async function load() {
      const today = todayISO()
      const monthStart = format(new Date(), 'yyyy-MM-01')

      const [todayRes, monthRes, employeesRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, employees(name), services(name, price)')
          .eq('shop_id', shop.id)
          .eq('appointment_date', today)
          .neq('status', 'cancelled')
          .order('start_time'),
        supabase
          .from('appointments')
          .select('customer_phone, services(price), status')
          .eq('shop_id', shop.id)
          .gte('appointment_date', monthStart)
          .neq('status', 'cancelled'),
        supabase.from('employees').select('id, name').eq('shop_id', shop.id).eq('is_active', true),
      ])

      const todayData = todayRes.data || []
      const monthData = monthRes.data || []
      const employees = employeesRes.data || []

      const uniqueCustomers = new Set(monthData.map(a => a.customer_phone)).size
      const revenue = monthData
        .filter(a => a.status === 'done')
        .reduce((sum, a) => sum + (Number(a.services?.price) || 0), 0)

      const totalSlots = employees.length * 22
      const occupancy = totalSlots > 0 ? Math.round((todayData.length / totalSlots) * 100) : 0

      const empLoad = employees.map(emp => {
        const count = todayData.filter(a => a.employee_id === emp.id).length
        return { name: emp.name.split(' ')[0], count, max: 10 }
      })

      const weekData = Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
        const label = format(subDays(new Date(), 6 - i), 'EEE')
        const count = 0
        return { day: label, count, date: d }
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

      setTodayAppts(todayData)
      setStats({ today: todayData.length, customers: uniqueCustomers, revenue, occupancy })
      setEmployeeLoad(empLoad)
      setWeekChart(weekData)
      setLoading(false)
    }

    load()
  }, [shop])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">Dashboard</h1>
        <p className="text-cream-muted">{shop.name} — genel bakış</p>
      </div>

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
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-gold/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="font-mono text-gold">{formatTime(a.start_time)}</span>
                  <span className="ml-3 text-cream">{a.customer_name}</span>
                  <span className="ml-2 text-sm text-cream-muted">{a.employees?.name} · {a.services?.name}</span>
                </div>
                <Badge status={a.status} />
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
