const express = require('express');
const { pool } = require('../db');
const router = express.Router();
const fields = ['name','company','email','phone','status','notes'];

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(t.id)::int AS task_count,
        COUNT(t.id) FILTER (WHERE t.status <> 'completed')::int AS open_tasks
      FROM clients c LEFT JOIN tasks t ON t.client_id = c.id
      WHERE ($1 = '' OR c.name ILIKE $2 OR COALESCE(c.company,'') ILIKE $2 OR COALESCE(c.email,'') ILIKE $2)
      GROUP BY c.id ORDER BY c.updated_at DESC, c.name ASC
    `, [q, `%${q}%`]);
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, company = null, email = null, phone = null, status = 'active', notes = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    if (!['active','inactive','prospect'].includes(status)) return res.status(400).json({ error: 'Estado de cliente inválido.' });
    const { rows } = await pool.query(
      'INSERT INTO clients (name,company,email,phone,status,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name.trim(),company,email,phone,status,notes]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, company = null, email = null, phone = null, status = 'active', notes = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    if (!['active','inactive','prospect'].includes(status)) return res.status(400).json({ error: 'Estado de cliente inválido.' });
    const { rows } = await pool.query(
      'UPDATE clients SET name=$1,company=$2,email=$3,phone=$4,status=$5,notes=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [name.trim(),company,email,phone,status,notes,req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json({ message: 'Cliente eliminado.' });
  } catch (error) { next(error); }
});

module.exports = router;
