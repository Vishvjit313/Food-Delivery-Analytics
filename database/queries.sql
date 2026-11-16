-- ============================================================================
-- Food Delivery Order & Restaurant Performance Analytics
-- Comprehensive Analytical SQL Queries (22 Queries across 8 Analytical Domains)
-- Database: food_delivery_analytics (MySQL 8.0+)
-- ============================================================================

USE food_delivery_analytics;

-- ============================================================================
-- DOMAIN 1: REVENUE ANALYSIS
-- ============================================================================

-- Q1. Executive Summary KPIs (Total Orders, Completed Revenue, Avg Ticket, Avg Delivery Time)
SELECT
  COUNT(*) AS total_orders,
  SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_order_value,
  ROUND(AVG(CASE WHEN order_status = 'Completed' THEN delivery_time_min END), 2) AS avg_delivery_time_min
FROM Orders;

-- Q2. Monthly Revenue & Order Volume Trend
SELECT
  DATE_FORMAT(order_datetime, '%Y-%m') AS order_month,
  COUNT(order_id) AS total_orders,
  SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS monthly_revenue,
  ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_order_value
FROM Orders
GROUP BY DATE_FORMAT(order_datetime, '%Y-%m')
ORDER BY order_month ASC;

-- Q3. Revenue & Transaction Share by Payment Method
SELECT
  payment_method,
  COUNT(*) AS total_orders,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM Orders), 2) AS order_share_pct,
  ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_ticket_size
FROM Orders
GROUP BY payment_method
ORDER BY total_revenue DESC;

-- Q4. Promotional Discount Impact & Platform Commission Revenue
SELECT
  COUNT(CASE WHEN discount_amount > 0 THEN 1 END) AS discounted_orders,
  COUNT(CASE WHEN discount_amount = 0 THEN 1 END) AS full_price_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.discount_amount ELSE 0 END), 2) AS total_discounts_given,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.order_amount * (r.commission_rate / 100.0) ELSE 0 END), 2) AS gross_platform_commission
FROM Orders o
JOIN Restaurants r ON o.restaurant_id = r.restaurant_id;

-- ============================================================================
-- DOMAIN 2: RESTAURANT RANKINGS
-- ============================================================================

-- Q5. Top 10 Restaurants by Revenue & Rating (via vw_restaurant_rank)
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

-- Q6. Bottom 5 Restaurants Requiring Operational Attention
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
ORDER BY performance_rank DESC
LIMIT 5;

-- Q7. Restaurant Commission & Average Preparation Speed Comparison
SELECT
  r.restaurant_name,
  r.city,
  r.cuisine_type,
  r.commission_rate,
  r.avg_prep_time_min,
  COUNT(o.order_id) AS completed_orders,
  ROUND(SUM(o.order_amount * (r.commission_rate / 100.0)), 2) AS commission_earned
FROM Restaurants r
JOIN Orders o ON r.restaurant_id = o.restaurant_id
WHERE o.order_status = 'Completed'
GROUP BY r.restaurant_id, r.restaurant_name, r.city, r.cuisine_type, r.commission_rate, r.avg_prep_time_min
ORDER BY commission_earned DESC
LIMIT 15;

-- ============================================================================
-- DOMAIN 3: PEAK ORDERING HOURS
-- ============================================================================

-- Q8. Peak Ordering Hours Ranked by Volume (via vw_peak_hours)
SELECT
  order_hour,
  hour_label,
  total_orders,
  completed_orders,
  total_revenue,
  avg_order_value,
  demand_window
FROM vw_peak_hours
ORDER BY total_orders DESC;

-- Q9. Demand Window Summary (Lunch Peak vs Dinner Peak vs Off-Peak)
SELECT
  demand_window,
  SUM(total_orders) AS window_orders,
  ROUND(SUM(total_revenue), 2) AS window_revenue,
  ROUND(100.0 * SUM(total_orders) / (SELECT COUNT(*) FROM Orders), 2) AS share_of_orders_pct
FROM vw_peak_hours
GROUP BY demand_window
ORDER BY window_orders DESC;

-- Q10. Weekday vs Weekend Order Volume & Average Ticket
SELECT
  CASE
    WHEN DAYOFWEEK(order_datetime) IN (1, 7) THEN 'Weekend'
    ELSE 'Weekday'
  END AS day_type,
  COUNT(*) AS total_orders,
  ROUND(SUM(CASE WHEN order_status = 'Completed' THEN total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN order_status = 'Completed' THEN total_amount END), 2) AS avg_order_value
FROM Orders
GROUP BY day_type;

-- ============================================================================
-- DOMAIN 4: CITY-WISE PERFORMANCE
-- ============================================================================

-- Q11. City-Wise Revenue, Order Count, and Average Order Value
SELECT
  o.city,
  COUNT(o.order_id) AS total_orders,
  SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value,
  ROUND(AVG(rt.overall_rating), 2) AS avg_city_rating
FROM Orders o
LEFT JOIN Ratings rt ON o.order_id = rt.order_id
GROUP BY o.city
ORDER BY total_revenue DESC;

-- Q12. City-Wise Supply & Customer Density
SELECT
  c.city,
  COUNT(DISTINCT c.customer_id) AS registered_customers,
  COUNT(DISTINCT r.restaurant_id) AS active_restaurants,
  COUNT(DISTINCT dp.partner_id) AS active_partners
