import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, Check, MessageCircle, Scissors, Sparkles, UserRound, WalletCards } from 'lucide-react'
import Button from '../components/ui/Button'
import BrandLogo from '../components/BrandLogo'
import SEO from '../components/SEO'

const whatsappUrl = 'https://wa.me/905551659502?text=Merhaba%2C%20Randevu%20Zaman%C4%B1%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum'

const landingStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Randevu Zamanı',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Berberler, kuaförler, güzellik salonları ve tırnak/kirpik stüdyoları için online randevu, personel ve gün sonu tahsilat yönetimi.',
  offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
}

const features = [
  { title: 'Akıllı randevu akışı', desc: 'Müşteriler müsait saatleri görür, uygun personeli seçer ve hızla randevu oluşturur.' },
  { title: 'Personel paneli', desc: 'Her personel kendi randevularını telefondan takip eder, durumları kolayca günceller.' },
  { title: 'Gün sonu kasa ve hakediş', desc: 'Nakit, kart ve IBAN tahsilatını randevu bazında kaydet; personel hakediş yüzdesini ve alacağını otomatik gör.' },
  { title: 'Anlık bildirimler', desc: 'Yeni randevular personele bildirim olarak düşer, yoğun saatlerde takip kolaylaşır.' },
  { title: 'Net işletme özeti', desc: 'Günlük randevu, doluluk ve müşteri hareketlerini sade bir panelden izlersin.' },
  { title: 'Hizmet ve fiyat yönetimi', desc: 'Süre, fiyat ve hizmetleri düzenleyip tüm randevu akışını buna göre yönetirsin.' },
  { title: 'Mobil uyumlu deneyim', desc: 'İşletme sahibi, personel ve müşteri için telefonda rahat kullanılan ekranlar.' },
]

export const pricingPlans = [
  { name: 'Tek Kişi', subtitle: '1 personel / tek koltuk', price: '449 TL/ay', note: 'Yıllık ödemede 3.990 TL — %26 indirim', cta: 'İletişime Geç' },
  { name: 'Salon', subtitle: '2-4 personel', price: '799 TL/ay', note: 'Yıllık ödemede 7.990 TL — %17 indirim', cta: 'İletişime Geç', recommended: true },
  { name: 'Pro Salon', subtitle: '5+ personel', price: 'Özel teklif', note: "Yıllık 9.990 TL'den başlar", cta: 'Teklif Al' },
]

const planFeatures = ['Online randevu linki', 'Personel bildirimleri', 'Gün sonu kasa ve hakediş', 'WhatsApp şablonları']

