# Food Delivery Order & Restaurant Performance Analytics

## 1. Project Overview & Objective
This project is an end-to-end full-stack analytics system designed for a B.Tech Computer Science Major Project. It models, ingests, cleans, stores, and analyzes food delivery transactions across customers, partner restaurants, cuisines, delivery partners, and post-order customer ratings.

> **Synthetic Data Disclaimer:** All pre-populated records in `database/seed.sql`, `datasets/*.csv`, and the live application database are **synthetic demonstration data** generated programmatically for academic and prototyping purposes. They do not represent actual commercial order volumes or real individuals.

---

## 2. Technology Stack
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Modular SPA dashboard with responsive layout |
| **Styling & Icons** | Tailwind CSS v4 + Lucide React | Light/dark theme system, tabular typography, UI icons |
| **Visualization** | Recharts | Interactive area, bar, composed, and pie/donut charts |
| **Backend** | Node.js + Express.js | REST APIs, query parameterization, data validation |
| **Database** | MySQL 8.0 (`mysql2`) + Embedded SQL Fallback | 5 normalized relational tables, FK constraints, SQL views |
| **Data Cleaning** | Advanced Microsoft Excel / Power Query + SheetJS | CSV/XLSX ingestion, duplicate removal, missing value handling |
| **BI Reporting** | Microsoft Power BI Desktop | Executive multi-page dashboards via MySQL connector |

---

## 3. Relational Database Architecture (ER Model)
The MySQL schema (`database/schema.sql`) implements five normalized tables in Third Normal Form (3NF):

1. **`Customers`** (`customer_id` PK, `full_name`, `email` UNIQUE, `phone`, `city`, `signup_date`, `customer_segment`)
2. **`Restaurants`** (`restaurant_id` PK, `restaurant_name`, `cuisine_type`, `city`, `area`, `commission_rate`, `avg_prep_time_min`, `is_active`)
3. **`Delivery_Partners`** (`partner_id` PK, `partner_name`, `vehicle_type`, `city`, `joining_date`, `is_active`)
4. **`Orders`** (`order_id` PK, `customer_id` FK, `restaurant_id` FK, `partner_id` FK, `order_datetime`, `city`, `order_amount`, `delivery_fee`, `discount_amount`, `total_amount`, `payment_method`, `order_status`, `delivery_time_min`, `distance_km`, `cancellation_reason`)
5. **`Ratings`** (`rating_id` PK, `order_id` FK UNIQUE, `customer_id` FK, `restaurant_id` FK, `partner_id` FK, `food_rating`, `delivery_rating`, `overall_rating`, `review_comment`, `rated_at`)

### SQL Views (`database/views.sql`)
- **`vw_peak_hours`**: Groups orders by `HOUR(order_datetime)` (0–23) to compute order volume, completed orders, revenue, and demand windows (`Lunch Peak`, `Dinner Peak`, `Off-Peak`).
- **`vw_restaurant_rank`**: Joins `Restaurants`, `Orders`, and `Ratings` and computes `DENSE_RANK()` ordered by completed revenue and average rating.

---

## 4. REST API Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Database dialect status and synthetic data notice |
| `GET` | `/api/analytics/filters` | Distinct cities, cuisines, and date boundaries |
| `GET` | `/api/analytics/overview` | Core KPIs, monthly trends, `vw_peak_hours`, city revenue |
| `GET` | `/api/analytics/orders` | Daily/monthly trends, city & payment breakdown, order ledger |
| `GET` | `/api/analytics/restaurants` | Queries `vw_restaurant_rank` for Top 10 & full leaderboard |
| `GET` | `/api/analytics/customers` | Repeat rate, city cohorts, order frequency, top customers |
| `GET` | `/api/analytics/delivery` | Partner KPIs, delayed deliveries (>40 min), SLA compliance |
| `GET` | `/api/analytics/cuisines` | Popularity, revenue, ticket size, and rating by cuisine |
| `GET` | `/api/analytics/sql-explorer` | Live results for all 10 analytical queries & SQL definitions |
| `GET` | `/api/data/preview` | Inspect live rows and counts across all 5 relational tables |
| `POST` | `/api/data/import` | Validate, clean, deduplicate, and commit CSV/Excel batches |
| `POST` | `/api/data/reset` | Restore database to baseline synthetic dataset |

---

## 5. How to Run Locally on Windows (Step-by-Step)

### Prerequisites
1. **Node.js (v20 or v22 LTS)**: Download from `https://nodejs.org/` and verify with `node -v`.
2. **MySQL Server 8.0 + MySQL Workbench**: Download from `https://dev.mysql.com/downloads/installer/`.

### Step 1: Initialize MySQL Database
Open **Command Prompt** or **MySQL Workbench**:
```cmd
mysql -u root -p < database\schema.sql
mysql -u root -p < database\views.sql
mysql -u root -p < database\seed.sql
```
Verify the tables and views:
```sql
USE food_delivery_analytics;
SHOW TABLES;
SELECT * FROM vw_peak_hours;
SELECT * FROM vw_restaurant_rank LIMIT 10;
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```cmd
copy .env.example .env
```
Edit `.env` with your local MySQL credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=food_delivery_analytics
PORT=3000
```

### Step 3: Install Dependencies & Start Server
```cmd
npm install
npm run dev
```
Open `http://localhost:3000` in Chrome or Edge.
