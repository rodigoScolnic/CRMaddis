require('dotenv').config();
const { initDb, pool } = require('../src/db');
initDb().then(async () => {
  console.log('Base de datos CRMaddis inicializada.');
  await pool.end();
}).catch(async error => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
