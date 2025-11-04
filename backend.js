/* ====================================================================
   後台管理 (Backend) 邏輯 (V39.0 - 報表 RPC 優化)
   - [V39.0] 重寫 loadDashboardData() 函數
   - [V39.0] 移除 V37.7 中 loadDashboardData() 的多次 select，
             改為呼叫 RPC 'fn_get_dashboard_stats'
   - (保留 V37.7 的全局 Realtime + 報表 10 秒刷新 + 報表滾動動畫)
   ==================================================================== */

// ====================================================================
// 1. Supabase 初始化 & 2. 通用輔助函數
// ====================================================================
const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";
if (typeof supabase === 'undefined') { console.error("Supabase client 未載入。"); }
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase (後台) 初始化成功", db);
const formatCurrency = (amount) => {
    if (amount === null || isNaN(amount)) return 'N/A';
    if (String(amount).includes('.')) {
        return `NT$ ${Math.max(0, amount).toFixed(1)}`;
    }
    return `NT$ ${Math.max(0, amount).toFixed(0)}`;
}

// [V32.0] 新增: 日期格式化 (用於 Excel)
const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
        return new Date(isoString).toLocaleString('zh-Hant', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString; 
    }
};


/**
 * [V27.0] 數字滾動動畫函數
 */
function animateValue(element, start, end, duration, isCurrency = false, isDecimal = false) {
    // [V37.6] 如果值沒有變化，則不執行動畫
    if (start === end) {
        if (isCurrency) {
            if (isDecimal) {
                element.textContent = `NT$ ${end.toFixed(1)}`;
            } else {
                element.textContent = `NT$ ${Math.floor(end)}`;
            }
        } else {
            element.textContent = Math.floor(end);
        }
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let currentValue = progress * (end - start) + start;
        if (isCurrency) {
            if (isDecimal) {
                element.textContent = `NT$ ${currentValue.toFixed(1)}`;
            } else {
                element.textContent = `NT$ ${Math.floor(currentValue)}`;
            }
        } else {
            element.textContent = Math.floor(currentValue);
        }
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
             if (isCurrency) {
                if (isDecimal) {
                    element.textContent = `NT$ ${end.toFixed(1)}`;
                } else {
                    element.textContent = `NT$ ${Math.floor(end)}`;
                }
            } else {
                element.textContent = Math.floor(end); // [V37.6] 修正為 end
            }
        }
    };
    window.requestAnimationFrame(step);
}


// ====================================================================
// 3. [V32.0] DOM 元素參照
// ====================================================================
const backToPosBtn = document.getElementById('back-to-pos-btn');
const navLinks = document.querySelectorAll('.backend-nav li');
const managementSections = document.querySelectorAll('.management-section');
// 商品
const productTableBody = document.getElementById('product-list-tbody');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const productFormErrorMessage = document.getElementById('product-form-error-message');
const exportProductsBtn = document.getElementById('export-products-btn'); 
let currentProductList = []; 
// 員工
const employeeTableBody = document.getElementById('employee-list-tbody');
const employeeModal = document.getElementById('employee-modal');
const employeeForm = document.getElementById('employee-form');
const addEmployeeBtn = document.getElementById('add-employee-btn');
const employeeModalTitle = document.getElementById('employee-modal-title');
const employeeFormErrorMessage = document.getElementById('employee-form-error-message');
// 訂單
const orderListTableBody = document.getElementById('order-list-tbody');
const exportOrdersBtn = document.getElementById('export-orders-btn'); 
let allOrders = []; 
const filterSequenceNumber = document.getElementById('filter-sequence-number');
const filterSearchBtn = document.getElementById('filter-search-btn');
const filterClearBtn = document.getElementById('filter-clear-btn');
const deleteAllOrdersBtn = document.getElementById('delete-all-orders-btn');
// 折扣
const discountTableBody = document.getElementById('discount-list-tbody');
const discountModal = document.getElementById('discount-modal');
const discountForm = document.getElementById('discount-form');
const addDiscountBtn = document.getElementById('add-discount-btn');
const discountModalTitle = document.getElementById('discount-modal-title');
const discountFormErrorMessage = document.getElementById('discount-form-error-message');
// [V19] 報表 (總覽)
const dashboardTotalSales = document.getElementById('dashboard-total-sales');
const dashboardTotalOrders = document.getElementById('dashboard-total-orders');
const dashboardAvgOrderValue = document.getElementById('dashboard-avg-order-value');
const dashboardTotalCost = document.getElementById('dashboard-total-cost');
const dashboardTotalProfit = document.getElementById('dashboard-total-profit');
// [V21.0] 報表 (內容)
const topProductsTableBody = document.getElementById('top-products-tbody');
const employeeSalesTableBody = document.getElementById('employee-sales-tbody');
// [V26.0] 報表 (分頁按鈕)
const reportSubNavButtons = document.querySelectorAll('.report-sub-nav button');
const reportContentSections = document.querySelectorAll('.report-content');
// [V23.0] 庫存盤點
const stocktakeListTbody = document.getElementById('stocktake-list-tbody');
const updateAllStockBtn = document.getElementById('update-all-stock-btn');

// [V37.6] 計時器 (V37.5 移除 Realtime 頻道變數)
let autoRefreshInterval = null; 


