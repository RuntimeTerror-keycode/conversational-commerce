-- KadakaranAI — Seed data
-- Realistic supermarket items with inconsistent shop naming

-- ============================================================
-- CATEGORIES
-- ============================================================

INSERT INTO category (id, name, parent_id) VALUES
    (1,  'Biscuits & Cookies',     NULL),
    (2,  'Beverages & Juices',     NULL),
    (3,  'Snacks & Chips',         NULL),
    (4,  'Rice & Grains',          NULL),
    (5,  'Dairy',                  NULL),
    (6,  'Spices & Masala',        NULL),
    (7,  'Cooking Oil',            NULL),
    (8,  'Personal Care',          NULL),
    (9,  'Cleaning & Household',   NULL),
    (10, 'Instant Food & Noodles', NULL),
    (11, 'Tea & Coffee',           NULL),
    (12, 'Flour & Mixes',          NULL),
    (13, 'Dal & Pulses',           NULL);

SELECT setval('category_id_seq', 13);

-- ============================================================
-- CATALOG (our canonical product list — specific, unambiguous)
-- Every item has: brand + product + variant + size
-- ============================================================

INSERT INTO catalog (id, name, brand, category_id, unit, sku, description) VALUES
    -- Biscuits & Cookies
    (1,  'Parle-G Gold Biscuits 1kg',              'Parle',       1, 'pack',   'BIS-PLG-1KG',   NULL),
    (2,  'Britannia Good Day Cashew Cookies 200g',  'Britannia',   1, 'pack',   'BIS-GDC-200',   NULL),
    (3,  'Sunfeast Dark Fantasy Choco Fills 75g',   'Sunfeast',    1, 'pack',   'BIS-SDF-75',    NULL),
    (4,  'Britannia Marie Gold Biscuits 250g',      'Britannia',   1, 'pack',   'BIS-BMG-250',   NULL),
    (5,  'Cadbury Oreo Original Cream Biscuits 120g','Cadbury',    1, 'pack',   'BIS-ORE-120',   NULL),
    (6,  'Parle Hide & Seek Chocolate Chip Cookies 200g','Parle',  1, 'pack',   'BIS-HNS-200',   NULL),
    (7,  'Britannia 50-50 Maska Chaska 120g',       'Britannia',   1, 'pack',   'BIS-5050-120',  NULL),

    -- Beverages & Juices
    (8,  'Tropicana 100% Orange Juice 1L Tetrapack', 'Tropicana',  2, 'pack',   'BEV-TRO-1L',    NULL),
    (9,  'Real Fruit Power Mixed Fruit Juice 1L',    'Real',       2, 'pack',   'BEV-RMF-1L',    NULL),
    (10, 'Frooti Mango Drink 1.2L PET Bottle',       'Frooti',     2, 'bottle', 'BEV-FRT-1.2L',  NULL),
    (11, 'Paper Boat Aam Panna 200ml',               'Paper Boat', 2, 'pack',   'BEV-PBA-200',   NULL),
    (12, 'Coca-Cola Original 750ml PET Bottle',      'Coca-Cola',  2, 'bottle', 'BEV-COK-750',   NULL),
    (13, 'Sprite Lemon Lime 750ml PET Bottle',       'Sprite',     2, 'bottle', 'BEV-SPR-750',   NULL),
    (14, 'Thums Up 750ml PET Bottle',                'Thums Up',   2, 'bottle', 'BEV-THU-750',   NULL),
    (15, 'Limca Lime & Lemon 750ml PET Bottle',      'Limca',      2, 'bottle', 'BEV-LIM-750',   NULL),

    -- Snacks & Chips
    (16, 'Lay''s Classic Salted Potato Chips 52g',   'Lay''s',     3, 'pack',   'SNK-LAY-52',    NULL),
    (17, 'Kurkure Masala Munch 100g',                'Kurkure',    3, 'pack',   'SNK-KUR-100',   NULL),
    (18, 'Haldiram''s Aloo Bhujia 200g',             'Haldiram''s',3, 'pack',   'SNK-HAB-200',   NULL),
    (19, 'Bingo Mad Angles Tomato Madness 72.5g',    'Bingo',      3, 'pack',   'SNK-BMA-72',    NULL),
    (20, 'Kerala Banana Chips Salted 200g',          NULL,         3, 'pack',   'SNK-KBC-200',   NULL),
    (21, 'Kerala Jackfruit Chips 150g',              NULL,         3, 'pack',   'SNK-JFC-150',   NULL),

    -- Rice & Grains
    (22, 'Jaya Rice 5kg Bag',                        'Jaya',       4, 'kg',     'RIC-JAY-5',     NULL),
    (23, 'Palakkadan Matta Rice (Kerala Red) 5kg Bag',NULL,        4, 'kg',     'RIC-MAT-5',     NULL),
    (24, 'India Gate Basmati Rice Classic 1kg',      'India Gate',  4, 'kg',     'RIC-BAS-1',     NULL),
    (25, 'Sona Masoori Idli Rice 1kg',              NULL,          4, 'kg',     'RIC-IDL-1',     NULL),

    -- Dal & Pulses
    (26, 'Tata Sampann Toor Dal Unpolished 1kg',    'Tata',        13, 'kg',    'DAL-TOR-1',     NULL),
    (27, 'Tata Sampann Moong Dal Yellow 500g',      'Tata',        13, 'pack',  'DAL-MNG-500',   NULL),
    (28, 'Tata Sampann Urad Dal White 500g',        'Tata',        13, 'pack',  'DAL-URD-500',   NULL),
    (29, 'Black Chickpeas Whole (Kala Chana) 500g', NULL,          13, 'pack',  'DAL-KDL-500',   NULL),
    (30, 'Safal Frozen Green Peas 500g',            'Safal',       13, 'pack',  'DAL-GPS-500',   NULL),

    -- Dairy
    (31, 'Milma Pasteurised Toned Milk 500ml',      'Milma',       5, 'pack',   'DRY-MLK-500',   NULL),
    (32, 'Amul Pasteurised Butter 100g Carton',     'Amul',        5, 'pack',   'DRY-AMB-100',   NULL),
    (33, 'Milma Set Curd 400g Cup',                 'Milma',       5, 'pack',   'DRY-CRD-400',   NULL),
    (34, 'Amul Processed Cheese Slices 200g (10 slices)','Amul',   5, 'pack',   'DRY-ACS-200',   NULL),
    (35, 'Milma Cow Ghee 500ml Jar',               'Milma',       5, 'bottle', 'DRY-GHE-500',   NULL),

    -- Spices & Masala
    (36, 'Nirapara Turmeric Powder 100g',           'Nirapara',    6, 'pack',   'SPC-NTP-100',   NULL),
    (37, 'Eastern Chilli Powder 250g',              'Eastern',     6, 'pack',   'SPC-ECP-250',   NULL),
    (38, 'Nirapara Coriander Powder 100g',          'Nirapara',    6, 'pack',   'SPC-NCP-100',   NULL),
    (39, 'Kitchen Treasures Garam Masala 100g',     'Kitchen Treasures', 6, 'pack', 'SPC-KGM-100', NULL),
    (40, 'MTR Sambar Powder 200g',                  'MTR',         6, 'pack',   'SPC-MSP-200',   NULL),
    (41, 'Eastern Special Meat Masala 100g',        'Eastern',     6, 'pack',   'SPC-EMM-100',   NULL),
    (42, 'Eastern Special Fish Masala 100g',        'Eastern',     6, 'pack',   'SPC-EFM-100',   NULL),

    -- Cooking Oil
    (43, 'KLF Coconad Pure Coconut Oil 1L PET Bottle','KLF',      7, 'bottle', 'OIL-KCO-1L',    NULL),
    (44, 'Fortune Sunlite Refined Sunflower Oil 1L Pouch','Fortune',7,'pouch', 'OIL-FSO-1L',    NULL),
    (45, 'Kera Pure Coconut Oil 500ml Bottle',      'Kera',        7, 'bottle', 'OIL-KCO-500',   NULL),

    -- Personal Care
    (46, 'Dettol Original Antibacterial Soap 125g', 'Dettol',      8, 'piece',  'PC-DTS-125',    NULL),
    (47, 'Colgate MaxFresh Blue Gel Toothpaste 150g','Colgate',    8, 'piece',  'PC-CMF-150',    NULL),
    (48, 'Head & Shoulders Smooth & Silky Shampoo 180ml','Head & Shoulders',8,'bottle','PC-HSS-180',NULL),
    (49, 'Santoor Sandal & Turmeric Soap 125g',    'Santoor',     8, 'piece',  'PC-SNT-125',    NULL),

    -- Cleaning & Household
    (50, 'Vim Dishwash Liquid Gel Lemon 500ml',     'Vim',         9, 'bottle', 'CLN-VDL-500',   NULL),
    (51, 'Surf Excel Easy Wash Detergent Powder 1kg','Surf Excel', 9, 'pack',   'CLN-SEW-1KG',   NULL),
    (52, 'Harpic Powerplus Original 500ml',         'Harpic',      9, 'bottle', 'CLN-HRP-500',   NULL),

    -- Instant Food & Noodles
    (53, 'Maggi 2-Minute Masala Noodles 280g (4-pack)','Maggi',   10, 'pack',  'INS-MAG-280',   NULL),
    (54, 'Nissin Top Ramen Curry Noodles 280g (4-pack)','Top Ramen',10,'pack', 'INS-TRC-280',   NULL),
    (55, 'MTR Breakfast Mix Upma 200g',             'MTR',         10, 'pack',  'INS-MUM-200',   NULL),
    (56, 'MTR Breakfast Mix Rava Idli 500g',        'MTR',         10, 'pack',  'INS-MRI-500',   NULL),

    -- Tea & Coffee
    (57, 'Tata Tea Gold Leaf Tea 500g',             'Tata',        11, 'pack',  'TEA-TTG-500',   NULL),
    (58, 'Brooke Bond Red Label Tea 500g',          'Brooke Bond', 11, 'pack',  'TEA-BRL-500',   NULL),
    (59, 'Nescafe Classic Instant Coffee 50g Jar',  'Nescafe',     11, 'pack',  'COF-NSC-50',    NULL),
    (60, 'Bru Instant Coffee 50g Pouch',            'Bru',         11, 'pack',  'COF-BRU-50',    NULL),

    -- Flour & Mixes
    (61, 'Aashirvaad Whole Wheat Atta 5kg',         'Aashirvaad',  12, 'kg',    'FLR-AAT-5',     NULL),
    (62, 'Nirapara Puttu Podi (Rice Flour for Puttu) 1kg','Nirapara',12,'kg',  'FLR-NPP-1',     NULL),
    (63, 'Nirapara Rice Powder 1kg',                'Nirapara',    12, 'kg',    'FLR-NRP-1',     NULL),
    (64, 'Nirapara Appam Podi (Rice Flour for Appam) 1kg','Nirapara',12,'kg',  'FLR-NAP-1',     NULL);

