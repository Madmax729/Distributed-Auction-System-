// ─── Image Upload Route ───────────────────────────────────────
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// Ensure /uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `auction-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// POST /api/upload — Upload an auction image
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // 🔥 Store ONLY relative path (frontend reconstructs full URL from window.location)
  const relativePath = `/uploads/${req.file.filename}`;

  console.log(`[Upload] Image saved: ${relativePath}`);
  console.log(
    `  [Upload] Server: ${process.env.SERVER_ID}, File: ${req.file.filename}, Size: ${req.file.size}B`,
  );

  res.json({
    imagePath: relativePath, // ← Store ONLY relative path
    filename: req.file.filename,
    size: req.file.size,
    message: "Image uploaded successfully",
  });
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
