/*
 * ====================================================================
 * [V42.1] 後台 DOM 元素 (dom.js)
 * [V-Confirm] 新增 Confirm Modal DOM
 * [V-Alert] 新增 Alert Modal DOM
 * ====================================================================
 */

export const backToPosBtn = document.getElementById('back-to-pos-btn');
export const navLinks = document.querySelectorAll('.backend-nav li');
export const managementSections = document.querySelectorAll('.management-section');

// 商品
export const productTableBody = document.getElementById('product-list-tbody');
export const productModal = document.getElementById('product-modal');
export const productForm = document.getElementById('product-form');
export const addProductBtn = document.getElementById('add-product-btn');
export const productFormErrorMessage = document.getElementById('product-form-error-message');
export const exportProductsBtn = document.getElementById('export-products-btn'); 

// 員工
export const employeeTableBody = document.getElementById('employee-list-tbody');
export const employeeModal = document.getElementById('employee-modal');
export const employeeForm = document.getElementById('employee-form');
export const addEmployeeBtn = document.getElementById('add-employee-btn');
export const employeeModalTitle = document.getElementById('employee-modal-title');
export const employeeFormErrorMessage = document.getElementById('employee-form-error-message');

// 訂單
export const orderListTableBody = document.getElementById('order-list-tbody');
export const exportOrdersBtn = document.getElementById('export-orders-btn'); 
export const filterSequenceNumber = document.getElementById('filter-sequence-number');
export const filterSearchBtn = document.getElementById('filter-search-btn');
export const filterClearBtn = document.getElementById('filter-clear-btn');
export const deleteAllOrdersBtn = document.getElementById('delete-all-orders-btn');

// 折扣
export const discountTableBody = document.getElementById('discount-list-tbody');
export const discountModal = document.getElementById('discount-modal');
export const discountForm = document.getElementById('discount-form');
export const addDiscountBtn = document.getElementById('add-discount-btn');
export const discountModalTitle = document.getElementById('discount-modal-title');
export const discountFormErrorMessage = document.getElementById('discount-form-error-message');

// 報表 (總覽)
export const dashboardTotalSales = document.getElementById('dashboard-total-sales');
export const dashboardTotalOrders = document.getElementById('dashboard-total-orders');
export const dashboardAvgOrderValue = document.getElementById('dashboard-avg-order-value');
export const dashboardTotalCost = document.getElementById('dashboard-total-cost');
export const dashboardTotalProfit = document.getElementById('dashboard-total-profit');

// 報表 (內容)
export const topProductsTableBody = document.getElementById('top-products-tbody');
export const employeeSalesTableBody = document.getElementById('employee-sales-tbody');
export const reportSubNavButtons = document.querySelectorAll('.report-sub-nav button');
export const reportContentSections = document.querySelectorAll('.report-content');

// 庫存盤點
export const stocktakeListTbody = document.getElementById('stocktake-list-tbody');
export const updateAllStockBtn = document.getElementById('update-all-stock-btn');

// [V-Confirm] 自訂確認視窗
export const confirmModal = document.getElementById('confirm-modal');
export const confirmModalContent = document.getElementById('confirm-modal-content');
export const confirmModalTitle = document.getElementById('confirm-modal-title');
export const confirmModalMessage = document.getElementById('confirm-modal-message');
export const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
export const confirmModalCancel = document.getElementById('confirm-modal-cancel');

// [V-Alert] 自訂提示視窗
export const alertModal = document.getElementById('alert-modal');
export const alertModalContent = document.getElementById('alert-modal-content');
export const alertModalIcon = document.getElementById('alert-modal-icon');
export const alertModalTitle = document.getElementById('alert-modal-title');
export const alertModalMessage = document.getElementById('alert-modal-message');
export const alertModalConfirm = document.getElementById('alert-modal-confirm');