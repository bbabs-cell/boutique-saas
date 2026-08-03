import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { assertPlanFeature } from '../plan-limits';
import { PLAN_FEATURE_KEY } from '../decorators/plan.decorator';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true;

    await assertPlanFeature(this.prisma, user.tenantId, feature as 'fineRoles' | 'accounting' | 'publicApi');
    return true;
  }
}
