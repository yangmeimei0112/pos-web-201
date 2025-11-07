/*
 * ====================================================================
 * [V-Confirm] 後台 自訂確認視窗 (confirmModal.js)
 * - 提供 showCustomConfirm 函數，取代內建的 confirm()
 * ====================================================================
 */

let dom = {}; // 儲存 DOM 元素
let currentResolve = null; // 儲存 Promise 的 resolve

/**
 * 處理確認操作
 */
function confirmAction() {
    if (currentResolve) {
        currentResolve(true); // 回傳 true
    }
    closeModal();
}

/**
 * 處理取消操作
 */
function cancelAction() {
    if (currentResolve) {
        currentResolve(false); // 回傳 false
    }
    closeModal();
}

/**
 * 關閉 Modal
 */
function closeModal() {
    dom.modal.classList.remove('active');
    currentResolve = null; // 清除
}

/**
 * 處理鍵盤事件 (Enter / Esc)
 * @param {KeyboardEvent} e 
 */
function handleKeyDown(e) {
    if (dom.modal.classList.contains('active')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmAction();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelAction();
        }
    }
}

/**
 * 初始化並綁定事件
 * (由 main.js 呼叫一次)
 */
export function setupConfirmModal(elements) {
    dom = elements; // 接收從 main.js 傳入的 DOM 元素

    dom.confirmBtn.addEventListener('click', confirmAction);
    dom.cancelBtn.addEventListener('click', cancelAction);
    
    // 點擊 Modal 背景關閉 (等同取消)
    dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) {
            cancelAction();
        }
    });

    // 綁定全域鍵盤事件
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * 顯示自訂確認視窗
 * @param {string} message - 要顯示的訊息 (支援 \n 換行)
 * @param {string} title - 視窗標題
 * @param {boolean} [isDanger=true] - 是否套用危險樣式
 * @returns {Promise<boolean>} - 回傳 Promise，Resolve(true) 或 Resolve(false)
 */
export function showCustomConfirm(message, title = "確認操作", isDanger = true) {
    return new Promise((resolve) => {
        currentResolve = resolve;

        // 設置內容
        dom.title.textContent = title;
        dom.message.textContent = message;

        // 設置樣式
        if (isDanger) {
            dom.content.classList.add('danger');
            dom.confirmBtn.classList.remove('btn-primary');
            dom.confirmBtn.classList.add('btn-danger');
        } else {
            dom.content.classList.remove('danger');
            dom.confirmBtn.classList.remove('btn-danger');
            dom.confirmBtn.classList.add('btn-primary');
        }
        
        // 顯示 Modal
        dom.modal.classList.add('active');
        
        // 立即聚焦到確認按鈕 (以便 Enter 鍵生效)
        setTimeout(() => dom.confirmBtn.focus(), 50);
    });
}