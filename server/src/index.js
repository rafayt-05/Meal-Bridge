require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const ngoRoutes = require('./routes/ngo');
const offersRoutes = require('./routes/offers');
const { seedIfEmpty } = require('./seed');

const app = express();

app.use(cors({ origin: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'] }));
app.options('*', cors({ origin: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'] }));
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(bodyParser.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/offers', offersRoutes);

// Serve the static frontend so you can run everything with a single command.
const FRONTEND_DIR = path.join(__dirname, '..', '..');
app.use(express.static(FRONTEND_DIR, { index: 'index.html' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

const PORT = process.env.PORT || 4000;

async function start() {
  // Make sure the sqlite folder exists.
  const dbDir = path.join(__dirname, '..', 'db');
  if(!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  await sequelize.sync();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`\n  Food Donation Connector running`);
    console.log(`  → API:      http://localhost:${PORT}/api`);
    console.log(`  → Frontend: http://localhost:${PORT}/\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});
