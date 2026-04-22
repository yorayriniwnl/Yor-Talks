const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { auth } = require("../middleware/auth");
const { postView } = require("../utils/helpers");

// GET /api/collections
router.get("/", auth, (req, res) => {
  const cols = db.prepare(`
    SELECT c.*, COUNT(s.post_id) as posts_count
    FROM collections c
    LEFT JOIN saves s ON s.collection_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ collections: cols });
});

// POST /api/collections
router.post("/", auth, [body("name").trim().isLength({ min: 1, max: 60 })], (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ errors: e.array() });
  const id = uuidv4();
  db.prepare("INSERT INTO collections (id,user_id,name,cover_url,is_private) VALUES (?,?,?,?,?)")
    .run(id, req.user.id, req.body.name, req.body.cover_url || "", req.body.is_private ? 1 : 0);
  res.status(201).json({ collection: db.prepare("SELECT * FROM collections WHERE id=?").get(id) });
});

// GET /api/collections/:id
router.get("/:id", auth, (req, res) => {
  const col = db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: "Not found" });
  const posts = db.prepare(`
    SELECT p.* FROM posts p
    INNER JOIN saves s ON s.post_id = p.id
    WHERE s.user_id = ? AND s.collection_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id, col.id);
  res.json({ collection: col, posts: posts.map(p => postView(p, req.user.id)) });
});

// PATCH /api/collections/:id
router.patch("/:id", auth, [body("name").optional().trim().isLength({ min: 1, max: 60 })], (req, res) => {
  const col = db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: "Not found" });
  const { name, cover_url, is_private } = req.body;
  const updates = {};
  if (name !== undefined)      updates.name       = name;
  if (cover_url !== undefined) updates.cover_url  = cover_url;
  if (is_private !== undefined) updates.is_private = is_private ? 1 : 0;
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
  const sets = Object.keys(updates).map(k => `${k}=@${k}`).join(", ");
  db.prepare(`UPDATE collections SET ${sets} WHERE id=@id`).run({ ...updates, id: col.id });
  res.json({ collection: db.prepare("SELECT * FROM collections WHERE id=?").get(col.id) });
});

// DELETE /api/collections/:id
router.delete("/:id", auth, (req, res) => {
  const col = db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: "Not found" });
  // Unsave all posts in collection (keep saves but remove collection link)
  db.prepare("UPDATE saves SET collection_id=NULL WHERE collection_id=? AND user_id=?").run(col.id, req.user.id);
  db.prepare("DELETE FROM collections WHERE id=?").run(col.id);
  res.json({ ok: true });
});

// POST /api/collections/:id/add
router.post("/:id/add", auth, [body("post_id").notEmpty()], (req, res) => {
  const col = db.prepare("SELECT * FROM collections WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: "Collection not found" });
  const save = db.prepare("SELECT * FROM saves WHERE user_id=? AND post_id=?").get(req.user.id, req.body.post_id);
  if (!save) {
    db.prepare("INSERT OR IGNORE INTO saves (user_id,post_id,collection_id) VALUES (?,?,?)").run(req.user.id, req.body.post_id, col.id);
    db.prepare("UPDATE posts SET saves_count=saves_count+1 WHERE id=?").run(req.body.post_id);
  } else {
    db.prepare("UPDATE saves SET collection_id=? WHERE user_id=? AND post_id=?").run(col.id, req.user.id, req.body.post_id);
  }
  res.json({ ok: true });
});

// DELETE /api/collections/:id/remove
router.delete("/:id/remove", auth, [body("post_id").notEmpty()], (req, res) => {
  db.prepare("UPDATE saves SET collection_id=NULL WHERE collection_id=? AND user_id=? AND post_id=?")
    .run(req.params.id, req.user.id, req.body.post_id);
  res.json({ ok: true });
});

module.exports = router;
