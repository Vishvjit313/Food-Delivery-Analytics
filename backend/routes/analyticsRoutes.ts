import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db.ts';

const router = Router();

interface FilterParams {
  city?: string;
  cuisine?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

function buildOrderWhereClause(filters: FilterParams, alias = 'o'): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.city && filters.city !== 'All') {
    conditions.push(`${alias}.city = ?`);
    params.push(filters.city);
  }
  if (filters.cuisine && filters.cuisine !== 'All') {
    conditions.push(`r.cuisine_type = ?`);
    params.push(filters.cuisine);
  }
  if (filters.startDate) {
    conditions.push(`${db.sqlDate(`${alias}.order_datetime`)} >= ?`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`${db.sqlDate(`${alias}.order_datetime`)} <= ?`);
    params.push(filters.endDate);
  }
  if (filters.status && filters.status !== 'All') {
    conditions.push(`${alias}.order_status = ?`);
    params.push(filters.status);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// ----------------------------------------------------------------------------
// 1. Health & Engine Info (Never exposes DB credentials)
// ----------------------------------------------------------------------------
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.init();
    res.json({
      status: 'ok',
      mode: db.mode,
      connectionStatus: db.connectionStatus,
      dialect: db.dialect,
      engineLabel: db.engineLabel,
      mysqlConfigured: db.mysqlConfigured,
      fallbackReason: db.fallbackReason,
      syntheticDataNotice:
        'All preloaded records are synthetic demonstration data generated for academic & analytical prototyping.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Database initialization error', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 2. Global Filter Options
// ----------------------------------------------------------------------------
router.get('/analytics/filters', async (_req: Request, res: Response) => {
  try {
    const cities = await db.query<{ city: string }>(
      'SELECT DISTINCT city FROM Restaurants ORDER BY city ASC'
    );
    const cuisines = await db.query<{ cuisine_type: string }>(
      'SELECT DISTINCT cuisine_type FROM Restaurants ORDER BY cuisine_type ASC'
    );
    const dateRange = await db.query<{ min_date: string; max_date: string }>(
      `SELECT MIN(${db.sqlDate('order_datetime')}) AS min_date, MAX(${db.sqlDate('order_datetime')}) AS max_date FROM Orders`
    );

    res.json({
      cities: cities.map((c) => c.city),
      cuisines: cuisines.map((c) => c.cuisine_type),
      minDate: dateRange[0]?.min_date ?? '2025-12-01',
      maxDate: dateRange[0]?.max_date ?? '2026-11-30',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load filter metadata', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 3. Overview Dashboard API
// ----------------------------------------------------------------------------
router.get('/analytics/overview', async (req: Request, res: Response) => {
  try {
    const filters: FilterParams = {
      city: req.query.city as string | undefined,
      cuisine: req.query.cuisine as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const { clause, params } = buildOrderWhereClause(filters, 'o');
    const needsRestaurantJoin = Boolean(filters.cuisine && filters.cuisine !== 'All');
    const restaurantJoin = needsRestaurantJoin
      ? 'JOIN Restaurants r ON o.restaurant_id = r.restaurant_id'
      : 'LEFT JOIN Restaurants r ON o.restaurant_id = r.restaurant_id';

    const kpiSql = `
      SELECT
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS total_revenue,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 0), 2) AS avg_order_value,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.delivery_time_min END), 0), 1) AS avg_delivery_time_min,
        ROUND(COALESCE(100.0 * SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) / NULLIF(COUNT(o.order_id), 0), 0), 2) AS cancellation_pct,
        ROUND(COALESCE(AVG(rt.overall_rating), 0), 2) AS avg_customer_rating
      FROM Orders o
      ${restaurantJoin}
      LEFT JOIN Ratings rt ON o.order_id = rt.order_id
      ${clause}
    `;
    const kpiRows = await db.query<Record<string, number>>(kpiSql, params);

    const monthExpr = db.sqlYearMonth('o.order_datetime');
    const monthlySql = `
      SELECT
        ${monthExpr} AS month,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS revenue
      FROM Orders o
      ${restaurantJoin}
      ${clause}
      GROUP BY ${monthExpr}
      ORDER BY month ASC
    `;
    const monthlyTrends = await db.query(monthlySql, params);

    // Use vw_peak_hours directly when unfiltered; filtered query when city/cuisine/date filter active
    let peakHours;
    if (!clause) {
      peakHours = await db.query('SELECT * FROM vw_peak_hours ORDER BY order_hour ASC');
    } else {
      const hourExpr = db.sqlHour('o.order_datetime');
      const peakSql = `
        SELECT
          ${hourExpr} AS order_hour,
          COUNT(o.order_id) AS total_orders,
          SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
          ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS total_revenue
        FROM Orders o
        ${restaurantJoin}
        ${clause}
        GROUP BY ${hourExpr}
        ORDER BY order_hour ASC
      `;
      const rawHours = await db.query<{
        order_hour: number;
        total_orders: number;
        completed_orders: number;
        total_revenue: number;
      }>(peakSql, params);
      peakHours = rawHours.map((h) => ({
        ...h,
        hour_label: `${String(h.order_hour).padStart(2, '0')}:00`,
        demand_window:
          h.order_hour >= 12 && h.order_hour <= 14
            ? 'Lunch Peak'
            : h.order_hour >= 19 && h.order_hour <= 22
            ? 'Dinner Peak'
            : 'Off-Peak',
      }));
    }

    const citySql = `
      SELECT
        o.city,
        COUNT(o.order_id) AS total_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS total_revenue,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 0), 2) AS avg_order_value
      FROM Orders o
      ${restaurantJoin}
      ${clause}
      GROUP BY o.city
      ORDER BY total_revenue DESC
    `;
    const cityRevenue = await db.query(citySql, params);

    const topRestaurants = await db.query(
      `SELECT restaurant_id, restaurant_name, cuisine_type, city, total_orders, total_revenue, avg_rating, performance_rank
       FROM vw_restaurant_rank
       ORDER BY performance_rank ASC
       LIMIT 5`
    );

    res.json({
      kpis: kpiRows[0] ?? {},
      monthlyTrends,
      peakHours,
      cityRevenue,
      topRestaurants,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load overview analytics', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 4. Order Analytics API
// ----------------------------------------------------------------------------
router.get('/analytics/orders', async (req: Request, res: Response) => {
  try {
    const filters: FilterParams = {
      city: req.query.city as string | undefined,
      cuisine: req.query.cuisine as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
    };
    const search = (req.query.search as string | undefined)?.trim() ?? '';
    const paymentMethod = req.query.paymentMethod as string | undefined;
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const { clause: baseClause, params: baseParams } = buildOrderWhereClause(filters, 'o');
    const extraConds: string[] = [];
    const extraParams: unknown[] = [];

    if (paymentMethod && paymentMethod !== 'All') {
      extraConds.push('o.payment_method = ?');
      extraParams.push(paymentMethod);
    }
    if (search) {
      extraConds.push(
        '(o.order_id LIKE ? OR c.full_name LIKE ? OR r.restaurant_name LIKE ? OR o.city LIKE ?)'
      );
      const pattern = `%${search}%`;
      extraParams.push(pattern, pattern, pattern, pattern);
    }

    const fullWhere = [baseClause.replace(/^WHERE\s+/i, ''), ...extraConds]
      .filter(Boolean)
      .join(' AND ');
    const whereSql = fullWhere ? `WHERE ${fullWhere}` : '';
    const allParams = [...baseParams, ...extraParams];

    const dateExpr = db.sqlDate('o.order_datetime');
    const monthExpr = db.sqlYearMonth('o.order_datetime');

    const dailyTrends = await db.query(
      `SELECT
        ${dateExpr} AS order_date,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS revenue
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      ${whereSql}
      GROUP BY ${dateExpr}
      ORDER BY order_date ASC`,
      allParams
    );

    const monthlyTrends = await db.query(
      `SELECT
        ${monthExpr} AS month,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS revenue
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      ${whereSql}
      GROUP BY ${monthExpr}
      ORDER BY month ASC`,
      allParams
    );

    const byCity = await db.query(
      `SELECT
        o.city,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS revenue
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      ${whereSql}
      GROUP BY o.city
      ORDER BY total_orders DESC`,
      allParams
    );

    const byPaymentMethod = await db.query(
      `SELECT
        o.payment_method,
        COUNT(o.order_id) AS total_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS revenue
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      ${whereSql}
      GROUP BY o.payment_method
      ORDER BY total_orders DESC`,
      allParams
    );

    const statusSplit = await db.query<{
      order_status: string;
      total_orders: number;
      total_amount: number;
    }>(
      `SELECT
        o.order_status,
        COUNT(o.order_id) AS total_orders,
        ROUND(COALESCE(SUM(o.total_amount), 0), 2) AS total_amount
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      ${whereSql}
      GROUP BY o.order_status`,
      allParams
    );

    const countRows = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt
       FROM Orders o
       JOIN Customers c ON o.customer_id = c.customer_id
       JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
       ${whereSql}`,
      allParams
    );

    const orders = await db.query(
      `SELECT
        o.order_id,
        o.order_datetime,
        o.city,
        c.full_name AS customer_name,
        r.restaurant_name,
        r.cuisine_type,
        dp.partner_name,
        o.order_amount,
        o.delivery_fee,
        o.discount_amount,
        o.total_amount,
        o.payment_method,
        o.order_status,
        o.delivery_time_min,
        o.distance_km,
        o.cancellation_reason,
        rt.overall_rating
      FROM Orders o
      JOIN Customers c ON o.customer_id = c.customer_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      LEFT JOIN Delivery_Partners dp ON o.partner_id = dp.partner_id
      LEFT JOIN Ratings rt ON o.order_id = rt.order_id
      ${whereSql}
      ORDER BY o.order_datetime DESC
      LIMIT ? OFFSET ?`,
      [...allParams, limit, offset]
    );

    res.json({
      dailyTrends,
      monthlyTrends,
      byCity,
      byPaymentMethod,
      statusSplit,
      orders,
      totalCount: Number(countRows[0]?.cnt ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order analytics', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 5. Restaurant Performance API (uses vw_restaurant_rank)
// ----------------------------------------------------------------------------
router.get('/analytics/restaurants', async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string | undefined;
    const cuisine = req.query.cuisine as string | undefined;
    const search = (req.query.search as string | undefined)?.trim() ?? '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (city && city !== 'All') {
      conditions.push('city = ?');
      params.push(city);
    }
    if (cuisine && cuisine !== 'All') {
      conditions.push('cuisine_type = ?');
      params.push(cuisine);
    }
    if (search) {
      conditions.push('(restaurant_name LIKE ? OR cuisine_type LIKE ? OR area LIKE ?)');
      const pat = `%${search}%`;
      params.push(pat, pat, pat);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const restaurants = await db.query(
      `SELECT * FROM vw_restaurant_rank ${whereClause} ORDER BY performance_rank ASC`,
      params
    );

    const top10 = await db.query(
      `SELECT * FROM vw_restaurant_rank ${whereClause} ORDER BY performance_rank ASC LIMIT 10`,
      params
    );

    res.json({
      top10,
      restaurants,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load restaurant performance', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 6. Customer Analytics API
// ----------------------------------------------------------------------------
router.get('/analytics/customers', async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string | undefined;
    const segment = req.query.segment as string | undefined;
    const search = (req.query.search as string | undefined)?.trim() ?? '';

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (city && city !== 'All') {
      conditions.push('c.city = ?');
      params.push(city);
    }
    if (segment && segment !== 'All') {
      conditions.push('c.customer_segment = ?');
      params.push(segment);
    }
    if (search) {
      conditions.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.city LIKE ?)');
      const pat = `%${search}%`;
      params.push(pat, pat, pat);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const customerStats = await db.query<{
      customer_id: number;
      full_name: string;
      email: string;
      city: string;
      signup_date: string;
      customer_segment: string;
      total_orders: number;
      completed_orders: number;
      total_spent: number;
      avg_order_value: number;
      last_order_date: string | null;
    }>(
      `SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.city,
        c.signup_date,
        c.customer_segment,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS total_spent,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 0), 2) AS avg_order_value,
        MAX(${db.sqlDate('o.order_datetime')}) AS last_order_date
      FROM Customers c
      LEFT JOIN Orders o ON c.customer_id = o.customer_id
      ${whereClause}
      GROUP BY c.customer_id, c.full_name, c.email, c.city, c.signup_date, c.customer_segment
      ORDER BY total_spent DESC, total_orders DESC`,
      params
    );

    const totalCustomers = customerStats.length;
    const activeCustomers = customerStats.filter((c) => Number(c.total_orders) > 0).length;
    const repeatCustomers = customerStats.filter((c) => Number(c.total_orders) >= 2).length;
    const repeatRatePct =
      activeCustomers > 0 ? Number(((repeatCustomers / activeCustomers) * 100).toFixed(1)) : 0;
    const totalOrdersSum = customerStats.reduce((sum, c) => sum + Number(c.total_orders), 0);
    const totalSpendSum = customerStats.reduce((sum, c) => sum + Number(c.total_spent), 0);

    // City distribution
    const cityMap = new Map<string, { city: string; customers: number; repeatCustomers: number; totalRevenue: number }>();
    const segmentMap = new Map<string, { segment: string; customers: number; totalOrders: number; totalRevenue: number }>();
    const cohortCounts: Record<string, number> = {
      '0 Orders': 0,
      '1 Order': 0,
      '2-4 Orders': 0,
      '5-8 Orders': 0,
      '9+ Orders': 0,
    };

    for (const c of customerStats) {
      const ordersCnt = Number(c.total_orders);
      const spent = Number(c.total_spent);

      const cityEntry = cityMap.get(c.city) ?? {
        city: c.city,
        customers: 0,
        repeatCustomers: 0,
        totalRevenue: 0,
      };
      cityEntry.customers += 1;
      if (ordersCnt >= 2) cityEntry.repeatCustomers += 1;
      cityEntry.totalRevenue = Number((cityEntry.totalRevenue + spent).toFixed(2));
      cityMap.set(c.city, cityEntry);

      const segEntry = segmentMap.get(c.customer_segment) ?? {
        segment: c.customer_segment,
        customers: 0,
        totalOrders: 0,
        totalRevenue: 0,
      };
      segEntry.customers += 1;
      segEntry.totalOrders += ordersCnt;
      segEntry.totalRevenue = Number((segEntry.totalRevenue + spent).toFixed(2));
      segmentMap.set(c.customer_segment, segEntry);

      if (ordersCnt === 0) cohortCounts['0 Orders'] += 1;
      else if (ordersCnt === 1) cohortCounts['1 Order'] += 1;
      else if (ordersCnt <= 4) cohortCounts['2-4 Orders'] += 1;
      else if (ordersCnt <= 8) cohortCounts['5-8 Orders'] += 1;
      else cohortCounts['9+ Orders'] += 1;
    }

    res.json({
      summary: {
        totalCustomers,
        activeCustomers,
        repeatCustomers,
        repeatRatePct,
        avgOrdersPerCustomer:
          totalCustomers > 0 ? Number((totalOrdersSum / totalCustomers).toFixed(2)) : 0,
        avgLifetimeSpend:
          totalCustomers > 0 ? Number((totalSpendSum / totalCustomers).toFixed(2)) : 0,
      },
      byCity: Array.from(cityMap.values()).sort((a, b) => b.customers - a.customers),
      bySegment: Array.from(segmentMap.values()),
      orderFrequencyCohorts: Object.entries(cohortCounts).map(([bucket, count]) => ({
        bucket,
        customers: count,
      })),
      topCustomers: customerStats.slice(0, 25),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load customer analytics', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 7. Delivery Performance API
// ----------------------------------------------------------------------------
router.get('/analytics/delivery', async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string | undefined;
    const vehicleType = req.query.vehicleType as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (city && city !== 'All') {
      conditions.push('dp.city = ?');
      params.push(city);
    }
    if (vehicleType && vehicleType !== 'All') {
      conditions.push('dp.vehicle_type = ?');
      params.push(vehicleType);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const partners = await db.query<{
      partner_id: number;
      partner_name: string;
      vehicle_type: string;
      city: string;
      joining_date: string;
      assigned_orders: number;
      delivered_orders: number;
      avg_delivery_time_min: number;
      delayed_deliveries: number;
      avg_delivery_rating: number;
      avg_distance_km: number;
    }>(
      `SELECT
        dp.partner_id,
        dp.partner_name,
        dp.vehicle_type,
        dp.city,
        dp.joining_date,
        COUNT(o.order_id) AS assigned_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS delivered_orders,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.delivery_time_min END), 0), 1) AS avg_delivery_time_min,
        SUM(CASE WHEN o.order_status = 'Completed' AND o.delivery_time_min > 40 THEN 1 ELSE 0 END) AS delayed_deliveries,
        ROUND(COALESCE(AVG(rt.delivery_rating), 0), 2) AS avg_delivery_rating,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.distance_km END), 0), 2) AS avg_distance_km
      FROM Delivery_Partners dp
      LEFT JOIN Orders o ON dp.partner_id = o.partner_id
      LEFT JOIN Ratings rt ON o.order_id = rt.order_id
      ${whereClause}
      GROUP BY dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city, dp.joining_date
      ORDER BY avg_delivery_rating DESC, avg_delivery_time_min ASC`,
      params
    );

    const enrichedPartners = partners.map((p) => {
      const delivered = Number(p.delivered_orders);
      const delayed = Number(p.delayed_deliveries);
      const onTimePct = delivered > 0 ? Number((((delivered - delayed) / delivered) * 100).toFixed(1)) : 100;
      return {
        ...p,
        on_time_pct: onTimePct,
      };
    });

    const totalDelivered = enrichedPartners.reduce((s, p) => s + Number(p.delivered_orders), 0);
    const totalDelayed = enrichedPartners.reduce((s, p) => s + Number(p.delayed_deliveries), 0);
    const weightedTime = enrichedPartners.reduce(
      (s, p) => s + Number(p.avg_delivery_time_min) * Number(p.delivered_orders),
      0
    );
    const weightedRating = enrichedPartners.reduce(
      (s, p) => s + Number(p.avg_delivery_rating) * Number(p.delivered_orders),
      0
    );

    const orderConds = ["o.order_status = 'Completed'", 'o.delivery_time_min IS NOT NULL'];
    const orderParams: unknown[] = [];
    if (city && city !== 'All') {
      orderConds.push('o.city = ?');
      orderParams.push(city);
    }
    const orderWhere = `WHERE ${orderConds.join(' AND ')}`;

    const timeBuckets = await db.query(
      `SELECT
        CASE
          WHEN o.delivery_time_min <= 20 THEN '15-20 min (Express)'
          WHEN o.delivery_time_min <= 30 THEN '21-30 min (Fast)'
          WHEN o.delivery_time_min <= 40 THEN '31-40 min (Standard)'
          ELSE '> 40 min (Delayed)'
        END AS bucket,
        COUNT(*) AS order_count
      FROM Orders o
      ${orderWhere}
      GROUP BY bucket`,
      orderParams
    );

    const byCity = await db.query(
      `SELECT
        o.city,
        COUNT(*) AS delivered_orders,
        ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min,
        SUM(CASE WHEN o.delivery_time_min > 40 THEN 1 ELSE 0 END) AS delayed_deliveries
      FROM Orders o
      ${orderWhere}
      GROUP BY o.city
      ORDER BY avg_delivery_time_min ASC`,
      orderParams
    );

    res.json({
      summary: {
        totalPartners: enrichedPartners.length,
        totalDeliveries: totalDelivered,
        delayedDeliveries: totalDelayed,
        delayedRatePct:
          totalDelivered > 0 ? Number(((totalDelayed / totalDelivered) * 100).toFixed(1)) : 0,
        avgDeliveryTimeMin:
          totalDelivered > 0 ? Number((weightedTime / totalDelivered).toFixed(1)) : 0,
        avgDeliveryRating:
          totalDelivered > 0 ? Number((weightedRating / totalDelivered).toFixed(2)) : 0,
      },
      partners: enrichedPartners,
      timeBuckets,
      byCity,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load delivery analytics', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 8. Cuisine Analytics API
// ----------------------------------------------------------------------------
router.get('/analytics/cuisines', async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string | undefined;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (city && city !== 'All') {
      conditions.push('o.city = ?');
      params.push(city);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const cuisines = await db.query<{
      cuisine_type: string;
      restaurant_count: number;
      total_orders: number;
      completed_orders: number;
      total_revenue: number;
      avg_order_value: number;
      avg_rating: number;
      avg_delivery_time_min: number;
    }>(
      `SELECT
        r.cuisine_type,
        COUNT(DISTINCT r.restaurant_id) AS restaurant_count,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        ROUND(COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 0), 2) AS total_revenue,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 0), 2) AS avg_order_value,
        ROUND(COALESCE(AVG(rt.overall_rating), 0), 2) AS avg_rating,
        ROUND(COALESCE(AVG(CASE WHEN o.order_status = 'Completed' THEN o.delivery_time_min END), 0), 1) AS avg_delivery_time_min
      FROM Restaurants r
      LEFT JOIN Orders o ON r.restaurant_id = o.restaurant_id
      LEFT JOIN Ratings rt ON o.order_id = rt.order_id
      ${whereClause}
      GROUP BY r.cuisine_type
      ORDER BY total_orders DESC`,
      params
    );

    const grandTotalOrders = cuisines.reduce((s, c) => s + Number(c.total_orders), 0);
    const enriched = cuisines.map((c) => ({
      ...c,
      order_share_pct:
        grandTotalOrders > 0 ? Number(((Number(c.total_orders) / grandTotalOrders) * 100).toFixed(1)) : 0,
    }));

    res.json({ cuisines: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cuisine analytics', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 9. SQL Analytics Explorer & Schema Viewer
// ----------------------------------------------------------------------------
router.get('/analytics/sql-explorer', async (_req: Request, res: Response) => {
  try {
    const monthExpr = db.sqlYearMonth('order_datetime');
    const queries = [
      {
        id: 'q1_executive_kpis',
        title: '1. Executive Summary KPIs',
        sql: "SELECT COUNT(*) AS total_orders, SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_order_value, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN delivery_time_min END), 2) AS avg_delivery_time_min FROM Orders;",
        rows: await db.query("SELECT COUNT(*) AS total_orders, SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_order_value, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN delivery_time_min END), 2) AS avg_delivery_time_min FROM Orders"),
      },
      {
        id: 'q2_monthly_revenue',
        title: '2. Monthly Revenue & Order Trend',
        sql: `SELECT DATE_FORMAT(order_datetime, '%Y-%m') AS order_month, COUNT(order_id) AS total_orders, SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS monthly_revenue FROM Orders GROUP BY DATE_FORMAT(order_datetime, '%Y-%m') ORDER BY order_month ASC;`,
        rows: await db.query(`SELECT ${monthExpr} AS order_month, COUNT(order_id) AS total_orders, SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS monthly_revenue FROM Orders GROUP BY ${monthExpr} ORDER BY order_month ASC`),
      },
      {
        id: 'q3_payment_methods',
        title: '3. Revenue by Payment Method',
        sql: "SELECT payment_method, COUNT(*) AS total_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_ticket_size FROM Orders GROUP BY payment_method ORDER BY total_revenue DESC;",
        rows: await db.query("SELECT payment_method, COUNT(*) AS total_orders, ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_ticket_size FROM Orders GROUP BY payment_method ORDER BY total_revenue DESC"),
      },
      {
        id: 'q4_discount_commission',
        title: '4. Discount Impact & Platform Commission',
        sql: "SELECT COUNT(CASE WHEN discount_amount > 0 THEN 1 END) AS discounted_orders, COUNT(CASE WHEN discount_amount = 0 THEN 1 END) AS full_price_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.discount_amount ELSE 0 END), 2) AS total_discounts, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.order_amount * (r.commission_rate / 100.0) ELSE 0 END), 2) AS platform_commission FROM Orders o JOIN Restaurants r ON o.restaurant_id = r.restaurant_id;",
        rows: await db.query("SELECT COUNT(CASE WHEN discount_amount > 0 THEN 1 END) AS discounted_orders, COUNT(CASE WHEN discount_amount = 0 THEN 1 END) AS full_price_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.discount_amount ELSE 0 END), 2) AS total_discounts, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.order_amount * (r.commission_rate / 100.0) ELSE 0 END), 2) AS platform_commission FROM Orders o JOIN Restaurants r ON o.restaurant_id = r.restaurant_id"),
      },
      {
        id: 'q5_top_10_restaurants',
        title: '5. Top 10 Restaurants (vw_restaurant_rank)',
        sql: 'SELECT performance_rank, restaurant_name, cuisine_type, city, total_orders, total_revenue, avg_rating, cancellation_rate_pct FROM vw_restaurant_rank ORDER BY performance_rank ASC LIMIT 10;',
        rows: await db.query('SELECT performance_rank, restaurant_name, cuisine_type, city, total_orders, total_revenue, avg_rating, cancellation_rate_pct FROM vw_restaurant_rank ORDER BY performance_rank ASC LIMIT 10'),
      },
      {
        id: 'q6_bottom_5_restaurants',
        title: '6. Bottom 5 Restaurants (vw_restaurant_rank)',
        sql: 'SELECT performance_rank, restaurant_name, cuisine_type, city, total_orders, total_revenue, avg_rating, cancellation_rate_pct FROM vw_restaurant_rank ORDER BY performance_rank DESC LIMIT 5;',
        rows: await db.query('SELECT performance_rank, restaurant_name, cuisine_type, city, total_orders, total_revenue, avg_rating, cancellation_rate_pct FROM vw_restaurant_rank ORDER BY performance_rank DESC LIMIT 5'),
      },
      {
        id: 'q7_restaurant_commission',
        title: '7. Restaurant Commission & Prep Speed',
        sql: "SELECT r.restaurant_name, r.city, r.commission_rate, r.avg_prep_time_min, COUNT(o.order_id) AS completed_orders, ROUND(SUM(o.order_amount * (r.commission_rate / 100.0)), 2) AS commission_earned FROM Restaurants r JOIN Orders o ON r.restaurant_id = o.restaurant_id WHERE o.order_status = 'Completed' GROUP BY r.restaurant_id, r.restaurant_name, r.city, r.commission_rate, r.avg_prep_time_min ORDER BY commission_earned DESC LIMIT 12;",
        rows: await db.query("SELECT r.restaurant_name, r.city, r.commission_rate, r.avg_prep_time_min, COUNT(o.order_id) AS completed_orders, ROUND(SUM(o.order_amount * (r.commission_rate / 100.0)), 2) AS commission_earned FROM Restaurants r JOIN Orders o ON r.restaurant_id = o.restaurant_id WHERE o.order_status = 'Completed' GROUP BY r.restaurant_id, r.restaurant_name, r.city, r.commission_rate, r.avg_prep_time_min ORDER BY commission_earned DESC LIMIT 12"),
      },
      {
        id: 'q8_peak_hours',
        title: '8. Peak Ordering Hours (vw_peak_hours)',
        sql: 'SELECT order_hour, hour_label, total_orders, completed_orders, total_revenue, demand_window FROM vw_peak_hours ORDER BY total_orders DESC LIMIT 12;',
        rows: await db.query('SELECT order_hour, hour_label, total_orders, completed_orders, total_revenue, demand_window FROM vw_peak_hours ORDER BY total_orders DESC LIMIT 12'),
      },
      {
        id: 'q9_demand_windows',
        title: '9. Demand Window Summary (Lunch vs Dinner)',
        sql: 'SELECT demand_window, SUM(total_orders) AS window_orders, ROUND(SUM(total_revenue), 2) AS window_revenue FROM vw_peak_hours GROUP BY demand_window ORDER BY window_orders DESC;',
        rows: await db.query('SELECT demand_window, SUM(total_orders) AS window_orders, ROUND(SUM(total_revenue), 2) AS window_revenue FROM vw_peak_hours GROUP BY demand_window ORDER BY window_orders DESC'),
      },
      {
        id: 'q10_city_revenue',
        title: '10. City-Wise Revenue & Ratings',
        sql: "SELECT o.city, COUNT(o.order_id) AS total_orders, SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(rt.overall_rating), 2) AS avg_city_rating FROM Orders o LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY o.city ORDER BY total_revenue DESC;",
        rows: await db.query("SELECT o.city, COUNT(o.order_id) AS total_orders, SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(rt.overall_rating), 2) AS avg_city_rating FROM Orders o LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY o.city ORDER BY total_revenue DESC"),
      },
      {
        id: 'q11_city_density',
        title: '11. City Supply & Customer Density',
        sql: 'SELECT c.city, COUNT(DISTINCT c.customer_id) AS customers, COUNT(DISTINCT r.restaurant_id) AS restaurants, COUNT(DISTINCT dp.partner_id) AS partners FROM Customers c LEFT JOIN Restaurants r ON c.city = r.city LEFT JOIN Delivery_Partners dp ON c.city = dp.city GROUP BY c.city ORDER BY customers DESC;',
        rows: await db.query('SELECT c.city, COUNT(DISTINCT c.customer_id) AS customers, COUNT(DISTINCT r.restaurant_id) AS restaurants, COUNT(DISTINCT dp.partner_id) AS partners FROM Customers c LEFT JOIN Restaurants r ON c.city = r.city LEFT JOIN Delivery_Partners dp ON c.city = dp.city GROUP BY c.city ORDER BY customers DESC'),
      },
      {
        id: 'q12_popular_cuisines',
        title: '12. Most Popular Cuisines',
        sql: "SELECT r.cuisine_type, COUNT(DISTINCT r.restaurant_id) AS restaurants, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(rt.overall_rating), 2) AS avg_rating FROM Restaurants r LEFT JOIN Orders o ON r.restaurant_id = o.restaurant_id LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY r.cuisine_type ORDER BY total_orders DESC;",
        rows: await db.query("SELECT r.cuisine_type, COUNT(DISTINCT r.restaurant_id) AS restaurants, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue, ROUND(AVG(rt.overall_rating), 2) AS avg_rating FROM Restaurants r LEFT JOIN Orders o ON r.restaurant_id = o.restaurant_id LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY r.cuisine_type ORDER BY total_orders DESC"),
      },
      {
        id: 'q13_top_cuisine_per_city',
        title: '13. Top-Grossing Cuisine per City',
        sql: "SELECT city, cuisine_type, total_orders, total_revenue FROM (SELECT o.city, r.cuisine_type, COUNT(o.order_id) AS total_orders, ROUND(SUM(o.total_amount), 2) AS total_revenue, ROW_NUMBER() OVER (PARTITION BY o.city ORDER BY SUM(o.total_amount) DESC) AS rn FROM Orders o JOIN Restaurants r ON o.restaurant_id = r.restaurant_id WHERE o.order_status = 'Completed' GROUP BY o.city, r.cuisine_type) ranked WHERE rn = 1 ORDER BY total_revenue DESC;",
        rows: await db.query("SELECT city, cuisine_type, total_orders, total_revenue FROM (SELECT o.city, r.cuisine_type, COUNT(o.order_id) AS total_orders, ROUND(SUM(o.total_amount), 2) AS total_revenue, ROW_NUMBER() OVER (PARTITION BY o.city ORDER BY SUM(o.total_amount) DESC) AS rn FROM Orders o JOIN Restaurants r ON o.restaurant_id = r.restaurant_id WHERE o.order_status = 'Completed' GROUP BY o.city, r.cuisine_type) ranked WHERE rn = 1 ORDER BY total_revenue DESC"),
      },
      {
        id: 'q14_repeat_customer_rate',
        title: '14. Repeat Customer Rate',
        sql: 'SELECT COUNT(*) AS customers_with_orders, SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) AS repeat_customers, ROUND(100.0 * SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) / COUNT(*), 2) AS repeat_rate_pct FROM (SELECT customer_id, COUNT(*) AS order_count FROM Orders GROUP BY customer_id) cust_orders;',
        rows: await db.query('SELECT COUNT(*) AS customers_with_orders, SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) AS repeat_customers, ROUND(100.0 * SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) / COUNT(*), 2) AS repeat_rate_pct FROM (SELECT customer_id, COUNT(*) AS order_count FROM Orders GROUP BY customer_id) cust_orders'),
      },
      {
        id: 'q15_top_ltv_customers',
        title: '15. Top 10 High-LTV Customers',
        sql: "SELECT c.full_name, c.city, c.customer_segment, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS lifetime_spend FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.full_name, c.city, c.customer_segment ORDER BY lifetime_spend DESC LIMIT 10;",
        rows: await db.query("SELECT c.full_name, c.city, c.customer_segment, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS lifetime_spend FROM Customers c JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.full_name, c.city, c.customer_segment ORDER BY lifetime_spend DESC LIMIT 10"),
      },
      {
        id: 'q16_customer_segments',
        title: '16. Customer Segment Contribution',
        sql: "SELECT c.customer_segment, COUNT(DISTINCT c.customer_id) AS total_customers, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS segment_revenue FROM Customers c LEFT JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_segment ORDER BY segment_revenue DESC;",
        rows: await db.query("SELECT c.customer_segment, COUNT(DISTINCT c.customer_id) AS total_customers, COUNT(o.order_id) AS total_orders, ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS segment_revenue FROM Customers c LEFT JOIN Orders o ON c.customer_id = o.customer_id GROUP BY c.customer_segment ORDER BY segment_revenue DESC"),
      },
      {
        id: 'q17_partner_performance',
        title: '17. Delivery Partner Performance',
        sql: "SELECT dp.partner_name, dp.vehicle_type, dp.city, COUNT(o.order_id) AS assigned_orders, ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min, SUM(CASE WHEN o.delivery_time_min > 40 THEN 1 ELSE 0 END) AS delayed_deliveries, ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating FROM Delivery_Partners dp LEFT JOIN Orders o ON dp.partner_id = o.partner_id LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city ORDER BY avg_delivery_rating DESC LIMIT 12;",
        rows: await db.query("SELECT dp.partner_name, dp.vehicle_type, dp.city, COUNT(o.order_id) AS assigned_orders, ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min, SUM(CASE WHEN o.delivery_time_min > 40 THEN 1 ELSE 0 END) AS delayed_deliveries, ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating FROM Delivery_Partners dp LEFT JOIN Orders o ON dp.partner_id = o.partner_id LEFT JOIN Ratings rt ON o.order_id = rt.order_id GROUP BY dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city ORDER BY avg_delivery_rating DESC LIMIT 12"),
      },
      {
        id: 'q18_vehicle_sla',
        title: '18. Vehicle Type Speed & SLA Compliance',
        sql: "SELECT dp.vehicle_type, COUNT(o.order_id) AS completed_deliveries, ROUND(AVG(o.distance_km), 2) AS avg_distance_km, ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min, ROUND(100.0 * SUM(CASE WHEN o.delivery_time_min <= 40 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_sla_pct FROM Delivery_Partners dp JOIN Orders o ON dp.partner_id = o.partner_id WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL GROUP BY dp.vehicle_type ORDER BY avg_delivery_time_min ASC;",
        rows: await db.query("SELECT dp.vehicle_type, COUNT(o.order_id) AS completed_deliveries, ROUND(AVG(o.distance_km), 2) AS avg_distance_km, ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min, ROUND(100.0 * SUM(CASE WHEN o.delivery_time_min <= 40 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_sla_pct FROM Delivery_Partners dp JOIN Orders o ON dp.partner_id = o.partner_id WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL GROUP BY dp.vehicle_type ORDER BY avg_delivery_time_min ASC"),
      },
      {
        id: 'q19_delay_rating_impact',
        title: '19. On-Time vs Delayed Rating Impact',
        sql: "SELECT CASE WHEN o.delivery_time_min <= 40 THEN 'On-Time (<= 40 min)' ELSE 'Delayed (> 40 min)' END AS sla_bucket, COUNT(*) AS rated_orders, ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating, ROUND(AVG(rt.overall_rating), 2) AS avg_overall_rating FROM Orders o JOIN Ratings rt ON o.order_id = rt.order_id WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL GROUP BY sla_bucket;",
        rows: await db.query("SELECT CASE WHEN o.delivery_time_min <= 40 THEN 'On-Time (<= 40 min)' ELSE 'Delayed (> 40 min)' END AS sla_bucket, COUNT(*) AS rated_orders, ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating, ROUND(AVG(rt.overall_rating), 2) AS avg_overall_rating FROM Orders o JOIN Ratings rt ON o.order_id = rt.order_id WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL GROUP BY sla_bucket"),
      },
      {
        id: 'q20_cancellation_reasons',
        title: '20. Cancellation Reasons Analysis',
        sql: "SELECT COALESCE(cancellation_reason, 'Unspecified') AS cancellation_reason, COUNT(*) AS cancelled_count, ROUND(SUM(total_amount), 2) AS lost_order_value FROM Orders WHERE order_status = 'Cancelled' GROUP BY cancellation_reason ORDER BY cancelled_count DESC;",
        rows: await db.query("SELECT COALESCE(cancellation_reason, 'Unspecified') AS cancellation_reason, COUNT(*) AS cancelled_count, ROUND(SUM(total_amount), 2) AS lost_order_value FROM Orders WHERE order_status = 'Cancelled' GROUP BY cancellation_reason ORDER BY cancelled_count DESC"),
      },
    ];

    const schemaSql = fs.existsSync(path.resolve(process.cwd(), 'database/schema.sql'))
      ? fs.readFileSync(path.resolve(process.cwd(), 'database/schema.sql'), 'utf-8')
      : '';
    const viewsSql = fs.existsSync(path.resolve(process.cwd(), 'database/views.sql'))
      ? fs.readFileSync(path.resolve(process.cwd(), 'database/views.sql'), 'utf-8')
      : '';
    const queriesSql = fs.existsSync(path.resolve(process.cwd(), 'database/queries.sql'))
      ? fs.readFileSync(path.resolve(process.cwd(), 'database/queries.sql'), 'utf-8')
      : '';

    res.json({ queries, schemaSql, viewsSql, queriesSql });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run SQL explorer queries', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 10. Data Management: Table Preview & Row Counts
// ----------------------------------------------------------------------------
const ALLOWED_TABLES = ['Customers', 'Restaurants', 'Delivery_Partners', 'Orders', 'Ratings'] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

router.get('/data/preview', async (req: Request, res: Response) => {
  try {
    const requestedTable = (req.query.table as string) || 'Orders';
    if (!ALLOWED_TABLES.includes(requestedTable as AllowedTable)) {
      res.status(400).json({ error: `Invalid table name. Allowed: ${ALLOWED_TABLES.join(', ')}` });
      return;
    }

    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 25)));
    const counts: Record<string, number> = {};
    for (const tbl of ALLOWED_TABLES) {
      const cntRes = await db.query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
      counts[tbl] = Number(cntRes[0]?.cnt ?? 0);
    }

    const orderBy =
      requestedTable === 'Orders'
        ? 'ORDER BY order_datetime DESC'
        : requestedTable === 'Ratings'
        ? 'ORDER BY rated_at DESC'
        : '';

    const rows = await db.query(`SELECT * FROM ${requestedTable} ${orderBy} LIMIT ?`, [limit]);

    res.json({
      table: requestedTable,
      counts,
      rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch table preview', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 11. Data Management: CSV / Excel Import with Validation, Dedup & Cleaning
// ----------------------------------------------------------------------------
interface ImportRowInput {
  order_id?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  restaurant_name?: unknown;
  cuisine_type?: unknown;
  partner_name?: unknown;
  order_datetime?: unknown;
  city?: unknown;
  order_amount?: unknown;
  delivery_fee?: unknown;
  discount_amount?: unknown;
  total_amount?: unknown;
  payment_method?: unknown;
  order_status?: unknown;
  delivery_time_min?: unknown;
  distance_km?: unknown;
  overall_rating?: unknown;
}

const VALID_PAYMENTS = new Set(['UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Cash on Delivery']);
const VALID_STATUSES = new Set(['Completed', 'Cancelled']);

function cleanText(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

router.post('/data/import', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      rows?: ImportRowInput[];
      options?: {
        skipDuplicates?: boolean;
        fillMissingDefaults?: boolean;
        normalizeText?: boolean;
      };
    };

    if (!Array.isArray(body?.rows) || body.rows.length === 0) {
      res.status(400).json({ error: 'Request must include a non-empty array of rows.' });
      return;
    }

    if (body.rows.length > 2000) {
      res.status(400).json({ error: 'Maximum 2,000 rows per import batch.' });
      return;
    }

    const skipDuplicates = body.options?.skipDuplicates ?? true;
    const fillMissingDefaults = body.options?.fillMissingDefaults ?? true;
    const normalizeText = body.options?.normalizeText ?? true;

    await db.init();

    // Load existing order IDs and dimension lookups
    const existingOrders = await db.query<{ order_id: string }>('SELECT order_id FROM Orders');
    const existingOrderIds = new Set(existingOrders.map((o) => o.order_id));

    const existingCustomers = await db.query<{ customer_id: number; full_name: string; email: string }>(
      'SELECT customer_id, full_name, email FROM Customers'
    );
    const customerByName = new Map(existingCustomers.map((c) => [c.full_name.toLowerCase(), c.customer_id]));

    const existingRestaurants = await db.query<{ restaurant_id: number; restaurant_name: string }>(
      'SELECT restaurant_id, restaurant_name FROM Restaurants'
    );
    const restaurantByName = new Map(
      existingRestaurants.map((r) => [r.restaurant_name.toLowerCase(), r.restaurant_id])
    );

    const existingPartners = await db.query<{ partner_id: number; partner_name: string }>(
      'SELECT partner_id, partner_name FROM Delivery_Partners'
    );
    const partnerByName = new Map(
      existingPartners.map((p) => [p.partner_name.toLowerCase(), p.partner_id])
    );

    const batchSeenIds = new Set<string>();
    let insertedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let filledMissingCount = 0;

    const rowResults: Array<{
      rowNumber: number;
      orderId: string;
      status: 'inserted' | 'duplicate' | 'error';
      message: string;
    }> = [];

    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const rowNum = i + 1;

      const orderId = cleanText(raw.order_id);
      if (!orderId) {
        errorCount++;
        rowResults.push({
          rowNumber: rowNum,
          orderId: '(missing)',
          status: 'error',
          message: 'Missing required order_id.',
        });
        continue;
      }

      if (existingOrderIds.has(orderId) || batchSeenIds.has(orderId)) {
        duplicateCount++;
        rowResults.push({
          rowNumber: rowNum,
          orderId,
          status: 'duplicate',
          message: skipDuplicates
            ? 'Duplicate order_id skipped.'
            : 'Duplicate order_id conflicts with existing record.',
        });
        continue;
      }
      batchSeenIds.add(orderId);

      let customerName = cleanText(raw.customer_name);
      let restaurantName = cleanText(raw.restaurant_name);
      let city = cleanText(raw.city);
      let cuisineType = cleanText(raw.cuisine_type);
      let partnerName = cleanText(raw.partner_name);
      const orderDatetimeRaw = cleanText(raw.order_datetime);

      if (normalizeText) {
        customerName = customerName ? toTitleCase(customerName) : '';
        restaurantName = restaurantName ? toTitleCase(restaurantName) : '';
        city = city ? toTitleCase(city) : '';
        cuisineType = cuisineType ? toTitleCase(cuisineType) : '';
        partnerName = partnerName ? toTitleCase(partnerName) : '';
      }

      if (!customerName || !restaurantName || !city) {
        errorCount++;
        rowResults.push({
          rowNumber: rowNum,
          orderId,
          status: 'error',
          message: 'Missing required customer_name, restaurant_name, or city.',
        });
        continue;
      }

      // Validate datetime
      const parsedDate = orderDatetimeRaw ? new Date(orderDatetimeRaw) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errorCount++;
        rowResults.push({
          rowNumber: rowNum,
          orderId,
          status: 'error',
          message: `Invalid order_datetime "${orderDatetimeRaw || 'empty'}". Expected YYYY-MM-DD HH:MM:SS.`,
        });
        continue;
      }
      const normalizedDatetime = parsedDate.toISOString().replace('T', ' ').slice(0, 19);

      // Numeric validations & missing value handling
      let orderAmount = Number(raw.order_amount);
      let deliveryFee = Number(raw.delivery_fee);
      let discountAmount = Number(raw.discount_amount);
      let totalAmount = Number(raw.total_amount);

      if (Number.isNaN(orderAmount) || orderAmount <= 0) {
        if (!Number.isNaN(totalAmount) && totalAmount > 0 && fillMissingDefaults) {
          orderAmount = Number(Math.max(50, totalAmount - 30).toFixed(2));
          filledMissingCount++;
        } else {
          errorCount++;
          rowResults.push({
            rowNumber: rowNum,
            orderId,
            status: 'error',
            message: 'order_amount must be a positive number.',
          });
          continue;
        }
      }

      if (Number.isNaN(deliveryFee) || deliveryFee < 0) {
        if (fillMissingDefaults) {
          deliveryFee = 30;
          filledMissingCount++;
        } else {
          deliveryFee = 0;
        }
      }
      if (Number.isNaN(discountAmount) || discountAmount < 0) {
        discountAmount = 0;
      }
      if (Number.isNaN(totalAmount) || totalAmount <= 0) {
        totalAmount = Number(Math.max(0, orderAmount + deliveryFee - discountAmount).toFixed(2));
        filledMissingCount++;
      }

      let paymentMethod = cleanText(raw.payment_method);
      if (!VALID_PAYMENTS.has(paymentMethod)) {
        if (fillMissingDefaults) {
          paymentMethod = 'UPI';
          filledMissingCount++;
        } else {
          errorCount++;
          rowResults.push({
            rowNumber: rowNum,
            orderId,
            status: 'error',
            message: `Invalid payment_method "${paymentMethod}".`,
          });
          continue;
        }
      }

      let orderStatus = cleanText(raw.order_status) || 'Completed';
      if (normalizeText) orderStatus = toTitleCase(orderStatus);
      if (!VALID_STATUSES.has(orderStatus)) {
        orderStatus = 'Completed';
        filledMissingCount++;
      }

      let deliveryTimeMin: number | null =
        raw.delivery_time_min === '' || raw.delivery_time_min === null || raw.delivery_time_min === undefined
          ? null
          : Math.round(Number(raw.delivery_time_min));

      if (orderStatus === 'Completed' && (deliveryTimeMin === null || Number.isNaN(deliveryTimeMin) || deliveryTimeMin <= 0)) {
        if (fillMissingDefaults) {
          deliveryTimeMin = 28;
          filledMissingCount++;
        } else {
          deliveryTimeMin = null;
        }
      }
      if (orderStatus === 'Cancelled') {
        deliveryTimeMin = null;
      }

      const distanceKm =
        raw.distance_km && !Number.isNaN(Number(raw.distance_km))
          ? Number(Number(raw.distance_km).toFixed(2))
          : 3.5;

      // Ensure Customer dimension record exists
      let customerId = customerByName.get(customerName.toLowerCase());
      if (!customerId) {
        const emailRaw = cleanText(raw.customer_email) || `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${Date.now()}${rowNum}@example.test`;
        const custIns = await db.execute(
          `INSERT INTO Customers (full_name, email, phone, city, signup_date, customer_segment)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [customerName, emailRaw, '+91-9800000000', city, normalizedDatetime.slice(0, 10), 'New']
        );
        customerId = custIns.insertId!;
        customerByName.set(customerName.toLowerCase(), customerId);
      }

      // Ensure Restaurant dimension record exists
      let restaurantId = restaurantByName.get(restaurantName.toLowerCase());
      if (!restaurantId) {
        const restIns = await db.execute(
          `INSERT INTO Restaurants (restaurant_name, cuisine_type, city, area, commission_rate, avg_prep_time_min, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [restaurantName, cuisineType || 'North Indian', city, 'Central', 18.0, 20, 1]
        );
        restaurantId = restIns.insertId!;
        restaurantByName.set(restaurantName.toLowerCase(), restaurantId);
      }

      // Ensure Delivery Partner dimension record exists (if provided)
      let partnerId: number | null = null;
      if (partnerName) {
        partnerId = partnerByName.get(partnerName.toLowerCase()) ?? null;
        if (!partnerId) {
          const dpIns = await db.execute(
            `INSERT INTO Delivery_Partners (partner_name, vehicle_type, city, joining_date, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [partnerName, 'Bike', city, normalizedDatetime.slice(0, 10), 1]
          );
          partnerId = dpIns.insertId!;
          partnerByName.set(partnerName.toLowerCase(), partnerId);
        }
      }

      await db.execute(
        `INSERT INTO Orders (order_id, customer_id, restaurant_id, partner_id, order_datetime, city, order_amount, delivery_fee, discount_amount, total_amount, payment_method, order_status, delivery_time_min, distance_km, cancellation_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          customerId,
          restaurantId,
          partnerId,
          normalizedDatetime,
          city,
          orderAmount,
          deliveryFee,
          discountAmount,
          totalAmount,
          paymentMethod,
          orderStatus,
          deliveryTimeMin,
          distanceKm,
          orderStatus === 'Cancelled' ? 'Imported cancelled order' : null,
        ]
      );

      // Optional rating
      const ratingNum = Number(raw.overall_rating);
      if (orderStatus === 'Completed' && !Number.isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
        await db.execute(
          `INSERT INTO Ratings (order_id, customer_id, restaurant_id, partner_id, food_rating, delivery_rating, overall_rating, review_comment, rated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            customerId,
            restaurantId,
            partnerId,
            Number(ratingNum.toFixed(1)),
            Number(ratingNum.toFixed(1)),
            Number(ratingNum.toFixed(1)),
            'Imported rating record.',
            normalizedDatetime,
          ]
        );
      }

      existingOrderIds.add(orderId);
      insertedCount++;
      rowResults.push({
        rowNumber: rowNum,
        orderId,
        status: 'inserted',
        message: 'Validated and inserted into SQL database.',
      });
    }

    res.json({
      summary: {
        totalProcessed: body.rows.length,
        insertedCount,
        duplicateCount,
        errorCount,
        filledMissingCount,
      },
      rowResults: rowResults.slice(0, 200),
    });
  } catch (err) {
    res.status(500).json({ error: 'Import processing failed', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 12. Reset Synthetic Baseline Dataset
// ----------------------------------------------------------------------------
router.post('/data/reset', async (_req: Request, res: Response) => {
  try {
    await db.resetToSyntheticBaseline();
    res.json({ status: 'reset', message: 'Database restored to baseline synthetic dataset.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset dataset', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 13. Switch Application Mode (Demo Mode vs MySQL Mode)
// ----------------------------------------------------------------------------
router.post('/data/mode', async (req: Request, res: Response) => {
  try {
    const requested = req.body?.mode;
    if (requested !== 'demo' && requested !== 'mysql') {
      res.status(400).json({ error: "Invalid mode. Allowed values: 'demo' | 'mysql'." });
      return;
    }
    const result = await db.switchMode(requested);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch database mode', details: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// 14. Downloadable CSV Datasets & SQL Scripts (Strictly Whitelisted)
// ----------------------------------------------------------------------------
const DOWNLOAD_WHITELIST: Record<string, string[]> = {
  datasets: [
    'customers.csv',
    'restaurants.csv',
    'orders.csv',
    'delivery_partners.csv',
    'ratings.csv',
    'combined_orders_import_template.csv',
  ],
  database: ['schema.sql', 'seed.sql', 'views.sql', 'queries.sql'],
};

router.get('/data/download/:category/:filename', (req: Request, res: Response) => {
  const category = String(req.params.category || '');
  const filename = String(req.params.filename || '');
  const allowed = DOWNLOAD_WHITELIST[category];

  if (!allowed || !allowed.includes(filename)) {
    res.status(404).json({ error: 'Requested file is not available for download.' });
    return;
  }

  const filePath = path.resolve(process.cwd(), category, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk.' });
    return;
  }

  res.download(filePath, filename);
});

export default router;
