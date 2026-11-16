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
import { AlertTriangle, Clock, Star, Truck } from 'lucide-react';
import { DeliveryResponse } from '../../types/analytics';
import { KpiCard } from '../KpiCard';
import { CHART_COLORS, CustomChartTooltip } from '../ChartHelpers';
import { formatNumber } from '../../utils/formatters';

interface DeliveryPerformanceProps {
  data: DeliveryResponse;
  vehicleFilter: string;
  onChangeVehicleFilter: (val: string) => void;
}

export const DeliveryPerformance: React.FC<DeliveryPerformanceProps> = ({
  data,
  vehicleFilter,
  onChangeVehicleFilter,
}) => {
  const { summary, partners, timeBuckets, byCity } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Delivery Fleet & SLA Performance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Partner delivery speed, delayed deliveries (&gt;40 min threshold), and customer delivery ratings.
          </p>
        </div>

        <select
          aria-label="Filter by vehicle type"
          value={vehicleFilter}
          onChange={(e) => onChangeVehicleFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 self-start sm:self-auto"
        >
          <option value="All">All Vehicle Types</option>
          <option value="Bike">Bike</option>
          <option value="Scooter">Scooter</option>
          <option value="EV Scooter">EV Scooter</option>
          <option value="Bicycle">Bicycle</option>
        </select>
      </div>

      {/* Delivery KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Delivery Partners"
          value={formatNumber(summary.totalPartners)}
          context={`${formatNumber(summary.totalDeliveries)} completed deliveries`}
          icon={Truck}
        />
        <KpiCard
          label="Avg Delivery Time"
          value={`${summary.avgDeliveryTimeMin.toFixed(1)} min`}
          context="Target SLA ≤ 40.0 min"
          icon={Clock}
          tone={summary.avgDeliveryTimeMin > 36 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Delayed Deliveries"
          value={formatNumber(summary.delayedDeliveries)}
          context={`${summary.delayedRatePct.toFixed(1)}% exceeded 40 min`}
          icon={AlertTriangle}
          tone={summary.delayedRatePct > 15 ? 'danger' : 'warning'}
        />
        <KpiCard
          label="Avg Delivery Rating"
          value={`${summary.avgDeliveryRating.toFixed(2)} / 5.0`}
          context="Partner handoff satisfaction"
          icon={Star}
          tone="positive"
        />
      </div>

      {/* Time Buckets + City SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delivery Time Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Completed orders grouped by transit time window
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeBuckets} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="order_count" name="Orders" radius={[4, 4, 0, 0]}>
                  {timeBuckets.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.bucket.includes('Delayed')
                          ? CHART_COLORS.danger
                          : entry.bucket.includes('Express')
                          ? CHART_COLORS.success
                          : CHART_COLORS.primary
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Average Delivery Time by City
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mean minutes per completed order across cities
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      valueFormatter={(val, name) =>
                        name.includes('Time') ? `${val.toFixed(1)} min` : formatNumber(val)
                      }
                    />
                  }
                />
                <Bar dataKey="avg_delivery_time_min" name="Avg Delivery Time (min)" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Delivery Partner Leaderboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Delivery Partner Performance Matrix ({partners.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium text-right">Delivered</th>
                <th className="px-4 py-3 font-medium text-right">Avg Distance</th>
                <th className="px-4 py-3 font-medium text-right">Avg Time</th>
                <th className="px-4 py-3 font-medium text-right">Delayed (&gt;40m)</th>
                <th className="px-4 py-3 font-medium text-right">On-Time SLA</th>
                <th className="px-4 py-3 font-medium text-right">Partner Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {partners.map((p) => (
                <tr key={p.partner_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {p.partner_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.vehicle_type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.city}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatNumber(p.delivered_orders)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {Number(p.avg_distance_km ?? 0).toFixed(1)} km
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {Number(p.avg_delivery_time_min ?? 0).toFixed(1)} min
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums ${
                      Number(p.delayed_deliveries) > 5
                        ? 'text-rose-700 dark:text-rose-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {formatNumber(p.delayed_deliveries)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                    {p.on_time_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                    {Number(p.avg_delivery_rating ?? 0).toFixed(2)}
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
