import { Link, useLocation } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import Button from '../components/ui/Button'

export default function LegalPlaceholder() {
  const { pathname } = useLocation()
  const isPrivacy = pathname === '/gizlilik-politikasi'
  const title = isPrivacy ? 'Gizlilik Politikası' : 'KVKK Aydınlatma Metni'

  return (
    <main className="min-h-screen bg-navy px-4 py-8 text-cream sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex"><BrandLogo size="md" /></Link>
        <article className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-gold">Randevu Zamanı</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-cream">{title}</h1>
          <p className="mt-5 leading-7 text-cream-muted">Bu sayfanın ayrıntılı metni hazırlanmaktadır. Soruların için bizimle iletişime geçebilirsin.</p>
          <Link to="/iletisim" className="mt-7 inline-block"><Button>İletişime Geç</Button></Link>
        </article>
      </div>
    </main>
  )
}
