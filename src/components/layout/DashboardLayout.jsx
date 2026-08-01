import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarDays, LayoutDashboard, Scissors, Settings, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useShop } from '../../hooks/useShop'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import BrandLogo from '../BrandLogo'

const nav = [
  { to: '/dashboard', label: 'Ozet', icon: LayoutDashboard, end: true },
  { to: '/dashboard/appointments', label: 'Randevular', icon: CalendarDays },
  { to: '/dashboard/employees', label: 'Personel', icon: Users },
  { to: '/dashboard/services', label: 'Hizmetler', icon: Scissors },
  { to: '/dashboard/finance', label: 'Gelir Gider', icon: WalletCards },
  { to: '/dashboard/settings', label: 'Ayarlar', icon: Settings },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const { shop } = useShop()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login')
    setSigningOut(false)
  }

  const bookingUrl = shop?.slug ? `${window.location.origin}/book/${shop.slug}` : null

  return (
    <div className="flex min-h-dvh bg-navy">
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Cikis yapilsin mi?"
        message="Hesabinizdan cikis yapmak istediginize emin misiniz?"
        confirmText="Cikis yap"
        loading={signingOut}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleSignOut}
      />

      <aside className="hidden w-64 shrink-0 flex-col border-r border-gold/10 bg-navy-light md:flex">
        <div className="border-b border-gold/10 p-5">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" showText={false} />
            <div>
              <p className="font-display font-bold text-cream">{shop?.name || 'Randevu Zamani'}</p>
              <p className="text-xs text-cream-muted">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-gold/10 text-gold' : 'text-cream-muted hover:bg-blue-50 hover:text-cream'}`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {bookingUrl && (
          <div className="border-t border-gold/10 p-4">
            <p className="text-xs text-cream-muted">Musteri linki</p>
            <button
              onClick={() => navigator.clipboard.writeText(bookingUrl)}
              className="mt-1 w-full truncate text-left text-xs text-gold hover:underline"
            >
              {bookingUrl}
            </button>
          </div>
        )}

        <div className="border-t border-gold/10 p-3">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowLogoutConfirm(true)}>
            Cikis Yap
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gold/10 bg-navy-light px-4 py-3 md:hidden">
          <Link to="/dashboard" className="min-w-0 truncate font-display font-bold text-cream">
            {shop?.name || 'Randevu Zamani'}
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)}>
            Cikis
          </Button>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-4 pb-28 md:p-6">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gold/10 bg-navy-light/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          {nav.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium ${isActive ? 'text-gold' : 'text-cream-muted'}`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
