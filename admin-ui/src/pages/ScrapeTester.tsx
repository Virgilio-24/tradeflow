import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Account, Store } from '../types'
import { Play, RefreshCw } from 'lucide-react'

const getBase = () => localStorage.getItem('tf_api_url') || 'http://localhost:3003'

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  processing: 'text-blue-600 bg-blue-50',
  done: 'text-green-600 bg-green-50',
  error: 'text-red-600 bg-red-50',
  failed: 'text-red-600 bg-red-50',
}

export function ScrapeTester() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [productUrl, setProductUrl] = useState('')
  const [jobType, setJobType] = useState('import')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const [jobStatus, setJobStatus] = useState('')

  useEffect(() => {
    api.listAccounts().then(data => setAccounts(data as Account[]))
  }, [])

  async function handleAccountChange(id: string) {
    const acc = accounts.find(a => a.id === id) ?? null
    setSelectedAccount(acc)
    setSelectedStore(null)
    setStores([])
    if (acc) {
      const strs = await api.listStores(acc.id)
      setStores(strs as Store[])
    }
  }

  const requestHeaders = selectedAccount && selectedStore
    ? {
        'Content-Type': 'application/json',
        'x-license-key': selectedAccount.license_key,
        'x-store-url': selectedStore.site_url,
      }
    : null

  const requestBody = { url: productUrl || 'https://www.shein.com/...', tipo: jobType }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount || !selectedStore || !productUrl) return
    setLoading(true)
    setError('')
    setResult(null)
    setJobId('')
    setJobStatus('')
    try {
      const res = await fetch(`${getBase()}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-license-key': selectedAccount.license_key,
          'x-store-url': selectedStore.site_url,
        },
        body: JSON.stringify({ url: productUrl, tipo: jobType }),
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      const data = await res.json()
      setJobId(data.job_id)
      setJobStatus('pending')
      pollJob(data.job_id, selectedAccount.license_key, selectedStore.site_url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function pollJob(id: string, licenseKey: string, storeUrl: string) {
    setPolling(true)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const res = await fetch(`${getBase()}/job/${id}`, {
          headers: { 'x-license-key': licenseKey, 'x-store-url': storeUrl },
        })
        const data = await res.json()
        setJobStatus(data.status)
        if (data.status === 'done') {
          setResult(data.resultado ?? data)
          break
        }
        if (data.status === 'error' || data.status === 'failed') {
          setError(data.erro ?? 'Job falhou sem mensagem de erro')
          break
        }
      } catch { /* ignorar erros de polling */ }
    }
    setPolling(false)
  }

  return (
    <Layout title="Teste de Scraping">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Coluna esquerda: configuração + preview */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Configuração do Pedido</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Conta</label>
                <select
                  value={selectedAccount?.id ?? ''}
                  onChange={e => handleAccountChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">Seleccionar conta...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nome} ({a.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Store</label>
                <select
                  value={selectedStore?.id ?? ''}
                  onChange={e => setSelectedStore(stores.find(s => s.id === e.target.value) ?? null)}
                  disabled={stores.length === 0}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {stores.length === 0 && selectedAccount ? 'Sem stores — adiciona uma na página da conta' : 'Seleccionar store...'}
                  </option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.site_nome ?? s.site_url}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">URL do Produto</label>
                <input
                  required
                  value={productUrl}
                  onChange={e => setProductUrl(e.target.value)}
                  placeholder="https://www.shein.com/..."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de Job</label>
                <select
                  value={jobType}
                  onChange={e => setJobType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="import">import — 1.0 crédito</option>
                  <option value="price_sync">price_sync — 0.2 créditos</option>
                  <option value="stock_sync">stock_sync — 0.2 créditos</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || polling || !selectedAccount || !selectedStore || !productUrl}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors"
              >
                {loading || polling
                  ? <RefreshCw size={15} className="animate-spin" />
                  : <Play size={15} />
                }
                {loading
                  ? 'A criar job...'
                  : polling
                  ? `A aguardar... (${jobStatus})`
                  : 'Executar Scrape'}
              </button>
            </form>
          </div>

          {/* Preview do pedido */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview do Pedido</h3>
            <p className="text-xs font-mono text-indigo-600 mb-3">POST {getBase()}/scrape</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Headers</p>
                <pre className="bg-gray-50 rounded-xl p-3.5 text-xs font-mono text-gray-600 overflow-auto">
{requestHeaders
  ? JSON.stringify(requestHeaders, null, 2)
  : `{\n  "x-license-key": "— seleccionar conta —",\n  "x-store-url": "— seleccionar store —"\n}`}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Body</p>
                <pre className="bg-gray-50 rounded-xl p-3.5 text-xs font-mono text-gray-600 overflow-auto">
{JSON.stringify(requestBody, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita: resposta */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Resposta</h3>
              {jobId && (
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-400 truncate max-w-[140px]">{jobId}</code>
                  {jobStatus && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[jobStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                      {jobStatus}
                    </span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {!result && !error && !jobId && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                <Play size={44} className="mb-3" />
                <p className="text-sm font-medium">Sem resposta</p>
                <p className="text-xs mt-1">Configura e executa um pedido para ver o resultado</p>
              </div>
            )}

            {polling && !result && !error && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw size={36} className="animate-spin mb-3" />
                <p className="text-sm font-medium">A aguardar scraping...</p>
                <p className="text-xs mt-1 text-gray-300">Pode demorar 10–30 segundos</p>
              </div>
            )}

            {result && (
              <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-auto flex-1">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>

      </div>
    </Layout>
  )
}
