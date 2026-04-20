const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'wb_erp',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '-03:00',
});

// Força charset UTF-8 em cada conexão nova
pool.on('connection', (conn) => {
  conn.query("SET NAMES 'utf8mb4'");
  conn.query("SET CHARACTER SET utf8mb4");
  conn.query("SET character_set_connection=utf8mb4");
});

// Testa conexão ao iniciar
pool.getConnection()
  .then(async conn => {
    await conn.query("SET NAMES 'utf8mb4'");
    console.log('✅ MySQL conectado com sucesso (UTF-8)');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Erro MySQL:', err.message);
  });

module.exports = pool;