SELECT setval('catalog_id_seq', 64);

-- ============================================================
-- TAGS (search aliases — casual English terms customers might type)
-- These are informal, abbreviated, generic ways people refer to items
-- ============================================================

INSERT INTO tag (catalog_id, tag) VALUES
    -- Rice — people just say "rice" or the variety
    (22, 'rice'), (22, 'jaya rice'), (22, 'white rice'),
    (23, 'matta rice'), (23, 'red rice'), (23, 'kerala rice'), (23, 'brown rice'),
    (24, 'basmati'), (24, 'basmati rice'), (24, 'biryani rice'),
    (25, 'idli rice'),

    -- Dal — people say the type, not "tata sampann"
    (26, 'toor dal'), (26, 'dal'), (26, 'arhar dal'),
    (27, 'moong dal'), (27, 'yellow dal'),
    (28, 'urad dal'), (28, 'urad'),
    (29, 'chickpeas'), (29, 'chana'), (29, 'black chana'), (29, 'kala chana'),
    (30, 'green peas'), (30, 'peas'), (30, 'frozen peas'),

    -- Dairy — generic names
    (31, 'milk'), (31, 'toned milk'),
    (32, 'butter'), (32, 'amul butter'),
    (33, 'curd'), (33, 'yogurt'), (33, 'dahi'),
    (34, 'cheese'), (34, 'cheese slices'), (34, 'sliced cheese'),
    (35, 'ghee'), (35, 'cow ghee'),

    -- Spices — type, not brand
    (36, 'turmeric'), (36, 'turmeric powder'), (36, 'haldi'),
    (37, 'chilli powder'), (37, 'red chilli powder'), (37, 'chili powder'),
    (38, 'coriander powder'), (38, 'coriander'), (38, 'dhaniya powder'),
    (39, 'garam masala'), (39, 'masala mix'),
    (40, 'sambar powder'), (40, 'sambar masala'), (40, 'sambhar powder'),
    (41, 'meat masala'), (41, 'chicken masala'),
    (42, 'fish masala'),

    -- Oil — type not brand
    (43, 'coconut oil'), (43, 'cooking oil'),
    (44, 'sunflower oil'), (44, 'refined oil'),
    (45, 'coconut oil small'), (45, 'coconut oil 500ml'),

    -- Tea & Coffee — brand or generic
    (57, 'tea'), (57, 'tea powder'), (57, 'tata tea'),
    (58, 'tea'), (58, 'red label'), (58, 'red label tea'),
    (59, 'coffee'), (59, 'nescafe'), (59, 'instant coffee'),
    (60, 'coffee'), (60, 'bru'), (60, 'bru coffee'),

    -- Flour — product type
    (61, 'atta'), (61, 'wheat flour'), (61, 'chapati flour'), (61, 'whole wheat'),
    (62, 'puttu flour'), (62, 'puttu powder'),
    (63, 'rice flour'), (63, 'rice powder'),
    (64, 'appam flour'), (64, 'appam mix'),

    -- Noodles — brand is the product
    (53, 'maggi'), (53, 'noodles'), (53, 'instant noodles'), (53, '2 minute noodles'),
    (54, 'top ramen'), (54, 'ramen'), (54, 'curry noodles'),
    (55, 'upma mix'), (55, 'upma'), (55, 'ready to cook upma'),
    (56, 'idli mix'), (56, 'rava idli'), (56, 'instant idli'),

    -- Snacks — brand or type
    (16, 'chips'), (16, 'lays'), (16, 'potato chips'), (16, 'salted chips'),
    (17, 'kurkure'), (17, 'masala snack'),
    (18, 'bhujia'), (18, 'aloo bhujia'), (18, 'namkeen'),
    (19, 'bingo'), (19, 'mad angles'), (19, 'triangle chips'),
    (20, 'banana chips'), (20, 'plantain chips'),
    (21, 'jackfruit chips'),

    -- Biscuits — brand is the identity
    (1,  'parle g'), (1,  'parle biscuit'), (1,  'glucose biscuit'),
    (2,  'good day'), (2,  'cashew biscuit'), (2,  'cashew cookies'),
    (3,  'dark fantasy'), (3,  'choco fills'), (3,  'chocolate biscuit'),
    (4,  'marie'), (4,  'marie gold'), (4,  'marie biscuit'), (4,  'tea biscuit'),
    (5,  'oreo'), (5, 'cream biscuit'),
    (6,  'hide and seek'), (6,  'chocolate chip cookies'),
    (7,  '50 50'), (7,  'fifty fifty'), (7,  'maska chaska'),

    -- Beverages — brand or flavour
    (8,  'orange juice'), (8,  'tropicana'), (8,  'oj'),
    (9,  'mixed fruit juice'), (9,  'fruit juice'),
    (10, 'frooti'), (10, 'mango juice'), (10, 'mango drink'),
    (11, 'aam panna'),
    (12, 'coke'), (12, 'cola'), (12, 'coca cola'),
    (13, 'sprite'), (13, 'lemon soda'),
    (14, 'thumbs up'), (14, 'thums up'),
    (15, 'limca'),

    -- Personal care — brand is the identity
    (46, 'dettol'), (46, 'dettol soap'), (46, 'antibacterial soap'),
    (47, 'colgate'), (47, 'toothpaste'),
    (48, 'shampoo'), (48, 'head and shoulders'), (48, 'h&s shampoo'),
    (49, 'santoor'), (49, 'santoor soap'), (49, 'sandalwood soap'),

    -- Cleaning — brand or function
    (50, 'vim'), (50, 'dishwash'), (50, 'dish soap'), (50, 'dishwash liquid'),
    (51, 'surf excel'), (51, 'detergent'), (51, 'washing powder'),
    (52, 'harpic'), (52, 'toilet cleaner');

