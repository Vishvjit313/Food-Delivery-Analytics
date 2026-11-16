export type ModuleKey =
  | 'overview'
  | 'orders'
  | 'restaurants'
  | 'customers'
  | 'delivery'
  | 'cuisines'
  | 'data'
  | 'sql-docs';

export interface GlobalFilters {
  city: string;
  cuisine: string;
  startDate: string;
  endDate: string;
}

export interface FilterMetadata {
  cities: string[];
  cuisines: string[];
  minDate: string;
  maxDate: string;
}

export type AppDataMode = 'demo' | 'mysql';

export interface HealthResponse {
  status: string;
  mode: AppDataMode;
  connectionStatus: string;
  dialect: 'mysql' | 'sqlite';
  engineLabel: string;
  mysqlConfigured: boolean;
  fallbackReason: string | null;
  syntheticDataNotice: string;
}

export interface ModeSwitchResponse {
  switched: boolean;
  mode: AppDataMode;
  connectionStatus: string;
  message: string;
}

export interface OverviewResponse {
  kpis: {
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue: number;
    avg_order_value: number;
    avg_delivery_time_min: number;
    cancellation_pct: number;
    avg_customer_rating: number;
  };
  monthlyTrends: Array<{
    month: string;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    revenue: number;
  }>;
  peakHours: Array<{
    order_hour: number;
    hour_label: string;
    total_orders: number;
    completed_orders: number;
    total_revenue: number;
    demand_window: string;
  }>;
  cityRevenue: Array<{
    city: string;
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
  }>;
  topRestaurants: Array<{
    restaurant_id: number;
    restaurant_name: string;
    cuisine_type: string;
    city: string;
    total_orders: number;
    total_revenue: number;
    avg_rating: number;
    performance_rank: number;
  }>;
}

export interface OrdersResponse {
  dailyTrends: Array<{
    order_date: string;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    revenue: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    revenue: number;
  }>;
  byCity: Array<{
    city: string;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    revenue: number;
  }>;
  byPaymentMethod: Array<{
    payment_method: string;
    total_orders: number;
    revenue: number;
  }>;
  statusSplit: Array<{
    order_status: string;
    total_orders: number;
    total_amount: number;
  }>;
  orders: Array<{
    order_id: string;
    order_datetime: string;
    city: string;
    customer_name: string;
    restaurant_name: string;
    cuisine_type: string;
    partner_name: string | null;
    order_amount: number;
    delivery_fee: number;
    discount_amount: number;
    total_amount: number;
    payment_method: string;
    order_status: 'Completed' | 'Cancelled';
    delivery_time_min: number | null;
    distance_km: number;
    cancellation_reason: string | null;
    overall_rating: number | null;
  }>;
  totalCount: number;
}

export interface RestaurantRankRow {
  restaurant_id: number;
  restaurant_name: string;
  cuisine_type: string;
  city: string;
  area: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  cancellation_rate_pct: number;
  total_revenue: number;
  avg_order_value: number;
  avg_rating: number;
  avg_delivery_time_min: number;
  performance_rank: number;
}

export interface RestaurantsResponse {
  top10: RestaurantRankRow[];
  restaurants: RestaurantRankRow[];
}

export interface CustomersResponse {
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    repeatCustomers: number;
    repeatRatePct: number;
    avgOrdersPerCustomer: number;
    avgLifetimeSpend: number;
  };
  byCity: Array<{
    city: string;
    customers: number;
    repeatCustomers: number;
    totalRevenue: number;
  }>;
  bySegment: Array<{
    segment: string;
    customers: number;
    totalOrders: number;
    totalRevenue: number;
  }>;
  orderFrequencyCohorts: Array<{
    bucket: string;
    customers: number;
  }>;
  topCustomers: Array<{
    customer_id: number;
    full_name: string;
    email: string;
    city: string;
    signup_date: string;
    customer_segment: string;
    total_orders: number;
    completed_orders: number;
    total_spent: number;
    avg_order_value: number;
    last_order_date: string | null;
  }>;
}

export interface DeliveryResponse {
  summary: {
    totalPartners: number;
    totalDeliveries: number;
    delayedDeliveries: number;
    delayedRatePct: number;
    avgDeliveryTimeMin: number;
    avgDeliveryRating: number;
  };
  partners: Array<{
    partner_id: number;
    partner_name: string;
    vehicle_type: string;
    city: string;
    joining_date: string;
    assigned_orders: number;
    delivered_orders: number;
    avg_delivery_time_min: number;
    delayed_deliveries: number;
    on_time_pct: number;
    avg_delivery_rating: number;
    avg_distance_km: number;
  }>;
  timeBuckets: Array<{
    bucket: string;
    order_count: number;
  }>;
  byCity: Array<{
    city: string;
    delivered_orders: number;
    avg_delivery_time_min: number;
    delayed_deliveries: number;
  }>;
}

export interface CuisinesResponse {
  cuisines: Array<{
    cuisine_type: string;
    restaurant_count: number;
    total_orders: number;
    completed_orders: number;
    total_revenue: number;
    avg_order_value: number;
    avg_rating: number;
    avg_delivery_time_min: number;
    order_share_pct: number;
  }>;
}

export interface SqlExplorerResponse {
  queries: Array<{
    id: string;
    title: string;
    sql: string;
    rows: Array<Record<string, unknown>>;
  }>;
  schemaSql: string;
  viewsSql: string;
  queriesSql?: string;
}

export interface DataPreviewResponse {
  table: string;
  counts: Record<string, number>;
  rows: Array<Record<string, unknown>>;
}

export interface ImportResponse {
  summary: {
    totalProcessed: number;
    insertedCount: number;
    duplicateCount: number;
    errorCount: number;
    filledMissingCount: number;
  };
  rowResults: Array<{
    rowNumber: number;
    orderId: string;
    status: 'inserted' | 'duplicate' | 'error';
    message: string;
  }>;
}
