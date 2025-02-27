const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createTables } = require('./models/schema');
const app = express();
const authRoutes = require('./routes/authRoutes');
const User = require('./models/user');
const { testConnection } = require('./config/db.config');


app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.use('/api', require('./routes/inspectionRoutes'));
app.use('/api/auth', authRoutes);

// Initialize database
createTables().catch(console.error);

// Basic test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
      // Test database connection
      const dbConnected = await testConnection();
      if (!dbConnected) {
        console.error('Failed to connect to database. Server not started.');
        process.exit(1);
      }
      
      // Initialize tables
      await User.initUsersTable();
      
      // Start server
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  };
  
  startServer();
// app.listen(PORT, () => {
//     console.log(`Server running on url  http://localhost:${PORT}`);
   
// });