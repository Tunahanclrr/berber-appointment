import { Navigate, Outlet } from 'react-router-dom'
import { useStaffStore } from '../store/staffStore'

export default function StaffRoute() {
  const isValid = useStaffStore(s => s.isValid())

  if (!isValid) return <Navigate to="/staff/login" replace />
  return <Outlet />
}
