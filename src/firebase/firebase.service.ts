import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  Account, Store, Plan, Job, Log, JobStatus,
  LogLevel, ProductData, JobType, JOB_COST,
} from '../common/types';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private db: admin.firestore.Firestore;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
    }
    this.db = admin.firestore();
    this.logger.log('Firebase connected');
  }

  // ── ACCOUNTS ──

  async getAccountByLicenseKey(key: string): Promise<Account | null> {
    const snap = await this.db.collection('accounts')
      .where('license_key', '==', key)
      .where('billing_status', 'in', ['trial', 'active'])
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Account;
  }

  async getAccount(id: string): Promise<Account | null> {
    const doc = await this.db.collection('accounts').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Account;
  }

  async listAccounts(): Promise<Account[]> {
    const snap = await this.db.collection('accounts')
      .orderBy('criado_em', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
  }

  async createAccount(data: Omit<Account, 'id'>): Promise<string> {
    const ref = await this.db.collection('accounts').add({
      ...data,
      criado_em: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<void> {
    await this.db.collection('accounts').doc(id).update(data);
  }

  async decrementCredits(accountId: string, cost: number): Promise<void> {
    await this.db.collection('accounts').doc(accountId).update({
      creditos_usados: admin.firestore.FieldValue.increment(cost),
    });
  }

  async resetCredits(accountId: string, feito_por: string): Promise<void> {
    await this.db.collection('accounts').doc(accountId).update({
      creditos_usados: 0,
    });
    await this.db.collection('token_resets').add({
      account_id: accountId,
      feito_por,
      tipo: 'credits',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async generateNewLicenseKey(accountId: string, feito_por: string): Promise<string> {
    const newKey = 'tf_' + Array.from(
      { length: 32 },
      () => Math.random().toString(36)[2]
    ).join('');
    await this.db.collection('accounts').doc(accountId).update({
      license_key: newKey,
    });
    await this.db.collection('token_resets').add({
      account_id: accountId,
      feito_por,
      tipo: 'license_key',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return newKey;
  }

  // ── STORES ──

  async getStoreByUrl(accountId: string, url: string): Promise<Store | null> {
    const normalised = url.replace(/https?:\/\//, '').replace(/\/$/, '');
    const snap = await this.db.collection('stores')
      .where('account_id', '==', accountId)
      .where('activo', '==', true)
      .get();
    const match = snap.docs.find(d => {
      const stored = (d.data().site_url as string)
        .replace(/https?:\/\//, '').replace(/\/$/, '');
      return stored === normalised || normalised.endsWith(stored) || stored.endsWith(normalised);
    });
    return match ? { id: match.id, ...match.data() } as Store : null;
  }

  async listStoresByAccount(accountId: string): Promise<Store[]> {
    const snap = await this.db.collection('stores')
      .where('account_id', '==', accountId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
  }

  async countStoresByAccount(accountId: string): Promise<number> {
    const snap = await this.db.collection('stores')
      .where('account_id', '==', accountId)
      .where('activo', '==', true).get();
    return snap.size;
  }

  async createStore(data: Omit<Store, 'id'>): Promise<string> {
    const ref = await this.db.collection('stores').add({
      ...data,
      criado_em: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async updateStore(id: string, data: Partial<Store>): Promise<void> {
    await this.db.collection('stores').doc(id).update(data);
  }

  // ── PLANS ──

  async getPlan(id: string): Promise<Plan | null> {
    const doc = await this.db.collection('plans').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Plan;
  }

  async listPlans(): Promise<Plan[]> {
    const snap = await this.db.collection('plans').orderBy('preco').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Plan));
  }

  async upsertPlan(id: string, data: Omit<Plan, 'id'>): Promise<void> {
    await this.db.collection('plans').doc(id).set(data, { merge: true });
  }

  // ── JOBS ──

  async createJob(data: Omit<Job, 'id' | 'criado_em' | 'tentativas'>): Promise<string> {
    const ref = await this.db.collection('jobs').add({
      ...data,
      tentativas: 0,
      criado_em: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async getJob(id: string): Promise<Job | null> {
    const doc = await this.db.collection('jobs').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Job;
  }

  async getNextPendingJob(): Promise<Job | null> {
    const snap = await this.db.collection('jobs')
      .where('status', '==', 'pending')
      .orderBy('criado_em', 'asc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Job;
  }

  async countActiveJobs(): Promise<number> {
    const snap = await this.db.collection('jobs')
      .where('status', '==', 'processing').get();
    return snap.size;
  }

  async updateJobStatus(id: string, status: JobStatus): Promise<void> {
    await this.db.collection('jobs').doc(id).update({
      status,
      ...(status === 'processing' && {
        tentativas: admin.firestore.FieldValue.increment(1),
      }),
    });
  }

  async completeJob(id: string, resultado: ProductData, durationMs: number): Promise<void> {
    await this.db.collection('jobs').doc(id).update({
      status: 'done',
      resultado,
      duracao_ms: durationMs,
      concluido_em: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async failJob(id: string, erro: string): Promise<void> {
    await this.db.collection('jobs').doc(id).update({
      status: 'error',
      erro,
      concluido_em: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async listJobsByAccount(accountId: string, limit = 50): Promise<Job[]> {
    const snap = await this.db.collection('jobs')
      .where('account_id', '==', accountId)
      .orderBy('criado_em', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
  }

  // ── LOGS ──

  async createLog(data: {
    account_id: string;
    store_id?: string;
    job_id?: string;
    nivel: LogLevel;
    mensagem: string;
    stack?: string;
  }): Promise<void> {
    await this.db.collection('logs').add({
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async listLogs(filters: {
    account_id?: string;
    nivel?: LogLevel;
    limit?: number;
  }): Promise<Log[]> {
    let query: admin.firestore.Query = this.db.collection('logs')
      .orderBy('timestamp', 'desc');
    if (filters.account_id) query = query.where('account_id', '==', filters.account_id);
    if (filters.nivel) query = query.where('nivel', '==', filters.nivel);
    query = query.limit(filters.limit ?? 100);
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Log));
  }
}
