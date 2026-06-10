import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useShop } from '../hooks/useShop'
import Button from './ui/Button'

const navItems = [
  { to: '/panel', label: 'Özet', end: true },
  { to: '/panel/randevular', label: 'Randevular' },
  { to: '/panel/personel', label: 'Personel' },
  { to: '/panel/hizmetler', label: 'Hizmetler' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { shop } = useShop()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/giris')
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/panel" className="flex min-w-0 items-center gap-2">
            <span className="text-xl">✂️</span>
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{shop?.name || 'Randevu Zamanı Panel'}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-amber-500/15 text-amber-400' : 'text-zinc-400 hover:text-zinc-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {shop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/randevu/${shop.id}`)
                }}
              >
                Link Kopyala
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Çıkış
            </Button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-800 px-4 py-2 md:hidden">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-amber-500/15 text-amber-400' : 'text-zinc-400'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>
    </div>
  )
}
