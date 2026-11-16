-- ============================================================================
-- Food Delivery Order & Restaurant Performance Analytics
-- Core SQL Analytics Queries
-- ============================================================================

USE food_delivery_analytics;

-- 1. Total Orders
SELECT COUNT(*) AS total_orders FROM Orders;

-- 2. Total Revenue (Completed Orders)
SELECT ROUND(SUM(total_amount), 2) AS total_revenue
FROM Orders
WHERE order_status = 'Completed';

-- 3. Average Delivery Time (Minutes)
SELECT ROUND(AVG(delivery_time_min), 2) AS avg_delivery_time_min
FROM Orders
WHERE order_status = 'Completed' AND delivery_time_min IS NOT NULL;

-- 4. Average Customer Rating
SELECT ROUND(AVG(overall_rating), 2) AS avg_customer_rating
FROM Ratings;

-- 5. Cancellation Percentage
SELECT
  COUNT(*) AS total_orders,
  SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
  ROUND(100.0 * SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancellation_pct
FROM Orders;

-- 6. Top 10 Restaurants (via vw_restaurant_rank)
SELECT
  performance_rank,
  restaurant_name,
  cuisine_type,
  city,
  total_orders,
  total_revenue,
  avg_rating,
  cancellation_rate_pct
FROM vw_restaurant_rank
ORDER BY performance_rank ASC
LIMIT 10;

-- 7. Most Popular Cuisines
SELECT
  r.cuisine_type,
  COUNT(o.order_id) AS total_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(rt.overall_rating), 2) AS avg_rating
FROM Restaurants r
JOIN Orders o ON r.restaurant_id = o.restaurant_id
LEFT JOIN Ratings rt ON o.order_id = rt.order_id
GROUP BY r.cuisine_type
ORDER BY total_orders DESC;

-- 8. Peak Ordering Hours (via vw_peak_hours)
SELECT
  order_hour,
  hour_label,
  total_orders,
  completed_orders,
  total_revenue,
  demand_window
FROM vw_peak_hours
ORDER BY total_orders DESC;

-- 9. City-Wise Revenue
SELECT
  o.city,
  COUNT(o.order_id) AS total_orders,
  SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value
FROM Orders o
GROUP BY o.city
ORDER BY total_revenue DESC;

-- 10. Delivery Partner Performance
SELECT
  dp.partner_id,
  dp.partner_name,
  dp.vehicle_type,
  dp.city,
  COUNT(o.order_id) AS assigned_orders,
  SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS delivered_orders,
  ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min,
  SUM(CASE WHEN o.delivery_time_min > 40 THEN 1 ELSE 0 END) AS delayed_deliveries,
  ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating
FROM Delivery_Partners dp
LEFT JOIN Orders o ON dp.partner_id = o.partner_id
LEFT JOIN Ratings rt ON o.order_id = rt.order_id
GROUP BY dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city
ORDER BY avg_delivery_rating DESC, avg_delivery_time_min ASC;
