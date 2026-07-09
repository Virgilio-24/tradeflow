import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/Badge'
import { api } from '../api'
import { Job } from '../types'
import { RefreshCw, RotateCcw } from 'lucide-react'

const STATUSES = ['', 'pending', 'processing', 'done', 'failed']

function fmtDate(ts?: { seconds?: number; _seconds?: number } | null) {
  if (!ts) return '—'
  const s = (ts as any)._seconds ?? ts.seconds
  if (!s) return '—'
  return new Date(s * 1000).toLocaleString('pt-PT')
}

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState(50)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setJobs(await api.listAllJobs({ status: status || undefined, limit }) as Job[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, limit])

  async function retry(id: string) {
    setRetrying(id)
    try {
      await api.retryJob(id)
      await load()
    } finally {
      setRetrying(null)
    }
  }

  return (
    <Layout
      title="Jobs"
      actions={
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
          {STATUSES.map(s => <option key={s} value={s}>{s || 'Todos os estados'}</option>)}
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} por página</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job ID</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado</th>
              <th className="px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <RefreshCw size={20} className="animate-spin mx-auto" />
              </td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Sem jobs</td></tr>
            ) : jobs.map(j => (
              <tr key={j.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-6 py-4">
                  <code className="text-xs text-gray-500 font-mono">{j.id}</code>
                </td>
                <td className="px-4 py-4">
                  <Badge value={j.tipo} />
                </td>
                <td className="px-4 py-4">
                  <Badge value={j.status} />
                </td>
                <td className="px-4 py-4 max-w-xs">
                  <p className="truncate text-gray-600 text-xs">{j.url}</p>
                  <p className="truncate text-gray-400 text-xs">{j.store_url}</p>
                </td>
                <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">{fmtDate(j.criado_em)}</td>
                <td className="px-4 py-4">
                  {j.status === 'failed' && (
                    <button
                      onClick={() => retry(j.id)}
                      disabled={retrying === j.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-60 transition-colors"
                    >
                      <RotateCcw size={12} className={retrying === j.id ? 'animate-spin' : ''} />
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
