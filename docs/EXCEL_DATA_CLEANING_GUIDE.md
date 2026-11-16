# Advanced Microsoft Excel Data Cleaning & Analysis Guide

Before importing raw order CSV/XLSX extracts into MySQL or the web application's **Data Management** module, follow this standardized Excel preprocessing workflow.

---

## 1. Standardizing Text & Removing Whitespace
Raw partner exports often contain trailing spaces or inconsistent casing (`"  bengaluru "`, `"NORTH INDIAN"`).
- **Formula:**
  ```excel
  =PROPER(TRIM(CLEAN(H2)))
  ```
- `CLEAN()` strips non-printable ASCII control characters.
- `TRIM()` removes leading/trailing and double spaces.
- `PROPER()` normalizes city, customer, and restaurant names to Title Case.

---

## 2. Duplicate Detection & Removal
1. Select the dataset (`Ctrl + A`).
2. Navigate to **Data** -> **Data Tools** -> **Remove Duplicates**.
3. Check **My data has headers**, uncheck all columns except `order_id`, and click **OK**.
4. To flag duplicates visually before deleting, apply **Conditional Formatting** -> **Highlight Cells Rules** -> **Duplicate Values** on the `order_id` column.

---

## 3. Handling Missing Values
- **Missing Delivery Fee / Discount:** Replace blank cells using `IF(ISBLANK(J2), 30, J2)` or Go To Special (`F5` -> **Special** -> **Blanks** -> type `0` -> `Ctrl + Enter`).
- **Missing Total Amount Recalculation:**
  ```excel
  =IF(OR(L2="", L2<=0), MAX(0, I2 + J2 - K2), L2)
  ```
  Where `I2 = order_amount`, `J2 = delivery_fee`, `K2 = discount_amount`.
- **Cancelled Order Delivery Times:** Ensure cancelled orders do not skew average delivery times:
  ```excel
  =IF(N2="Cancelled", "", O2)
  ```

---

## 4. Relational Referential Integrity Check (`XLOOKUP`)
Verify that every `restaurant_name` or `customer_id` in `orders.csv` matches the master dimension sheet:
```excel
=IFERROR(XLOOKUP(D2, Restaurants!$B$2:$B$100, Restaurants!$A$2:$A$100), "UNMATCHED_RESTAURANT")
```

---

## 5. PivotTable & SLA Analysis in Excel
1. Convert the cleaned range into an Excel Table (`Ctrl + T`).
2. Add a calculated helper column **`SLA_Status`**:
   ```excel
   =IF([@[order_status]]="Cancelled", "Cancelled", IF([@[delivery_time_min]]>40, "Delayed (>40m)", "On-Time"))
   ```
3. Insert a **PivotTable** (**Insert** -> **PivotTable**):
   - **Rows:** `city`, `cuisine_type`
   - **Columns:** `SLA_Status`
   - **Values:** Count of `order_id`, Sum of `total_amount`, Average of `delivery_time_min`
4. Export the final cleaned sheet as **CSV UTF-8 (Comma delimited) (.csv)** or **.xlsx** and upload it directly inside the application's **Data Management** tab.
