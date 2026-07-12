/**
 * @file databaseService.js
 * @description Core database management module. Initializes the SQLite database using
 *              sql.js, creates all required tables (retirees, changelog, salary_records,
 *              payments, income_items, deduction_items), handles schema migration,
 *              seeds default formula items, and provides export/import of the
 *              entire binary database.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
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
        db.run(`CREATE TABLE IF NOT EXISTS retirees (
            id INTEGER PRIMARY KEY, national_code TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
            father_name TEXT DEFAULT '', birth_date TEXT DEFAULT '', retirement_date TEXT DEFAULT '',
            service_years REAL DEFAULT 0, avg_salary REAL DEFAULT 0, retiree_type TEXT DEFAULT 'main',
            children_count INTEGER DEFAULT 0, has_spouse INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now','localtime')) )`);
        db.run(`CREATE TABLE IF NOT EXISTS retiree_changelog (
            id INTEGER PRIMARY KEY, retiree_id INTEGER NOT NULL, changed_field TEXT NOT NULL,
            old_value TEXT, new_value TEXT, changed_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE )`);
        db.run(`CREATE TABLE IF NOT EXISTS salary_records (
            id INTEGER PRIMARY KEY, retiree_id INTEGER NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
            base_salary REAL DEFAULT 0, allowances REAL DEFAULT 0,
            total REAL GENERATED ALWAYS AS (base_salary + allowances) STORED,
            FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE )`);
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY, retiree_id INTEGER NOT NULL, calc_year INTEGER NOT NULL, calc_month INTEGER NOT NULL,
            income_json TEXT DEFAULT '[]', deduction_json TEXT DEFAULT '[]',
            gross_amount REAL DEFAULT 0, total_deductions REAL DEFAULT 0, net_amount REAL DEFAULT 0,
            children_count INTEGER DEFAULT 0, has_spouse INTEGER DEFAULT 0, notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
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
