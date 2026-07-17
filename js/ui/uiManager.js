/**
 * @file uiManager.js
 * @description Top‑level UI orchestrator. Builds the initial application shell from
 *              templates, binds all event handlers, and provides methods to switch
 *              tabs and refresh all visible data.
 * @author      Abbas Hatami Khoshmardan <khoshmard@gmail.com>
 * @company     nouz.ir
 * @since       1.0.0
 * @version     1.0.2
 * @history
 * 1.0.2 (2026-07-16) - Implementing Decree
 * 1.0.1 (2026-07-16) - Split Retiree into Person, Retiree, Pensioner and add Dependent
 * 1.0.0 (2026-07-12) - Make App Modular
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
        EventHandlers.populateDropdowns();
        switchTab('persons');
    }

    /**
     * Activates the given tab panel and refreshes its content.
     * @param {string} tabName - e.g. "dashboard", "persons", "retireesPensioners".
     */
    function switchTab(tabName) {
        // Deactivate all tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Activate the selected tab button and panel
        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        const panel = document.getElementById('panel-' + tabName);
        if (btn) btn.classList.add('active');
        if (panel) panel.classList.add('active');

        // Refresh data for the active tab
        switch (tabName) {
            case 'dashboard':
                EventHandlers.refreshDashboard();
                break;
            case 'persons':
                EventHandlers.loadPersons();
                break;
            case 'retireesPensioners':
                EventHandlers.loadRetireesPensioners();
                break;
            case 'decrees':
                EventHandlers.populateDecreePersonFilter();
                EventHandlers.loadDecrees();
                break;
            case 'salaries':
                EventHandlers.populateDropdowns();
                EventHandlers.loadSalaryRecords();
                break;
            case 'calc':
                EventHandlers.populateDropdowns();
                break;
            case 'payments':
                EventHandlers.loadPayments();
                break;
            case 'settings':
                EventHandlers.loadSettingsForm();
                EventHandlers.loadItemsList();
                break;
            // Export tab has no dynamic content to load
        }
    }

    /**
     * Refreshes all data‑driven parts of the UI (used after DB import, etc.).
     */
    function refreshAll() {
        EventHandlers.populateDropdowns();
        EventHandlers.refreshDashboard();
        EventHandlers.loadPersons();
        EventHandlers.loadRetireesPensioners();
        EventHandlers.loadSalaryRecords();
        EventHandlers.loadPayments();
        EventHandlers.loadItemsList();
    }

    return { init, switchTab, refreshAll };
})();
