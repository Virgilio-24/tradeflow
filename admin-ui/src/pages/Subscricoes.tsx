import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { api } from '../api'
import { Account, Plan } from '../types'
import {
  RefreshCw, RotateCcw, CheckCircle, XCircle,
  AlertTriangle, Clock, TrendingUp, Users,
  ChevronRight, CalendarDays, Trash2,
} from 'lucide-react'

type Filtro = 'todos' | 'active' | 'trial' | 'expiring' | 'suspended' | 'cancelled'

function fmtDate(ts?: { seconds?: number; _seconds?: number } | null) {
  if (!ts) return '—'
  const s = (ts as any)._seconds ?? ts.seconds
  if (!s) return '—'
  return new Date(s * 1000).toLocaleDateString('pt-PT')
}

function getRenovacaoMs(ts?: { seconds?: number; _seconds?: number } | null): number {
  if (!ts) return Infinity
  const s = (ts as any)._seconds ?? ts.seconds
  return s ? s * 1000 : Infinity
}

function diasParaRenovacao(ts?: { seconds?: number; _seconds?: number } | null): number {
  const ms = getRenovacaoMs(ts)
  if (ms === Infinity) return Infinity
  return Math.ceil((ms - Date.now()) / 86_400_000)
}

function RenovacaoBadge({ dias }: { dias: number }) {
  if (dias < 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Expirado</span>
  if (dias <= 3) return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{dias}d</span>
  if (dias <= 7) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{dias}d</span>
  if (dias <= 14) return <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{dias}d</span>
  return <span className="text-xs text-gray-400">{dias}d</span>
}

type ModalAction =
  | { type: 'renew'; account: Account }
  | { type: 'status'; account: Account }
  | { type: 'cancel'; account: Account }
  | { type: 'delete'; account: Account }

export function Subscricoes() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalAction | null>(null)
  const [motivo, setMotivo] = useState('')
  const [novoStatus, setNovoStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

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

  const agora = Date.now()
  const em7dias = agora + 7 * 86_400_000

  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter(a => a.billing_status === 'active').length,
    trial: accounts.filter(a => a.billing_status === 'trial').length,
    expiring: accounts.filter(a => {
      if (a.billing_status === 'active' || a.billing_status === 'trial') {
        const ms = getRenovacaoMs(a.renovacao_em)
        return ms !== Infinity && ms <= em7dias && ms > agora
      }
      return false
    }).length,
    suspended: accounts.filter(a => a.billing_status === 'suspended' || a.billing_status === 'cancelled').length,
  }), [accounts])

  const lista = useMemo(() => {
    let r = [...accounts]

    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(a => a.nome.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    }

    switch (filtro) {
      case 'active': r = r.filter(a => a.billing_status === 'active'); break
      case 'trial': r = r.filter(a => a.billing_status === 'trial'); break
      case 'suspended': r = r.filter(a => a.billing_status === 'suspended' || a.billing_status === 'cancelled'); break
      case 'cancelled': r = r.filter(a => a.billing_status === 'cancelled'); break
      case 'expiring': r = r.filter(a => {
        const ms = getRenovacaoMs(a.renovacao_em)
        return (a.billing_status === 'active' || a.billing_status === 'trial') && ms <= em7dias && ms > agora
      }); break
    }

    // Ordenar por renovação mais próxima primeiro
    r.sort((a, b) => getRenovacaoMs(a.renovacao_em) - getRenovacaoMs(b.renovacao_em))
    return r
  }, [accounts, filtro, search])

  const planNome = (id: string) => plans.find(p => p.id === id)?.nome ?? id

  async function handleRenew() {
    if (!modal || modal.type !== 'renew') return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.renewAccount(modal.account.id)
      setFeedback('Subscrição renovada +1 mês!')
      await load()
      setTimeout(() => setModal(null), 1500)
    } catch (e: unknown) {
      setFeedback(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetStatus() {
    if (!modal || modal.type !== 'status') return
    if (!novoStatus) return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.setBillingStatus(modal.account.id, novoStatus, motivo || undefined)
      setFeedback('Estado actualizado!')
      await load()
      setTimeout(() => setModal(null), 1500)
    } catch (e: unknown) {
      setFeedback(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!modal || modal.type !== 'cancel') return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.setBillingStatus(modal.account.id, 'cancelled', motivo || 'Cancelado pelo admin')
      setFeedback('Subscrição cancelada.')
      await load()
      setTimeout(() => setModal(null), 1500)
    } catch (e: unknown) {
      setFeedback(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!modal || modal.type !== 'delete') return
    setSubmitting(true)
    setFeedback('')
    try {
      await api.deleteAccount(modal.account.id)
      setFeedback('Conta eliminada.')
      await load()
      setTimeout(() => setModal(null), 1500)
    } catch (e: unknown) {
      setFeedback(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const FILTROS: { id: Filtro; label: string; count: number; color: string }[] = [
    { id: 'todos', label: 'Todas', count: stats.total, color: 'bg-gray-100 text-gray-700' },
    { id: 'active', label: 'Activas', count: stats.active, color: 'bg-green-50 text-green-700' },
    { id: 'trial', label: 'Trial', count: stats.trial, color: 'bg-indigo-50 text-indigo-700' },
    { id: 'expiring', label: 'Expiram em 7d', count: stats.expiring, color: 'bg-orange-50 text-orange-700' },
    { id: 'suspended', label: 'Suspensas', count: stats.suspended, color: 'bg-red-50 text-red-700' },
  ]

  return (
    <Layout
      title="Subscrições"
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</p>
            <Users size={16} className="text-gray-300" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">contas registadas</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activas</p>
            <CheckCircle size={16} className="text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.trial} em trial</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expiram em breve</p>
            <AlertTriangle size={16} className="text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-500">{stats.expiring}</p>
          <p className="text-xs text-gray-400 mt-1">nos próximos 7 dias</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Suspensas</p>
            <XCircle size={16} className="text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-500">{stats.suspended}</p>
          <p className="text-xs text-gray-400 mt-1">bloqueadas / canceladas</p>
        </div>
      </div>

      {/* Filtros + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                filtro === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                  : `${f.color} border-transparent hover:border-gray-200`
              }`}
            >
              {f.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filtro === f.id ? 'bg-white/20 text-white' : 'bg-black/10'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Pesquisar nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:ml-auto border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-52"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-gray-300" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma subscrição encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Conta</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plano</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Créditos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Renovação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map(acc => {
                  const dias = diasParaRenovacao(acc.renovacao_em)
                  const pct = Math.min(Math.round((acc.creditos_usados / acc.creditos_limite) * 100), 100)
                  const expiring = (acc.billing_status === 'active' || acc.billing_status === 'trial') && dias <= 7 && dias > 0

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-gray-50/60 transition-colors ${expiring ? 'bg-orange-50/30' : ''}`}
                    >
                      {/* Conta */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{acc.nome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{acc.email}</p>
                      </td>

                      {/* Plano */}
                      <td className="px-4 py-4">
                        <span className="inline-block text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                          {planNome(acc.plano_id)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-4">
                        <Badge value={acc.billing_status} />
                      </td>

                      {/* Créditos */}
                      <td className="px-4 py-4 min-w-32">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-500">{acc.creditos_usados} / {acc.creditos_limite}</span>
                          <span className={pct > 80 ? 'text-red-500 font-semibold' : 'text-gray-400'}>{pct}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-red-400' : 'bg-indigo-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Renovação */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock size={11} />
                            {fmtDate(acc.renovacao_em)}
                          </div>
                          {dias !== Infinity && <RenovacaoBadge dias={dias} />}
                        </div>
                      </td>

                      {/* Acções */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Renovar */}
                          <button
                            title="Renovar +1 mês"
                            onClick={() => { setFeedback(''); setModal({ type: 'renew', account: acc }) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <RotateCcw size={11} />
                            Renovar
                          </button>

                          {/* Activar/Suspender */}
                          {acc.billing_status === 'suspended' || acc.billing_status === 'cancelled' ? (
                            <button
                              title="Activar conta"
                              onClick={async () => {
                                await api.setBillingStatus(acc.id, 'active')
                                load()
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              <CheckCircle size={11} />
                              Activar
                            </button>
                          ) : (
                            <button
                              title="Alterar estado"
                              onClick={() => { setFeedback(''); setNovoStatus(acc.billing_status); setMotivo(''); setModal({ type: 'status', account: acc }) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <TrendingUp size={11} />
                              Estado
                            </button>
                          )}

                          {/* Ver detalhe */}
                          <button
                            title="Ver conta"
                            onClick={() => navigate(`/accounts/${acc.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <ChevronRight size={14} />
                          </button>

                          {/* Eliminar */}
                          <button
                            title="Eliminar conta"
                            onClick={() => { setFeedback(''); setModal({ type: 'delete', account: acc }) }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — Renovar */}
      {modal?.type === 'renew' && (
        <Modal title="Renovar subscrição" onClose={() => setModal(null)} size="sm">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Conta:</span> {modal.account.nome}</p>
              <p><span className="font-medium">Plano:</span> {planNome(modal.account.plano_id)}</p>
              <p><span className="font-medium">Renovação actual:</span> {fmtDate(modal.account.renovacao_em)}</p>
              <p className="text-gray-500 text-xs pt-1">A nova data de renovação será +1 mês a partir da data actual. O estado será definido como <strong>Activo</strong>.</p>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {feedback}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenew}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Confirmar renovação
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal — Alterar estado */}
      {modal?.type === 'status' && (
        <Modal title="Alterar estado da subscrição" onClose={() => setModal(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Novo estado</label>
              <div className="grid grid-cols-2 gap-2">
                {(['trial', 'active', 'suspended', 'cancelled'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setNovoStatus(s)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                      novoStatus === s
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="ex: Pagamento recebido"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {feedback}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetStatus}
                disabled={submitting || !novoStatus}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <RefreshCw size={14} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal — Eliminar */}
      {modal?.type === 'delete' && (
        <Modal title="Eliminar conta" onClose={() => setModal(null)} size="sm">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Esta acção é irreversível.</p>
              <p>A conta de <strong>{modal.account.nome}</strong> ({modal.account.email}) será eliminada permanentemente do Firestore.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Plano:</span> {planNome(modal.account.plano_id)}</p>
              <p><span className="font-medium">License key:</span> <code className="text-xs text-gray-500">{modal.account.license_key}</code></p>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-sm ${feedback.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {feedback}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </Modal>
      )}

    </Layout>
  )
}
