import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardSkeleton, ErrorBanner } from './components/ChartHelpers';
import { OverviewDashboard } from './components/modules/OverviewDashboard';
import { OrderAnalytics } from './components/modules/OrderAnalytics';
import { RestaurantPerformance } from './components/modules/RestaurantPerformance';
import { CustomerAnalytics } from './components/modules/CustomerAnalytics';
import { DeliveryPerformance } from './components/modules/DeliveryPerformance';
import { CuisineAnalytics } from './components/modules/CuisineAnalytics';
import { DataManagement } from './components/modules/DataManagement';
import { SqlAndDocsView } from './components/modules/SqlAndDocsView';
import { api } from './services/api';
import {
  AppDataMode,
  CuisinesResponse,
  CustomersResponse,
  DeliveryResponse,
  FilterMetadata,
  GlobalFilters,
  ModuleKey,
  OrdersResponse,
  OverviewResponse,
  RestaurantsResponse,
  SqlExplorerResponse,
} from './types/analytics';

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark';
  });

  const [engineLabel, setEngineLabel] = useState('Connecting to SQL database...');
  const [dataMode, setDataMode] = useState<AppDataMode>('demo');
  const [connectionStatus, setConnectionStatus] = useState('Demo Mode (Synthetic Data)');
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  const [filterMetadata, setFilterMetadata] = useState<FilterMetadata>({
    cities: [],
    cuisines: [],
    minDate: '',
    maxDate: '',
  });
  const [filters, setFilters] = useState<GlobalFilters>({
    city: 'All',
    cuisine: 'All',
    startDate: '',
    endDate: '',
  });

  // Module-specific local filters
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);

  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('All');

  // Module data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null);
  const [ordersData, setOrdersData] = useState<OrdersResponse | null>(null);
  const [restaurantsData, setRestaurantsData] = useState<RestaurantsResponse | null>(null);
  const [customersData, setCustomersData] = useState<CustomersResponse | null>(null);
  const [deliveryData, setDeliveryData] = useState<DeliveryResponse | null>(null);
  const [cuisinesData, setCuisinesData] = useState<CuisinesResponse | null>(null);
  const [sqlExplorerData, setSqlExplorerData] = useState<SqlExplorerResponse | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);

  // Sync dark mode class cleanly with <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load initial health & filter options
  useEffect(() => {
    Promise.all([api.getHealth(), api.getFilterMetadata()])
      .then(([health, meta]) => {
        setEngineLabel(health.engineLabel);
        setDataMode(health.mode);
        setConnectionStatus(health.connectionStatus);
        setModeNotice(health.fallbackReason);
        setFilterMetadata(meta);
      })
      .catch((err) => {
        console.error('Failed to load metadata:', err);
      });
  }, [refreshTick]);

  const loadActiveModuleData = useCallback(async () => {
    if (activeModule === 'data') {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (activeModule === 'overview') {
        const res = await api.getOverview(filters);
        setOverviewData(res);
      } else if (activeModule === 'orders') {
        const pageSize = 20;
        const res = await api.getOrders(filters, {
          status: orderStatusFilter,
          paymentMethod: orderPaymentFilter,
          search: orderSearch,
          limit: pageSize,
          offset: (orderPage - 1) * pageSize,
        });
        setOrdersData(res);
      } else if (activeModule === 'restaurants') {
        const res = await api.getRestaurants(filters.city, filters.cuisine, restaurantSearch);
        setRestaurantsData(res);
      } else if (activeModule === 'customers') {
        const res = await api.getCustomers(filters.city, customerSegmentFilter, customerSearch);
        setCustomersData(res);
      } else if (activeModule === 'delivery') {
        const res = await api.getDelivery(filters.city, vehicleFilter);
        setDeliveryData(res);
      } else if (activeModule === 'cuisines') {
        const res = await api.getCuisines(filters.city);
        setCuisinesData(res);
      } else if (activeModule === 'sql-docs') {
        const res = await api.getSqlExplorer();
        setSqlExplorerData(res);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    activeModule,
    filters,
    orderStatusFilter,
    orderPaymentFilter,
    orderSearch,
    orderPage,
    restaurantSearch,
    customerSegmentFilter,
    customerSearch,
    vehicleFilter,
    refreshTick,
  ]);

  useEffect(() => {
    loadActiveModuleData();
  }, [loadActiveModuleData]);

  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const handleSwitchMode = async (targetMode: AppDataMode) => {
    setSwitchingMode(true);
    try {
      const res = await api.switchMode(targetMode);
      setDataMode(res.mode);
      setConnectionStatus(res.connectionStatus);
      setModeNotice(res.message);
      triggerRefresh();
    } catch (err) {
      setModeNotice((err as Error).message);
    } finally {
      setSwitchingMode(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeModule={activeModule}
        onSelectModule={(m) => {
          setActiveModule(m);
          setOrderPage(1);
        }}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        engineLabel={engineLabel}
        dataMode={dataMode}
        connectionStatus={connectionStatus}
        modeNotice={modeNotice}
        onSwitchMode={handleSwitchMode}
        switchingMode={switchingMode}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeModule={activeModule}
          filters={filters}
          filterMetadata={filterMetadata}
          onChangeFilters={(next) => {
            setFilters(next);
            setOrderPage(1);
          }}
          onRefresh={triggerRefresh}
          isRefreshing={loading}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onOpenMobileMenu={() => setMobileOpen(true)}
          dataMode={dataMode}
          connectionStatus={connectionStatus}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {error ? (
            <ErrorBanner message={error} onRetry={triggerRefresh} />
          ) : loading && activeModule !== 'data' ? (
            <DashboardSkeleton />
          ) : activeModule === 'overview' && overviewData ? (
            <OverviewDashboard
              data={overviewData}
              onNavigateModule={(m) => setActiveModule(m)}
            />
          ) : activeModule === 'orders' && ordersData ? (
            <OrderAnalytics
              data={ordersData}
              statusFilter={orderStatusFilter}
              paymentFilter={orderPaymentFilter}
              searchQuery={orderSearch}
              onChangeStatusFilter={(val) => {
                setOrderStatusFilter(val);
                setOrderPage(1);
              }}
              onChangePaymentFilter={(val) => {
                setOrderPaymentFilter(val);
                setOrderPage(1);
              }}
              onChangeSearchQuery={(val) => {
                setOrderSearch(val);
                setOrderPage(1);
              }}
              page={orderPage}
              pageSize={20}
              onChangePage={setOrderPage}
            />
          ) : activeModule === 'restaurants' && restaurantsData ? (
            <RestaurantPerformance
              data={restaurantsData}
              searchQuery={restaurantSearch}
              onChangeSearchQuery={setRestaurantSearch}
            />
          ) : activeModule === 'customers' && customersData ? (
            <CustomerAnalytics
              data={customersData}
              segmentFilter={customerSegmentFilter}
              searchQuery={customerSearch}
              onChangeSegmentFilter={setCustomerSegmentFilter}
              onChangeSearchQuery={setCustomerSearch}
            />
          ) : activeModule === 'delivery' && deliveryData ? (
            <DeliveryPerformance
              data={deliveryData}
              vehicleFilter={vehicleFilter}
              onChangeVehicleFilter={setVehicleFilter}
            />
          ) : activeModule === 'cuisines' && cuisinesData ? (
            <CuisineAnalytics data={cuisinesData} />
          ) : activeModule === 'data' ? (
            <DataManagement onDataMutated={triggerRefresh} />
          ) : activeModule === 'sql-docs' && sqlExplorerData ? (
            <SqlAndDocsView data={sqlExplorerData} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
