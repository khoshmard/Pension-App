/**
 * @file decreeRepository.js
 * @description CRUD operations for decrees and their items.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.0
 * @history
 * 1.0.0 (2026-07-17) - Implementing Decree
 */

const DecreeRepository = (() => {
    /**
     * Retrieves all decrees for a given person, optionally active only.
     * @param {number} personId
     * @param {boolean} activeOnly
     * @returns {Array}
     */
    function getByPersonId(personId, activeOnly = false) {
        const db = DatabaseService.getDB();
        let sql = 'SELECT id, person_id, type, decree_number, title, issue_date, effective_from, is_active, created_at FROM decrees WHERE person_id = ?';
        if (activeOnly) sql += ' AND is_active = 1';
        sql += ' ORDER BY is_active DESC, issue_date DESC, decree_number DESC';
        const res = db.exec(sql, [personId]);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0],
            personId: r[1],
            type: r[2],
            decreeNumber: r[3],
            title: r[4],
            issueDate: r[5],
            effectiveFrom: r[6],
            isActive: r[7],
            createdAt: r[8]
        }));
    }

    /**
     * Returns a single decree by ID, including its items.
     * @param {number} decreeId
     * @returns {Object|null}
     */
    function getById(decreeId) {
        const db = DatabaseService.getDB();
        const res = db.exec('SELECT id, person_id, type, decree_number, title, issue_date, effective_from, is_active, created_at FROM decrees WHERE id = ?', [decreeId]);
        if (!res.length || !res[0].values.length) return null;
        const d = res[0].values[0];
        const decree = {
            id: d[0],
            personId: d[1],
            type: d[2],
            decreeNumber: d[3],
            title: d[4],
            issueDate: d[5],
            effectiveFrom: d[6],
            isActive: d[7],
            createdAt: d[8],
            items: []
        };
        // Fetch items
        const itemsRes = db.exec('SELECT id, item_definition_id, is_income, amount FROM decree_items WHERE decree_id = ?', [decreeId]);
        if (itemsRes.length && itemsRes[0].values.length) {
            decree.items = itemsRes[0].values.map(r => ({
                id: r[0],
                itemDefinitionId: r[1],
                isIncome: r[2] === 1,
                amount: r[3]
            }));
        }
        return decree;
    }

    /**
     * Creates a new decree and its items. Automatically deactivates any previous active decree for the same person.
     * @param {Object} decree - { personId, type, decreeNumber, issueDate, effectiveFrom, items: [{ itemDefinitionId, isIncome, amount }] }
     * @returns {number} New decree ID.
     */
    function add(decree) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        // Deactivate previous active decrees for this person
        db.run('UPDATE decrees SET is_active = 0 WHERE person_id = ? AND is_active = 1', [decree.personId]);
        // Insert decree
        db.run(`
            INSERT INTO decrees (person_id, type, decree_number, title, issue_date, effective_from, is_active, created_at)
            VALUES (?,?,?,?,?,?,1,?)`,
            [decree.personId, decree.type, decree.decreeNumber, decree.title, decree.issueDate, decree.effectiveFrom, now]);
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        // Insert items
        if (decree.items && decree.items.length) {
            decree.items.forEach(item => {
                db.run(`
                    INSERT INTO decree_items (decree_id, item_definition_id, is_income, amount)
                    VALUES (?,?,?,?)`,
                    [newId, item.itemDefinitionId, item.isIncome ? 1 : 0, item.amount]);
            });
        }
        return newId;
    }

    /**
     * Soft-deletes a decree (sets is_active = 0).
     * @param {number} decreeId
     */
    function softDelete(decreeId) {
        const db = DatabaseService.getDB();
        db.run('UPDATE decrees SET is_active = 0 WHERE id = ?', [decreeId]);
    }

    return { getByPersonId, getById, add, softDelete };
})();
