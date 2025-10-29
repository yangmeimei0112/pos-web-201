/* ====================================================================
   後台管理 (Backend) 邏輯 (V7.2 - 員工安全刪除版)
   - 新增「永久刪除」員工按鈕
   - 新增 handleEmployeeDelete 邏輯，可處理 23503 (外鍵) 錯誤
   ==================================================================== */

// -----------------------------------------------------------
//  區塊 1: Supabase 初始化
// -----------------------------------------------------------

const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";

if (typeof supabase === 'undefined') {
    console.error("Supabase client 未載入。請確保 HTML 檔案中已正確引入 supabase-js。");
}

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase (後台) 初始化成功", db);

// -----------------------------------------------------------
//  區塊 2: DOM 元素參照
// -----------------------------------------------------------
const backToPosBtn = document.getElementById('back-to-pos-btn');
const navLinks = document.querySelectorAll('.backend-nav li');
const managementSections = document.querySelectorAll('.management-section');
const productTableBody = document.getElementById('product-list-tbody');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const productFormErrorMessage = document.getElementById('product-form-error-message');
let currentProductList = []; 
const employeeTableBody = document.getElementById('employee-list-tbody');
const employeeModal = document.getElementById('employee-modal');
const employeeForm = document.getElementById('employee-form');
const addEmployeeBtn = document.getElementById('add-employee-btn');
const employeeModalTitle = document.getElementById('employee-modal-title');
const employeeFormErrorMessage = document.getElementById('employee-form-error-message');


// -----------------------------------------------------------
//  區塊 3: 商品管理功能 (CRUD)
//  (此區塊未變動)
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
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.price}</td>
            <td>${product.cost ?? 'N/A'}</td>
            <td>${product.stock}</td>
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
    } else {
        productModal.querySelector('#modal-title').textContent = '新增商品';
        document.getElementById('product-id').value = '';
        document.getElementById('product-is-active').checked = true;
    }
    productModal.classList.add('active');
}
function hideProductModal() {
    productModal.classList.remove('active');
    productForm.reset();
}
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
        await loadProducts();
    } catch (err) {
        console.error("儲存商品時發生錯誤:", err);
        productFormErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}
async function handleProductDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的商品嗎？\n\n注意：此操作無法復原。\n如果只是暫時不賣，請使用「編輯/上下架」功能。`)) {
        return;
    }
    try {
        const { error } = await db.from('products').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') { 
                alert(`刪除失敗：該商品已有銷售紀錄，無法永久刪除。\n\n提示：請使用「編輯/上下架」功能將其「下架」，即可在前台隱藏該商品。`);
            } else {
                throw error;
            }
        } else {
            console.log(`商品 ${id} 刪除成功`);
            await loadProducts(); 
        }
    } catch (err) {
        console.error("刪除商品時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}
async function handleProductSortSwap(productId, direction) {
    const productIndex = currentProductList.findIndex(p => p.id == productId);
    if (productIndex === -1) return;
    const newIndex = (direction === 'up') ? productIndex - 1 : productIndex + 1;
    if (newIndex < 0 || newIndex >= currentProductList.length) return;
    const [item] = currentProductList.splice(productIndex, 1);
    currentProductList.splice(newIndex, 0, item);
    renderProductTable(currentProductList);
    document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = true);
    try {
        const updatePayload = currentProductList.map((product, index) => ({
            id: product.id,
            sort_order: index * 10 
        }));
        const { error } = await db.rpc('bulk_update_sort_order', { updates: updatePayload });
        if (error) throw error;
        console.log('商品排序更新成功！');
    } catch (err) {
        console.error("交換商品排序並呼叫 RPC 時發生錯誤:", err);
        alert(`排序更新失敗: ${err.message}。介面將重新整理至資料庫狀態。`);
        await loadProducts();
    } finally {
        renderProductTable(currentProductList); 
        document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = false);
    }
}
async function handleProductTableClick(e) {
    const target = e.target.closest('button'); 
    if (!target) return; 
    const id = target.dataset.id;
    if (!id) return; 
    if (target.classList.contains('edit-btn')) {
        const { data, error } = await db.from('products').select('*').eq('id', id).single();
        if (error) { alert(`查詢商品資料失敗: ${error.message}`); return; }
        showProductModal(data); 
    }
    if (target.classList.contains('delete-btn')) {
        await handleProductDelete(id);
    }
    if (target.classList.contains('sort-up-btn')) {
        await handleProductSortSwap(id, 'up');
    }
    if (target.classList.contains('sort-down-btn')) {
        await handleProductSortSwap(id, 'down');
    }
}


// -----------------------------------------------------------
//  [V7.2 修改] 區塊 4: 員工管理功能 (CRUD)
// -----------------------------------------------------------

/**
 * [V7] 載入所有員工並渲染到表格
 */
async function loadEmployees() {
    employeeTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">載入員工資料中...</td></tr>';
    try {
        const { data, error } = await db
            .from('employees')
            .select('*')
            .order('id', { ascending: true }); // 根據 ID 排序

        if (error) throw error;
        
        renderEmployeeTable(data); 

    } catch (err) {
        console.error("載入員工時發生錯誤:", err);
        employeeTableBody.innerHTML = `<tr><td colspan="5" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}

