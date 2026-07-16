/**
 * @file retireesRepository.js
 * @description Data access layer for retiree records. Provides full CRUD operations,
 *              automatically logs field changes into the changelog table, and returns
 *              retiree data as plain JavaScript objects.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.1
 * @history
 * 1.0.1 (2026-07-15) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular
 */

const RetireesRepository = (() => {

    /**
     * Retrieves all active retirees with their personal details (joined from persons).
     * @returns {Array<Object>} Array of retiree objects.
     */
    function getAll() {
        const db = DatabaseService.getDB();
        const res = db.exec(`
            SELECT
                r.id,
                r.person_id,
                p.national_code AS person_nc,
                p.id_number AS person_idnum,
                p.first_name AS person_fn,
                p.last_name AS person_ln,
                p.father_name AS person_father,
                p.birth_date AS person_bd,
                p.marriage_status AS person_married,
                p.children_count AS person_children,
                r.personnel_code,
                r.retirement_date,
                r.ledger_number,
                r.veteran_status,
                r.created_at
            FROM active_retirees r
            JOIN active_persons p ON r.person_id = p.id
            ORDER BY p.last_name, p.first_name
        `);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0],
            personId: r[1],
            person: {
                nationalCode: r[2],
                idNumber: r[3],
                firstName: r[4],
                lastName: r[5],
                fatherName: r[6],
                birthDate: r[7],
                marriageStatus: r[8],
                childrenCount: r[9]
            },
            personnelCode: r[10],
            retirementDate: r[11],
            ledgerNumber: r[12],
            veteranStatus: r[13],
            createdAt: r[14]
        }));
    }

    /**
     * Returns a single active retiree by ID, including personal details and dependents.
     * @param {number} id - Retiree ID.
     * @returns {Object|null}
     */
    function getById(id) {
        const db = DatabaseService.getDB();
        const res = db.exec(`
            SELECT
                r.id,
                r.person_id,
                p.national_code, p.id_number, p.first_name, p.last_name,
                p.father_name, p.birth_date, p.marriage_status, p.children_count,
                r.personnel_code, r.retirement_date, r.ledger_number, r.veteran_status,
                r.created_at
            FROM active_retirees r
            JOIN active_persons p ON r.person_id = p.id
            WHERE r.id = ?
        `, [id]);
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        const retiree = {
            id: r[0],
            personId: r[1],
            person: {
                nationalCode: r[2],
                idNumber: r[3],
                firstName: r[4],
                lastName: r[5],
                fatherName: r[6],
                birthDate: r[7],
                marriageStatus: r[8],
                childrenCount: r[9]
            },
            personnelCode: r[10],
            retirementDate: r[11],
            ledgerNumber: r[12],
            veteranStatus: r[13],
            createdAt: r[14],
            dependents: getDependents(id)     // attach dependents
        };
        return retiree;
    }

    /**
     * Creates a new retiree record along with its dependents, and logs the action.
     * @param {Object} retiree - { personId, personnelCode, retirementDate, ledgerNumber, veteranStatus, dependents }
     *   dependents is an array of { personId, dependentType }.
     * @returns {number} Newly assigned retiree ID.
     */
    function add(retiree) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();

        // Insert retiree
        db.run(`
            INSERT INTO retirees (person_id, personnel_code, retirement_date, ledger_number, veteran_status, created_at)
            VALUES (?,?,?,?,?,?)`,
            [retiree.personId, retiree.personnelCode, retiree.retirementDate,
             retiree.ledgerNumber, retiree.veteranStatus, now]
        );
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

        // Insert dependents
        if (retiree.dependents && retiree.dependents.length) {
            retiree.dependents.forEach(dep => {
                db.run(`
                    INSERT INTO dependents (person_id, retiree_id, dependent_type)
                    VALUES (?,?,?)`,
                    [dep.personId, newId, dep.dependentType]
                );
            });
        }

        // Log creation
        db.run(`
            INSERT INTO retiree_changelog (retiree_id, action_type, changed_field, old_value, new_value, changed_at)
            VALUES (?,?,?,?,?,?)`,
            [newId, 'ایجاد', 'مستمری‌بگیر جدید', '', '', now]
        );

        return newId;
    }

    /**
     * Updates an existing retiree. Compares old and new values, logs changes,
     * and replaces the dependent list.
     * @param {number} id - Retiree ID.
     * @param {Object} retiree - Updated data (all fields).
     */
    function update(id, retiree) {
        const db = DatabaseService.getDB();
        const old = getById(id);
        if (!old) throw new Error('Retiree not found');
        const now = new Date().toISOString();

        // Compare and log main fields
        const fields = ['کد شخص', 'کد پرسنلی', 'تاریخ بازنشستگی', 'دفتر کل', 'ایثارگری'];
        const newVals = [retiree.personId, retiree.personnelCode, retiree.retirementDate,
                         retiree.ledgerNumber, retiree.veteranStatus];
        const oldVals = [old.personId, old.personnelCode, old.retirementDate,
                         old.ledgerNumber, old.veteranStatus];
        for (let i = 0; i < fields.length; i++) {
            if (String(oldVals[i]) !== String(newVals[i])) {
                db.run(`
                    INSERT INTO retiree_changelog (retiree_id, action_type, changed_field, old_value, new_value, changed_at)
                    VALUES (?,?,?,?,?,?)`,
                    [id, 'اصلاح', fields[i], String(oldVals[i] || ''), String(newVals[i] || ''), now]
                );
            }
        }

        // Update the retiree record
        db.run(`
            UPDATE retirees
            SET person_id = ?, personnel_code = ?, retirement_date = ?,
                ledger_number = ?, veteran_status = ?
            WHERE id = ?`,
            [retiree.personId, retiree.personnelCode, retiree.retirementDate,
             retiree.ledgerNumber, retiree.veteranStatus, id]
        );

        // Replace dependents: delete existing, insert new
        db.run('DELETE FROM dependents WHERE retiree_id = ?', [id]);
        if (retiree.dependents && retiree.dependents.length) {
            retiree.dependents.forEach(dep => {
                db.run(`
                    INSERT INTO dependents (person_id, retiree_id, dependent_type)
                    VALUES (?,?,?)`,
                    [dep.personId, id, dep.dependentType]
                );
            });
        }

        // to do: Log dependents change
    }

    /**
     * Permanently deletes a retiree
     * @param {number} id - Retiree ID.
     */
    function remove(id) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        db.run('UPDATE retirees SET is_active = 0 WHERE id = ?', [id]);
        db.run(`
            INSERT INTO retiree_changelog (retiree_id, action_type, changed_field, old_value, new_value, changed_at)
            VALUES (?,?,?,?,?,?)`,
            [id, 'حذف', 'مستمری‌بگیر', '', '', now]
        );
    }

    /**
     * Retrieves all changelog entries for a given retiree.
     * @param {number} retireeId
     * @returns {Array} [{ field, oldValue, newValue, changedAt, action_type }]
     */
    function getChangelog(retireeId) {
        const db = DatabaseService.getDB();
        const res = db.exec(
            `SELECT action_type, changed_field, old_value, new_value, changed_at 
            FROM retiree_changelog WHERE retiree_id = ? 
            ORDER BY changed_at DESC`,
            [retireeId]
        );
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            actionType: r[0],
            field: r[1],
            oldValue: r[2],
            newValue: r[3],
            changedAt: r[4]
        }));
    }

    /**
     * Retrieves all dependents for a given retiree, with their personal details.
     * @param {number} retireeId - Retiree ID.
     * @returns {Array<Object>} Array of dependent objects.
     */
    function getDependents(retireeId) {
        const db = DatabaseService.getDB();
        const res = db.exec(`
            SELECT d.id, d.person_id, d.dependent_type,
                   p.national_code, p.first_name, p.last_name
            FROM dependents d
            JOIN active_persons p ON d.person_id = p.id
            WHERE d.retiree_id = ?
            ORDER BY d.id
        `, [retireeId]);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0],
            personId: r[1],
            dependentType: r[2],
            person: {
                nationalCode: r[3],
                firstName: r[4],
                lastName: r[5]
            }
        }));
    }

    /**
     * Adds a single dependent to a retiree.
     * @param {number} retireeId
     * @param {Object} dependent - { personId, dependentType }
     */
    function addDependent(retireeId, dependent) {
        const db = DatabaseService.getDB();
        db.run(`
            INSERT INTO dependents (person_id, retiree_id, dependent_type)
            VALUES (?,?,?)`,
            [dependent.personId, retireeId, dependent.dependentType]
        );
    }

    /**
     * Removes a dependent by ID.
     * @param {number} dependentId - Dependents table primary key.
     */
    function removeDependent(dependentId) {
        const db = DatabaseService.getDB();
        db.run('DELETE FROM dependents WHERE id = ?', [dependentId]);
    }

    return { getAll, getById, add, update, remove, getChangelog, getDependents, addDependent, removeDependent };
})();
