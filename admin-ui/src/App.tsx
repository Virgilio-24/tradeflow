import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Accounts } from './pages/Accounts'
import { AccountDetail } from './pages/AccountDetail'
import { Plans } from './pages/Plans'
import { Jobs } from './pages/Jobs'
import { Logs } from './pages/Logs'
import { ScrapeTester } from './pages/ScrapeTester'
import { Subscricoes } from './pages/Subscricoes'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('tf_admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/accounts" element={<RequireAuth><Accounts /></RequireAuth>} />
        <Route path="/accounts/:id" element={<RequireAuth><AccountDetail /></RequireAuth>} />
        <Route path="/plans" element={<RequireAuth><Plans /></RequireAuth>} />
        <Route path="/jobs" element={<RequireAuth><Jobs /></RequireAuth>} />
        <Route path="/logs" element={<RequireAuth><Logs /></RequireAuth>} />
        <Route path="/subscricoes" element={<RequireAuth><Subscricoes /></RequireAuth>} />
        <Route path="/scrape-test" element={<RequireAuth><ScrapeTester /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
