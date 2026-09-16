-- KadakaranAI — PostgreSQL schema
-- Multi-vendor aggregator: customer orders split across nearby shops
-- No foreign key constraints — relations enforced in application queries

-- ============================================================
-- 1. CUSTOMERS
-- ============================================================

CREATE TABLE customer (
    id              SERIAL PRIMARY KEY,
    wa_id           VARCHAR(20) NOT NULL UNIQUE,
    display_name    VARCHAR(255),
    language        VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ADDRESSES (shared by customers and shops)
-- ============================================================

CREATE TABLE address (
    id              SERIAL PRIMARY KEY,
    label           VARCHAR(255),
    address_line    VARCHAR(500),
    city            VARCHAR(100),
    pincode         VARCHAR(20),
    latitude        DECIMAL(10,7),
    longitude       DECIMAL(10,7)
);

CREATE TABLE customer_address (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    address_id      INTEGER NOT NULL,
    address_type    VARCHAR(50),
    is_default      BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- 3. SHOPS (retailers)
-- ============================================================

CREATE TABLE shop (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    owner_name          VARCHAR(255),
    phone               VARCHAR(20) NOT NULL,
    opening_time        TIME,
    closing_time        TIME,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    delivery_radius_km  DECIMAL(5,2),
    inventory_mode      VARCHAR(20) NOT NULL DEFAULT 'managed',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shop_address (
    id              SERIAL PRIMARY KEY,
    shop_id         INTEGER NOT NULL,
    address_id      INTEGER NOT NULL
);

-- ============================================================
-- 4. PRODUCT CATALOG
-- ============================================================

CREATE TABLE category (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    parent_id       INTEGER
);

CREATE TABLE catalog (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    brand           VARCHAR(255),
    category_id     INTEGER,
    unit            VARCHAR(100),
    sku             VARCHAR(100),
    description     TEXT
);

CREATE TABLE tag (
    id              SERIAL PRIMARY KEY,
    catalog_id      INTEGER NOT NULL,
    tag             VARCHAR(100) NOT NULL
);

CREATE TABLE shop_product (
    id                  SERIAL PRIMARY KEY,
    shop_id             INTEGER NOT NULL,
    catalog_id          INTEGER NOT NULL,
    local_name          VARCHAR(255),
    regular_price       DECIMAL(10,2) NOT NULL,
    selling_price       DECIMAL(10,2) NOT NULL,
    stock_quantity      INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    is_available        BOOLEAN NOT NULL DEFAULT true,
    updated_at          TIMESTAMPTZ,
    UNIQUE(shop_id, catalog_id)
);

CREATE TABLE offer (
    id              SERIAL PRIMARY KEY,
    shop_product_id INTEGER NOT NULL,
    offer_price     DECIMAL(10,2) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 5. CART
-- ============================================================

CREATE TABLE cart (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE cart_item (
    id              SERIAL PRIMARY KEY,
    cart_id         INTEGER NOT NULL,
    shop_product_id INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ORDERS — two-level: master (customer) → fulfillment (per-shop)
-- ============================================================

CREATE TABLE master_order (
    id              SERIAL PRIMARY KEY,
    order_code      VARCHAR(20) NOT NULL UNIQUE,
    customer_id     INTEGER NOT NULL,
    address_id      INTEGER NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'placed',
    payment_mode    VARCHAR(50) NOT NULL DEFAULT 'cod',
    delivery_type   VARCHAR(50) NOT NULL DEFAULT 'delivery',
    delivery_note   TEXT,
    product_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    trace_id        VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE fulfillment (
    id                  SERIAL PRIMARY KEY,
    master_order_id     INTEGER NOT NULL,
    shop_id             INTEGER NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'accepted',
    subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
    accepted_at         TIMESTAMPTZ,
    packed_at           TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    updated_at          TIMESTAMPTZ
);

CREATE TABLE order_item (
    id              SERIAL PRIMARY KEY,
    fulfillment_id  INTEGER NOT NULL,
    shop_product_id INTEGER NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_price     DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- 7. ORDER EVENTS (audit trail)
-- ============================================================

CREATE TABLE order_event (
    id              SERIAL PRIMARY KEY,
    master_order_id INTEGER,
    fulfillment_id  INTEGER,
    event_type      VARCHAR(50) NOT NULL,
    actor           VARCHAR(50) NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. MESSAGES (WhatsApp conversation log)
-- ============================================================

CREATE TABLE message (
    id                  SERIAL PRIMARY KEY,
    customer_id         INTEGER NOT NULL,
    whatsapp_message_id VARCHAR(255) UNIQUE,
    message_type        VARCHAR(50) NOT NULL,
    message_text        TEXT,
    audio_url           VARCHAR(1000),
    transcription       TEXT,
    direction           VARCHAR(20) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
