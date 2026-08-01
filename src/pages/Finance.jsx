import { useEffect, useMemo, useState } from 'react'
import { Landmark, MinusCircle, PlusCircle, WalletCards } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { formatPrice, formatTime, todayISO } from '../lib/time'
import { getAppointmentPriceValue } from '../lib/appointmentSummary'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'

export default function Finance() {
  const { shop } = useShop()
  const [date, setDate] = useState(todayISO())
  const [transactions, setTransactions] = useState([])
  const [employees, setEmployees] = useState([])
  const [appointments, setAppointments] = useState([])
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!shop?.id) return
    setLoading(true)
    const [transactionRes, employeeRes, appointmentRes] = await Promise.all([
      supabase.from('financial_transactions').select('*, employees(name)').eq('shop_id', shop.id).eq('transaction_date', date).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name, commission_rate').eq('shop_id', shop.id).eq('is_active', true).order('name'),
      supabase.from('appointments').select('id, employee_id, customer_name, start_time, status, notes, services(price), employees(name)').eq('shop_id', shop.id).eq('appointment_date', date).neq('status', 'cancelled').order('start_time'),
    ])
    setError(transactionRes.error?.message || employeeRes.error?.message || appointmentRes.error?.message || '')
    setTransactions(transactionRes.data || [])
    setEmployees(employeeRes.data || [])
    setAppointments(appointmentRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [shop?.id, date])

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const expense = transactions.filter(t => ['expense', 'employee_payment'].includes(t.type)).reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const due = transactions.reduce((sum, t) => sum + Number(t.balance_due || 0), 0)
    return { income, expense, due, balance: income - expense }
  }, [transactions])

  const commissions = useMemo(() => employees.map(employee => {
    const sales = appointments.filter(a => a.status === 'done' && a.employee_id === employee.id).reduce((sum, a) => sum + (getAppointmentPriceValue(a) || 0), 0)
    const earned = sales * Number(employee.commission_rate || 0) / 100
    const paid = transactions.filter(t => t.type === 'employee_payment' && t.employee_id === employee.id).reduce((sum, t) => sum + Number(t.amount || 0), 0)
    return { ...employee, sales, earned, receivable: earned - paid }
  }), [employees, appointments, transactions])

  function isPaid(appointmentId) {
    return transactions.some(transaction => transaction.appointment_id === appointmentId && transaction.type === 'income')
  }

  async function recordPayment() {
    if (!selectedAppointment) return
    const amount = getAppointmentPriceValue(selectedAppointment) || 0
    if (amount <= 0) return setError('Bu randevu icin fiyat bulunamadi.')
    setSaving(true)
    const paymentAmounts = {
      cash_amount: paymentMethod === 'cash' ? amount : 0,
      iban_amount: paymentMethod === 'iban' ? amount : 0,
      card_amount: paymentMethod === 'card' ? amount : 0,
    }
    const { error: saveError } = await supabase.from('financial_transactions').insert({
      shop_id: shop.id,
      appointment_id: selectedAppointment.id,
      transaction_date: date,
      type: 'income',
      title: `${selectedAppointment.customer_name} randevu odemesi`,
      amount,
      payment_method: paymentMethod,
      ...paymentAmounts,
    })
    setSaving(false)
    if (saveError) return setError(saveError.message)
    setSelectedAppointment(null)
    load()
  }

  if (loading) return <Loading />

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-display text-2xl font-bold text-cream">Gelir Gider</h1><p className="text-cream-muted">Gun sonu tahsilat ve personel hak edisleri.</p></div><Input label="Tarih" type="date" value={date} onChange={e => setDate(e.target.value)} className="sm:w-48" /></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[PlusCircle, 'Tahsilat', summary.income, 'text-emerald-600'], [MinusCircle, 'Gider', summary.expense, 'text-red-600'], [WalletCards, 'Kasa', summary.balance, 'text-gold'], [Landmark, 'Bekleyen borc', summary.due, 'text-amber-600']].map(([Icon, label, value, color]) => <Card key={label}><Icon className={`h-5 w-5 ${color}`} /><p className="mt-3 text-sm text-cream-muted">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{formatPrice(value)}</p></Card>)}</div>
    <Card title="Gunun randevulari"><p className="mb-4 text-sm text-cream-muted">Bir randevuya dokun, sonra odeme yontemini secip tahsilati kaydet.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{appointments.length ? appointments.map(appointment => { const paid = isPaid(appointment.id); const amount = getAppointmentPriceValue(appointment); return <button key={appointment.id} type="button" disabled={paid} onClick={() => setSelectedAppointment(appointment)} className={`rounded-xl border p-4 text-left transition ${paid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white hover:border-gold hover:shadow-sm'}`}><div className="flex justify-between gap-2"><b className="text-cream">{appointment.customer_name}</b><span className="font-mono text-gold">{formatTime(appointment.start_time)}</span></div><p className="mt-1 text-sm text-cream-muted">{appointment.employees?.name || 'Personel yok'}</p><p className="mt-3 font-bold text-cream">{formatPrice(amount)}</p><p className="mt-1 text-xs font-semibold">{paid ? 'Odeme alindi' : 'Odeme almak icin sec'}</p></button> }) : <p className="text-sm text-cream-muted">Bu gun randevu yok.</p>}</div></Card>
    {selectedAppointment && <Card title={`${selectedAppointment.customer_name} odemesi`} action={<Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(null)}>Kapat</Button>}><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Select label="Odeme yontemi" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">Nakit</option><option value="card">Kart</option><option value="iban">IBAN / Havale</option></Select><div className="flex items-end"><Button className="w-full" onClick={recordPayment} disabled={saving}>{saving ? 'Kaydediliyor...' : `${formatPrice(getAppointmentPriceValue(selectedAppointment))} odemeyi al`}</Button></div></div></Card>}
    <div className="grid gap-4 lg:grid-cols-2"><Card title="Personel hak edisleri"><div className="space-y-3">{commissions.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between"><b>{item.name}</b><span className="text-gold">%{item.commission_rate || 0}</span></div><p className="mt-1 text-sm text-cream-muted">Tamamlanan is: {formatPrice(item.sales)}</p><p className="mt-1 font-semibold text-emerald-600">Alacak: {formatPrice(item.receivable)}</p></div>)}</div></Card><Card title="Gunluk tahsilatlar"><div className="space-y-2">{transactions.filter(t => t.type === 'income').length ? transactions.filter(t => t.type === 'income').map(t => <div key={t.id} className="flex justify-between rounded-lg border border-slate-200 p-3"><span>{t.title} · {t.payment_method}</span><b className="text-emerald-600">+{formatPrice(t.amount)}</b></div>) : <p className="text-sm text-cream-muted">Henuz tahsilat yok.</p>}</div></Card></div>
  </div>
}
