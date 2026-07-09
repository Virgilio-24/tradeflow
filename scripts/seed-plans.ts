import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.join(__dirname, '../.env.json')).serviceAccount
  ?? (() => { throw new Error('Set serviceAccount in .env.json or adjust path below'); })();

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

const plans = [
  {
    id: 'trial',
    nome: 'Trial',
    preco: 0,
    creditos_mes: 20,
    stores_max: 1,
    concorrencia: 1,
    rate_limit: 5,
    fontes: ['shein', 'temu', 'zara'],
    activo: true,
    requer_proxies: false,
  },
  {
    id: 'starter',
    nome: 'Starter',
    preco: 14,
    creditos_mes: 800,
    stores_max: 2,
    concorrencia: 2,
    rate_limit: 10,
    fontes: ['shein', 'temu', 'zara', 'hm', 'amazon', 'aboutyou'],
    activo: true,
    requer_proxies: false,
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 32,
    creditos_mes: 2500,
    stores_max: 5,
    concorrencia: 5,
    rate_limit: 20,
    fontes: ['shein', 'temu', 'zara', 'hm', 'aliexpress', 'amazon', 'aboutyou', 'bershka', 'pullandbear'],
    activo: true,
    requer_proxies: false,
  },
  {
    id: 'business',
    nome: 'Business',
    preco: 89,
    creditos_mes: 8000,
    stores_max: 20,
    concorrencia: 10,
    rate_limit: 50,
    fontes: ['shein', 'temu', 'zara', 'hm', 'aliexpress', 'amazon', 'aboutyou', 'bershka', 'pullandbear', 'zalando', 'shopee'],
    activo: true,
    requer_proxies: false,
  },
];

async function seed() {
  console.log('Seeding plans...');
  for (const plan of plans) {
    const { id, ...data } = plan;
    await db.collection('plans').doc(id).set(data, { merge: true });
    console.log(`✓ ${id} — €${data.preco}/mês, ${data.creditos_mes} créditos`);
  }
  console.log('\nDone! All plans seeded.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