-- ============================================================
-- ADDRESSES
-- ============================================================

INSERT INTO address (id, label, address_line, city, pincode, latitude, longitude) VALUES
    -- Shop addresses
    (1, 'Krishna Supermart',   'Edappally Junction, NH 66',        'Kochi', '682024', 10.0261, 76.3125),
    (2, 'Maveli Stores',       'Kakkanad Main Road, Infopark Rd',  'Kochi', '682030', 10.0159, 76.3419),
    (3, 'Lakshmi Grocery',     'Princess Street, Fort Kochi',      'Kochi', '682001',  9.9658, 76.2421),
    -- Customer addresses
    (4, 'Home',                'Palarivattom, Metro Pillar 42',    'Kochi', '682025', 10.0074, 76.3096),
    (5, 'Home',                'Kakkanad, Near Infopark Gate 1',   'Kochi', '682030', 10.0200, 76.3450),
    (6, 'Office',              'Infopark Phase 1, Kakkanad',       'Kochi', '682042', 10.0108, 76.3610);

SELECT setval('address_id_seq', 6);

-- ============================================================
-- SHOPS
-- ============================================================

INSERT INTO shop (id, name, owner_name, phone, opening_time, closing_time, is_active, delivery_radius_km, inventory_mode) VALUES
    (1, 'Krishna Supermart',  'Suresh Kumar',  '919847100001', '07:00', '22:00', true, 5.0,  'managed'),
    (2, 'Maveli Stores',      'Anil Menon',    '919847100002', '08:00', '21:00', true, 4.0,  'managed'),
    (3, 'Lakshmi Grocery',    'Geetha Nair',   '919847100003', '06:30', '21:30', true, 3.5,  'synced');

