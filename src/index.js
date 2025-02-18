const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createTables } = require('./models/schema');
// import inspectionRoutes from './routes/inspectionRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', require('./routes/inspectionRoutes'));

// Initialize database
createTables().catch(console.error);

// Basic test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on url  http://localhost:${PORT}`);
   
});