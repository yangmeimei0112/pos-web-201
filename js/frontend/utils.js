/*
 * ====================================================================
 * [V42.3] 前台 工具函數 (utils.js)
 * ====================================================================
 */
import * as DOM from './dom.js';

export const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        return 'NT$ ---';
    }
    return `NT$ ${numAmount.toFixed(0)}`;
};

export function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateString = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (DOM.currentTimeDisplay) {
        DOM.currentTimeDisplay.textContent = `${dateString} ${timeString}`;
    }
}