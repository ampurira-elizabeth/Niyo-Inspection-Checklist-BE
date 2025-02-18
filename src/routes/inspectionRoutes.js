const express = require('express');
const router = express.Router();
const db = require('../config/db.config');

// Get all categories with their checklist items
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.query('SELECT * FROM categories');
        const [items] = await db.query(`
            SELECT ci.*, c.name as category_name 
            FROM checklist_items ci 
            JOIN categories c ON ci.category_id = c.id
        `);

        // Group items by category
        const categoriesWithItems = categories.map(category => ({
            ...category,
            items: items.filter(item => item.category_id === category.id)
        }));

        res.json(categoriesWithItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit inspection results
router.post('/submit', async (req, res) => {
    try {
        // Start transaction
        await db.query('START TRANSACTION');

        // Create new inspection
        const [inspection] = await db.query(
            'INSERT INTO inspections (date) VALUES (NOW())'
        );
        const inspectionId = inspection.insertId;

        const items = req.body.items;
        let totalScore = 0;
        let totalPossibleScore = 0;

        // Insert each result
        for (const item of items) {
            let score = 0;
            switch(item.status) {
                case 'yes': score = 2; break;
                case 'neutral': score = 1; break;
                case 'no': score = 0; break;
            }

            await db.query(
                `INSERT INTO inspection_results 
                (inspection_id, checklist_item_id, status, score, comments) 
                VALUES (?, ?, ?, ?, ?)`,
                [inspectionId, item.checklistItemId, item.status, score, item.comments]
            );

            totalScore += score;
            totalPossibleScore ++; // Maximum possible score per item
        }

        // Calculate percentage
        const percentage = (totalScore / totalPossibleScore) * 100;

        // Update inspection with final scores
        await db.query(
            'UPDATE inspections SET total_score = ?, percentage = ? WHERE id = ?',
            [totalScore, percentage, inspectionId]
        );

        // Commit transaction
        await db.query('COMMIT');

        res.json({
            success: true,
            inspectionId,
            totalScore,
            percentage
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;