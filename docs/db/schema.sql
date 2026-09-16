-- KadakaranAI — PostgreSQL schema
-- Multi-vendor aggregator: customer orders split across nearby shops

-- ============================================================
-- 1. CUSTOMERS
-- ============================================================

CREATE TABLE customer (
    id              SERIAL PRIMARY KEY,
    wa_id           VARCHAR(20) NOT NULL UNIQUE,    -- WhatsApp phone, e.g. "919847012345"
    display_name    VARCHAR(255),                    -- from WhatsApp profile, nullable
    language        VARCHAR(50),                     -- detected/preferred: en, ml, mixed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ADDRESSES (shared by customers and shops)
-- ============================================================

CREATE TABLE address (
    id              SERIAL PRIMARY KEY,
    label           VARCHAR(255),                    -- "Home", "Lulu Mall" — from WhatsApp location name
    address_line    VARCHAR(500),
    city            VARCHAR(100),
    pincode         VARCHAR(20),
    latitude        DECIMAL(10,7),
    longitude       DECIMAL(10,7)
);

CREATE TABLE customer_address (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customer(id),
    address_id      INTEGER NOT NULL REFERENCES address(id),
    address_type    VARCHAR(50),                     -- 'home' | 'work' | 'other'
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
    delivery_radius_km  DECIMAL(5,2),                -- geofence for nearby resolution
    inventory_mode      VARCHAR(20) NOT NULL DEFAULT 'managed',  -- 'managed' | 'external'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shop_address (
    id              SERIAL PRIMARY KEY,
    shop_id         INTEGER NOT NULL REFERENCES shop(id),
    address_id      INTEGER NOT NULL REFERENCES address(id)
);

-- ============================================================
-- 4. PRODUCT CATALOG
-- ============================================================

CREATE TABLE category (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    parent_id       INTEGER REFERENCES category(id)  -- hierarchical categories
);

-- Our canonical product list — standardised names, units, categories
-- This is what the customer searches against
CREATE TABLE catalog (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,            -- canonical name: "Jaya Rice 5kg"
    brand           VARCHAR(255),
    category_id     INTEGER REFERENCES category(id),
    unit            VARCHAR(100),                     -- "kg", "litre", "pack", "piece"
    sku             VARCHAR(100),
    description     TEXT
);

-- Search aliases on the catalog: colloquial / Manglish / Malayalam terms
-- "ari" → Rice, "chaya podi" → Tea powder, "kadala" → Chickpeas
CREATE TABLE tag (
    id              SERIAL PRIMARY KEY,
    catalog_id      INTEGER NOT NULL REFERENCES catalog(id),
    tag             VARCHAR(100) NOT NULL
);

-- Per-shop inventory: maps our catalog to each shop's offering
-- Shops may use different names, prices, and stock for the same catalog item
CREATE TABLE shop_product (
    id                  SERIAL PRIMARY KEY,
    shop_id             INTEGER NOT NULL REFERENCES shop(id),
    catalog_id          INTEGER NOT NULL REFERENCES catalog(id),
    local_name          VARCHAR(255),                 -- shop's own name, e.g. "Jaya ari 5kg"; null = use catalog name
    regular_price       DECIMAL(10,2) NOT NULL,
    selling_price       DECIMAL(10,2) NOT NULL,
    stock_quantity      INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    is_available        BOOLEAN NOT NULL DEFAULT true,
    updated_at          TIMESTAMPTZ,
    UNIQUE(shop_id, catalog_id)
);

-- Time-bound promotional pricing
CREATE TABLE offer (
    id              SERIAL PRIMARY KEY,
    shop_product_id INTEGER NOT NULL REFERENCES shop_product(id),
    offer_price     DECIMAL(10,2) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 5. CART (lives in Postgres, not in conversation context)
-- ============================================================

CREATE TABLE cart (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customer(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE TABLE cart_item (
    id              SERIAL PRIMARY KEY,
    cart_id         INTEGER NOT NULL REFERENCES cart(id),
    shop_product_id INTEGER NOT NULL REFERENCES shop_product(id),  -- ties to specific shop's offering
    quantity        INTEGER NOT NULL,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ORDERS — two-level: master (customer) → shop (fulfillment)
-- ============================================================

-- Master order: the customer's unified order
-- Status is derived from the aggregate of its shop_orders
CREATE TABLE master_order (
    id              SERIAL PRIMARY KEY,
    order_code      VARCHAR(20) NOT NULL UNIQUE,     -- human-readable "#1042"
    customer_id     INTEGER NOT NULL REFERENCES customer(id),
    address_id      INTEGER NOT NULL REFERENCES address(id),
    status          VARCHAR(50) NOT NULL DEFAULT 'placed',
    payment_mode    VARCHAR(50) NOT NULL DEFAULT 'cod',
    delivery_type   VARCHAR(50) NOT NULL DEFAULT 'delivery',  -- 'delivery' | 'pickup'
    delivery_note   TEXT,
    product_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    trace_id        VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- Fulfillment: per-shop slice of a master order
-- Each shop independently tracks their portion
-- Status lifecycle: accepted → packed → out_for_delivery → delivered
--                                  └→ rejected
CREATE TABLE fulfillment (
    id                  SERIAL PRIMARY KEY,
    master_order_id     INTEGER NOT NULL REFERENCES master_order(id),
    shop_id             INTEGER NOT NULL REFERENCES shop(id),
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

-- Order items belong to a fulfillment, not the master order
CREATE TABLE order_item (
    id              SERIAL PRIMARY KEY,
    fulfillment_id  INTEGER NOT NULL REFERENCES fulfillment(id),
    shop_product_id INTEGER NOT NULL REFERENCES shop_product(id),
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_price     DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- 7. ORDER EVENTS (audit trail)
-- ============================================================

CREATE TABLE order_event (
    id              SERIAL PRIMARY KEY,
    master_order_id INTEGER REFERENCES master_order(id),
    fulfillment_id  INTEGER REFERENCES fulfillment(id),
    event_type      VARCHAR(50) NOT NULL,            -- 'placed', 'accepted', 'packed', 'status_change', 'item_edited', etc.
    actor           VARCHAR(50) NOT NULL,            -- 'customer' | 'shop' | 'system' | 'agent'
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. MESSAGES (WhatsApp conversation log)
-- ============================================================

CREATE TABLE message (
    id                  SERIAL PRIMARY KEY,
    customer_id         INTEGER NOT NULL REFERENCES customer(id),
    whatsapp_message_id VARCHAR(255) UNIQUE,
    message_type        VARCHAR(50) NOT NULL,         -- 'text' | 'audio' | 'location' | 'image'
    message_text        TEXT,
    audio_url           VARCHAR(1000),
    transcription       TEXT,
    direction           VARCHAR(20) NOT NULL,         -- 'incoming' | 'outgoing'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
