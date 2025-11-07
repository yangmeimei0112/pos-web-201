/*
 * ====================================================================
 * [V-Alert] 後台 自訂提示視窗 (alertModal.js)
 * - 提供 showCustomAlert 函數，取代內建的 alert()
 * ====================================================================
 */

let dom = {}; // 儲存 DOM 元素
let currentResolve = null; // 儲存 Promise 的 resolve

/**
 * 處理確認 (關閉)
 */
function confirmAction() {
    if (currentResolve) {
        currentResolve(); // 只需 resolve
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
        // Enter 或 Esc 都會關閉提示視窗
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            confirmAction();
        }
    }
}

/**
 * 初始化並綁定事件
 * (由 main.js 呼叫一次)
 */
export function setupAlertModal(elements) {
    dom = elements; // 接收從 main.js 傳入的 DOM 元素
    dom.confirmBtn.addEventListener('click', confirmAction);
    
    // 點擊 Modal 背景關閉
    dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) {
            confirmAction();
        }
    });

    // 綁定全域鍵盤事件
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * 顯示自訂提示視窗
 * @param {string} message - 要顯示的訊息 (支援 \n 換行)
 * @param {string} title - 視窗標題
 * @param {string} [type='success'] - 類型 ('success' 或 'danger')
 * @returns {Promise<void>} - 當使用者點擊確認時 resolve
 */
export function showCustomAlert(message, title = "通知", type = 'success') {
    return new Promise((resolve) => {
        currentResolve = resolve;

        // 設置內容
        dom.title.textContent = title;
        dom.message.textContent = message;

        // 移除舊圖示
        dom.icon.classList.remove('fa-check-circle', 'fa-times-circle');
        
        if (type === 'danger') {
            dom.content.classList.remove('success');
            dom.content.classList.add('danger');
            dom.icon.classList.add('fa-times-circle'); // 錯誤圖示
            dom.confirmBtn.classList.remove('btn-primary');
            dom.confirmBtn.classList.add('btn-danger');
        } else { // 預設為 'success'
            dom.content.classList.remove('danger');
            dom.content.classList.add('success');
            dom.icon.classList.add('fa-check-circle'); // 成功圖示
            dom.confirmBtn.classList.remove('btn-danger');
            dom.confirmBtn.classList.add('btn-primary');
        }
        
        // 顯示 Modal
        dom.modal.classList.add('active');
        
        // 立即聚焦到確認按鈕
        setTimeout(() => dom.confirmBtn.focus(), 50);
    });
}