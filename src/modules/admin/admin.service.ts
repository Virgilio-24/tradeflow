import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { Plan, LogLevel, BillingStatus } from '../../common/types';
import * as admin from 'firebase-admin';

@Injectable()
export class AdminService {
  constructor(private firebase: FirebaseService) {}

  // ── CONTAS ──

  async listAccounts() {
    const accounts = await this.firebase.listAccounts();
    return Promise.all(
      accounts.map(async (a) => {
        const stores = await this.firebase.listStoresByAccount(a.id);
        return {
          ...a,
          stores_count: stores.length,
          uso_pct: Math.round((a.creditos_usados / a.creditos_limite) * 100),
        };
      }),
    );
  }

  async createAccount(email: string, nome: string, plano_id: string) {
    const plan = await this.firebase.getPlan(plano_id);
    if (!plan) throw new NotFoundException(`Plan "${plano_id}" not found`);

    // Impede novo trial se já existir conta com este email
    if (plano_id === 'trial') {
      const existing = await this.firebase.getAccountByEmail(email);
      if (existing) {
        throw new Error(
          `O email "${email}" já usou o Trial. Escolhe um plano pago para continuar.`,
        );
      }
    }

    const licenseKey = 'tf_' + Array.from(
      { length: 32 },
      () => Math.random().toString(36)[2],
    ).join('');

    const renovacao = new Date();
    renovacao.setMonth(renovacao.getMonth() + 1);

    const isTrial = plano_id === 'trial';
    const id = await this.firebase.createAccount({
      license_key: licenseKey,
      email,
      nome,
      plano_id: plano_id as any,
      billing_status: 'trial',
      creditos_usados: 0,
      creditos_limite: plan.creditos_mes,
      creditos_extra: 0,
      whatsapp_ativo: isTrial,           // trial tem WhatsApp em modo teste
      whatsapp_numeros_max: isTrial ? (plan as any).whatsapp_numeros_max ?? 1 : -1,
      whatsapp_numeros_registados: [],
      renovacao_em: admin.firestore.Timestamp.fromDate(renovacao) as any,
      criado_em: admin.firestore.Timestamp.now() as any,
    });

    return { id, license_key: licenseKey };
  }

  async deleteAccount(id: string) {
    const account = await this.firebase.getAccount(id);
    if (!account) throw new NotFoundException('Account not found');
    await this.firebase.deleteAccount(id);
    return { ok: true };
  }

  async blockAccount(id: string, motivo?: string) {
    await this.firebase.updateAccount(id, { billing_status: 'suspended' as BillingStatus });
    await this.firebase.createLog({
      account_id: id,
      nivel: 'warning',
      mensagem: `Account blocked by admin. ${motivo ? 'Reason: ' + motivo : ''}`,
    });
    return { ok: true };
  }

  async unblockAccount(id: string) {
    await this.firebase.updateAccount(id, { billing_status: 'active' as BillingStatus });
    await this.firebase.createLog({
      account_id: id,
      nivel: 'info',
      mensagem: 'Account unblocked by admin',
    });
    return { ok: true };
  }

  async resetCredits(id: string) {
    await this.firebase.resetCredits(id, 'admin');
    return { ok: true };
  }

  async newLicenseKey(id: string) {
    const newKey = await this.firebase.generateNewLicenseKey(id, 'admin');
    return { license_key: newKey };
  }

  async changePlan(id: string, plano_id: string) {
    const plan = await this.firebase.getPlan(plano_id);
    if (!plan) throw new NotFoundException(`Plan "${plano_id}" not found`);
    await this.firebase.updateAccount(id, {
      plano_id: plano_id as any,
      creditos_limite: plan.creditos_mes,
    });
    return { ok: true };
  }

  async renewAccount(id: string) {
    const account = await this.firebase.getAccount(id);
    if (!account) throw new NotFoundException('Account not found');

    const base = account.renovacao_em
      ? new Date((account.renovacao_em as any).seconds * 1000)
      : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + 1);

