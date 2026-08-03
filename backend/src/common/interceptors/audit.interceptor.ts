import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Modules dont les actions ne sont pas journalisées : trop bruyantes ou pas pertinentes
// pour un journal d'audit métier (connexion, notifications marquées comme lues, le journal
// d'audit lui-même pour éviter le bruit auto-référentiel).
const SKIPPED_ENTITY_TYPES = ['auth', 'notifications', 'audit-logs'];

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'code', 'currentPassword'];

const KNOWN_SUB_ACTIONS = [
  'cancel',
  'receive',
  'upgrade',
  'import',
  'export',
  'read',
  'read-all',
  'logo',
  'users',
  'payments',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Préfère le pattern de route (ex. "/api/products/:id") s'il est disponible : plus fiable
    // que l'URL réelle pour identifier de façon générique le type d'entité concerné.
    const rawPath: string = req.route?.path ?? req.originalUrl ?? req.url ?? '';
    const segments = rawPath.split('?')[0].split('/').filter(Boolean);
    const entityType = segments[0] === 'api' ? segments[1] : segments[0];

    if (!entityType || SKIPPED_ENTITY_TYPES.includes(entityType)) {
      return next.handle();
    }

    const lastSegment = segments[segments.length - 1];
    const verb = KNOWN_SUB_ACTIONS.includes(lastSegment)
      ? lastSegment
      : method === 'POST'
        ? 'create'
        : method === 'DELETE'
          ? 'delete'
          : 'update';
    const action = `${entityType}.${verb}`;

    return next.handle().pipe(
      tap((responseBody: any) => {
        const user = req.user;
        if (!user) return; // pas d'utilisateur authentifié (ex. échec avant le guard) : rien à journaliser

        const entityId = req.params?.id ?? responseBody?.id ?? 'n/a';
        const metadata = this.sanitize(req.body);

        // Ne bloque jamais la requête métier si la journalisation échoue.
        this.prisma.auditLog
          .create({
            data: {
              tenantId: user.tenantId,
              userId: user.userId,
              action,
              entityType,
              entityId: String(entityId),
              metadata: metadata as Prisma.InputJsonValue | undefined,
            },
          })
          .catch(() => {});
      }),
    );
  }

  private sanitize(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const field of SENSITIVE_FIELDS) delete clone[field];
    return Object.keys(clone).length > 0 ? clone : undefined;
  }
}
