import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../components/ui/Button'
import BrandLogo from '../components/BrandLogo'

export default function Landing() {
  const features = [
    { title: 'Akilli randevu akisi', desc: 'Musteriler musait saatleri gorur, uygun personeli secer ve hizlica randevu olusturur.' },
    { title: 'Personel paneli', desc: 'Her personel kendi randevularini telefondan takip eder, durumlari kolayca gunceller.' },
    { title: 'Anlik bildirimler', desc: 'Yeni randevular personele bildirim olarak duser, yogun saatlerde takip kolaylasir.' },
    { title: 'Net isletme ozeti', desc: 'Gunluk randevu, doluluk ve musteri hareketlerini sade bir panelden izlersin.' },
    { title: 'Hizmet ve fiyat yonetimi', desc: 'Sure, fiyat ve hizmetleri duzenleyip tum randevu akisini buna gore yonetirsin.' },
    { title: 'Mobil uyumlu deneyim', desc: 'Dukkan sahibi, personel ve musteri icin telefonda rahat kullanilan ekranlar.' },
  ]

  const roles = [
    {
      title: 'Dukkan Sahibi',
      desc: 'Randevulari, personeli, hizmetleri ve musteri linkini tek panelden yonet.',
      to: '/login',
      cta: 'Panele Gir',
    },
    {
      title: 'Personel',
      desc: 'PIN ile giris yap, kendi programini ve yeni randevulari takip et.',
      to: '/staff/login',
      cta: 'Personel Girisi',
    },
    {
      title: 'Musteri',
      desc: 'Dukkan adini bul, musait saatlerden birini sec ve randevunu olustur.',
      to: '/book',
      cta: 'Randevu Al',
    },
  ]

  return (
    <div className="min-h-screen bg-navy text-cream">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <BrandLogo size="md" />
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link to="/login">
            <Button variant="secondary" size="sm">Dukkan Girisi</Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">Dukkan Ac</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="inline-flex rounded-full border border-gold/20 bg-blue-50 px-4 py-2 text-sm font-semibold text-gold">
              Berberler ve randevulu calisan isletmeler icin modern takip sistemi
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-tight tracking-tight text-cream sm:text-5xl lg:text-6xl">
              Randevu Zamanı ile gunluk akisini daha net yonet.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-cream-muted sm:text-lg">
              Musteri randevusu, personel programi, hizmet sureleri ve bildirimler tek yerde.
              Acik, hizli ve telefonda rahat kullanilan bir panel.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row">
              <Link to="/register">
                <Button size="lg" className="w-full min-[420px]:w-auto">Hemen Basla</Button>
              </Link>
              <Link to="/book">
                <Button variant="secondary" size="lg" className="w-full min-[420px]:w-auto">Demo Randevu Al</Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="rounded-2xl border border-gold/10 bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-6"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cream">Bugunun Akisi</p>
                  <p className="text-xs text-cream-muted">Canli randevu ozeti</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ['09:30', 'Sakal kesimi', 'Onaylandi'],
                  ['10:00', 'Sac kesimi', 'Yeni'],
                  ['11:30', 'Bakim paketi', 'Bildirim gitti'],
                ].map(([time, service, status]) => (
                  <div key={time} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 shadow-sm">
                    <div>
                      <p className="font-mono text-sm font-semibold text-gold">{time}</p>
                      <p className="text-sm font-semibold text-cream">{service}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-gold">{status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ['18', 'Randevu'],
                ['86%', 'Doluluk'],
                ['4.9', 'Puan'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="font-display text-xl font-extrabold text-cream">{value}</p>
                  <p className="mt-1 text-xs text-cream-muted">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {roles.map((role, index) => (
              <motion.article
                key={role.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 * index }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-gold/30 hover:shadow-xl hover:shadow-blue-100/70"
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[48px] bg-blue-50 transition group-hover:bg-blue-100" />
                <div className="relative">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-extrabold text-cream">{role.title}</h3>
                  <p className="mt-2 min-h-16 text-sm leading-6 text-cream-muted">{role.desc}</p>
                  <Link to={role.to} className="mt-5 block">
                    <Button variant={index === 0 ? 'primary' : 'secondary'} className="w-full">
                      {role.cta}
                    </Button>
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 text-center sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              ['24/7', 'Online randevu'],
              ['Mobil', 'Personel kullanimi'],
              ['Anlik', 'Bildirim takibi'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-5">
                <p className="font-display text-3xl font-extrabold text-gold">{value}</p>
                <p className="mt-1 text-sm font-medium text-cream-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-cream sm:text-4xl">Isini kolaylastiran araclar</h2>
            <p className="mt-3 leading-7 text-cream-muted">Karmasik ekranlar yerine, gun icinde gercekten ihtiyacin olan bilgiler.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(feature => (
              <article key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-display text-lg font-bold text-cream">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-cream-muted">{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-cream-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 Randevu Zamanı. Tum haklari saklidir.</p>
          <p>destek@randevuzamani.com</p>
        </div>
      </footer>
    </div>
  )
}
