export type BillingStatus = 'trial' | 'active' | 'suspended' | 'cancelled'
export type LogLevel = 'info' | 'warning' | 'error'
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed'
export type JobType = 'import' | 'price_sync' | 'stock_sync' | 'translation'

export interface Account {
  id: string
  license_key: string
  email: string
  nome: string
  plano_id: string
  billing_status: BillingStatus
  creditos_usados: number
  creditos_limite: number
  stores_count?: number
  uso_pct?: number
  criado_em?: { seconds: number }
  renovacao_em?: { seconds: number }
}

export interface Plan {
  id: string
  nome: string
  preco: number
  creditos_mes: number
  stores_max: number
  concorrencia: number
  rate_limit: number
  fontes: string[]
  activo: boolean
  requer_proxies: boolean
  proxy_urls?: string[]
}

export interface Job {
  id: string
  account_id: string
  store_url: string
  url: string
  tipo: JobType
  status: JobStatus
  criado_em?: { seconds: number }
  resultado?: unknown
  erro?: string
}

export interface Log {
  id: string
  account_id: string
  job_id?: string
  nivel: LogLevel
  mensagem: string
  criado_em?: { seconds: number }
}

export interface Store {
  id: string
  account_id: string
  site_url: string
  site_nome?: string
  activo: boolean
  rate_limit?: number
  criado_em?: { _seconds?: number; seconds?: number }
}

export interface Stats {
  total_accounts: number
  by_status: Record<string, number>
  by_plan: Record<string, number>
  total_plans: number
}
