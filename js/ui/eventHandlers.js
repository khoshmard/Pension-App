/**
 * @file eventHandlers.js
 * @description Central event‑handling module. Binds all UI interactions, coordinates
 *              between repositories, calculation engine, and templates. Contains
 *              the core application behaviour functions.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const EventHandlers = (() => {
    // Holds the most recent calculation result for saving / export
    let currentCalcResult = null;

    // ----------------------------------------------------------------
    // Utility
    // ----------------------------------------------------------------
    /**
     * Displays a temporary toast notification.
     * @param {string} message - The text to show.
     * @param {string} type - 'success', 'error', or empty string.
     */
    function showToast(message, type = '') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 2800);
    }

    /**
     * Populates all retiree‑selection dropdowns with current data.
     */
    function populateDropdowns() {
        const retirees = RetireesRepository.getAll();
        const options = '<option value="">-- انتخاب --</option>' +
            retirees.map(r => `<option value="${r.id}">${r.lastName} ${r.firstName} (${r.nationalCode})</option>`).join('');
        const salaryFilter = document.getElementById('salaryRetireeFilter');
        const calcSelect = document.getElementById('calcRetireeSelect');
        if (salaryFilter) salaryFilter.innerHTML = options;
        if (calcSelect) calcSelect.innerHTML = options;
    }

    // ----------------------------------------------------------------
    // Dashboard
    // ----------------------------------------------------------------
    /**
     * Refreshes the dashboard statistics and recent calculations table.
     */
    function refreshDashboard() {
        const totalRetirees = RetireesRepository.getAll().length;
        const payments = PaymentsRepository.getAll();
        const totalPayments = payments.length;
        const totalNet = payments.reduce((sum, p) => sum + p.netAmount, 0);
        const avgPension = totalPayments ? totalNet / totalPayments : 0;

        document.getElementById('dashboardStats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${totalRetirees.toLocaleString('fa-IR')}</div><div class="stat-label">بازنشستگان</div></div>
            <div class="stat-card accent"><div class="stat-value">${totalPayments.toLocaleString('fa-IR')}</div><div class="stat-label">پرداخت‌ها</div></div>
            <div class="stat-card warning"><div class="stat-value">${Math.round(totalNet).toLocaleString('fa-IR')}</div><div class="stat-label">مجموع خالص</div></div>
            <div class="stat-card"><div class="stat-value">${Math.round(avgPension).toLocaleString('fa-IR')}</div><div class="stat-label">میانگین حقوق</div></div>`;

        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        const recent = payments.slice(0, 10);
        const tbody = document.getElementById('dashboardRecentCalcs');
        if (recent.length) {
            tbody.innerHTML = recent.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.firstName} ${p.lastName}</td>
                    <td>${p.nationalCode}</td>
                    <td>${p.calcYear}/${monthNames[p.calcMonth] || p.calcMonth}</td>
                    <td class="amount-cell">${p.netAmount.toLocaleString('fa-IR')}</td>
                    <td style="color:#27ae60;">✅ ثبت شده</td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">محاسبه‌ای ثبت نشده</td></tr>';
        }
    }

    // ----------------------------------------------------------------
    // Retirees
    // ----------------------------------------------------------------
    /**
     * Loads the list of active retirees and renders them in the table.
     */
    function loadRetirees() {
        const retirees = RetireesRepository.getAll();
        const tbody = document.getElementById('retireesTableBody');
        if (retirees.length) {
            tbody.innerHTML = retirees.map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.nationalCode}</td>
                    <td>${r.firstName}</td>
                    <td>${r.lastName}</td>
                    <td>${r.fatherName || '-'}</td>
                    <td>${r.birthDate || '-'}</td>
                    <td>${r.retirementDate || '-'}</td>
                    <td>${r.serviceYears}</td>
                    <td class="amount-cell">${Math.round(r.avgSalary).toLocaleString('fa-IR')}</td>
                    <td>${r.retireeType === 'main' ? 'بازنشسته' : 'مستمری‌بگیر'}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm edit-retiree" data-id="${r.id}">✏️</button>
                        <button class="btn btn-outline btn-sm history-retiree" data-id="${r.id}">📜</button>
                        <button class="btn btn-danger btn-sm delete-retiree" data-id="${r.id}">🗑️</button>
                    </td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state">هیچ بازنشسته‌ای ثبت نشده</td></tr>';
        }
    }

    /**
     * Shows the retiree add/edit form.
     * @param {number|null} editId - ID of the retiree to edit, or null for new.
     */
    function showRetireeForm(editId = null) {
        let data = null;
        if (editId) data = RetireesRepository.getById(parseInt(editId));
        const container = document.getElementById('retireeFormContainer');
        container.innerHTML = Templates.retireeForm(data);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        // Attach save / cancel listeners
        document.getElementById('btnSaveRetiree').addEventListener('click', function () {
            const id = this.dataset.editId ? parseInt(this.dataset.editId) : null;
            saveRetiree(id);
        });
        document.getElementById('btnCancelRetiree').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    /**
     * Saves a retiree (add or update) using data from the form.
     * @param {number|null} editId
     */
    function saveRetiree(editId) {
        const data = {
            nationalCode: document.getElementById('rf_national_code').value.trim(),
            firstName: document.getElementById('rf_first_name').value.trim(),
            lastName: document.getElementById('rf_last_name').value.trim(),
            fatherName: document.getElementById('rf_father_name').value.trim(),
            birthDate: document.getElementById('rf_birth_date').value.trim(),
            retirementDate: document.getElementById('rf_retirement_date').value.trim(),
            serviceYears: parseFloat(document.getElementById('rf_service_years').value) || 0,
            avgSalary: parseFloat(document.getElementById('rf_avg_salary').value) || 0,
            retireeType: document.getElementById('rf_type').value,
            childrenCount: parseInt(document.getElementById('rf_children').value) || 0,
            hasSpouse: parseInt(document.getElementById('rf_spouse').value) || 0
        };
        if (!data.nationalCode || !data.firstName || !data.lastName) {
            return showToast('❌ فیلدهای ضروری را پر کنید', 'error');
        }
        try {
            if (editId) {
                RetireesRepository.update(editId, data);
            } else {
                RetireesRepository.add(data);
            }
            if (window._persist) window._persist();
            document.getElementById('retireeFormContainer').style.display = 'none';
            document.getElementById('retireeFormContainer').innerHTML = '';
            loadRetirees();
            populateDropdowns();
            refreshDashboard();
            showToast('✅ بازنشسته ذخیره شد', 'success');
        } catch (e) {
            showToast('❌ خطا: ' + e.message, 'error');
        }
    }

    /**
     * Deletes a retiree after confirmation.
     * @param {number} id
     */
    function deleteRetiree(id) {
        if (!confirm('آیا از حذف این بازنشسته و تمام سوابق اطمینان دارید؟')) return;
        RetireesRepository.remove(parseInt(id));
        if (window._persist) window._persist();
        loadRetirees();
        populateDropdowns();
        loadSalaryRecords();
        loadPayments();
        refreshDashboard();
        showToast('✅ بازنشسته حذف شد', 'success');
    }

    /**
     * Opens a modal showing the changelog history for a retiree.
     * @param {number} id - Retiree ID.
     */
    function showHistory(id) {
        const retiree = RetireesRepository.getById(parseInt(id));
        if (!retiree) return;
        const log = ChangelogRepository.getByRetireeId(id);
        const modalHtml = Templates.historyModal(retiree, log);
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('historyModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCloseHistory') {
                modal.remove();
            }
        });
    }

    // ----------------------------------------------------------------
    // Salaries
    // ----------------------------------------------------------------
    /**
     * Loads and renders salary records, optionally filtered by the dropdown.
     */
    function loadSalaryRecords() {
        const filterId = document.getElementById('salaryRetireeFilter').value;
        const records = SalaryRepository.getAll(filterId ? { retireeId: parseInt(filterId) } : {});
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        const tbody = document.getElementById('salaryTableBody');
        if (records.length) {
            tbody.innerHTML = records.map((r, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.retireeName}</td>
                    <td>${r.year}</td>
                    <td>${monthNames[r.month] || r.month}</td>
                    <td class="amount-cell">${r.baseSalary.toLocaleString('fa-IR')}</td>
                    <td class="amount-cell">${r.allowances.toLocaleString('fa-IR')}</td>
                    <td class="amount-cell">${r.total.toLocaleString('fa-IR')}</td>
                    <td><button class="btn btn-danger btn-sm delete-salary" data-id="${r.id}">🗑️</button></td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">سابقه‌ای ثبت نشده</td></tr>';
        }
    }

    /**
     * Displays the salary record entry form.
     */
    function showSalaryForm() {
        const container = document.getElementById('salaryFormContainer');
        container.innerHTML = Templates.salaryForm();
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        // Populate the retiree dropdown
        const retirees = RetireesRepository.getAll();
        const select = document.getElementById('sf_retiree_id');
        select.innerHTML = '<option value="">-- انتخاب --</option>' +
            retirees.map(r => `<option value="${r.id}">${r.lastName} ${r.firstName}</option>`).join('');

        document.getElementById('btnSaveSalary').addEventListener('click', saveSalary);
        document.getElementById('btnCancelSalary').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    /**
     * Saves a new salary record from the form.
     */
    function saveSalary() {
        const record = {
            retireeId: parseInt(document.getElementById('sf_retiree_id').value),
            year: parseInt(document.getElementById('sf_year').value),
            month: parseInt(document.getElementById('sf_month').value),
            baseSalary: parseFloat(document.getElementById('sf_base').value) || 0,
            allowances: parseFloat(document.getElementById('sf_allowances').value) || 0
        };
        if (!record.retireeId) return showToast('❌ بازنشسته را انتخاب کنید', 'error');
        SalaryRepository.add(record);
        if (window._persist) window._persist();
        document.getElementById('salaryFormContainer').style.display = 'none';
        document.getElementById('salaryFormContainer').innerHTML = '';
        loadSalaryRecords();
        populateDropdowns();
        showToast('✅ سابقه حقوق ثبت شد', 'success');
    }

    /**
     * Deletes a salary record.
     * @param {number} id
     */
    function deleteSalary(id) {
        if (!confirm('حذف شود؟')) return;
        SalaryRepository.remove(parseInt(id));
        if (window._persist) window._persist();
        loadSalaryRecords();
        showToast('✅ حذف شد', 'success');
    }

    // ----------------------------------------------------------------
    // Calculation
    // ----------------------------------------------------------------
    /**
     * Gathers inputs, calls CalcEngine, and displays the result.
     */
    function calculatePension() {
        const rid = document.getElementById('calcRetireeSelect').value;
        const year = parseInt(document.getElementById('calcYear').value);
        const month = parseInt(document.getElementById('calcMonth').value);
        const children = parseInt(document.getElementById('calcChildren').value) || 0;
        const hasSpouse = parseInt(document.getElementById('calcSpouse').value) || 0;
        if (!rid) return showToast('❌ بازنشسته را انتخاب کنید', 'error');

        const retiree = RetireesRepository.getById(parseInt(rid));
        if (!retiree) return showToast('❌ بازنشسته یافت نشد', 'error');

        const settings = SettingsService.get();
        const incomeItems = ItemsRepository.getIncomes();
        const deductionItems = ItemsRepository.getDeductions();

        const result = CalcEngine.calculate(retiree, settings, incomeItems, deductionItems, children, hasSpouse);
        currentCalcResult = {
            retireeId: retiree.id,
            retireeName: retiree.firstName + ' ' + retiree.lastName,
            nationalCode: retiree.nationalCode,
            calcYear: year,
            calcMonth: month,
            childrenCount: children,
            hasSpouse: hasSpouse,
            ...result
        };

        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        document.getElementById('calcBadge').textContent = `${retiree.firstName} ${retiree.lastName} | ${retiree.nationalCode} | ${year}/${monthNames[month]}`;
        let html = '';
        result.incomes.forEach(inc => html += `<tr><td>${inc.name}</td><td class="amount-cell">${inc.amount.toLocaleString('fa-IR')}</td><td>درآمد</td></tr>`);
        html += `<tr style="background:#f9fafb;font-weight:700;"><td>ناخالص</td><td class="amount-cell">${result.grossAmount.toLocaleString('fa-IR')}</td><td></td></tr>`;
        result.deductions.forEach(ded => html += `<tr style="color:#c0392b;"><td>${ded.name}</td><td class="amount-cell">(${ded.amount.toLocaleString('fa-IR')})</td><td>کسور</td></tr>`);
        html += `<tr style="background:#e8f5e9;font-weight:700;"><td>💵 خالص پرداختی</td><td class="amount-cell" style="font-size:1.2rem;">${result.netAmount.toLocaleString('fa-IR')}</td><td>ریال</td></tr>`;
        document.getElementById('calcResultBody').innerHTML = html;
        document.getElementById('calcResultCard').style.display = 'block';
        document.getElementById('calcResultCard').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Saves the current calculation result as a payment record.
     */
    function savePayment() {
        if (!currentCalcResult) return showToast('❌ ابتدا محاسبه کنید', 'error');
        PaymentsRepository.add({
            retireeId: currentCalcResult.retireeId,
            calcYear: currentCalcResult.calcYear,
            calcMonth: currentCalcResult.calcMonth,
            incomes: currentCalcResult.incomes,
            deductions: currentCalcResult.deductions,
            grossAmount: currentCalcResult.grossAmount,
            totalDeductions: currentCalcResult.totalDeductions,
            netAmount: currentCalcResult.netAmount,
            childrenCount: currentCalcResult.childrenCount,
            hasSpouse: currentCalcResult.hasSpouse,
            notes: ''
        });
        if (window._persist) window._persist();
        loadPayments();
        refreshDashboard();
        showToast('✅ پرداخت ثبت شد', 'success');
    }

    // ----------------------------------------------------------------
    // Payments
    // ----------------------------------------------------------------
    /**
     * Loads and renders payment history.
     */
    function loadPayments() {
        const payments = PaymentsRepository.getAll();
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        const tbody = document.getElementById('paymentsTableBody');
        if (payments.length) {
            tbody.innerHTML = payments.map((p, i) => {
                const incStr = p.incomes.map(inc => `${inc.name}: ${inc.amount.toLocaleString('fa-IR')}`).join('، ');
                const dedStr = p.deductions.map(d => `${d.name}: ${d.amount.toLocaleString('fa-IR')}`).join('، ');
                return `<tr>
                    <td>${i + 1}</td>
                    <td>${p.firstName} ${p.lastName}</td>
                    <td>${p.nationalCode}</td>
                    <td>${p.calcYear}/${monthNames[p.calcMonth] || p.calcMonth}</td>
                    <td>${incStr}</td>
                    <td>${dedStr}</td>
                    <td class="amount-cell">${p.grossAmount.toLocaleString('fa-IR')}</td>
                    <td class="amount-cell text-danger">(${p.totalDeductions.toLocaleString('fa-IR')})</td>
                    <td class="amount-cell" style="font-weight:700;">${p.netAmount.toLocaleString('fa-IR')}</td>
                    <td>${p.createdAt ? p.createdAt.slice(0, 10) : '-'}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">پرداختی وجود ندارد</td></tr>';
        }
    }

    // ----------------------------------------------------------------
    // Items (Income / Deduction formulas)
    // ----------------------------------------------------------------
    /**
     * Refreshes the tables of income and deduction items.
     */
    function loadItemsList() {
        const incomes = ItemsRepository.getIncomes();
        const deductions = ItemsRepository.getDeductions();
        const renderTable = (tbodyId, items, type) => {
            const tbody = document.getElementById(tbodyId);
            if (items.length) {
                tbody.innerHTML = items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td style="direction:ltr;font-family:monospace;">${item.formula}</td>
                        <td>${item.sortOrder}</td>
                        <td>
                            <button class="btn btn-ghost btn-sm edit-item" data-id="${item.id}">✏️</button>
                            <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}">🗑️</button>
                        </td>
                    </tr>`).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4">موردی تعریف نشده</td></tr>';
            }
        };
        renderTable('incomeItemsTable', incomes, 'income');
        renderTable('deductionItemsTable', deductions, 'deduction');
    }

    /**
     * Opens the form to add or edit an income/deduction item.
     * @param {string} type - "income" or "deduction".
     * @param {number|null} itemId
     */
    function showItemForm(type, itemId = null) {
        let item = null;
        if (itemId) {
            const all = type === 'income' ? ItemsRepository.getIncomes() : ItemsRepository.getDeductions();
            item = all.find(i => i.id == itemId);
        }
        document.body.insertAdjacentHTML('beforeend', Templates.itemForm(type, item));
        const modal = document.getElementById('itemFormModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCancelItem') modal.remove();
        });
        document.getElementById('btnSaveItem').addEventListener('click', function () {
            const itemData = {
                id: this.dataset.id ? parseInt(this.dataset.id) : null,
                name: document.getElementById('itemName').value.trim(),
                formula: document.getElementById('itemFormula').value.trim(),
                sortOrder: parseInt(document.getElementById('itemOrder').value) || 0
            };
            if (!itemData.name) return showToast('❌ نام الزامی است', 'error');
            if (type === 'income') ItemsRepository.saveIncome(itemData);
            else ItemsRepository.saveDeduction(itemData);
            if (window._persist) window._persist();
            modal.remove();
            loadItemsList();
            showToast('✅ آیتم ذخیره شد', 'success');
        });
    }

    /**
     * Deletes an income/deduction item.
     * @param {string} type
     * @param {number} id
     */
    function deleteItem(type, id) {
        if (!confirm('حذف شود؟')) return;
        if (type === 'income') ItemsRepository.deleteIncome(parseInt(id));
        else ItemsRepository.deleteDeduction(parseInt(id));
        if (window._persist) window._persist();
        loadItemsList();
        showToast('✅ حذف شد', 'success');
    }

    // ----------------------------------------------------------------
    // Settings
    // ----------------------------------------------------------------
    /**
     * Fills the settings form with values from SettingsService.
     */
    function loadSettingsForm() {
        const s = SettingsService.get();
        document.getElementById('setMinWage').value = s.minWage;
        document.getElementById('setSpouseFactor').value = s.spouseFactor;
        document.getElementById('setChildFactor').value = s.childFactor;
        document.getElementById('setInsuranceRate').value = s.insuranceRate;
        document.getElementById('setSupplementaryIns').value = s.supplementaryIns;
        document.getElementById('setTaxExemption').value = s.taxExemption;
        document.getElementById('setMaxYears').value = s.maxYears;
    }

    /**
     * Saves the settings from the form into SettingsService.
     */
    function saveSettings() {
        const s = {
            minWage: parseFloat(document.getElementById('setMinWage').value) || SettingsService.DEFAULT.minWage,
            spouseFactor: parseFloat(document.getElementById('setSpouseFactor').value) || SettingsService.DEFAULT.spouseFactor,
            childFactor: parseFloat(document.getElementById('setChildFactor').value) || SettingsService.DEFAULT.childFactor,
            insuranceRate: parseFloat(document.getElementById('setInsuranceRate').value) || SettingsService.DEFAULT.insuranceRate,
            supplementaryIns: parseFloat(document.getElementById('setSupplementaryIns').value) || SettingsService.DEFAULT.supplementaryIns,
            taxExemption: parseFloat(document.getElementById('setTaxExemption').value) || SettingsService.DEFAULT.taxExemption,
            maxYears: parseFloat(document.getElementById('setMaxYears').value) || SettingsService.DEFAULT.maxYears
        };
        SettingsService.save(s);
        showToast('✅ تنظیمات ذخیره شد', 'success');
    }

    // ----------------------------------------------------------------
    // Event binding
    // ----------------------------------------------------------------
    /**
     * Attaches all static event listeners after the UI is rendered.
     */
    function bindAll() {
        // Tab navigation
        document.getElementById('tabNav').addEventListener('click', e => {
            if (e.target.classList.contains('tab-btn')) {
                UIManager.switchTab(e.target.dataset.tab);
            }
        });

        // Header buttons
        document.getElementById('btnExportDB').addEventListener('click', Exports.dbFile);
        document.getElementById('btnImportDB').addEventListener('click', () => document.getElementById('importFileInput').click());
        document.getElementById('importFileInput').addEventListener('change', e => {
            if (e.target.files[0]) Exports.importDBFile(e.target.files[0]);
            e.target.value = '';
        });
        document.getElementById('btnPrint').addEventListener('click', () => window.print());
        document.getElementById('btnExportJSON').addEventListener('click', Exports.jsonExport);

        // Retirees tab
        document.getElementById('btnAddRetiree').addEventListener('click', () => showRetireeForm());
        document.getElementById('retireesTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.classList.contains('edit-retiree')) showRetireeForm(btn.dataset.id);
            else if (btn.classList.contains('history-retiree')) showHistory(btn.dataset.id);
            else if (btn.classList.contains('delete-retiree')) deleteRetiree(btn.dataset.id);
        });

        // Salaries tab
        document.getElementById('salaryRetireeFilter').addEventListener('change', loadSalaryRecords);
        document.getElementById('btnAddSalary').addEventListener('click', showSalaryForm);
        document.getElementById('salaryTableBody').addEventListener('click', e => {
            if (e.target.classList.contains('delete-salary')) deleteSalary(e.target.dataset.id);
        });

        // Calculation tab
        document.getElementById('calcRetireeSelect').addEventListener('change', function () {
            const id = this.value;
            if (id) {
                const r = RetireesRepository.getById(parseInt(id));
                if (r) {
                    document.getElementById('calcChildren').value = r.childrenCount;
                    document.getElementById('calcSpouse').value = r.hasSpouse;
                }
            }
        });
        document.getElementById('btnCalc').addEventListener('click', calculatePension);
        document.getElementById('btnClearCalc').addEventListener('click', () => {
            currentCalcResult = null;
            document.getElementById('calcResultCard').style.display = 'none';
        });
        document.getElementById('btnSavePayment').addEventListener('click', savePayment);
        document.getElementById('btnExportCalcCSV').addEventListener('click', () => Exports.calcCSV(currentCalcResult));

        // Payments tab
        document.getElementById('btnExportPaymentsCSV').addEventListener('click', Exports.paymentsCSV);

        // Export tab
        document.getElementById('exportRetirees').addEventListener('click', Exports.retireesCSV);
        document.getElementById('exportPayments').addEventListener('click', Exports.paymentsCSV);
        document.getElementById('exportSalaries').addEventListener('click', Exports.salariesCSV);
        document.getElementById('exportFullReport').addEventListener('click', Exports.fullReportCSV);

        // Settings tab
        document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
        document.getElementById('btnAddIncome').addEventListener('click', () => showItemForm('income'));
        document.getElementById('btnAddDeduction').addEventListener('click', () => showItemForm('deduction'));
        document.getElementById('incomeItemsTable').addEventListener('click', e => {
            if (e.target.classList.contains('edit-item')) showItemForm('income', e.target.dataset.id);
            else if (e.target.classList.contains('delete-item')) deleteItem('income', e.target.dataset.id);
        });
        document.getElementById('deductionItemsTable').addEventListener('click', e => {
            if (e.target.classList.contains('edit-item')) showItemForm('deduction', e.target.dataset.id);
            else if (e.target.classList.contains('delete-item')) deleteItem('deduction', e.target.dataset.id);
        });
    }

    // Public API
    return {
        bindAll,
        showToast,
        refreshDashboard,
        loadRetirees,
        loadSalaryRecords,
        loadPayments,
        loadItemsList,
        loadSettingsForm,
        populateDropdowns,
        showRetireeForm,
        saveRetiree,
        deleteRetiree,
        showHistory,
        calculatePension,
        savePayment,
        showSalaryForm,
        saveSalary,
        deleteSalary,
        showItemForm,
        deleteItem,
        saveSettings
    };
})();