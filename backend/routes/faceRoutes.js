const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const faceController = require("../controllers/faceController");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");

const faceRoutes = express.Router();

// ------------------------------------------------------------------
// Multer configuration for face image uploads
// Stores images in backend/uploads/face-attendance/
// ------------------------------------------------------------------
const FACE_UPLOADS_DIR = path.join(__dirname, "../uploads/face-attendance");

const faceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure directory exists — multer won't create it automatically.
    require("fs").mkdirSync(FACE_UPLOADS_DIR, { recursive: true });
    cb(null, FACE_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const studentId = _req.body.studentId || "unknown";
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${studentId}_${timestamp}_${randomSuffix}${ext}`);
  },
});

const faceFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png"];
  const allowedExts = [".jpg", ".jpeg", ".png"];

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = allowedTypes.includes(file.mimetype);
  const extOk = allowedExts.includes(ext);

  if (extOk && mimeOk) {
    cb(null, true);
  } else if (extOk && !mimeOk) {
    cb(new Error("File extension is allowed but MIME type does not match. Allowed: JPEG, PNG."), false);
  } else {
    cb(new Error("Only JPEG and PNG images are allowed for face registration."), false);
  }
};

const uploadFaceImage = multer({
  storage: faceStorage,
  fileFilter: faceFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("image");

// ------------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------------
const faceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many face attendance requests. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------------
// POST /api/faces/register — register a student's face descriptor
// Multer processes the uploaded image before the controller runs.
// ------------------------------------------------------------------
faceRoutes.post(
  "/register",
  authenticateToken,
  faceLimiter,
  (req, res, next) => {
    // Run multer first; pass errors to Express error handler.
    uploadFaceImage(req, res, (err) => {
      if (err) {
        logger.warn("Face image upload rejected", { err: err?.message, studentId: req.body?.studentId });
        return res.status(400).json({
          success: false,
          message: err?.message || "Image upload failed",
        });
      }
      next();
    });
  },
  faceController.registerFace
);

// ------------------------------------------------------------------
// GET /api/faces/:studentId — retrieve a student's face descriptor
// ------------------------------------------------------------------
faceRoutes.get("/:studentId", authenticateToken, faceLimiter, faceController.getFaceDescriptor);

// ------------------------------------------------------------------
// POST /api/attendance/mark-face-detection — mark attendance from
// a batch of face-verified student IDs.
// Mounted at /api/attendance so the path is /api/attendance/mark-face-detection
// ------------------------------------------------------------------
faceRoutes.post("/mark-face-detection", authenticateToken, faceLimiter, faceController.markFaceDetection);

module.exports = faceRoutes;

// Export the limiter so index.js can reuse it for the
// /api/attendance/mark-face-detection mount (same 30/15m window).
module.exports.faceLimiter = faceLimiter;