/**
 * [V7.2] 將員工資料渲染成 HTML 表格 (新增刪除按鈕)
 */
function renderEmployeeTable(employees) {
    if (!employees || employees.length === 0) {
        employeeTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">目前沒有任何員工資料。</td></tr>';
        return;
    }
    employeeTableBody.innerHTML = ''; 
    employees.forEach(emp => {
        const row = document.createElement('tr');
        const statusText = emp.is_active ? '<span class="status-active">✔ 在職中</span>' : '<span class="status-inactive">✘ 已停用</span>';
        
        // 停用/啟用 按鈕
        const toggleActiveButton = emp.is_active
            ? `<button class="btn-secondary deactivate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>` // [V7.2] 改為灰色
            : `<button class="btn-primary activate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`; // [V7.2] 改為藍色

        row.innerHTML = `
            <td>${emp.id}</td>
            <td>${emp.employee_name}</td>
            <td>${emp.employee_code}</td>
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

/**
 * [V7] 顯示員工 Modal
 */
function showEmployeeModal(employee = null) {
    employeeFormErrorMessage.textContent = ''; 
    employeeForm.reset(); 
    if (employee) {
        employeeModalTitle.textContent = '編輯員工';
        document.getElementById('employee-id').value = employee.id;
        document.getElementById('employee-name').value = employee.employee_name;
        document.getElementById('employee-code').value = employee.employee_code;
        document.getElementById('employee-is-active').checked = employee.is_active;
    } else {
        employeeModalTitle.textContent = '新增員工';
        document.getElementById('employee-id').value = '';
        document.getElementById('employee-is-active').checked = true;
    }
    employeeModal.classList.add('active');
}

/**
 * [V7] 隱藏員工 Modal
 */
function hideEmployeeModal() {
    employeeModal.classList.remove('active');
    employeeForm.reset();
}

/**
 * [V7] 處理員工表單提交 (新增/更新)
 */
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
        await loadEmployees();
    } catch (err) {
        console.error("儲存員工時發生錯誤:", err);
        employeeFormErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}

/**
 * [V7] 處理員工啟用/停用 (安全停用)
 */
async function handleToggleEmployeeActive(id, newActiveState) {
    const actionText = newActiveState ? '啟用' : '停用';
    if (!confirm(`您確定要 ${actionText} ID 為 ${id} 的員工嗎？\n(這將影響他們能否登入前台)`)) {
        return;
    }
    try {
        const { error } = await db.from('employees').update({ is_active: newActiveState }).eq('id', id);
        if (error) {
            if (error.code === '23503') { 
                alert(`${actionText} 失敗：此員工可能仍被歷史訂單關聯中。`);
            } else {
                throw error;
            }
        } else {
            console.log(`員工 ${id} ${actionText} 成功`);
            await loadEmployees(); 
        }
    } catch (err) {
        console.error(`員工 ${actionText} 時發生錯誤:`, err);
        alert(`${actionText} 失敗: ${err.message}`);
    }
}

/**
 * [V7.2 新增] 處理員工刪除 (安全刪除)
 */
async function handleEmployeeDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的員工嗎？\n\n警告：此操作無法復原。\n如果該員工已有訂單紀錄，請改用「停用」功能。`)) {
        return;
    }
    try {
        const { error } = await db
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) {
            // 檢查是否為 外鍵約束(Foreign Key) 錯誤
            if (error.code === '23503') { 
                alert(`刪除失敗：該員工已有歷史訂單紀錄，無法永久刪除。\n\n提示：請使用「停用」功能來取代。`);
            } else {
                throw error;
            }
        } else {
            // 刪除成功
            console.log(`員工 ${id} 刪除成功`);
            await loadEmployees(); 
        }
    } catch (err) {
        console.error("刪除員工時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}

/**
 * [V7.2] 員工表格點擊事件 (新增刪除監聽)
 */
async function handleEmployeeTableClick(e) {
    const target = e.target.closest('button'); 
    if (!target) return; 
    const id = target.dataset.id;
    if (!id) return; 

    // 點擊了 '編輯'
    if (target.classList.contains('edit-employee-btn')) {
        const { data, error } = await db.from('employees').select('*').eq('id', id).single();
        if (error) { alert(`查詢員工資料失敗: ${error.message}`); return; }
        showEmployeeModal(data); 
    }
    // 點擊了 '停用'
    if (target.classList.contains('deactivate-employee-btn')) {
        await handleToggleEmployeeActive(id, false); 
    }
    // 點擊了 '啟用'
    if (target.classList.contains('activate-employee-btn')) {
        await handleToggleEmployeeActive(id, true); 
    }
    // [V7.2 新增] 點擊了 '刪除'
    if (target.classList.contains('delete-employee-btn')) {
        await handleEmployeeDelete(id);
    }
}


// -----------------------------------------------------------
//  區塊 5: 事件監聽器 (V7 重構)
// -----------------------------------------------------------

// [V7] 導航分頁切換邏輯
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.dataset.target;
            
            if (!targetId || targetId === 'reports-section' || targetId === 'orders-section') {
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
            }
        });
    });
}

