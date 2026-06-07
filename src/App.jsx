import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import { useStaffStore } from './store/staffStore'
import ProtectedRoute from './components/ProtectedRoute'
import StaffRoute from './components/StaffRoute'
import ShopGate from './components/ShopGate'
import DashboardLayout from './components/layout/DashboardLayout'
import Loading from './components/ui/Loading'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ShopSetup from './pages/ShopSetup'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Services from './pages/Services'
import Appointments from './pages/Appointments'
import Settings from './pages/Settings'
import BookSlugEntry from './pages/BookSlugEntry'
import BookingPage from './pages/book/BookingPage'
import StaffLogin from './pages/staff/StaffLogin'
import StaffDashboard from './pages/staff/StaffDashboard'

function HomeRoute() {
  const { user, loading } = useAuth()
  const staffIsValid = useStaffStore(s => s.isValid())

  if (loading) return <Loading />
  if (staffIsValid) return <Navigate to="/staff/dashboard" replace />
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/book" element={<BookSlugEntry />} />
          <Route path="/book/:slug" element={<BookingPage />} />

          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/login/:slug" element={<StaffLogin />} />
          <Route element={<StaffRoute />}>
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
          </Route>

          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route path="/dukkan-olustur" element={<ShopSetup />} />
            <Route element={<ShopGate />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/appointments" element={<Appointments />} />
                <Route path="/dashboard/employees" element={<Employees />} />
                <Route path="/dashboard/services" element={<Services />} />
                <Route path="/dashboard/settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>

          <Route path="/giris" element={<Navigate to="/login" replace />} />
          <Route path="/kayit" element={<Navigate to="/register" replace />} />
          <Route path="/panel/*" element={<Navigate to="/dashboard" replace />} />
          <Route path="/randevu/:shopId" element={<Navigate to="/book" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
