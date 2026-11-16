import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Search } from 'lucide-react';
import { RestaurantsResponse } from '../../types/analytics';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { exportRowsToCsv, formatCurrency, formatNumber } from '../../utils/formatters';

interface RestaurantPerformanceProps {
  data: RestaurantsResponse;
  searchQuery: string;
  onChangeSearchQuery: (val: string) => void;
}

export const RestaurantPerformance: React.FC<RestaurantPerformanceProps> = ({
  data,
  searchQuery,
  onChangeSearchQuery,
}) => {
  const top10 = data.top10;
  const restaurants = data.restaurants;

  const top10Chart = top10.map((r) => ({
    name: r.restaurant_name.length > 20 ? `${r.restaurant_name.slice(0, 18)}…` : r.restaurant_name,
    fullName: r.restaurant_name,
    revenue: Number(r.total_revenue),
    orders: Number(r.total_orders),
    rating: Number(r.avg_rating ?? 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Restaurant Performance & Rankings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked via SQL view <span className="font-mono">vw_restaurant_rank</span> using DENSE_RANK() over completed revenue and ratings.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            exportRowsToCsv(
              'restaurant_performance_rank.csv',
              restaurants as unknown as Array<Record<string, unknown>>
            )
          }
          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Rankings
        </button>
      </div>

      {/* Top 10 Revenue + Orders Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Top 10 Restaurants by Revenue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed order revenue (INR)
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Chart}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      valueFormatter={(val) => formatCurrency(val)}
                    />
                  }
                />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Total Orders & Average Rating (Top 10)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Order volume per top-performing partner restaurant
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Chart}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="orders" name="Total Orders" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Full Restaurant Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Complete Restaurant Performance Matrix ({restaurants.length})
          </h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="Search restaurant, cuisine, or area..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Cuisine</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Cancel %</th>
                <th className="px-4 py-3 font-medium text-right">Avg Time</th>
                <th className="px-4 py-3 font-medium text-right">Avg Rating</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {restaurants.map((r) => (
                <tr key={r.restaurant_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    #{r.performance_rank}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.restaurant_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.cuisine_type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {r.area} · {r.city}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(r.total_orders)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums ${
                      Number(r.cancellation_rate_pct) > 15
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {Number(r.cancellation_rate_pct ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {r.avg_delivery_time_min ? `${Number(r.avg_delivery_time_min).toFixed(1)}m` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-amber-700 dark:text-amber-400">
                    {r.avg_rating ? Number(r.avg_rating).toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(r.total_revenue)}
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
