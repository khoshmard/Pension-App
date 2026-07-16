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
 * @version     1.0.1
 * @history
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

        db.run(`CREATE TABLE IF NOT EXISTS income_items (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, formula TEXT NOT NULL DEFAULT '0',
            sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1 )`);

        db.run(`CREATE TABLE IF NOT EXISTS deduction_items (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, formula TEXT NOT NULL DEFAULT '0',
            sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1 )`);

        db.run('CREATE INDEX IF NOT EXISTS idx_salary_retiree ON salary_records(retiree_id);');
        db.run('CREATE INDEX IF NOT EXISTS idx_payments_retiree ON payments(retiree_id);');
    }

    /**
     * Applies any necessary column additions to existing tables (e.g. children_count).
     * (Private helper)
     */
    function migrateIfNeeded() {
        try { db.run('ALTER TABLE retirees ADD COLUMN children_count INTEGER DEFAULT 0'); } catch(e) {}
        try { db.run('ALTER TABLE retirees ADD COLUMN has_spouse INTEGER DEFAULT 0'); } catch(e) {}
        // Add columns that might be missing from older schema
    }

    /**
     * Inserts the default income and deduction items if the tables are empty.
     * (Private helper)
     */
    function seedDefaultItems() {
        const inc = db.exec('SELECT COUNT(*) FROM income_items')[0].values[0][0];
        if (inc === 0) {
            db.run(`INSERT INTO income_items (name, formula, sort_order) VALUES
                ('حقوق پایه', 'avgSalary * effectiveYears / maxYears', 1),
                ('عائله‌مندی', 'spouse ? minWage * spouseFactor / 100 : 0', 2),
                ('اولاد', 'children * minWage * childFactor / 100', 3)`);
        }
        const ded = db.exec('SELECT COUNT(*) FROM deduction_items')[0].values[0][0];
        if (ded === 0) {
            db.run(`INSERT INTO deduction_items (name, formula, sort_order) VALUES
                ('بیمه (۱/۹)', 'totalIncome * insuranceRate / 100', 1),
                ('بیمه تکمیلی', 'supplementaryIns', 2),
                ('مالیات', '(totalIncome - taxExemption / 12) * 0.10', 3)`);
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
