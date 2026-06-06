import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useStaffStore } from '../../store/staffStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

export default function StaffLogin() {
  const { slug: urlSlug } = useParams()
  const navigate = useNavigate()
  const setSession = useStaffStore(s => s.setSession)

  const [shopSearch, setShopSearch] = useState(urlSlug || '')
  const [shopResults, setShopResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  
  const [shop, setShop] = useState(null)
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Search for shops
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (shopSearch.trim().length === 0) {
        setShopResults([])
        return
      }

      setSearchLoading(true)
      try {
        const { data } = await supabase
          .from('shops')
          .select('id, name, slug')
          .or(
            `name.ilike.%${shopSearch}%,slug.ilike.%${shopSearch}%`
          )
          .limit(10)

        setShopResults(data || [])
      } catch (err) {
        console.error('Search error:', err)
        setShopResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [shopSearch])

  async function selectShop(selectedShop) {
    setShop(selectedShop)
    setShopSearch(selectedShop.name)
    setShopResults([])
    setError('')
    setEmployeeId('')
    setPin('')

    try {
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name')
        .eq('shop_id', selectedShop.id)
        .eq('is_active', true)
        .order('name')
      
      setEmployees(empData || [])
    } catch (err) {
      setError('Personel yüklenirken hata oluştu: ' + err.message)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!shop || !employeeId || !pin) {
      setError('Tüm alanları doldurunuz.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { data, error: err } = await supabase.rpc('employee_login', {
        emp_id: employeeId,
        raw_pin: pin,
      })

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      const result = data?.[0]
      if (!result?.success) {
        setError('PIN hatalı veya personel aktif değil.')
        setLoading(false)
        return
      }

      setSession({ ...result, employee_id: employeeId })
      navigate('/staff/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08)_0%,_transparent_60%)]" />
      
      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="text-3xl">✂️</span>
          <span className="truncate font-display text-xl font-bold text-cream sm:text-2xl">BerberRandevu</span>
        </Link>
        <Link to="/book" className="text-sm text-cream-muted transition hover:text-gold sm:text-base">
          Müşteri misin?
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
            <h1 className="font-display text-3xl font-bold text-cream">Personel Girişi</h1>
            <p className="mt-2 text-cream-muted">PIN ile giriş yapın</p>

            {!shop ? (
              <div className="mt-8">
                <label className="block text-sm font-medium text-cream mb-3">Dükkan Adı</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={shopSearch}
                    onChange={e => setShopSearch(e.target.value)}
                    placeholder="örn: Usta Ali'nin Berberesi"
                    autoFocus
                    className="w-full"
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-gold border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {shopSearch && shopResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 space-y-2 max-h-60 overflow-y-auto"
                    >
                      {shopResults.map((s) => (
                        <motion.button
                          key={s.id}
                          type="button"
                          whileHover={{ x: 4 }}
                          onClick={() => selectShop(s)}
                          className="group w-full rounded-lg border border-gold/20 bg-gold/5 p-3 text-left transition hover:border-gold/40 hover:bg-gold/10"
                        >
                          <p className="font-semibold text-cream group-hover:text-gold transition">
                            {s.name}
                          </p>
                          <p className="text-xs text-cream-muted mt-1">{s.slug}</p>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {shopSearch && !searchLoading && shopResults.length === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 text-sm text-cream-muted text-center"
                    >
                      Sonuç bulunamadı
                    </motion.p>
                  )}
                </AnimatePresence>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div className="p-4 rounded-lg bg-gold/10 border border-gold/20">
                  <p className="text-xs text-cream-muted uppercase tracking-wide font-semibold mb-1">
                    Dükkan
                  </p>
                  <p className="text-lg font-semibold text-gold">{shop.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">Kişi</label>
                  <Select
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    required
                  >
                    <option value="">Seçiniz</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </Select>
                  {employees.length === 0 && (
                    <p className="mt-2 text-xs text-cream-muted">Aktif personel bulunamadı</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">PIN</label>
                  <Input
                    type="password"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="••••"
                    minLength={4}
                    maxLength={8}
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-cream-muted">
                    Dükkan sahibiniz tarafından verilen 4-8 haneli PIN
                  </p>
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
                  disabled={loading || !employeeId || !pin}
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Button>

                <button
                  type="button"
                  onClick={() => { 
                    setShop(null)
                    setShopSearch('')
                    setError('')
                    setEmployeeId('')
                    setPin('')
                  }}
                  className="w-full text-center text-xs text-cream-muted hover:text-gold transition py-2"
                >
                  ← Farklı dükkan seç
                </button>
              </form>
            )}

            {!shop && !shopSearch && (
              <div className="mt-8 p-4 rounded-lg bg-gold/5 border border-gold/20">
                <p className="text-sm text-cream-muted">
                  <span className="text-gold font-semibold">💡 İpucu:</span> Dükkanının adını yazın veya bölümü seçin
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-cream-muted mb-4">Dükkan sahibi misin?</p>
            <Link to="/login">
              <Button className="w-full">Dükkan Paneline Git</Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
