/* ====================================================================
   後台管理 (Backend) 邏輯 (V16.1 - 折扣安全刪除版)
   - [新增] 區塊 7: 新增「刪除折扣」功能 (handleDiscountDelete)
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
    return `NT$ ${Math.max(0, amount).toFixed(0)}`;
}

// ====================================================================
// 3. DOM 元素參照
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
let allOrders = []; 
const filterSequenceNumber = document.getElementById('filter-sequence-number');
const filterSearchBtn = document.getElementById('filter-search-btn');
const filterClearBtn = document.getElementById('filter-clear-btn');
const deleteAllOrdersBtn = document.getElementById('delete-all-orders-btn');
// [V16] 折扣
const discountTableBody = document.getElementById('discount-list-tbody');
const discountModal = document.getElementById('discount-modal');
const discountForm = document.getElementById('discount-form');
const addDiscountBtn = document.getElementById('add-discount-btn');
const discountModalTitle = document.getElementById('discount-modal-title');
const discountFormErrorMessage = document.getElementById('discount-form-error-message');


// -----------------------------------------------------------
//  區塊 4: 商品管理功能 (CRUD) - (V10.1 版本)
// -----------------------------------------------------------
async function loadProducts() { 
    productTableBody.innerHTML = '<tr><td colspan="10" class="loading-message">載入商品資料中...</td></tr>';
    try {
        const { data, error } = await db.from('products').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }); 
        if (error) throw error;
        currentProductList = JSON.parse(JSON.stringify(data));
        renderProductTable(data); 
    } catch (err) {
        console.error("載入商品時發生錯誤:", err);
        productTableBody.innerHTML = `<tr><td colspan="10" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
function renderProductTable(products) { 
    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="10" class="loading-message">目前沒有任何商品。</td></tr>';
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
            <td>${product.id}</td><td>${product.name}</td><td>${product.category}</td><td>${formatCurrency(product.price)}</td><td>${formatCurrency(product.cost)}</td><td>${product.stock}</td><td>${product.warning_threshold ?? 'N/A'}</td><td>${statusText}</td>${sortButtons}<td> <button class="btn-secondary edit-btn" data-id="${product.id}">編輯/上下架</button> <button class="btn-danger delete-btn" data-id="${product.id}">刪除</button> </td>
        `;
        productTableBody.appendChild(row);
    });
}
function showProductModal(product = null) { 
    productFormErrorMessage.textContent = ''; productForm.reset(); 
    if (product) {
        productModal.querySelector('#modal-title').textContent = '編輯商品'; document.getElementById('product-id').value = product.id; document.getElementById('product-name').value = product.name; document.getElementById('product-category').value = product.category; document.getElementById('product-price').value = product.price; document.getElementById('product-cost').value = product.cost ?? 0; document.getElementById('product-stock').value = product.stock; document.getElementById('product-warning-threshold').value = product.warning_threshold ?? 10; document.getElementById('product-is-active').checked = product.is_active;
    } else {
        productModal.querySelector('#modal-title').textContent = '新增商品'; document.getElementById('product-id').value = ''; document.getElementById('product-is-active').checked = true;
    }
    productModal.classList.add('active');
}
function hideProductModal() { productModal.classList.remove('active'); productForm.reset(); }
async function handleProductFormSubmit(e) { 
    e.preventDefault(); productFormErrorMessage.textContent = ''; const saveBtn = document.getElementById('save-product-btn'); saveBtn.disabled = true; saveBtn.textContent = '儲存中...'; const formData = new FormData(productForm); const productData = Object.fromEntries(formData.entries()); const productId = productData.id; productData.is_active = document.getElementById('product-is-active').checked; productData.price = parseFloat(productData.price); productData.cost = parseFloat(productData.cost) || 0; productData.stock = parseInt(productData.stock, 10); productData.warning_threshold = parseInt(productData.warning_threshold, 10) || 0; 
    try {
        let response; if (productId) { const { id, ...updateData } = productData; response = await db.from('products').update(updateData).eq('id', productId).select(); } else { delete productData.id; const newSortOrder = (currentProductList.length + 1) * 10; productData.sort_order = newSortOrder; response = await db.from('products').insert([productData]).select(); } const { data, error } = response; if (error) { throw error; } console.log('商品儲存成功:', data); hideProductModal(); await loadProducts();
    } catch (err) { console.error("儲存商品時發生錯誤:", err); productFormErrorMessage.textContent = `儲存失敗: ${err.message}`; } finally { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
}
async function handleProductDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的商品嗎？\n\n注意：此操作無法復原。\n如果只是暫時不賣，請使用「編輯/上下架」功能。`)) { return; } 
    try { const { error } = await db.from('products').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該商品已有銷售紀錄，無法永久刪除。\n\n提示：請使用「編輯/上下架」功能將其「下架」，即可在前台隱藏該商品。`); } else { throw error; } } else { console.log(`商品 ${id} 刪除成功`); await loadProducts(); } } catch (err) { console.error("刪除商品時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
async function handleProductSortSwap(productId, direction) { 
    const productIndex = currentProductList.findIndex(p => p.id == productId); if (productIndex === -1) return; const newIndex = (direction === 'up') ? productIndex - 1 : productIndex + 1; if (newIndex < 0 || newIndex >= currentProductList.length) return; const [item] = currentProductList.splice(productIndex, 1); currentProductList.splice(newIndex, 0, item); renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = true); 
    try { const updatePayload = currentProductList.map((product, index) => ({ id: product.id, sort_order: index * 10 })); const { error } = await db.rpc('bulk_update_sort_order', { updates: updatePayload }); if (error) throw error; console.log('商品排序更新成功！'); } catch (err) { console.error("交換商品排序並呼叫 RPC 時發生錯誤:", err); alert(`排序更新失敗: ${err.message}。介面將重新整理至資料庫狀態。`); await loadProducts(); } finally { renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = false); }
}
async function handleProductTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-btn')) { const { data, error } = await db.from('products').select('*').eq('id', id).single(); if (error) { alert(`查詢商品資料失敗: ${error.message}`); return; } showProductModal(data); } if (target.classList.contains('delete-btn')) { await handleProductDelete(id); } if (target.classList.contains('sort-up-btn')) { await handleProductSortSwap(id, 'up'); } if (target.classList.contains('sort-down-btn')) { await handleProductSortSwap(id, 'down'); }
}


// -----------------------------------------------------------
//  區塊 5: 員工管理功能 (CRUD) - (V9 版本)
// -----------------------------------------------------------
async function loadEmployees() { 
    employeeTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">載入員工資料中...</td></tr>';
    try { const { data, error } = await db.from('employees').select('*').order('id', { ascending: true }); if (error) throw error; renderEmployeeTable(data); } catch (err) { console.error("載入員工時發生錯誤:", err); employeeTableBody.innerHTML = `<tr><td colspan="5" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`; }
}
function renderEmployeeTable(employees) { 
    if (!employees || employees.length === 0) { employeeTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">目前沒有任何員工資料。</td></tr>'; return; } employeeTableBody.innerHTML = ''; employees.forEach(emp => { const row = document.createElement('tr'); const statusText = emp.is_active ? '<span class="status-active">✔ 在職中</span>' : '<span class="status-inactive">✘ 已停用</span>'; const toggleActiveButton = emp.is_active ? `<button class="btn-secondary deactivate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>` : `<button class="btn-primary activate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`; row.innerHTML = ` <td>${emp.id}</td><td>${emp.employee_name}</td><td>${emp.employee_code}</td><td>${statusText}</td><td> <button class="btn-secondary edit-employee-btn" data-id="${emp.id}">編輯</button> ${toggleActiveButton} <button class="btn-danger delete-employee-btn" data-id="${emp.id}">刪除</button> </td> `; employeeTableBody.appendChild(row); });
}
function showEmployeeModal(employee = null) { 
    employeeFormErrorMessage.textContent = ''; employeeForm.reset(); if (employee) { employeeModalTitle.textContent = '編輯員工'; document.getElementById('employee-id').value = employee.id; document.getElementById('employee-name').value = employee.employee_name; document.getElementById('employee-code').value = employee.employee_code; document.getElementById('employee-is-active').checked = employee.is_active; } else { employeeModalTitle.textContent = '新增員工'; document.getElementById('employee-id').value = ''; document.getElementById('employee-is-active').checked = true; } employeeModal.classList.add('active');
}
function hideEmployeeModal() { employeeModal.classList.remove('active'); employeeForm.reset(); }
async function handleEmployeeFormSubmit(e) { 
    e.preventDefault(); employeeFormErrorMessage.textContent = ''; const saveBtn = document.getElementById('save-employee-btn'); saveBtn.disabled = true; saveBtn.textContent = '儲存中...'; const formData = new FormData(employeeForm); const employeeData = Object.fromEntries(formData.entries()); const employeeId = employeeData.id; employeeData.is_active = document.getElementById('employee-is-active').checked; 
    try { let response; if (employeeId) { const { id, ...updateData } = employeeData; response = await db.from('employees').update(updateData).eq('id', employeeId).select(); } else { delete employeeData.id; response = await db.from('employees').insert([employeeData]).select(); } const { data, error } = response; if (error) { throw error; } console.log('員工儲存成功:', data); hideEmployeeModal(); await loadEmployees(); } catch (err) { console.error("儲存員工時發生錯誤:", err); employeeFormErrorMessage.textContent = `儲存失敗: ${err.message}`; } finally { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
}
async function handleToggleEmployeeActive(id, newActiveState) { 
    const actionText = newActiveState ? '啟用' : '停用'; if (!confirm(`您確定要 ${actionText} ID 為 ${id} 的員工嗎？\n(這將影響他們能否登入前台)`)) { return; } 
    try { const { error } = await db.from('employees').update({ is_active: newActiveState }).eq('id', id); if (error) { if (error.code === '23503') { alert(`${actionText} 失敗：此員工可能仍被歷史訂單關聯中。`); } else { throw error; } } else { console.log(`員工 ${id} ${actionText} 成功`); await loadEmployees(); } } catch (err) { console.error(`員工 ${actionText} 時發生錯誤:`, err); alert(`${actionText} 失敗: ${err.message}`); }
}
async function handleEmployeeDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的員工嗎？\n\n警告：此操作無法復原。\n如果該員工已有訂單紀錄，請改用「停用」功能。`)) { return; } 
    try { const { error } = await db.from('employees').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該員工已有歷史訂單紀錄，無法永久刪除。\n\n提示：請使用「停用」功能來取代。`); } else { throw error; } } else { console.log(`員工 ${id} 刪除成功`); await loadEmployees(); } } catch (err) { console.error("刪除員工時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
async function handleEmployeeTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-employee-btn')) { const { data, error } = await db.from('employees').select('*').eq('id', id).single(); if (error) { alert(`查詢員工資料失敗: ${error.message}`); return; } showEmployeeModal(data); } if (target.classList.contains('deactivate-employee-btn')) { await handleToggleEmployeeActive(id, false); } if (target.classList.contains('activate-employee-btn')) { await handleToggleEmployeeActive(id, true); } if (target.classList.contains('delete-employee-btn')) { await handleEmployeeDelete(id); }
}


// -----------------------------------------------------------
//  [V10.1] 區塊 6: 訂單管理功能
// -----------------------------------------------------------
async function loadAllOrdersForSequence() {
    orderListTableBody.innerHTML = '<tr><td colspan="6" class="loading-message">載入訂單資料中...</td></tr>';
    try {
        const { data, error } = await db.from('orders').select(`id, sales_date, total_amount, employees ( employee_name )`).order('id', { ascending: false }); 
        if (error) throw error;
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
        const salesTime = new Date(order.sales_date).toLocaleString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        // [V10.1] 查詢 'note'
        const { data: items, error } = await db .from('order_items') .select(` quantity, price_at_sale, subtotal, note, products ( name ) `) .eq('order_id', orderId); 
        if (error) throw error; 
        // [V10.1] 渲染明細
        if (!items || items.length === 0) { 
            targetTbody.innerHTML = '<tr><td colspan="4" class="loading-message">此訂單沒有品項。</td></tr>'; 
        } else { 
            targetTbody.innerHTML = ''; 
            items.forEach(item => { 
                const row = document.createElement('tr'); 
                const prodName = item.products ? item.products.name : 'N/A';
                const noteHtml = item.note ? `<span class="item-note-display-backend">備註: ${item.note}</span>` : '';
                row.innerHTML = ` 
                    <td>${prodName}${noteHtml}</td>
                    <td>${formatCurrency(item.price_at_sale)}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.subtotal)}</td> 
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
    try { const { data, error } = await db.rpc('delete_order_and_items', { order_id_to_delete: id }); if (error) throw error; console.log(data); alert(`訂單 ${id} 已刪除。`); await loadAllOrdersForSequence(); } catch (err) { console.error("刪除單筆訂單時發生錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
async function handleDeleteAllOrders() { 
    if (!confirm("【極度危險】\n您確定要刪除「所有」訂單紀錄嗎？\n此操作將清空訂單和明細表。")) { return; } if (!confirm("【最終確認】\n此操作無法復原，所有銷售資料將被清除。是否繼續？")) { return; } 
    try { const { data, error } = await db.rpc('delete_all_orders_and_items'); if (error) throw error; console.log(data); alert('所有訂單均已成功刪除。'); await loadAllOrdersForSequence(); } catch (err) { console.error("刪除所有訂單時發生錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}


// -----------------------------------------------------------
//  [V16.1 修改] 區塊 7: 折扣管理功能 (CRUD)
// -----------------------------------------------------------

/**
 * [V16] 載入所有折扣並渲染到表格
 */
