const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const [stats, upcoming, recent, clientStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status <> 'completed')::int AS open_tasks,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_tasks,
          COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE)::int AS overdue_tasks,
          COUNT(*) FILTER (WHERE status <> 'completed' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int AS due_soon
        FROM tasks
      `),
      pool.query(`
        SELECT t.id,t.title,t.due_date,t.priority,t.status,c.name AS client_name
        FROM tasks t LEFT JOIN clients c ON c.id=t.client_id
        WHERE t.status <> 'completed'
        ORDER BY t.due_date ASC NULLS LAST LIMIT 7
      `),
      pool.query(`
        SELECT t.id,t.title,t.status,t.due_date,t.updated_at,c.name AS client_name
        FROM tasks t LEFT JOIN clients c ON c.id=t.client_id
        ORDER BY t.updated_at DESC LIMIT 6
      `),
      pool.query('SELECT COUNT(*)::int AS total_clients, COUNT(*) FILTER (WHERE status=\'active\')::int AS active_clients FROM clients')
    ]);
    res.json({ ...stats.rows[0], ...clientStats.rows[0], upcoming: upcoming.rows, recent: recent.rows });
  } catch (error) { next(error); }
});

module.exports = router;
