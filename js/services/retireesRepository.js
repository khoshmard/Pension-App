/**
 * @file retireesRepository.js
 * @description Data access layer for retiree records. Provides full CRUD operations,
 *              automatically logs field changes into the changelog table, and returns
 *              retiree data as plain JavaScript objects.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

/* IIFE module with retiree operations. */
const RetireesRepository = (() => {
    /**
     * Returns an array of all active retirees, ordered by last name and first name.
     * @returns {Array<Object>} Retiree objects.
     */
    function getAll() {
        const res = DatabaseService.getDB().exec('SELECT id, national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type, children_count, has_spouse FROM retirees WHERE is_active=1 ORDER BY last_name, first_name');
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0], nationalCode: r[1], firstName: r[2], lastName: r[3], fatherName: r[4],
            birthDate: r[5], retirementDate: r[6], serviceYears: r[7], avgSalary: r[8],
            retireeType: r[9], childrenCount: r[10], hasSpouse: r[11]
        }));
    }

    /**
     * Retrieves a single retiree by primary key, or null if not found.
     * @param {number} id - Retiree ID.
     * @returns {Object|null}
     */
    function getById(id) {
        const res = DatabaseService.getDB().exec('SELECT id, national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type, children_count, has_spouse FROM retirees WHERE id=?', [id]);
        if (!res.length || !res[0].values.length) return null;
        const r = res[0].values[0];
        return {
            id: r[0], nationalCode: r[1], firstName: r[2], lastName: r[3], fatherName: r[4],
            birthDate: r[5], retirementDate: r[6], serviceYears: r[7], avgSalary: r[8],
            retireeType: r[9], childrenCount: r[10], hasSpouse: r[11]
        };
    }

    /**
     * Inserts a new retiree record and logs the creation event in the changelog.
     * @param {Object} retiree - Retiree data (without id).
     * @returns {number} The newly assigned id.
     */
    function add(retiree) {
        const db = DatabaseService.getDB();
        db.run(`INSERT INTO retirees (national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type, children_count, has_spouse) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [retiree.nationalCode, retiree.firstName, retiree.lastName, retiree.fatherName, retiree.birthDate, retiree.retirementDate, retiree.serviceYears, retiree.avgSalary, retiree.retireeType, retiree.childrenCount, retiree.hasSpouse]);
        const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run('INSERT INTO retiree_changelog (retiree_id, changed_field, old_value, new_value) VALUES (?,?,?,?)', [id, 'created', '', 'جدید']);
        return id;
    }

    /**
     * Updates an existing retiree. Compares old and new values for each field
     * and writes any differences to the changelog table.
     * @param {number} id - Retiree ID to update.
     * @param {Object} retiree - New data for the retiree.
     */
    function update(id, retiree) {
        const db = DatabaseService.getDB();
        const old = getById(id);
        if (!old) throw new Error('Retiree not found');
        const fields = ['firstName','lastName','fatherName','birthDate','retirementDate','serviceYears','avgSalary','retireeType','childrenCount','hasSpouse'];
        const newVals = [retiree.firstName, retiree.lastName, retiree.fatherName, retiree.birthDate, retiree.retirementDate, retiree.serviceYears, retiree.avgSalary, retiree.retireeType, retiree.childrenCount, retiree.hasSpouse];
        const oldVals = [old.firstName, old.lastName, old.fatherName, old.birthDate, old.retirementDate, old.serviceYears, old.avgSalary, old.retireeType, old.childrenCount, old.hasSpouse];
        for (let i = 0; i < fields.length; i++) {
            if (String(oldVals[i]) !== String(newVals[i])) {
                db.run('INSERT INTO retiree_changelog (retiree_id, changed_field, old_value, new_value) VALUES (?,?,?,?)', [id, fields[i], String(oldVals[i]||''), String(newVals[i]||'')]);
            }
        }
        db.run('UPDATE retirees SET first_name=?, last_name=?, father_name=?, birth_date=?, retirement_date=?, service_years=?, avg_salary=?, retiree_type=?, children_count=?, has_spouse=? WHERE id=?',
            [retiree.firstName, retiree.lastName, retiree.fatherName, retiree.birthDate, retiree.retirementDate, retiree.serviceYears, retiree.avgSalary, retiree.retireeType, retiree.childrenCount, retiree.hasSpouse, id]);
    }

    /**
     * Permanently deletes a retiree and all associated records (salaries,
     * payments, changelog).
     * @param {number} id - Retiree ID.
     */
    function remove(id) {
        const db = DatabaseService.getDB();
        db.run('DELETE FROM salary_records WHERE retiree_id=?', [id]);
        db.run('DELETE FROM payments WHERE retiree_id=?', [id]);
        db.run('DELETE FROM retiree_changelog WHERE retiree_id=?', [id]);
        db.run('DELETE FROM retirees WHERE id=?', [id]);
    }
    return { getAll, getById, add, update, remove };
})();
