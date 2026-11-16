-- ============================================================================
-- Food Delivery Order & Restaurant Performance Analytics
-- MySQL 8.0+ Relational Database Schema
-- NOTE: Sample records inserted by seed scripts are synthetic demonstration data.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS food_delivery_analytics
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE food_delivery_analytics;

-- Drop tables in reverse dependency order for clean re-initialization
DROP TABLE IF EXISTS Ratings;
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS Delivery_Partners;
DROP TABLE IF EXISTS Restaurants;
DROP TABLE IF EXISTS Customers;

-- ----------------------------------------------------------------------------
-- 1. Customers Table
-- ----------------------------------------------------------------------------
CREATE TABLE Customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(80) NOT NULL,
  signup_date DATE NOT NULL,
  customer_segment ENUM('New', 'Regular', 'VIP') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_city (city),
  INDEX idx_customers_signup (signup_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Restaurants Table
-- ----------------------------------------------------------------------------
CREATE TABLE Restaurants (
  restaurant_id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_name VARCHAR(150) NOT NULL,
  cuisine_type VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  area VARCHAR(100) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  avg_prep_time_min INT NOT NULL DEFAULT 20,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 50),
  CONSTRAINT chk_prep_time CHECK (avg_prep_time_min > 0),
  INDEX idx_restaurants_city (city),
  INDEX idx_restaurants_cuisine (cuisine_type)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Delivery_Partners Table
-- ----------------------------------------------------------------------------
CREATE TABLE Delivery_Partners (
  partner_id INT AUTO_INCREMENT PRIMARY KEY,
  partner_name VARCHAR(120) NOT NULL,
  vehicle_type ENUM('Bike', 'Scooter', 'EV Scooter', 'Bicycle') NOT NULL DEFAULT 'Bike',
  city VARCHAR(80) NOT NULL,
  joining_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partners_city (city)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE Orders (
  order_id VARCHAR(32) PRIMARY KEY,
  customer_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  partner_id INT NULL,
  order_datetime DATETIME NOT NULL,
  city VARCHAR(80) NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(8, 2) NOT NULL DEFAULT 30.00,
  discount_amount DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Cash on Delivery') NOT NULL,
  order_status ENUM('Completed', 'Cancelled') NOT NULL DEFAULT 'Completed',
  delivery_time_min INT NULL,
  distance_km DECIMAL(5, 2) NOT NULL DEFAULT 3.50,
  cancellation_reason VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES Customers(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES Restaurants(restaurant_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_partner FOREIGN KEY (partner_id)
    REFERENCES Delivery_Partners(partner_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_order_amounts CHECK (order_amount >= 0 AND total_amount >= 0),
  CONSTRAINT chk_delivery_time CHECK (delivery_time_min IS NULL OR delivery_time_min > 0),

  INDEX idx_orders_datetime (order_datetime),
  INDEX idx_orders_city (city),
  INDEX idx_orders_status (order_status),
  INDEX idx_orders_payment (payment_method),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_restaurant (restaurant_id),
  INDEX idx_orders_partner (partner_id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Ratings Table
-- ----------------------------------------------------------------------------
CREATE TABLE Ratings (
  rating_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  partner_id INT NULL,
  food_rating DECIMAL(2, 1) NOT NULL,
  delivery_rating DECIMAL(2, 1) NOT NULL,
  overall_rating DECIMAL(2, 1) NOT NULL,
  review_comment VARCHAR(255) NULL,
  rated_at DATETIME NOT NULL,

  CONSTRAINT fk_ratings_order FOREIGN KEY (order_id)
    REFERENCES Orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ratings_customer FOREIGN KEY (customer_id)
    REFERENCES Customers(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ratings_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES Restaurants(restaurant_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ratings_partner FOREIGN KEY (partner_id)
    REFERENCES Delivery_Partners(partner_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_food_rating CHECK (food_rating BETWEEN 1.0 AND 5.0),
  CONSTRAINT chk_delivery_rating CHECK (delivery_rating BETWEEN 1.0 AND 5.0),
  CONSTRAINT chk_overall_rating CHECK (overall_rating BETWEEN 1.0 AND 5.0),

  INDEX idx_ratings_restaurant (restaurant_id),
  INDEX idx_ratings_partner (partner_id),
  INDEX idx_ratings_overall (overall_rating)
) ENGINE=InnoDB;
