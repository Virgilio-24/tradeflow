import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/Badge'
import { api } from '../api'
import { Log } from '../types'
import { RefreshCw, Search } from 'lucide-react'

const LEVELS = ['', 'info', 'warning', 'error']

function fmtDate(ts?: { seconds?: number; _seconds?: number } | null) {
  if (!ts) return '—'
  const s = (ts as any)._seconds ?? ts.seconds
  if (!s) return '—'
  return new Date(s * 1000).toLocaleString('pt-PT')
}

export function Logs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [nivel, setNivel] = useState('')
  const [limit, setLimit] = useState(100)

  async function load() {
    setLoading(true)
    try {
      setLogs(await api.listLogs({
        account_id: accountId || undefined,
        nivel: nivel || undefined,
        limit,
      }) as Log[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [nivel, limit])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  const levelColors: Record<string, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-400',
    error: 'border-l-red-400',
  }

  return (
    <Layout
      title="Logs"
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* Filters */}
      <form onSubmit={handleSearch} className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            placeholder="Account ID..."
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white w-56"
          />
        </div>
        <select value={nivel} onChange={e => setNivel(e.target.value)}
          className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
          {LEVELS.map(l => <option key={l} value={l}>{l || 'Todos os níveis'}</option>)}
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
          {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n} entradas</option>)}
        </select>
        <button type="submit" className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors">
          Filtrar
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Sem logs</div>
          ) : logs.map(l => (
            <div
              key={l.id}
              className={`bg-white rounded-xl border border-gray-100 border-l-4 ${levelColors[l.nivel] ?? 'border-l-gray-300'} px-5 py-4 shadow-sm`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Badge value={l.nivel} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{l.mensagem}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs text-gray-400 font-mono">{l.account_id}</code>
                      {l.job_id && <code className="text-xs text-gray-400 font-mono">job:{l.job_id}</code>}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDate(l.criado_em)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
