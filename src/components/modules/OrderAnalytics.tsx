import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Search } from 'lucide-react';
import { OrdersResponse } from '../../types/analytics';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { exportRowsToCsv, formatCurrency, formatCurrencyPrecise, formatMonthLabel, formatNumber } from '../../utils/formatters';

interface OrderAnalyticsProps {
  data: OrdersResponse;
  statusFilter: string;
  paymentFilter: string;
  searchQuery: string;
  onChangeStatusFilter: (val: string) => void;
  onChangePaymentFilter: (val: string) => void;
  onChangeSearchQuery: (val: string) => void;
  page: number;
  pageSize: number;
  onChangePage: (nextPage: number) => void;
}

export const OrderAnalytics: React.FC<OrderAnalyticsProps> = ({
  data,
  statusFilter,
  paymentFilter,
  searchQuery,
  onChangeStatusFilter,
  onChangePaymentFilter,
  onChangeSearchQuery,
  page,
  pageSize,
  onChangePage,
}) => {
  const [trendGranularity, setTrendGranularity] = useState<'monthly' | 'daily'>('monthly');

  const trendData =
    trendGranularity === 'monthly'
      ? data.monthlyTrends.map((m) => ({
          label: formatMonthLabel(m.month),
          total_orders: m.total_orders,
          completed_orders: m.completed_orders,
          cancelled_orders: m.cancelled_orders,
          revenue: m.revenue,
        }))
      : data.dailyTrends.slice(-45).map((d) => ({
          label: d.order_date.slice(5),
          total_orders: d.total_orders,
          completed_orders: d.completed_orders,
          cancelled_orders: d.cancelled_orders,
          revenue: d.revenue,
        }));

  const completedCount =
    data.statusSplit.find((s) => s.order_status === 'Completed')?.total_orders ?? 0;
  const cancelledCount =
    data.statusSplit.find((s) => s.order_status === 'Cancelled')?.total_orders ?? 0;
  const totalOrders = completedCount + cancelledCount;
  const totalPages = Math.max(1, Math.ceil(data.totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Order Volume & Transaction Trends
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {formatNumber(totalOrders)} total orders · {formatNumber(completedCount)} completed · {formatNumber(cancelledCount)} cancelled
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTrendGranularity('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                trendGranularity === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Monthly Trend
            </button>
            <button
              type="button"
              onClick={() => setTrendGranularity('daily')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                trendGranularity === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Daily Trend (Last 45d)
            </button>
          </div>

          <button
            type="button"
            onClick={() => exportRowsToCsv('filtered_orders_export.csv', data.orders)}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Daily / Monthly Trend Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {trendGranularity === 'monthly' ? 'Monthly Order Trends' : 'Orders by Date'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Completed vs cancelled order counts over time
          </p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomChartTooltip />} />
              <Line
                type="monotone"
                dataKey="completed_orders"
                name="Completed Orders"
                stroke={CHART_COLORS.primary}
                strokeWidth={2.2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="cancelled_orders"
                name="Cancelled Orders"
                stroke={CHART_COLORS.danger}
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders by City + Orders by Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Orders by City
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed and cancelled orders across metro markets
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCity} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="completed_orders" name="Completed" stackId="city" fill={CHART_COLORS.primary} />
                <Bar dataKey="cancelled_orders" name="Cancelled" stackId="city" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Orders by Payment Method
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transaction count and revenue distribution
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byPaymentMethod}
                    dataKey="total_orders"
                    nameKey="payment_method"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.byPaymentMethod.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS.palette[idx % CHART_COLORS.palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {data.byPaymentMethod.map((pm, idx) => (
                <div key={pm.payment_method} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: CHART_COLORS.palette[idx % CHART_COLORS.palette.length] }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {pm.payment_method}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatNumber(pm.total_orders)} · {formatCurrency(pm.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filterable Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="Search order ID, customer, or restaurant..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter order status"
              value={statusFilter}
              onChange={(e) => onChangeStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              aria-label="Filter payment method"
              value={paymentFilter}
              onChange={(e) => onChangePaymentFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="All">All Payment Methods</option>
              <option value="UPI">UPI</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Wallet">Wallet</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Date & Time</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Time</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No matching orders found for the active filters.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {o.order_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {o.order_datetime}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{o.customer_name}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {o.restaurant_name} · <span className="text-slate-500">{o.cuisine_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{o.city}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{o.payment_method}</td>
                    <td
                      className={`px-4 py-2.5 font-medium whitespace-nowrap ${
                        o.order_status === 'Completed'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {o.order_status}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {o.delivery_time_min ? `${o.delivery_time_min}m` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrencyPrecise(o.total_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Showing page {page} of {totalPages} ({formatNumber(data.totalCount)} total matching orders)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onChangePage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onChangePage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