    await this.firebase.updateAccount(id, {
      renovacao_em: admin.firestore.Timestamp.fromDate(base) as any,
      billing_status: 'active' as BillingStatus,
    });
    await this.firebase.createLog({
      account_id: id,
      nivel: 'info',
      mensagem: `Subscrição renovada pelo admin — nova data: ${base.toLocaleDateString('pt-PT')}`,
    });
    return { ok: true, renovacao_em: base.toISOString() };
  }

  async setBillingStatus(id: string, status: BillingStatus, motivo?: string) {
    await this.firebase.updateAccount(id, { billing_status: status });
    await this.firebase.createLog({
      account_id: id,
      nivel: status === 'suspended' || status === 'cancelled' ? 'warning' : 'info',
      mensagem: `Billing status alterado para "${status}" pelo admin.${motivo ? ' Motivo: ' + motivo : ''}`,
    });
    return { ok: true };
  }

  async addCredits(id: string, amount: number) {
    const account = await this.firebase.getAccount(id);
    if (!account) throw new NotFoundException('Account not found');
    await this.firebase.updateAccount(id, {
      creditos_limite: account.creditos_limite + amount,
    });
    await this.firebase.createLog({
      account_id: id,
      nivel: 'info',
      mensagem: `Admin added ${amount} credits manually`,
    });
    return { ok: true, novo_limite: account.creditos_limite + amount };
  }

  async listStores(accountId: string) {
    return this.firebase.listStoresByAccount(accountId);
  }

  async createStore(accountId: string, siteUrl: string, siteNome: string) {
    const account = await this.firebase.getAccount(accountId);
    if (!account) throw new NotFoundException('Account not found');
    const id = await this.firebase.createStore({
      account_id: accountId,
      site_url: siteUrl,
      site_nome: siteNome,
      activo: true,
      rate_limit: 10,
    } as any);
    await this.firebase.createLog({
      account_id: accountId,
      nivel: 'info',
      mensagem: `Store criada: ${siteUrl}`,
    });
    return { id };
  }

  async listJobs(accountId: string) {
    return this.firebase.listJobsByAccount(accountId);
  }

  // ── PLANOS ──

  async listPlans() {
    return this.firebase.listPlans();
  }

  async upsertPlan(id: string, data: Omit<Plan, 'id'>) {
    await this.firebase.upsertPlan(id, data);
    return { ok: true };
  }

  // ── LOGS ──

  async listLogs(filters: { accountId?: string; nivel?: LogLevel; limit?: number }) {
    return this.firebase.listLogs({
      account_id: filters.accountId,
      nivel: filters.nivel,
      limit: filters.limit,
    });
  }

  // ── JOBS ──

  async listAllJobs(filters: { status?: string; limit?: number }) {
    // Firebase query genérica por status
    const db = (this.firebase as any).db;
    let query = db.collection('jobs').orderBy('criado_em', 'desc');
    if (filters.status) query = query.where('status', '==', filters.status);
    query = query.limit(filters.limit ?? 50);
    const snap = await query.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }

  async retryJob(id: string) {
    const job = await this.firebase.getJob(id);
    if (!job) throw new NotFoundException('Job not found');
    await this.firebase.updateJobStatus(id, 'pending');
    await this.firebase.createLog({
      account_id: job.account_id,
      job_id: id,
      nivel: 'info',
      mensagem: 'Job manually retried by admin',
    });
    return { ok: true };
  }

  // ── STATS ──

  async getStats() {
    const [accounts, plans] = await Promise.all([
      this.firebase.listAccounts(),
      this.firebase.listPlans(),
    ]);

    const byStatus = accounts.reduce((acc, a) => {
      acc[a.billing_status] = (acc[a.billing_status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPlan = accounts.reduce((acc, a) => {
      acc[a.plano_id] = (acc[a.plano_id] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_accounts: accounts.length,
      by_status: byStatus,
      by_plan: byPlan,
      total_plans: plans.length,
    };
  }
}
