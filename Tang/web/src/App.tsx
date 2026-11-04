import { Navigate, Route, Routes } from 'react-router'
import AppShell from '@/components/AppShell'
import { AuthProvider } from '@/lib/auth'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import NewDetection from '@/pages/NewDetection'
import Records from '@/pages/Records'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/new" element={<NewDetection />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/records" element={<Records />} />
        </Route>
        <Route path="*" element={<Navigate to="/new" replace />} />
      </Routes>
    </AuthProvider>
  )
}