// -----------------------------------------------------------
//  [V34.0] 區塊 4: 商品管理功能 (CRUD)
// -----------------------------------------------------------
async function loadProducts() { 
    // [V37.6] 檢查是否在該頁面，不在則不刷新
    const activeSection = document.querySelector('.management-section.active');
    if (!activeSection || activeSection.id !== 'product-management-section') {
        console.log("[Realtime] 收到 products 刷新，但目前不在商品頁，跳過。");
        return;
    }

    try {
        const { data, error } = await db.from('products').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }); 
        if (error) throw error;
        
        // [V37.6] Realtime 觸發時，檢查資料是否有真的變動
        if (JSON.stringify(currentProductList) === JSON.stringify(data)) {
            return;
        }
        
        currentProductList = JSON.parse(JSON.stringify(data)); 
        renderProductTable(data); 
    } catch (err) {
        console.error("載入商品時發生錯誤:", err);
        productTableBody.innerHTML = `<tr><td colspan="11" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderProductTable(products) { 
    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="11" class="loading-message">目前沒有任何商品。</td></tr>';
        return;
    }
    productTableBody.innerHTML = ''; 
    products.forEach((product, index) => {
        const row = document.createElement('tr');
        const statusText = product.is_active ? '<span class="status-active">✔ 上架中</span>' : '<span class="status-inactive">✘ 已下架</span>';
        const isFirst = index === 0;
        const isLast = index === products.length - 1;
        const sortButtons = `
            <td class="product-sort">
                <button class="sort-btn sort-up-btn" data-id="${product.id}" ${isFirst ? 'disabled' : ''}>▲</button>
                <button class="sort-btn sort-down-btn" data-id="${product.id}" ${isLast ? 'disabled' : ''}>▼</button>
            </td>
        `;
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${formatCurrency(product.cost)}</td>
            <td>${product.stock}</td>
            <td>${product.par_stock ?? 0}</td>
            <td>${product.warning_threshold ?? 'N/A'}</td>
            <td>${statusText}</td>
            ${sortButtons}
            <td>
                <button class="btn-secondary edit-btn" data-id="${product.id}">編輯/上下架</button>
                <button class="btn-danger delete-btn" data-id="${product.id}">刪除</button>
            </td>
        `;
        productTableBody.appendChild(row);
    });
}
function showProductModal(product = null) { 
    productFormErrorMessage.textContent = ''; 
    productForm.reset(); 
    if (product) {
        productModal.querySelector('#modal-title').textContent = '編輯商品'; 
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
        productModal.querySelector('#modal-title').textContent = '新增商品'; 
        document.getElementById('product-id').value = ''; 
        document.getElementById('product-is-active').checked = true;
        document.getElementById('product-par-stock').value = 0;
    }
    productModal.classList.add('active');
}
function hideProductModal() { productModal.classList.remove('active'); productForm.reset(); }
async function handleProductFormSubmit(e) { 
    e.preventDefault(); 
    productFormErrorMessage.textContent = ''; 
    const saveBtn = document.getElementById('save-product-btn'); 
    saveBtn.disabled = true; 
    saveBtn.textContent = '儲存中...'; 
    
    const formData = new FormData(productForm); 
    const productData = Object.fromEntries(formData.entries()); 
    const productId = productData.id; 
    
    productData.is_active = document.getElementById('product-is-active').checked; 
    productData.price = parseFloat(productData.price); 
    productData.cost = parseFloat(productData.cost) || 0; 
    productData.stock = parseInt(productData.stock, 10); 
    productData.warning_threshold = parseInt(productData.warning_threshold, 10) || 0; 
    productData.par_stock = parseInt(productData.par_stock, 10) || 0;

    try {
        let response; 
        if (productId) { 
            const { id, ...updateData } = productData; 
            response = await db.from('products').update(updateData).eq('id', productId).select(); 
        } else { 
            delete productData.id; 
            const newSortOrder = (currentProductList.length + 1) * 10; 
            productData.sort_order = newSortOrder; 
            response = await db.from('products').insert([productData]).select(); 
        } 
        const { data, error } = response; 
        if (error) { throw error; } 
        console.log('商品儲存成功:', data); 
        hideProductModal(); 
        // [V37.6] 移除手動 load (Realtime 會自動觸發)
        // await loadProducts();
    } catch (err) { 
        console.error("儲存商品時發生錯誤:", err); 
        productFormErrorMessage.textContent = `儲存失敗: ${err.message}`; 
    } finally { 
        saveBtn.disabled = false; 
        saveBtn.textContent = '儲存'; 
    }
}
async function handleProductDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的商品嗎？\n\n注意：此操作無法復原。\n如果只是暫時不賣，請使用「編輯/上下架」功能。`)) { return; } 
    try { const { error } = await db.from('products').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該商品已有銷售紀錄，無法永久刪除。\n\n提示：請使用「編輯/上下架」功能將其「下架」，即可在前台隱藏該商品。`); } else { throw error; } } else { console.log(`商品 ${id} 刪除成功`); 
    // [V37.6] 移除手動 load
    // await loadProducts(); 
    } } catch (err) { console.error("刪除商品時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
async function handleProductSortSwap(productId, direction) { 
    const productIndex = currentProductList.findIndex(p => p.id == productId); if (productIndex === -1) return; const newIndex = (direction === 'up') ? productIndex - 1 : productIndex + 1; if (newIndex < 0 || newIndex >= currentProductList.length) return; const [item] = currentProductList.splice(productIndex, 1); currentProductList.splice(newIndex, 0, item); renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = true); 
    try { const updatePayload = currentProductList.map((product, index) => ({ id: product.id, sort_order: index * 10 })); const { error } = await db.rpc('bulk_update_sort_order', { updates: updatePayload }); if (error) throw error; console.log('商品排序更新成功！'); } catch (err) { console.error("交換商品排序並呼叫 RPC 時發生錯誤:", err); alert(`排序更新失敗: ${err.message}。介面將重新整理至資料庫狀態。`); await loadProducts(); } finally { renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = false); }
}
async function handleProductTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-btn')) { const { data, error } = await db.from('products').select('*').eq('id', id).single(); if (error) { alert(`查詢商品資料失敗: ${error.message}`); return; } showProductModal(data); } if (target.classList.contains('delete-btn')) { await handleProductDelete(id); } if (target.classList.contains('sort-up-btn')) { await handleProductSortSwap(id, 'up'); } if (target.classList.contains('sort-down-btn')) { await handleProductSortSwap(id, 'down'); }
}


