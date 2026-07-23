/**
 * @file payslipCalculator.js
 * @description Bulk calculation engine for monthly payslips.
 *              Generates payslips for all active persons based on their
 *              current decree and recurring payslip items.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.0
 * @history
 * 1.0.0 (2026-07-23) - payslip bulk calculation engine
 */

const PayslipCalculator = (() => {
    /**
     * Calculates and stores payslips for all active retirees and pensioners
     * for a given year and month. Skips persons who already have a payslip.
     *
     * @param {number} year - Calculation year (e.g. 1404)
     * @param {number} month - Calculation month (1-12)
     * @returns {Object} { created: number, skipped: number, errors: Array<string> }
     */
    function calculateAll(year, month) {
        const retirees = RetireesRepository.getAll();
        const pensioners = PensionersRepository.getAll();

        // Combine into a single list with personId and type
        const persons = [
            ...retirees.map(r => ({ personId: r.personId, type: 'retiree' })),
            ...pensioners.map(p => ({ personId: p.personId, type: 'pensioner' }))
        ];

        let created = 0;
        let skipped = 0;
        const errors = [];

        for (const person of persons) {
            try {
                // Check if payslip already exists
                const existing = PayslipRepository.findExisting(person.personId, year, month);
                if (existing) {
                    skipped++;
                    continue;
                }

                // Get active decree for this person
                const decree = DecreeRepository.getActiveDecreeWithItems(person.personId);
                if (!decree) {
                    // No active decree – skip (could also create with only payslip items, but we require decree)
                    errors.push(`شخص ${person.personId} حکم فعال ندارد`);
                    skipped++;
                    continue;
                }

                // Build payslip items from decree
                const payslipItems = decree.items.map(item => ({
                    name: item.name,
                    formula: item.formula,
                    amount: item.amount,
                    isIncome: item.isIncome,
                    source: PayslipRepository.SOURCE.DECREE,
                    referenceId: item.id               // ID from decree_items
                }));

                // Add recurring payslip items (from catalogue)
                const recurringPayslipItems = ItemsRepository.getPayslipItems()
                    .filter(it => it.isRecurring);
                for (const catItem of recurringPayslipItems) {
                    payslipItems.push({
                        name: catItem.name,
                        formula: catItem.formula,
                        amount: catItem.amount,         // default amount from catalogue
                        isIncome: catItem.isIncome,
                        source: PayslipRepository.SOURCE.PAYSLIP_ITEM,
                        referenceId: catItem.id          // ID from items
                    });
                }

                // Store payslip
                PayslipRepository.add({
                    personId: person.personId,
                    calcYear: year,
                    calcMonth: month,
                    decreeId: decree.id,
                    items: payslipItems
                });

                created++;
            } catch (e) {
                errors.push(`خطا برای شخص ${person.personId}: ${e.message}`);
                skipped++;
            }
        }

        // Persist after all calculations
        if (window._persist) window._persist();

        return { created, skipped, errors };
    }

    /**
     * Calculates (or recalculates) a payslip for a single person.
     * If a payslip already exists and is not confirmed, it will be deleted and re-created.
     *
     * @param {number} personId
     * @param {string} type - 'retiree' or 'pensioner'
     * @param {number} year
     * @param {number} month
     * @returns {Object} { success: boolean, message: string, payslipId?: number }
     */
    function calculateSingle(personId, type, year, month) {
        try {
            // Remove existing calculated payslip if any
            const existing = PayslipRepository.findExisting(personId, year, month);
            if (existing) {
                if (existing.status === PayslipRepository.STATUS.CONFIRMED) {
                    return { success: false, message: 'فیش قبلاً تأیید شده و قابل محاسبه مجدد نیست.' };
                }
                PayslipRepository.remove(existing.id);
            }

            const decree = DecreeRepository.getActiveDecreeWithItems(personId);
            if (!decree) {
                return { success: false, message: 'حکم فعال یافت نشد.' };
            }

            const payslipItems = decree.items.map(item => ({
                name: item.name,
                formula: item.formula,
                amount: item.amount,
                isIncome: item.isIncome,
                source: PayslipRepository.SOURCE.DECREE,
                referenceId: item.id
            }));

            const recurring = ItemsRepository.getPayslipItems().filter(it => it.isRecurring);
            for (const catItem of recurring) {
                payslipItems.push({
                    name: catItem.name,
                    formula: catItem.formula,
                    amount: catItem.amount,
                    isIncome: catItem.isIncome,
                    source: PayslipRepository.SOURCE.PAYSLIP_ITEM,
                    referenceId: catItem.id
                });
            }

            const newId = PayslipRepository.add({
                personId,
                calcYear: year,
                calcMonth: month,
                decreeId: decree.id,
                items: payslipItems
            });

            if (window._persist) window._persist();
            return { success: true, message: 'فیش با موفقیت محاسبه شد.', payslipId: newId };
        } catch (e) {
            return { success: false, message: `خطا: ${e.message}` };
        }
    }

    return { calculateAll, calculateSingle };
})();