async function loadDiscounts() {
    discountTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">載入折扣資料中...</td></tr>';
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

/**
 * [V16.1] 將折扣資料渲染成 HTML 表格 (新增刪除按鈕)
 */
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
            ? `<button class.btn-secondary" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>` // [V16.1] 修正：btn-secondary
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

/**
 * [V16] 顯示折扣 Modal
 */
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

/**
 * [V16] 隱藏折扣 Modal
 */
function hideDiscountModal() {
    discountModal.classList.remove('active');
    discountForm.reset();
}

/**
 * [V16] 處理折扣表單提交 (新增/更新)
 */
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
        await loadDiscounts();
    } catch (err) {
        console.error("儲存折扣時發生錯誤:", err);
        discountFormErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}

/**
 * [V16] 處理折扣啟用/停用
 */
async function handleToggleDiscountActive(id, newActiveState) {
    const actionText = newActiveState ? '啟用' : '停用';
    if (!confirm(`您確定要 ${actionText} ID 為 ${id} 的折扣嗎？\n(這將影響前台能否選取)`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .update({ is_active: newActiveState }) 
            .eq('id', id);

        if (error) throw error;
        
        console.log(`折扣 ${id} ${actionText} 成功`);
        await loadDiscounts(); 

    } catch (err) {
        console.error(`折扣 ${actionText} 時發生錯誤:`, err);
        alert(`${actionText} 失敗: ${err.message}`);
    }
}

/**
 * [V16.1 新增] 處理折扣刪除 (安全刪除)
 */
async function handleDiscountDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的折扣嗎？\n\n警告：此操作無法復原。\n如果已有訂單使用此折扣，建議改用「停用」。`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .delete()
            .eq('id', id);

        if (error) {
            // 檢查是否為 外鍵約束(Foreign Key) 錯誤 (orders.discount_id)
            if (error.code === '23503') { 
                alert(`刪除失敗：該折扣已被歷史訂單使用，無法永久刪除。\n\n提示：請改用「停用」功能來取代。`);
            } else {
                throw error;
            }
        } else {
            // 刪除成功
            console.log(`折扣 ${id} 刪除成功`);
            await loadDiscounts(); 
        }
    } catch (err) {
        console.error("刪除折扣時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}

/**
 * [V16.1] 折扣表格點擊事件 (新增刪除)
 */
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
    // [V16.1 新增]
    if (target.classList.contains('delete-discount-btn')) {
        await handleDiscountDelete(id);
    }
}


// -----------------------------------------------------------
//  [V16 修改] 區塊 8: 事件監聽器
// -----------------------------------------------------------

// 導航分頁切換邏輯
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.dataset.target;
            
            // [V16] 啟用 'discount-management-section'
            if (!targetId || targetId === 'reports-section') {
                if(targetId) alert('此功能待實作');
                return; 
            }
            navLinks.forEach(nav => nav.classList.remove('active'));
            managementSections.forEach(sec => sec.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'product-management-section') {
                loadProducts();
            } else if (targetId === 'employee-management-section') {
                loadEmployees();
            } else if (targetId === 'orders-section') {
                loadAllOrdersForSequence(); 
            } else if (targetId === 'discount-management-section') {
                loadDiscounts(); // [V16] 載入折扣
            }
        });
    });
}

// 頁面載入完成後
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadProducts(); // 預設載入商品

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

    // [V16.1] 折扣 Modal 控制 & 表單 & 表格點擊
    addDiscountBtn.addEventListener('click', () => showDiscountModal(null));
    discountModal.querySelector('.close-btn').addEventListener('click', hideDiscountModal);
    discountModal.querySelector('.cancel-btn').addEventListener('click', hideDiscountModal);
    discountModal.addEventListener('click', (e) => {
        if (e.target === discountModal) hideDiscountModal();
    });
    discountForm.addEventListener('submit', handleDiscountFormSubmit);
    discountTableBody.addEventListener('click', handleDiscountTableClick);
});