import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useShop } from '../hooks/useShop'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slots'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Loading from '../components/ui/Loading'

export default function ShopSetup() {
  const { user, session } = useAuth()
  const { shop, loading: shopLoading, fetchShop } = useShop()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null
  if (shopLoading) return <Loading />
  if (shop) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Dükkan adı gerekli.')
    if (!session) return setError('Oturum aktif değil. Çıkış yapıp tekrar giriş yap.')

    setSubmitting(true)
    try {
      const { error: err } = await supabase.from('shops').insert({
        name: name.trim(),
        slug: slugify(name),
        owner_id: user.id,
      })
      if (err) throw new Error(err.message)
      await fetchShop()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message.includes('row-level security')
        ? 'Yetki hatası: Oturum geçersiz veya e-posta doğrulaması bekleniyor.'
        : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy px-4 py-8">
      <form onSubmit={handleSubmit} className="glass w-full max-w-md space-y-4 rounded-xl p-5 sm:p-6">
        <h1 className="font-display text-xl font-bold text-cream">Dükkanını Oluştur</h1>
        <Input label="Dükkan Adı" value={name} onChange={e => setName(e.target.value)} required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
        </Button>
      </form>
    </div>
  )
}
