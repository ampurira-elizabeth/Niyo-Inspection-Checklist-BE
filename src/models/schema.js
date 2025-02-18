const db = require("../config/db.config");

const createTables = async () => {
  try {
    // Categories table
    await db.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL
            )
        `);

    // Checklist items table
    await db.query(`
            CREATE TABLE IF NOT EXISTS checklist_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                category_id INT,
                description TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        `);

    // Inspections table
    await db.query(`
            CREATE TABLE IF NOT EXISTS inspections (
                id INT PRIMARY KEY AUTO_INCREMENT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_score DECIMAL(5,2),
                percentage DECIMAL(5,2)
            )
        `);

    // Inspection results table
    await db.query(`
            CREATE TABLE IF NOT EXISTS inspection_results (
                id INT PRIMARY KEY AUTO_INCREMENT,
                inspection_id INT,
                checklist_item_id INT,
                status ENUM('yes', 'no', 'neutral') NOT NULL,
                score INT,
                comments TEXT,
                FOREIGN KEY (inspection_id) REFERENCES inspections(id),
                FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id)
            )
        `);

    // seeded categories
    const [categories] = await db.query("SELECT * FROM categories");
    if (categories.length === 0) {
      await db.query(`
                INSERT INTO categories (name) VALUES 
                ('Statutory Requirements – Available and Displayed'),
                ('Location/Premises'),
                ('Garage Facilities'),
                ('Safety & Health'),
                ('Waste Management & Environment'),
                ('Professionalism'),
                ('Garage Security'),
                ('Tools & Equipment')
            `);

      //seeded data for my categories
      await db.query(`
                INSERT INTO checklist_items (category_id, description) VALUES 
                (1, 'Certificate of Incorporation '),
                (1, 'TIN Certificate'),
                (1, 'Trading License'),
                (1, 'Mention any other available'),
                (2,'Signpost'),
                (2,'Clear Access Road'),
                (2,'Garage Lay out'),
                (3,'Office'),
                (3,'Working Shade'),
                (3,'Spare Part/Equipment Store'),
                (3,'Parking Area'),
                (3,'Customer Waiting Area'),
                (3,'Mention any other available'),
                (4,'Internal Talking Signages'),
                (4,'Assorted Waste Bins'),
                (4,'Fire Extinguishers (No.s)'),
                (4,'Emergency Exit'),
                (4,'Staff Protective Gear (Apparel)'),
                (4,'Safety Boots & Others'),
                (4,'Clean Toilets'),
                (4,'Female Staff Provisions'),
                (4,'Mention any other available'),
                (5,'Biodegradable Waste Bin'),
                (5,'Non-Biodegradable Waste Bin'),
                (5,'Waste Scrap Store'),
                (5,'Waste Oil Tank'),
                (5,'General Hygiene & Sanitation'),
                (5,'Mention any other available'),
                (6,'Number of Qualified Staff'),
                (6,'Number of Apprentices'),
                (6,'Garage Insurance'),
                (6,'Filing Tax Returns with URA'),
                (6,'Service Advisor/Customer Care'),
                (6,'Record Keeping (soft or hardcopies)'),
                (6,'Are you in any other Business Group'),
                (6,'Mention any other available'),
                (7,'Fenced Premises'),
                (7,'Secured Gate'),
                (7,'Camera/Dogs/Guard (Any)'),
                (7,'State other measure if any'),
                (8,'Basic Hand Tool Boxes'),
                (8,'Service Pit/Hoist'),
                (8,'Car Stands'),
                (8,'Car Spraying Area/Booth')
            `);
    }

    console.log("Database schema created successfully");
  } catch (error) {
    console.error("Error creating database schema:", error);
    throw error;
  }
};

module.exports = { createTables };
