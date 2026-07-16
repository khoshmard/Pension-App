/**
 * @file personsRepository.js
 * @description Data access layer for person records. Provides full CRUD operations including soft-delete,
 *              automatically logs field changes into the changelog table, and returns
 *              person data as plain JavaScript objects.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.0
 * @history
 * 1.0.0 (2026-07-14) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 */

const PersonsRepository = (() => {
    /**
     * Returns an array of all active persons, ordered by last name and first name.
     * @returns {Array<Object>} Person objects.
     */
    function getAll() {
        const res = DatabaseService.getDB().exec(
            'SELECT * FROM active_persons ORDER BY last_name, first_name'
        );
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0], nationalCode: r[1], idNumber: r[2], firstName: r[3],
            lastName: r[4], fatherName: r[5], birthDate: r[6],
            marriageStatus: r[7], childrenCount: r[8], createdAt: r[9]
        }));
    }

    /**
     * Retrieves a single person by primary key, or null if not found.
     * @param {number} id - Person ID.
     * @returns {Object|null}
     */
    function getById(id) {
        const res = DatabaseService.getDB().exec(
            'SELECT * FROM active_persons WHERE id=?', [id]
        );
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        return {
            id: r[0], nationalCode: r[1], idNumber: r[2], firstName: r[3],
            lastName: r[4], fatherName: r[5], birthDate: r[6],
            marriageStatus: r[7], childrenCount: r[8], createdAt: r[9]
        };
    }

    /**
     * Inserts a new person record and logs the creation event in the changelog.
     * @param {Object} person - Person data (without id).
     * @returns {number} The newly assigned id.
     */
    function add(person) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        db.run(`INSERT INTO persons (national_code, id_number, first_name, last_name, father_name, birth_date, marriage_status, children_count, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`,
            [person.nationalCode, person.idNumber, person.firstName, person.lastName,
             person.fatherName, person.birthDate, person.marriageStatus, person.childrenCount, now]);
        const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run('INSERT INTO person_changelog (person_id, action_type, changed_field, old_value, new_value, changed_at) VALUES (?,?,?,?,?,?)',
            [id, 'ایجاد', 'شخص جدید', '', '', now]);
        return id;
    }

    /**
     * Updates an existing person. Compares old and new values for each field
     * and writes any differences to the changelog table.
     * @param {number} id - Person ID to update.
     * @param {Object} person - New data for the person.
     */
    function update(id, person) {
        const db = DatabaseService.getDB();
        const old = getById(id);
        if (!old) throw new Error('Person not found');
        const now = new Date().toISOString();

        const fields = ['کد ملی', 'شماره شناسنامه', 'نام', 'نام خانوادگی', 'نام پدر', 'تاریخ تولد', 'وضعیت تأهل', 'تعداد فرزند'];
        const newVals = [person.nationalCode, person.idNumber, person.firstName, person.lastName,
            person.fatherName, person.birthDate, person.marriageStatus, person.childrenCount];
        const oldVals = [old.nationalCode, old.idNumber, old.firstName, old.lastName,
            old.fatherName, old.birthDate, old.marriageStatus, old.childrenCount];

        for (let i = 0; i < fields.length; i++) {
            if (String(oldVals[i]) !== String(newVals[i])) {
                db.run(`
                    INSERT INTO person_changelog (person_id, action_type, changed_field, old_value, new_value, changed_at)
                    VALUES (?,?,?,?,?,?)`,
                    [id, 'اصلاح', fields[i], String(oldVals[i] || ''), String(newVals[i] || ''), now]
                );
            }
        }

        db.run(`UPDATE persons SET national_code=?, id_number=?, first_name=?, last_name=?, father_name=?, birth_date=?, marriage_status=?, children_count=? WHERE id=?`,
            [person.nationalCode, person.idNumber, person.firstName, person.lastName,
             person.fatherName, person.birthDate, person.marriageStatus, person.childrenCount, id]);
    }

    /**
     * Permanently deletes a person
     * @param {number} id - Person ID.
     */
    function remove(id) {
        const db = DatabaseService.getDB();
        const now = new Date().toISOString();
        try {
            db.run('UPDATE persons SET is_active=0 WHERE id=?', [id]);
        } catch {
            throw new Error('این شخص در اطلاعات دیگری استفاده شده و قابل حذف شدن نیست.');
            return;
        }
        db.run('INSERT INTO person_changelog (person_id, action_type, changed_field, old_value, new_value, changed_at) VALUES (?,?,?,?,?,?)',
            [id, 'حذف', 'شخص', '', '', now]);       
    }

    function searchByNameOrCode(query) {
        const db = DatabaseService.getDB();
        const res = db.exec(
            `SELECT id, national_code, first_name, last_name FROM active_persons
             WHERE national_code LIKE ? OR first_name LIKE ? OR last_name LIKE ?
             ORDER BY last_name LIMIT 10`,
            [`%${query}%`, `%${query}%`, `%${query}%`]
        );
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ id: r[0], nationalCode: r[1], fullName: r[2]+' '+r[3] }));
    }

    /**
     * Retrieves all changelog entries for a given person.
     * @param {number} personId
     * @returns {Array} [{ field, oldValue, newValue, changedAt, action_type }]
     */
    function getChangelog(personId) {
        const db = DatabaseService.getDB();
        const res = db.exec(
            `SELECT action_type, changed_field, old_value, new_value, changed_at 
            FROM person_changelog WHERE person_id = ? 
            ORDER BY changed_at DESC`,
            [personId]
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

    return { getAll, getById, add, update, remove, searchByNameOrCode, getChangelog };
})();
