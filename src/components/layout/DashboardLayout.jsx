import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useShop } from '../../hooks/useShop'
import Button from '../ui/Button'

const nav = [
  { to: '/dashboard', label: 'Özet', icon: '📊', end: true },
  { to: '/dashboard/appointments', label: 'Randevular', icon: '📅' },
  { to: '/dashboard/employees', label: 'Personel', icon: '👤' },
  { to: '/dashboard/services', label: 'Hizmetler', icon: '✂️' },
  { to: '/dashboard/settings', label: 'Ayarlar', icon: '⚙️' },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const { shop } = useShop()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const bookingUrl = shop?.slug ? `${window.location.origin}/book/${shop.slug}` : null

  return (
    <div className="flex min-h-dvh bg-navy">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gold/10 bg-navy-light md:flex">
        <div className="border-b border-gold/10 p-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">✂️</span>
            <div>
              <p className="font-display font-bold text-cream">{shop?.name || 'Panel'}</p>
              <p className="text-xs text-cream-muted">{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-gold/15 text-gold' : 'text-cream-muted hover:bg-white/5 hover:text-cream'}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {bookingUrl && (
          <div className="border-t border-gold/10 p-4">
            <p className="text-xs text-cream-muted">Müşteri linki</p>
            <button
              onClick={() => navigator.clipboard.writeText(bookingUrl)}
              className="mt-1 w-full truncate text-left text-xs text-gold hover:underline"
            >
              {bookingUrl}
            </button>
          </div>
        )}
        <div className="border-t border-gold/10 p-3">
          <Button variant="ghost" size="sm" className="w-full" onClick={handleSignOut}>Çıkış Yap</Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gold/10 px-4 py-3 md:hidden">
          <Link to="/dashboard" className="min-w-0 truncate font-display font-bold text-cream">{shop?.name}</Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>Çıkış</Button>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-4 pb-24 md:p-6">
          <Outlet />
        </main>

        <nav className="flex border-t border-gold/10 bg-navy-light pb-[env(safe-area-inset-bottom)] md:hidden">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-gold' : 'text-cream-muted'}`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
