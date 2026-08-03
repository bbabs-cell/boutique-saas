export type Role = 'ADMIN' | 'MANAGER' | 'CAISSIER' | 'MAGASINIER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  theme: string;
  tenantId: string;
  tenantName: string;
  tvaEnabled: boolean;
  tvaRate: number;
  logoUrl: string | null;
  language: string;
  twoFactorEnabled: boolean;
}

export interface Store {
  id: string;
  name: string;
  address?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  stores: Store[];
  defaultStoreId: string | null;
}

export interface Category {
  id: string;
  name: string;
  tenantId: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
  category: Category | null;
  active: boolean;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'CARD' | 'CREDIT';
export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
}

export interface Sale {
  id: string;
  subtotal: number;
  discount: number;
  tvaAmount: number;
  total: number;
  status: SaleStatus;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
  user: { id: string; name: string };
  customer: { id: string; name: string; phone: string | null } | null;
}

export interface PaginatedSales {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type StockMovementType = 'SALE' | 'ADJUSTMENT' | 'RESTOCK';

export interface StockMovement {
  id: string;
  productId: string;
  product: Product;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  user: { id: string; name: string };
  createdAt: string;
}

export interface PaginatedStockMovements {
  items: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  creditBalance: number;
  creditLimit: number | null;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  user: { id: string; name: string };
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  sales: Sale[];
  payments: CustomerPayment[];
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PeriodMetrics {
  revenue: number;
  salesCount: number;
  profit: number;
}

export interface DashboardSummary {
  today: PeriodMetrics;
  week: PeriodMetrics;
  month: PeriodMetrics;
  lowStockCount: number;
}

export interface RevenueChartPoint {
  date: string;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface SalesReport {
  tenantName: string;
  period: { from: string; to: string };
  summary: PeriodMetrics;
  sales: Sale[];
}

export interface TenantSettings {
  id: string;
  name: string;
  currency: string;
  tvaEnabled: boolean;
  tvaRate: number;
  logoUrl: string | null;
  language: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  createdAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  status: PurchaseOrderStatus;
  total: number;
  createdAt: string;
  receivedAt: string | null;
  items: PurchaseOrderItem[];
  supplier: { id: string; name: string; phone: string | null };
  user: { id: string; name: string };
}

export interface SupplierPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  user: { id: string; name: string };
  createdAt: string;
}

export interface SupplierDetail extends Supplier {
  purchaseOrders: PurchaseOrder[];
  payments: SupplierPayment[];
}

export interface PaginatedSuppliers {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedPurchaseOrders {
  items: PurchaseOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Expense {
  id: string;
  label: string;
  amount: number;
  category: string | null;
  user: { id: string; name: string };
  createdAt: string;
}

export interface PaginatedExpenses {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AccountingSummary {
  period: { from: string; to: string };
  revenue: number;
  expenses: number;
  losses: number;
  netProfit: number;
  cashFlow: number;
  salesCount: number;
}

export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PAYMENT_RECEIVED'
  | 'SUBSCRIPTION_EXPIRING';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StoreUserAssignment {
  userId: string;
  storeId: string;
  user: { id: string; name: string; role: Role };
}

export interface StoreDetail extends Store {
  createdAt: string;
  userStores: StoreUserAssignment[];
}

export type PlanTier = 'FREE' | 'STARTER' | 'BUSINESS' | 'PREMIUM';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface PlanLimits {
  maxStores: number | null;
  maxProducts: number | null;
  fineRoles: boolean;
  accounting: boolean;
  publicApi: boolean;
}

export interface Subscription {
  id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  limits: PlanLimits;
  pendingInvoice: Invoice | null;
}

export interface Invoice {
  id: string;
  amount: number;
  plan: PlanTier;
  method: PaymentMethod | null;
  reference: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  user: { id: string; name: string; role: Role };
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiKey {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface ApiKeyWithPlainKey extends ApiKey {
  plainKey: string;
}

export type WebhookEventName = 'sale.created' | 'stock.low';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEventName[];
  active: boolean;
  createdAt: string;
}

export interface WebhookWithSecret extends Webhook {
  secret: string;
}
