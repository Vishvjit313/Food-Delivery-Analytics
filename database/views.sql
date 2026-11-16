-- ============================================================================
-- Food Delivery Order & Restaurant Performance Analytics
-- MySQL Analytical Views
-- ============================================================================

USE food_delivery_analytics;

-- ----------------------------------------------------------------------------
-- View 1: vw_peak_hours
-- Aggregates order volume, completed orders, revenue, and average order value
-- across all 24 hours of the day to identify lunch & dinner demand peaks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_peak_hours AS
SELECT
  HOUR(o.order_datetime) AS order_hour,
  CONCAT(LPAD(HOUR(o.order_datetime), 2, '0'), ':00') AS hour_label,
  COUNT(o.order_id) AS total_orders,
  SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value,
  CASE
    WHEN HOUR(o.order_datetime) BETWEEN 12 AND 14 THEN 'Lunch Peak'
    WHEN HOUR(o.order_datetime) BETWEEN 19 AND 22 THEN 'Dinner Peak'
    WHEN HOUR(o.order_datetime) BETWEEN 8 AND 11 THEN 'Morning'
    WHEN HOUR(o.order_datetime) BETWEEN 15 AND 18 THEN 'Afternoon'
    ELSE 'Late Night / Off-Peak'
  END AS demand_window
FROM Orders o
GROUP BY HOUR(o.order_datetime)
ORDER BY order_hour ASC;

-- ----------------------------------------------------------------------------
-- View 2: vw_restaurant_rank
-- Ranks restaurants by completed revenue and average customer rating using
-- SQL window functions (DENSE_RANK).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_restaurant_rank AS
SELECT
  r.restaurant_id,
  r.restaurant_name,
  r.cuisine_type,
  r.city,
  r.area,
  COUNT(o.order_id) AS total_orders,
  SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
  ROUND(
    100.0 * SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) / NULLIF(COUNT(o.order_id), 0),
    2
  ) AS cancellation_rate_pct,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value,
  ROUND(AVG(rt.overall_rating), 2) AS avg_rating,
  ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min,
  DENSE_RANK() OVER (
    ORDER BY
      SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END) DESC,
      AVG(rt.overall_rating) DESC
  ) AS performance_rank
FROM Restaurants r
LEFT JOIN Orders o ON r.restaurant_id = o.restaurant_id
LEFT JOIN Ratings rt ON o.order_id = rt.order_id
GROUP BY r.restaurant_id, r.restaurant_name, r.cuisine_type, r.city, r.area;