// -----------------------------------------------------------
//  [V33.0] 區塊 5: 員工管理功能 (CRUD)
// -----------------------------------------------------------
async function loadEmployees() { 
    // [V37.6] 檢查是否在該頁面，不在則不刷新
    const activeSection = document.querySelector('.management-section.active');
    if (!activeSection || activeSection.id !== 'employee-management-section') {
        console.log("[Realtime] 收到 employees 刷新，但目前不在員工頁，跳過。");
        return;
    }

    try { 
        const { data, error } = await db.from('employees').select('*').order('id', { ascending: true }); 
        if (error) throw error; 
        renderEmployeeTable(data); 
    } catch (err) { 
        console.error("載入員工時發生錯誤:", err); 
        employeeTableBody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失败: ${err.message}</td></tr>`; 
    }
}
function renderEmployeeTable(employees) { 
    if (!employees || employees.length === 0) { 
        employeeTableBody.innerHTML = '<tr><td colspan="6" class="loading-message">目前沒有任何員工資料。</td></tr>'; 
        return; 
    } 
    employeeTableBody.innerHTML = ''; 
    employees.forEach(emp => { 
        const row = document.createElement('tr'); 
        const statusText = emp.is_active ? '<span class="status-active">✔ 在職中</span>' : '<span class="status-inactive">✘ 已停用</span>'; 
        const toggleActiveButton = emp.is_active 
            ? `<button class="btn-secondary deactivate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>` 
            : `<button class="btn-primary activate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`; 
        
        row.innerHTML = ` 
            <td>${emp.id}</td>
            <td>${emp.employee_name}</td>
            <td>${emp.employee_code}</td>
            <td>${emp.shift_preference || ''}</td>
            <td>${statusText}</td>
            <td> 
                <button class="btn-secondary edit-employee-btn" data-id="${emp.id}">編輯</button> 
                ${toggleActiveButton} 
                <button class="btn-danger delete-employee-btn" data-id="${emp.id}">刪除</button> 
            </td> 
        `; 
        employeeTableBody.appendChild(row); 
    });
}
function showEmployeeModal(employee = null) { 
    employeeFormErrorMessage.textContent = ''; 
    employeeForm.reset(); 
    if (employee) { 
        employeeModalTitle.textContent = '編輯員工'; 
        document.getElementById('employee-id').value = employee.id; 
        document.getElementById('employee-name').value = employee.employee_name; 
        document.getElementById('employee-code').value = employee.employee_code; 
        document.getElementById('employee-is-active').checked = employee.is_active;
        document.getElementById('employee-shift').value = employee.shift_preference || '';
    } else { 
        employeeModalTitle.textContent = '新增員工'; 
        document.getElementById('employee-id').value = ''; 
        document.getElementById('employee-is-active').checked = true; 
        document.getElementById('employee-shift').value = '';
    } 
    employeeModal.classList.add('active');
}
function hideEmployeeModal() { employeeModal.classList.remove('active'); employeeForm.reset(); }
async function handleEmployeeFormSubmit(e) { 
    e.preventDefault(); 
    employeeFormErrorMessage.textContent = ''; 
    const saveBtn = document.getElementById('save-employee-btn'); 
    saveBtn.disabled = true; 
    saveBtn.textContent = '儲存中...'; 
    
    const formData = new FormData(employeeForm); 
    const employeeData = Object.fromEntries(formData.entries()); 
    const employeeId = employeeData.id; 
    employeeData.is_active = document.getElementById('employee-is-active').checked; 
    
    if (employeeData.shift_preference !== undefined) {
        employeeData.shift_preference = employeeData.shift_preference.trim() || null;
    }

    try { 
        let response; 
        if (employeeId) { 
            const { id, ...updateData } = employeeData; 
            response = await db.from('employees').update(updateData).eq('id', employeeId).select(); 
        } else { 
            delete employeeData.id; 
            response = await db.from('employees').insert([employeeData]).select(); 
        } 
        const { data, error } = response; 
        if (error) { throw error; } 
        console.log('員工儲存成功:', data); 
        hideEmployeeModal(); 
        // [V37.6] 移除手動 load
        // await loadEmployees(); 
    } catch (err) { 
        console.error("儲存員工時發生錯誤:", err); 
        employeeFormErrorMessage.textContent = `儲存失敗: ${err.message}`; 
    } finally { 
        saveBtn.disabled = false; 
        saveBtn.textContent = '儲存'; 
    }
}
async function handleToggleEmployeeActive(id, newActiveState) { 
    const actionText = newActiveState ? '啟用' : '停用'; if (!confirm(`您確定要 ${actionText} ID 為 ${id} の員工嗎？\n(這將影響他們能否登入前台)`)) { return; } 
    try { const { error } = await db.from('employees').update({ is_active: newActiveState }).eq('id', id); if (error) { if (error.code === '23503') { alert(`${actionText} 失敗：此員工可能仍被歷史訂單關聯中。`); } else { throw error; } } else { console.log(`員工 ${id} ${actionText} 成功`); 
    // [V37.6] 移除手動 load
    // await loadEmployees(); 
    } } catch (err) { console.error(`員工 ${actionText} 時發生錯誤:`, err); alert(`${actionText} 失敗: ${err.message}`); }
}
async function handleEmployeeDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} の員工嗎？\n\n警告：此操作無法復原。\n如果該員工已有訂單紀錄，請改用「停用」功能。`)) { return; } 
    try { const { error } = await db.from('employees').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該員工已有歷史訂單紀錄，無法永久刪除。\n\n提示：請使用「停用」功能來取代。`); } else { throw error; } } else { console.log(`員工 ${id} 刪除成功`); 
    // [V37.6] 移除手動 load
    // await loadEmployees(); 
    } } catch (err) { console.error("刪除員工時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
async function handleEmployeeTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-employee-btn')) { const { data, error } = await db.from('employees').select('*').eq('id', id).single(); if (error) { alert(`查詢員工資料失敗: ${error.message}`); return; } showEmployeeModal(data); } if (target.classList.contains('deactivate-employee-btn')) { await handleToggleEmployeeActive(id, false); } if (target.classList.contains('activate-employee-btn')) { await handleToggleEmployeeActive(id, true); } if (target.classList.contains('delete-employee-btn')) { await handleEmployeeDelete(id); }
}


// -----------------------------------------------------------
//  [V34.0] 區塊 6: 訂單管理功能
// -----------------------------------------------------------
async function loadAllOrdersForSequence() {
    // [V37.6] 檢查是否在該頁面，不在則不刷新
    const activeSection = document.querySelector('.management-section.active');
    if (!activeSection || activeSection.id !== 'orders-section') {
        console.log("[Realtime] 收到 orders 刷新，但目前不在訂單頁，跳過。");
        return;
    }

    try {
        const { data, error } = await db.from('orders').select(`id, sales_date, total_amount, employees ( employee_name )`).order('id', { ascending: false }); 
        if (error) throw error;
        
        // [V37.6] Realtime 觸發時，檢查資料是否有真的變動
        if (JSON.stringify(allOrders) === JSON.stringify(data)) {
            return;
        }
        
        allOrders = data; 
        renderOrderTable(allOrders); 
    } catch (err) {
        console.error("載入所有訂單時發生錯誤:", err);
        allOrders = []; 
        orderListTableBody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderOrderTable(ordersToRender) {
    const totalOrders = allOrders.length; 
    if (!ordersToRender || ordersToRender.length === 0) {
        const message = filterSequenceNumber.value ? '找不到指定的訂單。' : '目前沒有任何訂單。';
        orderListTableBody.innerHTML = `<tr><td colspan="6" class="loading-message">${message}</td></tr>`;
        return;
    }
    orderListTableBody.innerHTML = ''; 
    ordersToRender.forEach(order => {
        const originalIndex = allOrders.findIndex(o => o.id === order.id);
        const sequenceNumber = totalOrders - originalIndex; 
        const empName = order.employees ? order.employees.employee_name : 'N/A';
        const salesTime = formatDate(order.sales_date); 
        const row = document.createElement('tr');
        row.className = 'order-row';
        row.dataset.id = order.id; 
        row.innerHTML = `
            <td>${sequenceNumber}</td> 
            <td>${order.id}</td>
            <td><span class="expand-arrow">►</span> ${salesTime}</td> 
            <td>${empName}</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>
                <button class="btn-danger delete-order-btn" data-id="${order.id}">刪除</button>
            </td>
        `;
        orderListTableBody.appendChild(row);
        const detailRow = document.createElement('tr');
        detailRow.className = 'order-detail-row';
        detailRow.dataset.id = order.id;
        detailRow.innerHTML = `
            <td colspan="6" class="order-detail-cell"> 
                <div class="order-detail-content">
                    <div class="order-detail-summary">
                        <p><strong>經手員工:</strong> ${empName}</p>
                        <p><strong>銷售時間:</strong> ${salesTime}</p>
                        <p><strong>總金額:</strong> ${formatCurrency(order.total_amount)}</p>
                    </div>
                    <div class="table-container modal-table-container">
                        <table id="order-details-table">
                            <thead> <tr> <th>商品名稱</th> <th>售價</th> <th>數量</th> <th>小計</th> </tr> </thead>
                            <tbody id="order-details-tbody-${order.id}">
                                <tr><td colspan="4" class="loading-message">載入明細中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </td>
        `;
        orderListTableBody.appendChild(detailRow);
    });
}
async function loadOrderDetails(orderId, targetTbody) { 
    if (!orderId || !targetTbody) return; if (targetTbody.dataset.loaded === 'true') { return; } 
    try { 
        const { data: items, error } = await db .from('order_items') .select(` quantity, price_at_sale, note, products ( name ) `) .eq('order_id', orderId); 
        if (error) throw error; 
        if (!items || items.length === 0) { 
            targetTbody.innerHTML = '<tr><td colspan="4" class="loading-message">此訂單沒有品項。</td></tr>'; 
        } else { 
            targetTbody.innerHTML = ''; 
            items.forEach(item => { 
                const row = document.createElement('tr'); 
                const prodName = item.products ? item.products.name : 'N/A';
                const noteHtml = item.note ? `<span class="item-note-display-backend">備註: ${item.note}</span>` : '';
                const subtotal = item.price_at_sale * item.quantity;
                row.innerHTML = ` 
                    <td>${prodName}${noteHtml}</td>
                    <td>${formatCurrency(item.price_at_sale)}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(subtotal)}</td> 
                `; 
                targetTbody.appendChild(row); 
            }); 
        } 
        targetTbody.dataset.loaded = 'true'; 
    } catch (err) { 
        console.error("載入訂單明細時發生錯誤:", err); 
        targetTbody.innerHTML = `<tr><td colspan="4" class="loading-message error">明細載入失敗: ${err.message}</td></tr>`; 
    }
}
async function handleOrderTableClick(e) { 
    const target = e.target; const orderRow = target.closest('tr.order-row'); if (target.classList.contains('delete-order-btn')) { e.stopPropagation(); const id = target.dataset.id; await handleDeleteOrder(id); return; } if (orderRow) { const id = orderRow.dataset.id; const detailRow = orderListTableBody.querySelector(`tr.order-detail-row[data-id="${id}"]`); if (orderRow.classList.contains('expanded')) { orderRow.classList.remove('expanded'); detailRow.classList.remove('expanded'); orderRow.querySelector('.expand-arrow').style.transform = 'rotate(0deg)'; } else { orderRow.classList.add('expanded'); detailRow.classList.add('expanded'); orderRow.querySelector('.expand-arrow').style.transform = 'rotate(90deg)'; const detailTbody = detailRow.querySelector(`#order-details-tbody-${id}`); await loadOrderDetails(id, detailTbody); } }
}
async function handleDeleteOrder(id) { 
    if (!confirm(`您確定要「永久刪除」訂單 ID ${id} 嗎？\n\n警告：此操作無法復原，將一併刪除所有相關明細。`)) { return; } 
    try { const { data, error } = await db.rpc('delete_order_and_items', { order_id_to_delete: id }); if (error) throw error; console.log(data); alert(`訂單 ${id} 已刪除。`); 
    // [V37.6] 移除手動 load
    // await loadAllOrdersForSequence(); 
    } catch (err) { console.error("刪除單筆訂單時發生錯誤:", err); alert(`刪除失败: ${err.message}`); }
}
async function handleDeleteAllOrders() { 
    if (!confirm("【極度危險】\n您確定要刪除「所有」訂單紀錄嗎？\n此操作將清空訂單和明細表。")) { return; } if (!confirm("【最終確認】\n此操作無法復原，所有銷售資料將被清除。是否繼續？")) { return; } 
    try { const { data, error } = await db.rpc('delete_all_orders_and_items'); if (error) throw error; console.log(data); alert('所有訂單均已成功刪除。'); 
    // [V37.6] 移除手動 load
    // await loadAllOrdersForSequence(); 
    } catch (err) { console.error("刪除所有訂單時發生錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}


// -----------------------------------------------------------
//  [V16.1] 區塊 7: 折扣管理功能 (CRUD)
// -----------------------------------------------------------
async function loadDiscounts() {
    // [V37.6] 檢查是否在該頁面，不在則不刷新
    const activeSection = document.querySelector('.management-section.active');
    if (!activeSection || activeSection.id !== 'discount-management-section') {
        console.log("[Realtime] 收到 discounts 刷新，但目前不在折扣頁，跳過。");
        return;
    }

    try {
        const { data, error } = await db
            .from('discounts')
            .select('*')
            .order('id', { ascending: true }); 
        if (error) throw error;
        renderDiscountTable(data); 
    } catch (err) {
        console.error("載入折扣時發生錯誤:", err);
        discountTableBody.innerHTML = `<tr><td colspan="5" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderDiscountTable(discounts) {
    if (!discounts || discounts.length === 0) {
        discountTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">目前沒有任何折扣。</td></tr>';
        return;
    }
    discountTableBody.innerHTML = ''; 
    discounts.forEach(item => {
        const row = document.createElement('tr');
        const statusText = item.is_active ? '<span class="status-active">✔ 啟用中</span>' : '<span class="status-inactive">✘ 已停用</span>';
        const toggleActiveButton = item.is_active
            ? `<button class="btn-secondary deactivate-discount-btn" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>`
            : `<button class="btn-primary activate-discount-btn" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`;
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${formatCurrency(item.amount)}</td>
            <td>${statusText}</td>
            <td>
                <button class="btn-secondary edit-discount-btn" data-id="${item.id}">編輯</button>
                ${toggleActiveButton}
                <button class="btn-danger delete-discount-btn" data-id="${item.id}">刪除</button>
            </td>
        `;
        discountTableBody.appendChild(row);
    });
}
function showDiscountModal(discount = null) {
    discountFormErrorMessage.textContent = ''; 
    discountForm.reset(); 
    if (discount) {
        discountModalTitle.textContent = '編輯折扣';
        document.getElementById('discount-id').value = discount.id;
        document.getElementById('discount-name').value = discount.name;
        document.getElementById('discount-amount').value = discount.amount;
        document.getElementById('discount-is-active').checked = discount.is_active;
    } else {
        discountModalTitle.textContent = '新增折扣';
        document.getElementById('discount-id').value = '';
        document.getElementById('discount-is-active').checked = true;
    }
    discountModal.classList.add('active');
}
function hideDiscountModal() {
    discountModal.classList.remove('active');
    discountForm.reset();
}
async function handleDiscountFormSubmit(e) {
    e.preventDefault();
    discountFormErrorMessage.textContent = '';
    const saveBtn = document.getElementById('save-discount-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    const formData = new FormData(discountForm);
    const discountData = Object.fromEntries(formData.entries());
    const discountId = discountData.id;
    discountData.is_active = document.getElementById('discount-is-active').checked;
    discountData.amount = parseFloat(discountData.amount);
    try {
        let response;
        if (discountId) {
            const { id, ...updateData } = discountData;
            response = await db.from('discounts').update(updateData).eq('id', discountId).select();
        } else {
            delete discountData.id;
            response = await db.from('discounts').insert([discountData]).select();
        }
        const { data, error } = response;
        if (error) { throw error; }
        console.log('折扣儲存成功:', data);
        hideDiscountModal();
        // [V37.6] 移除手動 load
        // await loadDiscounts();
    } catch (err) {
        console.error("儲存折扣時發生錯誤:", err);
        discountFormErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}
async function handleToggleDiscountActive(id, newActiveState) {
    const actionText = newActiveState ? '啟用' : '停用';
    if (!confirm(`您確定要 ${actionText} ID 為 ${id} の折扣嗎？\n(這將影響前台能否選取)`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .update({ is_active: newActiveState }) 
            .eq('id', id);
        if (error) throw error;
        console.log(`折扣 ${id} ${actionText} 成功`);
        // [V37.6] 移除手動 load
        // await loadDiscounts(); 
    } catch (err) {
        console.error(`折扣 ${actionText} 時發生錯誤:`, err);
        alert(`${actionText} 失敗: ${err.message}`);
    }
}
async function handleDiscountDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} の折扣嗎？\n\n警告：此操作無法復原。\n如果已有訂單使用此折扣，建議改用「停用」。`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .delete()
            .eq('id', id);
        if (error) {
            if (error.code === '23503') { 
                alert(`刪除失敗：該折扣已被歷史訂單使用，無法永久刪除。\n\n提示：請改用「停用」功能來取代。`);
            } else {
                throw error;
            }
        } else {
            console.log(`折扣 ${id} 刪除成功`);
            // [V37.6] 移除手動 load
            // await loadDiscounts(); 
        }
    } catch (err) {
        console.error("刪除折扣時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}
async function handleDiscountTableClick(e) {
    const target = e.target.closest('button'); 
    if (!target) return; 
    const id = target.dataset.id;
    if (!id) return; 

    if (target.classList.contains('edit-discount-btn')) {
        const { data, error } = await db.from('discounts').select('*').eq('id', id).single();
        if (error) { alert(`查詢折扣資料失敗: ${error.message}`); return; }
        showDiscountModal(data); 
    }
    if (target.classList.contains('deactivate-discount-btn')) {
        await handleToggleDiscountActive(id, false); 
    }
    if (target.classList.contains('activate-discount-btn')) {
        await handleToggleDiscountActive(id, true); 
    }
    if (target.classList.contains('delete-discount-btn')) {
        await handleDiscountDelete(id);
    }
}


// -----------------------------------------------------------
//  [V39.0 重寫] 區塊 8: 報表分析功能 (改用 RPC)
// -----------------------------------------------------------
async function loadDashboardData() {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        // [V39.0] 呼叫 RPC 函數
        const { data, error } = await db.rpc('fn_get_dashboard_stats', {
            p_start_date: todayStart,
            p_end_date: todayEnd
        });

        if (error) throw error;
        
        // [V39.0] 移除 V37.6 的前端計算
        // const { data: orders, error: ordersError } = await db.from('orders')...
        // const totalOrders = orders.length;
        // const totalSales = orders.reduce(...);
        // ... (移除所有前端計算) ...
        
        // [V39.0] 直接從 RPC 結果獲取數據
        const stats = data;
        const totalOrders = stats.total_orders;
        const totalSales = stats.total_sales;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const totalCost = stats.total_cost;
        const totalProfit = stats.total_profit;
        
        const animDuration = 1000; 
        
        // [V37.6] 獲取所有 DOM 上的*目前*數字
        const currentTotalSales = parseFloat(dashboardTotalSales.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalOrders = parseFloat(dashboardTotalOrders.textContent) || 0;
        const currentAvgOrderValue = parseFloat(dashboardAvgOrderValue.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalCost = parseFloat(dashboardTotalCost.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalProfit = parseFloat(dashboardTotalProfit.textContent.replace(/[^0-9.-]+/g,"")) || 0;

        // [V37.6] 修正：全部都使用 (current, new) 進行動畫
        animateValue(dashboardTotalSales, currentTotalSales, totalSales, animDuration, true, false);
        animateValue(dashboardTotalOrders, currentTotalOrders, totalOrders, animDuration, false, false);
        animateValue(dashboardAvgOrderValue, currentAvgOrderValue, avgOrderValue, animDuration, true, true); 
        animateValue(dashboardTotalCost, currentTotalCost, totalCost, animDuration, true, false);
        animateValue(dashboardTotalProfit, currentTotalProfit, totalProfit, animDuration, true, false);

    } catch (err) {
        console.error("載入總覽數據時發生錯誤:", err);
        dashboardTotalSales.textContent = '讀取失敗';
        dashboardTotalOrders.textContent = '讀取失敗';
        dashboardAvgOrderValue.textContent = 'N/A';
        dashboardTotalCost.textContent = 'N/A';
        dashboardTotalProfit.textContent = 'N/A';
    }
}
async function loadTopSellingProducts() {
    try {
        const { data, error } = await db.rpc('get_top_selling_products', { limit_count: 10 });
        if (error) throw error;
        renderTopProductsTable(data);
    } catch (err) {
        console.error("載入熱銷排行時發生錯誤:", err);
        topProductsTableBody.innerHTML = `<tr><td colspan="5" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderTopProductsTable(products) {
    if (!products || products.length === 0) {
        topProductsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">尚無銷售紀錄。</td></tr>';
        return;
    }
    topProductsTableBody.innerHTML = ''; 
    products.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.product_name || 'N/A'}</td>
            <td>${item.total_sold}</td>
            <td>${formatCurrency(item.total_revenue)}</td>
            <td>${formatCurrency(item.total_profit)}</td>
        `;
        topProductsTableBody.appendChild(row);
    });
}
async function loadEmployeeSalesStats() {
    try {
        const { data, error } = await db.rpc('get_employee_sales_stats');
        if (error) throw error;
        renderEmployeeSalesTable(data);
    } catch (err) {
        console.error("載入員工銷售排行時發生錯誤:", err);
        employeeSalesTableBody.innerHTML = `<tr><td colspan="4" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderEmployeeSalesTable(stats) {
    if (!stats || stats.length === 0) {
        employeeSalesTableBody.innerHTML = '<tr><td colspan="4" class="loading-message">尚無員工銷售紀錄。</td></tr>';
        return;
    }
    employeeSalesTableBody.innerHTML = ''; 
    stats.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.employee_name || 'N/A'}</td>
            <td>${formatCurrency(item.total_sales)}</td>
            <td>${item.total_orders}</td>
        `;
        employeeSalesTableBody.appendChild(row);
    });
}


// -----------------------------------------------------------
//  [V23.1] 區塊 9: 庫存盤點功能
// -----------------------------------------------------------
async function loadStocktakeList() {
    // [V37.6] 檢查是否在該頁面，不在則不刷新
    const activeSection = document.querySelector('.management-section.active');
    if (!activeSection || activeSection.id !== 'stocktake-section') {
        console.log("[Realtime] 收到 products 刷新，但目前不在盤點頁，跳過。");
        return;
    }

    if (!stocktakeListTbody) return;
    stocktakeListTbody.innerHTML = '<tr><td colspan="6" class="loading-message">載入商品資料中...</td></tr>';
    try {
        const { data, error } = await db
            .from('products')
            .select('id, name, category, stock')
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        renderStocktakeTable(data);
    } catch (err) {
        console.error("載入盤點清單時發生錯誤:", err);
        stocktakeListTbody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderStocktakeTable(products) {
    if (!products || products.length === 0) {
        stocktakeListTbody.innerHTML = '<tr><td colspan="6" class="loading-message">沒有商品可供盤點。</td></tr>';
        return;
    }
    stocktakeListTbody.innerHTML = '';
    products.forEach(product => {
        const row = document.createElement('tr');
        row.dataset.productId = product.id; 
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td class="db-stock">${product.stock}</td>
            <td>
                <input type="number" class="stocktake-input" data-id="${product.id}" value="${product.stock}" min="0">
            </td>
            <td class="stock-diff zero">0</td>
        `;
        stocktakeListTbody.appendChild(row);
    });
}
function handleStocktakeInputChange(e) {
    const target = e.target;
    if (!target.classList.contains('stocktake-input')) return;
    const row = target.closest('tr');
    if (!row) return;
    const dbStockEl = row.querySelector('.db-stock');
    const diffEl = row.querySelector('.stock-diff');
    const dbStock = parseInt(dbStockEl.textContent, 10);
    const actualStock = parseInt(target.value, 10);
    if (isNaN(dbStock) || isNaN(actualStock) || actualStock < 0) {
        diffEl.textContent = 'N/A';
        diffEl.className = 'stock-diff';
        if (actualStock < 0) target.value = 0; // 防止負數
        return;
    }
    const diff = actualStock - dbStock;
    diffEl.textContent = diff;
    diffEl.className = 'stock-diff'; // Reset
    if (diff > 0) {
        diffEl.classList.add('positive');
        diffEl.textContent = `+${diff}`; 
    } else if (diff < 0) {
        diffEl.classList.add('negative');
    } else {
        diffEl.classList.add('zero');
    }
}
async function handleUpdateAllStock() {
    if (!confirm("您確定要使用目前輸入的「實際盤點數量」覆蓋所有商品庫存嗎？\n\n【警告】此操作無法復原。")) {
        return;
    }
    updateAllStockBtn.disabled = true;
    updateAllStockBtn.textContent = '更新中...';
    const payload = [];
    const rows = stocktakeListTbody.querySelectorAll('tr');
    rows.forEach(row => {
        const id = row.dataset.productId;
        const input = row.querySelector('.stocktake-input');
        if (id && input) {
            const new_stock = parseInt(input.value, 10);
            if (!isNaN(new_stock) && new_stock >= 0) {
                payload.push({
                    id: parseInt(id, 10),
                    new_stock: new_stock
                });
            } else {
                console.warn(`ID ${id} の庫存值無效 (${input.value})，已跳過。`);
            }
        }
    });
    if (payload.length === 0) {
        alert("沒有有效的庫存資料可更新。");
        updateAllStockBtn.disabled = false;
        updateAllStockBtn.textContent = '✔ 一鍵更新庫存';
        return;
    }
    try {
        const { error } = await db.rpc('bulk_update_stock', { updates: payload });
        if (error) throw error;
        alert(`成功更新 ${payload.length} 項商品的庫存！`);
        // [V37.6] 盤點頁在 RPC 成功後仍需手動載入，因為 Realtime 只會觸發 loadProducts
        await loadStocktakeList(); 
    } catch (err) {
        console.error("批次更新庫存時發生錯誤:", err);
        alert(`更新失敗: ${err.message}`);
    } finally {
        updateAllStockBtn.disabled = false;
        updateAllStockBtn.textContent = '✔ 一鍵更新庫存';
    }
}


// -----------------------------------------------------------
//  [V32.0] 區塊 10: 匯出功能
// -----------------------------------------------------------
function handleExportProducts() {
    if (typeof XLSX === 'undefined') {
        alert("錯誤：Excel 匯出函式庫 (SheetJS) 尚未載入。");
        return;
    }
    if (currentProductList.length === 0) {
        alert("沒有商品資料可匯出。");
        return;
    }
    const dataToExport = currentProductList.map(p => ({
        '商品ID': p.id,
        '名稱': p.name,
        '分類': p.category,
        '售價': p.price,
        '成本': p.cost ?? 0,
        '庫存 (浮動)': p.stock,
        '正常庫存 (固定)': p.par_stock ?? 0,
        '預警門檻': p.warning_threshold ?? 'N/A',
        '狀態': p.is_active ? '上架中' : '已下架',
        '排序值': p.sort_order
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    XLSX.writeFile(wb, "商品列表.xlsx");
}
function handleExportOrders() {
    if (typeof XLSX === 'undefined') {
        alert("錯誤：Excel 匯出函式庫 (SheetJS) 尚未載入。");
        return;
    }
    if (allOrders.length === 0) {
        alert("沒有訂單資料可匯出。");
        return;
    }
    const totalOrders = allOrders.length; 
    const dataToExport = allOrders.map((order, index) => ({
        '第幾筆': totalOrders - index,
        '訂單ID': order.id,
        '銷售日期': formatDate(order.sales_date),
        '經手員工': order.employees ? order.employees.employee_name : 'N/A',
        '總金額': order.total_amount
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "訂單列表");
    XLSX.writeFile(wb, "訂單列表.xlsx");
}


// -----------------------------------------------------------
//  [V26.0] 區塊 11: 報表分頁功能
// -----------------------------------------------------------
function setupReportTabs() {
    if (!reportSubNavButtons.length) return; // 防呆
    reportSubNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            if (!targetId) return;
            reportSubNavButtons.forEach(btn => btn.classList.remove('active'));
            reportContentSections.forEach(sec => sec.classList.remove('active'));
            button.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}


// -----------------------------------------------------------
//  [V37.6 修改] 區塊 12: 自動刷新 (僅報表)
// -----------------------------------------------------------
/**
 * [V37.6] 僅刷新報表資料 (保留 V35.0 的邏輯)
 */
function refreshReportData() {
    // 檢查是否有 Modal 開啟中，有則不刷新
    if (document.querySelector('.modal.active')) {
        console.log("[V37.6] Modal 開啟中，跳過報表刷新。");
        return;
    }
    
    // 檢查是否仍在報表頁
    const activeSection = document.querySelector('.management-section.active');
    if (activeSection && activeSection.id === 'reports-section') {
        console.log("[V37.6] 10秒自動刷新: 報表");
        loadDashboardData();
        loadTopSellingProducts();
        loadEmployeeSalesStats();
    } else {
        // [V37.6] 不在報表頁，安靜跳過
    }
}


// -----------------------------------------------------------
//  [V37.6 修改] 區塊 13: 事件監聽器
// -----------------------------------------------------------

/**
 * [V37.6 新增]
 * 啟動全局 Realtime 監聽 (一次性)
 */
function setupGlobalRealtime() {
    console.log("✅ [Realtime] 啟動全局監聽...");
    
    // [V37.7] 修復: 使用 'db.channel' 而不是 'supabase.channel'
    db.channel('public:products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },
            (payload) => {
                console.log('🔄 [Realtime] 偵測到 products 變更');
                // 檢查是否在商品頁，是才刷新
                if (document.getElementById('product-management-section').classList.contains('active')) {
                    loadProducts(); 
                }
                // 檢查是否在盤點頁，是才刷新
                if (document.getElementById('stocktake-section').classList.contains('active')) {
                    loadStocktakeList();
                }
            }
        ).subscribe();

    db.channel('public:employees')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' },
            () => {
                console.log('🔄 [Realtime] 偵測到 employees 變更');
                if (document.getElementById('employee-management-section').classList.contains('active')) {
                    loadEmployees(); // 刷新員工
                }
            }
        ).subscribe();

    db.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
            () => {
                console.log('🔄 [Realtime] 偵測到 orders 變更');
                if (document.getElementById('orders-section').classList.contains('active')) {
                    loadAllOrdersForSequence(); // 刷新訂單
                }
            }
        ).subscribe();
        
    // [V37.6] 監聽 order_items 變化時，也刷新訂單列表 (因為刪除訂單會觸發)
    db.channel('public:order_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
            () => {
                console.log('🔄 [Realtime] 偵測到 order_items 變更');
                if (document.getElementById('orders-section').classList.contains('active')) {
                    loadAllOrdersForSequence(); // 刷新訂單
                }
            }
        ).subscribe();


    db.channel('public:discounts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'discounts' },
            () => {
                console.log('🔄 [Realtime] 偵測到 discounts 變更');
                if (document.getElementById('discount-management-section').classList.contains('active')) {
                    loadDiscounts(); // 刷新折扣
                }
            }
        ).subscribe();
}

/**
 * [V37.6 修改] 簡化導航，只管切換和單次載入
 */
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            
            // [V37.6] 簡化：只管切換頁面，不管監聽/計時器
            const targetId = link.dataset.target;
            if (!targetId) { return; }

            navLinks.forEach(nav => nav.classList.remove('active'));
            managementSections.forEach(sec => sec.classList.remove('active'));
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
                // 報表頁在點擊時也立即刷新一次
                loadDashboardData();
                loadTopSellingProducts();
                loadEmployeeSalesStats(); 
                
                if (reportSubNavButtons.length > 0 && reportContentSections.length > 0) {
                    reportSubNavButtons.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.target === 'report-top-products');
                    });
                    reportContentSections.forEach(sec => {
                        sec.classList.toggle('active', sec.id === 'report-top-products');
                    });
                }
                
            } else if (targetId === 'stocktake-section') {
                loadStocktakeList();
            }
        });
    });
}

