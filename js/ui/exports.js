/**
 * @file exports.js
 * @description Handles all data export/import: CSV downloads for lists and reports,
 *              binary database file download/upload, and full JSON export.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const Exports = (() => {

    /**
     * Triggers a file download in the browser.
     * @param {string} content - File content.
     * @param {string} filename - Suggested filename.
     * @param {string} mimeType - MIME type of the content.
     */
    function downloadBlob(content, filename, mimeType = 'text/csv;charset=utf-8;') {
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Exports the list of active retirees as a CSV file.
     */
    function retireesCSV() {
        const retirees = RetireesRepository.getAll();
        let csv = 'کد ملی,نام,نام خانوادگی,نام پدر,تاریخ تولد,تاریخ بازنشستگی,سال خدمت,متوسط حقوق,نوع\n';
        csv += retirees.map(r => `${r.nationalCode},${r.firstName},${r.lastName},${r.fatherName},${r.birthDate},${r.retirementDate},${r.serviceYears},${r.avgSalary},${r.retireeType}`).join('\n');
        downloadBlob(csv, 'retirees.csv');
        EventHandlers.showToast('✅ لیست بازنشستگان ذخیره شد', 'success');
    }

    /**
     * Exports all payment records as CSV.
     */
    function paymentsCSV() {
        const payments = PaymentsRepository.getAll();
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        let csv = 'کد ملی,نام,نام خانوادگی,سال,ماه,درآمدها,کسورات,ناخالص,جمع کسورات,خالص,تاریخ\n';
        csv += payments.map(p => {
            const inc = p.incomes.map(i => `${i.name}:${i.amount}`).join('|');
            const ded = p.deductions.map(d => `${d.name}:${d.amount}`).join('|');
            return `${p.nationalCode},${p.firstName},${p.lastName},${p.calcYear},${monthNames[p.calcMonth] || p.calcMonth},"${inc}","${ded}",${p.grossAmount},${p.totalDeductions},${p.netAmount},${p.createdAt?.slice(0, 10) || ''}`;
        }).join('\n');
        downloadBlob(csv, 'payments.csv');
        EventHandlers.showToast('✅ پرداخت‌ها ذخیره شد', 'success');
    }

    /**
     * Exports salary records as CSV.
     */
    function salariesCSV() {
        const records = SalaryRepository.getAll();
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        let csv = 'نام,سال,ماه,حقوق پایه,فوق‌العاده,جمع\n';
        csv += records.map(r => `${r.retireeName},${r.year},${monthNames[r.month] || r.month},${r.baseSalary},${r.allowances},${r.total}`).join('\n');
        downloadBlob(csv, 'salaries.csv');
        EventHandlers.showToast('✅ سوابق حقوق ذخیره شد', 'success');
    }

    /**
     * Exports a full summary report (per retiree total paid) as CSV.
     */
    function fullReportCSV() {
        const retirees = RetireesRepository.getAll();
        const payments = PaymentsRepository.getAll();
        let csv = 'کد ملی,نام,نام خانوادگی,سال خدمت,متوسط حقوق,جمع پرداختی,تعداد پرداخت\n';
        retirees.forEach(r => {
            const rp = payments.filter(p => p.nationalCode === r.nationalCode);
            const total = rp.reduce((sum, p) => sum + p.netAmount, 0);
            csv += `${r.nationalCode},${r.firstName},${r.lastName},${r.serviceYears},${r.avgSalary},${total},${rp.length}\n`;
        });
        downloadBlob(csv, 'full_report.csv');
        EventHandlers.showToast('✅ گزارش جامع ذخیره شد', 'success');
    }

    /**
     * Exports the current calculation result as CSV.
     * @param {Object} calcResult - The calculation object from EventHandlers.
     */
    function calcCSV(calcResult) {
        if (!calcResult) return EventHandlers.showToast('❌ ابتدا محاسبه انجام دهید', 'error');
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        let csv = 'کد ملی,نام,سال,ماه,';
        const incNames = calcResult.incomes.map(i => i.name);
        csv += incNames.join(',') + ',ناخالص,';
        const dedNames = calcResult.deductions.map(d => d.name);
        csv += dedNames.join(',') + ',جمع کسورات,خالص\n';
        const row = [
            calcResult.nationalCode,
            calcResult.retireeName,
            calcResult.calcYear,
            monthNames[calcResult.calcMonth],
            ...calcResult.incomes.map(i => i.amount),
            calcResult.grossAmount,
            ...calcResult.deductions.map(d => d.amount),
            calcResult.totalDeductions,
            calcResult.netAmount
        ].join(',');
        csv += row;
        downloadBlob(csv, `calc_${calcResult.nationalCode}_${calcResult.calcYear}${calcResult.calcMonth}.csv`);
        EventHandlers.showToast('✅ محاسبه ذخیره شد', 'success');
    }

    /**
     * Downloads the entire SQLite database as a .db file.
     */
    function dbFile() {
        const data = DatabaseService.exportDB();
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pension_backup_${new Date().toISOString().slice(0, 10)}.db`;
        a.click();
        URL.revokeObjectURL(url);
        EventHandlers.showToast('✅ پایگاه داده ذخیره شد', 'success');
    }

    /**
     * Imports a .db file and replaces the current database.
     * @param {File} file - File object from the file input.
     */
    function importDBFile(file) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                DatabaseService.importDB(e.target.result);
                // Re-persist to IndexedDB
                if (window._persist) window._persist();
                UIManager.refreshAll();
                EventHandlers.showToast('✅ پایگاه داده با موفقیت بارگذاری شد', 'success');
            } catch (err) {
                EventHandlers.showToast('❌ خطا در بارگذاری: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Exports all application data (retirees, salaries, payments, items, settings)
     * as a single JSON file.
     */
    function jsonExport() {
        const data = {
            retirees: RetireesRepository.getAll(),
            salaries: SalaryRepository.getAll(),
            payments: PaymentsRepository.getAll(),
            incomeItems: ItemsRepository.getIncomes(),
            deductionItems: ItemsRepository.getDeductions(),
            settings: SettingsService.get()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pension_data_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        EventHandlers.showToast('✅ خروجی JSON ذخیره شد', 'success');
    }

    return { retireesCSV, paymentsCSV, salariesCSV, fullReportCSV, calcCSV, dbFile, importDBFile, jsonExport };
})();
