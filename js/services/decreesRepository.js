/**
 * @file decreeRepository.js
 * @description CRUD operations for decrees and their items.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.5
 * @history
 * 1.0.5 (2026-07-25) - Add Category to Decree Items
 * 1.0.4 (2026-07-23) - Calculating Arrears and Confirmation
 * 1.0.3 (2026-07-23) - Payslip Bulk Calculation Engine
 * 1.0.2 (2026-07-20) - Implementing Unified Item
 * 1.0.1 (2026-07-17) - Improving Decree Items
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
        const itemsRes = db.exec(`SELECT i.id, i.item_definition_id, i.name, i.formula, ic.name AS category, i.amount
            FROM decree_items i JOIN item_categories ic ON i.category_id = ic.id WHERE decree_id = ?`, [decreeId]);
        if (itemsRes.length && itemsRes[0].values.length) {
            decree.items = itemsRes[0].values.map(r => ({
                id: r[0],
                itemDefinitionId: r[1],
                name: r[2],
                formula: r[3],
                category: r[4],
                amount: r[5]
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
            const allDecreeItems = ItemsRepository.getByUsage(['decree']);

            decree.items.forEach(item => {
                const def = allDecreeItems.find(d => d.id === item.itemDefinitionId);
                const name = def ? def.name : '';
                const formula = def ? def.formula : '';
                const categoryId = def ? ItemsRepository.CATEGORIES[def.category] : ItemsRepository.CATEGORIES['other'];
                db.run(
                    `INSERT INTO decree_items (decree_id, item_definition_id, name, formula, category_id, amount)
                    VALUES (?,?,?,?,?,?)`,
                    [newId, item.itemDefinitionId, name, formula, categoryId, item.amount]
                );
            });
        }
        return newId;
    }

    /**
     * Returns the currently active decree for a person, including its items.
     * @param {number} personId
     * @returns {Object|null} Decree with items, or null if no active decree.
     */
    function getActiveDecreeWithItems(personId) {
        const db = DatabaseService.getDB();
        // Get the most recent active decree id
        const res = db.exec(
            'SELECT id FROM decrees WHERE person_id = ? AND is_active = 1 ORDER BY effective_from DESC, id DESC LIMIT 1',
            [personId]
        );
        if (!res.length || !res[0].values.length) return null;
        const decreeId = res[0].values[0][0];
        return getById(decreeId);
    }

    /**
     * Returns the decree that was active immediately before the given decree (by effective_from).
     * @param {number} personId
     * @param {number} currentDecreeId - ID of the current decree
     * @returns {Object|null} Previous decree with items, or null.
     */
    function getPreviousDecreeWithItems(personId, currentDecreeId) {
        const db = DatabaseService.getDB();
        // Find decrees for this person that are older than the current one, ordered by effective_from descending.
        const res = db.exec(
            `SELECT id FROM decrees WHERE person_id = ? AND id != ? ORDER BY effective_from DESC, id DESC LIMIT 1`,
            [personId, currentDecreeId]
        );
        if (!res.length || !res[0].values.length) return null;
        const prevId = res[0].values[0][0];
        return getById(prevId);
    }

    /**
     * Soft-deletes a decree (sets is_active = 0).
     * @param {number} decreeId
     */
    function softDelete(decreeId) {
        const db = DatabaseService.getDB();
        db.run('UPDATE decrees SET is_active = 0 WHERE id = ?', [decreeId]);
    }

    return { getByPersonId, getById, add, getActiveDecreeWithItems, getPreviousDecreeWithItems, softDelete };
})();
