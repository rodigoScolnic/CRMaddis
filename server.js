require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDb, pool } = require('./src/db');
const { requireAuth } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', requireAuth);
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/tasks', require('./src/routes/tasks'));
app.use('/api/dashboard', require('./src/routes/dashboard'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  if (error.code === '23503') return res.status(400).json({ error: 'El cliente seleccionado no existe.' });
  if (error.code === '22007' || error.code === '22008') return res.status(400).json({ error: 'La fecha ingresada no es válida.' });
  res.status(500).json({ error: 'Ocurrió un error interno. Intentá nuevamente.' });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`CRMaddis escuchando en el puerto ${PORT}`));
}).catch(error => {
  console.error('No se pudo inicializar PostgreSQL:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
