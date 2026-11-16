import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChefHat, IndianRupee, Star, TrendingUp } from 'lucide-react';
import { CuisinesResponse } from '../../types/analytics';
import { KpiCard } from '../KpiCard';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface CuisineAnalyticsProps {
  data: CuisinesResponse;
}

export const CuisineAnalytics: React.FC<CuisineAnalyticsProps> = ({ data }) => {
  const cuisines = data.cuisines;
  const mostPopular = cuisines[0];
  const highestRevenue = [...cuisines].sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))[0];
  const highestRated = [...cuisines].sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating))[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Cuisine Demand & Category Performance
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Order volume, revenue contribution, average ticket size, and ratings across culinary categories.
        </p>
      </div>

      {/* Top Cuisine Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Cuisines"
          value={String(cuisines.length)}
          context="Distinct culinary categories"
          icon={ChefHat}
        />
        <KpiCard
          label="Most Popular Cuisine"
          value={mostPopular?.cuisine_type ?? '—'}
          context={
            mostPopular
              ? `${formatNumber(mostPopular.total_orders)} orders (${mostPopular.order_share_pct}%)`
              : 'No data'
          }
          icon={TrendingUp}
          tone="positive"
        />
        <KpiCard
          label="Top Revenue Cuisine"
          value={highestRevenue?.cuisine_type ?? '—'}
          context={highestRevenue ? formatCurrency(highestRevenue.total_revenue) : 'No data'}
          icon={IndianRupee}
          tone="positive"
        />
        <KpiCard
          label="Highest Rated Cuisine"
          value={highestRated?.cuisine_type ?? '—'}
          context={
            highestRated ? `${Number(highestRated.avg_rating).toFixed(2)} / 5.0 avg rating` : 'No data'
          }
          icon={Star}
        />
      </div>

      {/* Orders by Cuisine + Revenue by Cuisine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Orders by Cuisine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Most popular cuisine categories ranked by order count
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cuisines} margin={{ top: 10, right: 12, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="cuisine_type"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="total_orders" name="Total Orders" radius={[4, 4, 0, 0]}>
                  {cuisines.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS.palette[idx % CHART_COLORS.palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Revenue by Cuisine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed order revenue per cuisine category (INR)
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cuisines} margin={{ top: 10, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="cuisine_type"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                />
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
                <Bar dataKey="total_revenue" name="Revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cuisine Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Cuisine-Wise Ratings & Economics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Cuisine</th>
                <th className="px-5 py-3 font-medium text-right">Restaurants</th>
                <th className="px-5 py-3 font-medium text-right">Orders</th>
                <th className="px-5 py-3 font-medium text-right">Order Share</th>
                <th className="px-5 py-3 font-medium text-right">Avg Ticket</th>
                <th className="px-5 py-3 font-medium text-right">Avg Delivery</th>
                <th className="px-5 py-3 font-medium text-right">Avg Rating</th>
                <th className="px-5 py-3 font-medium text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cuisines.map((c) => (
                <tr key={c.cuisine_type} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {c.cuisine_type}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {c.restaurant_count}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(c.total_orders)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {c.order_share_pct.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(c.avg_order_value)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {Number(c.avg_delivery_time_min ?? 0).toFixed(1)}m
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums font-medium text-amber-700 dark:text-amber-400">
                    {Number(c.avg_rating ?? 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(c.total_revenue)}
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
