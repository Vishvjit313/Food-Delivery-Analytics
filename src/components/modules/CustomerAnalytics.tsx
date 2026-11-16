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
import { IndianRupee, Repeat, Search, ShoppingBag, Users } from 'lucide-react';
import { CustomersResponse } from '../../types/analytics';
import { KpiCard } from '../KpiCard';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface CustomerAnalyticsProps {
  data: CustomersResponse;
  segmentFilter: string;
  searchQuery: string;
  onChangeSegmentFilter: (val: string) => void;
  onChangeSearchQuery: (val: string) => void;
}

export const CustomerAnalytics: React.FC<CustomerAnalyticsProps> = ({
  data,
  segmentFilter,
  searchQuery,
  onChangeSegmentFilter,
  onChangeSearchQuery,
}) => {
  const { summary, byCity, bySegment, orderFrequencyCohorts, topCustomers } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Customer Behavior & Retention
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Repeat purchasing cohorts, city distribution, and lifetime spend segmentation.
        </p>
      </div>

      {/* Customer KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Customers"
          value={formatNumber(summary.totalCustomers)}
          context={`${formatNumber(summary.activeCustomers)} with ≥ 1 order`}
          icon={Users}
        />
        <KpiCard
          label="Repeat Customers"
          value={formatNumber(summary.repeatCustomers)}
          context={`${summary.repeatRatePct.toFixed(1)}% repeat rate`}
          icon={Repeat}
          tone="positive"
        />
        <KpiCard
          label="Avg Orders / Customer"
          value={summary.avgOrdersPerCustomer.toFixed(2)}
          context="Across active cohort"
          icon={ShoppingBag}
        />
        <KpiCard
          label="Avg Lifetime Spend"
          value={formatCurrency(summary.avgLifetimeSpend)}
          context="Completed order value"
          icon={IndianRupee}
          tone="positive"
        />
      </div>

      {/* City Distribution + Order Frequency Cohorts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Customer Distribution by City
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total registered vs repeat customers per city
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="customers" name="Total Customers" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="repeatCustomers" name="Repeat Customers" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Customer Ordering Frequency
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribution of customers by lifetime order count
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderFrequencyCohorts} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="customers" name="Customers" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Segment Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bySegment.map((seg) => (
          <div
            key={seg.segment}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Segment · {seg.segment}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatNumber(seg.customers)} customers
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {formatNumber(seg.totalOrders)} total orders
              </div>
            </div>
            <div className="text-right font-mono text-sm font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
              {formatCurrency(seg.totalRevenue)}
            </div>
          </div>
        ))}
      </div>

      {/* Top Customers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Top Customers by Lifetime Value
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onChangeSearchQuery(e.target.value)}
                placeholder="Search customer..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              aria-label="Filter customer segment"
              value={segmentFilter}
              onChange={(e) => onChangeSegmentFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="All">All Segments</option>
              <option value="VIP">VIP</option>
              <option value="Regular">Regular</option>
              <option value="New">New</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Segment</th>
                <th className="px-4 py-3 font-medium">Signup Date</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Avg Ticket</th>
                <th className="px-4 py-3 font-medium text-right">Total Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topCustomers.map((c) => (
                <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{c.full_name}</div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.city}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{c.customer_segment}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {c.signup_date}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {c.total_orders}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {formatCurrency(c.avg_order_value)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(c.total_spent)}
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
