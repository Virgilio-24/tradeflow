import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { Account, Store } from '../../common/types';

export interface AuthenticatedRequest extends Request {
  account: Account;
  store: Store;
}

@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);

  constructor(private firebase: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const licenseKey = req.headers['x-license-key'];
    const storeUrl = req.headers['x-store-url'];

    if (!licenseKey) {
      throw new UnauthorizedException('x-license-key header required');
    }
    if (!storeUrl) {
      throw new UnauthorizedException('x-store-url header required');
    }

    // 1. Validar license key
    const account = await this.firebase.getAccountByLicenseKey(licenseKey);
    if (!account) {
      await this.firebase.createLog({
        account_id: 'unknown',
        nivel: 'warning',
        mensagem: `Invalid license key attempt: ${licenseKey.substring(0, 8)}...`,
      });
      throw new UnauthorizedException('License key inválida ou inactiva.');
    }

    // 2. Validar billing status
    if (account.billing_status === 'suspended') {
      throw new HttpException(
        'Conta suspensa. Contacta o suporte.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    if (account.billing_status === 'cancelled') {
      throw new HttpException('Conta cancelada.', HttpStatus.PAYMENT_REQUIRED);
    }

    // 3. Validar store
    const store = await this.firebase.getStoreByUrl(account.id, storeUrl);
    if (!store) {
      await this.firebase.createLog({
        account_id: account.id,
        nivel: 'warning',
        mensagem: `Unregistered store attempt: ${storeUrl}`,
      });
      throw new ForbiddenException(
        `Loja "${storeUrl}" não registada. Adiciona-a na tua conta.`,
      );
    }

    if (!store.activo) {
      throw new ForbiddenException('Store is deactivated.');
    }

    // 4. Verificar créditos (plano + avulso)
    const limiteTotal = account.creditos_limite + (account.creditos_extra ?? 0);
    if (account.creditos_usados >= limiteTotal) {
      await this.firebase.createLog({
        account_id: account.id,
        store_id: store.id,
        nivel: 'blocked',
        mensagem: `Credits exhausted: ${account.creditos_usados}/${limiteTotal}`,
      });
      throw new HttpException(
        {
          error: 'Limite de produtos atingido',
          used: account.creditos_usados,
          limit: limiteTotal,
          upgrade: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    req.account = account;
    req.store = store;
    return true;
  }
}
