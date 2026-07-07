
# A production-ready database schema for an e-commerce store

A production-ready database schema for an e-commerce store requires modular, decoupled tables to handle complex relationships like product variations, inventory tracking, tax calculation, and order processing. Below is the structured list of essential production-ready database fields, organized by core tables using standard PostgreSQL data types.

## Admin Tables

**Products Table**

Stores core product data that remains constant across all variations.

1. `id`: **UUID** (Primary Key) – Secure, non-sequential identifier.
2. `title`: **VARCHAR(255)** (Required) – Product name.
3. `slug`: **VARCHAR(255)** (Unique, Indexed) – URL-friendly product handle.
4. `description`: **TEXT** – Main product copy (supports HTML/Markdown).
5. `vendor`: **VARCHAR(100)** – Brand or manufacturer name.
6. `status`: **VARCHAR(50)** – State constraints (draft, active, archived).
7. `created_at / updated_at`: **TIMESTAMPTZ** – Audit timestamps with time zones.

**Product Variants Table**

Manages specific stock-keeping units (SKUs) like different sizes or colours.

1. `id`: **UUID** (Primary Key).
2. `product_id`: **UUID** (Foreign Key) – Links to the Products Table.
3. `sku`: **VARCHAR(100)** (Unique, Indexed) – Stock Keeping Unit code.
4. `barcode`: **VARCHAR(100)** – UPC, EAN, or ISBN for scanning.
5. `price`: **NUMERIC(12, 2)** – Current selling price.
6. `compare_at_price`: **NUMERIC(12, 2)** – Original MSRP for "sale" strikes.
7. `option1_value / option2_value`: VARCHAR(100) – Specific attributes (e.g., Red, XL).
8. `weight`: **NUMERIC(8, 2)** – Package weight for shipping calculations.
9. `weight_unit`: **VARCHAR(10)** – Weight metric (kg, g, lb, oz).

**Inventory Table**

Tracks physical stock across multiple locations or warehouses.
1. id: UUID (Primary Key).
2. variant_id: UUID (Foreign Key, Unique per location) – Links to the Variant.
3. location_id: UUID (Foreign Key) – Identifies the specific warehouse.
4. quantity_available: INTEGER – Stock physically present and ready to sell.
5. quantity_reserved: INTEGER – Stock held in active shopping carts or pending checkout.
6. inventory_policy: VARCHAR(50) – Over-selling behavior (deny, continue).

**Customers Table**

Manages user profiles and authentication metadata.
`id`: **UUID** (Primary Key).
`email`: **VARCHAR(255)** (Unique, Indexed) – Primary contact and login identifier.
`phone`: **VARCHAR(50)** – Mobile number for SMS updates (E.164 format).
`first_name / last_name`: **VARCHAR(100)** – Customer identity fields.
`password_hash`: **VARCHAR(255)** – Securely encrypted credentials.
`accepts_marketing`: **BOOLEAN** – Newsletter opt-in compliance flag.

**Orders Table**

Captures transactions, totals, and processing states.
`id`: **UUID** (Primary Key).
`customer_id`: **UUID** (Foreign Key) – Identifies the purchaser.
`order_number`: **VARCHAR(50)** (Unique, Indexed) – Human-readable invoice number (e.g., #1001).
`currency`: **VARCHAR(3)** – Three-letter ISO currency code (e.g., GBP, USD).
`subtotal_price`: **NUMERIC(12, 2)** – Items price sum before discounts and taxes.
`total_discounts`: **NUMERIC(12, 2)** – Total value deducted via promo codes.
`total_tax`: **NUMERIC(12, 2)** – Aggregated tax charges.
`total_shipping`: **NUMERIC(12, 2)** – Shipping fee charged to the user.
`total_price`: **NUMERIC(12, 2)** – Final total paid by the customer.
`financial_status`: **VARCHAR(50)** – Payment states (pending, paid, refunded).
`fulfillment_status`: **VARCHAR(50)** – Shipping states (unfulfilled, partial, fulfilled).

**Order Items Table**

Immutable snapshots of line items at the exact moment of purchase.
`id`: UUID (Primary Key).
`order_id`: UUID (Foreign Key) – Parent order link.
`variant_id`: UUID (Foreign Key, Nullable) – Variant link (nullable if variant is deleted later).
`title`: VARCHAR(255) – Snapshot of product name.
`sku`: VARCHAR(100) – Snapshot of SKU code.
`price`: NUMERIC(12, 2) – Historical price paid per single unit.
`quantity`: INTEGER – Quantity purchased.

If you would like to expand this system, tell me if you need fields for handling complex multi-currency conversions, structured discount engine schemas, or regional tax matrices.
____________

To support a production-ready store operating simultaneously across France, the UK, Germany, and other global regions, you must handle multi-currency, specific tax laws (like EU VAT rules), and multi-lingual translations.
Below are the production-ready schemas for these systems using PostgreSQL conventions.

## Multi-Currency & Regional Pricing Table

Instead of converting prices on the fly using live exchange rates (which causes fluctuating prices), production stores lock in regional prices per currency.

* id: UUID (Primary Key).
* variant_id: UUID (Foreign Key, Indexed) – Links to the Variant table.
* currency: VARCHAR(3) (Indexed) – Three-letter ISO code (EUR, GBP, USD).
* price: NUMERIC(12, 2) – The locked price for that region (e.g., €19.99 or £17.99).
* compare_at_price: NUMERIC(12, 2) – The regional strike-through MSRP sale price.
* country_code: VARCHAR(2) – Specific country targeting if needed (FR, GB, DE).

## Regional Tax Matrices Table

This handles European VAT compliance (like charging the local rate of the destination country under EU OSS rules) and dynamic calculations.

* id: UUID (Primary Key).
* country_code: VARCHAR(2) (Indexed) – Two-letter ISO code (FR, GB, DE).
* state_province_code: VARCHAR(10) – Regional code (primarily for US/Canada states, use NULL or ALL for UK/EU countries).
* tax_name: VARCHAR(50) – Localized tax label displayed at checkout (VAT, TVA, MwSt).
* tax_rate: NUMERIC(5, 4) – Tax percentage stored as a decimal (e.g., 0.2000 for 20% French TVA, 0.1900 for 19% German MwSt).
* is_compounded: BOOLEAN – Flag specifying if this tax applies on top of other shipping/regional taxes.

## Internationalisation (I18n) Translations Table

To support English, French, and German without cluttering your core tables with fields like title_fr and title_de, use a polymorphic entity-translation table.

* id: UUID (Primary Key).
* translatable_type: VARCHAR(100) (Indexed) – The target core table name (Product, Variant, Collection).
* translatable_id: UUID (Indexed) – The specific ID of the target record.
* locale: VARCHAR(5) (Indexed) – The language/regional tag (en, fr, de).
* field_name: VARCHAR(100) – The column name being translated (title, description, slug).
* translation_text: TEXT – The fully translated localized text.

## Updated Orders Table Fields (For Global Tax Compliance)

When a customer from France or Germany checks out, you must store the localized tax data strictly for audit purposes.

* tax_identifier: VARCHAR(100) – Stores the customer's corporate VAT number if B2B (FR12345678901 or DE123456789).
* tax_regime: VARCHAR(50) – Tracks the legal framework used (EU_OSS, UK_DOMESTIC, US_STATE).
* exchange_rate_to_store_base: NUMERIC(12, 6) – The exact exchange rate to your store's primary base currency at checkout, required for corporate accounting logs.

If you are building out the backend architecture, let me know if you would like me to generate the SQL DDL scripts for these tables, or detail the fields required for an advanced multi-tier discount and coupon engine.