SELECT setval('shop_id_seq', 3);

INSERT INTO shop_address (shop_id, address_id) VALUES (1, 1), (2, 2), (3, 3);

-- ============================================================
-- CUSTOMERS (demo — upserted from WhatsApp in production)
-- ============================================================

INSERT INTO customer (id, phone, display_name, language) VALUES
    (1, '919847012345', 'Rajesh',  'en'),
    (2, '919847067890', 'Priya',   'en'),
    (3, '919847011111', 'Arun',    'en');

SELECT setval('customer_id_seq', 3);

INSERT INTO customer_address (customer_id, address_id, address_type, is_default) VALUES
    (1, 4, 'home', true),
    (2, 5, 'home', true),
    (3, 6, 'work', true);

-- ============================================================
-- SHOP_PRODUCT
-- Shops have their OWN names for products — messy, inconsistent,
-- missing brands, abbreviated, sometimes just a shelf label.
-- Our catalog is the clean canonical version.
-- local_name = NULL means they happen to match our catalog name.
-- ============================================================

-- Shop 1: Krishna Supermart (large supermarket, somewhat clean naming but still inconsistent)
INSERT INTO shop_product (shop_id, catalog_id, local_name, regular_price, selling_price, stock_quantity, low_stock_threshold, is_available) VALUES
    -- Biscuits
    (1, 1,  'Parle G 1kg',                  110.00,  99.00,  50, 10, true),
    (1, 2,  'Good Day Cashew 200g',          45.00,  42.00,  40, 10, true),
    (1, 3,  'Dark Fantasy 75g',              30.00,  28.00,  35, 10, true),
    (1, 4,  'Marie Gold',                    35.00,  32.00,  60, 10, true),
    (1, 5,  'Oreo 120g',                     30.00,  28.00,  30, 10, true),
    (1, 6,  'Hide & Seek 200g',              42.00,  40.00,  25, 10, true),
    -- Beverages
    (1, 8,  'Tropicana Orange 1L',          120.00, 110.00,  20,  5, true),
    (1, 9,  'Real Juice Mixed Fruit',       110.00, 105.00,  15,  5, true),
    (1, 10, 'Frooti 1.2L',                   85.00,  80.00,  25,  5, true),
    (1, 12, 'Coke 750ml',                    40.00,  38.00,  50, 10, true),
    (1, 13, 'Sprite 750ml',                  40.00,  38.00,  40, 10, true),
    -- Snacks
    (1, 16, 'Lays Salted',                   20.00,  20.00,  80, 15, true),
    (1, 17, 'Kurkure 100g',                  30.00,  28.00,  60, 10, true),
    (1, 18, 'Haldirams Bhujia',              65.00,  60.00,  30, 10, true),
    (1, 20, 'Banana Chips 200g',             80.00,  75.00,  40, 10, true),
    (1, 21, 'Jackfruit Chips',               90.00,  85.00,  20,  5, true),
    -- Rice & Grains
    (1, 22, 'Jaya Rice 5kg',               320.00, 310.00,  30,  5, true),
    (1, 23, 'Matta 5kg',                   380.00, 365.00,  25,  5, true),
    (1, 24, 'IG Basmati 1kg',              180.00, 170.00,  20,  5, true),
    -- Dal
    (1, 26, 'Toor Dal 1kg',                140.00, 130.00,  35, 10, true),
    (1, 27, 'Moong Dal 500g',               85.00,  78.00,  30, 10, true),
    (1, 29, 'Black Chana 500g',              75.00,  70.00,  25, 10, true),
    -- Dairy
    (1, 31, 'Milk 500ml',                    27.00,  27.00, 100, 20, true),
    (1, 32, 'Amul Butter 100g',              56.00,  54.00,  40, 10, true),
    (1, 33, 'Curd 400g',                     35.00,  33.00,  50, 10, true),
    (1, 34, 'Cheese Slices',                 99.00,  95.00,   0,  5, false),  -- out of stock
    (1, 35, 'Ghee 500ml',                   280.00, 265.00,  12,  3, true),
    -- Spices
    (1, 36, 'Turmeric Powder',               32.00,  30.00,  45, 10, true),
    (1, 37, 'Chilli Powder 250g',            72.00,  68.00,  40, 10, true),
    (1, 38, 'Coriander Powder',              30.00,  28.00,  40, 10, true),
    (1, 39, 'Garam Masala',                  55.00,  52.00,  25, 10, true),
    (1, 40, 'MTR Sambar Powder',             78.00,  74.00,  20,  5, true),
    -- Oil
    (1, 43, 'Coconut Oil 1L',              210.00, 199.00,  30,  5, true),
    (1, 44, 'Sunflower Oil 1L',            140.00, 132.00,  25,  5, true),
    -- Personal Care
    (1, 46, 'Dettol Soap',                   42.00,  40.00,  50, 10, true),
    (1, 47, 'Colgate 150g',                  95.00,  90.00,  40, 10, true),
    -- Cleaning
    (1, 50, 'Vim Liquid 500ml',             115.00, 110.00,  20,  5, true),
    (1, 51, 'Surf Excel 1kg',              190.00, 180.00,  15,  5, true),
    -- Noodles
    (1, 53, 'Maggi 4-pack',                  56.00,  52.00,  60, 15, true),
    -- Tea & Coffee
    (1, 57, 'Tata Tea 500g',               265.00, 250.00,  30, 10, true),
    (1, 59, 'Nescafe 50g',                 150.00, 140.00,  20,  5, true),
    -- Flour
    (1, 61, 'Atta 5kg',                    310.00, 295.00,  20,  5, true),
    (1, 62, 'Puttu Powder 1kg',              52.00,  48.00,  30, 10, true),
    (1, 63, 'Rice Powder 1kg',               45.00,  42.00,  25, 10, true);

