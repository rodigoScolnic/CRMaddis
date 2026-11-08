const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, q, clientId } = req.query;
    const { rows } = await pool.query(`
      SELECT t.*, c.name AS client_name, c.company AS client_company
      FROM tasks t LEFT JOIN clients c ON c.id=t.client_id
      WHERE ($1 = '' OR t.status=$1)
        AND ($2 = '' OR t.title ILIKE $3 OR COALESCE(c.name,'') ILIKE $3)
        AND ($4 = '' OR t.client_id=$4)
      ORDER BY CASE WHEN t.status='completed' THEN 1 ELSE 0 END,
        t.due_date ASC NULLS LAST, t.created_at DESC
    `, [status || '', q || '', `%${q || ''}%`, clientId || '']);
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description = null, client_id = null, due_date = null, priority = 'medium', status = 'pending' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'El título de la tarea es obligatorio.' });
    if (!['low','medium','high'].includes(priority) || !['pending','in_progress','completed'].includes(status)) {
      return res.status(400).json({ error: 'Prioridad o estado inválido.' });
    }
    const { rows } = await pool.query(
      'INSERT INTO tasks (title,description,client_id,due_date,priority,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [title.trim(),description,client_id || null,due_date || null,priority,status]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, description = null, client_id = null, due_date = null, priority = 'medium', status = 'pending' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'El título de la tarea es obligatorio.' });
    if (!['low','medium','high'].includes(priority) || !['pending','in_progress','completed'].includes(status)) {
      return res.status(400).json({ error: 'Prioridad o estado inválido.' });
    }
    const { rows } = await pool.query(
      'UPDATE tasks SET title=$1,description=$2,client_id=$3,due_date=$4,priority=$5,status=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [title.trim(),description,client_id || null,due_date || null,priority,status,req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending','in_progress','completed'].includes(status)) return res.status(400).json({ error: 'Estado inválido.' });
    const { rows } = await pool.query('UPDATE tasks SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [status,req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tarea no encontrada.' });
    res.json({ message: 'Tarea eliminada.' });
  } catch (error) { next(error); }
});

module.exports = router;
