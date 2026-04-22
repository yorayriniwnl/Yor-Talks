const multer = require("multer");
const sharp  = require("sharp");
const path   = require("path");
const fs     = require("fs");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only images are allowed"), false);
};

const mediaFilter = (req, file, cb) => {
  if ([...ALLOWED_IMAGE, ...ALLOWED_VIDEO].includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only images and videos are allowed"), false);
};

const base = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const upload = {
  single: (field) => base.fields([{ name: field, maxCount: 1 }]),
  multiple: (field, max = 10) => base.fields([{ name: field, maxCount: max }]),
  avatar: base.single("avatar"),
  any: base.any(),
};

// Process uploaded images to WebP
const processPostMedia = async (req, res, next) => {
  const files = req.files?.media || req.files?.image || [];
  const processed = [];

  for (const file of (Array.isArray(files) ? files : [files])) {
    if (!file) continue;
    try {
      const isVideo = ALLOWED_VIDEO.includes(file.mimetype);
      const filename = `${uuidv4()}.${isVideo ? "mp4" : "webp"}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      if (isVideo) {
        fs.writeFileSync(filepath, file.buffer);
        processed.push({ url: `/uploads/${filename}`, type: "video" });
      } else {
        const meta = await sharp(file.buffer)
          .resize(1080, 1350, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 88 })
          .toFile(filepath);
        processed.push({ url: `/uploads/${filename}`, type: "image", width: meta.width, height: meta.height });
      }
    } catch (err) {
      console.error("Media processing error:", err.message);
    }
  }

  req.processedMedia = processed;
  next();
};

const processAvatar = async (req, res, next) => {
  const file = req.file;
  if (!file) return next();
  try {
    const filename = `avatar_${uuidv4()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await sharp(file.buffer)
      .resize(300, 300, { fit: "cover", position: "attention" })
      .webp({ quality: 92 })
      .toFile(filepath);
    req.file.url = `/uploads/${filename}`;
    next();
  } catch (err) { next(err); }
};

const processStoryMedia = async (req, res, next) => {
  const file = req.file || req.files?.media?.[0] || (Array.isArray(req.files) ? req.files[0] : null);
  if (!file) return next();
  try {
    const isVideo = ALLOWED_VIDEO.includes(file.mimetype);
    const filename = `story_${uuidv4()}.${isVideo ? "mp4" : "webp"}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    if (isVideo) {
      fs.writeFileSync(filepath, file.buffer);
    } else {
      await sharp(file.buffer)
        .resize(1080, 1920, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(filepath);
    }
    req.storyMedia = { url: `/uploads/${filename}`, type: isVideo ? "video" : "image" };
    next();
  } catch (err) { next(err); }
};

module.exports = { upload, processPostMedia, processAvatar, processStoryMedia };