-- Shop 2: Maveli Stores (mid-size, Kerala-focused, messier naming)
INSERT INTO shop_product (shop_id, catalog_id, local_name, regular_price, selling_price, stock_quantity, low_stock_threshold, is_available) VALUES
    -- Biscuits (just brand names, no sizes)
    (2, 1,  'Parle G Big Pack',             110.00, 100.00,  30, 10, true),
    (2, 4,  'Marie',                         35.00,  33.00,  25, 10, true),
    -- Beverages
    (2, 10, 'Frooti Big',                    85.00,  82.00,  15,  5, true),
    (2, 12, 'Coca Cola',                     40.00,  40.00,  20, 10, true),
    -- Snacks
    (2, 17, 'Kurkure',                       30.00,  29.00,  30, 10, true),
    (2, 20, 'Nendran Chips',                 70.00,  65.00,  50, 10, true),
    (2, 21, 'Chakka Chips',                  85.00,  80.00,  30,  5, true),
    -- Rice (their own local names)
    (2, 22, 'Jaya 5kg',                    320.00, 315.00,  40,  5, true),
    (2, 23, 'Red Rice 5kg',                380.00, 370.00,  50, 10, true),
    (2, 25, 'Idli Rice',                   120.00, 115.00,   0,  5, false),  -- out of stock
    -- Dal (generic names, no brand)
    (2, 26, 'Dal 1kg',                     140.00, 135.00,  40, 10, true),
    (2, 27, 'Moong 500g',                   85.00,  80.00,  35, 10, true),
    (2, 28, 'Urad Dal',                     95.00,  90.00,  25, 10, true),
    (2, 29, 'Kadala 500g',                  75.00,  72.00,  30, 10, true),
    -- Dairy (minimal naming)
    (2, 31, 'Milma Milk',                    27.00,  27.00,  80, 20, true),
    (2, 32, 'Butter',                        56.00,  55.00,  20, 10, true),
    (2, 33, 'Curd',                          35.00,  34.00,  40, 10, true),
    (2, 35, 'Nei 500ml',                   280.00, 270.00,  10,  3, true),
    -- Spices (mix of brand and generic)
    (2, 36, 'Haldi',                         32.00,  31.00,  50, 10, true),
    (2, 37, 'Eastern Mulaku Podi',           72.00,  70.00,  45, 10, true),
    (2, 38, 'Dhaniya Powder',                30.00,  29.00,  45, 10, true),
    (2, 40, 'Sambar Masala',                 78.00,  75.00,  30, 10, true),
    (2, 41, 'Eastern Meat Masala',           48.00,  45.00,  20,  5, true),
    (2, 42, 'Fish Masala',                   48.00,  45.00,  20,  5, true),
    -- Oil (just the type)
    (2, 43, 'Coconut Oil 1L',              210.00, 200.00,  35, 10, true),
    (2, 45, 'Small Coconut Oil',           150.00, 140.00,  20,  5, true),
    -- Noodles
    (2, 53, 'Maggi',                         56.00,  54.00,  30, 10, true),
    (2, 55, 'MTR Upma',                      45.00,  42.00,  20,  5, true),
    -- Tea & Coffee
    (2, 57, 'Tea Powder 500g',             265.00, 255.00,  25, 10, true),
    (2, 58, 'Red Label',                   250.00, 240.00,  20, 10, true),
    (2, 60, 'Bru Coffee',                  120.00, 115.00,  15,  5, true),
    -- Flour (Kerala specialties)
    (2, 62, 'Puttu Podi',                    52.00,  50.00,  40, 10, true),
    (2, 63, 'Rice Flour',                    45.00,  43.00,  35, 10, true),
    (2, 64, 'Appam Powder',                  55.00,  52.00,  25, 10, true);

