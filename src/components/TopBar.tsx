import React from 'react';
import { Database, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { AppDataMode, FilterMetadata, GlobalFilters, ModuleKey } from '../types/analytics';

interface TopBarProps {
  activeModule: ModuleKey;
  filters: GlobalFilters;
  filterMetadata: FilterMetadata;
  onChangeFilters: (next: GlobalFilters) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenMobileMenu: () => void;
  dataMode: AppDataMode;
  connectionStatus: string;
}

const MODULE_TITLES: Record<ModuleKey, string> = {
  overview: 'Overview Dashboard',
  orders: 'Order Analytics',
  restaurants: 'Restaurant Performance',
  customers: 'Customer Analytics',
  delivery: 'Delivery Performance',
  cuisines: 'Cuisine Analytics',
  data: 'Data Management',
  'sql-docs': 'SQL Analytics & Documentation',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeModule,
  filters,
  filterMetadata,
  onChangeFilters,
  onRefresh,
  isRefreshing,
  darkMode,
  onToggleDarkMode,
  onOpenMobileMenu,
  dataMode,
  connectionStatus,
}) => {
  const showGlobalFilters = activeModule !== 'data' && activeModule !== 'sql-docs';

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Food Delivery Analytics
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
            {MODULE_TITLES[activeModule]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {showGlobalFilters && (
          <div className="hidden md:flex items-center gap-2">
            <select
              aria-label="Filter by city"
              value={filters.city}
              onChange={(e) => onChangeFilters({ ...filters, city: e.target.value })}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="All">All Cities</option>
              {filterMetadata.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {(activeModule === 'overview' ||
              activeModule === 'orders' ||
              activeModule === 'restaurants') && (
              <select
                aria-label="Filter by cuisine"
                value={filters.cuisine}
                onChange={(e) => onChangeFilters({ ...filters, cuisine: e.target.value })}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="All">All Cuisines</option>
                {filterMetadata.cuisines.map((cu) => (
                  <option key={cu} value={cu}>
                    {cu}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div
          className={`hidden xl:flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 ${
            dataMode === 'mysql'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          title={`Database Connection: ${connectionStatus}`}
        >
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span>{dataMode === 'mysql' ? 'MySQL Connected' : 'Demo Mode'}</span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh analytics data"
          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center shrink-0"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
