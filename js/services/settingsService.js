/**
 * @file settingsService.js
 * @description Persistent storage and retrieval of application settings (coefficients)
 *              using the browser's localStorage. Provides defaults if no settings are
 *              saved, and allows saving of user‑modified values.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
*/

/* IIFE module exposing get and save methods and the DEFAULT object. */
const SettingsService = (() => {
    const DEFAULT = {
        minWage: 110000000,
        spouseFactor: 25,
        childFactor: 10,
        insuranceRate: 11.11,
        supplementaryIns: 3500000,
        taxExemption: 1200000000,
        maxYears: 30
    };

    /**
     * Retrieves the current settings object from localStorage.
     * Returns a copy of the default settings if nothing is stored.
     * @returns {Object} settings
     */
    function get() {
        try { const s = localStorage.getItem('pension_settings'); return s ? JSON.parse(s) : {...DEFAULT}; }
        catch { return {...DEFAULT}; }
    }

    /**
     * Persists the given settings object to localStorage.
     * @param {Object} settings - Complete settings object to save.
     */
    function save(s) { localStorage.setItem('pension_settings', JSON.stringify(s)); }

    return { get, save, DEFAULT };
})();