-- Shop 3: Lakshmi Grocery (small neighbourhood shop, very casual naming)
INSERT INTO shop_product (shop_id, catalog_id, local_name, regular_price, selling_price, stock_quantity, low_stock_threshold, is_available) VALUES
    -- Biscuits (bare minimum names)
    (3, 1,  'Parle G',                     110.00, 105.00,  15, 5, true),
    (3, 4,  'Marie Biscuit',                35.00,  34.00,  20, 5, true),
    -- Beverages
    (3, 12, 'Coke',                          40.00,  40.00,  10, 5, true),
    -- Snacks (local names, no brand)
    (3, 20, 'Kaya Chips',                   65.00,  60.00,  60, 10, true),
    (3, 21, 'Chakka Chips',                 80.00,  75.00,  40, 10, true),
    -- Rice (short names)
    (3, 22, 'Rice 5kg',                    320.00, 318.00,   2,  3, true),   -- low stock
    (3, 23, 'Matta',                       380.00, 375.00,  20,  5, true),
    -- Dal
    (3, 26, 'Toor',                        140.00, 138.00,  15,  5, true),
    (3, 29, 'Kadala',                       75.00,  73.00,  20,  5, true),
    -- Dairy
    (3, 31, 'Milk',                          27.00,  27.00,  50, 15, true),
    (3, 33, 'Curd Cup',                      35.00,  35.00,  30, 10, true),
    -- Spices (just the spice name)
    (3, 36, 'Turmeric',                      32.00,  32.00,  20,  5, true),
    (3, 37, 'Chilli Powder',                 72.00,  72.00,  25,  5, true),
    (3, 38, 'Coriander Powder',              30.00,  30.00,  25,  5, true),
    (3, 40, 'Sambar Powder',                 78.00,  78.00,  15,  5, true),
    -- Oil
    (3, 43, 'Coconut Oil',                 210.00, 205.00,  15,  5, true),
    (3, 45, 'Coconut Oil Half',            150.00, 145.00,  25,  5, true),
    -- Personal care
    (3, 46, 'Dettol',                        42.00,  42.00,  20,  5, true),
    -- Noodles
    (3, 53, 'Maggi Noodles',                 56.00,  55.00,  20,  5, true),
    -- Tea
    (3, 57, 'Tata Tea',                    265.00, 260.00,  15,  5, true),
    -- Flour
    (3, 62, 'Puttu Powder',                  52.00,  52.00,  20,  5, true),
    (3, 63, 'Rice Powder',                   45.00,  45.00,  15,  5, true),
    (3, 64, 'Appam Mix',                     55.00,  55.00,  15,  5, true);

