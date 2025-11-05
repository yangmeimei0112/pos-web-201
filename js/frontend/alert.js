/*
 * ====================================================================
 * [V45.0] 前台 自訂提示視窗 (alert.js)
 * ====================================================================
 */
import * as DOM from './dom.js';

// 儲存 resolve 函數，以便在點擊時呼叫
let alertResolve = null;

/**
 * 顯示一個自訂的 alert 視窗，並回傳一個 Promise
 * @param {string} message - 要顯示的訊息
 * @param {string} [title="通知"] - 視窗標題
 * @returns {Promise<void>} - 當使用者點擊確認時 resolve
 */
export function showCustomAlert(message, title = "通知") {
    return new Promise((resolve) => {
        // 1. 設定內容
        DOM.alertModalTitle.textContent = title;
        DOM.alertModalMessage.textContent = message;

        // 2. 儲存 resolve 函數
        alertResolve = resolve;

        // 3. 顯示視窗
        DOM.alertModal.classList.add('active');

        // 4. 立即聚焦按鈕，以便 Enter 鍵生效
        setTimeout(() => DOM.alertModalConfirm.focus(), 50);
    });
}

/**
 * 關閉 alert 視窗並 resolve Promise
 */
export function closeAlert() {
    if (!DOM.alertModal.classList.contains('active')) return;
    
    DOM.alertModal.classList.remove('active');
    if (alertResolve) {
        alertResolve(); // 呼叫儲存的 resolve 函數
        alertResolve = null;
    }
}

/**
 * 綁定 Alert Modal 的事件
 */
export function setupAlertModal() {
    DOM.alertModalConfirm.addEventListener('click', closeAlert);
}