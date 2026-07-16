/**
 * @file eventHandlers.js
 * @description Central event‑handling module. Binds all UI interactions, coordinates
 *              between repositories, calculation engine, and templates. Contains
 *              the core application behaviour functions.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.1
 * @history
 * 1.0.1 (2026-07-15) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular
 */

const EventHandlers = (() => {
    // Holds the most recent calculation result for saving / export
    let currentCalcResult = null;
    // temporary storage for dependent rows
    let currentDependents = [];

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
     * Populates all dropdowns that list retirees/pensioners (salary filter, calc select).
     * Now includes both retirees and pensioners.
     */
    function populateDropdowns() {
        const retirees = RetireesRepository.getAll();
        const pensioners = PensionersRepository.getAll();
        const options = '<option value="">-- انتخاب --</option>' +
            retirees.map(r => `<option value="retiree_${r.id}">${r.person.lastName} ${r.person.firstName} (مستمری‌بگیر)</option>`).join('') +
            pensioners.map(p => `<option value="pensioner_${p.id}">${p.person.lastName} ${p.person.firstName} (وظیفه‌بگیر)</option>`).join('');
        const salaryFilter = document.getElementById('salaryRetireeFilter');
        const calcSelect = document.getElementById('calcRetireeSelect');
        if (salaryFilter) salaryFilter.innerHTML = options;
        if (calcSelect) calcSelect.innerHTML = options;
    }

    // ----------------------------------------------------------------
    // Person Search & Inline Creation Helpers
    // ----------------------------------------------------------------
    /**
     * Attaches search logic to a person search input.
     * @param {string} prefix - e.g. 'rp_main', 'dep_0'
     */
    function attachPersonSearch(prefix) {
        const searchInput = document.getElementById(prefix + '_search');
        const resultsUl = document.getElementById(prefix + '_results');
        const newBtn = document.getElementById(prefix + '_new');
        const personIdHidden = document.getElementById(prefix + '_person_id');
        const inlineDiv = document.getElementById(prefix + '_inline');

        let timer;
        searchInput.addEventListener('input', function () {
            clearTimeout(timer);
            const q = this.value.trim();
            if (q.length < 2) {
                resultsUl.style.display = 'none';
                return;
            }
            timer = setTimeout(() => {
                const matches = PersonsRepository.searchByNameOrCode(q);
                if (matches.length) {
                    resultsUl.innerHTML = matches.map(m => `<li style="padding:4px 8px; cursor:pointer;" data-id="${m.id}" data-name="${m.fullName}">${m.fullName} (${m.nationalCode})</li>`).join('');
                    resultsUl.style.display = 'block';
                } else {
                    resultsUl.innerHTML = '<li style="padding:4px 8px; color:#999;">نتیجه‌ای یافت نشد</li>';
                    resultsUl.style.display = 'block';
                }
            }, 300);
        });

        resultsUl.addEventListener('click', function (e) {
            const li = e.target.closest('li');
            if (!li || !li.dataset.id) return;
            const id = li.dataset.id;
            const name = li.dataset.name;
            personIdHidden.value = id;
            searchInput.value = name;
            resultsUl.style.display = 'none';
            inlineDiv.style.display = 'none';   // hide inline fields if a person is selected
        });

        document.addEventListener('click', function (e) {
            if (!searchInput.contains(e.target) && !resultsUl.contains(e.target)) {
                resultsUl.style.display = 'none';
            }
        });

        newBtn.addEventListener('click', function () {
            // Clear hidden person id and show inline fields
            personIdHidden.value = '';
            searchInput.value = '';
            resultsUl.style.display = 'none';
            inlineDiv.style.display = 'block';
        });
    }

    /**
     * Collects person data from an inline form (prefix) and creates the person.
     * Returns the new person ID or null if the inline form is hidden (meaning existing person selected).
     */
    function saveInlinePersonIfNeeded(prefix) {
        const personIdHidden = document.getElementById(prefix + '_person_id');
        if (personIdHidden.value) {
            // Existing person selected
            return parseInt(personIdHidden.value);
        }
        const inlineDiv = document.getElementById(prefix + '_inline');
        if (!inlineDiv || inlineDiv.style.display === 'none') {
            // Not using inline
            return null;  // caller must handle validation
        }
        // Validate required fields
        const nationalCode = document.getElementById(prefix + '_nc').value.trim();
        const idNumber = document.getElementById(prefix + '_idnum').value.trim();
        const firstName = document.getElementById(prefix + '_fn').value.trim();
        const lastName = document.getElementById(prefix + '_ln').value.trim();
        if (!nationalCode || !idNumber || !firstName || !lastName) {
            showToast('❌ لطفاً تمام فیلدهای ضروری شخص جدید را پر کنید', 'error');
            throw new Error('Validation');
        }
        const person = {
            nationalCode,
            idNumber,
            firstName,
            lastName,
            fatherName: document.getElementById(prefix + '_father').value.trim(),
            birthDate: document.getElementById(prefix + '_bd').value.trim(),
            marriageStatus: parseInt(document.getElementById(prefix + '_married').value),
            childrenCount: parseInt(document.getElementById(prefix + '_children').value) || 0
        };
        const newId = PersonsRepository.add(person);
        if (window._persist) window._persist();
        return newId;
    }

    /**
     * Loads inline person fields with existing data (for editing).
     * @param {string} prefix
     * @param {Object} person - person object from a retiree/pensioner.
     */
    function fillInlinePersonFields(prefix, person) {
        if (!person) return;
        const fields = {
            nc: person.nationalCode,
            idnum: person.idNumber,
            fn: person.firstName,
            ln: person.lastName,
            father: person.fatherName,
            bd: person.birthDate,
            married: person.marriageStatus,
            children: person.childrenCount
        };
        for (const [key, value] of Object.entries(fields)) {
            const el = document.getElementById(prefix + '_' + key);
            if (el) el.value = value;
        }
    }

    // ----------------------------------------------------------------
    // Persons Tab
    // ----------------------------------------------------------------
    function loadPersons() {
        const persons = PersonsRepository.getAll();
        const tbody = document.getElementById('personsTableBody');
        if (persons.length) {
            tbody.innerHTML = persons.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.nationalCode}</td>
                    <td>${p.idNumber}</td>
                    <td>${p.firstName}</td>
                    <td>${p.lastName}</td>
                    <td>${p.fatherName || '-'}</td>
                    <td>${p.birthDate || '-'}</td>
                    <td>${p.marriageStatus ? 'متاهل' : 'مجرد'}</td>
                    <td>${p.childrenCount}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm edit-person" data-id="${p.id}">✏️</button>
                        <button class="btn btn-outline btn-sm history-person" data-id="${p.id}">📜</button>
                        <button class="btn btn-danger btn-sm delete-person" data-id="${p.id}">🗑️</button>
                    </td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">هیچ شخصی ثبت نشده</td></tr>';
        }
    }

    function showPersonForm(editId = null) {
        let data = null;
        if (editId) data = PersonsRepository.getById(parseInt(editId));
        const container = document.getElementById('personFormContainer');
        container.innerHTML = Templates.personForm(data);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        document.getElementById('btnSavePerson').addEventListener('click', savePerson);
        document.getElementById('btnCancelPerson').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    function savePerson(e) {
        const btn = e.target;
        const editId = btn.dataset.editId ? parseInt(btn.dataset.editId) : null;
        const person = {
            nationalCode: document.getElementById('pf_national_code').value.trim(),
            idNumber: document.getElementById('pf_id_number').value.trim(),
            firstName: document.getElementById('pf_first_name').value.trim(),
            lastName: document.getElementById('pf_last_name').value.trim(),
            fatherName: document.getElementById('pf_father_name').value.trim(),
            birthDate: document.getElementById('pf_birth_date').value.trim(),
            marriageStatus: parseInt(document.getElementById('pf_marriage_status').value),
            childrenCount: parseInt(document.getElementById('pf_children_count').value) || 0
        };
        if (!person.nationalCode || !person.idNumber || !person.firstName || !person.lastName) {
            return showToast('❌ فیلدهای ضروری را پر کنید', 'error');
        }
        try {
            if (editId) {
                PersonsRepository.update(editId, person);
            } else {
                PersonsRepository.add(person);
            }
            if (window._persist) window._persist();
            document.getElementById('personFormContainer').style.display = 'none';
            document.getElementById('personFormContainer').innerHTML = '';
            loadPersons();
            showToast('✅ شخص ذخیره شد', 'success');
        } catch (err) {
            showToast('❌ خطا: ' + err.message, 'error');
        }
    }

    function deletePerson(id) {
        if (!confirm('آیا از حذف این شخص اطمینان دارید؟')) return;
        try {
            PersonsRepository.remove(parseInt(id));
            if (window._persist) window._persist();
            loadPersons();
            showToast('✅ شخص حذف شد', 'success');
        } catch (err) {
            showToast('❌ خطا: ' + err.message, 'error');
        }
    }

    function showPersonHistory(id) {
        const person = PersonsRepository.getById(parseInt(id));
        if (!person) return;
        const log = PersonsRepository.getChangelog(id);
        const modalHtml = Templates.changelogModal(`${person.firstName} ${person.lastName}`, id, log);
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('changelogModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCloseChangelog') modal.remove();
        });
    }

    // ----------------------------------------------------------------
    // Retirees & Pensioners Combined Tab
    // ----------------------------------------------------------------
    /**
     * Loads the two separate listing tables (retirees and pensioners)
     * and populates them with data.
     */
    function loadRetireesPensioners() {
        const retirees = RetireesRepository.getAll();
        const pensioners = PensionersRepository.getAll();

        // Retirees table
        const tbodyR = document.getElementById('retireesTableBody');
        let rowsR = '';
        retirees.forEach((r, i) => {
            const depCount = RetireesRepository.getDependents(r.id).length;
            rowsR += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${r.person.nationalCode}</td>
                    <td>${r.person.firstName}</td>
                    <td>${r.person.lastName}</td>
                    <td>${r.personnelCode || '-'}</td>
                    <td>${r.retirementDate || '-'}</td>
                    <td>${r.ledgerNumber || '-'}</td>
                    <td>${r.veteranStatus || '-'}</td>
                    <td>${depCount}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm edit-rp" data-type="retiree" data-id="${r.id}">✏️</button>
                        <button class="btn btn-outline btn-sm history-rp" data-type="retiree" data-id="${r.id}">📜</button>
                        <button class="btn btn-danger btn-sm delete-rp" data-type="retiree" data-id="${r.id}">🗑️</button>
                    </td>
                </tr>`;
        });
        if (!rowsR) rowsR = '<tr><td colspan="10" class="empty-state">مستمری‌بگیری ثبت نشده</td></tr>';
        tbodyR.innerHTML = rowsR;

        // Pensioners table
        const tbodyP = document.getElementById('pensionersTableBody');
        let rowsP = '';
        pensioners.forEach((p, i) => {
            rowsP += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.person.nationalCode}</td>
                    <td>${p.person.firstName}</td>
                    <td>${p.person.lastName}</td>
                    <td>${p.deceased.lastName}-${p.deceased.firstName}</td>
                    <td>${p.inheritanceCode || '-'}</td>
                    <td>${p.ledgerNumber || '-'}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm edit-rp" data-type="pensioner" data-id="${p.id}">✏️</button>
                        <button class="btn btn-outline btn-sm history-rp" data-type="pensioner" data-id="${p.id}">📜</button>
                        <button class="btn btn-danger btn-sm delete-rp" data-type="pensioner" data-id="${p.id}">🗑️</button>
                    </td>
                </tr>`;
        });
        if (!rowsP) rowsP = '<tr><td colspan="7" class="empty-state">وظیفه‌بگیری ثبت نشده</td></tr>';
        tbodyP.innerHTML = rowsP;
    }

    /**
     * Shows the add/edit form for a retiree or pensioner.
     * @param {string} type - 'retiree' or 'pensioner'.
     * @param {number|null} editId - ID of existing entity to edit, or null.
     */
    function showRetireePensionerForm(type = 'retiree', editId = null) {
        let data = null;
        if (editId) {
            if (type === 'retiree') {
                data = RetireesRepository.getById(parseInt(editId));
                if (data) data.type = 'retiree';
            } else {
                data = PensionersRepository.getById(parseInt(editId));
                if (data) data.type = 'pensioner';
            }
        }

        const container = document.getElementById('retireePensionerFormContainer');
        container.innerHTML = Templates.retireePensionerForm(data, type);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        // Main person – locked if editing, search/inline if new
        if (data && data.personId) {
            // Already handled by template: it shows a read-only field with hidden ID
        } else {
            attachPersonSearch('rp_main');
        }

        // Deceased person (pensioner only)
        if (type === 'pensioner') {
            if (data && data.deceasedId) {
                // locked – handled by template
            } else {
                attachPersonSearch('rp_deceased');
            }
        }

        // Initialize dependents for retirees
        if (type === 'retiree') {
            currentDependents = data?.dependents ? data.dependents.map(d => ({
                personId: d.personId,
                tabeiType: d.dependentType,
                personName: d.person ? d.person.firstName + ' ' + d.person.lastName : '',
                personNationalCode: d.person ? d.person.nationalCode : ''
            })) : [];
        } else {
            currentDependents = [];
        }
        renderDependents();

        // Add dependent button (retiree only)
        if (type === 'retiree') {
            const addDepBtn = document.getElementById('btnAddDependent');
            if (addDepBtn) {
                const newBtn = addDepBtn.cloneNode(true);
                addDepBtn.parentNode.replaceChild(newBtn, addDepBtn);
                newBtn.addEventListener('click', () => {
                    currentDependents.push({ personId: null, tabeiType: '1', personName: '', personNationalCode: '' });
                    renderDependents();
                });
            }
            // Delegate remove-dependent clicks
            const depContainer = document.getElementById('dependentsContainer');
            if (depContainer) {
                depContainer.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.btnRemoveDependent');
                    if (removeBtn) {
                        const idx = parseInt(removeBtn.closest('.dependent-item').dataset.index);
                        currentDependents.splice(idx, 1);
                        renderDependents();
                    }
                });
            }
        }

        // Save and Cancel buttons
        document.getElementById('btnSaveRetireePensioner').addEventListener('click', function () {
            saveRetireePensioner(type, editId ? parseInt(editId) : null);
        });

        document.getElementById('btnCancelRetireePensioner').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    /**
     * Renders all dependent rows into the container.
     * Locks rows that already have a personId.
     */
    function renderDependents() {
        const container = document.getElementById('dependentsContainer');
        if (!container) return;
        let html = '';
        currentDependents.forEach((dep, idx) => {
            const locked = (dep.personId !== null && dep.personId !== undefined);
            html += Templates.dependentRow(dep, idx, locked);
        });
        container.innerHTML = html;
        // Attach search only to unlocked rows
        currentDependents.forEach((dep, idx) => {
            if (!dep.personId) {
                attachPersonSearch('dep_' + idx);
            }
        });
    }

    /**
     * Collects the dependent data from the form, handling both
     * locked (existing) and new rows.
     * @returns {Array} Array of { personId, dependentType } objects.
     */
    function collectDependentsFromForm() {
        const items = document.querySelectorAll('#dependentsContainer .dependent-item');
        return Array.from(items).map(item => {
            const type = parseInt(item.querySelector('.dep-type').value);
            const hiddenPersonId = item.querySelector('.dep-person-id');
            if (hiddenPersonId) {
                // Locked row – use hidden id
                return {
                    personId: parseInt(hiddenPersonId.value),
                    dependentType: type
                };
            } else {
                // New row – collect from search/inline
                const idx = parseInt(item.dataset.index);
                const personId = saveInlinePersonIfNeeded('dep_' + idx);
                if (!personId) throw new Error('شخص تبعی انتخاب نشده');
                return { personId, dependentType: type };
            }
        });
    }

    /**
     * Saves a retiree or pensioner (add or update).
     * @param {string} type - 'retiree' or 'pensioner'.
     * @param {number|null} editId
     */
    function saveRetireePensioner(type, editId) {
        try {
            // Main person
            const mainPersonId = editId
                ? parseInt(document.getElementById('rp_main_person_id').value)  // locked
                : saveInlinePersonIfNeeded('rp_main');
            if (!mainPersonId) return showToast('❌ شخص اصلی مشخص نشده', 'error');

            if (type === 'retiree') {
                const retireeData = {
                    personId: mainPersonId,
                    personnelCode: document.getElementById('rp_personnel_code')?.value.trim() || '',
                    retirementDate: document.getElementById('rp_retirement_date')?.value.trim() || '',
                    ledgerNumber: document.getElementById('rp_ledger_number').value.trim(),
                    veteranStatus: document.getElementById('rp_veteran_status')?.value.trim() || '',
                    dependents: collectDependentsFromForm()
                };
                if (editId) RetireesRepository.update(editId, retireeData);
                else RetireesRepository.add(retireeData);
            } else { // pensioner
                const deceasedPersonId = editId
                    ? parseInt(document.getElementById('rp_deceased_person_id').value)  // locked
                    : saveInlinePersonIfNeeded('rp_deceased');
                if (!deceasedPersonId) return showToast('❌ شخص متوفی مشخص نشده', 'error');
                const pensionerData = {
                    personId: mainPersonId,
                    deceasedId: deceasedPersonId,
                    ledgerNumber: document.getElementById('rp_ledger_number').value.trim(),
                    inheritanceCode: document.getElementById('rp_inheritance_code')?.value.trim() || ''
                };
                if (editId) PensionersRepository.update(editId, pensionerData);
                else PensionersRepository.add(pensionerData);
            }

            if (window._persist) window._persist();
            document.getElementById('retireePensionerFormContainer').style.display = 'none';
            document.getElementById('retireePensionerFormContainer').innerHTML = '';
            loadRetireesPensioners();
            populateDropdowns();
            showToast('✅ ذخیره شد', 'success');
        } catch (e) {
            if (e.message !== 'Validation') showToast('❌ خطا: ' + e.message, 'error');
        }
    }

    function deleteRetireePensioner(type, id) {
        if (!confirm('آیا از حذف این مورد اطمینان دارید؟')) return;
        if (type === 'retiree') {
            RetireesRepository.remove(parseInt(id));
        } else {
            PensionersRepository.remove(parseInt(id));
        }
        if (window._persist) window._persist();
        loadRetireesPensioners();
        populateDropdowns();
        showToast('✅ حذف شد', 'success');
    }

    /**
     * Displays the changelog history for a retiree or pensioner.
     * @param {string} type - 'retiree' or 'pensioner'.
     * @param {string|number} id
     */
    function showRetireePensionerHistory(type, id) {
        let name = '';
        let log = [];
        if (type === 'retiree') {
            const r = RetireesRepository.getById(parseInt(id));
            if (!r) return;
            name = `${r.person.firstName} ${r.person.lastName}`;
            log = RetireesRepository.getChangelog(id);
        } else {
            const p = PensionersRepository.getById(parseInt(id));
            if (!p) return;
            name = `${p.person.firstName} ${p.person.lastName}`;
            log = PensionersRepository.getChangelog(id);
        }
        const modalHtml = Templates.changelogModal(name, id, log);
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('changelogModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCloseChangelog') modal.remove();
        });
    }

    // ----------------------------------------------------------------
    // Salaries (mostly unchanged, uses combined dropdown)
    // ----------------------------------------------------------------
    function loadSalaryRecords() {
        const filterValue = document.getElementById('salaryRetireeFilter').value;
        let retireeId = null;
        let type = null;
        if (filterValue.startsWith('retiree_')) {
            retireeId = parseInt(filterValue.replace('retiree_', ''));
            type = 'retiree';
        } else if (filterValue.startsWith('pensioner_')) {
            retireeId = parseInt(filterValue.replace('pensioner_', ''));
            type = 'pensioner';
        }
        // For now salary records only linked to retirees. Could be extended.
        const records = SalaryRepository.getAll(retireeId ? { retireeId } : {});
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

    function showSalaryForm() {
        const container = document.getElementById('salaryFormContainer');
        container.innerHTML = Templates.salaryForm();
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        populateDropdowns(); // ensure the select is filled
        document.getElementById('btnSaveSalary').addEventListener('click', saveSalary);
        document.getElementById('btnCancelSalary').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    function saveSalary() {
        const filterValue = document.getElementById('sf_retiree_id').value;
        let retireeId = null;
        if (filterValue.startsWith('retiree_')) {
            retireeId = parseInt(filterValue.replace('retiree_', ''));
        } else if (filterValue.startsWith('pensioner_')) {
            retireeId = parseInt(filterValue.replace('pensioner_', ''));
        }
        if (!retireeId) return showToast('❌ یک بازنشسته/وظیفه‌بگیر انتخاب کنید', 'error');
        const record = {
            retireeId,
            year: parseInt(document.getElementById('sf_year').value),
            month: parseInt(document.getElementById('sf_month').value),
            baseSalary: parseFloat(document.getElementById('sf_base').value) || 0,
            allowances: parseFloat(document.getElementById('sf_allowances').value) || 0
        };
        SalaryRepository.add(record);
        if (window._persist) window._persist();
        document.getElementById('salaryFormContainer').style.display = 'none';
        document.getElementById('salaryFormContainer').innerHTML = '';
        loadSalaryRecords();
        showToast('✅ سابقه حقوق ثبت شد', 'success');
    }

    function deleteSalary(id) {
        if (!confirm('حذف شود؟')) return;
        SalaryRepository.remove(parseInt(id));
        if (window._persist) window._persist();
        loadSalaryRecords();
        showToast('✅ حذف شد', 'success');
    }

    // ----------------------------------------------------------------
    // Calculation (unchanged logic, but retiree/pensioner handling)
    // ----------------------------------------------------------------
    function calculatePension() {
        const selVal = document.getElementById('calcRetireeSelect').value;
        let retiree = null;
        let type = '';
        if (selVal.startsWith('retiree_')) {
            const id = parseInt(selVal.replace('retiree_', ''));
            retiree = RetireesRepository.getById(id);
            type = 'retiree';
        } else if (selVal.startsWith('pensioner_')) {
            const id = parseInt(selVal.replace('pensioner_', ''));
            retiree = PensionersRepository.getById(id);
            type = 'pensioner';
        }
        if (!retiree) return showToast('❌ بازنشسته/وظیفه‌بگیر را انتخاب کنید', 'error');

        const children = parseInt(document.getElementById('calcChildren').value) || 0;
        const hasSpouse = parseInt(document.getElementById('calcSpouse').value) || 0;
        const year = parseInt(document.getElementById('calcYear').value);
        const month = parseInt(document.getElementById('calcMonth').value);

        // For simplicity, we use the person's marriage_status and children_count from the person record
        // But the calc form overrides are separate. We'll use the form values as overrides.
        const settings = SettingsService.get();
        const incomeItems = ItemsRepository.getIncomes();
        const deductionItems = ItemsRepository.getDeductions();
        // For dependents counts (tabei types) we need actual dependents; we can fetch from retiree if exists
        let dependentCounts = { type1Count: 0, type2Count: 0, type3Count: 0 };
        if (type === 'retiree') {
            const deps = RetireesRepository.getDependents(retiree.id);
            dependentCounts = {
                type1Count: deps.filter(d => d.dependentType === 1).length,
                type2Count: deps.filter(d => d.dependentType === 2).length,
                type3Count: deps.filter(d => d.dependentType === 3).length
            };
        }
        const result = CalcEngine.calculate(
            { avgSalary: retiree.person?.avgSalary || 0, serviceYears: 0, hasSpouse: retiree.person?.marriageStatus, childrenCount: retiree.person?.childrenCount },
            settings, incomeItems, deductionItems,
            { spouse: hasSpouse, childrenUnder18: children, ...dependentCounts }
        );

        currentCalcResult = {
            retireeId: retiree.id,
            retireeType: type,
            retireeName: retiree.person.firstName + ' ' + retiree.person.lastName,
            nationalCode: retiree.person.nationalCode,
            calcYear: year,
            calcMonth: month,
            childrenCount: children,
            hasSpouse,
            ...result
        };
        // ... display result (same as before)
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        document.getElementById('calcBadge').textContent = `${currentCalcResult.retireeName} | ${year}/${monthNames[month]}`;
        let html = '';
        result.incomes.forEach(inc => html += `<tr><td>${inc.name}</td><td class="amount-cell">${inc.amount.toLocaleString('fa-IR')}</td><td>درآمد</td></tr>`);
        html += `<tr style="background:#f9fafb;font-weight:700;"><td>ناخالص</td><td class="amount-cell">${result.grossAmount.toLocaleString('fa-IR')}</td><td></td></tr>`;
        result.deductions.forEach(ded => html += `<tr style="color:#c0392b;"><td>${ded.name}</td><td class="amount-cell">(${ded.amount.toLocaleString('fa-IR')})</td><td>کسور</td></tr>`);
        html += `<tr style="background:#e8f5e9;font-weight:700;"><td>💵 خالص پرداختی</td><td class="amount-cell" style="font-size:1.2rem;">${result.netAmount.toLocaleString('fa-IR')}</td><td>ریال</td></tr>`;
        document.getElementById('calcResultBody').innerHTML = html;
        document.getElementById('calcResultCard').style.display = 'block';
        document.getElementById('calcResultCard').scrollIntoView({ behavior: 'smooth' });
    }

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
    // Payments, Items, Settings, Exports (mostly unchanged)
    // ----------------------------------------------------------------
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

    function deleteItem(type, id) {
        if (!confirm('حذف شود؟')) return;
        if (type === 'income') ItemsRepository.deleteIncome(parseInt(id));
        else ItemsRepository.deleteDeduction(parseInt(id));
        if (window._persist) window._persist();
        loadItemsList();
        showToast('✅ حذف شد', 'success');
    }

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
    // Dashboard Refresh
    // ----------------------------------------------------------------
    function refreshDashboard() {
        const totalPersons = PersonsRepository.getAll().length;
        const totalRetirees = RetireesRepository.getAll().length;
        const totalPensioners = PensionersRepository.getAll().length;
        const payments = PaymentsRepository.getAll();
        const totalPayments = payments.length;
        const totalNet = payments.reduce((sum, p) => sum + p.netAmount, 0);

        document.getElementById('dashboardStats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${totalPersons}</div><div class="stat-label">اشخاص</div></div>
            <div class="stat-card accent"><div class="stat-value">${totalRetirees + totalPensioners}</div><div class="stat-label">بازنشسته/وظیفه‌بگیر</div></div>
            <div class="stat-card warning"><div class="stat-value">${totalPayments}</div><div class="stat-label">پرداخت‌ها</div></div>
            <div class="stat-card"><div class="stat-value">${Math.round(totalNet).toLocaleString('fa-IR')}</div><div class="stat-label">مجموع خالص</div></div>`;
        const recent = payments.slice(0, 5);
        const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        const tbody = document.getElementById('dashboardRecentCalcs');
        if (recent.length) {
            tbody.innerHTML = recent.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.firstName} ${p.lastName}</td>
                    <td>${p.nationalCode}</td>
                    <td>${p.calcYear}/${monthNames[p.calcMonth]}</td>
                    <td class="amount-cell">${p.netAmount.toLocaleString('fa-IR')}</td>
                    <td style="color:#27ae60;">✅</td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">محاسبه‌ای ثبت نشده</td></tr>';
        }
    }

    // ----------------------------------------------------------------
    // Event Binding
    // ----------------------------------------------------------------
    function bindAll() {
        // Tabs
        document.getElementById('tabNav').addEventListener('click', e => {
            if (e.target.classList.contains('tab-btn')) UIManager.switchTab(e.target.dataset.tab);
        });

        // Header
        document.getElementById('btnExportDB').addEventListener('click', Exports.dbFile);
        document.getElementById('btnImportDB').addEventListener('click', () => document.getElementById('importFileInput').click());
        document.getElementById('importFileInput').addEventListener('change', e => {
            if (e.target.files[0]) Exports.importDBFile(e.target.files[0]);
            e.target.value = '';
        });
        document.getElementById('btnPrint').addEventListener('click', () => window.print());
        document.getElementById('btnExportJSON').addEventListener('click', Exports.jsonExport);

        // Persons tab
        document.getElementById('btnAddPerson').addEventListener('click', () => showPersonForm());
        document.getElementById('personsTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.classList.contains('edit-person')) showPersonForm(btn.dataset.id);
            else if (btn.classList.contains('delete-person')) deletePerson(btn.dataset.id);
            else if (btn.classList.contains('history-person')) showPersonHistory(btn.dataset.id);
        });

        // Retirees/Pensioners tab
        document.getElementById('btnAddRetiree').addEventListener('click', () => showRetireePensionerForm('retiree'));
        document.getElementById('retireesTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            if (btn.classList.contains('edit-rp')) showRetireePensionerForm(type, id);
            else if (btn.classList.contains('delete-rp')) deleteRetireePensioner(type, id);
            else if (btn.classList.contains('history-rp')) showRetireePensionerHistory(type, id);
        });
        document.getElementById('btnAddPensioner').addEventListener('click', () => showRetireePensionerForm('pensioner'));
        document.getElementById('pensionersTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            if (btn.classList.contains('edit-rp')) showRetireePensionerForm(type, id);
            else if (btn.classList.contains('delete-rp')) deleteRetireePensioner(type, id);
            else if (btn.classList.contains('history-rp')) showRetireePensionerHistory(type, id);
        });

        // Salaries
        document.getElementById('salaryRetireeFilter').addEventListener('change', loadSalaryRecords);
        document.getElementById('btnAddSalary').addEventListener('click', showSalaryForm);
        document.getElementById('salaryTableBody').addEventListener('click', e => {
            if (e.target.classList.contains('delete-salary')) deleteSalary(e.target.dataset.id);
        });

        // Calc
        document.getElementById('btnCalc').addEventListener('click', calculatePension);
        document.getElementById('btnClearCalc').addEventListener('click', () => {
            currentCalcResult = null;
            document.getElementById('calcResultCard').style.display = 'none';
        });
        document.getElementById('btnSavePayment').addEventListener('click', savePayment);
        document.getElementById('btnExportCalcCSV').addEventListener('click', () => Exports.calcCSV(currentCalcResult));

        // Payments
        document.getElementById('btnExportPaymentsCSV').addEventListener('click', Exports.paymentsCSV);

        // Export tab
        document.getElementById('exportPersons').addEventListener('click', () => {
            // implement CSV export for persons if needed
        });
        document.getElementById('exportRetireesPensioners').addEventListener('click', () => {
            // combine retirees/pensioners export
        });
        document.getElementById('exportSalaries').addEventListener('click', Exports.salariesCSV);
        document.getElementById('exportFullReport').addEventListener('click', Exports.fullReportCSV);

        // Settings
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

    return {
        bindAll,
        showToast,
        refreshDashboard,
        loadPersons,
        loadRetireesPensioners,
        loadSalaryRecords,
        loadPayments,
        loadItemsList,
        loadSettingsForm,
        populateDropdowns,
        showPersonForm,
        showRetireePensionerForm,
        saveRetireePensioner,
        deleteRetireePensioner,
        deletePerson,
        showSalaryForm,
        saveSalary,
        deleteSalary,
        calculatePension,
        savePayment,
        showItemForm,
        deleteItem,
        saveSettings
    };
})();
