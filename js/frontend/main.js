/*
 * ====================================================================
 * [V42.3] 前台 主入口 (main.js)
 * - 負責匯入所有模組並綁定事件
 * ====================================================================
 */
import * as DOM from './dom.js';
import * as State from './state.js';
import { updateClock } from './utils.js';
import { initializeEmployeeModule, handleEmployeeSwitch } from './employee.js';
import { renderOrderItems, updateOrderTotals, clearOrder, increaseItemQuantity, decreaseItemQuantity, handleQuantityChange, handleEditNote, removeItem } from './order.js';
import { showCheckoutModal, handlePaymentInput, processCheckout } from './checkout.js';
import { openDiscountModal, closeDiscountModal, handleDiscountAdd, handleDiscountRemove } from './discounts.js';
import { loadHeldOrdersFromStorage, handleHoldOrder, showRetrieveModal, hideRetrieveModal, handleRetrieveModalClick } from './hold.js';
import { setupWarningBell } from './warnings.js';

function initializeApp() {
    // 1. 啟動基礎功能
    updateClock();
    setInterval(updateClock, 1000);
    loadHeldOrdersFromStorage(); 
    setupWarningBell(); 
    
    // 2. 檢查登入狀態
    if (!State.state.currentEmployee) {
        initializeEmployeeModule();
    } else {
        // (此邏輯理論上不會執行，因為 V38.1 登出時會清空 interval)
        DOM.posMainApp.classList.remove('hidden');
        if (!State.state.productLoadInterval) {
            const interval = setInterval(loadProducts, 1000); 
            State.setProductLoadInterval(interval);
        }
    }
    
    // 3. 綁定主要 DOM 事件
    DOM.goToBackendBtn.onclick = () => { window.location.href = 'backend.html'; };
    DOM.changeEmployeeBtn.onclick = () => handleEmployeeSwitch(clearOrder);
    DOM.clearOrderBtn.addEventListener('click', () => clearOrder());

    // 結帳 Modal
    DOM.checkoutBtn.addEventListener('click', showCheckoutModal);
    DOM.closeCheckoutModalBtn.addEventListener('click', () => DOM.checkoutModal.classList.remove('active'));
    DOM.paidAmountInput.addEventListener('input', handlePaymentInput);
    DOM.finalConfirmBtn.addEventListener('click', processCheckout);
    
    // 折扣 Modal
    // (按鈕 'open-discount-modal-btn' 是動態產生的，在 order.js 中綁定)
    DOM.closeDiscountModalBtn.addEventListener('click', closeDiscountModal);
    DOM.discountModal.addEventListener('click', (e) => {
        if (e.target === DOM.discountModal) {
            closeDiscountModal();
        }
        const target = e.target.closest('.qty-btn');
        if (target) {
            const id = parseInt(target.dataset.id, 10);
            if (target.classList.contains('increase-btn')) {
                handleDiscountAdd(id);
            } else if (target.classList.contains('decrease-btn')) {
                handleDiscountRemove(id);
            }
        }
    });

    // 訂單明細 (事件委派)
    DOM.orderItemsTableBody.addEventListener('click', (e) => {
        const target = e.target;
        const button = target.closest('button'); 
        
        if (button && (button.classList.contains('add-note-btn') || button.classList.contains('edit-note-btn'))) {
            const index = parseInt(button.dataset.index, 10);
            if (!isNaN(index)) handleEditNote(index);
            return; 
        }

        const actionButton = target.closest('[data-action]');
        if (actionButton) {
            const action = actionButton.dataset.action;
            const index = parseInt(actionButton.dataset.index, 10);
            if (isNaN(index)) return;

            if (action === 'increase') increaseItemQuantity(index);
            else if (action === 'decrease') {
                if (!actionButton.disabled) decreaseItemQuantity(index);
            }
            else if (action === 'remove') removeItem(index);
        }
    });
    DOM.orderItemsTableBody.addEventListener('change', (e) => {
        const target = e.target;
        if (target.dataset.action === 'set-quantity') { 
            const index = parseInt(target.dataset.index, 10);
            if (!isNaN(index)) handleQuantityChange(index, target.value);
        }
    });

    // 暫掛 Modal
    DOM.holdOrderBtn.addEventListener('click', handleHoldOrder);
    DOM.retrieveOrderBtn.addEventListener('click', showRetrieveModal);
    DOM.closeRetrieveModalBtn.addEventListener('click', hideRetrieveModal);
    DOM.heldOrderListContainer.addEventListener('click', handleRetrieveModalClick);

    // 全局 Enter 鍵
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; 
        
        const isCheckoutActive = DOM.checkoutModal.classList.contains('active');
        const isEmployeeActive = DOM.employeeModal.classList.contains('active');
        const isRetrieveActive = DOM.retrieveOrderModal.classList.contains('active'); 
        const isWarningActive = DOM.stockWarningModal.classList.contains('active');
        const isDiscountActive = DOM.discountModal.classList.contains('active');
        
        if (isCheckoutActive) {
            if (e.target === DOM.paidAmountInput && !DOM.finalConfirmBtn.disabled) {
                e.preventDefault();
                processCheckout();
            }
            return; 
        }
        if (isEmployeeActive || isRetrieveActive || isWarningActive || isDiscountActive) { 
            return;
        }
        
        const targetTagName = e.target.tagName.toLowerCase();
        if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'select') {
            e.target.blur();
            return;
        }
        if (State.state.orderItems.length > 0) {
            e.preventDefault(); 
            showCheckoutModal();
        }
    });

    // 初始渲染
    renderOrderItems();
    updateOrderTotals(); 

    console.log('🚀 POS 系統腳本 (V42.3) 已啟動。');
}

// 確保 DOM 完全載入後再執行初始化
document.addEventListener('DOMContentLoaded', initializeApp);