import React from 'react';
import {
  BarChart3,
  BookOpen,
  ChefHat,
  Database,
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { AppDataMode, ModuleKey } from '../types/analytics';

interface SidebarProps {
  activeModule: ModuleKey;
  onSelectModule: (key: ModuleKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  engineLabel: string;
  dataMode: AppDataMode;
  connectionStatus: string;
  modeNotice: string | null;
  onSwitchMode: (mode: AppDataMode) => void;
  switchingMode: boolean;
}

const NAV_ITEMS: Array<{ key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'orders', label: 'Order Analytics', icon: ShoppingBag },
  { key: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'delivery', label: 'Delivery Fleet', icon: Truck },
  { key: 'cuisines', label: 'Cuisines', icon: ChefHat },
  { key: 'data', label: 'Data Management', icon: Database },
  { key: 'sql-docs', label: 'SQL & Docs', icon: BookOpen },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  mobileOpen,
  onCloseMobile,
  engineLabel,
  dataMode,
  connectionStatus,
  modeNotice,
  onSwitchMode,
  switchingMode,
}) => {
  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
            DeliveryIQ Analytics
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onSelectModule(item.key);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
            Data Source
          </span>
          <span
            className={`font-medium whitespace-nowrap ${
              dataMode === 'mysql'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {connectionStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            disabled={switchingMode}
            onClick={() => onSwitchMode('demo')}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              dataMode === 'demo'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Demo Mode
          </button>
          <button
            type="button"
            disabled={switchingMode}
            onClick={() => onSwitchMode('mysql')}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              dataMode === 'mysql'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            MySQL Mode
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={engineLabel}>
          {engineLabel}
        </div>
        {modeNotice && (
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {modeNotice}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};
