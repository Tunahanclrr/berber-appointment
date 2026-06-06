import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../components/ui/Button'

export default function Landing() {
  const features = [
    { icon: '⏱️', title: 'Hızlı Randevu', desc: 'Müşteriler 2 dakikada online randevu alabilir' },
    { icon: '👥', title: 'Personel Yönetimi', desc: 'Tüm personelini, PIN\'leri ve çalışma saatlerini yönet' },
    { icon: '🔔', title: 'Otomatik Bildirimler', desc: 'Müşteri ve personel otomatik sms/bildirim alırlar' },
    { icon: '📊', title: 'Analitik Dashboard', desc: 'Günlük, haftalık ve aylık istatistiklerini görüntüle' },
    { icon: '💰', title: 'Hizmet & Fiyatlandırma', desc: 'Her hizmeti personel ve fiyatlarıyla ayarla' },
    { icon: '📱', title: 'Çift Taraflı Erişim', desc: 'Müşteri ve personel mobil dostu arayüze erişir' },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-navy">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08)_0%,_transparent_60%)]" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-3xl">✂️</span>
          <span className="truncate font-display text-xl font-bold text-cream sm:text-2xl">BerberRandevu</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/login">
            <Button variant="secondary" size="sm">Dükkan Girişi</Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">Dükkan Aç</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-block rounded-full bg-gold/10 px-4 py-2 mb-6">
              <p className="text-sm text-gold">Türkiye'deki Berberler İçin #1 Çözüm</p>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-cream sm:text-5xl md:text-7xl">
              Randevu Yönetimi<br />
              <span className="text-gradient-gold">Artık Bu Kadar Kolay</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-cream-muted sm:text-xl">
              Müşterileriniz 24/7 online randevu alsın, personeliniz kendi programını yönetsin,
              siz tek panelden tüm dükkanı kontrol edin. Hiçbir yazılım tecrübesi gerekmez.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/register">
                <Button variant="primary" size="lg">30 Saniyede Başla</Button>
              </Link>
              <Link to="/book">
                <Button variant="secondary" size="lg">Demo Randevu Al</Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 grid gap-4 text-center sm:gap-8 md:grid-cols-3"
          >
            {[
              { number: '5000+', label: 'Aktif Dükkan' },
              { number: '200K+', label: 'Aylık Randevu' },
              { number: '99.9%', label: 'Uptime' },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-xl p-5 sm:p-8">
                <p className="font-display text-4xl font-bold text-gold">{stat.number}</p>
                <p className="mt-2 text-cream-muted">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="mb-4 text-center font-display text-3xl font-bold text-cream sm:text-4xl">
            Neler Sunuyoruz?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-cream-muted sm:mb-12">
            Berberinizi modern çağa taşıyan tüm araçları bir yerde bulacaksınız
          </p>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:gap-8 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature, i) => (
              <motion.div key={i} variants={item} className="glass rounded-xl p-6 hover:border-gold/40 transition">
                <span className="text-4xl">{feature.icon}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-cream">{feature.title}</h3>
                <p className="mt-2 text-sm text-cream-muted">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/20 to-gold/5 p-5 text-center sm:p-12"
          >
            <h3 className="font-display text-2xl font-bold text-cream sm:text-3xl">
              Dükkanını Şimdi Aç
            </h3>
            <p className="mx-auto mt-4 max-w-2xl text-base text-cream-muted sm:text-lg">
              İlk 3 ay tamamen ücretsiz. Kredi kartı bilgisi istenmez. 
              Müşteriler hemen randevu almaya başlasın.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/register">
                <Button variant="primary" size="lg">Ücretsiz Başla</Button>
              </Link>
              <Link to="/">
                <Button variant="secondary" size="lg">Detaylı Bilgi</Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* User Roles */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="mb-10 text-center font-display text-3xl font-bold text-cream sm:mb-12 sm:text-4xl">
            Her Biriniz İçin Ayrı Giriş
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid gap-4 sm:gap-8 md:grid-cols-3"
          >
            {[
              {
                icon: '🏪',
                title: 'Dükkan Sahibi',
                desc: 'E-posta ve şifrenizle giriş yapın. Personel, hizmet, randevu ve istatistikleri tek yerden yönetin.',
                features: ['Personel yönetimi', 'Hizmet fiyatlandırması', 'Müşteri takibi', 'İstatistikler'],
                to: '/login',
                cta: 'Panele Giriş',
                primary: true,
              },
              {
                icon: '👤',
                title: 'Personel',
                desc: '4 haneli PIN ile giriş yapın. Bugün ve yarınki randevularınızı görüp durumlarını güncelleyin.',
                features: ['Kişisel takvim', 'Randevu detayları', 'Durumları güncelle', 'Müşteri notları'],
                to: '/staff/login',
                cta: 'Personel Girişi',
              },
              {
                icon: '📅',
                title: 'Müşteri',
                desc: 'Berberinin adını yazın. Müsait saatleri görüp 1 dakikada randevu alın.',
                features: ['Dükkan ara', 'Müsait saatler', 'Hızlı randevu', 'Bildirim al'],
                to: '/book',
                cta: 'Randevu Al',
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="glass group flex flex-col rounded-2xl p-5 transition hover:border-gold/40 sm:p-8"
              >
                <span className="text-4xl sm:text-5xl">{card.icon}</span>
                <h3 className="mt-6 font-display text-2xl font-semibold text-cream">{card.title}</h3>
                <p className="mt-3 text-cream-muted">{card.desc}</p>
                <ul className="mt-6 space-y-2 flex-1">
                  {card.features.map((feature, j) => (
                    <li key={j} className="text-sm text-cream-muted flex items-center gap-2">
                      <span className="text-gold">✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <Link to={card.to} className="mt-6">
                  <Button variant={card.primary ? 'primary' : 'secondary'} className="w-full">
                    {card.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Footer */}
        <section className="border-t border-gold/10 mt-20 py-12">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p className="text-cream-muted">
              © 2024 BerberRandevu. Tüm hakları saklıdır. • 
              <span className="text-gold ml-2">📧 destek@berberrandevu.com</span>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