// 頁面載入完成後
document.addEventListener('DOMContentLoaded', () => {
    // 1. 設置分頁導航
    setupNavigation();
    
    // 2. 預設載入第一個分頁 (商品管理)
    loadProducts();

    // 3. 返回前台按鈕
    backToPosBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // 4. 商品 Modal 控制
    addProductBtn.addEventListener('click', () => showProductModal(null));
    productModal.querySelector('.close-btn').addEventListener('click', hideProductModal);
    productModal.querySelector('.cancel-btn').addEventListener('click', hideProductModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) hideProductModal();
    });

    // 5. 商品表單提交
    productForm.addEventListener('submit', handleProductFormSubmit);

    // 6. 商品表格點擊 (編輯/刪除/排序)
    productTableBody.addEventListener('click', handleProductTableClick);

    // 7. [V7] 員工 Modal 控制
    addEmployeeBtn.addEventListener('click', () => showEmployeeModal(null));
    employeeModal.querySelector('.close-btn').addEventListener('click', hideEmployeeModal);
    employeeModal.querySelector('.cancel-btn').addEventListener('click', hideEmployeeModal);
    employeeModal.addEventListener('click', (e) => {
        if (e.target === employeeModal) hideEmployeeModal();
    });

    // 8. [V7] 員工表單提交
    employeeForm.addEventListener('submit', handleEmployeeFormSubmit);

    // 9. [V7.2] 員工表格點擊 (編輯/啟用/停用/刪除)
    employeeTableBody.addEventListener('click', handleEmployeeTableClick);
});