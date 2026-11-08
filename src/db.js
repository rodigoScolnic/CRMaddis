const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Configurá la conexión a PostgreSQL en el entorno.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (error) => console.error('Error inesperado en PostgreSQL:', error));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS clients (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(140) NOT NULL,
      company VARCHAR(160),
      email VARCHAR(180),
      phone VARCHAR(60),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      description TEXT,
      client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
      due_date DATE,
      priority VARCHAR(12) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
  `);
}

module.exports = { pool, initDb };
