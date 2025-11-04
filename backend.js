/* ====================================================================
   後台管理 (Backend) 邏輯 (V42.2 - 修正匯出功能)
   - [V42.2] 修正 DOMContentLoaded 中的匯出按鈕綁定
   ==================================================================== */

// 匯入共用
import { supabase as db } from './js/supabaseClient.js';
import * as DOM from './js/backend/dom.js';
import { setupNavigation, setupReportTabs, showProductModal, hideProductModal, showEmployeeModal, hideEmployeeModal, showDiscountModal, hideDiscountModal } from './js/backend/ui.js';
import { setupGlobalRealtime, refreshReportData } from './js/backend/realtime.js';

// 匯入功能模組
import { loadProducts, handleProductFormSubmit, handleProductTableClick } from './js/backend/products.js';
import { handleEmployeeFormSubmit, handleEmployeeTableClick } from './js/backend/employees.js';
import { loadAllOrdersForSequence, handleOrderTableClick, handleDeleteAllOrders, setupOrderFilters } from './js/backend/orders.js';
import { handleDiscountFormSubmit, handleDiscountTableClick } from './js/backend/discounts.js';
import { handleStocktakeInputChange, handleUpdateAllStock } from './js/backend/stocktake.js';
import { handleExportProducts, handleExportOrders } from './js/backend/exports.js'; // [V42.2]


// 頁面載入完成後
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化介面
    setupNavigation();
    setupReportTabs(); 
    setupOrderFilters();
    
    // 2. 載入預設資料
    loadProducts(); 
    
    // 3. 啟動即時功能
    setupGlobalRealtime(); 
    setInterval(refreshReportData, 10000); // 10秒報表刷新
    console.log("[V42.2] 後台模組化已啟動 (含匯出修正)。");
    
    // 4. 綁定頂層事件
    DOM.backToPosBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

    // 商品 Modal 控制 & 表單 & 表格點擊
    DOM.addProductBtn.addEventListener('click', () => showProductModal(null));
    DOM.productModal.querySelector('.close-btn').addEventListener('click', hideProductModal);
    DOM.productModal.querySelector('.cancel-btn').addEventListener('click', hideProductModal);
    DOM.productModal.addEventListener('click', (e) => { if (e.target === DOM.productModal) hideProductModal(); });
    DOM.productForm.addEventListener('submit', handleProductFormSubmit);
    DOM.productTableBody.addEventListener('click', handleProductTableClick);

    // 員工 Modal 控制 & 表單 & 表格點擊
    DOM.addEmployeeBtn.addEventListener('click', () => showEmployeeModal(null));
    DOM.employeeModal.querySelector('.close-btn').addEventListener('click', hideEmployeeModal);
    DOM.employeeModal.querySelector('.cancel-btn').addEventListener('click', hideEmployeeModal);
    DOM.employeeModal.addEventListener('click', (e) => { if (e.target === DOM.employeeModal) hideEmployeeModal(); });
    DOM.employeeForm.addEventListener('submit', handleEmployeeFormSubmit);
    DOM.employeeTableBody.addEventListener('click', handleEmployeeTableClick);

    // 訂單表格點擊 (展開/刪除)
    DOM.orderListTableBody.addEventListener('click', handleOrderTableClick);
    DOM.deleteAllOrdersBtn.addEventListener('click', handleDeleteAllOrders);

    // 折扣 Modal 控制 & 表單 & 表格點擊
    DOM.addDiscountBtn.addEventListener('click', () => showDiscountModal(null));
    DOM.discountModal.querySelector('.close-btn').addEventListener('click', hideDiscountModal);
    DOM.discountModal.querySelector('.cancel-btn').addEventListener('click', hideDiscountModal);
    DOM.discountModal.addEventListener('click', (e) => {
        if (e.target === DOM.discountModal) hideDiscountModal();
    });
    DOM.discountForm.addEventListener('submit', handleDiscountFormSubmit);
    DOM.discountTableBody.addEventListener('click', handleDiscountTableClick);

    // 庫存盤點
    if (DOM.stocktakeListTbody) {
        DOM.stocktakeListTbody.addEventListener('input', handleStocktakeInputChange);
    }
    if (DOM.updateAllStockBtn) {
        DOM.updateAllStockBtn.addEventListener('click', handleUpdateAllStock);
    }

    // [V42.2] 修正匯出按鈕綁定
    if (DOM.exportProductsBtn) {
        DOM.exportProductsBtn.addEventListener('click', handleExportProducts);
    }
    if (DOM.exportOrdersBtn) {
        DOM.exportOrdersBtn.addEventListener('click', handleExportOrders);
    }
});