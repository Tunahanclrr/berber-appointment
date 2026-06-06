import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { formatPrice } from '../lib/time'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'

const DURATIONS = [15, 30, 45, 60, 90, 120]

export default function Services() {
  const { shop } = useShop()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('services').select('*').eq('shop_id', shop.id).order('name')
    setServices(data || [])
    setLoading(false)
  }

  useEffect(() => { if (shop) load() }, [shop])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Hizmet adı gerekli.')
    const { error: err } = await supabase.from('services').insert({
      shop_id: shop.id,
      name: name.trim(),
      duration: parseInt(duration, 10),
      price: price ? parseFloat(price) : null,
    })
    if (err) setError(err.message)
    else { setName(''); setPrice(''); await load() }
  }

  async function handleDelete(id) {
    if (!confirm('Silmek istediğine emin misin?')) return
    await supabase.from('services').delete().eq('id', id)
    await load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">Hizmetler</h1>
        <p className="text-cream-muted">Sunduğun hizmetleri tanımla</p>
      </div>

      <Card title="Yeni Hizmet">
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Hizmet Adı" value={name} onChange={e => setName(e.target.value)} required />
          <Select label="Süre" value={duration} onChange={e => setDuration(e.target.value)}>
            {DURATIONS.map(d => <option key={d} value={d}>{d} dk</option>)}
          </Select>
          <Input label="Fiyat (₺)" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
          <div className="flex items-end"><Button type="submit" className="w-full">Ekle</Button></div>
        </form>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(svc => (
          <Card key={svc.id}>
            <div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-cream">{svc.name}</p>
                <p className="mt-1 text-sm text-cream-muted">
                  <span className="font-mono">{svc.duration} dk</span> · {formatPrice(svc.price)}
                </p>
              </div>
              <Button variant="danger" size="sm" className="min-[380px]:self-start" onClick={() => handleDelete(svc.id)}>Sil</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
