/*
 * ====================================================================
 * [V47.0] 前台 DOM 元素 (dom.js)
 * - [V46.0] 新增 Checkout Success Modal DOM
 * - [V47.0] 確認 Alert Modal DOM (無變更)
 * ====================================================================
 */
export const employeeModal = document.getElementById('employee-selection-modal');
export const employeeList = document.getElementById('employee-list');
export const loadingMessage = document.getElementById('loading-message');
export const currentEmployeeDisplay = document.getElementById('current-employee-display');
export const posMainApp = document.getElementById('pos-main-app');

export const goToBackendBtn = document.getElementById('go-to-backend-btn');
export const changeEmployeeBtn = document.getElementById('change-employee-btn');

export const currentTimeDisplay = document.getElementById('current-time');
export const categoryTabs = document.getElementById('category-tabs');
export const productList = document.getElementById('product-list');
export const productLoadingMessage = document.getElementById('product-loading-message'); 

export const orderItemsTableBody = document.getElementById('order-items-table-body');
export const orderItemsContainer = document.getElementById('order-items-list-container');
export const clearOrderBtn = document.getElementById('clear-order-btn');

export const checkoutBtn = document.getElementById('checkout-btn');
export const orderItemCount = document.getElementById('order-item-count');
export const orderSubtotal = document.getElementById('order-subtotal');
export const orderDiscount = document.getElementById('order-discount');
export const orderFinalTotal = document.getElementById('order-final-total');

export const checkoutModal = document.getElementById('checkout-modal');
export const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
export const summaryTotalAmount = document.getElementById('summary-total-amount');
export const paidAmountInput = document.getElementById('paid-amount');
export const summaryChangeAmount = document.getElementById('summary-change-amount');
export const finalConfirmBtn = document.getElementById('final-confirm-btn');
export const checkoutErrorMessage = document.getElementById('checkout-error-message');

export const holdOrderBtn = document.getElementById('hold-order-btn');
export const retrieveOrderBtn = document.getElementById('retrieve-order-btn');
export const heldOrderCount = document.getElementById('held-order-count');
export const holdRetrieveModal = document.getElementById('hold-retrieve-modal');
export const closeHoldRetrieveModalBtn = document.getElementById('close-hold-modal');
export const heldOrderListContainer = document.getElementById('held-order-list-container');
export const holdOrderInputSection = document.getElementById('hold-order-input-section');
export const holdOrderNameInput = document.getElementById('hold-order-name');
export const saveHeldOrderBtn = document.getElementById('save-held-order-btn');
export const holdOrderError = document.getElementById('hold-order-error');


export const stockWarningBell = document.getElementById('stock-warning-bell');
export const stockWarningDot = document.getElementById('stock-warning-dot');
export const stockWarningModal = document.getElementById('stock-warning-modal');
export const closeWarningModalBtn = document.getElementById('close-warning-modal'); 
export const stockWarningTbody = document.getElementById('stock-warning-tbody');

export const discountModal = document.getElementById('discount-modal');
export const closeDiscountModalBtn = document.getElementById('close-discount-modal');
export const applicableDiscountsList = document.getElementById('applicable-discounts-list');
export const inapplicableDiscountsList = document.getElementById('inapplicable-discounts-list');
export const modalSubtotal = document.getElementById('modal-subtotal');
export const modalDiscountTotal = document.getElementById('modal-discount-total');
export const modalFinalTotal = document.getElementById('modal-final-total');

// [V45.0] 自訂提示 (Alert) Modal DOM
export const alertModal = document.getElementById('alert-modal');
export const alertModalTitle = document.getElementById('alert-modal-title');
export const alertModalMessage = document.getElementById('alert-modal-message');
export const alertModalConfirm = document.getElementById('alert-modal-confirm');

// [V46.0] 結帳成功 Modal DOM
export const checkoutSuccessModal = document.getElementById('checkout-success-modal');
export const successOrderId = document.getElementById('success-order-id');
export const successTotal = document.getElementById('success-total');
export const successPaid = document.getElementById('success-paid');
export const successChange = document.getElementById('success-change');
export const successModalConfirm = document.getElementById('success-modal-confirm');