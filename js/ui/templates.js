/**
 * @file templates.js
 * @description Generates HTML strings for all UI components, keeping DOM structure
 *              separated from logic. All functions return ready‑to‑insert HTML.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const Templates = (() => {

    /**
     * Returns the HTML for the header action buttons.
     * @returns {string}
     */
    function headerButtons() {
        return `
            <button class="btn btn-outline btn-sm" id="btnExportDB">💾 ذخیره DB</button>
            <button class="btn btn-outline btn-sm" id="btnImportDB">📂 بارگذاری</button>
            <input type="file" id="importFileInput" accept=".db,.sqlite,.bin,.json" style="display:none">
            <button class="btn btn-primary btn-sm" id="btnPrint">🖨️ چاپ</button>
            <button class="btn btn-outline btn-sm" id="btnExportJSON">📄 JSON</button>`;
    }

    /**
     * Returns the HTML for the tab navigation bar.
     * @returns {string}
     */
    function tabNav() {
        const tabs = ['dashboard', 'retirees', 'salaries', 'calc', 'payments', 'export', 'settings'];
        const labels = ['📊 داشبورد', '👥 بازنشستگان', '💰 سوابق حقوق', '🧮 محاسبه', '📋 پرداخت‌ها', '📤 CSV', '⚙️ تنظیمات'];
        return tabs.map((t, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-tab="${t}">${labels[i]}</button>`).join('');
    }

    /**
     * Returns the HTML for all tab panels.
     * @returns {string}
     */
    function tabPanels() {
        return `
        <div class="tab-panel active" id="panel-dashboard">
            <div class="stats-row" id="dashboardStats"></div>
            <div class="card"><div class="card-header"><h3>آخرین محاسبات</h3></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>نام</th><th>کد ملی</th><th>تاریخ</th><th>خالص</th><th>وضعیت</th></tr></thead><tbody id="dashboardRecentCalcs"></tbody></table></div>
            </div>
        </div>
        <div class="tab-panel" id="panel-retirees">
            <div class="card"><div class="card-header"><h3>لیست بازنشستگان</h3><button class="btn btn-accent btn-sm" id="btnAddRetiree">➕ افزودن</button></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>کد ملی</th><th>نام</th><th>نام خانوادگی</th><th>نام پدر</th><th>تاریخ تولد</th><th>تاریخ بازنشستگی</th><th>سال خدمت</th><th>متوسط حقوق</th><th>نوع</th><th>عملیات</th></tr></thead><tbody id="retireesTableBody"></tbody></table></div>
            </div>
            <div id="retireeFormContainer" style="display:none;"></div>
        </div>
        <div class="tab-panel" id="panel-salaries">
            <div class="card"><div class="card-header"><h3>سوابق حقوق</h3><div style="display:flex;gap:8px;align-items:center;"><select id="salaryRetireeFilter"><option value="">-- انتخاب --</option></select><button class="btn btn-accent btn-sm" id="btnAddSalary">➕ ثبت</button></div></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>بازنشسته</th><th>سال</th><th>ماه</th><th>پایه</th><th>فوق‌العاده</th><th>جمع</th><th>عملیات</th></tr></thead><tbody id="salaryTableBody"></tbody></table></div>
            </div>
            <div id="salaryFormContainer" style="display:none;"></div>
        </div>
        <div class="tab-panel" id="panel-calc">
            <div class="card"><div class="card-header"><h3>محاسبه</h3></div>
                <div class="form-grid">
                    <div class="form-group"><label>بازنشسته</label><select id="calcRetireeSelect"><option value="">-- انتخاب --</option></select></div>
                    <div class="form-group"><label>سال</label><input type="number" id="calcYear" value="1404" min="1390" max="1430"></div>
                    <div class="form-group"><label>ماه</label><select id="calcMonth">${['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
                    <div class="form-group"><label>تعداد فرزند</label><input type="number" id="calcChildren" value="0" min="0" max="20"></div>
                    <div class="form-group"><label>همسر</label><select id="calcSpouse"><option value="1">دارد</option><option value="0">ندارد</option></select></div>
                </div>
                <div class="form-actions"><button class="btn btn-accent" id="btnCalc">🔢 محاسبه</button><button class="btn btn-ghost" id="btnClearCalc">پاک</button></div>
            </div>
            <div class="card" id="calcResultCard" style="display:none;"><div class="card-header"><h3>نتیجه</h3><span class="badge" id="calcBadge"></span></div>
                <div class="table-wrapper"><table><thead><tr><th>شرح</th><th>مبلغ</th><th>نوع</th></tr></thead><tbody id="calcResultBody"></tbody></table></div>
                <div class="form-actions"><button class="btn btn-accent" id="btnSavePayment">💾 ثبت پرداخت</button><button class="btn btn-outline" id="btnExportCalcCSV">📤 CSV</button></div>
            </div>
        </div>
        <div class="tab-panel" id="panel-payments">
            <div class="card"><div class="card-header"><h3>پرداخت‌ها</h3><button class="btn btn-ghost btn-sm" id="btnExportPaymentsCSV">📤 CSV</button></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>بازنشسته</th><th>کد ملی</th><th>سال/ماه</th><th>درآمدها</th><th>کسورات</th><th>ناخالص</th><th>کسورات کل</th><th>خالص</th><th>تاریخ</th></tr></thead><tbody id="paymentsTableBody"></tbody></table></div>
            </div>
        </div>
        <div class="tab-panel" id="panel-export">
            <div class="card"><div class="card-header"><h3>خروجی‌ها</h3></div>
                <div class="stats-row">
                    <div class="stat-card" id="exportRetirees"><div class="stat-value">👥</div><div class="stat-label">بازنشستگان</div></div>
                    <div class="stat-card accent" id="exportPayments"><div class="stat-value">📋</div><div class="stat-label">پرداخت‌ها</div></div>
                    <div class="stat-card warning" id="exportSalaries"><div class="stat-value">💰</div><div class="stat-label">سوابق حقوق</div></div>
                    <div class="stat-card" id="exportFullReport"><div class="stat-value">📊</div><div class="stat-label">گزارش جامع</div></div>
                </div>
            </div>
        </div>
        <div class="tab-panel" id="panel-settings">
            <div class="card"><div class="card-header"><h3>ضرایب</h3></div>
                <div class="form-grid">
                    <div class="form-group"><label>حداقل حقوق</label><input type="number" id="setMinWage"></div>
                    <div class="form-group"><label>ضریب عائله‌مندی (%)</label><input type="number" id="setSpouseFactor"></div>
                    <div class="form-group"><label>ضریب اولاد (%)</label><input type="number" id="setChildFactor"></div>
                    <div class="form-group"><label>نرخ بیمه (%)</label><input type="number" id="setInsuranceRate"></div>
                    <div class="form-group"><label>بیمه تکمیلی (ریال)</label><input type="number" id="setSupplementaryIns"></div>
                    <div class="form-group"><label>معافیت مالیاتی سالانه</label><input type="number" id="setTaxExemption"></div>
                    <div class="form-group"><label>حداکثر سنوات</label><input type="number" id="setMaxYears"></div>
                </div>
                <div class="form-actions"><button class="btn btn-accent" id="btnSaveSettings">💾 ذخیره</button></div>
            </div>
            <div class="card" style="margin-top:20px;"><div class="card-header"><h3>آیتم‌ها</h3><div><button class="btn btn-accent btn-sm" id="btnAddIncome">➕ درآمد</button><button class="btn btn-accent btn-sm" id="btnAddDeduction">➕ کسور</button></div></div>
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:300px;"><h4>📈 درآمدها</h4><div class="table-wrapper"><table><thead><tr><th>نام</th><th>فرمول</th><th>ترتیب</th><th>عملیات</th></tr></thead><tbody id="incomeItemsTable"></tbody></table></div></div>
                    <div style="flex:1; min-width:300px;"><h4>📉 کسورات</h4><div class="table-wrapper"><table><thead><tr><th>نام</th><th>فرمول</th><th>ترتیب</th><th>عملیات</th></tr></thead><tbody id="deductionItemsTable"></tbody></table></div></div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Generates the retiree add/edit form HTML.
     * @param {Object|null} data - Existing retiree object for editing, or null.
     * @returns {string}
     */
    function retireeForm(data = null) {
        const isEdit = !!data;
        return `
        <div class="card" style="border:2px solid var(--primary-light);">
            <div class="card-header"><h3>${isEdit ? 'ویرایش' : 'افزودن'} بازنشسته</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>کد ملی *</label><input type="text" id="rf_national_code" value="${data?.nationalCode || ''}" ${isEdit ? 'readonly' : ''}></div>
                <div class="form-group"><label>نام *</label><input type="text" id="rf_first_name" value="${data?.firstName || ''}"></div>
                <div class="form-group"><label>نام خانوادگی *</label><input type="text" id="rf_last_name" value="${data?.lastName || ''}"></div>
                <div class="form-group"><label>نام پدر</label><input type="text" id="rf_father_name" value="${data?.fatherName || ''}"></div>
                <div class="form-group"><label>تاریخ تولد</label><input type="text" id="rf_birth_date" value="${data?.birthDate || ''}" placeholder="YYYY-MM-DD"></div>
                <div class="form-group"><label>تاریخ بازنشستگی</label><input type="text" id="rf_retirement_date" value="${data?.retirementDate || ''}" placeholder="YYYY-MM-DD"></div>
                <div class="form-group"><label>سال خدمت</label><input type="number" id="rf_service_years" value="${data?.serviceYears || 0}" step="0.5"></div>
                <div class="form-group"><label>متوسط حقوق</label><input type="number" id="rf_avg_salary" value="${data?.avgSalary || 0}" step="100000"></div>
                <div class="form-group"><label>نوع</label><select id="rf_type"><option value="main" ${data?.retireeType === 'main' ? 'selected' : ''}>بازنشسته</option><option value="dependent" ${data?.retireeType === 'dependent' ? 'selected' : ''}>مستمری‌بگیر</option></select></div>
                <div class="form-group"><label>تعداد فرزند</label><input type="number" id="rf_children" value="${data?.childrenCount || 0}" min="0"></div>
                <div class="form-group"><label>همسر</label><select id="rf_spouse"><option value="1" ${data?.hasSpouse === 1 ? 'selected' : ''}>دارد</option><option value="0" ${data?.hasSpouse === 0 ? 'selected' : ''}>ندارد</option></select></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-accent" id="btnSaveRetiree" data-edit-id="${isEdit ? data.id : ''}">💾 ذخیره</button>
                <button class="btn btn-ghost" id="btnCancelRetiree">انصراف</button>
            </div>
        </div>`;
    }

    /**
     * Generates the salary record form HTML.
     * @returns {string}
     */
    function salaryForm() {
        // Populate retiree options dynamically? The event handler will fill the select.
        return `
        <div class="card" style="border:2px solid var(--accent);">
            <div class="card-header"><h3>ثبت حقوق ماهانه</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>بازنشسته</label><select id="sf_retiree_id"><option value="">-- انتخاب --</option></select></div>
                <div class="form-group"><label>سال</label><input type="number" id="sf_year" value="1403" min="1390" max="1430"></div>
                <div class="form-group"><label>ماه</label><select id="sf_month">${['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
                <div class="form-group"><label>حقوق پایه</label><input type="number" id="sf_base" value="0" step="100000"></div>
                <div class="form-group"><label>فوق‌العاده</label><input type="number" id="sf_allowances" value="0" step="100000"></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-accent" id="btnSaveSalary">💾 ثبت</button>
                <button class="btn btn-ghost" id="btnCancelSalary">انصراف</button>
            </div>
        </div>`;
    }

    /**
     * Generates the item (income/deduction) editing modal.
     * @param {string} type - "income" or "deduction".
     * @param {Object|null} item - Existing item data (optional).
     * @returns {string} Modal HTML.
     */
    function itemForm(type, item = null) {
        const title = type === 'income' ? 'درآمد' : 'کسور';
        return `
        <div class="modal-overlay" id="itemFormModal">
            <div class="modal">
                <h3>${item ? '✏️ ویرایش' : '➕ افزودن'} آیتم ${title}</h3>
                <div class="form-grid">
                    <div class="form-group"><label>نام</label><input type="text" id="itemName" value="${item?.name || ''}"></div>
                    <div class="form-group"><label>فرمول</label><input type="text" id="itemFormula" value="${item?.formula || '0'}"></div>
                    <div class="form-group"><label>ترتیب</label><input type="number" id="itemOrder" value="${item?.sortOrder || 0}" min="0"></div>
                </div>
                <small style="color:var(--text-muted); display:block; margin-top:4px;">متغیرها: avgSalary, serviceYears, effectiveYears, minWage, maxYears, children, spouse, totalIncome (در کسورات)</small>
                <div class="form-actions">
                    <button class="btn btn-accent" id="btnSaveItem" data-type="${type}" data-id="${item?.id || ''}">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="btnCancelItem">انصراف</button>
                </div>
            </div>
        </div>`;
    }

    /**
     * Generates the history changelog modal for a retiree.
     * @param {Object} retiree - Retiree object (id, firstName, lastName, nationalCode).
     * @param {Array<Object>} log - Changelog entries [{field, oldValue, newValue, changedAt}].
     * @returns {string} Modal HTML.
     */
    function historyModal(retiree, log) {
        const translate = {
            'firstName': 'نام', 'lastName': 'نام خانوادگی', 'fatherName': 'نام پدر', 'birthDate': 'تاریخ تولد',
            'retirementDate': 'تاریخ بازنشستگی', 'serviceYears': 'سال خدمت', 'avgSalary': 'متوسط حقوق',
            'retireeType': 'نوع', 'childrenCount': 'تعداد فرزند', 'hasSpouse': 'همسر', 'created': 'ایجاد'
        };
        let rows = log.length
            ? log.map(l => `<tr><td>${l.changedAt.slice(0, 10)}</td><td>${translate[l.field] || l.field}</td><td>${l.oldValue}</td><td>${l.newValue}</td></tr>`).join('')
            : '<tr><td colspan="4">تغییری ثبت نشده</td></tr>';
        return `
        <div class="modal-overlay" id="historyModal">
            <div class="modal">
                <h3>📜 تاریخچه ${retiree.firstName} ${retiree.lastName} (${retiree.nationalCode})</h3>
                <div class="table-wrapper">
                    <table><thead><tr><th>تاریخ</th><th>فیلد</th><th>قبلی</th><th>جدید</th></tr></thead>
                    <tbody>${rows}</tbody></table>
                </div>
                <button class="btn btn-ghost" id="btnCloseHistory">بستن</button>
            </div>
        </div>`;
    }

    return { headerButtons, tabNav, tabPanels, retireeForm, salaryForm, itemForm, historyModal };
})();
