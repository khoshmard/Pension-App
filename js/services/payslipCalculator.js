/**
 * @file payslipCalculator.js
 * @description Bulk calculation engine for monthly payslips.
 *              Generates payslips for all active persons based on their
 *              current decree and recurring payslip items.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.1
 * @history
 * 1.0.1 (2026-07-23) - Calculating Arrears and Confirmation
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

                // Compute arrears if applicable
                const previousDecree = DecreeRepository.getPreviousDecreeWithItems(person.personId, decree.id);
                const arrearsItems = computeArrears(decree, previousDecree, person.personId, year, month);
                payslipItems.push(...arrearsItems);

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

            // Compute arrears if applicable
            const previousDecree = DecreeRepository.getPreviousDecreeWithItems(person.personId, decree.id);
            const arrearsItems = computeArrears(decree, previousDecree, person.personId, year, month);
            payslipItems.push(...arrearsItems);

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

    /**
     * Computes arrears items by comparing the current decree with the previous one,
     * and multiplying differences by the number of retroactive months.
     * @param {Object} currentDecree - Decree object with items (from getActiveDecreeWithItems)
     * @param {Object} previousDecree - Previous decree object, or null
     * @param {number} personId
     * @param {number} year - Current calculation year
     * @param {number} month - Current calculation month
     * @returns {Array} Array of payslip items to add as arrears (source=3)
     */
    function computeArrears(currentDecree, previousDecree, personId, year, month) {
        if (!previousDecree) return [];

        // Convert effective_from to comparable date: "YYYY-MM" -> year/month numbers
        const effParts = currentDecree.effectiveFrom.split('-'); // expect "YYYY-MM"
        if (effParts.length !== 2) return [];
        const effYear = parseInt(effParts[0]);
        const effMonth = parseInt(effParts[1]);
        // If effective date is in the future or same as calculation month, no arrears
        if (effYear > year || (effYear === year && effMonth >= month)) return [];

        // Number of retroactive months = difference between calc month and effective month
        let retroMonths = (year - effYear) * 12 + (month - effMonth);
        if (retroMonths <= 0) return [];

        // Build maps from item name (or definition id) to amount for both decrees
        const newItemsMap = {};
        currentDecree.items.forEach(item => {
            // Use item_definition_id if available, else fallback to name
            const key = item.itemDefinitionId || item.name;
            newItemsMap[key] = item;
        });
        const oldItemsMap = {};
        previousDecree.items.forEach(item => {
            const key = item.itemDefinitionId || item.name;
            oldItemsMap[key] = item;
        });

        const arrearsItems = [];
        // For each item in the new decree, find its counterpart in the old decree
        for (const [key, newItem] of Object.entries(newItemsMap)) {
            const oldItem = oldItemsMap[key];
            if (oldItem) {
                const diff = newItem.amount - oldItem.amount;
                if (diff !== 0) {
                    arrearsItems.push({
                        name: `معوقه ${newItem.name}`,
                        formula: newItem.formula,
                        amount: diff * retroMonths,
                        isIncome: newItem.isIncome,
                        source: PayslipRepository.SOURCE.ARREARS,
                        referenceId: newItem.id   // reference to the decree_item
                    });
                }
            } else {
                // New item that didn't exist in old decree -> full amount * retroMonths
                arrearsItems.push({
                    name: `معوقه ${newItem.name}`,
                    formula: newItem.formula,
                    amount: newItem.amount * retroMonths,
                    isIncome: newItem.isIncome,
                    source: PayslipRepository.SOURCE.ARREARS,
                    referenceId: newItem.id
                });
            }
        }
        // Also handle items that existed in old decree but removed in new (negative arrears)
        for (const [key, oldItem] of Object.entries(oldItemsMap)) {
            if (!newItemsMap[key]) {
                arrearsItems.push({
                    name: `معوقه حذف ${oldItem.name}`,
                    formula: oldItem.formula,
                    amount: -oldItem.amount * retroMonths,
                    isIncome: oldItem.isIncome,
                    source: PayslipRepository.SOURCE.ARREARS,
                    referenceId: oldItem.id
                });
            }
        }
        return arrearsItems;
    }

    return { calculateAll, calculateSingle };
})();
