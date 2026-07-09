import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Modal } from '../components/Modal'
import { api } from '../api'
import { Plan } from '../types'
import { Plus, RefreshCw, Pencil, ToggleLeft, ToggleRight, Shield, ShieldOff, Trash2, ExternalLink } from 'lucide-react'

const EMPTY_PLAN: Omit<Plan, 'id'> = {
  nome: '',
  preco: 0,
  creditos_mes: 100,
  stores_max: 1,
  concorrencia: 1,
  rate_limit: 10,
  fontes: ['shein'],
  activo: true,
  requer_proxies: false,
  proxy_urls: [],
}

function maskProxy(url: string): string {
  try {
    const u = new URL(url)
    const creds = u.username ? `${u.username.slice(0, 3)}***:***@` : ''
    return `${u.protocol}//${creds}${u.host}`
  } catch {
    return url.slice(0, 30) + '...'
  }
}

export function Plans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; data: Omit<Plan, 'id'> } | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [newId, setNewId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newProxy, setNewProxy] = useState('')

  async function load() {
    setLoading(true)
    try { setPlans(await api.listPlans() as Plan[]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setIsNew(true); setNewId(''); setNewProxy('')
    setEditing({ id: '', data: { ...EMPTY_PLAN } }); setError('')
  }

  function openEdit(p: Plan) {
    setIsNew(false); setNewProxy('')
    setEditing({ id: p.id, data: {
      nome: p.nome, preco: p.preco, creditos_mes: p.creditos_mes,
      stores_max: p.stores_max, concorrencia: p.concorrencia,
      rate_limit: p.rate_limit, fontes: p.fontes, activo: p.activo,
      requer_proxies: p.requer_proxies ?? false,
      proxy_urls: p.proxy_urls ?? [],
    }})
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const id = isNew ? newId.trim() : editing.id
    if (!id) { setError('ID obrigatório'); return }
    setSubmitting(true)
    try {
      await api.upsertPlan(id, editing.data)
      setEditing(null); await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSubmitting(false) }
  }

  function updateField(key: keyof Omit<Plan, 'id'>, value: unknown) {
    if (!editing) return
    setEditing({ ...editing, data: { ...editing.data, [key]: value } })
  }

  function addProxy() {
    const url = newProxy.trim()
    if (!url) return
    try { new URL(url) } catch { setError('URL de proxy inválido'); return }
    const current = editing?.data.proxy_urls ?? []
    updateField('proxy_urls', [...current, url])
    setNewProxy(''); setError('')
  }

  function removeProxy(index: number) {
    const current = editing?.data.proxy_urls ?? []
    updateField('proxy_urls', current.filter((_, i) => i !== index))
  }

  return (
    <Layout
      title="Planos"
      actions={
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-sm">
          <Plus size={16} /> Novo Plano
        </button>
      }
    >
      <div className="flex justify-end mb-4">
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{p.nome}</h3>
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{p.id}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {p.preco === 0 ? 'Grátis' : `€${p.preco}/mês`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.activo
                    ? <ToggleRight size={22} className="text-green-500" />
                    : <ToggleLeft size={22} className="text-gray-300" />}
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Créditos/mês</span>
                  <span className="font-medium text-gray-900">{p.creditos_mes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stores máx.</span>
                  <span className="font-medium text-gray-900">{p.stores_max}</span>
                </div>
                <div className="flex justify-between">
                  <span>Concorrência</span>
                  <span className="font-medium text-gray-900">{p.concorrencia}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate limit</span>
                  <span className="font-medium text-gray-900">{p.rate_limit} req/min</span>
                </div>
                <div className="flex justify-between">
                  <span>Fontes</span>
                  <span className="font-medium text-gray-900">{p.fontes?.join(', ') || '—'}</span>
                </div>
              </div>

              {/* Proxy status */}
              <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl mb-4 ${p.requer_proxies ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                {p.requer_proxies
                  ? <><Shield size={13} /> Proxies obrigatórios — {p.proxy_urls?.length ?? 0} configurados</>
                  : <><ShieldOff size={13} /> Sem proxies</>}
              </div>

              <button onClick={() => openEdit(p)}
                className="flex items-center gap-2 w-full justify-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                <Pencil size={14} /> Editar
              </button>
            </div>
          ))}

          {plans.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <p>Nenhum plano criado ainda.</p>
              <button onClick={openNew} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">Criar primeiro plano</button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title={isNew ? 'Novo Plano' : `Editar — ${editing.id}`} onClose={() => setEditing(null)} size="lg">
          <form onSubmit={handleSave} className="space-y-4">
            {isNew && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID (slug único)</label>
                <input required value={newId} onChange={e => setNewId(e.target.value)}
                  placeholder="ex: starter, pro, business"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={editing.data.nome} onChange={e => updateField('nome', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço (€/mês)</label>
                <input required type="number" min={0} step={0.01} value={editing.data.preco} onChange={e => updateField('preco', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Créditos/mês</label>
                <input required type="number" min={1} value={editing.data.creditos_mes} onChange={e => updateField('creditos_mes', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stores máx.</label>
                <input required type="number" min={1} value={editing.data.stores_max} onChange={e => updateField('stores_max', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concorrência</label>
                <input required type="number" min={1} value={editing.data.concorrencia} onChange={e => updateField('concorrencia', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate limit (req/min)</label>
                <input required type="number" min={1} value={editing.data.rate_limit} onChange={e => updateField('rate_limit', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fontes (separadas por vírgula)</label>
              <input value={editing.data.fontes?.join(', ')} onChange={e => updateField('fontes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="shein, temu, zara, hm"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="activo" checked={editing.data.activo} onChange={e => updateField('activo', e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded" />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">Plano activo</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="requer_proxies" checked={editing.data.requer_proxies} onChange={e => updateField('requer_proxies', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded" />
                <label htmlFor="requer_proxies" className="text-sm font-medium text-gray-700">Requer proxies</label>
              </div>
            </div>

            {/* Proxy management */}
            {editing.data.requer_proxies && (
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Proxies configurados</p>
                    <p className="text-xs text-amber-600 mt-0.5">{editing.data.proxy_urls?.length ?? 0} proxy(s) — serão enviados em cada pedido</p>
                  </div>
                  <a href="https://iproyal.com/residential-proxies/" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium">
                    <ExternalLink size={12} /> Comprar proxies
                  </a>
                </div>

                {/* Lista de proxies */}
                {(editing.data.proxy_urls ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {(editing.data.proxy_urls ?? []).map((url, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2">
                        <code className="text-xs font-mono text-gray-600">{maskProxy(url)}</code>
                        <button type="button" onClick={() => removeProxy(i)}
                          className="text-red-400 hover:text-red-600 transition-colors ml-2 flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar proxy */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProxy}
                    onChange={e => setNewProxy(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProxy())}
                    placeholder="http://user:pass@host:port"
                    className="flex-1 border border-amber-200 bg-white rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  <button type="button" onClick={addProxy}
                    className="px-3 py-2 text-xs font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-400 transition-colors flex-shrink-0">
                    Adicionar
                  </button>
                </div>
                <p className="text-xs text-amber-600">Formato: <code className="font-mono">http://user:password@host:port</code></p>
              </div>
            )}

            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <button disabled={submitting} type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
              {submitting ? 'A guardar...' : 'Guardar Plano'}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
