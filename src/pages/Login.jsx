import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import BrandLogo from '../components/BrandLogo'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials' 
          ? 'E-posta veya şifre hatalı.' 
          : err.message
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08)_0%,_transparent_60%)]" />
      
      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Link to="/" className="flex min-w-0 items-center gap-2"><BrandLogo size="md" /></Link>
        <Link to="/register" className="text-sm text-cream-muted transition hover:text-gold sm:text-base">
          Hesabın yok mu? Kayıt ol
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-2xl p-5 sm:p-8 md:p-12">
            <div className="mb-8">
              <h1 className="font-display text-3xl font-bold text-cream">Dükkan Girişi</h1>
              <p className="mt-2 text-cream-muted">
                E-posta ve şifrenizle panele giriş yapın
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cream mb-2">E-posta</label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="you@example.com"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-2">Şifre</label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
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
                  {error}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-6" 
                disabled={submitting}
              >
                {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>

              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gold/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-navy text-cream-muted">veya</span>
                </div>
              </div>

              <Link to="/staff/login">
                <Button variant="secondary" className="w-full">
                  Personel Girişi (PIN)
                </Button>
              </Link>
            </form>

            <div className="mt-8 p-4 rounded-lg bg-gold/5 border border-gold/20">
              <p className="text-sm text-cream-muted">
                <span className="text-gold font-semibold">Şifreni mi unuttun?</span>
                <br />
                destek@randevuzamani.com ile iletişime geç
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-cream-muted mb-4">Dükkanın yok mu?</p>
            <Link to="/register">
              <Button className="w-full">
                Şimdi Dükkan Aç
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

