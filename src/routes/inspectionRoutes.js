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


//   add tools and equipment under equipmnts

router.post("/tools/equipments", async (req, res) => {
    try {
        const { description } = req.body;

        if (!Array.isArray(description) || description.length === 0) {
            return res.status(400).json({ message: "At least one description is required" });
        }

        // Fetch the category ID for "Tools and Equipment"
        const [category] = await db.query(
            "SELECT id FROM categories WHERE name = 'Tools & Equipment' LIMIT 1"
        );

        if (!category.length) {
            return res.status(400).json({ message: "Category 'Tools & Equipment' not found" });
        }

        const category_id = category[0].id;

        // Prepare values for bulk insert
        const values = description.map(desc => [category_id, desc]);

        // Insert multiple rows
        const result = await db.query(
            "INSERT INTO checklist_items (category_id, description) VALUES ?",
            [values]
        );

        res.status(201).json({ message: "Checklist items added successfully", affectedRows: result.affectedRows });
    } catch (error) {
        console.error("Error adding checklist item:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});



// Submit inspection results
// router.post('/submit', async (req, res) => {
//     try {
//         // Start transaction
//         await db.query('START TRANSACTION');

//         // Create new inspection
//         const [inspection] = await db.query(
//             'INSERT INTO inspections (date) VALUES (NOW())'
//         );
//         const inspectionId = inspection.insertId;

//         const items = req.body.items;
//         let totalScore = 0;
//         let totalPossibleScore = 0;

//         // Insert each result
//         for (const item of items) {
//             let score = 0;
//             switch(item.status) {
//                 case 'yes': score = 2; break;
//                 case 'neutral': score = 1; break;
//                 case 'no': score = 0; break;
//             }

//             await db.query(
//                 `INSERT INTO inspection_results 
//                 (inspection_id, checklist_item_id, status, score, comments) 
//                 VALUES (?, ?, ?, ?, ?)`,
//                 [inspectionId, item.checklistItemId, item.status, score, item.comments]
//             );

//             totalScore += score;
//             totalPossibleScore ++; // Maximum possible score per item
//         }

//         // Calculate percentage
//         const percentage = (totalScore / totalPossibleScore) * 100;

//         // Update inspection with final scores
//         await db.query(
//             'UPDATE inspections SET total_score = ?, percentage = ? WHERE id = ?',
//             [totalScore, percentage, inspectionId]
//         );

//         // Commit transaction
//         await db.query('COMMIT');

//         res.json({
//             success: true,
//             inspectionId,
//             totalScore,
//             percentage
//         });
//     } catch (error) {
//         await db.query('ROLLBACK');
//         console.error(error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

router.post('/submit', async (req, res) => {
    try {
        const { garage_name, contact_person_tel, physical_location, items } = req.body;

        // Start transaction
        await db.query('START TRANSACTION');

        // Create new inspection with additional fields
        const [inspection] = await db.query(
            'INSERT INTO inspections (date, garage_name, contact_person_tel, physical_location) VALUES (NOW(), ?, ?, ?)',
            [garage_name, contact_person_tel, physical_location]
        );
        const inspectionId = inspection.insertId;

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

            if (item.checklistItemId !== undefined && item.status) {
                await db.query(
                    `INSERT INTO inspection_results 
                    (inspection_id, checklist_item_id, status, score, comments) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [inspectionId, item.checklistItemId, item.status, score, item.comments]
                );
            } else {
                console.error("Invalid item data:", item); 
            }
        

            totalScore += score;
            totalPossibleScore++; 
        }

        // Calculate percentage
        const percentage = (totalScore / totalPossibleScore) * 100;

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

// Get inspections with results


router.get('/inspections', async (req, res) => {
    try {
        const [inspections] = await db.query(`
            SELECT id, date, garage_name, contact_person_tel, physical_location, total_score, percentage
            FROM inspections
        `);
        
        // Convert any Buffer objects to strings
        const processedInspections = inspections.map(row => {
            const processedRow = {};
            for (const [key, value] of Object.entries(row)) {
                processedRow[key] = value instanceof Buffer ? value.toString() : value;
            }
            return processedRow;
        });
        
        res.json(processedInspections);
    } catch (error) {
        console.error('Error fetching inspections:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/inspections/pdf', async (req, res) => {
    try {
        // Fetch all inspections
        const inspections = await db.query(`
            SELECT id, date, garage_name, contact_person_tel, physical_location, total_score, percentage
            FROM inspections
        `);

        // Create a PDF document
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, 'inspections.pdf');

        // Pipe the PDF into a writable stream
        doc.pipe(fs.createWriteStream(filePath));

        // Add a header to the PDF
        doc.fontSize(20).text('Inspections Report', { align: 'center' });
        doc.moveDown();

        // Add inspection data to the PDF
        inspections.forEach(inspection => {
            doc.fontSize(12).text(`ID: ${inspection.id}`);
            doc.text(`Date: ${inspection.date}`);
            doc.text(`Garage Name: ${inspection.garage_name}`);
            doc.text(`Contact Person: ${inspection.contact_person_tel}`);
            doc.text(`Physical Location: ${inspection.physical_location}`);
            doc.text(`Total Score: ${inspection.total_score}`);
            doc.text(`Percentage: ${inspection.percentage.toFixed(2)}%`);
            doc.moveDown();
            doc.moveDown(); // Add extra space between inspections
        });

        // Finalize the PDF and end the stream
        doc.end();

        // Send the generated PDF as a response
        res.download(filePath, 'inspections.pdf', (err) => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Error downloading the file.');
            }
            // Optionally, delete the file after sending it
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;