// 頁面載入完成後
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupReportTabs(); 
    loadProducts(); // 預設載入商品
    
    // [V37.6] 啟動全局 Realtime 監聽
    setupGlobalRealtime(); 
    
    // [V37.6] 啟動報表 10 秒刷新計時器
    autoRefreshInterval = setInterval(refreshReportData, 10000); // 10秒
    console.log("[V37.6] 全局 10 秒報表刷新已啟動。");
    
    backToPosBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

    // 商品 Modal 控制 & 表單 & 表格點擊
    addProductBtn.addEventListener('click', () => showProductModal(null));
    productModal.querySelector('.close-btn').addEventListener('click', hideProductModal);
    productModal.querySelector('.cancel-btn').addEventListener('click', hideProductModal);
    productModal.addEventListener('click', (e) => { if (e.target === productModal) hideProductModal(); });
    productForm.addEventListener('submit', handleProductFormSubmit);
    productTableBody.addEventListener('click', handleProductTableClick);

    // 員工 Modal 控制 & 表單 & 表格點擊
    addEmployeeBtn.addEventListener('click', () => showEmployeeModal(null));
    employeeModal.querySelector('.close-btn').addEventListener('click', hideEmployeeModal);
    employeeModal.querySelector('.cancel-btn').addEventListener('click', hideEmployeeModal);
    employeeModal.addEventListener('click', (e) => { if (e.target === employeeModal) hideEmployeeModal(); });
    employeeForm.addEventListener('submit', handleEmployeeFormSubmit);
    employeeTableBody.addEventListener('click', handleEmployeeTableClick);

    // 訂單表格點擊 (展開/刪除)
    orderListTableBody.addEventListener('click', handleOrderTableClick);

    // 訂單篩選按鈕
    filterSearchBtn.addEventListener('click', () => {
        const seqNum = parseInt(filterSequenceNumber.value, 10);
        const total = allOrders.length;
        if (isNaN(seqNum) || seqNum < 1 || seqNum > total) {
            alert(`請輸入有效的數字 (1 到 ${total} 之間)。`);
            renderOrderTable(allOrders); 
            return;
        }
        const index = total - seqNum; 
        if (index >= 0 && index < total) {
            renderOrderTable([allOrders[index]]); 
        } else {
            renderOrderTable([]); 
        }
    }); 
    filterClearBtn.addEventListener('click', () => { 
        filterSequenceNumber.value = '';
        renderOrderTable(allOrders); 
    });
    deleteAllOrdersBtn.addEventListener('click', handleDeleteAllOrders);

    // 折扣 Modal 控制 & 表單 & 表格點擊
    addDiscountBtn.addEventListener('click', () => showDiscountModal(null));
    discountModal.querySelector('.close-btn').addEventListener('click', hideDiscountModal);
    discountModal.querySelector('.cancel-btn').addEventListener('click', hideDiscountModal);
    discountModal.addEventListener('click', (e) => {
        if (e.target === discountModal) hideDiscountModal();
    });
    discountForm.addEventListener('submit', handleDiscountFormSubmit);
    discountTableBody.addEventListener('click', handleDiscountTableClick);

    // [V23.0] 庫存盤點: 自動計算差異
    if (stocktakeListTbody) {
        stocktakeListTbody.addEventListener('input', handleStocktakeInputChange);
    }
    
    // [V23.1] 庫存盤點: 綁定更新按鈕
    if (updateAllStockBtn) {
        updateAllStockBtn.addEventListener('click', handleUpdateAllStock);
    }

    // [V32.0] 匯出按鈕
    if (exportProductsBtn) {
        exportProductsBtn.addEventListener('click', handleExportProducts);
    }
    if (exportOrdersBtn) {
        exportOrdersBtn.addEventListener('click', handleExportOrders);
    }
});