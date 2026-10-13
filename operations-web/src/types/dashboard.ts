export type PageId =
  | 'dashboard'
  | 'analytics'
  | 'orders'
  | 'customers'
  | 'products'
  | 'payments'
  | 'transactions'
  | 'messages'
  | 'notifications'
  | 'settings';

export type TimePeriod = '7d' | '30d' | '3m' | '1y';

export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  numericValue: number;
  change: number;
  isPositive: boolean;
  timeframe: string;
  sparkline: number[];
  comparisonText: string;
  accent: 'blue' | 'cyan' | 'violet' | 'emerald';
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
  projected?: number;
}

export interface SalesChannel {
  name: string;
  value: number;
  revenue: number;
  color: string;
  growth: number;
}

export interface LiveActivityEvent {
  id: string;
  type: 'order' | 'payment' | 'customer' | 'refund' | 'inventory' | 'security';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  amount?: string;
}

export type OrderStatus = 'Completed' | 'Pending' | 'Processing' | 'Cancelled';

export interface OrderItem {
  id: string;
  customer: {
    name: string;
    email: string;
    avatar: string;
    initials: string;
  };
  product: {
    name: string;
    sku: string;
    category: string;
  };
  date: string;
  amount: number;
  payment: {
    method: 'Credit Card' | 'Stripe' | 'Apple Pay' | 'Crypto USDT' | 'PayPal';
    cardLast4?: string;
  };
  status: OrderStatus;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  unitsSold: number;
  revenue: number;
  growth: number;
  stock: number;
  rating: number;
  image: string;
}

export interface WorldSalesLocation {
  id: string;
  country: string;
  city: string;
  coordinates: [number, number]; // [xPercent, yPercent] for SVG projection
  revenue: number;
  orders: number;
  customers: number;
  growth: number;
  latency: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface CommandItem {
  id: string;
  title: string;
  category: 'Pages' | 'Actions' | 'Customers' | 'Orders';
  shortcut?: string;
  iconName: string;
  action: () => void;
}
