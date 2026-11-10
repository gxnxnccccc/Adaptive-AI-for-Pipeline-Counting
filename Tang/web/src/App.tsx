import { Navigate, Route, Routes } from 'react-router'
import AppShell from '@/components/AppShell'
import { AuthProvider } from '@/lib/auth'
import { DetectionSessionProvider } from '@/lib/detection-session'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Processing from '@/pages/Processing'
import Result from '@/pages/Result'

export default function App() {
  return (
    <AuthProvider>
      <DetectionSessionProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/processing" element={<Processing />} />
            <Route path="/result" element={<Result />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
          {/* Unknown paths, old /new and /records links land on Processing (or login when signed out). */}
          <Route path="*" element={<Navigate to="/processing" replace />} />
        </Routes>
      </DetectionSessionProvider>
    </AuthProvider>
  )
}