export default function Landing() {
  const roles = [
    { title: 'Dükkan Oluştur', desc: 'Dükkan kaydı için bizimle iletişime geç. Kurulumu veritabanı üzerinden biz tamamlayalım.', to: '/iletisim', cta: 'İletişime Geç' },
    { title: 'Personel', desc: 'PIN ile giriş yap, kendi programını ve yeni randevuları takip et.', to: '/staff/login', cta: 'Personel Girişi' },
    { title: 'Müşteri', desc: 'Dükkan adını bul, müsait saatlerden birini seç ve randevunu oluştur. Mevcut randevunu kodunla yönetebilirsin.', to: '/book', cta: 'Randevu Al', secondaryTo: '/appointment', secondaryCta: 'Randevumu Yönet' },
  ]
  const sectors = [
    [Scissors, 'Berber'],
    [Sparkles, 'Kuaför'],
    [Sparkles, 'Güzellik Salonu'],
    [UserRound, 'Tırnak & Kirpik Stüdyosu'],
  ]

  return (
    <div className="min-h-screen bg-navy text-cream">
      <SEO structuredData={landingStructuredData} />
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3"><BrandLogo size="md" /></Link>
        <div className="flex flex-wrap gap-2">
          <Link to="/appointment"><Button variant="ghost" size="sm">Randevumu Yönet</Button></Link>
          <Link to="/login"><Button variant="secondary" size="sm">Dükkan Girişi</Button></Link>
          <Link to="/iletisim"><Button variant="primary" size="sm">İletişime Geç</Button></Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-8 sm:px-6 sm:pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-14">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="inline-flex rounded-full border border-gold/20 bg-blue-50 px-4 py-2 text-sm font-semibold text-gold">İşletmen için modern takip sistemi</p>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-tight tracking-tight text-cream sm:text-5xl lg:text-6xl">Randevularını, ekibini ve gün sonu hesabını tek yerden yönet</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-cream-muted sm:text-lg">Müşteri randevusu, personel programı, hizmet süreleri, gün sonu tahsilat ve bildirimler tek yerde. Açık, hızlı ve telefonda rahat kullanılan bir panel.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {sectors.map(([Icon, name]) => <span key={name} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-cream-muted"><Icon className="h-3.5 w-3.5 text-gold" />{name}</span>)}
            </div>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <Link to="/iletisim"><Button size="lg" className="w-full min-[420px]:w-auto">Ücretsiz Kurulum İçin İletişime Geç</Button></Link>
              <Link to="/book"><Button variant="secondary" size="lg" className="w-full min-[420px]:w-auto">Demo Randevu Al</Button></Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="lg" className="w-full min-[420px]:w-auto"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp'tan Yaz</Button></a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="rounded-2xl border border-gold/10 bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-cream">Bugünün Akışı</p><p className="text-xs text-cream-muted">Canlı randevu özeti</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span></div>
              <div className="mt-5 space-y-3">{[['09:30', 'Sakal kesimi', 'Onaylandı'], ['10:00', 'Saç kesimi', 'Yeni'], ['11:30', 'Bakım paketi', 'Bildirim gitti']].map(([time, service, status]) => <div key={time} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 shadow-sm"><div><p className="font-mono text-sm font-semibold text-gold">{time}</p><p className="text-sm font-semibold text-cream">{service}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-gold">{status}</span></div>)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[['18', 'Randevu'], ['86%', 'Doluluk'], ['4.9', 'Puan']].map(([value, label]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="font-display text-xl font-extrabold text-cream">{value}</p><p className="mt-1 text-xs text-cream-muted">{label}</p></div>)}</div>
            <p className="mt-3 text-center text-xs text-slate-400">Örnek panel görünümü</p>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8"><div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-blue-50 px-4 py-2 text-sm font-semibold text-gold"><BadgeCheck className="h-4 w-4" />İlk 30 gün koşulsuz iade — memnun kalmazsan ücretini geri al.</div></section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8"><div className="grid gap-4 md:grid-cols-3">{roles.map((role, index) => <motion.article key={role.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 * index }} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-gold/30 hover:shadow-xl hover:shadow-blue-100/70"><div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[48px] bg-blue-50 transition group-hover:bg-blue-100" /><div className="relative"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-sm font-bold text-white">{index + 1}</span><h3 className="mt-5 font-display text-xl font-extrabold text-cream">{role.title}</h3><p className="mt-2 min-h-16 text-sm leading-6 text-cream-muted">{role.desc}</p><div className="mt-5 grid gap-2"><Link to={role.to} className="block"><Button variant="secondary" className="w-full">{role.cta}</Button></Link>{role.secondaryTo && <Link to={role.secondaryTo} className="block"><Button variant="ghost" className="w-full">{role.secondaryCta}</Button></Link>}</div></div></motion.article>)}</div></section>

        <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 text-center sm:grid-cols-3 sm:px-6 lg:px-8">{[['24/7', 'Online randevu'], ['Mobil', 'Personel kullanımı'], ['Anlık', 'Bildirim takibi']].map(([value, label]) => <div key={label} className="rounded-xl bg-slate-50 p-5"><p className="font-display text-3xl font-extrabold text-gold">{value}</p><p className="mt-1 text-sm font-medium text-cream-muted">{label}</p></div>)}</div></section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="max-w-2xl"><h2 className="font-display text-3xl font-extrabold tracking-tight text-cream sm:text-4xl">İşini kolaylaştıran araçlar</h2><p className="mt-3 leading-7 text-cream-muted">Karmaşık ekranlar yerine, gün içinde gerçekten ihtiyacın olan bilgiler.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(feature => <article key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-display text-lg font-bold text-cream">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-cream-muted">{feature.desc}</p></article>)}</div></section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8"><div className="text-center"><h2 className="font-display text-3xl font-extrabold tracking-tight text-cream sm:text-4xl">İşletmene uygun paketi seç</h2><p className="mx-auto mt-3 max-w-3xl leading-7 text-cream-muted">Tüm paketlerde randevu, personel takibi ve gün sonu kasa yönetimi var. Fark, personel sayın ve ihtiyacın olan destek seviyesi.</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{pricingPlans.map(plan => <article key={plan.name} className={`relative rounded-2xl border bg-white p-6 shadow-sm ${plan.recommended ? 'border-gold ring-1 ring-gold/40' : 'border-slate-200'}`}>{plan.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-xs font-bold text-white">En çok tercih edilen</span>}<p className="font-display text-2xl font-extrabold text-cream">{plan.name}</p><p className="mt-2 text-sm text-cream-muted">{plan.subtitle}</p><p className="mt-6 font-display text-3xl font-extrabold text-gold">{plan.price}</p><p className="mt-2 min-h-10 text-xs leading-5 text-cream-muted">{plan.note}</p><ul className="mt-6 space-y-3">{planFeatures.map(item => <li key={item} className="flex items-center gap-2 text-sm text-cream-muted"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul><Link to="/iletisim" className="mt-7 block"><Button variant={plan.recommended ? 'primary' : 'secondary'} className="w-full">{plan.cta}</Button></Link></article>)}</div><div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-gold/20 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-gold"><WalletCards className="h-4 w-4 shrink-0" />İlk 20 işletmeye özel: Tek Kişi paketi ilk yıl 2.990 TL</div></section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8"><div className="rounded-2xl border border-gold/10 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-gold">Dükkan kaydı</p><h2 className="mt-2 font-display text-2xl font-extrabold text-cream">Dükkan oluşturmak için iletişime geçin</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-cream-muted">Yeni dükkan kurulumlarını manuel yapıyoruz. Telefonla, WhatsApp veya Instagram üzerinden ulaş, kaydını hazırlayalım.</p></div><div className="flex flex-col gap-3 min-[420px]:flex-row md:shrink-0"><a href="tel:+905551659502"><Button className="w-full min-[420px]:w-auto">0555 165 95 02</Button></a><a href={whatsappUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="w-full min-[420px]:w-auto"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp'tan Yaz</Button></a><a href="https://www.instagram.com/randevuzamani" target="_blank" rel="noreferrer"><Button variant="ghost" className="w-full min-[420px]:w-auto">@randevuzamani</Button></a></div></div></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-cream-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>© 2026 Randevu Zamanı. Tüm hakları saklıdır.</p><div className="flex flex-wrap gap-x-4 gap-y-2"><Link to="/gizlilik-politikasi" className="hover:text-gold">Gizlilik Politikası</Link><Link to="/kvkk-aydinlatma" className="hover:text-gold">KVKK Aydınlatma Metni</Link><span>0555 165 95 02 · @randevuzamani</span></div></div></footer>
    </div>
  )
}