-- ============================================================
-- SHOP USERS (one owner per shop for the hackathon)
-- ============================================================

INSERT INTO shop_user (id, shop_id, username, name, phone, role) VALUES
    (1, 1, 'suresh',  'Suresh Kumar',  '919847100001', 'owner'),
    (2, 2, 'anil',    'Anil Menon',    '919847100002', 'owner'),
    (3, 3, 'geetha',  'Geetha Nair',   '919847100003', 'owner');

SELECT setval('shop_user_id_seq', 3);

-- ---------------------------------------------------------------------------
-- Demo orders
--
-- Follows docs/contracts.md §C2: a fulfillment is born `accepted` (the system
-- auto-accepts), and the shopkeeper advances it accepted -> packed ->
-- out_for_delivery -> delivered. `rejected` is kept defensively — one row
-- exists so the UI branch is reachable, though nothing in the product
-- produces that state.
--
-- Every stage is represented so the dashboard, the work queue and the history
-- screen all have something to show without waiting on the agent.
-- ---------------------------------------------------------------------------

INSERT INTO master_order
  (order_code, customer_id, address_id, status, payment_mode, delivery_type,
   delivery_note, product_amount, delivery_fee, total_amount, trace_id, created_at)
VALUES
  ('ORD-1043', 3, 6, 'accepted', 'cod', 'pickup',   NULL,               121.00, 0, 121.00, 'trc_1043', NOW() - interval '70 minutes'),
  ('ORD-1042', 1, 4, 'accepted', 'cod', 'delivery', 'no onions please', 297.00, 0, 297.00, 'trc_1042', NOW() - interval '4 minutes'),
  ('ORD-1041', 2, 5, 'accepted', 'cod', 'delivery', NULL,               182.00, 0, 182.00, 'trc_1041', NOW() - interval '13 minutes'),
  ('ORD-1040', 3, 6, 'accepted', 'cod', 'pickup',   NULL,                64.00, 0,  64.00, 'trc_1040', NOW() - interval '41 minutes'),
  ('ORD-1039', 1, 4, 'accepted', 'cod', 'delivery', 'second floor, ring the bell', 215.00, 0, 215.00, 'trc_1039', NOW() - interval '2 hours'),
  ('ORD-1038', 2, 5, 'accepted', 'cod', 'delivery', NULL,               138.00, 0, 138.00, 'trc_1038', NOW() - interval '5 hours'),
  ('ORD-1037', 3, 6, 'accepted', 'cod', 'delivery', 'call before coming', 268.00, 0, 268.00, 'trc_1037', NOW() - interval '26 hours'),
  ('ORD-1036', 1, 4, 'accepted', 'cod', 'pickup',   NULL,                99.00, 0,  99.00, 'trc_1036', NOW() - interval '28 hours'),
  ('ORD-1035', 2, 5, 'rejected', 'cod', 'delivery', NULL,                84.00, 0,  84.00, 'trc_1035', NOW() - interval '30 hours');

INSERT INTO fulfillment
  (master_order_id, shop_id, status, subtotal,
   accepted_at, packed_at, out_for_delivery_at, delivered_at, rejected_at, rejection_reason, updated_at)
SELECT m.id, 1, v.status, v.subtotal,
       v.accepted_at, v.packed_at, v.out_at, v.delivered_at, v.rejected_at, v.reason,
       COALESCE(v.delivered_at, v.rejected_at, v.out_at, v.packed_at, v.accepted_at)
FROM (VALUES
  ('ORD-1043','out_for_delivery',121.00, NOW() - interval '70 minutes', NOW() - interval '58 minutes', NOW() - interval '44 minutes', NULL, NULL, NULL),
  ('ORD-1042','accepted',        297.00, NOW() - interval '4 minutes',  NULL, NULL, NULL, NULL, NULL),
  ('ORD-1041','accepted',        182.00, NOW() - interval '13 minutes', NULL, NULL, NULL, NULL, NULL),
  ('ORD-1040','packed',           64.00, NOW() - interval '41 minutes', NOW() - interval '31 minutes', NULL, NULL, NULL, NULL),
  ('ORD-1039','out_for_delivery',215.00, NOW() - interval '2 hours',    NOW() - interval '105 minutes', NOW() - interval '80 minutes', NULL, NULL, NULL),
  ('ORD-1038','delivered',       138.00, NOW() - interval '5 hours',    NOW() - interval '290 minutes', NOW() - interval '275 minutes', NOW() - interval '250 minutes', NULL, NULL),
  ('ORD-1037','delivered',       268.00, NOW() - interval '26 hours',   NOW() - interval '25 hours', NOW() - interval '24 hours', NOW() - interval '23 hours', NULL, NULL),
  ('ORD-1036','delivered',        99.00, NOW() - interval '28 hours',   NOW() - interval '27 hours', NOW() - interval '26 hours', NOW() - interval '25 hours', NULL, NULL),
  ('ORD-1035','rejected',         84.00, NULL, NULL, NULL, NULL, NOW() - interval '30 hours', 'Out of stock for the day')
) AS v(code,status,subtotal,accepted_at,packed_at,out_at,delivered_at,rejected_at,reason)
JOIN master_order m ON m.order_code = v.code;

