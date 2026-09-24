const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const autoCompleteExams = require('./utils/autoCompleteExams');

const { tenantResolver, optionalTenant } = require('./middleware/tenantResolver');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const { apiLogger } = require('./middleware/apiLogger');

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB pool error', { error: err.message });
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance_dev', {
    maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 50,
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 5,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000
  }).then(async () => {
    logger.info('MongoDB connected');
    mongoose.connection.db.collection('users').dropIndex('email_1').catch(() => {});
    mongoose.connection.db.collection('subjects').dropIndex('code_1').catch(() => {});
    mongoose.connection.db.collection('subjects').dropIndex('subjectName_1').catch(() => {});
    mongoose.connection.db.collection('subjects').dropIndex('tenantId_1_department_1').catch(() => {});
    mongoose.connection.db.collection('attendances').dropIndex('tenantId_1_classSessionId_1').catch(() => {});

    try {
      const Tenant = require('./models/Tenant');
      const User = require('./models/User');
      const { applyPlanUpgradeToTenant } = require('./utils/planDefaults');
      
      // Sync effective plan limits, modules, settings and update stats for all tenants
      const tenants = await Tenant.find({});
      for (const t of tenants) {
        try {
          if (t.subscription?.plan) {
            applyPlanUpgradeToTenant(t, t.subscription.plan);
          }
          await t.save();
          await t.updateStats();
        } catch (innerErr) {
          logger.warn(`Failed syncing tenant ${t.slug || t._id}: ${innerErr.message}`);
        }
      }
      logger.info(`Synced effective plan limits, modules, and stats for ${tenants.length} tenant(s)`);
      autoCompleteExams().catch(err => logger.error('Error auto-completing exams on connect', { error: err.message }));
    } catch (e) {
      logger.error('Error syncing tenant limits & stats', { error: e.message });
    }
  }).catch(err => {
    logger.error('MongoDB connection error', { error: err.message });
  });
}

const requestIdMiddleware = require('./middleware/requestId');

const app = express();
const path = require('path');

// Request ID middleware (attaches X-Request-ID to req and res)
app.use(requestIdMiddleware);

// Security headers
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "*", "https://cdn.jsdelivr.net"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false, // Disable CSP in dev for easier debugging
  hsts: isProd ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
  noSniff: true, // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true, // X-XSS-Protection (legacy but harmless)
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const cookieParser = require('cookie-parser');
const csrfProtection = require('./middleware/csrf');

// Body and Cookie parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://attend-ease-f.vercel.app'
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((u) => {
    const trimmed = u.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, origin);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'cache-control',
    'Last-Event-ID',
    'last-event-id',
    'Accept',
    'accept',
    'Pragma',
    'pragma',
    'X-Tenant-Id',
    'X-Request-ID',
    'x-offline-sync',
    'X-Offline-Sync',
    'x-device-fingerprint',
    'X-Device-Fingerprint',
    'X-XSRF-TOKEN',
    'x-xsrf-token',
  ],
  exposedHeaders: ['X-Request-ID', 'Last-Event-ID'],
  credentials: true
}));

// Double-submit cookie CSRF protection
app.use(csrfProtection);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ==================== HEALTH & ROOT ENDPOINTS ====================

app.get("/health", (req, res) => {
  const cache = require('./middleware/cache');
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cache: cache.getStats ? cache.getStats() : undefined,
  });
});

