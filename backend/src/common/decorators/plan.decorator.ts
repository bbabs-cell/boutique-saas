import { SetMetadata } from '@nestjs/common';
import { PlanFeature, PlanResource } from '../plan-limits';

export const PLAN_RESOURCE_KEY = 'planResource';
export const PlanLimitResource = (resource: PlanResource) => SetMetadata(PLAN_RESOURCE_KEY, resource);

export const PLAN_FEATURE_KEY = 'planFeature';
export const PlanFeatureRequired = (feature: PlanFeature) => SetMetadata(PLAN_FEATURE_KEY, feature);
