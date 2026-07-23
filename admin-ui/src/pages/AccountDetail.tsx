import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'
import { api } from '../api'
import { Account, Store, Plan } from '../types'
import {
  ArrowLeft, Plus, RefreshCw, Copy, Check,
  Globe, ToggleLeft, ToggleRight, Key, RotateCcw, Zap,
} from 'lucide-react'

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
    <button onClick={copy} className="ml-1.5 text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

export function AccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddStore, setShowAddStore] = useState(false)
  const [storeForm, setStoreForm] = useState({ site_url: '', site_nome: '' })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showRenew, setShowRenew] = useState(false)
  const [showResetCredits, setShowResetCredits] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [accs, strs, pls] = await Promise.all([
        api.listAccounts(),
        api.listStores(id),
        api.listPlans(),
      ])
      const acc = (accs as Account[]).find(a => a.id === id) ?? null
      setAccount(acc)
      setStores(strs as Store[])
      setPlans(pls as Plan[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleRenew() {
    if (!id) return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.renewAccount(id)
      setFeedback('Subscrição renovada +1 mês!')
      await load()
      setTimeout(() => setShowRenew(false), 1500)
    } catch (err: unknown) {
      setFeedback(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetCredits() {
    if (!id) return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.resetCredits(id)
      setFeedback('Créditos usados reiniciados a 0!')
      await load()
      setTimeout(() => setShowResetCredits(false), 1500)
    } catch (err: unknown) {
      setFeedback(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.createStore(id, storeForm)
      setFeedback('Store criada com sucesso!')
      setStoreForm({ site_url: '', site_nome: '' })
      await load()
      setTimeout(() => setShowAddStore(false), 1500)
    } catch (err: unknown) {
      setFeedback(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const plan = plans.find(p => p.id === account?.plano_id)
  const creditPct = account
    ? Math.min(Math.round((account.creditos_usados / account.creditos_limite) * 100), 100)
    : 0

  if (loading) {
    return (
      <Layout title="Conta">
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      </Layout>
    )
  }

  if (!account) {
    return (
      <Layout title="Conta">
        <div className="text-center py-20 text-gray-400">Conta não encontrada</div>
      </Layout>
    )
  }

  return (
    <Layout
      title={account.nome}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFeedback(''); setShowResetCredits(true) }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-colors"
          >
            <Zap size={14} />
            Reset créditos
          </button>
          <button
            onClick={() => { setFeedback(''); setShowRenew(true) }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors"
          >
            <RotateCcw size={14} />
            Renovar
          </button>
          <button
            onClick={() => navigate('/accounts')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Estado</p>
          <Badge value={account.billing_status} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Plano</p>
          <p className="text-lg font-semibold text-gray-900">{plan?.nome ?? account.plano_id}</p>
          {plan && <p className="text-xs text-gray-400 mt-0.5">{plan.creditos_mes} créditos/mês</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Créditos</p>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-lg font-semibold text-gray-900">{account.creditos_usados}</span>
            <span className="text-xs text-gray-400">/ {account.creditos_limite}</span>
          </div>
          <div className="bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${creditPct > 80 ? 'bg-red-400' : 'bg-indigo-500'}`}
              style={{ width: `${creditPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{creditPct}% usado</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Renovação</p>
          <p className="text-base font-semibold text-gray-900">{fmtDate(account.renovacao_em)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Criado em {fmtDate(account.criado_em)}</p>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Informação da Conta</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Nome</dt>
            <dd className="text-sm font-medium text-gray-900">{account.nome}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Email</dt>
            <dd className="text-sm font-medium text-gray-900">{account.email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <Key size={11} />
              License Key
            </dt>
            <dd className="flex items-center gap-2">
              <code className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 break-all">
                {account.license_key}
              </code>
              <CopyButton text={account.license_key} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">ID da Conta</dt>
            <dd className="flex items-center">
              <code className="text-xs font-mono text-gray-500">{account.id}</code>
              <CopyButton text={account.id} />
            </dd>
          </div>
          {plan && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">Stores permitidas</dt>
              <dd className="text-sm font-medium text-gray-900">
                {stores.length} / {plan.stores_max}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Stores */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Stores</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {stores.length} registada{stores.length !== 1 ? 's' : ''}
              {plan ? ` de ${plan.stores_max} permitidas` : ''}
            </p>
          </div>
          <button
            onClick={() => { setShowAddStore(true); setFeedback(''); setStoreForm({ site_url: '', site_nome: '' }) }}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors"
          >
            <Plus size={14} />
            Adicionar Store
          </button>
        </div>

        {stores.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Globe size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma store registada</p>
            <p className="text-xs mt-1 text-gray-300">Adiciona uma store para começar a importar produtos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate Limit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stores.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{s.site_nome ?? '—'}</td>
                  <td className="px-4 py-4">
                    <code className="text-xs font-mono text-gray-600">{s.site_url}</code>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.activo ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {s.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">{s.rate_limit ?? '—'} req/min</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <code className="text-xs font-mono text-gray-400">{s.id}</code>
                      <CopyButton text={s.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal — Renovar */}
      {showRenew && (
        <Modal title="Renovar subscrição" onClose={() => setShowRenew(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Conta:</span> {account.nome}</p>
              <p><span className="font-medium">Renovação actual:</span> {fmtDate(account.renovacao_em)}</p>
              <p className="text-gray-500 text-xs pt-1">A nova data será +1 mês. O estado passará a <strong>Activo</strong>.</p>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{feedback}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowRenew(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleRenew} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Confirmar renovação
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal — Reset créditos */}
      {showResetCredits && (
        <Modal title="Reset créditos usados" onClose={() => setShowResetCredits(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800 space-y-1">
              <p className="font-semibold">Isto vai repor os créditos usados a 0.</p>
              <p>Conta: <strong>{account.nome}</strong></p>
              <p>Créditos usados actuais: <strong>{account.creditos_usados}</strong> / {account.creditos_limite}</p>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{feedback}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowResetCredits(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleResetCredits} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                Confirmar reset
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Store Modal */}
      {showAddStore && (
        <Modal title="Adicionar Store" onClose={() => setShowAddStore(false)} size="sm">
          <form onSubmit={handleAddStore} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Store</label>
              <input
                required
                value={storeForm.site_nome}
                onChange={e => setStoreForm({ ...storeForm, site_nome: e.target.value })}
                placeholder="ex: Real Stiles"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL da Store</label>
              <input
                required
                type="url"
                value={storeForm.site_url}
                onChange={e => setStoreForm({ ...storeForm, site_url: e.target.value })}
                placeholder="https://realstiles.com"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {feedback}
              </div>
            )}
            <button
              disabled={submitting}
              type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'A criar...' : 'Adicionar Store'}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
