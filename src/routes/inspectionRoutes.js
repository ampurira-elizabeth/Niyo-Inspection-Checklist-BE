const express = require("express");
const router = express.Router();
const db = require("../config/db.config");
const PDFDocument = require("pdfkit");

// Get all categories with their checklist items
router.get("/categories", async (req, res) => {
  try {
    const categories = await db.query("SELECT * FROM categories");
    const items = await db.query(`
            SELECT ci.*, c.name as category_name 
            FROM checklist_items ci 
            JOIN categories c ON ci.category_id = c.id
        `);

    // Group items by category
    const categoriesWithItems = categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.category_id === category.id),
    }));

    res.json(categoriesWithItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//   add tools and equipment under equipmnts

router.post("/tools/equipments", async (req, res) => {
  try {
    const { description } = req.body;

    if (!Array.isArray(description) || description.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one description is required" });
    }

    // Fetch the category ID for "Tools and Equipment"
    const [category] = await db.query(
      "SELECT id FROM categories WHERE name = 'Tools & Equipment' LIMIT 1"
    );

    if (!category.length) {
      return res
        .status(400)
        .json({ message: "Category 'Tools & Equipment' not found" });
    }

    const category_id = category[0].id;

    // Prepare values for bulk insert
    const values = description.map((desc) => [category_id, desc]);

    // Insert multiple rows
    const result = await db.query(
      "INSERT INTO checklist_items (category_id, description) VALUES ?",
      [values]
    );

    res.status(201).json({
      message: "Checklist items added successfully",
      affectedRows: result.affectedRows,
    });
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

router.post("/submit", async (req, res) => {
  try {
    const { garage_name, contact_person_tel, physical_location, items } =
      req.body;

    // Start transaction
    // await db.query("START TRANSACTION");
    const connection = await db.promisePool.getConnection(); 
    await connection.beginTransaction();
    // Create new inspection with additional fields
    const [inspection] = await connection.query(
      "INSERT INTO inspections (date, garage_name, contact_person_tel, physical_location) VALUES (NOW(), ?, ?, ?)",
      [garage_name, contact_person_tel, physical_location]
    );
    const inspectionId = inspection.insertId;

    let totalScore = 0;
    let totalPossibleScore = 0;

    // Insert each result
    for (const item of items) {
      let score = 0;
      switch (item.status) {
        case "yes":
          score = 2;
          break;
        case "neutral":
          score = 1;
          break;
        case "no":
          score = 0;
          break;
      }

      if (item.checklistItemId !== undefined && item.status) {
        await connection.query(
          `INSERT INTO inspection_results 
                    (inspection_id, checklist_item_id, status, score, comments) 
                    VALUES (?, ?, ?, ?, ?)`,
          [
            inspectionId,
            item.checklistItemId,
            item.status,
            score,
            item.comments,
          ]
        );
      } else {
        console.error("Invalid item data:", item);
      }

      totalScore += score;
      totalPossibleScore++;
    }

    // Calculate percentage
    const percentage = (totalScore / totalPossibleScore) * 100;

    await connection.query(
      "UPDATE inspections SET total_score = ?, percentage = ? WHERE id = ?",
      [totalScore, percentage, inspectionId]
    );

    // Commit transaction
    // await db.query("COMMIT");
    await connection.commit();
    connection.release();
    res.json({
      success: true,
      inspectionId,
      totalScore,
      percentage,
    });
  } catch (error) {
    // await db.query("ROLLBACK");
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get inspections with results

router.get("/inspections", async (req, res) => {
  try {
    const inspections = await db.query(`
            SELECT id, date, garage_name, contact_person_tel, physical_location, total_score, percentage
            FROM inspections
        `);

    // Convert any Buffer objects to strings
    const processedInspections = inspections.map((row) => {
      const processedRow = {};
      for (const [key, value] of Object.entries(row)) {
        processedRow[key] = value instanceof Buffer ? value.toString() : value;
      }
      return processedRow;
    });

    res.json(processedInspections);
  } catch (error) {
    console.error("Error fetching inspections:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/inspections/pdf", async (req, res) => {
  try {
    // Fetch all inspections
    const queryResult = await db.query(`
          SELECT id, date, garage_name, contact_person_tel, physical_location, total_score, percentage
          FROM inspections
      `);

    let inspections = queryResult;

    if (queryResult[0] && Array.isArray(queryResult[0])) {
      inspections = queryResult[0];
    }

    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      size: "A4",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="inspections.pdf"'
    );

    doc.pipe(res);

    const addHeader = () => {
    
      try {
        doc.image("public/logo.png", 40, 30, { width: 80 });
      } catch (error) {
        console.error("Error loading logo:", error);
    
        doc.rect(40, 30, 80, 40).stroke();
        doc.text("LOGO", 60, 45);
      }
      doc
        .font("Helvetica")
        .fontSize(10)
        .text("Postal Box 160735 Kampala,UG", 150, 30, { align: "right" })
        .text("+256 756 234 800", 150, 45, { align: "right" })
        .text("secretariat@nagoa.org", 150, 60, { align: "right" })
        .text("www.nagoa.org", 150, 75, { align: "right" });

      doc
        .moveTo(40, 95)
        .lineTo(doc.page.width - 40, 95)
        .stroke();
    };
    addHeader();
    doc.on("pageAdded", () => {
      addHeader();
    });

    const pageWidth = doc.page.width - 80;

    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Inspections Report", { align: "center" });

    doc
      .fontSize(16)
      .font("Helvetica") 
      .text("A comprehensive overview of recent inspections Report.", {
        align: "center",
      });

    doc.moveDown(3);

    const tableTop = 220;
    const cellPadding = 5;
    const rowHeight = 40;

    const idWidth = pageWidth * 0.05;
    const dateWidth = pageWidth * 0.12;
    const nameWidth = pageWidth * 0.18;
    const contactWidth = pageWidth * 0.18;
    const locationWidth = pageWidth * 0.18;
    const scoreWidth = pageWidth * 0.12;
    const percentageWidth = pageWidth * 0.17;

    const tableWidth =
      idWidth +
      dateWidth +
      nameWidth +
      contactWidth +
      locationWidth +
      scoreWidth +
      percentageWidth;

    doc
      .fillColor("#2c3e50")
      .rect(40, tableTop - 30, tableWidth, 30)
      .fill();
    doc.fillColor("white").font("Helvetica-Bold").fontSize(11);

    let currentX = 40;
    doc.text("#", currentX + cellPadding, tableTop - 23, {
      width: idWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += idWidth;

    doc.text("Date", currentX + cellPadding, tableTop - 23, {
      width: dateWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += dateWidth;

    doc.text("Garage Name", currentX + cellPadding, tableTop - 23, {
      width: nameWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += nameWidth;

    doc.text("Contact", currentX + cellPadding, tableTop - 23, {
      width: contactWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += contactWidth;

    doc.text("Location", currentX + cellPadding, tableTop - 23, {
      width: locationWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += locationWidth;

    doc.text("Total Score", currentX + cellPadding, tableTop - 23, {
      width: scoreWidth - 2 * cellPadding,
      align: "center",
    });
    currentX += scoreWidth;
    doc.text("Percentage", currentX + cellPadding, tableTop - 23, {
      width: percentageWidth - 2 * cellPadding,
      align: "center",
    });

    doc.fillColor("black").font("Helvetica").fontSize(10);

    let rowY = tableTop;
    let rowCount = 0;

    inspections.forEach((inspection) => {
      if (rowCount % 2 === 0) {
        doc.fillColor("#ecf0f1").rect(40, rowY, tableWidth, rowHeight).fill();
      }
      doc.fillColor("black");

      // Format date
      const inspDate = new Date(inspection.date);
      const formattedDate = `${inspDate.getDate()}/${
        inspDate.getMonth() + 1
      }/${inspDate.getFullYear()}`;

      const textY = rowY + rowHeight / 2 - 5;
      currentX = 40;

      doc.text(inspection.id.toString(), currentX + cellPadding, textY, {
        width: idWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += idWidth;

      doc.text(formattedDate, currentX + cellPadding, textY, {
        width: dateWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += dateWidth;

      doc.text(inspection.garage_name, currentX + cellPadding, textY, {
        width: nameWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += nameWidth;

      doc.text(inspection.contact_person_tel, currentX + cellPadding, textY, {
        width: contactWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += contactWidth;

      doc.text(inspection.physical_location, currentX + cellPadding, textY, {
        width: locationWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += locationWidth;

      doc.text(inspection.total_score, currentX + cellPadding, textY, {
        width: scoreWidth - 2 * cellPadding,
        align: "center",
      });
      currentX += scoreWidth;

      doc.text(`${inspection.percentage}%`, currentX + cellPadding, textY, {
        width: percentageWidth - 2 * cellPadding,
        align: "center",
      });

      rowY += rowHeight;
      rowCount++;
    });

    // Draw table borders
    doc.rect(40, tableTop - 30, tableWidth, 30 + rowCount * rowHeight).stroke();

    let lineX = 40 + idWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    lineX += dateWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    lineX += nameWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    lineX += contactWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    lineX += locationWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    lineX += scoreWidth;
    doc
      .moveTo(lineX, tableTop - 30)
      .lineTo(lineX, tableTop + rowCount * rowHeight)
      .stroke();

    doc
      .moveTo(40, tableTop)
      .lineTo(40 + tableWidth, tableTop)
      .stroke();

    for (let i = 1; i <= rowCount; i++) {
      doc
        .moveTo(40, tableTop + i * rowHeight)
        .lineTo(40 + tableWidth, tableTop + i * rowHeight)
        .stroke();
    }

    // Add footer
    const pageHeight = doc.page.height;
    doc
      .fontSize(10)
      .text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        50,
        pageHeight - 50,
        { align: "center" }
      );

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
