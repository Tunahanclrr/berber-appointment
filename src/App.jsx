import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import { useStaffStore } from './store/staffStore'
import ProtectedRoute from './components/ProtectedRoute'
import StaffRoute from './components/StaffRoute'
import ShopGate from './components/ShopGate'
import DashboardLayout from './components/layout/DashboardLayout'
import Loading from './components/ui/Loading'
import { getSavedBookingPath, isLockedBookingPwa } from './lib/pwa'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const ShopContact = lazy(() => import('./pages/ShopContact'))
const ShopSetup = lazy(() => import('./pages/ShopSetup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Services = lazy(() => import('./pages/Services'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Settings = lazy(() => import('./pages/Settings'))
const Finance = lazy(() => import('./pages/Finance'))
const CustomerAppointment = lazy(() => import('./pages/CustomerAppointment'))
const BookSlugEntry = lazy(() => import('./pages/BookSlugEntry'))
const BookingPage = lazy(() => import('./pages/book/BookingPage'))
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'))
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'))
const StaffFinance = lazy(() => import('./pages/staff/StaffFinance'))

function BookingPwaGuard() {
  const location = useLocation()
  const savedBookingPath = getSavedBookingPath()

  if (
    isLockedBookingPwa() &&
    savedBookingPath &&
    location.pathname !== savedBookingPath
  ) {
    return <Navigate to={savedBookingPath} replace />
  }

  return <Outlet />
}

function HomeRoute() {
  const { user, loading } = useAuth()
  const staffIsValid = useStaffStore(s => s.isValid())
  const savedBookingPath = getSavedBookingPath()

  if (loading) return <Loading />
  if (isLockedBookingPwa() && savedBookingPath) return <Navigate to={savedBookingPath} replace />
  if (staffIsValid) return <Navigate to="/staff/dashboard" replace />
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<BookingPwaGuard />}>
              <Route path="/" element={<HomeRoute />} />

              <Route path="/login" element={<Login />} />
              <Route path="/iletisim" element={<ShopContact />} />
              <Route path="/register" element={<Navigate to="/iletisim" replace />} />

              <Route path="/book" element={<BookSlugEntry />} />
              <Route path="/book/:slug" element={<BookingPage />} />
              <Route path="/appointment" element={<CustomerAppointment />} />

              <Route path="/staff/login" element={<StaffLogin />} />
              <Route path="/staff/login/:slug" element={<StaffLogin />} />
              <Route element={<StaffRoute />}>
                <Route path="/staff/dashboard" element={<StaffDashboard />} />
                <Route path="/staff/finance" element={<StaffFinance />} />
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
                    <Route path="/dashboard/finance" element={<Finance />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/giris" element={<Navigate to="/login" replace />} />
              <Route path="/kayit" element={<Navigate to="/iletisim" replace />} />
              <Route path="/panel/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/randevu/:shopId" element={<Navigate to="/book" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
