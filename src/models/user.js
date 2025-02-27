const { promisePool } = require('../config/db.config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize users table
const initUsersTable = async () => {
  try {
    const [rows] = await promisePool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table initialized');
    return true;
  } catch (error) {
    console.error('Error initializing users table:', error);
    return false;
  }
};

// Find user by email
const findByEmail = async (email) => {
  try {
    const [rows] = await promisePool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

// Find user by ID
const findById = async (id) => {
  try {
    const [rows] = await promisePool.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', [id]);
    return rows[0];
  } catch (error) {
    console.error('Error finding user by ID:', error);
    throw error;
  }
};

// Create a new user
const create = async (userData) => {
  try {
    const { name, email, password } = userData;
        const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
        const [result] = await promisePool.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
        const [rows] = await promisePool.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    
    return rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Compare password
const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your_jwt_secret_key_should_be_long_and_secure',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = {
  initUsersTable,
  findByEmail,
  findById,
  create,
  comparePassword,
  generateToken
};
