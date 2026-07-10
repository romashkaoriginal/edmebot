require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
