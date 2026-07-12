/**
 * @file paymentsRepository.js
 * @description Data access for payment (pension calculation) records. Payments store
 *              the detailed income and deduction breakdown as JSON, along with
 *              aggregated totals.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const PaymentsRepository = (() => {
    /**
     * Returns the latest 100 payment records, with income/deduction arrays parsed
     * from JSON.
     * @returns {Array<Object>} Payment records including incomes[] and deductions[].
     */
    function getAll() {
        const res = DatabaseService.getDB().exec(`
            SELECT p.id, r.first_name, r.last_name, r.national_code, p.calc_year, p.calc_month,
                   p.income_json, p.deduction_json, p.gross_amount, p.total_deductions, p.net_amount, p.created_at
            FROM payments p JOIN retirees r ON p.retiree_id = r.id ORDER BY p.id DESC LIMIT 100`);
        if (!res.length || !res[0].values.length) return [];
        return res[0].values.map(r => ({
            id: r[0], firstName: r[1], lastName: r[2], nationalCode: r[3],
            calcYear: r[4], calcMonth: r[5],
            incomes: JSON.parse(r[6] || '[]'), deductions: JSON.parse(r[7] || '[]'),
            grossAmount: r[8], totalDeductions: r[9], netAmount: r[10], createdAt: r[11]
        }));
    }

    /**
     * Inserts a new payment record. Incomes and deductions are stringified to JSON.
     * @param {Object} payment - Contains retireeId, year, month, incomes[], deductions[],
     *                           grossAmount, totalDeductions, netAmount, childrenCount,
     *                           hasSpouse, notes.
     */
    function add(payment) {
        DatabaseService.getDB().run(`INSERT INTO payments (retiree_id, calc_year, calc_month, income_json, deduction_json, gross_amount, total_deductions, net_amount, children_count, has_spouse, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [payment.retireeId, payment.calcYear, payment.calcMonth, JSON.stringify(payment.incomes), JSON.stringify(payment.deductions),
             payment.grossAmount, payment.totalDeductions, payment.netAmount, payment.childrenCount, payment.hasSpouse, payment.notes || '']);
    }

    return { getAll, add };
})();
