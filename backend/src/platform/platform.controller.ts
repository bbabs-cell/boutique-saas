import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { PlatformSecretGuard } from '../common/guards/platform-secret.guard';

@Controller('platform')
@UseGuards(PlatformSecretGuard)
export class PlatformController {
  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * Confirme qu'un paiement d'abonnement a bien été reçu (ex. après vérification manuelle
   * d'un transfert Orange Money/Moov Money) — c'est ce seul appel qui active réellement le
   * changement de plan. À usage interne (toi), jamais exposé dans l'app cliente.
   */
  @Post('invoices/:id/confirm-payment')
  confirmPayment(@Param('id') id: string) {
    return this.subscriptionService.confirmPayment(id);
  }
}
