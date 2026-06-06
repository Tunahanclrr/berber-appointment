import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from './ui/Loading'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/giris" replace />

  return children
}
