import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStaffStore } from '../../store/staffStore'
import { formatPrice, todayISO } from '../../lib/time'
import { getAppointmentPriceValue } from '../../lib/appointmentSummary'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Loading from '../../components/ui/Loading'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function StaffFinance() {
  const { employeeId, shopId } = useStaffStore()
  const [date, setDate] = useState(todayISO())
  const [employee, setEmployee] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [selected, setSelected] = useState(null)
  const [method, setMethod] = useState('cash')
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!employeeId || !shopId) return
    setLoading(true)
    const [employeeRes, appointmentsRes, transactionsRes] = await Promise.all([
      supabase.from('employees').select('name, commission_rate').eq('id', employeeId).maybeSingle(),
      supabase.from('appointments').select('id, customer_name, notes, services(price)').eq('shop_id', shopId).eq('employee_id', employeeId).eq('appointment_date', date).eq('status', 'done'),
      supabase.from('financial_transactions').select('id, appointment_id, title, amount, payment_method, type, created_at').eq('shop_id', shopId).eq('employee_id', employeeId).eq('transaction_date', date).order('created_at', { ascending: false }),
    ])
    setEmployee(employeeRes.data); setAppointments(appointmentsRes.data || []); setTransactions(transactionsRes.data || [])
    setError(employeeRes.error?.message || appointmentsRes.error?.message || transactionsRes.error?.message || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [employeeId, shopId, date])
  const sales = useMemo(() => appointments.reduce((sum, item) => sum + (getAppointmentPriceValue(item) || 0), 0), [appointments])
  const earned = sales * Number(employee?.commission_rate || 0) / 100
  const payments = transactions.filter(item => item.type === 'employee_payment')
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const isCollected = id => transactions.some(item => item.type === 'income' && item.appointment_id === id)

  async function collectPayment() {
    if (!selected) return
    const amount = getAppointmentPriceValue(selected) || 0
    if (!amount) return setError('Randevu tutari bulunamadi.')
    setSaving(true)
    const { error: saveError } = await supabase.from('financial_transactions').insert({ shop_id: shopId, employee_id: employeeId, appointment_id: selected.id, transaction_date: date, type: 'income', title: `${selected.customer_name} randevu odemesi`, amount, payment_method: method, cash_amount: method === 'cash' ? amount : 0, card_amount: method === 'card' ? amount : 0, iban_amount: method === 'iban' ? amount : 0 })
    setSaving(false)
    if (saveError) return setError(saveError.message)
    setSelected(null); await load()
  }

  if (loading) return <Loading />
  return <div className="min-h-dvh bg-navy p-4 md:p-6"><div className="mx-auto max-w-3xl space-y-5">
    <div className="flex items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-cream">Hesabim</h1><p className="text-sm text-cream-muted">Tahsilat, hak edis ve odeme hareketlerin.</p></div><Link to="/staff/dashboard"><Button variant="secondary" size="sm">Panele Don</Button></Link></div>
    <Input label="Tarih" type="date" value={date} onChange={e => setDate(e.target.value)} />
    {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-sm text-cream-muted">Tamamlanan is</p><b className="text-xl text-cream">{formatPrice(sales)}</b></Card><Card><p className="text-sm text-cream-muted">Hak edis</p><b className="text-xl text-emerald-600">{formatPrice(earned)}</b></Card><Card><p className="text-sm text-cream-muted">Alacak</p><b className="text-xl text-gold">{formatPrice(earned - paid)}</b></Card></div>
    <Card title="Randevu tahsilatlari"><div className="space-y-2">{appointments.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 p-3"><div><p className="font-medium text-cream">{item.customer_name}</p><p className="text-sm text-cream-muted">{formatPrice(getAppointmentPriceValue(item))}</p></div>{isCollected(item.id) ? <span className="text-sm font-medium text-emerald-600">Odeme alindi</span> : <Button size="sm" onClick={() => setSelected(item)}>Odeme al</Button>}</div>)}{!appointments.length && <p className="text-sm text-cream-muted">Bu tarihte tamamlanan randevu yok.</p>}</div></Card>
    {selected && <Card title={`${selected.customer_name} odemesi`} action={<Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Kapat</Button>}><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Select label="Odeme yontemi" value={method} onChange={e => setMethod(e.target.value)}><option value="cash">Nakit</option><option value="card">Kart</option><option value="iban">IBAN / Havale</option></Select><div className="flex items-end"><Button className="w-full" onClick={() => setConfirm(true)}>Odeme al</Button></div></div></Card>}
    <Card title="Hareketler"><div className="space-y-2">{transactions.map(item => <div key={item.id} className="flex justify-between rounded-lg border border-gold/10 p-3"><span>{item.title} · {item.payment_method}</span><b className={item.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>{item.type === 'income' ? '+' : '-'}{formatPrice(item.amount)}</b></div>)}</div></Card>
    <ConfirmDialog open={confirm} title="Odemeyi al" message={`${selected?.customer_name} randevusunun ${formatPrice(getAppointmentPriceValue(selected))} odemesini aldigini onayliyor musun?`} confirmText="Evet, odemeyi al" confirmVariant="primary" loading={saving} onCancel={() => setConfirm(false)} onConfirm={async () => { setConfirm(false); await collectPayment() }} />
  </div></div>
}
