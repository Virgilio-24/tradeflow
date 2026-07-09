import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Stats } from '../types'
import { Users, CreditCard, Briefcase, TrendingUp, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const data = await api.stats() as Stats
      setStats(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const byStatusData = stats
    ? Object.entries(stats.by_status).map(([name, value]) => ({ name, value }))
    : []

  const byPlanData = stats
    ? Object.entries(stats.by_plan).map(([name, value]) => ({ name, value }))
    : []

  const cards = [
    {
      label: 'Total de Contas',
      value: stats?.total_accounts ?? '—',
      icon: Users,
      color: 'bg-indigo-500',
      light: 'bg-indigo-50',
      text: 'text-indigo-600',
    },
    {
      label: 'Planos Activos',
      value: stats?.total_plans ?? '—',
      icon: CreditCard,
      color: 'bg-green-500',
      light: 'bg-green-50',
      text: 'text-green-600',
    },
    {
      label: 'Contas Activas',
      value: stats?.by_status?.active ?? 0,
      icon: TrendingUp,
      color: 'bg-blue-500',
      light: 'bg-blue-50',
      text: 'text-blue-600',
    },
    {
      label: 'Suspensas',
      value: stats?.by_status?.suspended ?? 0,
      icon: Briefcase,
      color: 'bg-red-500',
      light: 'bg-red-50',
      text: 'text-red-600',
    },
  ]

  return (
    <Layout
      title="Dashboard"
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
    >
      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {cards.map(({ label, value, icon: Icon, light, text }) => (
              <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                  </div>
                  <div className={`w-11 h-11 ${light} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={text} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-5">Contas por Estado</h3>
              {byStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byStatusData} barSize={36}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                      cursor={{ fill: '#f3f4f6' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {byStatusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-12">Sem dados</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-5">Contas por Plano</h3>
              {byPlanData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byPlanData} barSize={36}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                      cursor={{ fill: '#f3f4f6' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {byPlanData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-12">Sem dados</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
