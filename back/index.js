require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./src/db');
const bot = require('./src/bot');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = new Set(
  [
    process.env.APP_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(','),
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ].filter(Boolean).map((value) => value.trim().replace(/\/$/, ''))
);

app.use((req, res, next) => {
  req.requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('cors_origin_denied'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-demo-student-id', 'x-request-id'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '64kb', strict: true }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/telegram/webhook',
}));

// Registers the webhook route (POST /api/telegram/webhook) if configured.
bot.init(app);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Module routes (no AI — rule-based logic only)
app.use('/api/profile', require('./src/routes/profile'));
app.use('/api/diagnostic', require('./src/routes/diagnostic'));
app.use('/api/practice', require('./src/routes/practice'));
app.use('/api/pet', require('./src/routes/pet'));
app.use('/api/homework', require('./src/routes/homework'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/admin', require('./src/routes/admin-import'));

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Central error handler (async route errors bubble here via next(e)).
app.use((err, req, res, _next) => {
  const isCorsError = err?.message === 'cors_origin_denied';
  const isUploadError = err?.name === 'MulterError';
  const isBodyTooLarge = err?.type === 'entity.too.large';
  const isInvalidDatabaseInput = ['22P02', '22003', '23514'].includes(err?.code);
  console.error({
    requestId: req.requestId,
    error: err?.name || 'Error',
    message: isCorsError ? 'CORS origin denied' : String(err?.message || 'internal_error').slice(0, 240),
  });
  const status = isCorsError ? 403 : isUploadError || isBodyTooLarge ? 413 : isInvalidDatabaseInput ? 400 : 500;
  const error = isCorsError
    ? 'origin_not_allowed'
    : isUploadError
      ? 'upload_rejected'
      : isBodyTooLarge
        ? 'request_too_large'
        : isInvalidDatabaseInput
          ? 'invalid_request'
        : 'internal_error';
  res.status(status).json({
    error,
    requestId: req.requestId,
  });
});

// Migrate + seed the database before accepting traffic.
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // RENDER_EXTERNAL_URL is set automatically by Render; falls back to
      // BACKEND_URL for other hosts.
      const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
      if (backendUrl) bot.setWebhook(backendUrl).catch((e) => console.error('setWebhook failed:', e.message));
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
