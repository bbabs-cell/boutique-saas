import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiSecurity, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PublicPaginationQueryDto, publicPaginationQuerySchema } from './dto/public-api.dto';

interface RequestWithTenant extends Request {
  tenantId: string;
}

@ApiTags('Public API v1')
@ApiSecurity('apiKey')
@Controller('v1')
@UseGuards(ApiKeyGuard, ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PublicApiController {
  constructor(private publicApiService: PublicApiService) {}

  @Get('products')
  @ApiOperation({ summary: 'Catalogue produits (lecture seule)' })
  getProducts(
    @Req() req: RequestWithTenant,
    @Query(new ZodValidationPipe(publicPaginationQuerySchema)) query: PublicPaginationQueryDto,
  ) {
    return this.publicApiService.getProducts(req.tenantId, query);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Ventes validées (lecture seule)' })
  getSales(
    @Req() req: RequestWithTenant,
    @Query(new ZodValidationPipe(publicPaginationQuerySchema)) query: PublicPaginationQueryDto,
  ) {
    return this.publicApiService.getSales(req.tenantId, query);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Niveaux de stock par boutique (lecture seule)' })
  getStock(
    @Req() req: RequestWithTenant,
    @Query(new ZodValidationPipe(publicPaginationQuerySchema)) query: PublicPaginationQueryDto,
  ) {
    return this.publicApiService.getStock(req.tenantId, query);
  }
}
