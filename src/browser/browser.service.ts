import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface PoolEntry {
  page: Page;
  inUse: boolean;
}

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser;
  private context: BrowserContext;
  private pool: PoolEntry[] = [];
  private readonly POOL_SIZE = parseInt(process.env.BROWSER_POOL_SIZE ?? '3');

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    await this.launch();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async launch() {
    this.logger.log('Launching Chromium...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    // Contexto com stealth — evita detecção de bot
    this.context = await this.browser.newContext({
      userAgent: this.randomUserAgent(),
      viewport: { width: 1366 + Math.floor(Math.random() * 100), height: 768 },
      locale: 'pt-PT',
      timezoneId: 'Africa/Maputo',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      },
    });

    // Injectar scripts de stealth em cada nova página
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    // Pré-criar páginas no pool
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const page = await this.context.newPage();
      this.pool.push({ page, inUse: false });
    }

    this.logger.log(`Browser pool ready (${this.POOL_SIZE} pages)`);
  }

  async acquirePage(): Promise<Page> {
    const MAX_WAIT_MS = 30_000;
    const POLL_MS = 200;
    let waited = 0;

    while (waited < MAX_WAIT_MS) {
      const entry = this.pool.find(e => !e.inUse);
      if (entry) {
        entry.inUse = true;
        // Rodar user agent a cada uso
        await entry.page.setExtraHTTPHeaders({
          'User-Agent': this.randomUserAgent(),
        });
        return entry.page;
      }
      await this.sleep(POLL_MS);
      waited += POLL_MS;
    }

    throw new Error('Browser pool exhausted — no page available');
  }

  async releasePage(page: Page): Promise<void> {
    const entry = this.pool.find(e => e.page === page);
    if (!entry) return;

    try {
      // Limpar estado da página para o próximo uso
      await page.goto('about:blank');
      await page.context().clearCookies();
    } catch {
      // Se a página estiver corrompida, substituir por nova
      try {
        await entry.page.close();
        entry.page = await this.context.newPage();
      } catch { /* ignorar */ }
    }

    entry.inUse = false;
  }

  availablePages(): number {
    return this.pool.filter(e => !e.inUse).length;
  }

  private async close() {
    for (const entry of this.pool) {
      await entry.page.close().catch(() => {});
    }
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.logger.log('Browser closed');
  }

  private randomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
