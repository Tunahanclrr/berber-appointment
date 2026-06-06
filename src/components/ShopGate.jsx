import { Navigate, Outlet } from 'react-router-dom'
import { useShop } from '../hooks/useShop'
import Loading from './ui/Loading'

export default function ShopGate() {
  const { shop, loading } = useShop()

  if (loading) return <Loading />
  if (!shop) return <Navigate to="/dukkan-olustur" replace />

  return <Outlet />
}
