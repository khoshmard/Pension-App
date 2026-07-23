/**
 * @file payslipsRepository.js
 * @description CRUD for monthly payslips and their items.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.0
 * @history
 * 1.0.0 (2026-07-23) - Implementing Payslip Model
 */

const PayslipsRepository = (() => {
    // Status codes
    const STATUS = {
        CALCULATED: 0,
        CONFIRMED: 1
    };

    // Item source codes
    const SOURCE = {
        DECREE: 1,
        PAYSLIP_ITEM: 2,
        ARREARS: 3
    };

    /**
     * Returns all payslips matching the given filters.
     * @param {Object} filters - { year, month, personId (optional) }
     * @returns {Array<Object>}
     */
    function getByFilters(filters) {
        const db = DatabaseService.getDB();
        let query = 'SELECT id, person_id, calc_year, calc_month, decree_id, total_gross, total_deductions, net_amount, status, notes, created_at FROM payslips WHERE 1=1';
        const params = [];
        if (filters.year) { query += ' AND calc_year = ?'; params.push(filters.year); }
        if (filters.month) { query += ' AND calc_month = ?'; params.push(filters.month); }
        if (filters.personId) { query += ' AND person_id = ?'; params.push(filters.personId); }
        query += ' ORDER BY person_id';
        const res = db.exec(query, params);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0], personId: r[1], calcYear: r[2], calcMonth: r[3], decreeId: r[4],
            totalGross: r[5], totalDeductions: r[6], netAmount: r[7],
            status: r[8], notes: r[9], createdAt: r[10]
        }));
    }

    /**
     * Returns a single payslip by ID, including its items.
     * @param {number} payslipId
     * @returns {Object|null}
     */
    function getById(payslipId) {
        const db = DatabaseService.getDB();
        const res = db.exec('SELECT id, person_id, calc_year, calc_month, decree_id, total_gross, total_deductions, net_amount, status, notes, created_at FROM payslips WHERE id = ?', [payslipId]);
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        const payslip = {
            id: r[0], personId: r[1], calcYear: r[2], calcMonth: r[3], decreeId: r[4],
            totalGross: r[5], totalDeductions: r[6], netAmount: r[7],
            status: r[8], notes: r[9], createdAt: r[10], items: []
        };
        const itemsRes = db.exec('SELECT id, name, formula, amount, is_income, source, reference_id FROM payslip_items WHERE payslip_id = ? ORDER BY id', [payslipId]);
        if (itemsRes.length && itemsRes[0].values.length) {
            payslip.items = itemsRes[0].values.map(r => ({
                id: r[0], name: r[1], formula: r[2], amount: r[3],
                isIncome: r[4] === 1, source: r[5], referenceId: r[6]
            }));
        }
        return payslip;
    }

    /**
     * Creates a new payslip and its items (all at once).
     * @param {Object} payslip - { personId, calcYear, calcMonth, decreeId, items: [{ name, formula, amount, isIncome, source, referenceId }] }
     * @returns {number} New payslip ID.
     */
    function add(payslip) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        let totalGross = 0, totalDeductions = 0;
        payslip.items.forEach(item => {
            if (item.isIncome) totalGross += item.amount;
            else totalDeductions += item.amount;
        });
        const netAmount = totalGross - totalDeductions;

        db.run(
            `INSERT INTO payslips (person_id, calc_year, calc_month, decree_id, total_gross, total_deductions, net_amount, status, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [payslip.personId, payslip.calcYear, payslip.calcMonth, payslip.decreeId || null,
             totalGross, totalDeductions, netAmount, STATUS.CALCULATED, now]
        );
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

        if (payslip.items && payslip.items.length) {
            payslip.items.forEach(item => {
                db.run(
                    `INSERT INTO payslip_items (payslip_id, name, formula, amount, is_income, source, reference_id)
                     VALUES (?,?,?,?,?,?,?)`,
                    [newId, item.name, item.formula, item.amount, item.isIncome ? 1 : 0,
                     item.source, item.referenceId || null]
                );
            });
        }
        return newId;
    }

    /**
     * Adds a single item to an existing payslip (only if status = CALCULATED).
     * Automatically updates the payslip totals.
     * @param {number} payslipId
     * @param {Object} item - { name, formula, amount, isIncome, source, referenceId }
     * @returns {boolean} success
     */
    function addItem(payslipId, item) {
        const db = DatabaseService.getDB();
        const payslip = getById(payslipId);
        if (!payslip || payslip.status !== STATUS.CALCULATED) return false;

        db.run(
            `INSERT INTO payslip_items (payslip_id, name, formula, amount, is_income, source, reference_id)
             VALUES (?,?,?,?,?,?,?)`,
            [payslipId, item.name, item.formula, item.amount, item.isIncome ? 1 : 0,
             item.source, item.referenceId || null]
        );

        // Update totals
        const totalRes = db.exec(
            `SELECT SUM(CASE WHEN is_income = 1 THEN amount ELSE 0 END) AS gross,
                    SUM(CASE WHEN is_income = 0 THEN amount ELSE 0 END) AS deductions
             FROM payslip_items WHERE payslip_id = ?`,
            [payslipId]
        );
        if (totalRes.length && totalRes[0].values.length) {
            const gross = totalRes[0].values[0][0] || 0;
            const deductions = totalRes[0].values[0][1] || 0;
            const net = gross - deductions;
            db.run('UPDATE payslips SET total_gross = ?, total_deductions = ?, net_amount = ? WHERE id = ?',
                [gross, deductions, net, payslipId]);
        }
        return true;
    }

    /**
     * Deletes a payslip (only if status = CALCULATED).
     * @param {number} payslipId
     * @returns {boolean} success
     */
    function remove(payslipId) {
        const db = DatabaseService.getDB();
        const row = db.exec('SELECT status FROM payslips WHERE id = ?', [payslipId]);
        if (!row.length || !row[0].values.length) return false;
        if (row[0].values[0][0] !== STATUS.CALCULATED) return false;
        db.run('DELETE FROM payslips WHERE id = ?', [payslipId]);
        return true;
    }

    /**
     * Checks if a payslip already exists for a person in a given month.
     * @returns {Object|null} existing payslip or null
     */
    function findExisting(personId, year, month) {
        const res = DatabaseService.getDB().exec(
            'SELECT id, status FROM payslips WHERE person_id = ? AND calc_year = ? AND calc_month = ?',
            [personId, year, month]
        );
        if (res.length && res[0].values.length) {
            return { id: res[0].values[0][0], status: res[0].values[0][1] };
        }
        return null;
    }

    return {
        STATUS,
        SOURCE,
        getByFilters,
        getById,
        add,
        addItem,
        remove,
        findExisting
    };
})();
