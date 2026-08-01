import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStaffStore } from '../../store/staffStore'
import { formatPrice, todayISO } from '../../lib/time'
import { getAppointmentPriceValue } from '../../lib/appointmentSummary'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Loading from '../../components/ui/Loading'

export default function StaffFinance() {
  const { employeeId, shopId } = useStaffStore()
  const [date, setDate] = useState(todayISO())
  const [employee, setEmployee] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId || !shopId) return
    setLoading(true)
    Promise.all([
      supabase.from('employees').select('name, commission_rate').eq('id', employeeId).maybeSingle(),
      supabase.from('appointments').select('id, customer_name, notes, services(price)').eq('shop_id', shopId).eq('employee_id', employeeId).eq('appointment_date', date).eq('status', 'done'),
      supabase.from('financial_transactions').select('id, title, amount, payment_method, created_at').eq('shop_id', shopId).eq('employee_id', employeeId).eq('transaction_date', date).eq('type', 'employee_payment').order('created_at', { ascending: false }),
    ]).then(([employeeRes, appointmentsRes, paymentsRes]) => {
      setEmployee(employeeRes.data)
      setAppointments(appointmentsRes.data || [])
      setPayments(paymentsRes.data || [])
      setLoading(false)
    })
  }, [employeeId, shopId, date])

  const sales = useMemo(() => appointments.reduce((sum, appointment) => sum + (getAppointmentPriceValue(appointment) || 0), 0), [appointments])
  const earned = sales * Number(employee?.commission_rate || 0) / 100
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  if (loading) return <Loading />
  return <div className="min-h-dvh bg-navy p-4 md:p-6"><div className="mx-auto max-w-3xl space-y-5">
    <div className="flex items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-cream">Hesabim</h1><p className="text-sm text-cream-muted">Gunluk hak edis ve odeme hareketlerin.</p></div><Link to="/staff/dashboard"><Button variant="secondary" size="sm">Panele Don</Button></Link></div>
    <Input label="Tarih" type="date" value={date} onChange={e => setDate(e.target.value)} />
    <div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-sm text-cream-muted">Tamamlanan is</p><b className="text-xl text-cream">{formatPrice(sales)}</b></Card><Card><p className="text-sm text-cream-muted">Hak edis (%{employee?.commission_rate || 0})</p><b className="text-xl text-emerald-600">{formatPrice(earned)}</b></Card><Card><p className="text-sm text-cream-muted">Alacak</p><b className="text-xl text-gold">{formatPrice(earned - paid)}</b></Card></div>
    <Card title="Hareketler"><div className="space-y-2">{appointments.map(appointment => <div key={appointment.id} className="flex justify-between rounded-lg border border-slate-200 p-3"><span>Randevu · {appointment.customer_name}</span><span className="text-emerald-600">+{formatPrice((getAppointmentPriceValue(appointment) || 0) * Number(employee?.commission_rate || 0) / 100)}</span></div>)}{payments.map(payment => <div key={payment.id} className="flex justify-between rounded-lg border border-slate-200 p-3"><span>{payment.title} · {payment.payment_method}</span><span className="text-red-600">-{formatPrice(payment.amount)}</span></div>)}{!appointments.length && !payments.length && <p className="text-sm text-cream-muted">Bu tarihte hareket yok.</p>}</div></Card>
  </div></div>
}
