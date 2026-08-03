import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { assertWithinResourceLimit } from '../plan-limits';
import { PLAN_RESOURCE_KEY } from '../decorators/plan.decorator';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<string>(PLAN_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!resource) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true; // JwtAuthGuard s'en charge déjà

    await assertWithinResourceLimit(this.prisma, user.tenantId, resource as 'stores' | 'products');
    return true;
  }
}
