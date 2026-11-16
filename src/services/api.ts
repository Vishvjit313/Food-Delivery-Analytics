import {
  CuisinesResponse,
  CustomersResponse,
  DataPreviewResponse,
  DeliveryResponse,
  FilterMetadata,
  GlobalFilters,
  HealthResponse,
  ImportResponse,
  OrdersResponse,
  OverviewResponse,
  RestaurantsResponse,
  SqlExplorerResponse,
} from '../types/analytics';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'All') {
      sp.set(k, String(v));
    }
  });
  const q = sp.toString();
  return q ? `?${q}` : '';
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.details || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => fetchJson<HealthResponse>('/api/health'),

  getFilterMetadata: () => fetchJson<FilterMetadata>('/api/analytics/filters'),

  getOverview: (filters: GlobalFilters) =>
    fetchJson<OverviewResponse>(
      `/api/analytics/overview${buildQuery({
        city: filters.city,
        cuisine: filters.cuisine,
        startDate: filters.startDate,
        endDate: filters.endDate,
      })}`
    ),

  getOrders: (
    filters: GlobalFilters,
    extra: {
      status?: string;
      paymentMethod?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) =>
    fetchJson<OrdersResponse>(
      `/api/analytics/orders${buildQuery({
        city: filters.city,
        cuisine: filters.cuisine,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: extra.status,
        paymentMethod: extra.paymentMethod,
        search: extra.search,
        limit: extra.limit,
        offset: extra.offset,
      })}`
    ),

  getRestaurants: (city: string, cuisine: string, search: string) =>
    fetchJson<RestaurantsResponse>(
      `/api/analytics/restaurants${buildQuery({ city, cuisine, search })}`
    ),

  getCustomers: (city: string, segment: string, search: string) =>
    fetchJson<CustomersResponse>(
      `/api/analytics/customers${buildQuery({ city, segment, search })}`
    ),

  getDelivery: (city: string, vehicleType: string) =>
    fetchJson<DeliveryResponse>(
      `/api/analytics/delivery${buildQuery({ city, vehicleType })}`
    ),

  getCuisines: (city: string) =>
    fetchJson<CuisinesResponse>(`/api/analytics/cuisines${buildQuery({ city })}`),

  getSqlExplorer: () => fetchJson<SqlExplorerResponse>('/api/analytics/sql-explorer'),

  getDataPreview: (table: string, limit = 30) =>
    fetchJson<DataPreviewResponse>(`/api/data/preview${buildQuery({ table, limit })}`),

  importOrders: (
    rows: Array<Record<string, unknown>>,
    options: { skipDuplicates: boolean; fillMissingDefaults: boolean; normalizeText: boolean }
  ) =>
    fetchJson<ImportResponse>('/api/data/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, options }),
    }),

  resetBaselineData: () =>
    fetchJson<{ status: string; message: string }>('/api/data/reset', {
      method: 'POST',
    }),

  switchMode: (mode: 'demo' | 'mysql') =>
    fetchJson<{ switched: boolean; mode: 'demo' | 'mysql'; connectionStatus: string; message: string }>(
      '/api/data/mode',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      }
    ),
};
