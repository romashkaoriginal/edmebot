require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
