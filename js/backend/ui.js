/*
 * ====================================================================
 * [V42.1] 後台 UI 操作 (ui.js)
 * 包含：導航、報表分頁、Modal 顯示/隱藏
 * ====================================================================
 */

import * as DOM from './dom.js';
import { loadProducts } from './products.js';
import { loadEmployees } from './employees.js';
import { loadAllOrdersForSequence } from './orders.js';
import { loadDiscounts } from './discounts.js';
import { loadDashboardData, loadTopSellingProducts, loadEmployeeSalesStats } from './reports.js';
import { loadStocktakeList } from './stocktake.js';

// --- Modal 控制 ---
export function showProductModal(product = null) { 
    DOM.productFormErrorMessage.textContent = ''; 
    DOM.productForm.reset(); 
    if (product) {
        DOM.productModal.querySelector('#modal-title').textContent = '編輯商品'; 
        document.getElementById('product-id').value = product.id; 
        document.getElementById('product-name').value = product.name; 
        document.getElementById('product-category').value = product.category; 
        document.getElementById('product-price').value = product.price; 
        document.getElementById('product-cost').value = product.cost ?? 0; 
        document.getElementById('product-stock').value = product.stock; 
        document.getElementById('product-warning-threshold').value = product.warning_threshold ?? 10; 
        document.getElementById('product-is-active').checked = product.is_active;
        document.getElementById('product-par-stock').value = product.par_stock ?? 0;
    } else {
        DOM.productModal.querySelector('#modal-title').textContent = '新增商品'; 
        document.getElementById('product-id').value = ''; 
        document.getElementById('product-is-active').checked = true;
        document.getElementById('product-par-stock').value = 0;
    }
    DOM.productModal.classList.add('active');
}
export function hideProductModal() { DOM.productModal.classList.remove('active'); DOM.productForm.reset(); }

export function showEmployeeModal(employee = null) { 
    DOM.employeeFormErrorMessage.textContent = ''; 
    DOM.employeeForm.reset(); 
    if (employee) { 
        DOM.employeeModalTitle.textContent = '編輯員工'; 
        document.getElementById('employee-id').value = employee.id; 
        document.getElementById('employee-name').value = employee.employee_name; 
        document.getElementById('employee-code').value = employee.employee_code; 
        document.getElementById('employee-is-active').checked = employee.is_active;
        document.getElementById('employee-shift').value = employee.shift_preference || '';
    } else { 
        DOM.employeeModalTitle.textContent = '新增員工'; 
        document.getElementById('employee-id').value = ''; 
        document.getElementById('employee-is-active').checked = true; 
        document.getElementById('employee-shift').value = '';
    } 
    DOM.employeeModal.classList.add('active');
}
export function hideEmployeeModal() { DOM.employeeModal.classList.remove('active'); DOM.employeeForm.reset(); }

export function showDiscountModal(discount = null) {
    DOM.discountFormErrorMessage.textContent = ''; 
    DOM.discountForm.reset(); 
    if (discount) {
        DOM.discountModalTitle.textContent = '編輯折扣';
        document.getElementById('discount-id').value = discount.id;
        document.getElementById('discount-name').value = discount.name;
        document.getElementById('discount-amount').value = discount.amount;
        document.getElementById('discount-is-active').checked = discount.is_active;
        document.getElementById('discount-target-category').value = discount.target_category || '';
        document.getElementById('discount-target-product-id').value = discount.target_product_id || '';
    } else {
        DOM.discountModalTitle.textContent = '新增折扣';
        document.getElementById('discount-id').value = '';
        document.getElementById('discount-is-active').checked = true;
        document.getElementById('discount-target-category').value = '';
        document.getElementById('discount-target-product-id').value = '';
    }
    DOM.discountModal.classList.add('active');
}
export function hideDiscountModal() {
    DOM.discountModal.classList.remove('active');
    DOM.discountForm.reset();
}

// --- 介面設定 ---
export function setupReportTabs() {
    if (!DOM.reportSubNavButtons.length) return; 
    DOM.reportSubNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            if (!targetId) return;
            DOM.reportSubNavButtons.forEach(btn => btn.classList.remove('active'));
            DOM.reportContentSections.forEach(sec => sec.classList.remove('active'));
            button.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

export function setupNavigation() {
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            
            const targetId = link.dataset.target;
            if (!targetId) { return; }

            DOM.navLinks.forEach(nav => nav.classList.remove('active'));
            DOM.managementSections.forEach(sec => sec.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            // 點擊時立即載入 (Realtime 會保持更新)
            if (targetId === 'product-management-section') {
                loadProducts();
            } else if (targetId === 'employee-management-section') {
                loadEmployees();
            } else if (targetId === 'orders-section') {
                loadAllOrdersForSequence(); 
            } else if (targetId === 'discount-management-section') {
                loadDiscounts();
            } else if (targetId === 'reports-section') {
                loadDashboardData();
                loadTopSellingProducts();
                loadEmployeeSalesStats(); 
                
                if (DOM.reportSubNavButtons.length > 0 && DOM.reportContentSections.length > 0) {
                    DOM.reportSubNavButtons.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.target === 'report-top-products');
                    });
                    DOM.reportContentSections.forEach(sec => {
                        sec.classList.toggle('active', sec.id === 'report-top-products');
                    });
                }
                
            } else if (targetId === 'stocktake-section') {
                loadStocktakeList();
            }
        });
    });
}