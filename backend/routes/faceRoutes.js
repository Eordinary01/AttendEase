const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const faceController = require("../controllers/faceController");
const { authenticateToken } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const logger = require("../utils/logger");

const faceRoutes = express.Router();

faceRoutes.use(authenticateToken);
faceRoutes.use(featureGuard("biometric_attendance"));

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
// Rate limiters (Per-User Keyed with Structured Production Logging)
// ------------------------------------------------------------------
const faceReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min window
  max: 600, // Generous read capacity for loading class rosters and descriptor batches
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    logger.warn("Face descriptor read rate limit exceeded", {
      userId: req.user?._id,
      tenantId: req.user?.tenantId,
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(429).json({
      success: false,
      message: "Too many face descriptor requests. Please wait a moment before trying again.",
      retryAfterSeconds: 30,
    });
  },
});

const faceWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 150, // Capacity for marking and enrolling
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    logger.warn("Face attendance write rate limit exceeded", {
      userId: req.user?._id,
      tenantId: req.user?.tenantId,
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(429).json({
      success: false,
      message: "Too many face attendance submissions. Please wait a moment before trying again.",
      retryAfterSeconds: 30,
    });
  },
});

// ------------------------------------------------------------------
// POST /api/faces/register — register a student's face descriptor
// 100% Vector-Only (Zero raw photo storage)
// ------------------------------------------------------------------
faceRoutes.post(
  "/register",
  authenticateToken,
  faceWriteLimiter,
  faceController.registerFace
);

// ------------------------------------------------------------------
// GET /api/faces/section/:section — retrieve all face descriptors for a section
// ------------------------------------------------------------------
faceRoutes.get("/section/:section", authenticateToken, faceReadLimiter, faceController.getSectionFaceDescriptors);

// ------------------------------------------------------------------
// GET /api/faces/:studentId — retrieve a student's face descriptor
// ------------------------------------------------------------------
faceRoutes.get("/:studentId", authenticateToken, faceReadLimiter, faceController.getFaceDescriptor);

// ------------------------------------------------------------------
// POST /api/attendance/mark-face-detection — mark attendance from
// a batch of face-verified student IDs.
// Mounted at /api/attendance so the path is /api/attendance/mark-face-detection
// ------------------------------------------------------------------
faceRoutes.post("/mark-face-detection", authenticateToken, faceWriteLimiter, faceController.markFaceDetection);

module.exports = faceRoutes;
module.exports.faceLimiter = faceWriteLimiter;
