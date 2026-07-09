import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, Briefcase, ScrollText, LogOut, Zap, FlaskConical, CalendarCheck } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Contas', icon: Users },
  { to: '/subscricoes', label: 'Subscrições', icon: CalendarCheck },
  { to: '/plans', label: 'Planos', icon: CreditCard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/scrape-test', label: 'Teste Scrape', icon: FlaskConical },
]

export function Sidebar() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('tf_admin_token')
    localStorage.removeItem('tf_api_url')
    navigate('/login')
  }

  return (
    <aside className="w-64 bg-gray-900 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">TradeFlow</p>
          <p className="text-gray-500 text-xs">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <LogOut size={17} />
          Sair
        </button>
      </div>
    </aside>
  )
}
