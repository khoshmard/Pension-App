/**
 * @file itemsRepository.js
 * @description Manages the configurable income and deduction items (formulas).
 *              Provides CRUD operations for both tables.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const ItemsRepository = (() => {
    /**
     * Returns all active income items ordered by sort_order.
     * @returns {Array<Object>} Items with {id, name, formula, sortOrder}.
     */
    function getIncomes() {
        const res = DatabaseService.getDB().exec('SELECT id, name, formula, sort_order FROM income_items WHERE active=1 ORDER BY sort_order');
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ id: r[0], name: r[1], formula: r[2], sortOrder: r[3] }));
    }

    /**
     * Inserts or updates an income item (updates if item.id exists).
     * @param {Object} item - {id?, name, formula, sortOrder}.
     */
    function saveIncome(item) {
        const db = DatabaseService.getDB();
        if (item.id) db.run('UPDATE income_items SET name=?, formula=?, sort_order=? WHERE id=?', [item.name, item.formula, item.sortOrder, item.id]);
        else db.run('INSERT INTO income_items (name, formula, sort_order) VALUES (?,?,?)', [item.name, item.formula, item.sortOrder]);
    }

    /**
     * Deletes an income item by ID.
     * @param {number} id
     */
    function deleteIncome(id) { DatabaseService.getDB().run('DELETE FROM income_items WHERE id=?', [id]); }

    /**
     * Returns all active deduction items ordered by sort_order.
     * @returns {Array<Object>}
     */
    function getDeductions() {
        const res = DatabaseService.getDB().exec('SELECT id, name, formula, sort_order FROM deduction_items WHERE active=1 ORDER BY sort_order');
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ id: r[0], name: r[1], formula: r[2], sortOrder: r[3] }));
    }

    /**
     * Inserts or updates a deduction item.
     * @param {Object} item
     */
    function saveDeduction(item) {
        const db = DatabaseService.getDB();
        if (item.id) db.run('UPDATE deduction_items SET name=?, formula=?, sort_order=? WHERE id=?', [item.name, item.formula, item.sortOrder, item.id]);
        else db.run('INSERT INTO deduction_items (name, formula, sort_order) VALUES (?,?,?)', [item.name, item.formula, item.sortOrder]);
    }

    /**
     * Deletes a deduction item by ID.
     * @param {number} id
     */
    function deleteDeduction(id) { DatabaseService.getDB().run('DELETE FROM deduction_items WHERE id=?', [id]); }

    return { getIncomes, saveIncome, deleteIncome, getDeductions, saveDeduction, deleteDeduction };
})();
