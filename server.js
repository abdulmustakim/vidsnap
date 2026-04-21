/**
 * VidSnap — Backend API Server
 * Stack: Node.js + Express + yt-dlp (via child_process)
 * ----------------------------------------------------------
 * VOCABULARY:
 *   yt-dlp   — a powerful command-line tool that downloads
 *              videos from YouTube and 1000+ other sites.
 *              We call it from Node using "child_process".
 *   Middleware — code that runs between the request arriving
 *              and the response being sent. Like a security
 *              guard checking everyone who enters.
 *   Rate limiting — preventing abuse by capping how many
 *              requests one user can make per minute.
 *   CORS     — Cross-Origin Resource Sharing. Allows the
 *              frontend (on a different domain) to talk to
 *              this backend safely.
 */

'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const morgan      = require('morgan');
const path        = require('path');

const infoRouter     = require('./routes/info');
const downloadRouter = require('./routes/download');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

// =============================================
// SECURITY MIDDLEWARE
// Helmet sets safe HTTP headers automatically.
// =============================================
app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for video streams
  contentSecurityPolicy: false,     // frontend handles its own CSP
}));

// =============================================
// CORS — allow your frontend domain here
// =============================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5500')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// =============================================
// RATE LIMITING
// 30 requests per 15 minutes per IP address.
// This prevents bots from hammering the server.
// =============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait 15 minutes and try again.',
  },
});

// Stricter limit for download endpoint
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    message: 'Download limit reached. Please wait 1 minute.',
  },
});

// =============================================
// BODY PARSING & LOGGING
// =============================================
app.use(express.json({ limit: '10kb' })); // cap body size
app.use(morgan('dev'));                    // log requests in development

// =============================================
// ROUTES
// =============================================
app.use('/api/info',     apiLimiter,      infoRouter);
app.use('/api/download', downloadLimiter, downloadRouter);

// Health check — used by Render/Railway/Fly.io to confirm server is up
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()) + 's',
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

// =============================================
// GLOBAL ERROR HANDLER
// Must be defined AFTER all routes.
// =============================================
app.use(errorHandler);

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`\n🚀 VidSnap server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown on Ctrl+C
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully...');
  process.exit(0);
});
