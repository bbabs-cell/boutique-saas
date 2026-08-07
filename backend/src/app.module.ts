import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { StockModule } from './stock/stock.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AccountingModule } from './accounting/accounting.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StoresModule } from './stores/stores.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PublicApiModule } from './public-api/public-api.module';
import { SyncModule } from './sync/sync.module';
import { GraphqlModule } from './graphql/graphql.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // Limite de débit par défaut, déclarée ici plutôt que dans un module métier : `forRoot()`
    // produit un module global, il ne peut donc y en avoir qu'une seule déclaration dans
    // l'application. Chaque contrôleur qui veut une limite l'active avec ThrottlerGuard et
    // peut resserrer la sienne avec @Throttle (voir AuthController).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    SalesModule,
    StockModule,
    CustomersModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ExpensesModule,
    AccountingModule,
    NotificationsModule,
    StoresModule,
    SubscriptionModule,
    AuditLogsModule,
    ApiKeysModule,
    WebhooksModule,
    PublicApiModule,
    SyncModule,
    GraphqlModule,
    PlatformModule,
  ],
})
export class AppModule {}
