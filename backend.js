/* ====================================================================
   後台管理 (Backend) 邏輯 (V3 - 融合版)
   - 同時支援「上下架」(is_active) 和「安全刪除」(handleDelete)
   ==================================================================== */

// -----------------------------------------------------------
//  區塊 1: Supabase 初始化
// -----------------------------------------------------------

// 來自 .env 檔案: SUPABASE_URL="https://ojqstguuubieqgcufwwg.supabase.co"
// 來自 .env 檔案: SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c"

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
const productTableBody = document.getElementById('product-list-tbody');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');
const closeBtn = productModal.querySelector('.close-btn');
const addProductBtn = document.getElementById('add-product-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formErrorMessage = document.getElementById('form-error-message');
const backToPosBtn = document.getElementById('back-to-pos-btn');

// -----------------------------------------------------------
//  區塊 3: 核心功能 (CRUD)
// -----------------------------------------------------------

/**
 * 載入所有商品並渲染到表格
 */
async function loadProducts() {
    productTableBody.innerHTML = '<tr><td colspan="10" class="loading-message">載入商品資料中...</td></tr>';

    try {
        const { data, error } = await db
            .from('products')
            .select('*') // 選擇所有欄位
            .order('sort_order', { ascending: true }) // 根據排序值排序
            .order('id', { ascending: true }); // 輔助排序

        if (error) {
            throw error;
        }

        renderProductTable(data);
    } catch (err) {
        console.error("載入商品時發生錯誤:", err);
        productTableBody.innerHTML = `<tr><td colspan="10" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}

/**
 * 將商品資料渲染成 HTML 表格
 * @param {Array} products - 商品資料陣列
 */
function renderProductTable(products) {
    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="10" class="loading-message">目前沒有任何商品。</td></tr>';
        return;
    }

    productTableBody.innerHTML = ''; // 清空現有內容

    products.forEach(product => {
        const row = document.createElement('tr');

        // [修改] 根據商品狀態 (is_active) 決定顯示的文字
        const statusText = product.is_active 
            ? '<span class="status-active">✔ 上架中</span>' 
            : '<span class="status-inactive">✘ 已下架</span>';

        // [修改] 保留「編輯」和「刪除」按鈕
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.price}</td>
            <td>${product.cost ?? 'N/A'}</td>
            <td>${product.stock}</td>
            <td>${product.warning_threshold ?? 'N/A'}</td>
            <td>${product.sort_order ?? 0}</td>
            <td>${statusText}</td> <td>
                <button class="btn-secondary edit-btn" data-id="${product.id}">編輯/上下架</button>
                <button class="btn-danger delete-btn" data-id="${product.id}">刪除</button>
            </td>
        `;
        productTableBody.appendChild(row);
    });
}

/**
 * 顯示彈出視窗 (Modal)
 * @param {Object | null} product - (可選) 傳入商品物件以進行編輯
 */
function showModal(product = null) {
    formErrorMessage.textContent = ''; // 清除錯誤訊息
    productForm.reset(); // 重設表單

    if (product) {
        // 編輯模式
        modalTitle.textContent = '編輯商品';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-cost').value = product.cost ?? 0;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-warning-threshold').value = product.warning_threshold ?? 10;
        document.getElementById('product-sort-order').value = product.sort_order ?? 0;
        // [保留] 載入該商品的上下架狀態
        document.getElementById('product-is-active').checked = product.is_active;
    } else {
        // 新增模式
        modalTitle.textContent = '新增商品';
        document.getElementById('product-id').value = '';
        // [保留] 新增時預設 "上架"
        document.getElementById('product-is-active').checked = true;
    }

    productModal.classList.add('active');
}

/**
 * 隱藏彈出視窗 (Modal)
 */
function hideModal() {
    productModal.classList.remove('active');
    productForm.reset();
}

/**
 * 處理表單提交 (新增或更新)
 * @param {Event} e - 提交事件
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    formErrorMessage.textContent = '';
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';

    const formData = new FormData(productForm);
    const productData = Object.fromEntries(formData.entries());
    const productId = productData.id;

    // [保留] 處理 Checkbox (上下架狀態)
    productData.is_active = document.getElementById('product-is-active').checked;
    
    // 轉換數值
    productData.price = parseFloat(productData.price);
    productData.cost = parseFloat(productData.cost) || 0;
    productData.stock = parseInt(productData.stock, 10);
    productData.warning_threshold = parseInt(productData.warning_threshold, 10) || 0;
    productData.sort_order = parseInt(productData.sort_order, 10) || 0;

    try {
        let response;
        if (productId) {
            // 更新 (Update)
            const { id, ...updateData } = productData;
            response = await db
                .from('products')
                .update(updateData)
                .eq('id', productId)
                .select();
        } else {
            // 新增 (Insert)
            delete productData.id;
            response = await db
                .from('products')
                .insert([productData])
                .select();
        }

        const { data, error } = response;
        if (error) { throw error; }

        console.log('儲存成功:', data);
        hideModal();
        await loadProducts(); // 重新載入表格

    } catch (err) {
        console.error("儲存商品時發生錯誤:", err);
        formErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}

/**
 * [修改] 處理刪除按鈕點擊 (安全刪除)
 * @param {String} id - 商品 ID
 */
async function handleDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的商品嗎？\n\n注意：此操作無法復原。\n如果只是暫時不賣，請使用「編輯/上下架」功能。`)) {
        return;
    }

    try {
        const { error } = await db
            .from('products')
            .delete()
            .eq('id', id);

        // [關鍵] 檢查錯誤
        if (error) {
            // 檢查是否為 外鍵約束(Foreign Key) 錯誤
            if (error.code === '23503') { 
                // 將技術錯誤翻譯成用戶提示
                alert(`刪除失敗：該商品已有銷售紀錄，無法永久刪除。\n\n提示：請使用「編輯/上下架」功能將其「下架」，即可在前台隱藏該商品。`);
            } else {
                // 拋出其他未知錯誤
                throw error;
            }
        } else {
             // 只有在 "error" 為 null (即刪除成功) 時才執行
            console.log(`商品 ${id} 刪除成功`);
            await loadProducts(); // 重新載入表格
        }

    } catch (err) {
        // 捕捉上面拋出的其他錯誤
        console.error("刪除商品時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}

/**
 * 處理表格區域的點擊事件 (事件委派)
 * [修改] 用於 '編輯' 和 '刪除' 按鈕
 */
async function handleTableClick(e) {
    const target = e.target;
    const id = target.dataset.id;

    if (!id) return; // 點擊的不是帶有 data-id 的按鈕

    // 點擊了 '編輯/上下架'
    if (target.classList.contains('edit-btn')) {
        const { data, error } = await db
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            alert(`查詢商品資料失敗: ${error.message}`);
            return;
        }
        
        showModal(data); // 載入資料並顯示 Modal (包含上下架狀態)
    }

    // [保留] 點擊了 '刪除'
    if (target.classList.contains('delete-btn')) {
        await handleDelete(id);
    }
}

// -----------------------------------------------------------
//  區塊 4: 事件監聽器
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', loadProducts);

backToPosBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Modal 控制
addProductBtn.addEventListener('click', () => showModal(null));
closeBtn.addEventListener('click', hideModal);
cancelBtn.addEventListener('click', hideModal);

productModal.addEventListener('click', (e) => {
    if (e.target === productModal) {
        hideModal();
    }
});

// 表單提交
productForm.addEventListener('submit', handleFormSubmit);

// 表格點擊 (編輯/刪除)
productTableBody.addEventListener('click', handleTableClick);