/**
 * @file eventHandlers.js
 * @description Central event‑handling module. Binds all UI interactions, coordinates
 *              between repositories, calculation engine, and templates. Contains
 *              the core application behaviour functions.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.4
 * @history
 * 1.0.4 (2026-07-23) - Payslip UI
 * 1.0.3 (2026-07-19) - Implementing Unified Item
 * 1.0.2 (2026-07-17) - Implementing Decree
 * 1.0.1 (2026-07-15) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular
 */

const EventHandlers = (() => {
    // Holds the most recent calculation result for saving / export
    let currentCalcResult = null;
    // temporary storage for dependent rows
    let currentDependents = [];
    // temporary list of persons (retirees and pensioners)
    let currentPersons = [];

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
    // Decrees Tab
    // ----------------------------------------------------------------
    function loadDecrees() {
        const personId = document.getElementById('decreePersonFilter').value.split('-')[0];
        if (!personId) {
            document.getElementById('decreesTableBody').innerHTML =
                '<tr><td colspan="9" class="empty-state">لطفاً یک شخص را انتخاب کنید</td></tr>';
            return;
        }
        const decrees = DecreeRepository.getByPersonId(parseInt(personId));

        const tbody = document.getElementById('decreesTableBody');
        if (decrees.length) {
            tbody.innerHTML = decrees.map((d, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td>${d.decreeNumber || '-'}</td>
                    <td>${d.title || '-'}</td>
                    <td>${d.issueDate || '-'}</td>
                    <td>${d.effectiveFrom || '-'}</td>
                    <td>${d.isActive ? '<span style="color:green;">فعال</span>' : '<span style="color:red;">غیرفعال</span>'}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm view-decree" data-id="${d.id}">👁️</button>
                        <button class="btn btn-danger btn-sm delete-decree" data-id="${d.id}">🗑️</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">حکمی صادر نشده</td></tr>';
        }
    }

    function showDecreeForm() {
        const personFilterValue = document.getElementById('decreePersonFilter').value;
        const parts = personFilterValue ? personFilterValue.split('-') : [];
        const prefillPersonId = parts.length === 2 ? parseInt(parts[0]) : null;
        const prefillType = parts.length === 2 ? parts[1] : 'retiree';

        const container = document.getElementById('decreeFormContainer');
        container.innerHTML = Templates.decreeForm(null, prefillPersonId, prefillType);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        const currentType = document.getElementById('dc_type').value;
        repopulateDecreeFormFilter(currentType, prefillPersonId);

        document.getElementById('dc_type').addEventListener('change', function () {
            const newType = this.value;
            repopulateDecreeFormFilter(newType, null);   // clear pre‑selected person
        });

        // Save / Cancel
        document.getElementById('btnSaveDecree').addEventListener('click', saveDecree);
        document.getElementById('btnCancelDecree').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });

        if (prefillPersonId) {
            const personSelect = document.getElementById('dc_person_id');
            if (personSelect) personSelect.disabled = true;
        }
    }

    function saveDecree() {
        const type = document.getElementById('dc_type').value;
        const personId = parseInt(document.getElementById('dc_person_id').value);
        const title = document.getElementById('dc_title').value.trim();
        const decreeNumber = document.getElementById('dc_decree_number').value.trim();
        const issueDate = document.getElementById('dc_issue_date').value.trim();
        const effectiveFrom = document.getElementById('dc_effective_from').value.trim();
        if (!personId) return showToast('❌ شخص را انتخاب کنید', 'error');
        if (!effectiveFrom) return showToast('❌ تاریخ اجرا را وارد کنید', 'error');

        const itemInputs = document.querySelectorAll('.decree-item-amount');
        const items = [];
        itemInputs.forEach(inp => {
            const amount = parseFloat(inp.value);
            if (!isNaN(amount) && amount !== 0) {
                items.push({
                    itemDefinitionId: parseInt(inp.dataset.itemId),
                    isIncome: inp.dataset.isIncome === '1',
                    amount
                });
            }
        });

        try {
            DecreeRepository.add({ personId, type, title, decreeNumber, issueDate, effectiveFrom, items });
            if (window._persist) window._persist();
            document.getElementById('decreeFormContainer').style.display = 'none';
            document.getElementById('decreeFormContainer').innerHTML = '';
            loadDecrees();
            showToast('✅ حکم صادر شد', 'success');
        } catch (e) {
            showToast('❌ خطا: ' + e.message, 'error');
        }
    }

    function viewDecree(decreeId) {
        const decree = DecreeRepository.getById(decreeId);
        if (!decree) return showToast('حکم یافت نشد', 'error');
        // Show read-only form
        const container = document.getElementById('decreeFormContainer');
        
        container.innerHTML = Templates.decreeForm(decree);
        container.style.display = 'block';
        // Disable all inputs
        container.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
        repopulateDecreeFormFilter(decree.type, decree.personId);
        document.getElementById('btnCancelDecree').addEventListener('click', () => {
            container.style.display = 'none';
            container.innerHTML = '';
        });
    }

    function deleteDecree(decreeId) {
        if (!confirm('آیا از حذف این حکم اطمینان دارید؟')) return;
        try {
            DecreeRepository.remove(decreeId);
            if (window._persist) window._persist();
            loadDecrees();
            showToast('✅ حکم حذف شد', 'success');
        } catch (e) {
            showToast('❌ امکان حذف وجود ندارد. حکم در حال استفاده است.', 'error');
        }
    }

    function populateDecreePersonFilter() {
        const retirees = RetireesRepository.getAll();
        const pensioners = PensionersRepository.getAll();
        const options = '<option value="">-- انتخاب شخص --</option>' +
            retirees.map(p => `<option value="${p.personId}-retiree">${p.person.lastName} ${p.person.firstName} (${p.person.nationalCode})</option>`).join('') +
            pensioners.map(p => `<option value="${p.personId}-pensioner">${p.person.lastName} ${p.person.firstName} (${p.person.nationalCode})</option>`).join('');
        document.getElementById('decreePersonFilter').innerHTML = options;  
    }

    /**
     * Refills the 'person' dropdown in the decree form based on the selected type.
     * @param {string} selectedType - 'retiree' or 'pensioner'
     * @param {number|null} selectedPersonId - Pre‑select this person if provided.
     */
    function repopulateDecreeFormFilter(selectedType = 'retiree', selectedPersonId = null) {
        const decreeFormFilter = document.getElementById('dc_person_id');
        if (!decreeFormFilter) return;

        const retirees = RetireesRepository.getAll();
        const pensioners = PensionersRepository.getAll();

        let options = '<option value="">-- انتخاب شخص --</option>';

        if (selectedType === 'retiree') {
            options += retirees.map(r => {
                const sel = (r.personId == selectedPersonId) ? ' selected' : '';
                return `<option value="${r.personId}"${sel}>${r.person.lastName} ${r.person.firstName} (${r.person.nationalCode})</option>`;
            }).join('');
        } else if (selectedType === 'pensioner') {
            options += pensioners.map(p => {
                const sel = (p.personId == selectedPersonId) ? ' selected' : '';
                return `<option value="${p.personId}"${sel}>${p.person.lastName} ${p.person.firstName} (${p.person.nationalCode})</option>`;
            }).join('');
        }

        decreeFormFilter.innerHTML = options;
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
    // Payslips Tab
    // ----------------------------------------------------------------
    function loadPayslips() {
        const year = parseInt(document.getElementById('psYear').value);
        const month = parseInt(document.getElementById('psMonth').value);
        if (!year || !month) return;

        const payslips = PayslipRepository.getByFilters({ year, month });
        // Augment with person data
        const augmented = payslips.map(ps => {
            const person = PersonsRepository.getById(ps.personId);
            // determine type by checking retirees/pensioners (simplified: we can store type in payslip? no, we need to infer)
            // We'll fetch from RetireesRepository and PensionersRepository
            let type = 'retiree';
            let firstName = person?.firstName || '';
            let lastName = person?.lastName || '';
            let nationalCode = person?.nationalCode || '';
            // Check if person is a retiree or pensioner (we can look up by personId)
            const retiree = RetireesRepository.getAll().find(r => r.personId === ps.personId);
            if (retiree) type = 'retiree';
            const pensioner = PensionersRepository.getAll().find(p => p.personId === ps.personId);
            if (pensioner) type = 'pensioner';
            return { ...ps, firstName, lastName, nationalCode, type };
        });

        const tbody = document.getElementById('payslipsTableBody');
        if (augmented.length) {
            tbody.innerHTML = augmented.map((ps, i) => Templates.payslipRow(ps, i)).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">فیشی برای این ماه وجود ندارد</td></tr>';
        }
    }

    function calculateAllPayslips() {
        const year = parseInt(document.getElementById('psYear').value);
        const month = parseInt(document.getElementById('psMonth').value);
        if (!year || !month) return showToast('❌ سال و ماه را انتخاب کنید', 'error');

        if (!confirm(`آیا از محاسبه گروهی فیش‌های حقوق برای ${year}/${month} اطمینان دارید؟`)) return;

        const result = PayslipCalculator.calculateAll(year, month);
        showToast(`✅ ${result.created} فیش محاسبه شد. ${result.skipped} مورد رد شد.`, 'success');
        if (result.errors.length) {
            console.warn('Payslip calculation errors:', result.errors);
        }
        loadPayslips();
    }

    function viewPayslip(payslipId) {
        const ps = PayslipRepository.getById(payslipId);
        if (!ps) return showToast('فیش یافت نشد', 'error');
        // Add person data
        const person = PersonsRepository.getById(ps.personId);
        const type = (RetireesRepository.getAll().some(r => r.personId === ps.personId)) ? 'retiree' : 'pensioner';
        const detail = { ...ps, firstName: person.firstName, lastName: person.lastName, type, nationalCode: person.nationalCode };
        const container = document.getElementById('payslipDetailContainer');
        container.innerHTML = Templates.payslipDetail(detail);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }

    function deletePayslip(payslipId) {
        if (!confirm('آیا از حذف این فیش اطمینان دارید؟')) return;
        const success = PayslipRepository.remove(payslipId);
        if (success) {
            if (window._persist) window._persist();
            loadPayslips();
            showToast('✅ فیش حذف شد', 'success');
        } else {
            showToast('❌ فقط فیش‌های محاسبه شده قابل حذف هستند', 'error');
        }
    }

    function showAddItemForm(payslipId = null, bulk = false) {
        document.body.insertAdjacentHTML('beforeend', Templates.addPayslipItemForm({ payslipId, bulk }));
        const modal = document.getElementById('addItemModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCancelAddItem') modal.remove();
        });

        document.getElementById('btnConfirmAddItem').addEventListener('click', function () {
            const itemDefId = parseInt(document.getElementById('selectPayslipItem').value);
            const amount = parseFloat(document.getElementById('addItemAmount').value) || 0;
            if (!itemDefId) return showToast('❌ آیتم را انتخاب کنید', 'error');

            const itemDef = ItemsRepository.getById(itemDefId);
            if (!itemDef) return showToast('آیتم نامعتبر', 'error');

            const itemData = {
                name: itemDef.name,
                formula: itemDef.formula,
                amount: amount || itemDef.amount,
                isIncome: itemDef.isIncome,
                source: PayslipRepository.SOURCE.PAYSLIP_ITEM,
                referenceId: itemDef.id
            };

            if (bulk) {
                const scope = document.getElementById('bulkScope').value;
                const year = parseInt(document.getElementById('psYear').value);
                const month = parseInt(document.getElementById('psMonth').value);
                let filters = { year, month };
                if (scope === 'retiree' || scope === 'pensioner') {
                    // we need to filter payslips by type; we'll get all and filter
                    const all = PayslipRepository.getByFilters({ year, month });
                    let targetIds = [];
                    for (const ps of all) {
                        const person = PersonsRepository.getById(ps.personId);
                        const isRetiree = RetireesRepository.getAll().some(r => r.personId === ps.personId);
                        if (scope === 'retiree' && isRetiree) targetIds.push(ps.id);
                        else if (scope === 'pensioner' && !isRetiree) targetIds.push(ps.id);
                    }
                    for (const id of targetIds) {
                        PayslipRepository.addItem(id, itemData);
                    }
                } else {
                    // all
                    const all = PayslipRepository.getByFilters({ year, month });
                    for (const ps of all) {
                        PayslipRepository.addItem(ps.id, itemData);
                    }
                }
            } else if (payslipId) {
                const success = PayslipRepository.addItem(payslipId, itemData);
                if (!success) return showToast('❌ امکان افزودن آیتم وجود ندارد (فیش تأیید شده است)', 'error');
            }

            if (window._persist) window._persist();
            modal.remove();
            loadPayslips();
            showToast('✅ آیتم افزوده شد', 'success');
        });
    }

    // ----------------------------------------------------------------
    // Settings, Items, Exports
    // ----------------------------------------------------------------
    function loadDecreeItemsList() {
        const items = ItemsRepository.getDecreeItems();
        const incomes = items.filter(i => i.isIncome);
        const deductions = items.filter(i => !i.isIncome);

        const renderTable = (tbodyId, arr) => {
            const tbody = document.getElementById(tbodyId);
            tbody.innerHTML = arr.length
                ? arr.map(item => Templates.decreeItemRow(item)).join('')
                : '<tr><td colspan="5">موردی تعریف نشده</td></tr>';
        };
        renderTable('incomeItemsTable', incomes);
        renderTable('deductionItemsTable', deductions);
    }

    function showDecreeItemForm(itemId = null) {
        let item = null;
        if (itemId) item = ItemsRepository.getById(parseInt(itemId));
        document.body.insertAdjacentHTML('beforeend', Templates.decreeItemForm(item));
        const modal = document.getElementById('decreeItemFormModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCancelDecreeItem') modal.remove();
        });
        document.getElementById('btnSaveDecreeItem').addEventListener('click', function () {
            const id = this.dataset.id ? parseInt(this.dataset.id) : null;
            const data = {
                id,
                name: document.getElementById('diName').value.trim(),
                formula: document.getElementById('diFormula').value.trim(),
                isIncome: parseInt(document.getElementById('diIsIncome').value) === 1,
                amount: parseFloat(document.getElementById('diAmount').value) || 0,
                sortOrder: parseInt(document.getElementById('diOrder').value) || 0,
                applicableEntity: document.getElementById('diEntity').value,
                usageType: 'decree',
                isRecurring: true
            };
            if (!data.name) return showToast('❌ نام الزامی است', 'error');
            ItemsRepository.save(data);
            if (window._persist) window._persist();
            modal.remove();
            loadDecreeItemsList();
            showToast('✅ آیتم حکم ذخیره شد', 'success');
        });
    }

    function deleteDecreeItem(id) {
        if (!confirm('آیا از حذف این آیتم حکم اطمینان دارید؟')) return;
        ItemsRepository.remove(parseInt(id));
        if (window._persist) window._persist();
        loadDecreeItemsList();
        showToast('✅ آیتم حکم حذف شد', 'success');
    }

    function loadPayslipItemsList() {
        const items = ItemsRepository.getPayslipItems();
        const tbody = document.getElementById('payslipItemsTable');
        tbody.innerHTML = items.length
            ? items.map(item => Templates.payslipItemRow(item)).join('')
            : '<tr><td colspan="6">آیتم فیش تعریف نشده</td></tr>';
    }

    function showPayslipItemForm(itemId = null) {
        let item = null;
        if (itemId) item = ItemsRepository.getById(parseInt(itemId));
        document.body.insertAdjacentHTML('beforeend', Templates.payslipItemForm(item));
        const modal = document.getElementById('payslipItemFormModal');
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.id === 'btnCancelPayslipItem') modal.remove();
        });
        document.getElementById('btnSavePayslipItem').addEventListener('click', function () {
            const id = this.dataset.id ? parseInt(this.dataset.id) : null;
            const data = {
                id,
                name: document.getElementById('piName').value.trim(),
                isIncome: parseInt(document.getElementById('piIsIncome').value) === 1,
                amount: parseFloat(document.getElementById('piAmount').value) || 0,
                formula: document.getElementById('piFormula').value.trim(),
                isRecurring: parseInt(document.getElementById('piRecurring').value) === 1,
                sortOrder: parseInt(document.getElementById('piOrder').value) || 0,
                initial: parseFloat(document.getElementById('piInitial').value) || 0,
                balance: parseFloat(document.getElementById('piBalance').value) || 0,
                usageType: 'payslip',
                applicableEntity: 'all'   // payslip items are entity-agnostic for now
            };
            if (!data.name) return showToast('❌ نام الزامی است', 'error');
            ItemsRepository.save(data);
            if (window._persist) window._persist();
            modal.remove();
            loadPayslipItemsList();
            showToast('✅ آیتم فیش ذخیره شد', 'success');
        });
    }

    function deletePayslipItem(id) {
        if (!confirm('آیا از حذف این آیتم فیش اطمینان دارید؟')) return;
        ItemsRepository.remove(parseInt(id));
        if (window._persist) window._persist();
        loadPayslipItemsList();
        showToast('✅ آیتم فیش حذف شد', 'success');
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

        // Decrees tab
        document.getElementById('decreePersonFilter').addEventListener('change', loadDecrees);
        document.getElementById('btnAddDecree').addEventListener('click', showDecreeForm);
        document.getElementById('decreesTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('view-decree')) viewDecree(id);
            else if (btn.classList.contains('delete-decree')) deleteDecree(id);
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

        // Payslips tab
        document.getElementById('btnCalculateAll').addEventListener('click', calculateAllPayslips);
        document.getElementById('btnRefreshPayslips').addEventListener('click', loadPayslips);
        document.getElementById('payslipsTableBody').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('view-payslip')) viewPayslip(id);
            else if (btn.classList.contains('delete-payslip')) deletePayslip(id);
            else if (btn.classList.contains('add-item-payslip')) showAddItemForm(id, false);
        });
        document.getElementById('btnAddItemToAll').addEventListener('click', () => showAddItemForm(null, true));

        // Also when year/month changes, refresh list? We'll rely on refresh button for now.
        document.getElementById('psYear').addEventListener('change', loadPayslips);
        document.getElementById('psMonth').addEventListener('change', loadPayslips);

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
        // Decree items
        document.getElementById('btnAddDecreeItem').addEventListener('click', () => showDecreeItemForm());
        document.getElementById('incomeItemsTable').addEventListener('click', e => {
            if (e.target.classList.contains('edit-decree-item')) showDecreeItemForm(e.target.dataset.id);
            else if (e.target.classList.contains('delete-decree-item')) deleteDecreeItem(e.target.dataset.id);
        });
        document.getElementById('deductionItemsTable').addEventListener('click', e => {
            if (e.target.classList.contains('edit-decree-item')) showDecreeItemForm(e.target.dataset.id);
            else if (e.target.classList.contains('delete-decree-item')) deleteDecreeItem(e.target.dataset.id);
        });
        // Payslip items
        document.getElementById('btnAddPayslipItem').addEventListener('click', () => showPayslipItemForm());
        document.getElementById('payslipItemsTable').addEventListener('click', e => {
            if (e.target.classList.contains('edit-payslip-item')) showPayslipItemForm(e.target.dataset.id);
            else if (e.target.classList.contains('delete-payslip-item')) deletePayslipItem(e.target.dataset.id);
        });
    }

    return {
        bindAll,
        showToast,
        populateDropdowns,
        refreshDashboard,
        loadPersons,
        loadRetireesPensioners,
        loadDecrees,
        populateDecreePersonFilter,
        loadSalaryRecords,
        loadPayslips,
        loadPayments,
        loadDecreeItemsList,
        loadPayslipItemsList,
        loadSettingsForm
    };
})();
