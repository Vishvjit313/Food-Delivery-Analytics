import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { generateSyntheticDataset } from './seedData.ts';

export type DbDialect = 'mysql' | 'sqlite';
export type AppDataMode = 'demo' | 'mysql';

class DatabaseAdapter {
  private mysqlPool: Pool | null = null;
  private sqliteDb: SqlJsDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  public dialect: DbDialect = 'sqlite';
  public mode: AppDataMode = 'demo';
  public connectionStatus: 'MySQL Connected' | 'Demo Mode (Synthetic Data)' = 'Demo Mode (Synthetic Data)';
  public engineLabel = 'Initializing...';
  public mysqlConfigured = false;
  public fallbackReason: string | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.connectAndInitialize();
    await this.initPromise;
    this.initialized = true;
  }

  private hasValidMysqlConfig(): boolean {
    const dbHost = process.env.DB_HOST?.trim();
    const dbUser = process.env.DB_USER?.trim();
    const dbName = process.env.DB_NAME?.trim();
    const dbPassword = process.env.DB_PASSWORD;
    return Boolean(
      dbHost &&
      dbUser &&
      dbName &&
      dbPassword !== 'your_mysql_password'
    );
  }

  private async connectAndInitialize(requestedMode?: AppDataMode): Promise<void> {
    const envMode = (process.env.DB_MODE || 'auto').toLowerCase();
    this.mysqlConfigured = this.hasValidMysqlConfig();

    const shouldTryMysql =
      requestedMode === 'mysql' ||
      (requestedMode !== 'demo' && envMode !== 'demo' && this.mysqlConfigured);

    if (shouldTryMysql && this.mysqlConfigured) {
      const ok = await this.tryConnectMysql();
      if (ok) return;
    } else if (!this.mysqlConfigured) {
      this.fallbackReason = 'MySQL credentials not configured; running in Demo Mode with synthetic data.';
    } else if (envMode === 'demo' || requestedMode === 'demo') {
      this.fallbackReason = 'Demo Mode selected; using synthetic sample dataset.';
    }

    await this.initEmbeddedSqlite();
  }

  private async tryConnectMysql(): Promise<boolean> {
    const dbHost = process.env.DB_HOST!.trim();
    const dbPort = Number(process.env.DB_PORT || 3306);
    const dbUser = process.env.DB_USER!.trim();
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME!.trim();

    try {
      // Ensure target database exists before opening connection pool
      const bootstrap = await mysql.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
      });
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await bootstrap.end();

      const pool = mysql.createPool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      await pool.query('SELECT 1');
      this.mysqlPool = pool;
      this.dialect = 'mysql';
      this.mode = 'mysql';
      this.connectionStatus = 'MySQL Connected';
      this.engineLabel = 'MySQL 8.0 (food_delivery_analytics)';
      this.fallbackReason = null;
      await this.ensureMysqlSchemaAndSeed();
      return true;
    } catch (err) {
      this.fallbackReason = `MySQL unreachable (${(err as Error).message}); automatically using Demo Mode.`;
      console.warn('[DB] MySQL unavailable; using Demo Mode:', (err as Error).message);
      return false;
    }
  }

  public async switchMode(targetMode: AppDataMode): Promise<{
    switched: boolean;
    mode: AppDataMode;
    connectionStatus: string;
    message: string;
  }> {
    await this.init();

    if (targetMode === 'demo') {
      if (this.mode !== 'demo') {
        await this.initEmbeddedSqlite();
        this.fallbackReason = 'Demo Mode active; using synthetic sample dataset.';
      }
      return {
        switched: true,
        mode: this.mode,
        connectionStatus: this.connectionStatus,
        message: 'Switched to Demo Mode with synthetic demonstration data.',
      };
    }

    // Requested MySQL Mode
    this.mysqlConfigured = this.hasValidMysqlConfig();
    if (!this.mysqlConfigured) {
      return {
        switched: false,
        mode: this.mode,
        connectionStatus: this.connectionStatus,
        message: 'MySQL credentials are not configured in backend environment variables. Staying in Demo Mode.',
      };
    }

    const connected = await this.tryConnectMysql();
    if (!connected) {
      return {
        switched: false,
        mode: this.mode,
        connectionStatus: this.connectionStatus,
        message: this.fallbackReason || 'Unable to reach MySQL server. Staying in Demo Mode.',
      };
    }

    return {
      switched: true,
      mode: this.mode,
      connectionStatus: this.connectionStatus,
      message: 'Connected to MySQL database food_delivery_analytics.',
    };
  }

  private async ensureMysqlSchemaAndSeed(): Promise<void> {
    if (!this.mysqlPool) return;

    const [rows] = await this.mysqlPool.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'Orders'"
    );

    if (rows.length === 0) {
      const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
      const viewsPath = path.resolve(process.cwd(), 'database/views.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
        const statements = schemaSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('CREATE DATABASE') && !s.toUpperCase().startsWith('USE '));
        for (const stmt of statements) {
          await this.mysqlPool.query(stmt);
        }
      }
      if (fs.existsSync(viewsPath)) {
        const viewsSql = fs.readFileSync(viewsPath, 'utf-8');
        const viewStmts = viewsSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('USE '));
        for (const stmt of viewStmts) {
          await this.mysqlPool.query(stmt);
        }
      }
    }

    const [countRows] = await this.mysqlPool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM Orders'
    );
    if (Number(countRows[0]?.cnt ?? 0) === 0) {
      await this.seedDatabase();
    }
  }

  private async initEmbeddedSqlite(): Promise<void> {
    const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    this.sqliteDb = new SQL.Database();
    this.dialect = 'sqlite';
    this.mode = 'demo';
    this.connectionStatus = 'Demo Mode (Synthetic Data)';
    this.engineLabel = 'Demo Mode · Embedded Relational SQL';

    this.sqliteDb.run('PRAGMA foreign_keys = ON;');
    this.createSqliteSchemaAndViews();
    await this.seedDatabase();
  }

  private createSqliteSchemaAndViews(): void {
    if (!this.sqliteDb) return;

    this.sqliteDb.run(`
      DROP VIEW IF EXISTS vw_restaurant_rank;
      DROP VIEW IF EXISTS vw_peak_hours;
      DROP TABLE IF EXISTS Ratings;
      DROP TABLE IF EXISTS Orders;
      DROP TABLE IF EXISTS Delivery_Partners;
      DROP TABLE IF EXISTS Restaurants;
      DROP TABLE IF EXISTS Customers;

      CREATE TABLE Customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        city TEXT NOT NULL,
        signup_date TEXT NOT NULL,
        customer_segment TEXT NOT NULL DEFAULT 'New' CHECK (customer_segment IN ('New', 'Regular', 'VIP'))
      );

      CREATE TABLE Restaurants (
        restaurant_id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_name TEXT NOT NULL,
        cuisine_type TEXT NOT NULL,
        city TEXT NOT NULL,
        area TEXT NOT NULL,
        commission_rate REAL NOT NULL DEFAULT 18.0,
        avg_prep_time_min INTEGER NOT NULL DEFAULT 20,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE Delivery_Partners (
        partner_id INTEGER PRIMARY KEY AUTOINCREMENT,
        partner_name TEXT NOT NULL,
        vehicle_type TEXT NOT NULL DEFAULT 'Bike' CHECK (vehicle_type IN ('Bike', 'Scooter', 'EV Scooter', 'Bicycle')),
        city TEXT NOT NULL,
        joining_date TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE Orders (
        order_id TEXT PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        partner_id INTEGER NULL,
        order_datetime TEXT NOT NULL,
        city TEXT NOT NULL,
        order_amount REAL NOT NULL CHECK (order_amount >= 0),
        delivery_fee REAL NOT NULL DEFAULT 30.0,
        discount_amount REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL CHECK (total_amount >= 0),
        payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Cash on Delivery')),
        order_status TEXT NOT NULL DEFAULT 'Completed' CHECK (order_status IN ('Completed', 'Cancelled')),
        delivery_time_min INTEGER NULL,
        distance_km REAL NOT NULL DEFAULT 3.5,
        cancellation_reason TEXT NULL,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE RESTRICT,
        FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE RESTRICT,
        FOREIGN KEY (partner_id) REFERENCES Delivery_Partners(partner_id) ON DELETE SET NULL
      );

      CREATE TABLE Ratings (
        rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        partner_id INTEGER NULL,
        food_rating REAL NOT NULL CHECK (food_rating >= 1.0 AND food_rating <= 5.0),
        delivery_rating REAL NOT NULL CHECK (delivery_rating >= 1.0 AND delivery_rating <= 5.0),
        overall_rating REAL NOT NULL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
        review_comment TEXT NULL,
        rated_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE RESTRICT,
        FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE RESTRICT,
        FOREIGN KEY (partner_id) REFERENCES Delivery_Partners(partner_id) ON DELETE SET NULL
      );

      CREATE INDEX idx_orders_datetime ON Orders(order_datetime);
      CREATE INDEX idx_orders_city ON Orders(city);
      CREATE INDEX idx_orders_status ON Orders(order_status);
      CREATE INDEX idx_orders_restaurant ON Orders(restaurant_id);
      CREATE INDEX idx_orders_customer ON Orders(customer_id);
      CREATE INDEX idx_orders_partner ON Orders(partner_id);
      CREATE INDEX idx_restaurants_cuisine ON Restaurants(cuisine_type);
      CREATE INDEX idx_ratings_restaurant ON Ratings(restaurant_id);

      CREATE VIEW vw_peak_hours AS
      SELECT
        CAST(strftime('%H', o.order_datetime) AS INTEGER) AS order_hour,
        strftime('%H', o.order_datetime) || ':00' AS hour_label,
        COUNT(o.order_id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
        SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        ROUND(SUM(CASE WHEN o.order_status = 'Completed' THEN o.total_amount ELSE 0 END), 2) AS total_revenue,
        ROUND(AVG(CASE WHEN o.order_status = 'Completed' THEN o.total_amount END), 2) AS avg_order_value,
        CASE
          WHEN CAST(strftime('%H', o.order_datetime) AS INTEGER) BETWEEN 12 AND 14 THEN 'Lunch Peak'
          WHEN CAST(strftime('%H', o.order_datetime) AS INTEGER) BETWEEN 19 AND 22 THEN 'Dinner Peak'
          WHEN CAST(strftime('%H', o.order_datetime) AS INTEGER) BETWEEN 8 AND 11 THEN 'Morning'
          WHEN CAST(strftime('%H', o.order_datetime) AS INTEGER) BETWEEN 15 AND 18 THEN 'Afternoon'
          ELSE 'Late Night / Off-Peak'
        END AS demand_window
      FROM Orders o
      GROUP BY CAST(strftime('%H', o.order_datetime) AS INTEGER)
      ORDER BY order_hour ASC;

      CREATE VIEW vw_restaurant_rank AS
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
    `);
  }

  public async resetToSyntheticBaseline(): Promise<void> {
    await this.init();
    if (this.dialect === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.query('DELETE FROM Ratings');
      await this.mysqlPool.query('DELETE FROM Orders');
      await this.mysqlPool.query('DELETE FROM Delivery_Partners');
      await this.mysqlPool.query('DELETE FROM Restaurants');
      await this.mysqlPool.query('DELETE FROM Customers');
      await this.seedDatabase();
    } else if (this.sqliteDb) {
      this.createSqliteSchemaAndViews();
      await this.seedDatabase();
    }
  }

  private async seedDatabase(): Promise<void> {
    const data = generateSyntheticDataset();

    if (this.dialect === 'mysql' && this.mysqlPool) {
      const conn = await this.mysqlPool.getConnection();
      try {
        await conn.beginTransaction();
        for (const c of data.customers) {
          await conn.query(
            `INSERT INTO Customers (customer_id, full_name, email, phone, city, signup_date, customer_segment)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [c.customer_id, c.full_name, c.email, c.phone, c.city, c.signup_date, c.customer_segment]
          );
        }
        for (const r of data.restaurants) {
          await conn.query(
            `INSERT INTO Restaurants (restaurant_id, restaurant_name, cuisine_type, city, area, commission_rate, avg_prep_time_min, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [r.restaurant_id, r.restaurant_name, r.cuisine_type, r.city, r.area, r.commission_rate, r.avg_prep_time_min, r.is_active]
          );
        }
        for (const dp of data.deliveryPartners) {
          await conn.query(
            `INSERT INTO Delivery_Partners (partner_id, partner_name, vehicle_type, city, joining_date, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city, dp.joining_date, dp.is_active]
          );
        }
        for (const o of data.orders) {
          await conn.query(
            `INSERT INTO Orders (order_id, customer_id, restaurant_id, partner_id, order_datetime, city, order_amount, delivery_fee, discount_amount, total_amount, payment_method, order_status, delivery_time_min, distance_km, cancellation_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [o.order_id, o.customer_id, o.restaurant_id, o.partner_id, o.order_datetime, o.city, o.order_amount, o.delivery_fee, o.discount_amount, o.total_amount, o.payment_method, o.order_status, o.delivery_time_min, o.distance_km, o.cancellation_reason]
          );
        }
        for (const rt of data.ratings) {
          await conn.query(
            `INSERT INTO Ratings (rating_id, order_id, customer_id, restaurant_id, partner_id, food_rating, delivery_rating, overall_rating, review_comment, rated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rt.rating_id, rt.order_id, rt.customer_id, rt.restaurant_id, rt.partner_id, rt.food_rating, rt.delivery_rating, rt.overall_rating, rt.review_comment, rt.rated_at]
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      return;
    }

    if (this.sqliteDb) {
      this.sqliteDb.run('BEGIN TRANSACTION;');
      try {
        const custStmt = this.sqliteDb.prepare(
          `INSERT INTO Customers (customer_id, full_name, email, phone, city, signup_date, customer_segment) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        for (const c of data.customers) {
          custStmt.run([c.customer_id, c.full_name, c.email, c.phone, c.city, c.signup_date, c.customer_segment]);
        }
        custStmt.free();

        const restStmt = this.sqliteDb.prepare(
          `INSERT INTO Restaurants (restaurant_id, restaurant_name, cuisine_type, city, area, commission_rate, avg_prep_time_min, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const r of data.restaurants) {
          restStmt.run([r.restaurant_id, r.restaurant_name, r.cuisine_type, r.city, r.area, r.commission_rate, r.avg_prep_time_min, r.is_active]);
        }
        restStmt.free();

        const dpStmt = this.sqliteDb.prepare(
          `INSERT INTO Delivery_Partners (partner_id, partner_name, vehicle_type, city, joining_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const dp of data.deliveryPartners) {
          dpStmt.run([dp.partner_id, dp.partner_name, dp.vehicle_type, dp.city, dp.joining_date, dp.is_active]);
        }
        dpStmt.free();

        const orderStmt = this.sqliteDb.prepare(
          `INSERT INTO Orders (order_id, customer_id, restaurant_id, partner_id, order_datetime, city, order_amount, delivery_fee, discount_amount, total_amount, payment_method, order_status, delivery_time_min, distance_km, cancellation_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const o of data.orders) {
          orderStmt.run([o.order_id, o.customer_id, o.restaurant_id, o.partner_id, o.order_datetime, o.city, o.order_amount, o.delivery_fee, o.discount_amount, o.total_amount, o.payment_method, o.order_status, o.delivery_time_min, o.distance_km, o.cancellation_reason]);
        }
        orderStmt.free();

        const ratingStmt = this.sqliteDb.prepare(
          `INSERT INTO Ratings (rating_id, order_id, customer_id, restaurant_id, partner_id, food_rating, delivery_rating, overall_rating, review_comment, rated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const rt of data.ratings) {
          ratingStmt.run([rt.rating_id, rt.order_id, rt.customer_id, rt.restaurant_id, rt.partner_id, rt.food_rating, rt.delivery_rating, rt.overall_rating, rt.review_comment, rt.rated_at]);
        }
        ratingStmt.free();

        this.sqliteDb.run('COMMIT;');
      } catch (err) {
        this.sqliteDb.run('ROLLBACK;');
        throw err;
      }
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.init();

    if (this.dialect === 'mysql' && this.mysqlPool) {
      const [rows] = await this.mysqlPool.query<RowDataPacket[]>(sql, params as never[]);
      return rows as unknown as T[];
    }

    if (!this.sqliteDb) {
      throw new Error('Database not initialized');
    }

    const stmt = this.sqliteDb.prepare(sql);
    stmt.bind(params as Array<string | number | null | Uint8Array>);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ insertId?: number; changes: number }> {
    await this.init();

    if (this.dialect === 'mysql' && this.mysqlPool) {
      const [result] = await this.mysqlPool.execute(sql, params as never[]);
      const header = result as { insertId?: number; affectedRows?: number };
      return {
        insertId: header.insertId,
        changes: header.affectedRows ?? 0,
      };
    }

    if (!this.sqliteDb) {
      throw new Error('Database not initialized');
    }

    const stmt = this.sqliteDb.prepare(sql);
    stmt.run(params as Array<string | number | null | Uint8Array>);
    stmt.free();

    const idRows = this.querySync<{ id: number }>('SELECT last_insert_rowid() AS id');
    const changesRows = this.querySync<{ cnt: number }>('SELECT changes() AS cnt');
    return {
      insertId: idRows[0]?.id,
      changes: changesRows[0]?.cnt ?? 0,
    };
  }

  private querySync<T>(sql: string): T[] {
    if (!this.sqliteDb) return [];
    const stmt = this.sqliteDb.prepare(sql);
    const out: T[] = [];
    while (stmt.step()) {
      out.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return out;
  }

  // Dialect-safe SQL expression helpers
  sqlYearMonth(col: string): string {
    return this.dialect === 'mysql'
      ? `DATE_FORMAT(${col}, '%Y-%m')`
      : `strftime('%Y-%m', ${col})`;
  }

  sqlDate(col: string): string {
    return this.dialect === 'mysql' ? `DATE(${col})` : `date(${col})`;
  }

  sqlHour(col: string): string {
    return this.dialect === 'mysql'
      ? `HOUR(${col})`
      : `CAST(strftime('%H', ${col}) AS INTEGER)`;
  }
}

export const db = new DatabaseAdapter();
