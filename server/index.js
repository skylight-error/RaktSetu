const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { initSchema } = require('./db/database');
const { seedDatabase } = require('./db/seedData');

const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const donorRoutes = require('./routes/donorRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const requestRoutes = require('./routes/requestRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database & seed demo data
initSchema();
seedDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/ai', aiRoutes);

// Fallback to index.html for SPA routing (safe for all path-to-regexp versions)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  🩸 RAKTSETU — AI BLOOD INVENTORY & DONOR PLATFORM  `);
  console.log(`  Every Drop Matters. Every Connection Saves Lives.  `);
  console.log(`=======================================================`);
  console.log(`  ✓ Server running on: http://localhost:${PORT}`);
  console.log(`  ✓ SQLite Database initialized & pre-seeded`);
  console.log(`  ✓ AI Demand Forecasting Model ready`);
  console.log(`  ✓ Intelligent Donor Matching Engine active`);
  console.log(`=======================================================`);
});

// Keep process active
setInterval(() => {}, 1000 * 60 * 60);

module.exports = app;
