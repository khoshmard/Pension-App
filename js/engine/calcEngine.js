/**
 * @file calcEngine.js
 * @description Pure calculation engine for pension benefits. Evaluates configurable
 *              formula strings against a provided context, producing a detailed
 *              breakdown of incomes, deductions, gross, and net amounts.
 *              No DOM or database dependencies - fully reusable on the server side.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

/* IIFE module exposing evaluate and calculate. */
const CalcEngine = (() => {

    /**
     * Safely evaluates a JavaScript formula string using the given context object.
     * @param {string} formula - e.g. "avgSalary * effectiveYears / maxYears".
     * @param {Object} context - Key-value pairs for formula variables.
     * @returns {number} The computed result (defaults to 0 on error).
     */
    function evaluate(formula, context) {
        const keys = Object.keys(context);
        const values = Object.values(context);
        const fn = new Function(...keys, `return (${formula});`);
        return fn(...values);
    }

    /**
     * Performs the full pension calculation.
     * @param {Object} retiree - Retiree data (avgSalary, serviceYears).
     * @param {Object} settings - Settings coefficients.
     * @param {Array<Object>} incomesDef - Income item definitions [{name, formula}].
     * @param {Array<Object>} deductionsDef - Deduction item definitions.
     * @param {number} children - Number of dependent children.
     * @param {boolean} hasSpouse - Whether the retiree has a spouse.
     * @returns {Object} { incomes: [], deductions: [], grossAmount, totalDeductions, netAmount }.
     */
    function calculate(retiree, settings, incomesDef, deductionsDef, children, hasSpouse) {
        const ctx = {
            avgSalary: retiree.avgSalary,
            serviceYears: retiree.serviceYears,
            effectiveYears: Math.min(retiree.serviceYears, settings.maxYears),
            minWage: settings.minWage,
            maxYears: settings.maxYears,
            children, spouse: hasSpouse ? 1 : 0,
            spouseFactor: settings.spouseFactor,
            childFactor: settings.childFactor,
            insuranceRate: settings.insuranceRate,
            supplementaryIns: settings.supplementaryIns,
            taxExemption: settings.taxExemption
        };
        const incomes = [];
        let gross = 0;
        for (const item of incomesDef) {
            const amount = evaluate(item.formula, ctx);
            incomes.push({ name: item.name, amount: Math.round(amount) });
            gross += amount;
        }
        ctx.totalIncome = gross;
        const deductions = [];
        let totalDed = 0;
        for (const item of deductionsDef) {
            const amount = evaluate(item.formula, ctx);
            deductions.push({ name: item.name, amount: Math.round(amount) });
            totalDed += amount;
        }
        const net = gross - totalDed;
        return { incomes, deductions, grossAmount: Math.round(gross), totalDeductions: Math.round(totalDed), netAmount: Math.round(net) };
    }

    return { evaluate, calculate };
})();
