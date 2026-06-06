import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Loading from '../components/ui/Loading'

export default function Employees() {
  const { shop } = useShop()
  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [pinModal, setPinModal] = useState(null)
  const [pin, setPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  async function load() {
    const [empRes, svcRes] = await Promise.all([
      supabase.from('employees').select('*, employee_services(service_id)').eq('shop_id', shop.id).order('name'),
      supabase.from('services').select('*').eq('shop_id', shop.id).order('name'),
    ])
    setEmployees(empRes.data || [])
    setServices(svcRes.data || [])
    setLoading(false)
  }

  useEffect(() => { if (shop) load() }, [shop])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return setError('İsim gerekli.')
    const { error: err } = await supabase.from('employees').insert({
      shop_id: shop.id, name: name.trim(), phone: phone.trim() || null,
    })
    if (err) setError(err.message)
    else { setName(''); setPhone(''); await load() }
  }

  async function handleDelete(id) {
    if (!confirm('Silmek istediğine emin misin?')) return
    await supabase.from('employees').delete().eq('id', id)
    await load()
  }

  async function toggleActive(emp) {
    await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    await load()
  }

  async function toggleService(employeeId, serviceId, assigned) {
    if (assigned) {
      await supabase.from('employee_services').delete().eq('employee_id', employeeId).eq('service_id', serviceId)
    } else {
      await supabase.from('employee_services').insert({ employee_id: employeeId, service_id: serviceId })
    }
    await load()
  }

  async function savePin() {
    setPinMsg('')
    const { error: err } = await supabase.rpc('set_employee_pin', {
      emp_id: pinModal.id,
      raw_pin: pin,
    })
    if (err) setPinMsg(err.message)
    else {
      setPinMsg('PIN kaydedildi.')
      setPin('')
      setTimeout(() => setPinModal(null), 1000)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">Personel</h1>
        <p className="text-cream-muted">Berberlerini yönet, PIN ata, hizmetleri bağla</p>
      </div>

      <Card title="Yeni Personel">
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-3">
          <Input label="Ad Soyad" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
          <div className="flex items-end"><Button type="submit" className="w-full">Ekle</Button></div>
        </form>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {employees.map(emp => {
          const assignedIds = new Set((emp.employee_services || []).map(es => es.service_id))
          return (
            <Card key={emp.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-cream">{emp.name}</p>
                    {!emp.is_active && <span className="text-xs text-red-400">Pasif</span>}
                  </div>
                  {emp.phone && <p className="text-sm text-cream-muted">{emp.phone}</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                  <Button size="sm" variant="secondary" onClick={() => { setPinModal(emp); setPin(''); setPinMsg('') }}>
                    PIN
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(emp)}>
                    {emp.is_active ? 'Pasif' : 'Aktif'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(emp.id)}>Sil</Button>
                </div>
              </div>

              {services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {services.map(svc => {
                    const on = assignedIds.has(svc.id)
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(emp.id, svc.id, on)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          on ? 'border-gold/50 bg-gold/15 text-gold' : 'border-gold/20 text-cream-muted'
                        }`}
                      >
                        {svc.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-4">
          <div className="glass w-full max-w-sm rounded-xl p-6">
            <h3 className="font-display text-lg text-cream">PIN Ata — {pinModal.name}</h3>
            <Input
              className="mt-4"
              label="PIN (4-8 karakter)"
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              minLength={4}
              maxLength={8}
            />
            {pinMsg && <p className="mt-2 text-sm text-emerald-400">{pinMsg}</p>}
            <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
              <Button variant="secondary" onClick={() => setPinModal(null)}>İptal</Button>
              <Button onClick={savePin} disabled={pin.length < 4}>Kaydet</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
