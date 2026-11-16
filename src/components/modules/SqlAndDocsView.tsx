import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { SqlExplorerResponse } from '../../types/analytics';

interface SqlAndDocsViewProps {
  data: SqlExplorerResponse;
}

type DocTab = 'queries' | 'schema' | 'powerbi' | 'excel' | 'windows';

export const SqlAndDocsView: React.FC<SqlAndDocsViewProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<DocTab>('queries');
  const [selectedQueryId, setSelectedQueryId] = useState<string>(
    data.queries[0]?.id ?? 'q1_executive_kpis'
  );

  const activeQuery =
    data.queries.find((q) => q.id === selectedQueryId) ?? data.queries[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            SQL Analytics, Schema & Integration Guides
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live verification of {data.queries.length} analytical SQL queries, MySQL views, Power BI DAX model, Excel cleaning workflow, and downloadable SQL scripts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          {(
            [
              ['queries', 'Live SQL Queries'],
              ['schema', 'MySQL Schema & Views'],
              ['powerbi', 'Power BI Guide'],
              ['excel', 'Excel Cleaning'],
              ['windows', 'Windows Setup'],
            ] as Array<[DocTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'queries' && activeQuery && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1 self-start max-h-[38rem] overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {data.queries.length} Core Analytical Queries
            </div>
            {data.queries.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedQueryId(q.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  q.id === activeQuery.id
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {q.title}
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {activeQuery.title}
              </h3>
              <pre className="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                {activeQuery.sql}
              </pre>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Live Query Output ({activeQuery.rows.length} rows)
              </div>
              <div className="overflow-x-auto">
                {activeQuery.rows.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500">Query returned 0 rows.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        {Object.keys(activeQuery.rows[0]).map((col) => (
                          <th key={col} className="px-4 py-2.5 font-mono font-medium whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeQuery.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {Object.values(row).map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-4 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap"
                            >
                              {val === null || val === undefined ? 'NULL' : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Download MySQL 8.0 Database Scripts (<span className="font-mono">food_delivery_analytics</span>):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(['schema.sql', 'seed.sql', 'views.sql', 'queries.sql'] as const).map((file) => (
                <a
                  key={file}
                  href={`/api/data/download/database/${file}`}
                  download={file}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                  {file}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                database/schema.sql (5 Normalized Tables)
              </h3>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-auto max-h-[32rem] leading-relaxed">
                {data.schemaSql}
              </pre>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                database/views.sql (vw_peak_hours &amp; vw_restaurant_rank)
              </h3>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-auto max-h-[32rem] leading-relaxed">
                {data.viewsSql}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'powerbi' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Microsoft Power BI Desktop Integration
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Full instructions saved in <span className="font-mono">docs/POWER_BI_INTEGRATION.md</span>.
            </p>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed">
            <li>Install <strong>MySQL Connector/NET</strong> and open <strong>Power BI Desktop</strong>.</li>
            <li>Select <strong>Get Data → Database → MySQL database</strong>, enter server <span className="font-mono">localhost:3306</span> and database <span className="font-mono">food_delivery_analytics</span>.</li>
            <li>Load the 5 tables (<span className="font-mono">Customers</span>, <span className="font-mono">Restaurants</span>, <span className="font-mono">Delivery_Partners</span>, <span className="font-mono">Orders</span>, <span className="font-mono">Ratings</span>) and 2 views (<span className="font-mono">vw_peak_hours</span>, <span className="font-mono">vw_restaurant_rank</span>).</li>
            <li>Configure a Star Schema in Model View linking dimension keys to <span className="font-mono">Orders</span>.</li>
          </ol>
          <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`Total Revenue = CALCULATE(SUM(Orders[total_amount]), Orders[order_status] = "Completed")
Cancellation Rate % = DIVIDE(CALCULATE(COUNTROWS(Orders), Orders[order_status] = "Cancelled"), COUNTROWS(Orders), 0)
On-Time Delivery % = 1 - DIVIDE(CALCULATE(COUNTROWS(Orders), Orders[order_status] = "Completed", Orders[delivery_time_min] > 40), CALCULATE(COUNTROWS(Orders), Orders[order_status] = "Completed"), 0)
Repeat Customers = COUNTROWS(FILTER(VALUES(Orders[customer_id]), CALCULATE(COUNTROWS(Orders)) >= 2))`}
          </pre>
        </div>
      )}

      {activeTab === 'excel' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Advanced Microsoft Excel Cleaning Workflow
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Full instructions saved in <span className="font-mono">docs/EXCEL_DATA_CLEANING_GUIDE.md</span>.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Whitespace & Case Normalization:</strong> Use <span className="font-mono">=PROPER(TRIM(CLEAN(H2)))</span> across city, customer, and restaurant names.</li>
            <li><strong>Duplicate Detection:</strong> Apply Conditional Formatting → Duplicate Values on <span className="font-mono">order_id</span>, then run <strong>Data → Remove Duplicates</strong>.</li>
            <li><strong>Missing Financial Fields:</strong> Recalculate total amounts via <span className="font-mono">=IF(OR(L2=&quot;&quot;,L2&lt;=0), MAX(0,I2+J2-K2), L2)</span>.</li>
            <li><strong>Referential Integrity:</strong> Validate restaurant IDs with <span className="font-mono">=IFERROR(XLOOKUP(D2, Restaurants!$B$2:$B$100, Restaurants!$A$2:$A$100), &quot;UNMATCHED&quot;)</span>.</li>
            <li><strong>SLA PivotTable:</strong> Add helper column <span className="font-mono">=IF([@[delivery_time_min]]&gt;40, &quot;Delayed&quot;, &quot;On-Time&quot;)</span> and summarize by City and Cuisine.</li>
          </ul>
        </div>
      )}

      {activeTab === 'windows' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Running Locally on Windows with MySQL 8.0
          </h3>
          <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`# 1. Initialize MySQL schema, views, and synthetic seed data
mysql -u root -p < database\\schema.sql
mysql -u root -p < database\\views.sql
mysql -u root -p < database\\seed.sql

# 2. Configure environment variables
copy .env.example .env
# Edit .env and set DB_HOST=localhost, DB_USER=root, DB_PASSWORD=..., DB_NAME=food_delivery_analytics

# 3. Install packages and launch full-stack Express + React server
npm install
npm run dev

# Open http://localhost:3000 in your browser`}
          </pre>
        </div>
      )}
    </div>
  );
};
