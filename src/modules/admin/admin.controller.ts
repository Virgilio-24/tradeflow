import {
  Controller, Get, Post, Put, Delete, Body, Param,
  Query, Headers, UnauthorizedException, HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ConfigService } from '@nestjs/config';

@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private config: ConfigService,
  ) {}

  private validateAdmin(token: string) {
    if (token !== this.config.get('ADMIN_SECRET')) {
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  // ── CONTAS ──

  @Get('accounts')
  async listAccounts(@Headers('x-admin-token') token: string) {
    this.validateAdmin(token);
    return this.admin.listAccounts();
  }

  @Post('accounts')
  @HttpCode(201)
  async createAccount(
    @Headers('x-admin-token') token: string,
    @Body() body: { email: string; nome: string; plano_id: string },
  ) {
    this.validateAdmin(token);
    return this.admin.createAccount(body.email, body.nome, body.plano_id);
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.deleteAccount(id);
  }

  @Put('accounts/:id/block')
  async blockAccount(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { motivo?: string },
  ) {
    this.validateAdmin(token);
    return this.admin.blockAccount(id, body.motivo);
  }

  @Put('accounts/:id/unblock')
  async unblockAccount(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.unblockAccount(id);
  }

  @Put('accounts/:id/reset-credits')
  async resetCredits(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.resetCredits(id);
  }

  @Put('accounts/:id/new-key')
  async newLicenseKey(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.newLicenseKey(id);
  }

  @Put('accounts/:id/plan')
  async changePlan(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { plano_id: string },
  ) {
    this.validateAdmin(token);
    return this.admin.changePlan(id, body.plano_id);
  }

  @Put('accounts/:id/renew')
  async renewAccount(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.renewAccount(id);
  }

  @Put('accounts/:id/billing-status')
  async setBillingStatus(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { status: string; motivo?: string },
  ) {
    this.validateAdmin(token);
    return this.admin.setBillingStatus(id, body.status as any, body.motivo);
  }

  @Put('accounts/:id/credits/add')
  async addCredits(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    this.validateAdmin(token);
    return this.admin.addCredits(id, body.amount);
  }

  @Put('accounts/:id/credits/deduct')
  async deductCredits(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    this.validateAdmin(token);
    return this.admin.deductCredits(id, body.amount ?? 1);
  }

  @Get('accounts/:id/stores')
  async listStores(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.listStores(id);
  }

  @Post('accounts/:id/stores')
  @HttpCode(201)
  async createStore(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: { site_url: string; site_nome: string },
  ) {
    this.validateAdmin(token);
    return this.admin.createStore(id, body.site_url, body.site_nome);
  }

  @Get('accounts/:id/jobs')
  async listJobs(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.listJobs(id);
  }

  // ── PLANOS ──

  @Get('plans')
  async listPlans(@Headers('x-admin-token') token: string) {
    this.validateAdmin(token);
    return this.admin.listPlans();
  }

  @Put('plans/:id')
  async upsertPlan(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.validateAdmin(token);
    return this.admin.upsertPlan(id, body);
  }

  // ── LOGS ──

  @Get('logs')
  async listLogs(
    @Headers('x-admin-token') token: string,
    @Query('account_id') accountId?: string,
    @Query('nivel') nivel?: string,
    @Query('limit') limit?: string,
  ) {
    this.validateAdmin(token);
    return this.admin.listLogs({ accountId, nivel: nivel as any, limit: limit ? parseInt(limit) : 100 });
  }

  // ── JOBS ──

  @Get('jobs')
  async listAllJobs(
    @Headers('x-admin-token') token: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    this.validateAdmin(token);
    return this.admin.listAllJobs({ status, limit: limit ? parseInt(limit) : 50 });
  }

  @Post('jobs/:id/retry')
  async retryJob(
    @Headers('x-admin-token') token: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(token);
    return this.admin.retryJob(id);
  }

  // ── STATS ──

  @Get('stats')
  async getStats(@Headers('x-admin-token') token: string) {
    this.validateAdmin(token);
    return this.admin.getStats();
  }
}
