# Database Schema For an E-commerce Store

A production-ready database schema for an e-commerce store requires modular, decoupled tables to handle complex relationships like product variations, inventory tracking, tax calculation, and order processing. [1]
Below is the structured list of essential production-ready database fields, organized by core tables using standard PostgreSQL data types.

## Products Table

Stores core product data that remains constant across all variations.

- id: UUID (Primary Key) – Secure, non-sequential identifier.
- title: VARCHAR(255) (Required) – Product name.
- slug: VARCHAR(255) (Unique, Indexed) – URL-friendly product handle.
- description: TEXT – Main product copy (supports HTML/Markdown).
- vendor: VARCHAR(100) – Brand or manufacturer name.
- status: VARCHAR(50) – State constraints (draft, active, archived).
- created_at / updated_at: TIMESTAMPTZ – Audit timestamps with time zones. [2]

## Product Variants Table

Manages specific stock-keeping units (SKUs) like different sizes or colours. [3]

- id: UUID (Primary Key).
- product_id: UUID (Foreign Key) – Links to the Products Table.
- sku: VARCHAR(100) (Unique, Indexed) – Stock Keeping Unit code.
- barcode: VARCHAR(100) – UPC, EAN, or ISBN for scanning.
- price: NUMERIC(12, 2) – Current selling price.
- compare_at_price: NUMERIC(12, 2) – Original MSRP for "sale" strikes.
- option1_value / option2_value: VARCHAR(100) – Specific attributes (e.g., Red, XL).
- weight: NUMERIC(8, 2) – Package weight for shipping calculations.
- weight_unit: VARCHAR(10) – Weight metric (kg, g, lb, oz). [4, 5]

## Inventory Table

Tracks physical stock across multiple locations or warehouses. [6, 7]

- id: UUID (Primary Key).
- variant_id: UUID (Foreign Key, Unique per location) – Links to the Variant.
- location_id: UUID (Foreign Key) – Identifies the specific warehouse.
- quantity_available: INTEGER – Stock physically present and ready to sell.
- quantity_reserved: INTEGER – Stock held in active shopping carts or pending checkout.
- inventory_policy: VARCHAR(50) – Over-selling behavior (deny, continue). [8]

## Customers Table

Manages user profiles and authentication metadata.

- id: UUID (Primary Key).
- email: VARCHAR(255) (Unique, Indexed) – Primary contact and login identifier.
- phone: VARCHAR(50) – Mobile number for SMS updates (E.164 format).
- first_name / last_name: VARCHAR(100) – Customer identity fields.
- password_hash: VARCHAR(255) – Securely encrypted credentials.
- accepts_marketing: BOOLEAN – Newsletter opt-in compliance flag.

## Orders Table

Captures transactions, totals, and processing states.

- id: UUID (Primary Key).
- customer_id: UUID (Foreign Key) – Identifies the purchaser.
- order_number: VARCHAR(50) (Unique, Indexed) – Human-readable invoice number (e.g., #1001).
- currency: VARCHAR(3) – Three-letter ISO currency code (e.g., GBP, USD).
- subtotal_price: NUMERIC(12, 2) – Items price sum before discounts and taxes.
- total_discounts: NUMERIC(12, 2) – Total value deducted via promo codes.
- total_tax: NUMERIC(12, 2) – Aggregated tax charges.
- total_shipping: NUMERIC(12, 2) – Shipping fee charged to the user.
- total_price: NUMERIC(12, 2) – Final total paid by the customer.
- financial_status: VARCHAR(50) – Payment states (pending, paid, refunded).
- fulfillment_status: VARCHAR(50) – Shipping states (unfulfilled, partial, fulfilled). [9]

## Order Items Table

Immutable snapshots of line items at the exact moment of purchase.

- id: UUID (Primary Key).
- order_id: UUID (Foreign Key) – Parent order link.
- variant_id: UUID (Foreign Key, Nullable) – Variant link (nullable if variant is deleted later).
- title: VARCHAR(255) – Snapshot of product name.
- sku: VARCHAR(100) – Snapshot of SKU code.
- price: NUMERIC(12, 2) – Historical price paid per single unit.
- quantity: INTEGER – Quantity purchased.

If you would like to expand this system, tell me if you need fields for handling complex multi-currency conversions, structured discount engine schemas, or regional tax matrices.

[1] [https://emplicit.co](https://emplicit.co/product-database-examples-for-ecommerce-brands/)
[2] [https://getshogun.com](https://getshogun.com/learn/how-to-add-products-on-shopify)
[3] [https://craftybase.com](https://craftybase.com/blog/manage-inventory-woocommerce)
[4] [https://www.stylefactoryproductions.com](https://www.stylefactoryproductions.com/how-to-start-a-shopify-store)
[5] [https://shopify.dev](https://shopify.dev/docs/api/admin-rest/latest/resources/productlisting)
[6] [https://monday.com](https://monday.com/blog/project-management/inventory-management-template/)
[7] [https://addify.store](https://addify.store/product/multi-locations-inventory-management-for-woocommerce/)
[8] [https://barn2.com](https://barn2.com/blog/shopify-csv-import/)
[9] [https://www.coupler.io](https://www.coupler.io/google-sheets-integrations/shopify-to-google-sheets)
