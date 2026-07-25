/**
 * @file itemsRepository.js
 * @description Unified CRUD for item definitions (decree and payslip items).
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.1.1
 * @history
 * 1.1.1 (2026-07-24) - Categorize Items
 * 1.1.0 (2026-07-18) - Implementing Unified Item
 * 1.0.0 (2026-07-12) - Make App Modular 
 */

const ItemsRepository = (() => {
    // Cache the IDs (lookup tables are static)
    const USAGE_TYPES = { decree: 1, payslip: 2 };
    const ENTITIES = { all: 1, retiree: 2, pensioner: 3 };
    const CATEGORIES  = { other: 1, salary: 2, benefit: 3, deduction: 4 };

    /**
     * Retrieves active items filtered by usage type(s) and optional applicable entity.
     * @param {string} usageType - 'decree', 'payslip'.
     * @param {string} [entity] - entity code to filter by (e.g., 'retiree'). If omitted, all entities.
     * @returns {Array<Object>}
     */
    function getByUsage(usageType, entity = null) {
        const db = DatabaseService.getDB();
        let query = `SELECT * FROM active_items WHERE usage_type = '${usageType}'`;
        const params = [];

        if (entity) {
            // Filter: either applicable_entity is 'all' or contains the entity
            query += ` AND (applicable_entity = 'all' OR applicable_entity LIKE '%' || ? || '%')`;
            params.push(entity);
        }
        query += ' ORDER BY sort_order, id';
        const res = db.exec(query, params);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0],
            name: r[1],
            formula: r[2],
            amount: r[3],
            initial: r[4],
            balance: r[5],
            isIncome: r[6] === 1,
            usageType: r[7],
            applicableEntity: r[8],
            category: r[9],
            isRecurring: r[10] === 1,
            sortOrder: r[11]
        }));
    }

    /**
     * Shortcut for decree items (usage_type = 'decree' only).
     */
    function getDecreeItems(entityType = null) {
        return getByUsage('decree', entityType);
    }

    /**
     * Shortcut for payslip items (usage_type = 'payslip' only).
     */
    function getPayslipItems(entityType = null) {
        return getByUsage('payslip', entityType);
    }

    /**
     * A function to fetch all categories for dropdowns
     */
    function getAllCategories() {
        const db = DatabaseService.getDB();
        const res = db.exec('SELECT id, name FROM item_categories ORDER BY id');
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ id: r[0], name: r[1] }));
    }

    /**
     * Retrieves a single item by ID.
     */
    function getById(id) {
        const db = DatabaseService.getDB();
        const res = db.exec('SELECT * FROM active_items WHERE id = ?', [id]);
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        return {
            id: r[0],
            name: r[1],
            formula: r[2],
            amount: r[3],
            initial: r[4],
            balance: r[5],
            isIncome: r[6] === 1,
            usageType: r[7],
            applicableEntity: r[8],
            category: r[9],
            isRecurring: r[10] === 1,
            sortOrder: r[11]
        };
    }

    /**
     * Saves (inserts or updates) an item.
     * @param {Object} item
     */
    function save(item) {
        const db = DatabaseService.getDB();
        // Map names to IDs
        const usageTypeId = USAGE_TYPES[item.usageType] || null;
        const entityId = ENTITIES[item.applicableEntity] || ENTITIES['all'];
        const categoryId = CATEGORIES[item.category] || CATEGORIES['other'];
        if (!usageTypeId) throw new Error('Invalid usage type');

        // For decree items, force is_recurring = 1 and determine income status
        if (item.usageType === 'decree') {
            item.isRecurring = true;
            if(item.category === 'salary' || item.category === 'benefit') item.isIncome = true;
            else if (item.category === 'deduction') item.isIncome = false;
        }
        if (item.id) {
            db.run(`
                UPDATE items
                SET name=?, formula=?, amount=?, initial=?, balance=?, is_income=?,
                    usage_type_id=?, applicable_entity_id=?, is_recurring=?, sort_order=?
                WHERE id=?`,
                [item.name, item.formula, item.amount, item.initial || 0, item.balance || 0, item.isIncome ? 1 : 0,
                 usageTypeId, entityId, item.isRecurring ? 1 : 0, item.sortOrder,
                 item.id]
            );
        } else {
            db.run(`
                INSERT INTO items (name, formula, amount, initial, balance, is_income,
                                   usage_type_id, applicable_entity_id, is_recurring, sort_order)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [item.name, item.formula, item.amount, item.initial || 0, item.balance || 0, item.isIncome ? 1 : 0,
                 usageTypeId, entityId, item.isRecurring ? 1 : 0, item.sortOrder]
            );
        }
    }

    /**
     * Soft-deletes an item (sets is_active = 0).
     */
    function remove(id) {
        DatabaseService.getDB().run('UPDATE items SET is_active = 0 WHERE id = ?', [id]);
    }

    return { getByUsage, getDecreeItems, getPayslipItems, getById, save, remove, getAllCategories };
})();
