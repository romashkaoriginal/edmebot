require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./src/db');
const bot = require('./src/bot');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Registers the webhook route (POST /api/telegram/webhook) if configured.
bot.init(app);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Public: student list for the student-picker in RoleGate (no tg_id exposed).
// Only "active" (fully provisioned) students are offered here — a
// self-serve "pending" student has nothing meaningful to view yet.
app.get('/api/students/list', async (_req, res, next) => {
  try {
    const db = require('./src/db');
    const { rows } = await db.query(
      "SELECT id, name, grade, subject FROM students WHERE status = 'active' ORDER BY id ASC"
    );
    res.json({ students: rows });
  } catch (e) { next(e); }
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
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
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
