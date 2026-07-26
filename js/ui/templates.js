/**
 * @file templates.js
 * @description Generates HTML strings for all UI components, keeping DOM structure
 *              separated from logic. All functions return ready‑to‑insert HTML.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.8
 * @history
 * 1.0.8 (2026-07-26) - Add Category to Decree Items
 * 1.0.7 (2026-07-24) - Categorize Items
 * 1.0.6 (2026-07-23) - Calculating Arrears and Confirmation
 * 1.0.5 (2026-07-23) - Payslip UI
 * 1.0.4 (2026-07-20) - Implementing Unified Item
 * 1.0.3 (2026-07-17) - Improving Decree Items
 * 1.0.2 (2026-07-17) - Implementing Decree
 * 1.0.1 (2026-07-15) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular
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
        const tabs = ['dashboard', 'persons', 'retireesPensioners', 'decrees', 'salaries', 'calc', 'payslips', 'payments', 'export', 'settings'];
        const labels = ['📊 داشبورد', '👥 اشخاص', '🧓 بازنشستگان/وظیفه‌بگیران', '📜 احکام', '💰 سوابق حقوق', '🧮 محاسبه', '📋 فیش حقوقی', '📋 پرداخت‌ها', '📤 CSV', '⚙️ تنظیمات'];
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

        <!-- Persons Tab -->
        <div class="tab-panel" id="panel-persons">
            <div class="card"><div class="card-header"><h3>لیست اشخاص</h3><button class="btn btn-accent btn-sm" id="btnAddPerson">➕ افزودن شخص</button></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>کد ملی</th><th>شماره شناسنامه</th><th>نام</th><th>نام خانوادگی</th><th>نام پدر</th><th>تاریخ تولد</th><th>وضعیت تاهل</th><th>تعداد فرزند</th><th>عملیات</th></tr></thead><tbody id="personsTableBody"></tbody></table></div>
            </div>
            <div id="personFormContainer" style="display:none;"></div>
        </div>

        <!-- Retirees / Pensioners combined tab -->
        <div class="tab-panel" id="panel-retireesPensioners">
            <div class="card">
                <div class="card-header">
                    <h3>مستمری‌بگیران</h3>
                    <button class="btn btn-accent btn-sm" id="btnAddRetiree">➕ افزودن</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ردیف</th>
                                <th>کد ملی</th>
                                <th>نام</th>
                                <th>نام خانوادگی</th>
                                <th>کد پرسنلی</th>
                                <th>تاریخ بازنشستگی</th>
                                <th>دفتر کل</th>
                                <th>ایثارگری</th>
                                <th>تعداد تبعی</th>
                                <th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody id="retireesTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3>وظیفه‌بگیران</h3>
                    <button class="btn btn-accent btn-sm" id="btnAddPensioner">➕ افزودن</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ردیف</th>
                                <th>کد ملی</th>
                                <th>نام</th>
                                <th>نام خانوادگی</th>
                                <th>متوفی</th>
                                <th>کد ورثه</th>
                                <th>دفتر کل</th>
                                <th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody id="pensionersTableBody"></tbody>
                    </table>
                </div>
            </div>
            <div id="retireePensionerFormContainer" style="display:none;"></div>
        </div>

        <!-- Decrees Tab -->
        <div class="tab-panel" id="panel-decrees">
            <div class="card">
                <div class="card-header">
                    <h3>جستجوی احکام</h3>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div class="form-group" style="margin-bottom:0;">
                            <select id="decreePersonFilter"><option value="">-- انتخاب شخص --</option></select>
                        </div>
                        <button class="btn btn-accent btn-sm" id="btnAddDecree">➕ صدور حکم جدید</button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ردیف</th>
                                <th>شماره حکم</th>
                                <th>عنوان</th>
                                <th>تاریخ صدور</th>
                                <th>تاریخ اجرا</th>
                                <th>وضعیت</th>
                                <th>عملیات</th>
                            </tr>
                            </thead>
                        <tbody id="decreesTableBody"></tbody>
                    </table>
                </div>
            </div>
            <div id="decreeFormContainer" style="display:none;"></div>
        </div>

        <!-- Salaries Tab -->
        <div class="tab-panel" id="panel-salaries">
            <div class="card"><div class="card-header"><h3>سوابق حقوق</h3><div style="display:flex;gap:8px;align-items:center;"><select id="salaryRetireeFilter"><option value="">-- انتخاب --</option></select><button class="btn btn-accent btn-sm" id="btnAddSalary">➕ ثبت</button></div></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>بازنشسته</th><th>سال</th><th>ماه</th><th>پایه</th><th>فوق‌العاده</th><th>جمع</th><th>عملیات</th></tr></thead><tbody id="salaryTableBody"></tbody></table></div>
            </div>
            <div id="salaryFormContainer" style="display:none;"></div>
        </div>

        <!-- Calc Tab -->
        <div class="tab-panel" id="panel-calc">
            <div class="card"><div class="card-header"><h3>محاسبه</h3></div>
                <div class="form-grid">
                    <div class="form-group"><label>بازنشسته/وظیفه‌بگیر</label><select id="calcRetireeSelect"><option value="">-- انتخاب --</option></select></div>
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

        <!-- Payslips Tab -->
        <div class="tab-panel" id="panel-payslips">
            <div class="card">
                <div class="card-header">
                    <h3>محاسبه گروهی فیش حقوقی</h3>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label>سال</label>
                            <input type="number" id="psYear" value="1404" min="1390" max="1430" style="width:100px;">                  
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label>ماه</label>
                            <select id="psMonth" style="width:120px;">
                                <option value="1">فروردین</option><option value="2">اردیبهشت</option><option value="3">خرداد</option>
                                <option value="4">تیر</option><option value="5">مرداد</option><option value="6">شهریور</option>
                                <option value="7">مهر</option><option value="8">آبان</option><option value="9">آذر</option>
                                <option value="10">دی</option><option value="11">بهمن</option><option value="12">اسفند</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <button class="btn btn-accent btn-sm" id="btnCalculateAll">📊 محاسبه همه</button>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <button class="btn btn-outline btn-sm" id="btnAddItemToAll">➕ افزودن آیتم به همه</button>
                        </div>  
                        <div class="form-group" style="margin-bottom:0;">
                            <button class="btn btn-accent btn-sm" id="btnConfirmAll">✔️ تأیید همه</button>
                        </div>                    
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3>لیست فیش‌ها</h3>
                    <button class="btn btn-ghost btn-sm" id="btnRefreshPayslips">🔄 تازه‌سازی</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ردیف</th><th>کد ملی</th><th>نام</th><th>نام خانوادگی</th>
                                <th>نوع</th><th>ناخالص</th><th>کسورات</th><th>خالص</th>
                                <th>وضعیت</th><th>عملیات</th>
                            </tr>
                        </thead>
                        <tbody id="payslipsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Container for detail modal or inline form -->
            <div id="payslipDetailContainer" style="display:none;"></div>
        </div>

        <!-- Payments Tab -->
        <div class="tab-panel" id="panel-payments">
            <div class="card"><div class="card-header"><h3>پرداخت‌ها</h3><button class="btn btn-ghost btn-sm" id="btnExportPaymentsCSV">📤 CSV</button></div>
                <div class="table-wrapper"><table><thead><tr><th>ردیف</th><th>بازنشسته</th><th>کد ملی</th><th>سال/ماه</th><th>درآمدها</th><th>کسورات</th><th>ناخالص</th><th>کسورات کل</th><th>خالص</th><th>تاریخ</th></tr></thead><tbody id="paymentsTableBody"></tbody></table></div>
            </div>
        </div>

        <!-- Export Tab -->
        <div class="tab-panel" id="panel-export">
            <div class="card"><div class="card-header"><h3>خروجی‌ها</h3></div>
                <div class="stats-row">
                    <div class="stat-card" id="exportPersons"><div class="stat-value">👥</div><div class="stat-label">اشخاص</div></div>
                    <div class="stat-card accent" id="exportRetireesPensioners"><div class="stat-value">🧓</div><div class="stat-label">بازنشستگان/وظیفه‌بگیران</div></div>
                    <div class="stat-card warning" id="exportSalaries"><div class="stat-value">💰</div><div class="stat-label">سوابق حقوق</div></div>
                    <div class="stat-card" id="exportFullReport"><div class="stat-value">📊</div><div class="stat-label">گزارش جامع</div></div>
                </div>
            </div>
        </div>

        <!-- Settings Tab -->
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
            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3>آیتم‌های حکم</h3>
                    <div>
                        <button class="btn btn-accent btn-sm" id="btnAddDecreeItem">➕ افزودن آیتم حکم</button>
                    </div>
                </div>
                <div style="flex:1; min-width:300px;">
                    <h4>📈 درآمدها</h4>
                    <div class="table-wrapper">
                        <table><thead><tr><th>نوع</th><th>نام</th><th>فرمول</th><th>ترتیب</th><th>نوع حکم</th><th>عملیات</th></tr></thead>
                            <tbody id="incomeItemsTable"></tbody>
                        </table>
                    </div>
                </div>
                <div style="flex:1; min-width:300px;">
                    <h4>📉 کسورات</h4>
                    <div class="table-wrapper">
                        <table><thead><tr><th>نوع</th><th>نام</th><th>فرمول</th><th>ترتیب</th><th>نوع حکم</th><th>عملیات</th></tr></thead>
                            <tbody id="deductionItemsTable"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3>آیتم‌های فیش</h3>
                    <button class="btn btn-accent btn-sm" id="btnAddPayslipItem">➕ افزودن آیتم فیش</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead><tr><th>نام</th><th>نوع</th><th>مبلغ پیش‌فرض</th><th>تکرارشونده</th><th>ترتیب</th><th>عملیات</th></tr></thead>
                        <tbody id="payslipItemsTable"></tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Person Form
    // ------------------------------------------------------------------
    /**
     * Generates the add/edit form for a person.
     * @param {Object|null} data - Existing person object for editing.
     * @returns {string}
     */
    function personForm(data = null) {
        const isEdit = !!data;
        return `
        <div class="card" style="border:2px solid var(--primary-light);">
            <div class="card-header"><h3>${isEdit ? 'ویرایش' : 'افزودن'} شخص</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>کد ملی *</label><input type="text" id="pf_national_code" value="${data?.nationalCode||''}" ${isEdit?'readonly':''}></div>
                <div class="form-group"><label>شماره شناسنامه *</label><input type="text" id="pf_id_number" value="${data?.idNumber||''}"></div>
                <div class="form-group"><label>نام *</label><input type="text" id="pf_first_name" value="${data?.firstName||''}"></div>
                <div class="form-group"><label>نام خانوادگی *</label><input type="text" id="pf_last_name" value="${data?.lastName||''}"></div>
                <div class="form-group"><label>نام پدر</label><input type="text" id="pf_father_name" value="${data?.fatherName||''}"></div>
                <div class="form-group"><label>تاریخ تولد</label><input type="text" id="pf_birth_date" value="${data?.birthDate||''}" placeholder="YYYY-MM-DD"></div>
                <div class="form-group"><label>وضعیت تاهل</label><select id="pf_marriage_status"><option value="0" ${data?.marriageStatus===0?'selected':''}>مجرد</option><option value="1" ${data?.marriageStatus===1?'selected':''}>متاهل</option></select></div>
                <div class="form-group"><label>تعداد فرزند</label><input type="number" id="pf_children_count" value="${data?.childrenCount||0}" min="0"></div>
            </div>
            <div class="form-actions">
                <button class="btn btn-accent" id="btnSavePerson" data-edit-id="${isEdit? data.id : ''}">💾 ذخیره</button>
                <button class="btn btn-ghost" id="btnCancelPerson">انصراف</button>
            </div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Shared Person Search / Inline Creation Components
    // ------------------------------------------------------------------
    /**
     * Creates a search box for selecting an existing person.
     * @param {string} prefix - Unique prefix for DOM IDs (e.g., 'rp_main', 'rp_deceased', 'dep_0').
     * @returns {string} HTML.
     */
    function personSearchBox(prefix) {
        return `
        <div class="form-group">
            <label>جستجوی شخص</label>
            <input type="text" id="${prefix}_search" placeholder="کد ملی یا نام..." autocomplete="off" class="person-search-input">
            <ul id="${prefix}_results" style="list-style:none; background:#fff; border:1px solid #ddd; max-height:120px; overflow:auto; display:none; position:absolute; z-index:10;"></ul>
            <button type="button" class="btn btn-sm btn-ghost" id="${prefix}_new">➕ شخص جدید</button>
            <input type="hidden" id="${prefix}_person_id">
        </div>`;
    }

    /**
     * Returns inline fields for adding a new person on the fly.
     * @param {string} prefix - Same prefix used in personSearchBox.
     * @returns {string} HTML.
     */
    function personInlineFields(prefix) {
        return `
        <div id="${prefix}_inline" style="display:none; border:1px dashed #aaa; padding:8px; margin:8px 0; border-radius:6px;">
            <h5 style="margin-bottom:8px;">افزودن شخص جدید</h5>
            <div class="form-grid">
                <div class="form-group"><label>کد ملی</label><input type="text" id="${prefix}_nc"></div>
                <div class="form-group"><label>شماره شناسنامه</label><input type="text" id="${prefix}_idnum"></div>
                <div class="form-group"><label>نام</label><input type="text" id="${prefix}_fn"></div>
                <div class="form-group"><label>نام خانوادگی</label><input type="text" id="${prefix}_ln"></div>
                <div class="form-group"><label>نام پدر</label><input type="text" id="${prefix}_father"></div>
                <div class="form-group"><label>تاریخ تولد</label><input type="text" id="${prefix}_bd" placeholder="YYYY-MM-DD"></div>
                <div class="form-group"><label>متاهل</label><select id="${prefix}_married"><option value="0">خیر</option><option value="1">بله</option></select></div>
                <div class="form-group"><label>تعداد فرزند</label><input type="number" id="${prefix}_children" value="0" min="0"></div>
            </div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Combined Retiree / Pensioner Form
    // ------------------------------------------------------------------
    /**
     * Generates the add/edit form for a retiree or pensioner.
     * @param {Object|null} data - Existing retiree/pensioner object (with type).
     * @param {string} type - 'retiree' or 'pensioner' (for new forms, data is null).
     * @returns {string}
     */
    function retireePensionerForm(data = null, type = 'retiree') {
        const isEdit = !!data;
        const formType = data?.type || type;
        const isRetiree = formType === 'retiree';

        // Main person locked view (edit only)
        const mainPersonHtml = isEdit ? `
            <div class="form-group">
                <label>شخص اصلی</label>
                <input type="text" value="${data.person.firstName} ${data.person.lastName} (${data.person.nationalCode})" readonly>
                <input type="hidden" id="rp_main_person_id" value="${data.personId}">
            </div>` : `
            <div style="border:1px solid var(--border); padding:12px; border-radius:6px; margin-bottom:12px;">
                <h4>شخص اصلی</h4>
                ${personSearchBox('rp_main')}
                ${personInlineFields('rp_main')}
            </div>`;

        // Deceased person locked view (edit & pensioner only)
        let deceasedPersonHtml = '';
        if (isRetiree) {
            deceasedPersonHtml = `<div id="rp_deceased_section" style="display:none;"></div>`;
        } else {
            if (isEdit) {
                deceasedPersonHtml = `
                <div id="rp_deceased_section">
                    <div class="form-group">
                        <label>متوفی</label>
                        <input type="text" value="${data.deceased.firstName} ${data.deceased.lastName} (${data.deceased.nationalCode})" readonly>
                        <input type="hidden" id="rp_deceased_person_id" value="${data.deceasedId}">
                    </div>
                </div>`;
            } else {
                deceasedPersonHtml = `
                <div id="rp_deceased_section" style="border:1px solid var(--border); padding:12px; border-radius:6px; margin-bottom:12px;">
                    <h4>متوفی</h4>
                    ${personSearchBox('rp_deceased')}
                    ${personInlineFields('rp_deceased')}
                </div>`;
            }
        }

        // Type-specific fields
        const retireeFields = isRetiree ? `
            <div id="rp_retiree_fields">
                <div class="form-group"><label>کد پرسنلی</label><input type="text" id="rp_personnel_code" value="${data?.personnelCode||''}"></div>
                <div class="form-group"><label>تاریخ بازنشستگی</label><input type="text" id="rp_retirement_date" value="${data?.retirementDate||''}" placeholder="YYYY-MM-DD"></div>
                <div class="form-group"><label>وضعیت ایثارگری</label><input type="text" id="rp_veteran_status" value="${data?.veteranStatus||''}"></div>
            </div>` : '';

        const pensionerFields = !isRetiree ? `
            <div id="rp_pensioner_fields">
                <div class="form-group"><label>کد ورثه</label><input type="text" id="rp_inheritance_code" value="${data?.inheritanceCode||''}"></div>
            </div>` : '';

        // Ledger (common)
        const ledgerField = `
            <div class="form-group"><label>شماره دفتر کل</label><input type="text" id="rp_ledger_number" value="${data?.ledgerNumber||''}"></div>`;

        // Dependents section (retiree only)
        const dependentsSection = isRetiree ? `
            <div id="rp_dependents_section" style="margin-top:16px; border-top:1px solid var(--border); padding-top:12px;">
                <h4>افراد تحت تکفل (تبع) 
                    <button type="button" class="btn btn-accent btn-sm" id="btnAddDependent">➕ افزودن</button>
                </h4>
                <div id="dependentsContainer"></div>
            </div>` : '';

        return `
        <div class="card" style="border:2px solid var(--primary-light);">
            <div class="card-header"><h3>${isEdit ? 'ویرایش' : 'افزودن'} ${isRetiree ? 'مستمری‌بگیر' : 'وظیفه‌بگیر'}</h3></div>

            ${mainPersonHtml}
            ${deceasedPersonHtml}

            <div class="form-grid" style="margin-top:12px;">
                ${ledgerField}
                ${retireeFields}
                ${pensionerFields}
            </div>

            ${dependentsSection}

            <div class="form-actions" style="margin-top:16px;">
                <button class="btn btn-accent" id="btnSaveRetireePensioner" data-edit-id="${isEdit ? data.id : ''}">💾 ذخیره</button>
                <button class="btn btn-ghost" id="btnCancelRetireePensioner">انصراف</button>
            </div>
        </div>`;
    }

    /**
     * Returns a single dependent row with person search and type selection.
     * @param {Object} dep - { personId?, dependentType, personName? }.
     * @param {number} index - Row index.
     * @param {boolean} locked - Whether the dependent is editable or not
     * @returns {string} HTML.
     */
    function dependentRow(dep = {}, index, locked = false) {
        const typeOptions = [
            { value: '1', label: 'تبع ۱ (همسر/فرزند زیر ۱۸)' },
            { value: '2', label: 'تبع ۲ (والدین/فرزند بالای ۱۸)' },
            { value: '3', label: 'تبع ۳ (سایر)' }
        ];

        // Wrapper for person info and type selection
        const personBlock = locked
            ? `<div class="form-group" style="flex:1;">
                <label>شخص</label>
                <input type="text" value="${dep.personName} (${dep.personNationalCode || ''})" readonly>
                <input type="hidden" class="dep-person-id" value="${dep.personId}">
            </div>`
            : `<div style="flex:1; min-width:200px;">
                ${personSearchBox('dep_' + index)}
                ${personInlineFields('dep_' + index)}
            </div>`;

        const typeBlock = `
            <div class="form-group" style="width:200px;">
                <label>نوع تبعی</label>
                <select class="dep-type">
                    ${typeOptions.map(t => `<option value="${t.value}" ${dep.dependentType == t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
            </div>`;

        const removeBtn = `<button type="button" class="btn btn-danger btnRemoveDependent" style="margin-top:30px;">🗑️</button>`;

        return `
        <div class="dependent-item" data-index="${index}" style="display:flex; gap:8px; align-items:flex-start; margin-bottom:8px; background:#f9fafb; padding:8px; border-radius:6px; flex-wrap:wrap;">
            ${personBlock}
            ${typeBlock}
            ${removeBtn}
        </div>`;
    }

    // ------------------------------------------------------------------
    // Decree and Decree Items
    // ------------------------------------------------------------------
    /**
     * Generates the decree add/edit form.
     * @param {Object|null} data - Existing decree object
     * @param {number} prefillPersonId - Existing Person Id
     * @param {number} prefillType - Existing Person Type
     * @returns {string}
     */
    function decreeForm(data = null, prefillPersonId = null, prefillType = 'retiree') {
        const isEdit = !!data;
        const selectedPersonId = data?.personId || prefillPersonId;
        const selectedType = data?.type || prefillType;
        const lockedPerson = !!prefillPersonId || isEdit;

        let salaryItems = [];
        let benefitItems = [];
        let deductionItems = [];
        let otherItems = [];
        if(data && data.items) {
            // Existing decree: use its items directly
            data.items.forEach(item => {
                if(item.category === 'salary') salaryItems.push(item);
                else if(item.category === 'benefit') benefitItems.push(item);
                else if(item.category === 'deduction') deductionItems.push(item);
                else otherItems.push(item);
            });
        } else {
            // New decree: fetch current global items
            const decreeItems = ItemsRepository.getDecreeItems(prefillType);
            decreeItems.forEach(item => {
                if(item.category === 'salary') salaryItems.push(item);
                else if(item.category === 'benefit') benefitItems.push(item);
                else if(item.category === 'deduction') deductionItems.push(item);
                else otherItems.push(item);
            });
        }

        const typeOptions = `
            <option value="retiree" ${selectedType === 'retiree' ? 'selected' : ''}>مستمری‌بگیر</option>
            <option value="pensioner" ${selectedType === 'pensioner' ? 'selected' : ''}>وظیفه‌بگیر</option>
        `;

        let salaryItemsHtml = '';
        salaryItems.forEach(item => {
            const amount = data ? item.amount : '';
            salaryItemsHtml += `
            <div class="form-group">
                <label>${item.name}</label>
                <input type="number" class="decree-item-amount" data-item-id="${item.id}" value="${amount}" step="1000">
            </div>`;
        });
        let benefitItemsHtml = '';
        benefitItems.forEach(item => {
            const amount = data ? item.amount : '';
            benefitItemsHtml += `
            <div class="form-group">
                <label>${item.name}</label>
                <input type="number" class="decree-item-amount" data-item-id="${item.id}" value="${amount}" step="1000">
            </div>`;
        });
        let deductionItemsHtml = '';
        deductionItems.forEach(item => {
            const amount = data ? item.amount : '';
            deductionItemsHtml += `
            <div class="form-group">
                <label>${item.name}</label>
                <input type="number" class="decree-item-amount" data-item-id="${item.id}" value="${amount}" step="1000">
            </div>`;
        });
        let otherItemsHtml = '';
        otherItems.forEach(item => {
            const amount = data ? item.amount : '';
            otherItemsHtml += `
            <div class="form-group">
                <label>${item.name}</label>
                <input type="number" class="decree-item-amount" data-item-id="${item.id}" value="${amount}" step="1000">
            </div>`;
        });

        return `
        <div class="card" style="border:2px solid var(--primary-light);">
            <div class="card-header"><h3>${isEdit ? 'مشاهده' : 'صدور'} حکم</h3></div>
            <div class="form-grid">
                <div class="form-group">
                    <label>نوع *</label>
                    <select id="dc_type" ${lockedPerson ? 'disabled' : ''}>${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label>شخص *</label>
                    <select id="dc_person_id" ${lockedPerson ? 'disabled' : ''}>
                    </select>
                </div>
                <div class="form-group"><label>شماره حکم</label><input type="text" id="dc_decree_number" value="${data?.decreeNumber||''}" ${isEdit ? 'readonly' : ''}></div>
                <div class="form-group"><label>عنوان حکم</label><input type="text" id="dc_title" value="${data?.title||''}" ${isEdit ? 'readonly' : ''}></div>
                <div class="form-group"><label>تاریخ صدور</label><input type="text" id="dc_issue_date" value="${data?.issueDate||''}" placeholder="YYYY-MM-DD" ${isEdit ? 'readonly' : ''}></div>
                <div class="form-group"><label>تاریخ اجرا</label><input type="text" id="dc_effective_from" value="${data?.effectiveFrom||''}" placeholder="YYYY-MM-DD" ${isEdit ? 'readonly' : ''}></div>
            </div>
            <div style="margin-top:16px;">
                <h4>آیتم‌های حکم</h4>
                <h5>حقوق</h5>
                <div class="form-grid" id="decreeItemsGrid">${salaryItemsHtml}</div>
                <h5>مزایا</h5>
                <div class="form-grid" id="decreeItemsGrid">${benefitItemsHtml}</div>
                <h5>کسورات</h5>
                <div class="form-grid" id="decreeItemsGrid">${deductionItemsHtml}</div>
                <h5>غیره</h5>
                <div class="form-grid" id="decreeItemsGrid">${otherItemsHtml}</div>
            </div>
            <div class="form-actions" style="margin-top:16px;">
                ${!isEdit ? '<button class="btn btn-accent" id="btnSaveDecree">💾 ذخیره حکم</button>' : ''}
                <button class="btn btn-ghost" id="btnCancelDecree">بازگشت</button>
            </div>
        </div>`;
    }

    // Salary form
    function salaryForm() {
        return `
        <div class="card" style="border:2px solid var(--accent);">
            <div class="card-header"><h3>ثبت حقوق ماهانه</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>بازنشسته/وظیفه‌بگیر</label><select id="sf_retiree_id"><option value="">-- انتخاب --</option></select></div>
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

    // ------------------------------------------------------------------
    // Payslips
    // ------------------------------------------------------------------
    /**
     * Generates a row for the payslip list.
     * @param {Object} ps - payslip object from repository (with joined person name/code)
     * @param {number} index - row index
     * @returns {string}
     */
    function payslipRow(ps, index) {
        const statusText = ps.status === 0 ? 'محاسبه شده' : 'تأیید شده';
        const statusColor = ps.status === 0 ? 'orange' : 'green';
        const confirmBtn = ps.status === 0 
            ? `<button class="btn btn-accent btn-sm confirm-payslip" data-id="${ps.id}">✔️ تأیید</button>` 
            : '';
        return `
        <tr>
            <td>${index + 1}</td>
            <td>${ps.nationalCode || '-'}</td>
            <td>${ps.firstName || ''}</td>
            <td>${ps.lastName || ''}</td>
            <td>${ps.type === 'retiree' ? 'مستمری‌بگیر' : 'وظیفه‌بگیر'}</td>
            <td class="amount-cell">${ps.totalGross.toLocaleString('fa-IR')}</td>
            <td class="amount-cell">(${ps.totalDeductions.toLocaleString('fa-IR')})</td>
            <td class="amount-cell" style="font-weight:bold;">${ps.netAmount.toLocaleString('fa-IR')}</td>
            <td style="color:${statusColor};">${statusText}</td>
            <td>
                <button class="btn btn-ghost btn-sm view-payslip" data-id="${ps.id}">👁️</button>
                <button class="btn btn-outline btn-sm add-item-payslip" data-id="${ps.id}">➕ آیتم</button>
                ${confirmBtn}
                <button class="btn btn-danger btn-sm delete-payslip" data-id="${ps.id}" ${ps.status===1?'disabled':''}>🗑️</button>
            </td>
        </tr>`;
    }

    /**
     * Generates the detail view of a payslip (modal or card).
     * @param {Object} ps - payslip with items
     * @returns {string}
     */
    function payslipDetail(ps) {
        let itemsHtml = '';
        ps.items.forEach(item => {
            const sourceLabels = {1:'حکم', 2:'فیش', 3:'معوقه'};
            const sign = item.isIncome ? '' : '-';
            itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td class="amount-cell">${sign}${item.amount.toLocaleString('fa-IR')}</td>
                <td>${item.isIncome ? 'درآمد' : 'کسور'}</td>
                <td>${sourceLabels[item.source] || '-'}</td>
            </tr>`;
        });
        const statusText = ps.status === 0 ? 'محاسبه شده' : 'تأیید شده';
        return `
        <div class="card" id="payslipDetailCard">
            <div class="card-header">
                <h3>جزئیات فیش ${ps.firstName} ${ps.lastName} - ${ps.calcYear}/${ps.calcMonth}</h3>
                <span class="badge">${statusText}</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>شرح</th><th>مبلغ (ریال)</th><th>نوع</th><th>منبع</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
            </div>
            <div style="margin-top:12px; display:flex; justify-content:space-between;">
                <span><strong>ناخالص:</strong> ${ps.totalGross.toLocaleString('fa-IR')}</span>
                <span><strong>کسورات:</strong> (${ps.totalDeductions.toLocaleString('fa-IR')})</span>
                <span style="font-size:1.2rem;"><strong>خالص:</strong> ${ps.netAmount.toLocaleString('fa-IR')}</span>
            </div>
            <button class="btn btn-ghost" onclick="document.getElementById('payslipDetailContainer').style.display='none'; document.getElementById('payslipDetailContainer').innerHTML='';">بستن</button>
        </div>`;
    }

    /**
     * Generates the form for adding a payslip item to a single or bulk payslips.
     * @param {Object} options - { payslipId (optional), bulk (boolean) }
     * @returns {string}
     */
    function addPayslipItemForm(options = {}) {
        const payslipItems = ItemsRepository.getPayslipItems(); // all active payslip items
        let optionsHtml = payslipItems.map(item =>
            `<option value="${item.id}">${item.name} (${item.isIncome ? 'درآمد' : 'کسور'})</option>`
        ).join('');
        return `
        <div class="modal-overlay" id="addItemModal">
            <div class="modal">
                <h3>افزودن آیتم فیش</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>آیتم</label>
                        <select id="selectPayslipItem">${optionsHtml}</select>
                    </div>
                    <div class="form-group">
                        <label>مبلغ</label>
                        <input type="number" id="addItemAmount" value="0" step="1000">
                    </div>
                    <div class="form-group" id="bulkTarget" style="display:${options.bulk ? 'block' : 'none'};">
                        <label>اعمال به</label>
                        <select id="bulkScope">
                            <option value="all">همه فیش‌های محاسبه شده</option>
                            <option value="retiree">فقط مستمری‌بگیران</option>
                            <option value="pensioner">فقط وظیفه‌بگیران</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-accent" id="btnConfirmAddItem">💾 افزودن</button>
                    <button class="btn btn-ghost" id="btnCancelAddItem">انصراف</button>
                </div>
            </div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Settings 
    // ------------------------------------------------------------------
    function decreeItemRow(item) {
        const entityLabel = item.applicableEntity === 'retiree' ? 'مستمری‌بگیر' :
                        item.applicableEntity === 'pensioner' ? 'وظیفه‌بگیر' : 'همه';
        const categoryLabel = item.category === 'salary' ? 'حقوق' :
                        item.category === 'benefit' ? 'مزایا' :
                        item.category === 'deduction' ? 'کسورات' : 'سایر';
        return `
        <tr>
            <td>${categoryLabel}</td>
            <td>${item.name}</td>
            <td style="direction:ltr;font-family:monospace;">${item.formula}</td>
            <td>${item.sortOrder}</td>
            <td>${entityLabel}</td>
            <td>
                <button class="btn btn-ghost btn-sm edit-decree-item" data-id="${item.id}">✏️</button>
                <button class="btn btn-danger btn-sm delete-decree-item" data-id="${item.id}">🗑️</button>
            </td>
        </tr>`;
    }
    
    function payslipItemRow(item) {
        return `
        <tr>
            <td>${item.name}</td>
            <td>${item.isIncome ? 'درآمد' : 'کسور'}</td>
            <td>${(item.amount || 0).toLocaleString('fa-IR')}</td>
            <td>${item.isRecurring ? 'بله' : 'خیر'}</td>
            <td>${item.sortOrder}</td>
            <td>
                <button class="btn btn-ghost btn-sm edit-payslip-item" data-id="${item.id}">✏️</button>
                <button class="btn btn-danger btn-sm delete-payslip-item" data-id="${item.id}">🗑️</button>
            </td>
        </tr>`;
    }

    /**
     * Generates the item editing modal.
     * @param {Object|null} item - Existing item data (optional).
     * @returns {string} Modal HTML.
     */
    function decreeItemForm(item = null) {
        return `
        <div class="modal-overlay" id="decreeItemFormModal">
            <div class="modal">
                <h3>${item ? '✏️ ویرایش' : '➕ افزودن'} آیتم حکم</h3>
                <div class="form-grid">
                    <div class="form-group"><label>نام</label><input type="text" id="diName" value="${item?.name || ''}"></div>
                    <div class="form-group">
                        <label>دسته‌بندی</label>
                        <select id="diCategory">
                            <option value="salary" ${item?.category === 'salary' ? 'selected' : ''}>حقوق</option>
                            <option value="benefit" ${item?.category=== 'benefit' ? 'selected' : ''}>مزایا</option>
                            <option value="deduction" ${item?.category=== 'deduction' ? 'selected' : ''}>کسورات</option>
                        </select>
                    </div>
                    <div class="form-group"><label>فرمول</label><input type="text" id="diFormula" value="${item?.formula || '0'}"></div>
                    <div class="form-group"><label>مبلغ (پیش‌فرض)</label><input type="number" id="diAmount" value="${item?.amount || 0}" step="1000"></div>
                    <div class="form-group"><label>ترتیب</label><input type="number" id="diOrder" value="${item?.sortOrder || 0}" min="0"></div>
                    <div class="form-group">
                        <label>نوع حکم</label>
                        <select id="diEntity">
                            <option value="all" ${item?.applicableEntity === 'all' ? 'selected' : ''}>همه</option>
                            <option value="retiree" ${item?.applicableEntity === 'retiree' ? 'selected' : ''}>مستمری‌بگیر</option>
                            <option value="pensioner" ${item?.applicableEntity === 'pensioner' ? 'selected' : ''}>وظیفه‌بگیر</option>
                        </select>
                    </div>
                </div>
                <small style="color:var(--text-muted); display:block; margin-top:4px;">متغیرها: avgSalary, serviceYears, effectiveYears, minWage, maxYears, children, spouse, totalIncome (در کسورات)</small>
                <div class="form-actions">
                    <button class="btn btn-accent" id="btnSaveDecreeItem" data-id="${item?.id || ''}">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="btnCancelDecreeItem">انصراف</button>
                </div>
            </div>
        </div>`;
    }

    function payslipItemForm(item = null) {
        return `
        <div class="modal-overlay" id="payslipItemFormModal">
            <div class="modal">
                <h3>${item ? '✏️ ویرایش' : '➕ افزودن'} آیتم فیش</h3>
                <div class="form-grid">
                    <div class="form-group"><label>نام</label><input type="text" id="piName" value="${item?.name || ''}"></div>
                    <input type="hidden" id="piCategory" value="other">
                    <div class="form-group"><label>نوع</label>
                        <select id="piIsIncome">
                            <option value="1" ${item?.isIncome !== false ? 'selected' : ''}>درآمد</option>
                            <option value="0" ${item?.isIncome === false ? 'selected' : ''}>کسور</option>
                        </select>
                    </div>
                    <div class="form-group"><label>مبلغ</label><input type="number" id="piAmount" value="${item?.amount || 0}" step="1000"></div>
                    <div class="form-group"><label>فرمول (اختیاری)</label><input type="text" id="piFormula" value="${item?.formula || ''}"></div>
                    <div class="form-group">
                        <label>تکرارشونده</label>
                        <select id="piRecurring">
                            <option value="1" ${item?.isRecurring !== false ? 'selected' : ''}>بله</option>
                            <option value="0" ${item?.isRecurring === false ? 'selected' : ''}>خیر</option>
                        </select>
                    </div>
                    <div class="form-group"><label>ترتیب</label><input type="number" id="piOrder" value="${item?.sortOrder || 0}" min="0"></div>
                    <!-- Hidden for now -->
                    <input type="hidden" id="piInitial" value="${item?.initial || 0}">
                    <input type="hidden" id="piBalance" value="${item?.balance || 0}">
                </div>
                <div class="form-actions">
                    <button class="btn btn-accent" id="btnSavePayslipItem" data-id="${item?.id || ''}">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="btnCancelPayslipItem">انصراف</button>
                </div>
            </div>
        </div>`;
    }

    /**
     * Generates the history changelog modal for an entity.
     * @param {Object} entityName - Retiree object (id, firstName, lastName, nationalCode).
     * @param {Array<Object>} log - Changelog entries [{field, oldValue, newValue, changedAt}].
     * @returns {string} Modal HTML.
     */
    function changelogModal(entityName, entityId, log) {
        let rows = log.length
            ? log.map(l => `<tr><td>${l.changedAt?.slice(0, 10)}</td><td>${l.actionType}</td><td>${l.field}</td><td>${l.oldValue}</td><td>${l.newValue}</td></tr>`).join('')
            : '<tr><td colspan="4">تغییری ثبت نشده</td></tr>';
        return `
        <div class="modal-overlay" id="changelogModal">
            <div class="modal">
                <h3>📜 تاریخچه ${entityName}</h3>
                <div class="table-wrapper">
                    <table><thead><tr><th>تاریخ</th><th>عملیات</th><th>فیلد</th><th>قبلی</th><th>جدید</th></tr></thead>
                    <tbody>${rows}</tbody></table>
                </div>
                <button class="btn btn-ghost" id="btnCloseChangelog">بستن</button>
            </div>
        </div>`;
    }

    return {
        headerButtons,
        tabNav,
        tabPanels,
        personForm,
        retireePensionerForm,
        dependentRow,
        personSearchBox,
        personInlineFields,
        decreeForm,
        salaryForm,
        decreeItemForm,
        payslipItemForm,
        decreeItemRow,
        payslipItemRow,
        payslipRow,
        payslipDetail,
        addPayslipItemForm,
        changelogModal };
})();
