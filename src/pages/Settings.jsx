import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../hooks/useShop'
import { DEFAULT_HOURS, slugify } from '../lib/slots'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Loading from '../components/ui/Loading'

const DAYS = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Sali' },
  { key: 'wednesday', label: 'Carsamba' },
  { key: 'thursday', label: 'Persembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
]

export default function Settings() {
  const { shop, fetchShop } = useShop()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shop) return
    setName(shop.name)
    setSlug(shop.slug || '')
    setHours(shop.working_hours || DEFAULT_HOURS)
    setWhatsappPhone(shop.working_hours?.whatsapp?.phone || '')
  }, [shop])

  if (!shop) return <Loading />

  const bookingUrl = `${window.location.origin}/book/${slug}`
  const staffUrl = `${window.location.origin}/staff/login/${slug}`

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const nextHours = {
      ...hours,
      whatsapp: {
        ...(hours.whatsapp || {}),
        phone: whatsappPhone.trim(),
      },
    }

    const { error: err } = await supabase
      .from('shops')
      .update({ name: name.trim(), slug: slug.trim(), working_hours: nextHours })
      .eq('id', shop.id)

    if (err) {
      setError(err.message)
    } else {
      setMessage('Ayarlar kaydedildi.')
      await fetchShop()
    }
    setSaving(false)
  }

  function updateHours(key, field, value) {
    setHours(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">Ayarlar</h1>
        <p className="text-cream-muted">Dukkan bilgileri, WhatsApp ve calisma saatleri</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card title="Dukkan Bilgileri">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Dukkan Adi" value={name} onChange={e => setName(e.target.value)} required />
            <div>
              <Input label="Slug (URL)" value={slug} onChange={e => setSlug(e.target.value)} required />
              <button
                type="button"
                onClick={() => setSlug(slugify(name))}
                className="mt-1 text-xs text-gold hover:underline"
              >
                Otomatik olustur
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-cream-muted">Musteri randevu linki</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-navy px-3 py-2 text-xs text-gold">{bookingUrl}</code>
              <Button type="button" size="sm" onClick={() => navigator.clipboard.writeText(bookingUrl)}>Kopyala</Button>
            </div>
            <p className="text-sm text-cream-muted">Personel giris linki</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-navy px-3 py-2 text-xs text-gold">{staffUrl}</code>
              <Button type="button" size="sm" onClick={() => navigator.clipboard.writeText(staffUrl)}>Kopyala</Button>
            </div>
          </div>
        </Card>

        <Card title="WhatsApp Baglantisi">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="WhatsApp Numarasi"
              value={whatsappPhone}
              onChange={e => setWhatsappPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
            />
            <div className="rounded-lg border border-gold/10 bg-gold/5 p-4 text-sm text-cream-muted">
              Business API olmadan otomatik arka plan mesaji gonderilmez. Bu alan randevu kartlarinda tek tikla WhatsApp acip hazir mesaj gondermek icin kullanilir.
            </div>
          </div>
        </Card>

        <Card title="Calisma Saatleri">
          <div className="space-y-3">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="grid gap-3 rounded-lg border border-gold/10 p-3 sm:flex sm:flex-wrap sm:items-center">
                <label className="flex w-full items-center gap-2 text-sm text-cream sm:w-28">
                  <input
                    type="checkbox"
                    checked={hours[key]?.open ?? false}
                    onChange={e => updateHours(key, 'open', e.target.checked)}
                    className="accent-gold"
                  />
                  {label}
                </label>
                {hours[key]?.open && (
                  <>
                    <input
                      type="time"
                      value={hours[key]?.start || '09:00'}
                      onChange={e => updateHours(key, 'start', e.target.value)}
                      className="min-h-11 w-full rounded border border-gold/20 bg-navy-light px-2 py-2 text-base text-cream sm:w-auto sm:text-sm"
                    />
                    <span className="hidden text-cream-muted sm:inline">-</span>
                    <input
                      type="time"
                      value={hours[key]?.end || '20:00'}
                      onChange={e => updateHours(key, 'end', e.target.value)}
                      className="min-h-11 w-full rounded border border-gold/20 bg-navy-light px-2 py-2 text-base text-cream sm:w-auto sm:text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </form>
    </div>
  )
}
