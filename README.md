# Food Delivery Order & Restaurant Performance Analytics

An end-to-end full-stack data analytics platform built with **React**, **Node.js + Express**, **MySQL**, **Recharts**, and **Tailwind CSS**, accompanied by **Power BI** and **Microsoft Excel** workflows.

> **Synthetic Data Notice:** All preloaded records (`datasets/*.csv` and `database/seed.sql`) are **synthetic demonstration data** generated deterministically (200 customers, 30 restaurants, 20 delivery partners, 600 orders, and 473 customer ratings) for academic and analytical prototyping.

---

## 1. Project Folder Structure

```text
├── backend/
│   ├── db.ts                      # Dual-mode SQL adapter (MySQL Mode + Demo Mode)
│   ├── seedData.ts                # Deterministic synthetic data generator
│   ├── sqljs.d.ts                 # Type declarations for embedded SQL fallback
│   └── routes/
│       └── analyticsRoutes.ts     # REST APIs, data import validation & file downloads
├── database/
│   ├── schema.sql                 # MySQL database creation & 5 relational tables
│   ├── seed.sql                   # SQL INSERT statements for all 5 tables
│   ├── views.sql                  # vw_peak_hours & vw_restaurant_rank views
│   └── queries.sql                # 22 analytical SQL queries across 8 domains
├── datasets/
│   ├── customers.csv              # 200 synthetic customers
│   ├── restaurants.csv            # 30 Indian metro restaurants across 8 cuisines
│   ├── delivery_partners.csv      # 20 delivery fleet partners
│   ├── orders.csv                 # 600 food delivery orders
│   ├── ratings.csv                # 473 corresponding customer ratings
│   └── combined_orders_import_template.csv
├── docs/
│   ├── PROJECT_DOCUMENTATION.md   # Full B.Tech project report
│   ├── POWER_BI_INTEGRATION.md    # Power BI MySQL connector, Star Schema & DAX
│   └── EXCEL_DATA_CLEANING_GUIDE.md
├── src/                           # React + TypeScript + Recharts frontend
├── server.ts                      # Express server + Vite middleware (Port 3000)
└── README.md
```

---

## 2. Database Creation & Table Relationships

The MySQL database is named **`food_delivery_analytics`** and implements five normalized tables (`database/schema.sql`):

| Table | Primary Key | Foreign Keys | Description |
| :--- | :--- | :--- | :--- |
| **`Customers`** | `customer_id` | — | Customer profile, city, signup date, segment (`New`, `Regular`, `VIP`) |
| **`Restaurants`** | `restaurant_id` | — | Restaurant name, cuisine, city, area, commission rate, prep time |
| **`Delivery_Partners`** | `partner_id` | — | Partner name, vehicle type, city, joining date |
| **`Orders`** | `order_id` | `customer_id` → `Customers`<br>`restaurant_id` → `Restaurants`<br>`partner_id` → `Delivery_Partners` | Order timestamps, financial totals, payment method, status, delivery time |
| **`Ratings`** | `rating_id` | `order_id` → `Orders` (`UNIQUE`)<br>`customer_id` → `Customers`<br>`restaurant_id` → `Restaurants`<br>`partner_id` → `Delivery_Partners` | Food, delivery, and overall ratings (`1.0–5.0`) plus review text |

### Entity-Relationship Summary
- **One-to-Many (`1:N`)**: `Customers` → `Orders`, `Restaurants` → `Orders`, `Delivery_Partners` → `Orders`
- **One-to-One (`1:0..1`)**: `Orders` → `Ratings` (`Ratings.order_id` has a `UNIQUE` foreign key constraint with `ON DELETE CASCADE`)

### Analytical Views (`database/views.sql`)
1. **`vw_peak_hours`**: Groups orders by hour (`0–23`) to quantify lunch peak (`12:00–14:00`), dinner peak (`19:00–22:00`), completed orders, and hourly revenue.
2. **`vw_restaurant_rank`**: Computes `DENSE_RANK()` across restaurants ordered by completed revenue and average customer rating.

---

## 3. SQL Execution Steps (MySQL 8.0+)

Run the four SQL scripts in exact dependency order from **Command Prompt (Windows)** or **MySQL Workbench**:

```cmd
mysql -u root -p < database\schema.sql
mysql -u root -p < database\seed.sql
mysql -u root -p < database\views.sql
mysql -u root -p < database\queries.sql
```

Or inside the MySQL CLI:
```sql
SOURCE database/schema.sql;
SOURCE database/seed.sql;
SOURCE database/views.sql;
SOURCE database/queries.sql;
```

---

## 4. CSV Import Process

All five CSV files in `datasets/` preserve referential integrity (`customer_id`, `restaurant_id`, `partner_id`, `order_id`).

### Option A: MySQL `LOAD DATA LOCAL INFILE`
```sql
USE food_delivery_analytics;
SET GLOBAL local_infile = 1;

LOAD DATA LOCAL INFILE 'datasets/customers.csv'
INTO TABLE Customers
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(customer_id, full_name, email, phone, city, signup_date, customer_segment);

LOAD DATA LOCAL INFILE 'datasets/restaurants.csv'
INTO TABLE Restaurants
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(restaurant_id, restaurant_name, cuisine_type, city, area, commission_rate, avg_prep_time_min, is_active);

LOAD DATA LOCAL INFILE 'datasets/delivery_partners.csv'
INTO TABLE Delivery_Partners
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(partner_id, partner_name, vehicle_type, city, joining_date, is_active);

LOAD DATA LOCAL INFILE 'datasets/orders.csv'
INTO TABLE Orders
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(order_id, customer_id, restaurant_id, @partner_id, order_datetime, city, order_amount, delivery_fee, discount_amount, total_amount, payment_method, order_status, @delivery_time_min, distance_km, @cancellation_reason)
SET
  partner_id = NULLIF(@partner_id, ''),
  delivery_time_min = NULLIF(@delivery_time_min, ''),
  cancellation_reason = NULLIF(@cancellation_reason, '');

LOAD DATA LOCAL INFILE 'datasets/ratings.csv'
INTO TABLE Ratings
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(rating_id, order_id, customer_id, restaurant_id, @partner_id, food_rating, delivery_rating, overall_rating, review_comment, rated_at)
SET
  partner_id = NULLIF(@partner_id, '');
```

### Option B: MySQL Workbench Table Data Import Wizard
1. Right-click `food_delivery_analytics` → **Table Data Import Wizard**.
2. Import in order: `customers.csv` → `restaurants.csv` → `delivery_partners.csv` → `orders.csv` → `ratings.csv`.

### Option C: Web App Data Management Importer
- Open the **Data Management** tab in the web dashboard to upload `.csv` or `.xlsx` order files with automatic duplicate detection, missing-value imputation, text normalization, and direct SQL commit.

---

## 5. Application Modes & Running Locally (Windows)

The application supports two seamless modes without exposing credentials to the frontend:
- **Demo Mode**: Automatically activates when MySQL credentials are absent or unreachable, running real SQL queries and views against an embedded relational SQL engine seeded with the synthetic dataset.
- **MySQL Mode**: Connects directly to `food_delivery_analytics` using environment variables in `.env`.

### Local Setup on Windows
```cmd
copy .env.example .env
```
Edit `.env` with your MySQL credentials:
```env
DB_MODE=auto
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=food_delivery_analytics
PORT=3000
```
Install packages and start the server:
```cmd
npm install
npm run dev
```
Visit **`http://localhost:3000`**. All CSV and SQL files can also be downloaded directly from the **Data Management** and **SQL & Docs** tabs.
