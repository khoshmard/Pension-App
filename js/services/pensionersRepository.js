/**
 * @file pensionerRepository.js
 * @description Data access layer for pensioner records. Provides full CRUD operations including soft-delete,
 *              automatically logs field changes into the changelog table, and returns
 *              person data as plain JavaScript objects.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.0
 * @history
 * 1.0.0 (2026-07-14) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 */

const PensionersRepository = (() => {
    /**
     * Retrieves all active pensioners with their personal details and the deceased person's information.
     * @returns {Array<Object>} Array of pensioner objects.
     */
    function getAll() {
        const db = DatabaseService.getDB();
        const res = db.exec(`
            SELECT
                p.id,
                p.person_id,
                per.national_code AS person_nc,
                per.id_number AS person_idnum,
                per.first_name AS person_fn,
                per.last_name AS person_ln,
                per.father_name AS person_father,
                per.birth_date AS person_bd,
                per.marriage_status AS person_married,
                per.children_count AS person_children,
                p.ledger_number,
                p.inheritance_code,
                p.deceased_id,
                dec.national_code AS deceased_nc,
                dec.first_name AS deceased_fn,
                dec.last_name AS deceased_ln,
                p.created_at
            FROM active_pensioners p
            JOIN active_persons per ON p.person_id = per.id
            JOIN active_persons dec ON p.deceased_id = dec.id
            ORDER BY per.last_name, per.first_name
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
            ledgerNumber: r[10],
            inheritanceCode: r[11],
            deceasedId: r[12],
            deceased: {
                nationalCode: r[13],
                firstName: r[14],
                lastName: r[15]
            },
            createdAt: r[16]
        }));
    }

    /**
     * Returns a single pensioner by ID, with joined person and deceased details.
     * @param {number} id - Pensioner ID.
     * @returns {Object|null}
     */
    function getById(id) {
        const db = DatabaseService.getDB();
        const res = db.exec(`
            SELECT
                p.id,
                p.person_id,
                per.national_code, per.id_number, per.first_name, per.last_name,
                per.father_name, per.birth_date, per.marriage_status, per.children_count,
                p.ledger_number, p.inheritance_code,
                p.deceased_id,
                dec.national_code, dec.first_name, dec.last_name,
                p.created_at
            FROM active_pensioners p
            JOIN active_persons per ON p.person_id = per.id
            JOIN active_persons dec ON p.deceased_id = dec.id
            WHERE p.id = ?
        `, [id]);
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        return {
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
            ledgerNumber: r[10],
            inheritanceCode: r[11],
            deceasedId: r[12],
            deceased: {
                nationalCode: r[13],
                firstName: r[14],
                lastName: r[15]
            },
            createdAt: r[16]
        };
    }

    /**
     * Creates a new pensioner record and logs the action.
     * @param {Object} pensioner - { personId, deceasedId, ledgerNumber, inheritanceCode }
     * @returns {number} Newly assigned ID.
     */
    function add(pensioner) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        db.run(`
            INSERT INTO pensioners (person_id, deceased_id, ledger_number, inheritance_code, created_at)
            VALUES (?,?,?,?,?)`,
            [pensioner.personId, pensioner.deceasedId, pensioner.ledgerNumber, pensioner.inheritanceCode, now]
        );
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        // Log creation
        db.run(`
            INSERT INTO pensioner_changelog (pensioner_id, action_type, changed_field, old_value, new_value, changed_at)
            VALUES (?,?,?,?,?,?)`,
            [newId, 'ایجاد', 'وظیفه‌بگیر جدید', '', '', now]
        );
        return newId;
    }

    /**
     * Updates an existing pensioner. Compares old and new values and logs any differences.
     * @param {number} id - Pensioner ID.
     * @param {Object} pensioner - Updated data (partial or full).
     */
    function update(id, pensioner) {
        const db = DatabaseService.getDB();
        const old = getById(id);
        if (!old) throw new Error('Pensioner not found');
        const now = new Date().toISOString();

        const fields = ['کد شخص', 'کد متوفی', 'شماره دفترکل', 'کد ورثه'];
        const newVals = [pensioner.personId, pensioner.deceasedId, pensioner.ledgerNumber, pensioner.inheritanceCode];
        const oldVals = [old.personId, old.deceasedId, old.ledgerNumber, old.inheritanceCode];

        for (let i = 0; i < fields.length; i++) {
            if (String(oldVals[i]) !== String(newVals[i])) {
                db.run(`
                    INSERT INTO pensioner_changelog (pensioner_id, action_type, changed_field, old_value, new_value, changed_at)
                    VALUES (?,?,?,?,?,?)`,
                    [id, 'اصلاح', fields[i], String(oldVals[i] || ''), String(newVals[i] || ''), now]
                );
            }
        }

        db.run(`
            UPDATE pensioners
            SET person_id = ?, deceased_id = ?, ledger_number = ?, inheritance_code = ?
            WHERE id = ?`,
            [pensioner.personId, pensioner.deceasedId, pensioner.ledgerNumber, pensioner.inheritanceCode, id]
        );
    }

    /**
     * Permanently deletes a pensioner
     * @param {number} id - Pensioner ID.
     */
    function remove(id) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        db.run('UPDATE pensioners SET is_active = 0 WHERE id = ?', [id]);
        db.run(`
            INSERT INTO pensioner_changelog (pensioner_id, action_type, changed_field, old_value, new_value, changed_at)
            VALUES (?,?,?,?,?,?)`,
            [id, 'حذف', 'وظیفه‌بگیر', '', '', now]
        );     
    }

    /**
     * Retrieves all changelog entries for a given pensioner.
     * @param {number} pensionerId
     * @returns {Array} [{ field, oldValue, newValue, changedAt, action_type }]
     */
    function getChangelog(pensionerId) {
        const db = DatabaseService.getDB();
        const res = db.exec(
            `SELECT action_type, changed_field, old_value, new_value, changed_at 
            FROM pensioner_changelog WHERE pensioner_id = ? 
            ORDER BY changed_at DESC`,
            [pensionerId]
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

    return { getAll, getById, add, update, remove, getChangelog };
})();