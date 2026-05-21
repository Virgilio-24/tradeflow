// ── PLANOS ──
export type PlanId = 'trial' | 'starter' | 'pro' | 'business';
export type BillingStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';
export type LogLevel = 'info' | 'warning' | 'error' | 'blocked';
export type JobType = 'import' | 'price_sync' | 'stock_sync' | 'translation';
export type MarketplaceSource = 'shein' | 'temu' | 'aliexpress' | 'zara' | 'hm' | 'shopee';

// ── JOB COST ──
export const JOB_COST: Record<JobType, number> = {
  import: 1,
  price_sync: 0.2,
  stock_sync: 0.2,
  translation: 2,
};

// ── FIREBASE DOCUMENTS ──
export interface Account {
  id: string;
  license_key: string;
  email: string;
  nome: string;
  plano_id: PlanId;
  billing_status: BillingStatus;
  creditos_usados: number;
  creditos_limite: number;
  renovacao_em: FirebaseFirestore.Timestamp;
  criado_em: FirebaseFirestore.Timestamp;
}

export interface Store {
  id: string;
  account_id: string;
  site_nome: string;
  site_url: string;
  activo: boolean;
  rate_limit: number;
  criado_em: FirebaseFirestore.Timestamp;
}

export interface Plan {
  id: string;
  nome: string;
  preco: number;
  creditos_mes: number;
  stores_max: number;
  concorrencia: number;
  rate_limit: number;
  fontes: MarketplaceSource[];
  activo: boolean;
}

export interface Job {
  id: string;
  account_id: string;
  store_id: string;
  url: string;
  fonte: MarketplaceSource;
  tipo: JobType;
  status: JobStatus;
  custo: number;
  resultado?: ProductData;
  raw_data?: unknown;
  erro?: string;
  tentativas: number;
  criado_em: FirebaseFirestore.Timestamp;
  concluido_em?: FirebaseFirestore.Timestamp;
  duracao_ms?: number;
}

export interface Log {
  id: string;
  account_id: string;
  store_id?: string;
  job_id?: string;
  nivel: LogLevel;
  mensagem: string;
  stack?: string;
  timestamp: FirebaseFirestore.Timestamp;
}

export interface TokenReset {
  id: string;
  account_id: string;
  feito_por: string;
  tipo: 'credits' | 'license_key';
  timestamp: FirebaseFirestore.Timestamp;
}

// ── PRODUTO NORMALIZADO ──
export interface ProductVariant {
  tamanho?: string;
  cor?: string;
  sku?: string;
  stock: number;
  preco_extra?: number;
}

export interface ProductData {
  nome: string;
  descricao: string;
  preco: number;
  preco_original?: number;
  moeda: string;
  imagens: string[];
  variantes: ProductVariant[];
  tamanhos: string[];
  cores: string[];
  tags: string[];
  categoria?: string;
  fonte_url: string;
  fonte_site: MarketplaceSource;
  raw_data?: unknown;
}
