const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function createToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  });
}

router.get('/status', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT EXISTS(SELECT 1 FROM users) AS configured');
    res.json({ configured: rows[0].configured });
  } catch (error) { next(error); }
});

router.post('/setup', async (req, res, next) => {
  try {
    const { name, email, password, setupToken } = req.body;
    if (!process.env.SETUP_TOKEN || setupToken !== process.env.SETUP_TOKEN) {
      return res.status(403).json({ error: 'Código de configuración inválido.' });
    }
    if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: 'Completá nombre, email y una contraseña de al menos 8 caracteres.' });
    }
    const exists = await pool.query('SELECT 1 FROM users LIMIT 1');
    if (exists.rowCount) return res.status(409).json({ error: 'El administrador ya fue configurado.' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email',
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    const user = rows[0];
    res.status(201).json({ token: createToken(user), user });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Ingresá email y contraseña.' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
    }
    res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
module.exports = router;
