import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import BrandLogo from '../components/BrandLogo'

export default function BookSlugEntry() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Search for shops by name or slug
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length === 0) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const { data } = await supabase
          .from('shops')
          .select('id, name, slug')
          .or(
            `name.ilike.%${search}%,slug.ilike.%${search}%`
          )
          .limit(10)

        setResults(data || [])
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  function handleSelectShop(slug) {
    navigate(`/book/${slug}`)
  }

  return (
    <div className="min-h-screen bg-navy">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08)_0%,_transparent_60%)]" />
      
      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Link to="/" className="flex min-w-0 items-center gap-2"><BrandLogo size="md" /></Link>
        <Link to="/staff/login" className="text-sm text-cream-muted transition hover:text-gold sm:text-base">
          Personel misin?
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[70dvh] items-center justify-center px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-cream sm:text-4xl md:text-5xl">
              Randevu Al
            </h1>
            <p className="mt-3 text-base text-cream-muted sm:text-lg">
              Berberinizin adını yazın ve müsait saatleri görün
            </p>
          </div>

          <div className="glass relative rounded-2xl p-5 sm:p-8">
            <div>
              <label className="block text-sm font-medium text-cream mb-3">
                Berber / Dükkan Adı
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="örn: Usta Ali'nin Berberesi veya ali-berber"
                  autoFocus
                  className="w-full"
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-gold border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {search && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 space-y-3 max-h-80 overflow-y-auto"
                >
                  <p className="text-xs text-cream-muted uppercase tracking-wide font-semibold">
                    {results.length} Sonuç Bulundu
                  </p>
                  {results.map((shop) => (
                    <motion.button
                      key={shop.id}
                      whileHover={{ x: 4 }}
                      onClick={() => handleSelectShop(shop.slug)}
                      className="group w-full rounded-lg border border-gold/20 bg-gold/5 p-4 text-left transition hover:border-gold/40 hover:bg-gold/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-cream group-hover:text-gold transition">
                            {shop.name}
                          </h3>
                          <p className="text-sm text-cream-muted mt-1">
                            {shop.slug}
                          </p>
                        </div>
                        <span className="text-xl group-hover:translate-x-1 transition">→</span>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {search && loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 text-center text-cream-muted"
                >
                  <p className="text-sm">Aranıyor...</p>
                </motion.div>
              )}

              {search && !loading && results.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 text-center"
                >
                  <p className="text-cream-muted mb-4">
                    "✂️ {search}" için sonuç bulunamadı
                  </p>
                  <p className="text-sm text-cream-muted">
                    Dükkanın tam adını yazarak tekrar deneyin
                  </p>
                </motion.div>
              )}

              {!search && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 space-y-4"
                >
                  <div className="p-4 rounded-lg bg-gold/5 border border-gold/20">
                    <p className="text-sm text-cream-muted">
                      <span className="block font-semibold text-gold mb-2">Hızlı Randevu Alma</span>
                      Dükkanının ya da berberinizin adını yazıp arayabilirsiniz. 
                      Bulduğunuzda müsait saatleri göreceksiniz.
                    </p>
                  </div>

                  <div className="text-center py-8 text-cream-muted text-sm">
                    <p>Hiç bir dükkan adı mı bilmiyorsun?</p>
                    <Link to="/" className="text-gold hover:underline mt-2 inline-block">
                      Ana sayfaya dön
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 text-center">
            <p className="text-cream-muted text-sm mb-4">
              Dükkan sahibi misin?
            </p>
            <Link to="/iletisim">
              <Button variant="secondary" className="w-full">
                Iletisime Gec
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

