/*
 * ====================================================================
 * [V46.0] 前台 主入口 (main.js)
 * - [優化] 移除 setInterval，改用 Realtime
 * - [動畫] 新增 3 秒 Splash Screen 邏輯
 * - [優化] 新增 sessionStorage 檢查，跳過動畫
 * ====================================================================
 */
import { supabase } from '../supabaseClient.js'; 
import * as DOM from './dom.js';
import * as State from './state.js';
import { updateClock } from './utils.js';
// [優化] 匯入 selectEmployee
import { initializeEmployeeModule, handleEmployeeSwitch, selectEmployee } from './employee.js';
import { renderOrderItems, updateOrderTotals, clearOrder, increaseItemQuantity, decreaseItemQuantity, handleQuantityChange, handleEditNote, removeItem } from './order.js';
import { showCheckoutModal, handlePaymentInput, processCheckout, closeCheckoutSuccess } from './checkout.js'; 
import { openDiscountModal, closeDiscountModal, handleDiscountAdd, handleDiscountRemove } from './discounts.js';
import { loadHeldOrdersFromStorage, openHoldRetrieveModal, closeHoldRetrieveModal, handleSaveHeldOrderClick, handleRetrieveModalClick } from './hold.js';
import { setupWarningBell } from './warnings.js';
import { setupAlertModal, closeAlert } from './alert.js';
import { loadProducts } from './products.js'; 

/**
 * [優化] 設置前台 Supabase Realtime 監聽
 */
function setupFrontendRealtime() {
    console.log("✅ [Realtime] 啟動前台商品庫存即時監聽...");
    
    supabase.channel('public:products')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'products' 
        },
        (payload) => {
            console.log('🔄 [Realtime] 偵測到商品資料變更，重新載入...');
            loadProducts(); 
        }
    ).subscribe();
}

function initializeApp() {
    // [動畫] 找到 Splash Screen
    const splashScreen = document.getElementById('splash-screen');

    // 1. 啟動基礎功能 (這些功能應立即啟動，不受動畫影響)
    updateClock();
    setInterval(updateClock, 1000);
    loadHeldOrdersFromStorage(); 
    setupWarningBell(); 
    setupAlertModal(); 
    setupFrontendRealtime(); 
    
    // [優化] 檢查 Session Storage 是否已有登入資訊
    const storedEmployeeJSON = sessionStorage.getItem('currentPOS_Employee');
    
    if (storedEmployeeJSON && splashScreen) {
        // --- 情況 A: 已經登入 (例如從後台返回) ---
        console.log("偵測到已登入的員工，正在快速載入...");
        
        // 1. 立即隱藏 Splash Screen
        splashScreen.classList.add('splash-hidden');
        
        // 2. 立即恢復員工狀態
        try {
            const employee = JSON.parse(storedEmployeeJSON);
            // 呼叫 selectEmployee，這會更新狀態、載入商品並顯示主介面
            selectEmployee(employee.id, employee.name); 
        } catch (e) {
            console.error("解析 sessionStorage 失敗:", e);
            // 如果解析失敗，退回到情況 B
            sessionStorage.removeItem('currentPOS_Employee');
            initializeApp(); // 重新執行，但這次 storedEmployeeJSON 會是 null
        }

    } else {
        // --- 情況 B: 尚未登入 (新工作階段) ---
        console.log("新工作階段，準備 3 秒動畫...");
        
        // [動畫] 設置 3 秒後隱藏 Splash Screen，並啟動 APP
        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add('splash-hidden');
            }
            
            // 2. 檢查登入狀態 (動畫結束後才執行)
            if (!State.state.currentEmployee) {
                initializeEmployeeModule(); // 這會顯示員工 modal
            } else {
                DOM.posMainApp.classList.remove('hidden');
            }
        }, 3000); // 3000ms = 3 秒
    }

    // 3. 綁定主要 DOM 事件 (這些可以先綁定，不受動畫影響)
    DOM.goToBackendBtn.onclick = () => { window.location.href = 'backend.html'; };
    DOM.changeEmployeeBtn.onclick = () => handleEmployeeSwitch(clearOrder);
    DOM.clearOrderBtn.addEventListener('click', () => clearOrder());

    // 結帳 Modal
    DOM.checkoutBtn.addEventListener('click', showCheckoutModal);
    DOM.closeCheckoutModalBtn.addEventListener('click', () => DOM.checkoutModal.classList.remove('active'));
    DOM.paidAmountInput.addEventListener('input', handlePaymentInput);
    DOM.finalConfirmBtn.addEventListener('click', processCheckout);
    
    // 結帳成功 Modal
    DOM.successModalConfirm.addEventListener('click', closeCheckoutSuccess);

    // 折扣 Modal
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

    // 暫掛/取單 Modal
    DOM.holdOrderBtn.addEventListener('click', openHoldRetrieveModal);
    DOM.retrieveOrderBtn.addEventListener('click', openHoldRetrieveModal);
    DOM.closeHoldRetrieveModalBtn.addEventListener('click', closeHoldRetrieveModal);
    DOM.heldOrderListContainer.addEventListener('click', handleRetrieveModalClick); 
    DOM.saveHeldOrderBtn.addEventListener('click', handleSaveHeldOrderClick); 

    // 全局 Enter 鍵
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; 
        
        if (DOM.checkoutSuccessModal.classList.contains('active')) {
            e.preventDefault();
            closeCheckoutSuccess();
            return;
        }

        if (DOM.alertModal.classList.contains('active')) {
            e.preventDefault();
            closeAlert();
            return;
        }

        const isCheckoutActive = DOM.checkoutModal.classList.contains('active');
        const isEmployeeActive = DOM.employeeModal.classList.contains('active');
        const isRetrieveActive = DOM.holdRetrieveModal.classList.contains('active');
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

    console.log('🚀 POS 系統腳本 (V46.0 + Realtime + Session) 已啟動。');
}

// 確保 DOM 完全載入後再執行初始化
document.addEventListener('DOMContentLoaded', initializeApp);