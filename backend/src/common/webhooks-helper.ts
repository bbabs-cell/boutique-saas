import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface WebhookEvent {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Envoie un événement aux webhooks actifs du tenant qui y sont abonnés.
 * À appeler APRÈS qu'une transaction Prisma ait été validée (jamais depuis l'intérieur d'une
 * transaction : un appel HTTP sortant ne doit jamais retenir un verrou de base de données).
 * Un webhook qui échoue (URL injoignable, timeout…) n'affecte jamais l'action métier déclenchante.
 */
export async function dispatchWebhookEvent(
  prisma: PrismaService,
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId, active: true, events: { has: event } },
    });

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      webhooks.map((webhook) => {
        const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
        return fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
          body,
        });
      }),
    );
  } catch (err) {
    // Ceinture et bretelles : Promise.allSettled protège déjà chaque appel HTTP individuel,
    // mais une erreur AVANT (recherche des webhooks en base, `fetch` indisponible sur un
    // environnement Node ancien, etc.) ne doit pas non plus remonter et casser l'action métier
    // déclenchante (ex. l'encaissement d'une vente).
    console.error(`[webhooks] Échec du dispatch de l'événement "${event}" :`, err);
  }
}

/** Dispatche plusieurs événements collectés pendant une transaction, une fois celle-ci validée. */
export async function dispatchPendingWebhookEvents(
  prisma: PrismaService,
  tenantId: string,
  events: WebhookEvent[],
): Promise<void> {
  for (const { event, payload } of events) {
    await dispatchWebhookEvent(prisma, tenantId, event, payload);
  }
}
