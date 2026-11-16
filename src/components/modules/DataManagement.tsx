import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { api } from '../../services/api';
import { DataPreviewResponse, ImportResponse } from '../../types/analytics';
import { exportRowsToCsv, formatNumber } from '../../utils/formatters';

interface DataManagementProps {
  onDataMutated: () => void;
}

interface ParsedUploadRow {
  rowNumber: number;
  order_id: string;
  customer_name: string;
  customer_email?: string;
  restaurant_name: string;
  cuisine_type: string;
  partner_name: string;
  order_datetime: string;
  city: string;
  order_amount: string | number;
  delivery_fee: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  payment_method: string;
  order_status: string;
  delivery_time_min: string | number;
  distance_km: string | number;
  overall_rating: string | number;
  validationStatus: 'valid' | 'duplicate' | 'warning' | 'error';
  validationNote: string;
}

const TABLES = ['Orders', 'Restaurants', 'Customers', 'Delivery_Partners', 'Ratings'] as const;

export const DataManagement: React.FC<DataManagementProps> = ({ onDataMutated }) => {
  const [selectedTable, setSelectedTable] = useState<string>('Orders');
  const [previewData, setPreviewData] = useState<DataPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedUploadRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [resetting, setResetting] = useState(false);

  // Data cleaning toggles
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fillMissingDefaults, setFillMissingDefaults] = useState(true);
  const [normalizeText, setNormalizeText] = useState(true);

  const loadPreview = async (tbl: string) => {
    setLoadingPreview(true);
    try {
      const res = await api.getDataPreview(tbl, 25);
      setPreviewData(res);
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadPreview(selectedTable);
  }, [selectedTable]);

  const validateRawRecords = (rawRecords: Array<Record<string, unknown>>): ParsedUploadRow[] => {
    const seenIds = new Set<string>();
    return rawRecords.map((raw, idx) => {
      const getVal = (...keys: string[]): string => {
        for (const k of keys) {
          const v = raw[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
          }
        }
        return '';
      };

      const orderId = getVal('order_id', 'Order ID', 'OrderId');
      const customerName = getVal('customer_name', 'Customer Name', 'full_name');
      const restaurantName = getVal('restaurant_name', 'Restaurant Name', 'restaurant');
      const cuisineType = getVal('cuisine_type', 'Cuisine', 'cuisine');
      const partnerName = getVal('partner_name', 'Delivery Partner', 'partner');
      const orderDatetime = getVal('order_datetime', 'Order Date', 'datetime', 'date');
      const city = getVal('city', 'City');
      const orderAmount = getVal('order_amount', 'Order Amount', 'amount');
      const deliveryFee = getVal('delivery_fee', 'Delivery Fee');
      const discountAmount = getVal('discount_amount', 'Discount');
      const totalAmount = getVal('total_amount', 'Total Amount', 'total');
      const paymentMethod = getVal('payment_method', 'Payment Method', 'payment');
      const orderStatus = getVal('order_status', 'Status', 'status') || 'Completed';
      const deliveryTimeMin = getVal('delivery_time_min', 'Delivery Time', 'delivery_time');
      const distanceKm = getVal('distance_km', 'Distance');
      const overallRating = getVal('overall_rating', 'Rating', 'rating');
      const customerEmail = getVal('customer_email', 'email');

      let validationStatus: ParsedUploadRow['validationStatus'] = 'valid';
      let validationNote = 'Ready for SQL commit';

      if (!orderId || !customerName || !restaurantName || !city || !orderDatetime) {
        validationStatus = 'error';
        validationNote = 'Missing required field (order_id, customer_name, restaurant_name, city, or order_datetime)';
      } else if (seenIds.has(orderId)) {
        validationStatus = 'duplicate';
        validationNote = 'Duplicate order_id inside uploaded file';
      } else if (
        (!orderAmount || Number.isNaN(Number(orderAmount)) || Number(orderAmount) <= 0) &&
        (!totalAmount || Number.isNaN(Number(totalAmount)) || Number(totalAmount) <= 0)
      ) {
        validationStatus = 'error';
        validationNote = 'Missing or invalid numeric order_amount / total_amount';
      } else if (!paymentMethod || !deliveryFee || (orderStatus === 'Completed' && !deliveryTimeMin)) {
        validationStatus = 'warning';
        validationNote = fillMissingDefaults
          ? 'Missing optional values will be auto-imputed'
          : 'Contains blank optional fields';
      }

      if (orderId) seenIds.add(orderId);

      return {
        rowNumber: idx + 1,
        order_id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        restaurant_name: restaurantName,
        cuisine_type: cuisineType || 'North Indian',
        partner_name: partnerName,
        order_datetime: orderDatetime,
        city,
        order_amount: orderAmount,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        order_status: orderStatus,
        delivery_time_min: deliveryTimeMin,
        distance_km: distanceKm,
        overall_rating: overallRating,
        validationStatus,
        validationNote,
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError('');
    setImportResult(null);
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'csv') {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              setParseError(`CSV parse error: ${results.errors[0].message}`);
              return;
            }
            if (!results.data.length) {
              setParseError('The uploaded CSV file contains no data rows.');
              return;
            }
            setParsedRows(validateRawRecords(results.data));
          },
          error: (err) => {
            setParseError(`Failed to read CSV file: ${err.message}`);
          },
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          setParseError('Excel workbook has no readable worksheets.');
          return;
        }
        const sheet = workbook.Sheets[firstSheet];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        });
        if (!jsonRows.length) {
          setParseError('The first Excel worksheet is empty.');
          return;
        }
        setParsedRows(validateRawRecords(jsonRows));
      } else {
        setParseError('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
      }
    } catch (err) {
      setParseError(`File processing error: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleCommitImport = async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    setParseError('');
    try {
      const res = await api.importOrders(
        parsedRows as unknown as Array<Record<string, unknown>>,
        { skipDuplicates, fillMissingDefaults, normalizeText }
      );
      setImportResult(res);
      await loadPreview(selectedTable);
      onDataMutated();
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        order_id: 'ORD-IMP-2001',
        customer_name: '  rohan malhotra ',
        customer_email: 'rohan.m@example.test',
        restaurant_name: 'Spice Route Kitchen',
        cuisine_type: 'North Indian',
        partner_name: 'Rajesh Kumar',
        order_datetime: '2026-11-16 19:30:00',
        city: 'bengaluru',
        order_amount: 540,
        delivery_fee: 35,
        discount_amount: 40,
        total_amount: 535,
        payment_method: 'UPI',
        order_status: 'Completed',
        delivery_time_min: 28,
        distance_km: 3.6,
        overall_rating: 4.8,
      },
      {
        order_id: 'ORD-IMP-2002',
        customer_name: 'Meera Iyer',
        customer_email: 'meera.i@example.test',
        restaurant_name: 'Napoli Woodfired Oven',
        cuisine_type: 'Italian',
        partner_name: 'Suresh Babu',
        order_datetime: '2026-11-16 20:10:00',
        city: 'Bengaluru',
        order_amount: 680,
        delivery_fee: '',
        discount_amount: 0,
        total_amount: '',
        payment_method: '',
        order_status: 'Completed',
        delivery_time_min: '',
        distance_km: 4.2,
        overall_rating: 4.5,
      },
      {
        order_id: 'ORD-IMP-2001',
        customer_name: 'Duplicate Row Demo',
        customer_email: 'dup@example.test',
        restaurant_name: 'Spice Route Kitchen',
        cuisine_type: 'North Indian',
        partner_name: 'Rajesh Kumar',
        order_datetime: '2026-11-16 19:30:00',
        city: 'Bengaluru',
        order_amount: 540,
        delivery_fee: 35,
        discount_amount: 40,
        total_amount: 535,
        payment_method: 'UPI',
        order_status: 'Completed',
        delivery_time_min: 28,
        distance_km: 3.6,
        overall_rating: 4.8,
      },
    ];
    exportRowsToCsv('sample_import_with_cleaning_cases.csv', sampleRows);
  };

  const handleResetBaseline = async () => {
    setResetting(true);
    try {
      await api.resetBaselineData();
      setParsedRows([]);
      setImportResult(null);
      setFileName('');
      await loadPreview(selectedTable);
      onDataMutated();
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.validationStatus === 'valid' || r.validationStatus === 'warning').length;
  const dupCount = parsedRows.filter((r) => r.validationStatus === 'duplicate').length;
  const errCount = parsedRows.filter((r) => r.validationStatus === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Dataset Import, Cleaning & SQL Table Inspector
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Upload CSV or Excel (.xlsx / .xls) order files, preview validation diagnostics, handle missing values and duplicates, and commit to SQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleTemplate}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Sample Import CSV
          </button>

          <button
            type="button"
            onClick={handleResetBaseline}
            disabled={resetting}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            Reset Synthetic Data
          </button>
        </div>
      </div>

      {/* Upload & Cleaning Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <label className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-teal-600 dark:hover:border-teal-500 transition-colors bg-slate-50/70 dark:bg-slate-800/30">
            <Upload className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            <div className="text-center sm:text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {fileName ? `Loaded: ${fileName}` : 'Choose a CSV or Excel (.xlsx, .xls) file to import'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Required columns: order_id, customer_name, restaurant_name, order_datetime, city, order_amount
              </div>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="flex flex-col gap-2.5 text-xs text-slate-700 dark:text-slate-300 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>Skip duplicate order_id records</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fillMissingDefaults}
                onChange={(e) => setFillMissingDefaults(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>Impute missing fees, totals & payment defaults</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={normalizeText}
                onChange={(e) => setNormalizeText(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>Trim whitespace & normalize Title Case</span>
            </label>
          </div>
        </div>

        {parseError && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {importResult && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                Import Complete — {importResult.summary.insertedCount} inserted · {importResult.summary.duplicateCount} duplicates skipped · {importResult.summary.errorCount} rejected · {importResult.summary.filledMissingCount} missing values cleaned
              </span>
            </div>
          </div>
        )}

        {/* Upload Validation Preview */}
        {parsedRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Previewing {parsedRows.length} rows ·{' '}
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {validCount} valid/cleanable
                </span>{' '}
                ·{' '}
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {dupCount} duplicates
                </span>{' '}
                ·{' '}
                <span className="text-rose-700 dark:text-rose-400 font-medium">
                  {errCount} errors
                </span>
              </div>

              <button
                type="button"
                onClick={handleCommitImport}
                disabled={importing}
                className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {importing ? 'Committing to Database...' : 'Commit Valid Rows to SQL Database'}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-72">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">Order ID</th>
                    <th className="px-3 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium">Restaurant</th>
                    <th className="px-3 py-2.5 font-medium">City</th>
                    <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.slice(0, 100).map((row) => (
                    <tr key={row.rowNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono text-slate-400">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {row.order_id || '(empty)'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.customer_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.restaurant_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.city || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.total_amount || row.order_amount || '—'}
                      </td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          row.validationStatus === 'valid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : row.validationStatus === 'warning'
                            ? 'text-amber-700 dark:text-amber-400'
                            : row.validationStatus === 'duplicate'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {row.validationNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Live Relational Tables Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Relational Database Table Preview
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live inspection of the 5 MySQL-compatible tables
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {TABLES.map((tbl) => (
              <button
                key={tbl}
                type="button"
                onClick={() => setSelectedTable(tbl)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedTable === tbl
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tbl} ({formatNumber(previewData?.counts?.[tbl] ?? 0)})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingPreview || !previewData ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading table preview...</div>
          ) : previewData.rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No records in {selectedTable}.</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {Object.keys(previewData.rows[0]).map((col) => (
                    <th key={col} className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {Object.values(row).map((val, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate"
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

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Download Synthetic CSV Datasets:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['customers.csv', 'Customers (200)'],
                ['restaurants.csv', 'Restaurants (30)'],
                ['delivery_partners.csv', 'Partners (20)'],
                ['orders.csv', 'Orders (600)'],
                ['ratings.csv', 'Ratings (473)'],
              ] as const
            ).map(([file, label]) => (
              <a
                key={file}
                href={`/api/data/download/datasets/${file}`}
                download={file}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Download className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
