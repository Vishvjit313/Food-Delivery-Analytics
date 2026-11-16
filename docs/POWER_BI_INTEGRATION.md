# Microsoft Power BI Integration Guide

## 1. Prerequisites
- **Microsoft Power BI Desktop** (Windows 64-bit)
- **MySQL Connector/NET** (`dev.mysql.com/downloads/connector/net/`) installed so Power BI can authenticate with MySQL 8.0.
- Local MySQL database `food_delivery_analytics` initialized with `schema.sql`, `views.sql`, and `seed.sql`.

---

## 2. Connecting Power BI to MySQL
1. Open **Power BI Desktop**.
2. Click **Get Data** -> **Database** -> **MySQL database** -> **Connect**.
3. Enter:
   - **Server:** `localhost` (or `localhost:3306`)
   - **Database:** `food_delivery_analytics`
4. Select **Database** authentication, enter your MySQL username and password, and click **Connect**.
5. In the **Navigator**, select:
   - Tables: `Customers`, `Restaurants`, `Delivery_Partners`, `Orders`, `Ratings`
   - Views: `vw_peak_hours`, `vw_restaurant_rank`
6. Click **Load** (or **Transform Data** to verify data types in Power Query).

---

## 3. Recommended Star Schema Model
In the **Model View**:
- Fact Table: `Orders` (center)
- Dimension Tables: `Customers`, `Restaurants`, `Delivery_Partners`
- Bridge/Detail Table: `Ratings` (1-to-1 with `Orders` on `order_id`)
- Relationships:
  - `Customers[customer_id]` (1) -> (*) `Orders[customer_id]`
  - `Restaurants[restaurant_id]` (1) -> (*) `Orders[restaurant_id]`
  - `Delivery_Partners[partner_id]` (1) -> (*) `Orders[partner_id]`
  - `Orders[order_id]` (1) -> (0..1) `Ratings[order_id]`

---

## 4. Essential DAX Measures
Create a dedicated `_Measures` table and add these DAX formulas:

```dax
Total Orders = COUNTROWS(Orders)

Completed Orders =
CALCULATE(COUNTROWS(Orders), Orders[order_status] = "Completed")

Total Revenue =
CALCULATE(SUM(Orders[total_amount]), Orders[order_status] = "Completed")

Average Order Value =
DIVIDE([Total Revenue], [Completed Orders], 0)

Cancellation Rate % =
DIVIDE(
    CALCULATE(COUNTROWS(Orders), Orders[order_status] = "Cancelled"),
    [Total Orders],
    0
)

Average Delivery Time (Min) =
CALCULATE(
    AVERAGE(Orders[delivery_time_min]),
    Orders[order_status] = "Completed"
)

Delayed Deliveries (>40m) =
CALCULATE(
    COUNTROWS(Orders),
    Orders[order_status] = "Completed",
    Orders[delivery_time_min] > 40
)

On-Time Delivery % =
1 - DIVIDE([Delayed Deliveries (>40m)], [Completed Orders], 0)

Average Customer Rating = AVERAGE(Ratings[overall_rating])

Repeat Customers =
COUNTROWS(
    FILTER(
        VALUES(Orders[customer_id]),
        CALCULATE(COUNTROWS(Orders)) >= 2
    )
)
```

---

## 5. Recommended 4-Page Report Layout
1. **Executive Overview**: 5 KPI Cards + Monthly Revenue Area Chart + `vw_peak_hours` Column Chart + City Slicer.
2. **Restaurant & Cuisine Scorecard**: Top 10 Restaurants from `vw_restaurant_rank` + Cuisine Treemap + Rating vs Revenue Scatter Plot.
3. **Delivery Operations**: Partner Leaderboard Table + SLA Compliance Gauge (`On-Time Delivery %`) + City Delay Breakdown.
4. **Customer Retention**: Repeat Customer Rate Card + Segment Donut Chart + Order Frequency Histogram.
