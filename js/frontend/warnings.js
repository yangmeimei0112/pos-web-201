/*
 * ====================================================================
 * [V42.3] 前台 庫存預警 (warnings.js)
 * [V43.2] 修正 import 路徑
 * ====================================================================
 */
// [V43.2] 修正 import 路徑
import * as DOM from './dom.js';
import * as State from './state.js';

export function setupWarningBell() {
    DOM.stockWarningBell.addEventListener('click', showStockWarningModal);
    DOM.closeWarningModalBtn.addEventListener('click', hideStockWarningModal);
    DOM.stockWarningModal.addEventListener('click', (e) => {
        if (e.target === DOM.stockWarningModal) {
            hideStockWarningModal();
        }
    });
}

export function updateStockWarningBell() {
    if (State.state.lowStockItems.length > 0) {
        DOM.stockWarningBell.classList.add('active');
    } else {
        DOM.stockWarningBell.classList.remove('active');
    }
}

function showStockWarningModal() {
    if (State.state.lowStockItems.length === 0) {
        alert("目前所有商品庫存充足！");
        return;
    }

    DOM.stockWarningTbody.innerHTML = ''; 
    State.state.lowStockItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.stock}</td>
            <td>${item.warning_threshold}</td>
        `;
        DOM.stockWarningTbody.appendChild(row);
    });

    DOM.stockWarningModal.classList.add('active');
}

function hideStockWarningModal() {
    DOM.stockWarningModal.classList.remove('active');
}