// db.js — MySQL (phpMyAdmin)

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',
  password: '',          // no XAMPP a password é normalmente vazia
  database: 'eduscheduler',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;