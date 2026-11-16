import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, IndianRupee, ShoppingBag, Star, XCircle } from 'lucide-react';
import { OverviewResponse } from '../../types/analytics';
import { KpiCard } from '../KpiCard';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { formatCurrency, formatMonthLabel, formatNumber } from '../../utils/formatters';

interface OverviewDashboardProps {
  data: OverviewResponse;
  onNavigateModule: (module: 'restaurants' | 'orders') => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  data,
  onNavigateModule,
}) => {
  const { kpis, monthlyTrends, peakHours, cityRevenue, topRestaurants } = data;

  const monthlyData = monthlyTrends.map((m) => ({
    ...m,
    monthLabel: formatMonthLabel(m.month),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Executive Performance Summary
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            SQL-aggregated metrics across orders, revenue, delivery SLA, and customer satisfaction (synthetic demonstration data).
          </p>
        </div>
      </div>

      {/* 5 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Orders"
          value={formatNumber(kpis.total_orders)}
          context={`${formatNumber(kpis.completed_orders)} completed · ${formatNumber(kpis.cancelled_orders)} cancelled`}
          icon={ShoppingBag}
        />
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(kpis.total_revenue)}
          context={`Avg ticket ${formatCurrency(kpis.avg_order_value)}`}
          icon={IndianRupee}
          tone="positive"
        />
        <KpiCard
          label="Avg Delivery Time"
          value={`${Number(kpis.avg_delivery_time_min ?? 0).toFixed(1)} min`}
          context="SLA target ≤ 40 min"
          icon={Clock}
          tone={Number(kpis.avg_delivery_time_min) > 38 ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="Avg Customer Rating"
          value={`${Number(kpis.avg_customer_rating ?? 0).toFixed(2)} / 5.0`}
          context="Weighted food & delivery"
          icon={Star}
          tone="positive"
        />
        <KpiCard
          label="Cancellation Rate"
          value={`${Number(kpis.cancellation_pct ?? 0).toFixed(1)}%`}
          context={`${formatNumber(kpis.cancelled_orders)} cancelled orders`}
          icon={XCircle}
          tone={Number(kpis.cancellation_pct) > 12 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Revenue Trend + Orders by Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Revenue Trends
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monthly completed order revenue in INR
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      valueFormatter={(val) => formatCurrency(val)}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Orders by Month
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed vs cancelled order volume per month
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="completed_orders" name="Completed" stackId="a" fill={CHART_COLORS.secondary} radius={[0, 0, 0, 0]} />
                <Bar dataKey="cancelled_orders" name="Cancelled" stackId="a" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Peak Ordering Hours (vw_peak_hours) + City Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Peak Ordering Hours
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Powered by SQL view <span className="font-mono">vw_peak_hours</span> — highlights Lunch (12–14h) and Dinner (19–22h) demand peaks
              </p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="hour_label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      valueFormatter={(val, name) =>
                        name === 'Revenue' ? formatCurrency(val) : formatNumber(val)
                      }
                    />
                  }
                />
                <Bar dataKey="total_orders" name="Orders" radius={[4, 4, 0, 0]}>
                  {peakHours.map((entry, idx) => {
                    const isPeak =
                      (entry.order_hour >= 12 && entry.order_hour <= 14) ||
                      (entry.order_hour >= 19 && entry.order_hour <= 22);
                    return (
                      <Cell
                        key={idx}
                        fill={isPeak ? CHART_COLORS.primary : '#94A3B8'}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* City Revenue Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                City-Wise Revenue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completed order distribution
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateModule('orders')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              View orders
            </button>
          </div>
          <div className="space-y-3.5 flex-1">
            {cityRevenue.map((item) => {
              const maxRev = Math.max(...cityRevenue.map((c) => Number(c.total_revenue)), 1);
              const pct = Math.round((Number(item.total_revenue) / maxRev) * 100);
              return (
                <div key={item.city} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.city}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrency(item.total_revenue)} · {item.total_orders} orders
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-600 dark:bg-teal-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Ranked Restaurants Snapshot */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Top Ranked Restaurants
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live ranking from SQL view <span className="font-mono">vw_restaurant_rank</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateModule('restaurants')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Full Leaderboard
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Restaurant</th>
                <th className="px-5 py-3 font-medium">Cuisine</th>
                <th className="px-5 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium text-right">Orders</th>
                <th className="px-5 py-3 font-medium text-right">Revenue</th>
                <th className="px-5 py-3 font-medium text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topRestaurants.map((r) => (
                <tr key={r.restaurant_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    #{r.performance_rank}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.restaurant_name}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{r.cuisine_type}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{r.city}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(r.total_orders)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(r.total_revenue)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                    {Number(r.avg_rating ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
