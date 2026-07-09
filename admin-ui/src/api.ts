const getBase = () => localStorage.getItem('tf_api_url') || 'http://localhost:3003'
const getToken = () => localStorage.getItem('tf_admin_token') || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': getToken(),
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  // Auth check
  checkAuth: () => request('/admin/stats'),

  // Stats
  stats: () => request('/admin/stats'),

  // Accounts
  listAccounts: () => request('/admin/accounts'),
  createAccount: (data: { email: string; nome: string; plano_id: string }) =>
    request('/admin/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    request(`/admin/accounts/${id}`, { method: 'DELETE' }),
  blockAccount: (id: string, motivo?: string) =>
    request(`/admin/accounts/${id}/block`, { method: 'PUT', body: JSON.stringify({ motivo }) }),
  unblockAccount: (id: string) =>
    request(`/admin/accounts/${id}/unblock`, { method: 'PUT', body: JSON.stringify({}) }),
  resetCredits: (id: string) =>
    request(`/admin/accounts/${id}/reset-credits`, { method: 'PUT', body: JSON.stringify({}) }),
  newLicenseKey: (id: string) =>
    request(`/admin/accounts/${id}/new-key`, { method: 'PUT', body: JSON.stringify({}) }),
  changePlan: (id: string, plano_id: string) =>
    request(`/admin/accounts/${id}/plan`, { method: 'PUT', body: JSON.stringify({ plano_id }) }),
  addCredits: (id: string, amount: number) =>
    request(`/admin/accounts/${id}/credits/add`, { method: 'PUT', body: JSON.stringify({ amount }) }),
  renewAccount: (id: string) =>
    request(`/admin/accounts/${id}/renew`, { method: 'PUT', body: JSON.stringify({}) }),
  setBillingStatus: (id: string, status: string, motivo?: string) =>
    request(`/admin/accounts/${id}/billing-status`, { method: 'PUT', body: JSON.stringify({ status, motivo }) }),
  listStores: (id: string) => request(`/admin/accounts/${id}/stores`),
  createStore: (id: string, data: { site_url: string; site_nome: string }) =>
    request(`/admin/accounts/${id}/stores`, { method: 'POST', body: JSON.stringify(data) }),
  listAccountJobs: (id: string) => request(`/admin/accounts/${id}/jobs`),

  // Plans
  listPlans: () => request('/admin/plans'),
  upsertPlan: (id: string, data: object) =>
    request(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Logs
  listLogs: (params?: { account_id?: string; nivel?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.account_id) q.set('account_id', params.account_id)
    if (params?.nivel) q.set('nivel', params.nivel)
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return request(`/admin/logs${qs ? '?' + qs : ''}`)
  },

  // Jobs
  listAllJobs: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return request(`/admin/jobs${qs ? '?' + qs : ''}`)
  },
  retryJob: (id: string) =>
    request(`/admin/jobs/${id}/retry`, { method: 'POST', body: JSON.stringify({}) }),
}
