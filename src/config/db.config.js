const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'inspection_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to use promises
const promisePool = pool.promise();

const testConnection = async () => {
    try {
      const connection = await promisePool.getConnection();
      console.log('Connected to MySQL database');
      connection.release();
      return true;
    } catch (error) {
      console.error('Error connecting to MySQL:', error);
      return false;
    }
  };

module.exports = {
    promisePool,
    testConnection,
    query: async (sql, params) => {
        try {
            const [rows, fields] = await promisePool.execute(sql, params || []);
            return rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
};
// module.exports = {promisePool,testConnection};