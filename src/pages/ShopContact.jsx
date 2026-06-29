import { Link } from 'react-router-dom'
import { Camera, MessageCircle, Phone } from 'lucide-react'
import Button from '../components/ui/Button'
import BrandLogo from '../components/BrandLogo'
import Card from '../components/ui/Card'

const phoneDisplay = '0555 165 95 02'
const whatsappUrl = 'https://wa.me/905551659502?text=Merhaba%2C%20Randevu%20Zamani%20icin%20dukkan%20olusturmak%20istiyorum.'
const instagramUrl = 'https://www.instagram.com/randevuzamani'

export default function ShopContact() {
  return (
    <div className="flex min-h-dvh flex-col bg-navy">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link to="/" className="min-w-0">
          <BrandLogo size="md" />
        </Link>
        <Link to="/login" className="text-sm text-cream-muted transition hover:text-gold">
          Dukkan girisi
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <Phone className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold text-cream">
            Dukkan olusturmak icin iletisime gecin
          </h1>
          <p className="mt-3 text-sm leading-6 text-cream-muted">
            Yeni dukkan kayitlarini manuel yapiyoruz. WhatsApp veya Instagram uzerinden ulasin, kurulumu sizin icin hazirlayalim.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button className="w-full">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </Button>
            </a>
            <a href={instagramUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="w-full">
                <Camera className="h-4 w-4" aria-hidden="true" />
                Instagram
              </Button>
            </a>
          </div>

          <div className="mt-6 rounded-xl border border-gold/10 bg-gold/5 p-4 text-left">
            <p className="text-sm text-cream-muted">Telefon</p>
            <a href="tel:+905551659502" className="mt-1 block font-mono text-lg font-semibold text-gold">
              {phoneDisplay}
            </a>
            <p className="mt-4 text-sm text-cream-muted">Instagram</p>
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="mt-1 block font-semibold text-gold">
              @randevuzamani
            </a>
          </div>

          <div className="mt-6">
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                Zaten hesabim var, giris yap
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  )
}