INSERT INTO order_item (fulfillment_id, shop_product_id, quantity, unit_price, total_price)
SELECT f.id, v.sp, v.qty, sp.selling_price, sp.selling_price * v.qty
FROM (VALUES
  ('ORD-1043', 3, 1), ('ORD-1043', 6, 2),
  ('ORD-1042', 1, 3), ('ORD-1041', 2, 2), ('ORD-1041', 5, 1), ('ORD-1041', 7, 1),
  ('ORD-1040', 4, 2), ('ORD-1039', 7, 1), ('ORD-1039', 8, 1), ('ORD-1038', 6, 2),
  ('ORD-1038', 3, 2), ('ORD-1037', 1, 2), ('ORD-1037', 7, 1), ('ORD-1036', 1, 1),
  ('ORD-1035', 2, 2)
) AS v(code, sp, qty)
JOIN master_order m ON m.order_code = v.code
JOIN fulfillment f ON f.master_order_id = m.id
JOIN shop_product sp ON sp.id = v.sp;

-- Keep the stored subtotal in step with the lines it is made of.
UPDATE fulfillment f SET subtotal = t.sum
FROM (SELECT fulfillment_id, SUM(total_price) AS sum FROM order_item GROUP BY fulfillment_id) t
WHERE t.fulfillment_id = f.id;
UPDATE master_order m SET product_amount = f.subtotal, total_amount = f.subtotal
FROM fulfillment f WHERE f.master_order_id = m.id;

INSERT INTO order_event (master_order_id, fulfillment_id, event_type, actor, note, created_at)
SELECT m.id, f.id, v.ev, v.actor, v.note, v.at
FROM (VALUES
  ('ORD-1043','placed','customer',NULL, NOW() - interval '70 minutes'),
  ('ORD-1043','status_accepted','system','Auto-accepted', NOW() - interval '70 minutes'),
  ('ORD-1043','status_packed','retailer',NULL, NOW() - interval '58 minutes'),
  ('ORD-1043','status_out_for_delivery','retailer','Ready at the counter', NOW() - interval '44 minutes'),
  ('ORD-1042','placed','customer',NULL, NOW() - interval '4 minutes'),
  ('ORD-1042','status_accepted','system','Auto-accepted', NOW() - interval '4 minutes'),
  ('ORD-1041','placed','customer',NULL, NOW() - interval '13 minutes'),
  ('ORD-1041','status_accepted','system','Auto-accepted', NOW() - interval '13 minutes'),
  ('ORD-1040','placed','customer',NULL, NOW() - interval '41 minutes'),
  ('ORD-1040','status_accepted','system','Auto-accepted', NOW() - interval '41 minutes'),
  ('ORD-1040','status_packed','retailer','Status changed to packed', NOW() - interval '31 minutes'),
  ('ORD-1039','placed','customer',NULL, NOW() - interval '2 hours'),
  ('ORD-1039','status_accepted','system','Auto-accepted', NOW() - interval '2 hours'),
  ('ORD-1039','status_packed','retailer',NULL, NOW() - interval '105 minutes'),
  ('ORD-1039','status_out_for_delivery','retailer',NULL, NOW() - interval '80 minutes'),
  ('ORD-1038','placed','customer',NULL, NOW() - interval '5 hours'),
  ('ORD-1038','status_accepted','system','Auto-accepted', NOW() - interval '5 hours'),
  ('ORD-1038','status_packed','retailer',NULL, NOW() - interval '290 minutes'),
  ('ORD-1038','status_out_for_delivery','retailer',NULL, NOW() - interval '275 minutes'),
  ('ORD-1038','status_delivered','retailer',NULL, NOW() - interval '250 minutes'),
  ('ORD-1037','placed','customer',NULL, NOW() - interval '26 hours'),
  ('ORD-1037','status_accepted','system','Auto-accepted', NOW() - interval '26 hours'),
  ('ORD-1037','status_packed','retailer',NULL, NOW() - interval '25 hours'),
  ('ORD-1037','status_out_for_delivery','retailer',NULL, NOW() - interval '24 hours'),
  ('ORD-1037','status_delivered','retailer',NULL, NOW() - interval '23 hours'),
  ('ORD-1036','placed','customer',NULL, NOW() - interval '28 hours'),
  ('ORD-1036','status_accepted','system','Auto-accepted', NOW() - interval '28 hours'),
  ('ORD-1036','status_packed','retailer',NULL, NOW() - interval '27 hours'),
  ('ORD-1036','status_out_for_delivery','retailer','Ready at the counter', NOW() - interval '26 hours'),
  ('ORD-1036','status_delivered','retailer','Collected by the customer', NOW() - interval '25 hours'),
  ('ORD-1035','placed','customer',NULL, NOW() - interval '30 hours'),
  ('ORD-1035','status_rejected','retailer','Out of stock for the day', NOW() - interval '30 hours')
) AS v(code, ev, actor, note, at)
JOIN master_order m ON m.order_code = v.code
JOIN fulfillment f ON f.master_order_id = m.id;

