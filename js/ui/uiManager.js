/**
 * @file uiManager.js
 * @description Top‑level UI orchestrator. Builds the initial application shell from
 *              templates, binds all event handlers, and provides methods to switch
 *              tabs and refresh all visible data.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

const UIManager = (() => {
    /**
     * Initialises the UI: renders header, navigation, panels, binds events,
     * and activates the dashboard.
     */
    function init() {
        document.getElementById('headerButtons').innerHTML = Templates.headerButtons();
        document.getElementById('tabNav').innerHTML = Templates.tabNav();
        document.getElementById('mainContent').innerHTML = Templates.tabPanels();
        EventHandlers.bindAll();
        populateDropdowns();
        switchTab('dashboard');
    }

    /**
     * Activates the given tab panel and refreshes its content.
     * @param {string} tabName - e.g. "dashboard", "retirees".
     */
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        const panel = document.getElementById('panel-' + tabName);
        if (btn) btn.classList.add('active');
        if (panel) panel.classList.add('active');

        switch (tabName) {
            case 'dashboard': refreshDashboard(); break;
            case 'retirees': EventHandlers.loadRetirees(); break;
            case 'salaries': populateDropdowns(); EventHandlers.loadSalaryRecords(); break;
            case 'calc': populateDropdowns(); break;
            case 'payments': EventHandlers.loadPayments(); break;
            case 'settings': EventHandlers.loadSettingsForm(); EventHandlers.loadItemsList(); break;
        }
    }

    /**
     * Forces a refresh of all data‑driven parts of the UI (lists, stats).
     */
    function refreshAll() {
        populateDropdowns();
        refreshDashboard();
        EventHandlers.loadRetirees();
        EventHandlers.loadSalaryRecords();
        EventHandlers.loadPayments();
        EventHandlers.loadItemsList();
    }

    function refreshDashboard() {
        EventHandlers.refreshDashboard();
    }

    function populateDropdowns() {
        const retirees = RetireesRepository.getAll();
        const options = '<option value="">-- انتخاب --</option>' + retirees.map(r =>
            `<option value="${r.id}">${r.lastName} ${r.firstName} (${r.nationalCode})</option>`
        ).join('');
        const salaryFilter = document.getElementById('salaryRetireeFilter');
        const calcSelect = document.getElementById('calcRetireeSelect');
        if (salaryFilter) salaryFilter.innerHTML = options;
        if (calcSelect) calcSelect.innerHTML = options;
    }

    return { init, switchTab, refreshAll, refreshDashboard };
})();