FROM Customers c
LEFT JOIN Restaurants r ON c.city = r.city
LEFT JOIN Delivery_Partners dp ON c.city = dp.city
GROUP BY c.city
ORDER BY registered_customers DESC;

-- ============================================================================
-- DOMAIN 5: CUISINE ANALYSIS
-- ============================================================================

-- Q13. Most Popular Cuisines by Orders, Revenue, and Rating
SELECT
  r.cuisine_type,
  COUNT(DISTINCT r.restaurant_id) AS restaurant_count,
  COUNT(o.order_id) AS total_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_ticket_size,
  ROUND(AVG(rt.overall_rating), 2) AS avg_rating
FROM Restaurants r
LEFT JOIN Orders o ON r.restaurant_id = o.restaurant_id
LEFT JOIN Ratings rt ON o.order_id = rt.order_id
GROUP BY r.cuisine_type
ORDER BY total_orders DESC;

-- Q14. Top-Grossing Cuisine in Each City (Window Function)
SELECT city, cuisine_type, total_orders, total_revenue
FROM (
  SELECT
    o.city,
    r.cuisine_type,
    COUNT(o.order_id) AS total_orders,
    ROUND(SUM(o.total_amount), 2) AS total_revenue,
    ROW_NUMBER() OVER (PARTITION BY o.city ORDER BY SUM(o.total_amount) DESC) AS rn
  FROM Orders o
  JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
  WHERE o.order_status = 'Completed'
  GROUP BY o.city, r.cuisine_type
) ranked
WHERE rn = 1
ORDER BY total_revenue DESC;

-- ============================================================================
-- DOMAIN 6: CUSTOMER BEHAVIOR
-- ============================================================================

-- Q15. Repeat Customer Rate & Active Customer Count
SELECT
  COUNT(*) AS customers_with_orders,
  SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) AS repeat_customers,
  SUM(CASE WHEN order_count = 1 THEN 1 ELSE 0 END) AS one_time_customers,
  ROUND(100.0 * SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) / COUNT(*), 2) AS repeat_rate_pct
FROM (
  SELECT customer_id, COUNT(*) AS order_count
  FROM Orders
  GROUP BY customer_id
) cust_orders;

-- Q16. Top 10 High-Lifetime-Value (LTV) Customers
SELECT
  c.customer_id,
  c.full_name,
  c.city,
  c.customer_segment,
  COUNT(o.order_id) AS total_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS lifetime_spend,
  ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value
FROM Customers c
JOIN Orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.full_name, c.city, c.customer_segment
ORDER BY lifetime_spend DESC
LIMIT 10;

-- Q17. Customer Segment Revenue & Order Contribution
SELECT
  c.customer_segment,
  COUNT(DISTINCT c.customer_id) AS total_customers,
  COUNT(o.order_id) AS total_orders,
  ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS segment_revenue
FROM Customers c
LEFT JOIN Orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_segment
ORDER BY segment_revenue DESC;

-- ============================================================================
-- DOMAIN 7: DELIVERY PERFORMANCE
-- ============================================================================

-- Q18. Delivery Partner Performance Leaderboard
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

-- Q19. Delivery Speed & SLA Compliance by Vehicle Type
SELECT
  dp.vehicle_type,
  COUNT(o.order_id) AS completed_deliveries,
  ROUND(AVG(o.distance_km), 2) AS avg_distance_km,
  ROUND(AVG(o.delivery_time_min), 1) AS avg_delivery_time_min,
  ROUND(100.0 * SUM(CASE WHEN o.delivery_time_min <= 40 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_sla_pct
FROM Delivery_Partners dp
JOIN Orders o ON dp.partner_id = o.partner_id
WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL
GROUP BY dp.vehicle_type
ORDER BY avg_delivery_time_min ASC;

-- Q20. Average Customer Rating Breakdown: On-Time (<=40m) vs Delayed (>40m)
SELECT
  CASE
    WHEN o.delivery_time_min <= 40 THEN 'On-Time (<= 40 min)'
    ELSE 'Delayed (> 40 min)'
  END AS sla_bucket,
  COUNT(*) AS rated_orders,
  ROUND(AVG(rt.delivery_rating), 2) AS avg_delivery_rating,
  ROUND(AVG(rt.overall_rating), 2) AS avg_overall_rating
FROM Orders o
JOIN Ratings rt ON o.order_id = rt.order_id
WHERE o.order_status = 'Completed' AND o.delivery_time_min IS NOT NULL
GROUP BY sla_bucket;

-- ============================================================================
-- DOMAIN 8: CANCELLATION ANALYSIS
-- ============================================================================

-- Q21. Overall Cancellation Percentage & Lost Revenue Estimate
SELECT
  COUNT(*) AS total_orders,
  SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
  ROUND(100.0 * SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancellation_pct,
  ROUND(SUM(CASE WHEN order_status = 'Cancelled' THEN total_amount ELSE 0 END), 2) AS cancelled_gross_value
FROM Orders;

-- Q22. Cancellation Reasons Breakdown
SELECT
  COALESCE(cancellation_reason, 'Unspecified') AS cancellation_reason,
  COUNT(*) AS cancelled_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM Orders WHERE order_status = 'Cancelled'), 2) AS share_of_cancellations_pct,
  ROUND(SUM(total_amount), 2) AS lost_order_value
FROM Orders
WHERE order_status = 'Cancelled'
GROUP BY cancellation_reason
ORDER BY cancelled_count DESC;
