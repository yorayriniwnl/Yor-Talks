/**
 * Yor Talks — In-App Commerce / Shop Routes
 * Creator shops, product listings, product tags on posts, cart, orders
 */
const router = require("express").Router();
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// ─── Shop Profile ─────────────────────────────────────────────────────────────

// GET /api/shop/:username — get a creator's shop
router.get("/:username", optionalAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, name, avatar, verified FROM users WHERE username=?").get(req.params.username);
  if (!user) return res.status(404).json({ error: "Not found" });

  const shop = db.prepare("SELECT * FROM creator_shops WHERE user_id=?").get(user.id);
  if (!shop) return res.status(404).json({ error: "No shop found" });

  const products = db.prepare("SELECT * FROM shop_products WHERE shop_id=? AND status='active' ORDER BY created_at DESC").all(shop.id);
  const stats = {
    product_count: products.length,
    total_sales: db.prepare("SELECT COUNT(*) as c FROM shop_orders WHERE shop_id=? AND status IN ('completed','shipped')").get(shop.id)?.c || 0,
  };

  res.json({ user, shop, products, stats });
});

// POST /api/shop/create — create a shop
router.post("/create", requireAuth, (req, res) => {
  const { shop_name, description, currency = "USD" } = req.body;
  if (!shop_name) return res.status(400).json({ error: "shop_name required" });

  const existing = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (existing) return res.status(400).json({ error: "Shop already exists" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO creator_shops (id, user_id, shop_name, description, currency, status, created_at)
    VALUES (?,?,?,?,?,?,datetime('now'))
  `).run(id, req.userId, shop_name, description || "", currency, "active");

  res.json({ success: true, shop_id: id });
});

// ─── Products ─────────────────────────────────────────────────────────────────

// POST /api/shop/products — create a product
router.post("/products", requireAuth, (req, res) => {
  const { name, description, price, compare_at_price, sku, inventory_count, images, category, is_digital, digital_url } = req.body;
  if (!name || !price) return res.status(400).json({ error: "name and price required" });

  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.status(404).json({ error: "Create a shop first" });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO shop_products (id, shop_id, name, description, price, compare_at_price, sku, inventory_count, images, category, is_digital, digital_url, status, sales_count, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,datetime('now'))
  `).run(id, shop.id, name, description || "", price, compare_at_price || null, sku || null,
     inventory_count || 999, JSON.stringify(images || []), category || "other",
     is_digital ? 1 : 0, digital_url || null, "active");

  res.json({ success: true, product_id: id });
});

// GET /api/shop/products/mine — list my products
router.get("/products/mine", requireAuth, (req, res) => {
  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.json({ products: [] });
  const products = db.prepare("SELECT * FROM shop_products WHERE shop_id=? ORDER BY created_at DESC").all(shop.id);
  res.json({ products });
});

// PATCH /api/shop/products/:id — update product
router.patch("/products/:id", requireAuth, (req, res) => {
  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.status(404).json({ error: "No shop" });
  const { name, description, price, inventory_count, status } = req.body;
  db.prepare(`
    UPDATE shop_products SET
      name=COALESCE(?,name), description=COALESCE(?,description),
      price=COALESCE(?,price), inventory_count=COALESCE(?,inventory_count),
      status=COALESCE(?,status)
    WHERE id=? AND shop_id=?
  `).run(name, description, price, inventory_count, status, req.params.id, shop.id);
  res.json({ success: true });
});

// DELETE /api/shop/products/:id — archive product
router.delete("/products/:id", requireAuth, (req, res) => {
  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.status(404).json({ error: "No shop" });
  db.prepare("UPDATE shop_products SET status='archived' WHERE id=? AND shop_id=?").run(req.params.id, shop.id);
  res.json({ success: true });
});

// POST /api/shop/products/:id/tag — tag product on a post
router.post("/products/:id/tag", requireAuth, (req, res) => {
  const { post_id, x_pos, y_pos } = req.body;
  const product = db.prepare("SELECT id FROM shop_products WHERE id=?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const post = db.prepare("SELECT id FROM posts WHERE id=? AND user_id=?").get(post_id, req.userId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const id = uuidv4();
  db.prepare("INSERT OR REPLACE INTO post_product_tags (id, post_id, product_id, x_pos, y_pos, created_at) VALUES (?,?,?,?,?,datetime('now'))").run(id, post_id, req.params.id, x_pos || 50, y_pos || 50);
  res.json({ success: true });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

// POST /api/shop/orders — place an order
router.post("/orders", requireAuth, (req, res) => {
  const { product_id, quantity = 1, shipping_address } = req.body;
  if (!product_id) return res.status(400).json({ error: "product_id required" });

  const product = db.prepare("SELECT * FROM shop_products WHERE id=? AND status='active'").get(product_id);
  if (!product) return res.status(404).json({ error: "Product not found or unavailable" });
  if (!product.is_digital && product.inventory_count < quantity) return res.status(400).json({ error: "Insufficient inventory" });

  const shop = db.prepare("SELECT * FROM creator_shops WHERE id=?").get(product.shop_id);
  const total = product.price * quantity;
  const id = uuidv4();

  db.prepare(`
    INSERT INTO shop_orders (id, buyer_id, shop_id, product_id, quantity, total_amount, shipping_address, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `).run(id, req.userId, product.shop_id, product_id, quantity, total, JSON.stringify(shipping_address || {}), "pending");

  if (!product.is_digital) {
    db.prepare("UPDATE shop_products SET inventory_count=inventory_count-? WHERE id=?").run(quantity, product_id);
  }
  db.prepare("UPDATE shop_products SET sales_count=sales_count+? WHERE id=?").run(quantity, product_id);

  // Record creator earnings
  const platformFee = Math.round(total * 0.05); // 5% commerce fee
  const net = total - platformFee;
  db.prepare(`
    INSERT INTO creator_earnings (id, creator_id, source_type, source_id, amount, platform_fee, net_amount, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `).run(uuidv4(), shop.user_id, "shop", id, total, platformFee, net, "pending");

  res.json({ success: true, order_id: id, total, estimated_delivery: product.is_digital ? "Instant" : "5-7 business days" });
});

// GET /api/shop/orders/mine — my purchases
router.get("/orders/mine", requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, sp.name as product_name, sp.images, sp.is_digital,
           cs.shop_name, u.username as seller_username
    FROM shop_orders o
    JOIN shop_products sp ON sp.id=o.product_id
    JOIN creator_shops cs ON cs.id=o.shop_id
    JOIN users u ON u.id=cs.user_id
    WHERE o.buyer_id=? ORDER BY o.created_at DESC LIMIT 50
  `).all(req.userId);
  res.json({ orders });
});

// GET /api/shop/orders/shop — orders to my shop
router.get("/orders/shop", requireAuth, (req, res) => {
  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.json({ orders: [] });
  const orders = db.prepare(`
    SELECT o.*, sp.name as product_name, u.username as buyer_username, u.avatar as buyer_avatar
    FROM shop_orders o
    JOIN shop_products sp ON sp.id=o.product_id
    JOIN users u ON u.id=o.buyer_id
    WHERE o.shop_id=? ORDER BY o.created_at DESC LIMIT 100
  `).all(shop.id);
  res.json({ orders });
});

// PATCH /api/shop/orders/:id/status — update order status (seller)
router.patch("/orders/:id/status", requireAuth, (req, res) => {
  const { status, tracking_number } = req.body;
  const shop = db.prepare("SELECT id FROM creator_shops WHERE user_id=?").get(req.userId);
  if (!shop) return res.status(404).json({ error: "No shop" });
  db.prepare("UPDATE shop_orders SET status=?, tracking_number=COALESCE(?,tracking_number) WHERE id=? AND shop_id=?").run(status, tracking_number || null, req.params.id, shop.id);
  if (status === "completed" || status === "shipped") {
    const order = db.prepare("SELECT * FROM shop_orders WHERE id=?").get(req.params.id);
    db.prepare("UPDATE creator_earnings SET status='completed' WHERE source_id=?").run(req.params.id);
    db.prepare("UPDATE creator_profiles SET total_earnings=total_earnings+? WHERE user_id=?").run(order.total_amount * 0.95, req.userId);
  }
  res.json({ success: true });
});

// GET /api/shop/featured — featured products from across platform
router.get("/featured", optionalAuth, (req, res) => {
  const products = db.prepare(`
    SELECT sp.*, cs.shop_name, u.username, u.avatar, u.verified
    FROM shop_products sp
    JOIN creator_shops cs ON cs.id=sp.shop_id
    JOIN users u ON u.id=cs.user_id
    WHERE sp.status='active' ORDER BY sp.sales_count DESC LIMIT 20
  `).all();
  res.json({ products });
});

module.exports = router;
