/**
 * @file changelogRepository.js
 * @description Data access for the retiree changelog (audit trail). Retrieves
 *              historical change records for a specific retiree.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const ChangelogRepository = (() => {
    /**
     * Fetches all changelog entries for a given retiree, ordered by change time
     * descending (most recent first).
     * @param {number} retireeId - The retiree's ID.
     * @returns {Array<Object>} Array of log entries {field, oldValue, newValue, changedAt}.
     */
    function getByRetireeId(retireeId) {
        const res = DatabaseService.getDB().exec('SELECT changed_field, old_value, new_value, changed_at FROM retiree_changelog WHERE retiree_id=? ORDER BY changed_at DESC', [retireeId]);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({ field: r[0], oldValue: r[1], newValue: r[2], changedAt: r[3] }));
    }

    return { getByRetireeId };
})();
