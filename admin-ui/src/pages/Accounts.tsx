import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'
import { api } from '../api'
import { Account, Plan } from '../types'
import {
  Plus, RefreshCw, Search, MoreVertical, Key, Ban, CheckCircle,
  RotateCcw, TrendingUp, ChevronRight, Copy, Check, ExternalLink,
} from 'lucide-react'

type Action = 'create' | 'addCredits' | 'changePlan' | 'block' | 'stores' | 'jobs' | null

function fmtDate(ts?: { seconds?: number; _seconds?: number } | null) {
  if (!ts) return '—'
  const s = (ts as any)._seconds ?? ts.seconds
  if (!s) return '—'
  return new Date(s * 1000).toLocaleDateString('pt-PT')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="ml-1 text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

export function Accounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [selected, setSelected] = useState<Account | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  // Create form
  const [form, setForm] = useState({ email: '', nome: '', plano_id: '' })
  const [creditsAmount, setCreditsAmount] = useState(0)
  const [newPlanId, setNewPlanId] = useState('')
  const [blockMotivo, setBlockMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [detailData, setDetailData] = useState<unknown[]>([])

  async function load() {
    setLoading(true)
    try {
      const [accs, pls] = await Promise.all([api.listAccounts(), api.listPlans()])
      setAccounts(accs as Account[])
      setPlans(pls as Plan[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = accounts.filter(a =>
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.plano_id.toLowerCase().includes(search.toLowerCase())
  )

  function openAction(a: Account, act: Action) {
    setSelected(a)
    setAction(act)
    setOpenMenu(null)
    setFeedback('')
    setNewPlanId(a.plano_id)
    setCreditsAmount(0)
    setBlockMotivo('')
    setDetailData([])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.createAccount(form) as { id: string; license_key: string }
      navigate(`/accounts/${res.id}`)
    } catch (err: unknown) {
      setFeedback(`Erro: ${err instanceof Error ? err.message : String(err)}`)
      setSubmitting(false)
    }
  }

  async function handleBlock() {
    if (!selected) return
    setSubmitting(true)
    try {
      await api.blockAccount(selected.id, blockMotivo)
      setAction(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnblock(a: Account) {
    await api.unblockAccount(a.id)
    await load()
    setOpenMenu(null)
  }

  async function handleResetCredits(a: Account) {
    await api.resetCredits(a.id)
    await load()
    setOpenMenu(null)
  }

  async function handleNewKey(a: Account) {
    const res = await api.newLicenseKey(a.id) as { license_key: string }
    await load()
    setOpenMenu(null)
    alert(`Nova license key: ${res.license_key}`)
  }

  async function handleAddCredits(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      await api.addCredits(selected.id, creditsAmount)
      setAction(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      await api.changePlan(selected.id, newPlanId)
      setAction(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleViewStores(a: Account) {
    const data = await api.listStores(a.id)
    setDetailData(data as unknown[])
    openAction(a, 'stores')
  }

  async function handleViewJobs(a: Account) {
    const data = await api.listAccountJobs(a.id)
    setDetailData(data as unknown[])
    openAction(a, 'jobs')
  }

  return (
    <Layout
      title="Contas"
      actions={
        <button
          onClick={() => { setAction('create'); setSelected(null); setFeedback('') }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nova Conta
        </button>
      }
    >
      {/* Search + refresh */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por email, nome ou plano..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Conta</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plano</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Créditos</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stores</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado</th>
              <th className="px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                <RefreshCw size={20} className="animate-spin mx-auto" />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Sem contas</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(`/accounts/${a.id}`)}
                    className="font-medium text-gray-900 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                  >
                    {a.nome}
                    <ExternalLink size={11} className="opacity-40" />
                  </button>
                  <p className="text-gray-400 text-xs mt-0.5">{a.email}</p>
                  <div className="flex items-center mt-1">
                    <code className="text-xs text-gray-400 font-mono truncate max-w-[160px]">{a.license_key}</code>
                    <CopyButton text={a.license_key} />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-gray-700 font-medium">{a.plano_id}</span>
                </td>
                <td className="px-4 py-4">
                  <Badge value={a.billing_status} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(a.uso_pct ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{a.creditos_usados}/{a.creditos_limite}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-600">{a.stores_count ?? 0}</td>
                <td className="px-4 py-4 text-gray-400 text-xs">{fmtDate(a.criado_em)}</td>
                <td className="px-4 py-4 relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openMenu === a.id && (
                    <div className="absolute right-4 top-12 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-52">
                      <button onClick={() => openAction(a, 'addCredits')} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <TrendingUp size={14} /> Adicionar créditos
                      </button>
                      <button onClick={() => openAction(a, 'changePlan')} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <ChevronRight size={14} /> Mudar plano
                      </button>
                      <button onClick={() => handleResetCredits(a)} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <RotateCcw size={14} /> Reset créditos
                      </button>
                      <button onClick={() => handleNewKey(a)} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Key size={14} /> Nova license key
                      </button>
                      <button onClick={() => navigate(`/accounts/${a.id}`)} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <ExternalLink size={14} /> Ver detalhe / stores
                      </button>
                      <button onClick={() => handleViewJobs(a)} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <ChevronRight size={14} /> Ver jobs
                      </button>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        {a.billing_status === 'suspended' ? (
                          <button onClick={() => handleUnblock(a)} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50">
                            <CheckCircle size={14} /> Desbloquear
                          </button>
                        ) : (
                          <button onClick={() => openAction(a, 'block')} className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                            <Ban size={14} /> Bloquear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {action === 'create' && (
        <Modal title="Nova Conta" onClose={() => setAction(null)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
              <select required value={form.plano_id} onChange={e => setForm({ ...form, plano_id: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                <option value="">Seleccionar plano</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {feedback}
              </div>
            )}
            <button disabled={submitting} type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
              {submitting ? 'A criar...' : 'Criar Conta'}
            </button>
          </form>
        </Modal>
      )}

      {action === 'addCredits' && selected && (
        <Modal title={`Adicionar Créditos — ${selected.nome}`} onClose={() => setAction(null)} size="sm">
          <form onSubmit={handleAddCredits} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <input required type="number" min={1} value={creditsAmount} onChange={e => setCreditsAmount(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <button disabled={submitting} type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
              {submitting ? 'A adicionar...' : 'Adicionar'}
            </button>
          </form>
        </Modal>
      )}

      {action === 'changePlan' && selected && (
        <Modal title={`Mudar Plano — ${selected.nome}`} onClose={() => setAction(null)} size="sm">
          <form onSubmit={handleChangePlan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Novo Plano</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                {plans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <button disabled={submitting} type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
              {submitting ? 'A guardar...' : 'Guardar'}
            </button>
          </form>
        </Modal>
      )}

      {action === 'block' && selected && (
        <Modal title={`Bloquear — ${selected.nome}`} onClose={() => setAction(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <input value={blockMotivo} onChange={e => setBlockMotivo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <button disabled={submitting} onClick={handleBlock}
              className="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-500 disabled:opacity-60 transition-colors">
              {submitting ? 'A bloquear...' : 'Confirmar Bloqueio'}
            </button>
          </div>
        </Modal>
      )}

      {(action === 'stores' || action === 'jobs') && selected && (
        <Modal title={`${action === 'stores' ? 'Stores' : 'Jobs'} — ${selected.nome}`} onClose={() => setAction(null)} size="lg">
          <pre className="text-xs text-gray-700 bg-gray-50 rounded-xl p-4 overflow-auto max-h-96">
            {JSON.stringify(detailData, null, 2)}
          </pre>
        </Modal>
      )}

      {/* Close menu on outside click */}
      {openMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}
    </Layout>
  )
}
