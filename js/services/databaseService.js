/**
 * @file databaseService.js
 * @description Core database management module. Initializes the SQLite database using
 *              sql.js, creates all required tables (retirees, changelog, salary_records,
 *              payments, income_items, deduction_items), handles schema migration,
 *              seeds default formula items, and provides export/import of the
 *              entire binary database.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.5
 * @history
 * 1.0.5 (2026-07-23) - Implementing Payslip Model
 * 1.0.4 (2026-07-18) - Implementing Unified Item
 * 1.0.3 (2026-07-17) - Improving Decree Items
 * 1.0.2 (2026-07-16) - Implementing Decree
 * 1.0.1 (2026-07-14) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular 
 */

/* IIFE module holding the database instance and coordination methods. */
const DatabaseService = (() => {
    let db = null;

    /**
     * Initialises the internal database reference and runs schema setup,
     * migration, and default data seeding.
     * @param {Object} database - A sql.js Database instance.
     */
    function init(database) {
        db = database;
        createTables();
        migrateIfNeeded();
        seedDefaultItems();
    }

    /**
     * Creates all tables and indexes if they do not already exist.
     * (Private helper)
     */
    function createTables() {
        // Person
        db.run(`CREATE TABLE IF NOT EXISTS persons (
            id INTEGER PRIMARY KEY,
            national_code TEXT UNIQUE NOT NULL,
            id_number TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            father_name TEXT DEFAULT '',
            birth_date TEXT DEFAULT '',
            marriage_status INTEGER DEFAULT 0,
            children_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT '' );`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_persons_active_name ON persons (is_active, last_name, first_name);`);
        db.run(`CREATE TRIGGER IF NOT EXISTS prevent_person_soft_delete_if_used
            BEFORE UPDATE OF is_active ON persons
            BEGIN
                SELECT CASE
                    WHEN NEW.is_active = 0 AND (
                        EXISTS (SELECT 1 FROM retirees WHERE person_id = NEW.id AND is_active = 1) OR
                        EXISTS (SELECT 1 FROM pensioners WHERE person_id = NEW.id AND is_active = 1) OR
                        EXISTS (SELECT 1 FROM pensioners WHERE deceased_id = NEW.id AND is_active = 1) OR
                        EXISTS (SELECT 1 FROM dependents WHERE person_id = NEW.id)
                    )
                    THEN
                        RAISE(ABORT, 'Cannot deactivate: This record is in use.')
                END;
            END;`);       
        db.run(`CREATE VIEW IF NOT EXISTS active_persons AS
            SELECT id, national_code, id_number, first_name, last_name, father_name, 
            birth_date, marriage_status, children_count, created_at
            FROM persons
            WHERE is_active = 1;`);
        db.run(`CREATE TABLE IF NOT EXISTS person_changelog (
            id INTEGER PRIMARY KEY,
            person_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            changed_field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT DEFAULT '',
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_person_changelog_person_id ON person_changelog (person_id);`);
        
        // Retiree
        db.run(`CREATE TABLE IF NOT EXISTS retirees (
            id INTEGER PRIMARY KEY,
            person_id INTEGER NOT NULL,
            personnel_code TEXT DEFAULT '',
            retirement_date TEXT DEFAULT '',
            ledger_number TEXT DEFAULT '',
            veteran_status TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT '',
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT );`);        
        db.run(`CREATE INDEX IF NOT EXISTS idx_retirees_person_id ON retirees (person_id);`);
        db.run(`CREATE TRIGGER IF NOT EXISTS prevent_retiree_soft_delete_if_used
            BEFORE UPDATE OF is_active ON retirees
            BEGIN
                SELECT CASE
                    WHEN NEW.is_active = 0 AND EXISTS (SELECT 1 FROM dependents WHERE person_id = NEW.id)
                    THEN
                        RAISE(ABORT, 'Cannot deactivate: This record is in use.')
                END;
            END;`);        
        db.run(`CREATE VIEW IF NOT EXISTS active_retirees AS
            SELECT id, person_id, personnel_code, retirement_date,
            ledger_number, veteran_status, created_at
            FROM retirees
            WHERE is_active = 1;`);
        db.run(`CREATE TABLE IF NOT EXISTS retiree_changelog (
            id INTEGER PRIMARY KEY,
            retiree_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            changed_field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT DEFAULT '',
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_retiree_changelog_retiree_id ON retiree_changelog (retiree_id);`);
        
        // Pensioner
        db.run(`CREATE TABLE IF NOT EXISTS pensioners (
            id INTEGER PRIMARY KEY,
            person_id INTEGER NOT NULL,
            deceased_id INTEGER NOT NULL,
            ledger_number TEXT DEFAULT '',
            inheritance_code TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT '',
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT,
            FOREIGN KEY (deceased_id) REFERENCES persons(id) ON DELETE RESTRICT );`);        
        db.run(`CREATE INDEX IF NOT EXISTS idx_pensioners_person_id ON pensioners (person_id);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pensioners_deceased_id ON pensioners (deceased_id);`);
        db.run(`CREATE VIEW IF NOT EXISTS active_pensioners AS
            SELECT id, person_id, deceased_id, ledger_number, inheritance_code, created_at
            FROM pensioners
            WHERE is_active = 1;`);
        db.run(`CREATE TABLE IF NOT EXISTS pensioner_changelog (
            id INTEGER PRIMARY KEY,
            pensioner_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            changed_field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT DEFAULT '',
            FOREIGN KEY (pensioner_id) REFERENCES pensioners(id) ON DELETE CASCADE )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pensioner_changelog_pensioner_id ON pensioner_changelog (pensioner_id);`);
        
        // Dependent
        db.run(`CREATE TABLE IF NOT EXISTS dependents (
            id INTEGER PRIMARY KEY,
            person_id INTEGER NOT NULL,
            retiree_id INTEGER NOT NULL,
            dependent_type INTEGER NOT NULL,
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT,
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE );`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_dependents_person_id ON dependents (person_id);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_dependents_retiree_id ON dependents (retiree_id);`);
        
        // Decrees
        db.run(`
            CREATE TABLE IF NOT EXISTS decrees (
                id INTEGER PRIMARY KEY,
                person_id INTEGER NOT NULL,
                type TEXT NOT NULL DEFAULT 'retiree',
                decree_number TEXT DEFAULT '',
                title TEXT DEFAULT '',
                issue_date TEXT DEFAULT '',
                effective_from TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT '',
                FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT
            );
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_decrees_person_id ON decrees(person_id);');

        // Decrees Items
        db.run(`
            CREATE TABLE IF NOT EXISTS decree_items (
                id INTEGER PRIMARY KEY,
                decree_id INTEGER NOT NULL,
                item_definition_id INTEGER,
                name TEXT NOT NULL,
                formula TEXT DEFAULT '',
                is_income INTEGER NOT NULL DEFAULT 1,
                amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (decree_id) REFERENCES decrees(id) ON DELETE CASCADE
            );
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_decree_items_decree ON decree_items(decree_id);');

        // Lookup tables
        db.run(`CREATE TABLE IF NOT EXISTS item_usage_types (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE);`);
        db.run(`CREATE TABLE IF NOT EXISTS item_applicable_entities (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE);`);
        // Unified Item
        db.run(`CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            formula TEXT DEFAULT '',
            amount REAL DEFAULT 0,
            initial REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            is_income INTEGER NOT NULL DEFAULT 1,
            usage_type_id INTEGER NOT NULL,
            applicable_entity_id INTEGER NOT NULL,
            is_recurring INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (usage_type_id) REFERENCES item_usage_types(id) ON DELETE RESTRICT,
            FOREIGN KEY (applicable_entity_id) REFERENCES item_applicable_entities(id) ON DELETE RESTRICT);`);
        db.run('CREATE INDEX IF NOT EXISTS idx_items_usage_types ON items(usage_type_id);');
        db.run('CREATE INDEX IF NOT EXISTS idx_items_applicable_entities ON items(applicable_entity_id);');
        db.run(`CREATE VIEW IF NOT EXISTS active_items AS
            SELECT i.id, i.name, i.formula, i.amount, i.initial, i.balance,
                i.is_income, ut.name AS usage_type, ae.name AS applicable_entity,
                i.is_recurring, i.sort_order
            FROM items i
            JOIN item_usage_types ut ON i.usage_type_id = ut.id
            JOIN item_applicable_entities ae ON i.applicable_entity_id = ae.id
            WHERE i.is_active = 1;`);

        // Payslips
        db.run(`
            CREATE TABLE IF NOT EXISTS payslips (
                id INTEGER PRIMARY KEY,
                person_id INTEGER NOT NULL,
                calc_year INTEGER NOT NULL,
                calc_month INTEGER NOT NULL,
                decree_id INTEGER,
                total_gross REAL DEFAULT 0,
                total_deductions REAL DEFAULT 0,
                net_amount REAL DEFAULT 0,
                status INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                created_at TEXT DEFAULT '',
                FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT,
                FOREIGN KEY (decree_id) REFERENCES decrees(id) ON DELETE SET NULL
            );
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_payslips_person ON payslips(person_id);');
        db.run('CREATE INDEX IF NOT EXISTS idx_payslips_year_month ON payslips(calc_year, calc_month);');

        // Payslip items
        db.run(`
            CREATE TABLE IF NOT EXISTS payslip_items (
                id INTEGER PRIMARY KEY,
                payslip_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                formula TEXT DEFAULT '',
                amount REAL NOT NULL DEFAULT 0,
                is_income INTEGER NOT NULL DEFAULT 1,
                source INTEGER NOT NULL DEFAULT 1,
                reference_id INTEGER,
                FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE CASCADE
            );
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_payslip_items_payslip ON payslip_items(payslip_id);');

        db.run(`CREATE TABLE IF NOT EXISTS salary_records (
            id INTEGER PRIMARY KEY, retiree_id INTEGER NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
            base_salary REAL DEFAULT 0, allowances REAL DEFAULT 0,
            total REAL GENERATED ALWAYS AS (base_salary + allowances) STORED,
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE )`);

        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY, retiree_id INTEGER NOT NULL, calc_year INTEGER NOT NULL, calc_month INTEGER NOT NULL,
            income_json TEXT DEFAULT '[]', deduction_json TEXT DEFAULT '[]',
            gross_amount REAL DEFAULT 0, total_deductions REAL DEFAULT 0, net_amount REAL DEFAULT 0,
            notes TEXT DEFAULT '', created_at TEXT DEFAULT '',
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE )`);

        db.run('CREATE INDEX IF NOT EXISTS idx_salary_retiree ON salary_records(retiree_id);');
        db.run('CREATE INDEX IF NOT EXISTS idx_payments_retiree ON payments(retiree_id);');
    }

    /**
     * Applies any necessary column additions to existing tables (e.g. children_count).
     * (Private helper)
     */
    function migrateIfNeeded() {
        const db = DatabaseService.getDB();
        // If old items table exists without foreign keys
        const oldCols = db.exec("PRAGMA table_info(items)");
        if (oldCols.length && oldCols[0].values.some(r => r[1] === 'usage_type')) {
            // Create lookup tables if not exist
            db.run('CREATE TABLE IF NOT EXISTS item_usage_types (id INTEGER PRIMARY KEY, name TEXT UNIQUE);');
            db.run('CREATE TABLE IF NOT EXISTS item_applicable_entities (id INTEGER PRIMARY KEY, name TEXT UNIQUE);');
            db.run('INSERT OR IGNORE INTO item_usage_types (name) VALUES ("decree"), ("payslip");');
            db.run('INSERT OR IGNORE INTO item_applicable_entities (name) VALUES ("retiree"), ("pensioner"), ("all");');

            // Rename old table
            db.run('ALTER TABLE items RENAME TO items_old;');
            // Create new table (the one with FKs)
            createTables(); // will create the new items table

            // Copy data
            const rows = db.exec('SELECT name, formula, amount, initial, balance, is_income, usage_type, applicable_entity, is_recurring, sort_order, is_active FROM items_old');
            if (rows.length && rows[0].values.length) {
                rows[0].values.forEach(r => {
                    const usageTypeId = db.exec("SELECT id FROM item_usage_types WHERE name = ?", [r[6]])[0]?.values[0]?.[0];
                    const entityId = db.exec("SELECT id FROM item_applicable_entities WHERE name = ?", [r[7]])[0]?.values[0]?.[0];
                    if (usageTypeId && entityId) {
                        db.run(`
                            INSERT INTO items (name, formula, amount, initial, balance, is_income, usage_type_id, applicable_entity_id, is_recurring, sort_order, is_active)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                            [r[0], r[1], r[2], r[3], r[4], r[5], usageTypeId, entityId, r[8], r[9], r[10]]
                        );
                    }
                });
            }
            db.run('DROP TABLE items_old;');
        }
    }

    /**
     * Inserts the default income and deduction items if the tables are empty.
     * (Private helper)
     */
    function seedDefaultItems() {
        const db = DatabaseService.getDB();
        db.run('INSERT OR IGNORE INTO item_usage_types (name) VALUES ("decree"), ("payslip");');
        db.run('INSERT OR IGNORE INTO item_applicable_entities (name) VALUES ("all"), ("retiree"), ("pensioner");');

        const count = db.exec('SELECT COUNT(*) FROM items')[0].values[0][0];
        if (count === 0) {
            // Fetch IDs for default usage types and entities
            const decreeTypeId = db.exec("SELECT id FROM item_usage_types WHERE name = 'decree'")[0].values[0][0];
            const allEntityId = db.exec("SELECT id FROM item_applicable_entities WHERE name = 'all'")[0].values[0][0];

            db.run(`
                INSERT INTO items (name, formula, amount, is_income, usage_type_id, applicable_entity_id, is_recurring, sort_order)
                VALUES
                    ('حقوق پایه', 'avgSalary * effectiveYears / maxYears', 0, 1, ?, ?, 1, 1),
                    ('عائله‌مندی', 'spouse * minWage * spouseFactor / 100', 0, 1, ?, ?, 1, 2),
                    ('اولاد', 'childrenUnder18 * minWage * childFactor / 100', 0, 1, ?, ?, 1, 3),
                    ('بیمه (۱/۹)', 'totalIncome * insuranceRate / 100', 0, 0, ?, ?, 1, 1),
                    ('بیمه تکمیلی', 'supplementaryIns', 0, 0, ?, ?, 1, 2),
                    ('مالیات', '(totalIncome - taxExemption / 12) * 0.10', 0, 0, ?, ?, 1, 3)
            `, [decreeTypeId, allEntityId, decreeTypeId, allEntityId, decreeTypeId, allEntityId,
                decreeTypeId, allEntityId, decreeTypeId, allEntityId, decreeTypeId, allEntityId]);
        }
    }

    /**
     * Returns the underlying sql.js database object.
     * @returns {Object} The sql.js Database instance.
     */
    function getDB() { return db; }

    /**
     * Exports the entire database as a binary Uint8Array.
     * @returns {Uint8Array}
     */
    function exportDB() { return db.export(); }

    /**
     * Replaces the current database with one loaded from a binary buffer.
     * Re-runs schema creation and migration.
     * @param {ArrayBuffer} buffer - Binary database content.
     */
    function importDB(buffer) { db = new SQL.Database(new Uint8Array(buffer)); createTables(); migrateIfNeeded(); }

    return { init, getDB, exportDB, importDB };
})();
