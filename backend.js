/* ====================================================================
   後台管理 (Backend) 邏輯 (V6 - RPC 排序修復版)
   - 解決 V5 的 "violates not-null constraint" 錯誤
   - 改用專屬的 SQL 函數 (bulk_update_sort_order) 執行排序
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
const productTableBody = document.getElementById('product-list-tbody');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');
const closeBtn = productModal.querySelector('.close-btn');
const addProductBtn = document.getElementById('add-product-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formErrorMessage = document.getElementById('form-error-message');
const backToPosBtn = document.getElementById('back-to-pos-btn');

let currentProductList = [];

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
            .select('*') 
            .order('sort_order', { ascending: true }) 
            .order('id', { ascending: true }); 

        if (error) {
            throw error;
        }

        currentProductList = JSON.parse(JSON.stringify(data));
        
        renderProductTable(data); 

    } catch (err) {
        console.error("載入商品時發生錯誤:", err);
        productTableBody.innerHTML = `<tr><td colspan="10" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}

/**
 * 將商品資料渲染成 HTML 表格 (V5/V6 版)
 * (此函數未變動)
 */
function renderProductTable(products) {
    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="10" class="loading-message">目前沒有任何商品。</td></tr>';
        return;
    }

    productTableBody.innerHTML = ''; 

    products.forEach((product, index) => {
        const row = document.createElement('tr');

        const statusText = product.is_active 
            ? '<span class="status-active">✔ 上架中</span>' 
            : '<span class="status-inactive">✘ 已下架</span>';

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

/**
 * 顯示彈出視窗 (Modal)
 * (此函數未變動)
 */
function showModal(product = null) {
    formErrorMessage.textContent = ''; 
    productForm.reset(); 

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
        document.getElementById('product-is-active').checked = product.is_active;
    } else {
        // 新增模式
        modalTitle.textContent = '新增商品';
        document.getElementById('product-id').value = '';
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
 * (此函數未變動)
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

    productData.is_active = document.getElementById('product-is-active').checked;
    
    productData.price = parseFloat(productData.price);
    productData.cost = parseFloat(productData.cost) || 0;
    productData.stock = parseInt(productData.stock, 10);
    productData.warning_threshold = parseInt(productData.warning_threshold, 10) || 0;
    
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
            
            const newSortOrder = (currentProductList.length + 1) * 10;
            productData.sort_order = newSortOrder;

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
 * 處理刪除按鈕點擊 (安全刪除)
 * (此函數未變動)
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


/**
 * [V6 重寫] 處理排序交換
 * @param {string} productId - 被點擊的商品 ID
 * @param {'up' | 'down'} direction - 交換方向
 */
async function handleSortSwap(productId, direction) {
    // 1. 找到點擊的商品及其在列表中的索引
    const productIndex = currentProductList.findIndex(p => p.id == productId);
    if (productIndex === -1) {
        console.error("在 local list 找不到商品");
        return;
    }

    // 2. 決定新索引
    const newIndex = (direction === 'up') ? productIndex - 1 : productIndex + 1;
    if (newIndex < 0 || newIndex >= currentProductList.length) {
        return; // 超出邊界
    }

    // 3. [Optimistic UI] 在本地陣列 (currentProductList) 中交換位置
    const [item] = currentProductList.splice(productIndex, 1);
    currentProductList.splice(newIndex, 0, item);

    // 4. [Optimistic UI] 立即重新渲染表格，UI會立即更新
    renderProductTable(currentProductList);
    
    // 5. [DB Update] 禁用所有按鈕
    document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = true);

    try {
        // 6. [DB Update] 產生一個包含所有商品新順序的 payload
        const updatePayload = currentProductList.map((product, index) => ({
            id: product.id,
            sort_order: index * 10 
        }));

        // 7. [V6 修復] 呼叫我們在 Supabase 建立的 RPC 函數，
        // 而不是使用不穩定的 .upsert()
        const { error } = await db.rpc('bulk_update_sort_order', {
            updates: updatePayload 
        });

        if (error) {
            // [V6 修復] 這裡的 error 是 RPC 函數的錯誤
            throw error;
        }

        console.log('排序更新成功！');

    } catch (err) {
        // [V6 修復] 捕捉 RPC 錯誤
        console.error("交換排序並呼叫 RPC 時發生錯誤:", err);
        // 將 Supabase RPC 錯誤訊息顯示給用戶
        alert(`排序更新失敗: ${err.message}。介面將重新整理至資料庫狀態。`);
        // 如果失敗，我們必須從資料庫重新載入，以撤銷我們的 Optimistic UI 變更
        await loadProducts();
    } finally {
        // 8. 重新啟用按鈕
        // (如果 loadProducts 失敗，按鈕可能仍是 disabled，
        //  但 loadProducts 成功會重新 render，所以是安全的)
        // 為了保險起見，我們在 renderProductTable 後手動啟用
        renderProductTable(currentProductList); // 確保按鈕狀態被刷新
        // [V6.1] 再次啟用按鈕
        document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = false);

        // [V5.1 優化] 我們不再需要重新 loadProducts()，
        // 因為 optimistic UI 已經是最新狀態
        // await loadProducts(); 
    }
}


/**
 * 處理表格區域的點擊事件 (事件委派)
 * (此函數未變動)
 */
async function handleTableClick(e) {
    const target = e.target.closest('button'); 
    if (!target) return; 

    const id = target.dataset.id;
    if (!id) return; 

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
        
        showModal(data); 
    }

    // 點擊了 '刪除'
    if (target.classList.contains('delete-btn')) {
        await handleDelete(id);
    }

    // 點擊了 '上移'
    if (target.classList.contains('sort-up-btn')) {
        await handleSortSwap(id, 'up');
    }

    // D點擊了 '下移'
    if (target.classList.contains('sort-down-btn')) {
        await handleSortSwap(id, 'down');
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

// 表格點擊 (編輯/刪除/排序)
productTableBody.addEventListener('click', handleTableClick);