app.get("/", (req, res) => {
  res.json({ 
    message: "AttendEase API",
    version: "2.0.0",
    status: "running",
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== PUBLIC ROUTES (No tenant required) ====================

// Import public routes
const landingRoutes = require("./routes/landingRoutes");
const authRoutes = require("./routes/authRoutes");  


app.use("/api/landing", landingRoutes);
app.use("/api/auth", authRoutes);  
const demoRoutes = require("./routes/demoRoutes");
app.use("/api/demo", demoRoutes);

// Public tenant registration endpoint
const { registerTenant } = require("./controllers/tenantController");
app.post("/api/tenant/register", registerTenant);

const { autoFilterUserResponses } = require("./middleware/responseFilter");

// ==================== TENANT RESOLVER ====================
// Apply tenant resolver to ALL PROTECTED routes from this point
app.use(tenantResolver);
app.use(apiLogger);
app.use(autoFilterUserResponses);
const demoGuard = require("./middleware/demoGuard");
app.use(demoGuard);

// ==================== PROTECTED ROUTES (Tenant required) ====================

// Import protected routes
const userRoute = require("./routes/userRoute");
const adminRoute = require("./routes/adminRoute");
const ticketRoute = require("./routes/ticketRoute");
const alertRoute = require("./routes/alertRoute");
const attendanceRoute = require("./routes/attendanceRoute");
const faceRoutes = require("./routes/faceRoutes");
const allUser = require("./routes/user");
const subjectRoute = require("./routes/subjectRoute");
const billingRoutes = require('./routes/billingRoutes');
const tenantRoutes  = require('./routes/tenantRoutes');
const supportRoutes = require('./routes/supportRoutes');
const roleRoutes   = require('./routes/roleRoutes');
const parentRoutes = require('./routes/parentRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const examRoutes = require('./routes/examRoutes');
const examSeatingRoutes = require('./routes/examSeatingRoutes');
const feeRoutes = require('./routes/feeRoutes');
const planRoutes = require('./routes/planRoutes');
const studentRoutes = require('./routes/studentRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const academicRoutes = require('./routes/academicRoutes');
const auditRoutes = require('./routes/auditRoutes');
const calendarRoute = require('./routes/calendarRoute');
const leaveRoutes = require('./routes/leaveRoutes');
const eventStreamRoute = require('./routes/eventStreamRoute');

// Protected routes (require tenant resolution)
app.use("/api/users", userRoute);
app.use("/api/admin", adminRoute);
app.use("/api/tickets", ticketRoute);
app.use("/api/leaves", leaveRoutes);
app.use("/api/events", eventStreamRoute);
app.use("/api/alerts", alertRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/attendance", faceRoutes);  // mounts mark-face-detection at /api/attendance/mark-face-detection
app.use("/api/faces", faceRoutes);
app.use("/api/subjects", subjectRoute);
app.use('/api/billing',      billingRoutes);
app.use('/api/tenant',       tenantRoutes);
app.use('/api/support',      supportRoutes);    // Support tickets (bypass-listed in auth)
app.use('/api/roles',        roleRoutes);       // Custom role management
app.use('/api/parent',       parentRoutes);     // Parent portal (read-only)
app.use('/api/timetable',    timetableRoutes);  // Timetable management
app.use('/api/calendar',     calendarRoute);    // Academic calendar & events
app.use('/api/exams/seating', examSeatingRoutes); // Phase 8: Exam seating allocation & cryptographic hall tickets
app.use('/api/exams',        examRoutes);       // Exam portal
app.use('/api/fees',         feeRoutes);        // Fee management
app.use('/api/admin/plans',  planRoutes);       // Plan management (super admin)
app.use('/api/students',     studentRoutes);    // Student management (permission-gated)
app.use('/api/reports',      reportsRoutes);    // Reports (permission-gated)
app.use('/api/academic',     academicRoutes);   // Courses, branches, semester structure & promotion
app.use('/api/admin/audit-logs', auditRoutes);  // Compliance audit logs

// special case
app.use("/api/users/public", allUser);

// ==================== ERROR HANDLING ====================

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.originalUrl });
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED'
    });
  }
  
  if (err.name === 'ValidationError') {
    const errorMessages = Object.values(err.errors || {}).map(e => e.message || `${e.path} is required`);
    const customMessage = errorMessages.length === 1
      ? errorMessages[0]
      : `Please fill in the required field(s): ${errorMessages.join("; ")}`;

    return res.status(400).json({
      success: false,
      message: customMessage,
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'record';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}. This record already exists.`,
      code: 'DUPLICATE_ENTRY'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
    code: err.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler for all other routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND'
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 8011;
if (process.env.NODE_ENV !== 'test') {
  const sseManager = require('./utils/sseManager');
  const eventBus = require('./events/eventBus');

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

    // Run auto-complete on startup, then every hour
    autoCompleteExams();
    setInterval(autoCompleteExams, 60 * 60 * 1000);

    // Periodically reap stale SSE connections every 30 seconds
    const sseReaperInterval = setInterval(() => {
      sseManager.reapStaleClients();
    }, 30 * 1000);

    server._sseReaperInterval = sseReaperInterval;
  });

  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        if (server._sseReaperInterval) {
          clearInterval(server._sseReaperInterval);
        }
        sseManager.closeAll('server_shutdown');
        await eventBus.close();
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');
        const cache = require('./middleware/cache');
        if (cache.close) {
          await cache.close();
          logger.info('Redis connection closed.');
        }
      } catch (err) {
        logger.error('Error during shutdown cleanup', { error: err.message });
      }
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forcing shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };


  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;