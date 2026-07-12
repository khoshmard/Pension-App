/**
 * @file salaryRepository.js
 * @description Manages monthly salary records. Handles insertion, deletion, and
 *              automatic recalculation of the retiree's average salary based on
 *              the most recent 24 records.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const SalaryRepository = (() => {
    /**
     * Retrieves salary records, optionally filtered by retireeId.
     * @param {Object} [filters] - Optional filter, e.g. {retireeId: 5}.
     * @returns {Array<Object>} Array of salary record objects.
     */
    function getAll(filters = {}) {
        let query = 'SELECT s.id, r.first_name, r.last_name, s.year, s.month, s.base_salary, s.allowances, s.total FROM salary_records s JOIN retirees r ON s.retiree_id = r.id';
        const params = [];
        if (filters.retireeId) { query += ' WHERE s.retiree_id=?'; params.push(filters.retireeId); }
        query += ' ORDER BY s.year DESC, s.month DESC LIMIT 200';
        const res = DatabaseService.getDB().exec(query, params);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ id: r[0], retireeName: r[1]+' '+r[2], year: r[3], month: r[4], baseSalary: r[5], allowances: r[6], total: r[7] }));
    }

    /**
     * Adds a new salary record and updates the retiree's average salary field.
     * @param {Object} record - {retireeId, year, month, baseSalary, allowances}.
     */
    function add(record) {
        const db = DatabaseService.getDB();
        db.run('INSERT INTO salary_records (retiree_id, year, month, base_salary, allowances) VALUES (?,?,?,?,?)', [record.retireeId, record.year, record.month, record.baseSalary, record.allowances]);
        updateAvgSalary(record.retireeId);
    }

    /**
     * Deletes a salary record by ID and updates the corresponding retiree's average.
     * @param {number} id - Salary record ID.
     */
    function remove(id) {
        const db = DatabaseService.getDB();
        const rec = db.exec('SELECT retiree_id FROM salary_records WHERE id=?', [id]);
        const rid = rec.length && rec[0].values.length ? rec[0].values[0][0] : null;
        db.run('DELETE FROM salary_records WHERE id=?', [id]);
        if (rid) updateAvgSalary(rid);
    }

    /**
     * Recalculates the average salary for a retiree from the last 24 salary totals
     * and updates the retiree's avg_salary column.
     * @param {number} retireeId
     */
    function updateAvgSalary(retireeId) {
        const db = DatabaseService.getDB();
        const data = db.exec('SELECT total FROM salary_records WHERE retiree_id=? ORDER BY year DESC, month DESC LIMIT 24', [retireeId]);
        if (data.length && data[0].values.length) {
            const totals = data[0].values.map(r => r[0]);
            const avg = totals.reduce((a,b)=>a+b,0) / totals.length;
            db.run('UPDATE retirees SET avg_salary=? WHERE id=?', [Math.round(avg), retireeId]);
        }
    }

    return { getAll, add, remove };
})();
