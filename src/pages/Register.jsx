import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slots'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import BrandLogo from '../components/BrandLogo'

export default function Register() {
  const { user, loading, signUp } = useAuth()
  const navigate = useNavigate()
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!shopName.trim()) return setError('Dükkan adı gerekli.')
    if (email.trim().length === 0) return setError('E-posta gerekli.')
    if (password.length < 6) return setError('Şifre en az 6 karakter olmalı.')
    if (password !== confirm) return setError('Şifreler eşleşmiyor.')

    setSubmitting(true)
    try {
      const { session, user: newUser } = await signUp(email, password)

      if (!session) {
        setInfo('Kayıt başarılı! E-posta doğrulaması için gelen kutunu kontrol et. Ardından giriş yap.')
        setTimeout(() => navigate('/login'), 2000)
        setSubmitting(false)
        return
      }

      const slug = slugify(shopName)
      const { error: shopErr } = await supabase.from('shops').insert({
        name: shopName.trim(),
        slug,
        owner_id: newUser.id,
      })

      if (shopErr) throw new Error(shopErr.message)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message.includes('already registered')
        ? 'Bu e-posta zaten kayıtlı.'
        : err.message.includes('invalid_grant')
        ? 'E-posta veya şifre hatalı.'
        : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08)_0%,_transparent_60%)]" />
      
      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Link to="/" className="flex min-w-0 items-center gap-2"><BrandLogo size="md" /></Link>
        <Link to="/login" className="text-sm text-cream-muted transition hover:text-gold sm:text-base">
          Zaten hesabın var mı? Giriş yap
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <div className="glass rounded-2xl p-5 sm:p-8 md:p-12">
            <div className="mb-8">
              <h1 className="font-display text-3xl font-bold text-cream">Dükkanını Aç</h1>
              <p className="mt-2 text-cream-muted">
                Hızlı ve kolay. E-posta, şifre ile kaydol.
                <br />
                <span className="text-gold">İlk 3 ay tamamen ücretsiz!</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cream mb-2">Dükkan Adı *</label>
                <Input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="örn: Usta Ali'nin Berberesi"
                  required
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-cream-muted">
                  Müşterilerinize gösterilecek dükkan adı
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">E-posta *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-cream-muted">
                  Giriş ve bildirimler için kullanılacak
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">Şifre *</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-cream-muted">
                  En az 6 karakter
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">Şifre Tekrar *</label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••"
                  required
                  disabled={submitting}
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  ❌ {error}
                </motion.div>
              )}
              
              {info && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                >
                  ✅ {info}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-6" 
                disabled={submitting}
              >
                {submitting ? 'Dükkan açılıyor...' : '🚀 Dükkanını Aç'}
              </Button>

              <div className="mt-6 p-4 rounded-lg bg-gold/5 border border-gold/20">
                <p className="text-sm text-cream-muted">
                  <span className="text-gold font-semibold">✓</span> Kredi kartı gerekmez<br />
                  <span className="text-gold font-semibold">✓</span> 3 ay ücretsiz<br />
                  <span className="text-gold font-semibold">✓</span> 5 dakikada kurulum
                </p>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-cream-muted mb-4">Müşteri randevu almak için mi geldin?</p>
            <Link to="/book">
              <Button variant="secondary" className="w-full">
                Randevu Al
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

