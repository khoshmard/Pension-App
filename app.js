// ============================================================
// GLOBAL STATE
// ============================================================
let db = null;
let SQL = null;
let currentCalcResult = null; // holds the latest calculation for saving/export

// Default settings
const DEFAULT_SETTINGS = {
    minWage: 110000000, // حداقل حقوق (ریال) - ~11 million tomans
    spouseFactor: 25, // درصد عائله‌مندی از حداقل حقوق
    childFactor: 10, // درصد اولاد از حداقل حقوق به ازای هر فرزند
    insuranceRate: 11.11, // 1/9 ≈ 11.11% کسر بیمه
    supplementaryIns: 3500000, // بیمه تکمیلی ماهانه (ریال)
    taxExemption: 1200000000, // سقف معافیت مالیاتی سالانه (ریال)
    maxYears: 30 // حداکثر سنوات خدمت
};

function getSettings() {
    try {
        const s = localStorage.getItem('pension_settings');
        return s ? JSON.parse(s) : { ...DEFAULT_SETTINGS };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettingsToStorage(settings) {
    localStorage.setItem('pension_settings', JSON.stringify(settings));
}

// ============================================================
// DATABASE INITIALIZATION (SQL.js)
// ============================================================
async function initDatabase() {
    try {
        // Initialize SQL.js
        SQL = await initSqlJs({
            locateFile: file => '/pension/sql-wasm.wasm'
        });

        // Try to load saved DB from IndexedDB
        const savedData = await loadDBFromIndexedDB();
        if (savedData) {
            db = new SQL.Database(new Uint8Array(savedData));
            console.log('✅ Database loaded from IndexedDB');
        } else {
            db = new SQL.Database();
            console.log('🆕 New database created');
        }

        // Create tables if they don't exist
        createTables();
        // Ensure settings exist
        if (!localStorage.getItem('pension_settings')) {
            saveSettingsToStorage(DEFAULT_SETTINGS);
        }
        // Refresh UI
        refreshAllUI();
        showToast('✅ سامانه آماده است', 'success');
    } catch (err) {
        console.error('Database initialization error:', err);
        showToast('❌ خطا در راه‌اندازی پایگاه داده: ' + err.message, 'error');
    }
}

function createTables() {
    db.run(`
                CREATE TABLE IF NOT EXISTS retirees (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    national_code TEXT UNIQUE NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    father_name TEXT DEFAULT '',
                    birth_date TEXT DEFAULT '',
                    retirement_date TEXT DEFAULT '',
                    service_years REAL DEFAULT 0,
                    avg_salary REAL DEFAULT 0,
                    retiree_type TEXT DEFAULT 'main',
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );
            `);
    db.run(`
                CREATE TABLE IF NOT EXISTS salary_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    retiree_id INTEGER NOT NULL,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    base_salary REAL DEFAULT 0,
                    allowances REAL DEFAULT 0,
                    total REAL GENERATED ALWAYS AS (base_salary + allowances) STORED,
                    FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE
                );
            `);
    db.run(`
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    retiree_id INTEGER NOT NULL,
                    calc_year INTEGER NOT NULL,
                    calc_month INTEGER NOT NULL,
                    base_pension REAL DEFAULT 0,
                    spouse_allowance REAL DEFAULT 0,
                    child_allowance REAL DEFAULT 0,
                    gross_amount REAL DEFAULT 0,
                    insurance_deduction REAL DEFAULT 0,
                    supplementary_deduction REAL DEFAULT 0,
                    tax_deduction REAL DEFAULT 0,
                    total_deductions REAL DEFAULT 0,
                    net_amount REAL DEFAULT 0,
                    children_count INTEGER DEFAULT 0,
                    has_spouse INTEGER DEFAULT 1,
                    notes TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (retiree_id) REFERENCES retirees(id) ON DELETE CASCADE
                );
            `);
    // Also create index for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_salary_retiree ON salary_records(retiree_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_payments_retiree ON payments(retiree_id);`);
    persistDB();
}

// ============================================================
// PERSISTENCE (IndexedDB)
// ============================================================
function persistDB() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = data.buffer;
        saveDBToIndexedDB(buffer);
    } catch (e) {
        console.warn('Could not persist DB:', e);
    }
}

function saveDBToIndexedDB(buffer) {
    const request = indexedDB.open('PensionFundDB', 1);
    request.onupgradeneeded = function (e) {
        const db_i = e.target.result;
        if (!db_i.objectStoreNames.contains('database')) {
            db_i.createObjectStore('database');
        }
    };
    request.onsuccess = function (e) {
        const db_i = e.target.result;
        try {
            const tx = db_i.transaction('database', 'readwrite');
            const store = tx.objectStore('database');
            store.put(buffer, 'sqlite_db');
            tx.oncomplete = () => console.log('💾 DB persisted to IndexedDB');
        } catch (err) {
            console.warn('IndexedDB save error:', err);
        }
    };
    request.onerror = function (e) {
        console.warn('IndexedDB open error:', e.target.error);
    };
}

function loadDBFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PensionFundDB', 1);
        request.onupgradeneeded = function (e) {
            const db_i = e.target.result;
            if (!db_i.objectStoreNames.contains('database')) {
                db_i.createObjectStore('database');
            }
        };
        request.onsuccess = function (e) {
            const db_i = e.target.result;
            try {
                const tx = db_i.transaction('database', 'readonly');
                const store = tx.objectStore('database');
                const getReq = store.get('sqlite_db');
                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => resolve(null);
            } catch (err) {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null);
    });
}

// ============================================================
// EXPORT / IMPORT FULL DB
// ============================================================
function exportFullDB() {
    if (!db) return showToast('❌ پایگاه داده آماده نیست', 'error');
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    downloadBlob(blob, 'pension_fund_backup_' + new Date().toISOString().slice(0, 10) +
        '.db');
    showToast('✅ فایل پایگاه داده با موفقیت ذخیره شد', 'success');
}

function importDBFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const arr = new Uint8Array(e.target.result);
            db = new SQL.Database(arr);
            createTables(); // ensure schema
            persistDB();
            refreshAllUI();
            showToast('✅ پایگاه داده با موفقیت بارگذاری شد', 'success');
        } catch (err) {
            showToast('❌ خطا در بارگذاری فایل: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadCSV(content, filename) {
    // UTF-8 BOM for Excel compatibility with Persian text
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
    showToast('✅ فایل ' + filename + ' با موفقیت ذخیره شد', 'success');
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

// ============================================================
// TAB NAVIGATION
// ============================================================
document.getElementById('tabNav').addEventListener('click', function (e) {
    if (e.target.classList.contains('tab-btn')) {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
    }
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const panel = document.getElementById('panel-' + tabName);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    // Refresh relevant content
    if (tabName === 'dashboard') refreshDashboard();
    if (tabName === 'retirees') loadRetirees();
    if (tabName === 'salaries') {
        populateRetireeDropdowns();
        loadSalaryRecords();
    }
    if (tabName === 'calc') populateRetireeDropdowns();
    if (tabName === 'payments') loadPayments();
    if (tabName === 'settings') loadSettingsToForm();
}

// ============================================================
// REFRESH ALL UI
// ============================================================
function refreshAllUI() {
    populateRetireeDropdowns();
    refreshDashboard();
    loadRetirees();
    loadSalaryRecords();
    loadPayments();
}

// ============================================================
// POPULATE DROPDOWNS
// ============================================================
function populateRetireeDropdowns() {
    if (!db) return;
    const retirees = db.exec('SELECT id, first_name, last_name, national_code FROM retirees WHERE is_active=1 ORDER BY last_name');
    const options = '<option value="">-- انتخاب کنید --</option>';
    let rows = '';
    if (retirees.length > 0 && retirees[0].values.length > 0) {
        rows = retirees[0].values.map(r =>
            `<option value="${r[0]}">${r[2]} ${r[1]} (${r[3]})</option>`
        ).join('');
    }
    const fullOptions = options + rows;
    const selects = ['salaryRetireeFilter', 'calcRetireeSelect'];
    selects.forEach(sid => {
        const sel = document.getElementById(sid);
        if (sel) sel.innerHTML = fullOptions;
    });
}

// ============================================================
// DASHBOARD
// ============================================================
function refreshDashboard() {
    if (!db) return;
    // Stats
    const totalRetirees = db.exec('SELECT COUNT(*) FROM retirees WHERE is_active=1');
    const totalPayments = db.exec('SELECT COUNT(*) FROM payments');
    const totalNet = db.exec('SELECT COALESCE(SUM(net_amount),0) FROM payments');
    const avgPension = db.exec('SELECT COALESCE(AVG(net_amount),0) FROM payments');

    const tr = totalRetirees[0]?.values[0]?.[0] || 0;
    const tp = totalPayments[0]?.values[0]?.[0] || 0;
    const tn = totalNet[0]?.values[0]?.[0] || 0;
    const ap = avgPension[0]?.values[0]?.[0] || 0;

    document.getElementById('dashboardStats').innerHTML = `
                <div class="stat-card"><div class="stat-value">${tr.toLocaleString('fa-IR')}</div><div class="stat-label">تعداد بازنشستگان فعال</div></div>
                <div class="stat-card accent"><div class="stat-value">${tp.toLocaleString('fa-IR')}</div><div class="stat-label">تعداد پرداخت‌های ثبت شده</div></div>
                <div class="stat-card warning"><div class="stat-value">${Number(tn).toLocaleString('fa-IR')}</div><div class="stat-label">مجموع خالص پرداختی (ریال)</div></div>
                <div class="stat-card"><div class="stat-value">${Number(ap).toLocaleString('fa-IR')}</div><div class="stat-label">میانگین حقوق بازنشستگی (ریال)</div></div>
            `;

    // Recent calculations
    const recent = db.exec(`
                SELECT p.id, r.first_name, r.last_name, r.national_code,
                       p.calc_year, p.calc_month, p.net_amount,
                       p.created_at
                FROM payments p
                JOIN retirees r ON p.retiree_id = r.id
                ORDER BY p.id DESC LIMIT 10
            `);
    const tbody = document.getElementById('dashboardRecentCalcs');
    if (recent.length > 0 && recent[0].values.length > 0) {
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی',
            'بهمن', 'اسفند'
        ];
        tbody.innerHTML = recent[0].values.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${r[1]} ${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${r[4]}/${monthNames[r[5]] || r[5]}</td>
                        <td class="amount-cell">${Number(r[6]).toLocaleString('fa-IR')}</td>
                        <td><span style="color:#27ae60;">✅ ثبت شده</span></td>
                    </tr>
                `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><span class="icon">📭</span> هنوز محاسبه‌ای ثبت نشده است</td></tr>';
    }
}

// ============================================================
// RETIREES CRUD
// ============================================================
function loadRetirees() {
    if (!db) return;
    const data = db.exec(
        'SELECT id, national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type FROM retirees WHERE is_active=1 ORDER BY last_name, first_name'
    );
    const tbody = document.getElementById('retireesTableBody');
    if (data.length > 0 && data[0].values.length > 0) {
        tbody.innerHTML = data[0].values.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${r[1]}</td>
                        <td>${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${r[4] || '-'}</td>
                        <td>${r[5] || '-'}</td>
                        <td>${r[6] || '-'}</td>
                        <td>${r[7]}</td>
                        <td class="amount-cell">${Number(r[8]).toLocaleString('fa-IR')}</td>
                        <td>${r[9] === 'main' ? 'بازنشسته' : 'مستمری‌بگیر'}</td>
                        <td>
                            <button class="btn btn-ghost btn-sm" onclick="editRetiree(${r[0]})">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteRetiree(${r[0]})">🗑️</button>
                        </td>
                    </tr>
                `).join('');
    } else {
        tbody.innerHTML =
            '<tr><td colspan="11" class="empty-state"><span class="icon">👤</span> هیچ بازنشسته‌ای ثبت نشده است</td></tr>';
    }
}

function showRetireeForm(retireeId = null) {
    const container = document.getElementById('retireeFormContainer');
    let data = null;
    if (retireeId && db) {
        const res = db.exec(
            'SELECT id, national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type FROM retirees WHERE id=' +
            retireeId);
        if (res.length > 0 && res[0].values.length > 0) {
            data = res[0].values[0];
        }
    }
    const isEdit = !!data;
    container.innerHTML = `
                <div class="card" style="border:2px solid var(--primary-light);">
                    <div class="card-header"><h3>${isEdit ? '✏️ ویرایش بازنشسته' : '➕ افزودن بازنشسته جدید'}</h3></div>
                    <div class="form-grid">
                        <div class="form-group"><label>کد ملی *</label><input type="text" id="rf_national_code" value="${data?.[1] || ''}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>نام *</label><input type="text" id="rf_first_name" value="${data?.[2] || ''}"></div>
                        <div class="form-group"><label>نام خانوادگی *</label><input type="text" id="rf_last_name" value="${data?.[3] || ''}"></div>
                        <div class="form-group"><label>نام پدر</label><input type="text" id="rf_father_name" value="${data?.[4] || ''}"></div>
                        <div class="form-group"><label>تاریخ تولد</label><input type="text" id="rf_birth_date" value="${data?.[5] || ''}" placeholder="مثال: ۱۳۴۰/۰۱/۰۱"></div>
                        <div class="form-group"><label>تاریخ بازنشستگی</label><input type="text" id="rf_retirement_date" value="${data?.[6] || ''}" placeholder="مثال: ۱۴۰۰/۰۱/۰۱"></div>
                        <div class="form-group"><label>سال خدمت</label><input type="number" id="rf_service_years" value="${data?.[7] || 0}" min="0" max="40" step="0.5"></div>
                        <div class="form-group"><label>متوسط حقوق ۲۴ ماه (ریال)</label><input type="number" id="rf_avg_salary" value="${data?.[8] || 0}" step="100000"></div>
                        <div class="form-group"><label>نوع</label><select id="rf_type"><option value="main" ${data?.[9] === 'main' ? 'selected' : ''}>بازنشسته اصلی</option><option value="dependent" ${data?.[9] === 'dependent' ? 'selected' : ''}>مستمری‌بگیر</option></select></div>
                    </div>
                    <div class="form-actions" style="margin-top:14px;">
                        <button class="btn btn-accent" onclick="saveRetiree(${isEdit ? retireeId : 'null'})">💾 ذخیره</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('retireeFormContainer').style.display='none';document.getElementById('retireeFormContainer').innerHTML='';">❌ انصراف</button>
                    </div>
                </div>
            `;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function saveRetiree(editId) {
    const nc = document.getElementById('rf_national_code').value.trim();
    const fn = document.getElementById('rf_first_name').value.trim();
    const ln = document.getElementById('rf_last_name').value.trim();
    const fan = document.getElementById('rf_father_name').value.trim();
    const bd = document.getElementById('rf_birth_date').value.trim();
    const rd = document.getElementById('rf_retirement_date').value.trim();
    const sy = parseFloat(document.getElementById('rf_service_years').value) || 0;
    const avs = parseFloat(document.getElementById('rf_avg_salary').value) || 0;
    const tp = document.getElementById('rf_type').value;

    if (!nc || !fn || !ln) {
        return showToast('❌ کد ملی، نام و نام خانوادگی الزامی است', 'error');
    }

    try {
        if (editId) {
            db.run(
                `UPDATE retirees SET first_name=?, last_name=?, father_name=?, birth_date=?, retirement_date=?, service_years=?, avg_salary=?, retiree_type=? WHERE id=?`,
                [fn, ln, fan, bd, rd, sy, avs, tp, editId]);
        } else {
            // Check duplicate
            const dup = db.exec('SELECT id FROM retirees WHERE national_code=?', [nc]);
            if (dup.length > 0 && dup[0].values.length > 0) {
                return showToast('❌ کد ملی تکراری است', 'error');
            }
            db.run(
                `INSERT INTO retirees (national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type) VALUES (?,?,?,?,?,?,?,?,?)`,
                [nc, fn, ln, fan, bd, rd, sy, avs, tp]);
        }
        persistDB();
        document.getElementById('retireeFormContainer').style.display = 'none';
        document.getElementById('retireeFormContainer').innerHTML = '';
        loadRetirees();
        populateRetireeDropdowns();
        refreshDashboard();
        showToast('✅ بازنشسته با موفقیت ' + (editId ? 'ویرایش' : 'ثبت') + ' شد', 'success');
    } catch (err) {
        showToast('❌ خطا: ' + err.message, 'error');
    }
}

function editRetiree(id) {
    showRetireeForm(id);
}

function deleteRetiree(id) {
    if (!confirm('آیا از حذف این بازنشسته و تمام سوابق مرتبط اطمینان دارید؟')) return;
    try {
        db.run('DELETE FROM salary_records WHERE retiree_id=?', [id]);
        db.run('DELETE FROM payments WHERE retiree_id=?', [id]);
        db.run('DELETE FROM retirees WHERE id=?', [id]);
        persistDB();
        loadRetirees();
        populateRetireeDropdowns();
        refreshDashboard();
        loadSalaryRecords();
        loadPayments();
        showToast('✅ بازنشسته حذف شد', 'success');
    } catch (err) {
        showToast('❌ خطا: ' + err.message, 'error');
    }
}

// ============================================================
// SALARY RECORDS
// ============================================================
function loadSalaryRecords() {
    if (!db) return;
    const filterId = document.getElementById('salaryRetireeFilter')?.value || '';
    let query = `
                SELECT s.id, r.first_name, r.last_name, s.year, s.month, s.base_salary, s.allowances, s.total
                FROM salary_records s
                JOIN retirees r ON s.retiree_id = r.id
            `;
    const params = [];
    if (filterId) {
        query += ' WHERE s.retiree_id=?';
        params.push(filterId);
    }
    query += ' ORDER BY s.year DESC, s.month DESC LIMIT 200';
    const data = db.exec(query, params);
    const tbody = document.getElementById('salaryTableBody');
    const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی',
        'بهمن', 'اسفند'
    ];
    if (data.length > 0 && data[0].values.length > 0) {
        tbody.innerHTML = data[0].values.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${r[1]} ${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${monthNames[r[4]] || r[4]}</td>
                        <td class="amount-cell">${Number(r[5]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell">${Number(r[6]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell" style="font-weight:700;">${Number(r[7]).toLocaleString('fa-IR')}</td>
                        <td><button class="btn btn-danger btn-sm" onclick="deleteSalary(${r[0]})">🗑️</button></td>
                    </tr>
                `).join('');
    } else {
        tbody.innerHTML =
            '<tr><td colspan="8" class="empty-state"><span class="icon">💰</span> سابقه حقوقی ثبت نشده است</td></tr>';
    }
}

function showSalaryForm() {
    const container = document.getElementById('salaryFormContainer');
    const retirees = db ? db.exec(
        'SELECT id, first_name, last_name FROM retirees WHERE is_active=1 ORDER BY last_name') : [];
    let options = '<option value="">-- انتخاب کنید --</option>';
    if (retirees.length > 0 && retirees[0].values.length > 0) {
        options += retirees[0].values.map(r => `<option value="${r[0]}">${r[2]} ${r[1]}</option>`).join('');
    }
    container.innerHTML = `
                <div class="card" style="border:2px solid var(--accent);">
                    <div class="card-header"><h3>➕ ثبت حقوق ماهانه</h3></div>
                    <div class="form-grid">
                        <div class="form-group"><label>بازنشسته *</label><select id="sf_retiree_id">${options}</select></div>
                        <div class="form-group"><label>سال *</label><input type="number" id="sf_year" value="1403" min="1390" max="1430"></div>
                        <div class="form-group"><label>ماه *</label><select id="sf_month">
                            ${['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
                        </select></div>
                        <div class="form-group"><label>حقوق پایه (ریال)</label><input type="number" id="sf_base" value="0" step="100000"></div>
                        <div class="form-group"><label>فوق‌العاده‌ها (ریال)</label><input type="number" id="sf_allowances" value="0" step="100000"></div>
                    </div>
                    <div class="form-actions" style="margin-top:14px;">
                        <button class="btn btn-accent" onclick="saveSalaryRecord()">💾 ثبت</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('salaryFormContainer').style.display='none';document.getElementById('salaryFormContainer').innerHTML='';">❌ انصراف</button>
                    </div>
                </div>
            `;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function saveSalaryRecord() {
    const rid = document.getElementById('sf_retiree_id').value;
    const yr = parseInt(document.getElementById('sf_year').value);
    const mn = parseInt(document.getElementById('sf_month').value);
    const base = parseFloat(document.getElementById('sf_base').value) || 0;
    const allow = parseFloat(document.getElementById('sf_allowances').value) || 0;
    if (!rid) return showToast('❌ لطفاً بازنشسته را انتخاب کنید', 'error');
    if (!yr || !mn) return showToast('❌ سال و ماه الزامی است', 'error');
    try {
        db.run(
            'INSERT INTO salary_records (retiree_id, year, month, base_salary, allowances) VALUES (?,?,?,?,?)',
            [rid, yr, mn, base, allow]);
        persistDB();
        document.getElementById('salaryFormContainer').style.display = 'none';
        document.getElementById('salaryFormContainer').innerHTML = '';
        loadSalaryRecords();
        // Update avg_salary for the retiree
        updateRetireeAvgSalary(rid);
        populateRetireeDropdowns();
        showToast('✅ سابقه حقوقی ثبت شد', 'success');
    } catch (err) {
        showToast('❌ خطا: ' + err.message, 'error');
    }
}

function deleteSalary(id) {
    if (!confirm('حذف این سابقه حقوقی؟')) return;
    const rec = db.exec('SELECT retiree_id FROM salary_records WHERE id=?', [id]);
    const rid = rec.length > 0 && rec[0].values.length > 0 ? rec[0].values[0][0] : null;
    db.run('DELETE FROM salary_records WHERE id=?', [id]);
    persistDB();
    loadSalaryRecords();
    if (rid) updateRetireeAvgSalary(rid);
    showToast('✅ سابقه حذف شد', 'success');
}

function updateRetireeAvgSalary(retireeId) {
    // Calculate average of last 24 salary records
    const data = db.exec(
        'SELECT total FROM salary_records WHERE retiree_id=? ORDER BY year DESC, month DESC LIMIT 24',
        [retireeId]);
    if (data.length > 0 && data[0].values.length > 0) {
        const totals = data[0].values.map(r => r[0]);
        const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
        db.run('UPDATE retirees SET avg_salary=? WHERE id=?', [Math.round(avg), retireeId]);
        persistDB();
    }
}

// ============================================================
// PENSION CALCULATION
// ============================================================
function autoFillCalc() {
    const rid = document.getElementById('calcRetireeSelect').value;
    if (!rid || !db) return;
    const res = db.exec(
        'SELECT service_years, avg_salary FROM retirees WHERE id=?', [rid]);
    if (res.length > 0 && res[0].values.length > 0) {
        const sy = res[0].values[0][0];
        const avs = res[0].values[0][1];
        // Auto-fill is handled during calculation
        document.getElementById('calcChildren').value = 0;
        document.getElementById('calcSpouse').value = '1';
    }
}

function calculatePension() {
    const rid = document.getElementById('calcRetireeSelect').value;
    const year = parseInt(document.getElementById('calcYear').value);
    const month = parseInt(document.getElementById('calcMonth').value);
    const children = parseInt(document.getElementById('calcChildren').value) || 0;
    const hasSpouse = parseInt(document.getElementById('calcSpouse').value) || 0;

    if (!rid) return showToast('❌ لطفاً بازنشسته را انتخاب کنید', 'error');
    if (!year || !month) return showToast('❌ سال و ماه محاسبه را مشخص کنید', 'error');

    const settings = getSettings();
    const res = db.exec('SELECT first_name, last_name, national_code, service_years, avg_salary FROM retirees WHERE id=?',
        [rid]);
    if (!res.length || !res[0].values.length) return showToast('❌ بازنشسته یافت نشد', 'error');

    const [fn, ln, nc, serviceYears, avgSalaryFromDB] = res[0].values[0];
    const avgSalary = avgSalaryFromDB || 0;
    const maxYears = settings.maxYears;
    const effectiveYears = Math.min(serviceYears, maxYears);

    // Base pension = (avg_salary * effective_years) / maxYears
    let basePension = (avgSalary * effectiveYears) / maxYears;
    // Cannot exceed avg salary
    basePension = Math.min(basePension, avgSalary);
    // Minimum pension = minWage (adjustable)
    basePension = Math.max(basePension, settings.minWage * 0.5);

    // Allowances
    const spouseAllowance = hasSpouse ? Math.round(settings.minWage * settings.spouseFactor / 100) : 0;
    const childAllowance = Math.round(children * settings.minWage * settings.childFactor / 100);

    // Gross
    const grossAmount = Math.round(basePension + spouseAllowance + childAllowance);

    // Deductions
    const insuranceDeduction = Math.round(grossAmount * settings.insuranceRate / 100);
    const supplementaryDeduction = settings.supplementaryIns;

    // Tax: annual exemption = settings.taxExemption, monthly ≈ annual/12
    const monthlyTaxExemption = Math.round(settings.taxExemption / 12);
    const taxableIncome = Math.max(0, grossAmount - monthlyTaxExemption);
    // Simplified progressive tax: 10% on taxable portion
    const taxDeduction = Math.round(taxableIncome * 0.10);

    const totalDeductions = insuranceDeduction + supplementaryDeduction + taxDeduction;
    const netAmount = grossAmount - totalDeductions;

    // Store result globally
    currentCalcResult = {
        retiree_id: parseInt(rid),
        retiree_name: fn + ' ' + ln,
        national_code: nc,
        calc_year: year,
        calc_month: month,
        base_pension: Math.round(basePension),
        spouse_allowance: spouseAllowance,
        child_allowance: childAllowance,
        gross_amount: grossAmount,
        insurance_deduction: insuranceDeduction,
        supplementary_deduction: supplementaryDeduction,
        tax_deduction: taxDeduction,
        total_deductions: totalDeductions,
        net_amount: netAmount,
        children_count: children,
        has_spouse: hasSpouse,
        service_years: serviceYears,
        avg_salary: avgSalary,
        effective_years: effectiveYears
    };

    // Display result
    const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی',
        'بهمن', 'اسفند'
    ];
    document.getElementById('calcBadge').textContent =
        `${fn} ${ln} | ${nc} | ${year}/${monthNames[month]}`;
    document.getElementById('calcResultBody').innerHTML = `
                <tr style="background:#f0f7ff;"><td><strong>متوسط حقوق مبنای محاسبه</strong></td><td class="amount-cell">${avgSalary.toLocaleString('fa-IR')}</td><td>میانگین ۲۴ ماه آخر</td></tr>
                <tr style="background:#f0f7ff;"><td><strong>سنوات خدمت مؤثر</strong></td><td colspan="2">${effectiveYears} سال (از ${serviceYears} سال کل)</td></tr>
                <tr><td><strong>حقوق پایه بازنشستگی</strong></td><td class="amount-cell">${Math.round(basePension).toLocaleString('fa-IR')}</td><td>(متوسط × سنوات) ÷ ${maxYears}</td></tr>
                <tr><td>کمک هزینه عائله‌مندی (همسر)</td><td class="amount-cell">${spouseAllowance.toLocaleString('fa-IR')}</td><td>${hasSpouse ? 'دارد' : 'ندارد'} (${settings.spouseFactor}٪ حداقل حقوق)</td></tr>
                <tr><td>کمک هزینه اولاد (${children} فرزند)</td><td class="amount-cell">${childAllowance.toLocaleString('fa-IR')}</td><td>${settings.childFactor}٪ حداقل حقوق به ازای هر فرزند</td></tr>
                <tr style="background:#f9fafb;font-weight:700;"><td><strong>ناخالص پرداختی</strong></td><td class="amount-cell" style="font-size:1.1rem;">${grossAmount.toLocaleString('fa-IR')}</td><td>جمع پایه + مزایا</td></tr>
                <tr style="color:#c0392b;"><td>کسر بیمه (۱/۹ سهم صندوق)</td><td class="amount-cell">(${insuranceDeduction.toLocaleString('fa-IR')})</td><td>${settings.insuranceRate.toFixed(2)}٪ ناخالص</td></tr>
                <tr style="color:#c0392b;"><td>کسر بیمه تکمیلی</td><td class="amount-cell">(${supplementaryDeduction.toLocaleString('fa-IR')})</td><td>ماهانه ثابت</td></tr>
                <tr style="color:#c0392b;"><td>کسر مالیات</td><td class="amount-cell">(${taxDeduction.toLocaleString('fa-IR')})</td><td>معافیت سالانه ${settings.taxExemption.toLocaleString('fa-IR')} ریال</td></tr>
                <tr style="background:#e8f5e9;font-weight:700;font-size:1.05rem;"><td><strong>💵 خالص پرداختی</strong></td><td class="amount-cell" style="font-size:1.2rem;color:#1a5276;">${netAmount.toLocaleString('fa-IR')}</td><td>ریال - قابل پرداخت</td></tr>
            `;
    document.getElementById('calcResultCard').style.display = 'block';
    document.getElementById('calcResultCard').scrollIntoView({ behavior: 'smooth' });
    showToast('✅ محاسبه با موفقیت انجام شد', 'success');
}

function clearCalcResult() {
    currentCalcResult = null;
    document.getElementById('calcResultCard').style.display = 'none';
    document.getElementById('calcResultBody').innerHTML = '';
    document.getElementById('calcBadge').textContent = '';
}

function savePayment() {
    if (!currentCalcResult) return showToast('❌ ابتدا محاسبه را انجام دهید', 'error');
    try {
        db.run(
            `INSERT INTO payments (retiree_id, calc_year, calc_month, base_pension, spouse_allowance, child_allowance, gross_amount, insurance_deduction, supplementary_deduction, tax_deduction, total_deductions, net_amount, children_count, has_spouse, notes)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                currentCalcResult.retiree_id,
                currentCalcResult.calc_year,
                currentCalcResult.calc_month,
                currentCalcResult.base_pension,
                currentCalcResult.spouse_allowance,
                currentCalcResult.child_allowance,
                currentCalcResult.gross_amount,
                currentCalcResult.insurance_deduction,
                currentCalcResult.supplementary_deduction,
                currentCalcResult.tax_deduction,
                currentCalcResult.total_deductions,
                currentCalcResult.net_amount,
                currentCalcResult.children_count,
                currentCalcResult.has_spouse,
                'محاسبه خودکار'
            ]
        );
        persistDB();
        refreshDashboard();
        loadPayments();
        showToast('✅ پرداخت با موفقیت ثبت شد', 'success');
    } catch (err) {
        showToast('❌ خطا در ثبت پرداخت: ' + err.message, 'error');
    }
}

function exportCalcCSV() {
    if (!currentCalcResult) return showToast('❌ ابتدا محاسبه را انجام دهید', 'error');
    const c = currentCalcResult;
    const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی',
        'بهمن', 'اسفند'
    ];
    const header =
        'کد ملی,نام,نام خانوادگی,سال,ماه,پایه بازنشستگی,عائله‌مندی,اولاد,ناخالص,کسر بیمه,بیمه تکمیلی,مالیات,جمع کسورات,خالص پرداختی,تعداد فرزند,همسر تحت تکفل';
    const row =
        `${c.national_code},${c.retiree_name.split(' ')[0]},${c.retiree_name.split(' ').slice(1).join(' ')},${c.calc_year},${monthNames[c.calc_month]},${c.base_pension},${c.spouse_allowance},${c.child_allowance},${c.gross_amount},${c.insurance_deduction},${c.supplementary_deduction},${c.tax_deduction},${c.total_deductions},${c.net_amount},${c.children_count},${c.has_spouse ? 'بله' : 'خیر'}`;
    downloadCSV(header + '\n' + row, 'calc_result_' + c.national_code + '_' + c.calc_year + '_' + c.calc_month +
        '.csv');
}

// ============================================================
// PAYMENTS
// ============================================================
function loadPayments() {
    if (!db) return;
    const data = db.exec(`
                SELECT p.id, r.first_name, r.last_name, r.national_code,
                       p.calc_year, p.calc_month, p.base_pension, p.spouse_allowance,
                       p.child_allowance, p.gross_amount, p.total_deductions, p.net_amount,
                       p.created_at
                FROM payments p
                JOIN retirees r ON p.retiree_id = r.id
                ORDER BY p.id DESC LIMIT 100
            `);
    const tbody = document.getElementById('paymentsTableBody');
    const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی',
        'بهمن', 'اسفند'
    ];
    if (data.length > 0 && data[0].values.length > 0) {
        tbody.innerHTML = data[0].values.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${r[1]} ${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${r[4]}/${monthNames[r[5]] || r[5]}</td>
                        <td class="amount-cell">${Number(r[6]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell">${Number(r[7]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell">${Number(r[8]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell">${Number(r[9]).toLocaleString('fa-IR')}</td>
                        <td class="amount-cell text-danger">(${Number(r[10]).toLocaleString('fa-IR')})</td>
                        <td class="amount-cell" style="font-weight:700;color:#1a5276;">${Number(r[11]).toLocaleString('fa-IR')}</td>
                        <td>${r[12] ? r[12].slice(0, 10) : '-'}</td>
                    </tr>
                `).join('');
    } else {
        tbody.innerHTML =
            '<tr><td colspan="11" class="empty-state"><span class="icon">📋</span> پرداختی ثبت نشده است</td></tr>';
    }
}

// ============================================================
// CSV EXPORTS
// ============================================================
function exportRetireesCSV() {
    if (!db) return;
    const data = db.exec(
        'SELECT national_code, first_name, last_name, father_name, birth_date, retirement_date, service_years, avg_salary, retiree_type FROM retirees WHERE is_active=1 ORDER BY last_name'
    );
    const header = 'کد ملی,نام,نام خانوادگی,نام پدر,تاریخ تولد,تاریخ بازنشستگی,سال خدمت,متوسط حقوق (ریال),نوع';
    let rows = '';
    if (data.length > 0 && data[0].values.length > 0) {
        rows = data[0].values.map(r => r.join(',')).join('\n');
    }
    downloadCSV(header + '\n' + rows, 'retirees_list.csv');
}

function exportPaymentsCSV() {
    if (!db) return;
    const data = db.exec(`
                SELECT r.national_code, r.first_name, r.last_name, p.calc_year, p.calc_month,
                       p.base_pension, p.spouse_allowance, p.child_allowance, p.gross_amount,
                       p.insurance_deduction, p.supplementary_deduction, p.tax_deduction,
                       p.total_deductions, p.net_amount, p.children_count, p.has_spouse, p.created_at
                FROM payments p JOIN retirees r ON p.retiree_id = r.id ORDER BY p.calc_year DESC, p.calc_month DESC
            `);
    const header =
        'کد ملی,نام,نام خانوادگی,سال,ماه,پایه بازنشستگی,عائله‌مندی,اولاد,ناخالص,کسر بیمه,بیمه تکمیلی,مالیات,جمع کسورات,خالص پرداختی,تعداد فرزند,همسر تحت تکفل,تاریخ ثبت';
    let rows = '';
    if (data.length > 0 && data[0].values.length > 0) {
        rows = data[0].values.map(r => r.join(',')).join('\n');
    }
    downloadCSV(header + '\n' + rows, 'monthly_payments.csv');
}

function exportSalariesCSV() {
    if (!db) return;
    const data = db.exec(`
                SELECT r.national_code, r.first_name, r.last_name, s.year, s.month, s.base_salary, s.allowances, s.total
                FROM salary_records s JOIN retirees r ON s.retiree_id = r.id ORDER BY s.year DESC, s.month DESC
            `);
    const header = 'کد ملی,نام,نام خانوادگی,سال,ماه,حقوق پایه,فوق‌العاده‌ها,جمع';
    let rows = '';
    if (data.length > 0 && data[0].values.length > 0) {
        rows = data[0].values.map(r => r.join(',')).join('\n');
    }
    downloadCSV(header + '\n' + rows, 'salary_history.csv');
}

function exportFullReportCSV() {
    if (!db) return;
    const data = db.exec(`
                SELECT r.national_code, r.first_name, r.last_name, r.service_years, r.avg_salary,
                       COALESCE((SELECT SUM(net_amount) FROM payments WHERE retiree_id=r.id),0) as total_paid,
                       COALESCE((SELECT COUNT(*) FROM payments WHERE retiree_id=r.id),0) as payment_count
                FROM retirees r WHERE r.is_active=1 ORDER BY r.last_name
            `);
    const header = 'کد ملی,نام,نام خانوادگی,سال خدمت,متوسط حقوق,جمع پرداختی,تعداد پرداخت';
    let rows = '';
    if (data.length > 0 && data[0].values.length > 0) {
        rows = data[0].values.map(r => r.join(',')).join('\n');
    }
    downloadCSV(header + '\n' + rows, 'full_report.csv');
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsToForm() {
    const s = getSettings();
    document.getElementById('setMinWage').value = s.minWage;
    document.getElementById('setSpouseFactor').value = s.spouseFactor;
    document.getElementById('setChildFactor').value = s.childFactor;
    document.getElementById('setInsuranceRate').value = s.insuranceRate;
    document.getElementById('setSupplementaryIns').value = s.supplementaryIns;
    document.getElementById('setTaxExemption').value = s.taxExemption;
    document.getElementById('setMaxYears').value = s.maxYears;
}

function saveSettings() {
    const settings = {
        minWage: parseFloat(document.getElementById('setMinWage').value) || DEFAULT_SETTINGS.minWage,
        spouseFactor: parseFloat(document.getElementById('setSpouseFactor').value) || DEFAULT_SETTINGS
            .spouseFactor,
        childFactor: parseFloat(document.getElementById('setChildFactor').value) || DEFAULT_SETTINGS.childFactor,
        insuranceRate: parseFloat(document.getElementById('setInsuranceRate').value) || DEFAULT_SETTINGS
            .insuranceRate,
        supplementaryIns: parseFloat(document.getElementById('setSupplementaryIns').value) || DEFAULT_SETTINGS
            .supplementaryIns,
        taxExemption: parseFloat(document.getElementById('setTaxExemption').value) || DEFAULT_SETTINGS
            .taxExemption,
        maxYears: parseFloat(document.getElementById('setMaxYears').value) || DEFAULT_SETTINGS.maxYears,
    };
    saveSettingsToStorage(settings);
    showToast('✅ تنظیمات با موفقیت ذخیره شد', 'success');
}

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
    await initDatabase();
    loadSettingsToForm();
    refreshAllUI();
    switchTab('dashboard');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Handle page unload - persist DB
window.addEventListener('beforeunload', () => {
    persistDB();
});

// Periodic auto-save (every 30 seconds)
setInterval(() => {
    if (db) persistDB();
}, 30000);

console.log('🏛️ سامانه محاسبه حقوق و مزایای بازنشستگان صندوق بازنشستگی کشوری');
console.log('✅ نسخه ۱.۰ - آماده به کار');
console.log('📋 قابلیت‌ها: مدیریت بازنشستگان | سوابق حقوق | محاسبه حقوق | خروجی CSV | ذخیره در SQLite');