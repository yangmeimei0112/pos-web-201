/* ====================================================================
   POS 系統核心 JS 邏輯 - script.js (V13.2 - 焦點修復版)
   - [修復] 解決 showCheckoutModal 的 focus 競爭條件 (Race Condition)
   - [保留] V13.1 的統一 Enter 鍵監聽器
   - [保留] V12 的手動輸入數量功能
   ==================================================================== */

// ====================================================================
// 1. Supabase 連線設定
// ====================================================================
const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";

let supabase;
if (window.supabase) {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase (前台) 初始化成功", supabase);
} else {
    console.error("❌ Supabase CDN 尚未載入。請檢查 index.html 是否正確引入。");
}


// ===============================================
// 2. 應用程式全域狀態
// ===============================================
let currentEmployee = null;
let allProducts = []; 
let activeCategory = 'ALL';
let orderItems = []; 


// ===============================================
// 3. DOM 元素
// ===============================================
// 員工模組
const employeeModal = document.getElementById('employee-selection-modal');
const employeeList = document.getElementById('employee-list');
const loadingMessage = document.getElementById('loading-message');
const currentEmployeeDisplay = document.getElementById('current-employee-display');
const posMainApp = document.getElementById('pos-main-app');
// 導航按鈕
const goToBackendBtn = document.getElementById('go-to-backend-btn');
const changeEmployeeBtn = document.getElementById('change-employee-btn');
// 時鐘 & 商品區
const currentTimeDisplay = document.getElementById('current-time');
const categoryTabs = document.getElementById('category-tabs');
const productList = document.getElementById('product-list');
const productLoadingMessage = document.getElementById('product-loading-message');
// 訂單區
const orderItemsTableBody = document.getElementById('order-items-table-body');
const orderItemsContainer = document.getElementById('order-items-list-container');
const clearOrderBtn = document.getElementById('clear-order-btn');
// 結帳區
const checkoutBtn = document.getElementById('checkout-btn');
const orderItemCount = document.getElementById('order-item-count');
const orderSubtotal = document.getElementById('order-subtotal');
const orderDiscount = document.getElementById('order-discount');
const orderFinalTotal = document.getElementById('order-final-total');
// 結帳 Modal
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
const summaryTotalAmount = document.getElementById('summary-total-amount');
const paidAmountInput = document.getElementById('paid-amount');
const summaryChangeAmount = document.getElementById('summary-change-amount');
const finalConfirmBtn = document.getElementById('final-confirm-btn');
const checkoutErrorMessage = document.getElementById('checkout-error-message');


// ===============================================
// 4. 通用工具函數
// ===============================================
const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        return 'NT$ ---';
    }
    return `NT$ ${Math.max(0, numAmount).toFixed(0)}`;
};

// ===============================================
// 5. 員工與時鐘函數
// ===============================================
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateString = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = `${dateString} ${timeString}`;
    }
}

function selectEmployee(id, name) {
    currentEmployee = { id, name };
    if (currentEmployeeDisplay) {
        currentEmployeeDisplay.innerHTML = `<i class="fas fa-id-card-alt"></i> ${name} 值班中`;
    }
    if (employeeModal) {
        employeeModal.classList.remove('active');
    }
    if (posMainApp) {
        posMainApp.classList.remove('hidden');
    }
    console.log(`✅ 員工 ${name} (ID: ${id}) 開始值班。`);
    if (!allProducts || allProducts.length === 0) {
        loadProducts();
    }
}

async function loadEmployees() {
    if (typeof supabase === 'undefined' || !employeeList) {
        console.error("錯誤: Supabase 或員工列表元素未準備好。");
        if(loadingMessage) loadingMessage.textContent = '初始化錯誤';
        return;
    }

    if(loadingMessage) loadingMessage.classList.remove('hidden');
    employeeList.innerHTML = '';

    try {
        const { data: employees, error } = await supabase
            .from('employees')
            .select('id, employee_name, employee_code')
            .eq('is_active', true) 
            .order('employee_name', { ascending: true });

        if(loadingMessage) loadingMessage.classList.add('hidden');
        if (error) throw error; 

        if (!employees || employees.length === 0) {
            employeeList.innerHTML = `<p>找不到可用的員工資料。</p>`;
            return;
        }

        employees.forEach(employee => {
            const button = document.createElement('button');
            button.classList.add('employee-button');
            button.dataset.id = employee.id;
            button.dataset.name = employee.employee_name;
            button.innerHTML = `
                ${employee.employee_name}
                <br>
                <span style="font-size:0.8em; opacity: 0.8;">(${employee.employee_code})</span>
            `;
            button.addEventListener('click', () => selectEmployee(employee.id, employee.employee_name));
            employeeList.appendChild(button);
        });
    } catch (err) {
        console.error('載入員工時發生錯誤:', err);
        if(loadingMessage) loadingMessage.classList.add('hidden');
        if (err.message.includes("policy")) {
            employeeList.innerHTML = `<p style="color:red;">載入員工資料失敗！<br>請檢查 Supabase RLS 是否已開啟 SELECT 權限。</p>`;
        } else {
            employeeList.innerHTML = `<p style="color:red;">載入員工資料失敗！請檢查網路連線。</p>`;
        }
    }
}

const handleEmployeeSwitch = () => {
    if (!confirm("確定要切換員工或登出嗎？這將清空當前訂單。")) {
        return;
    }
    clearOrder(true);
    currentEmployee = null;
    if (currentEmployeeDisplay) {
        currentEmployeeDisplay.innerHTML = '<i class="fas fa-user-circle"></i> 請先選擇值班員工';
    }
    if (posMainApp) posMainApp.classList.add('hidden');
    if (employeeModal) employeeModal.classList.add('active');
    loadEmployees();
};

const handleBackendRedirect = () => {
    window.location.href = 'backend.html';
    console.log('🔗 跳轉至後台管理頁面...');
};


// ===============================================
// 6. 商品載入與渲染函數 (V4 排序修復版)
// ===============================================
async function loadProducts() {
    if (!productLoadingMessage || !productList) {
        console.error("商品載入區域 DOM 元素未找到。");
        return;
    }
    productLoadingMessage.style.display = 'block';
    productList.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, price, stock, category, is_active, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }) 
            .order('id', { ascending: true });

        productLoadingMessage.style.display = 'none';
        if (error) throw error;

        allProducts = data; 
        renderCategories(allProducts); 
        filterAndRenderProducts(activeCategory); 

    } catch (err) {
        console.error('載入商品時發生錯誤:', err);
        productLoadingMessage.style.display = 'none';
        productList.innerHTML = `<p style="color:red; text-align:center;">載入商品資料失敗！請檢查 RLS 權限。</p>`;
    }
}

function renderCategories(products) {
    if (!categoryTabs) return;
    const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];
    categoryTabs.innerHTML = '';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.classList.add('category-button');
        if (category === activeCategory) {
            button.classList.add('active');
        }
        button.textContent = category === 'ALL' ? '全部' : category;
        button.dataset.category = category;
        button.addEventListener('click', () => setActiveCategory(category));
        categoryTabs.appendChild(button);
    });
}

function setActiveCategory(category) {
    activeCategory = category;
    document.querySelectorAll('.category-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    filterAndRenderProducts(category);
}

function filterAndRenderProducts(category) {
    if (!productList) return;
    let filteredProducts = (category === 'ALL')
        ? allProducts
        : allProducts.filter(p => p.category === category);

    productList.innerHTML = '';

    if (filteredProducts.length === 0) {
        productList.innerHTML = `<p style="text-align:center; padding: 20px; color: #777;">此分類下沒有商品。</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const card = document.createElement('div');
        card.classList.add('product-card');
        if (isOutOfStock) {
            card.classList.add('out-of-stock');
        }
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p class="price">${formatCurrency(product.price)}</p>
            <p class="stock-status">
                ${isOutOfStock ? '<i class="fas fa-times-circle"></i> 缺貨' : `<i class="fas fa-check-circle"></i> 庫存: ${product.stock}`}
            </p>
        `;
        if (!isOutOfStock) {
            card.addEventListener('click', () => addItemToOrder(product));
        }
        productList.appendChild(card);
    });
}

// ===============================================
// 7. 訂單處理核心函數 - [V12 修改]
// ===============================================
function getProductStock(productId) {
    const product = allProducts.find(p => p.id === productId);
    return product ? product.stock : 0;
}

function addItemToOrder(product) {
    const existingItemIndex = orderItems.findIndex(item => item.product_id === product.id);
    const maxStock = getProductStock(product.id);

    if (existingItemIndex > -1) {
        const existingItem = orderItems[existingItemIndex];
        if (existingItem.quantity + 1 > maxStock) {
            alert(`商品「${product.name}」庫存不足！\n目前庫存: ${maxStock}，無法再新增。`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        if (1 > maxStock) {
            alert(`商品「${product.name}」庫存為 0，無法加入訂單。`);
            return;
        }
        orderItems.push({
            product_id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1,
        });
    }
    renderOrderItems();
    updateOrderTotals();
}

/**
 * [V11] 增加訂單項目數量
 */
function increaseItemQuantity(index) {
    const item = orderItems[index];
    if (!item) return;
    const maxStock = getProductStock(item.product_id);

    if (item.quantity + 1 > maxStock) {
        alert(`商品「${item.name}」庫存不足！\n目前庫存: ${maxStock}，無法再增加。`);
        return;
    }
    item.quantity += 1;
    renderOrderItems();
    updateOrderTotals();
}

/**
 * [V11] 減少訂單項目數量
 */
function decreaseItemQuantity(index) {
    const item = orderItems[index];
    if (!item) return;

    if (item.quantity > 1) {
        item.quantity -= 1;
        renderOrderItems();
        updateOrderTotals();
    } else {
        if (confirm(`確定要將「${item.name}」從訂單中移除嗎？`)) {
            removeItem(index);
        } else {
            renderOrderItems();
        }
    }
}

/**
 * [V12] 處理手動輸入數量
 */
function handleQuantityChange(index, newQuantityStr) {
    const item = orderItems[index];
    if (!item) return;

    let newQuantity = parseInt(newQuantityStr, 10);
    const maxStock = getProductStock(item.product_id);

    if (isNaN(newQuantity) || newQuantity < 1) {
        if (confirm(`數量無效。您是否要將「${item.name}」從訂單中移除？`)) {
            removeItem(index); 
        } else {
            renderOrderItems(); 
        }
        return;
    }

    if (newQuantity > maxStock) {
        alert(`庫存不足！「${item.name}」僅剩 ${maxStock} 件。`);
        newQuantity = maxStock; // 自動修正為最大庫存
    }

    item.quantity = newQuantity;
    renderOrderItems(); // 重新渲染以更新 +/- 按鈕狀態和總價
    updateOrderTotals();
}


/**
 * 移除訂單項目
 */
function removeItem(index) {
    if (index >= 0 && index < orderItems.length) {
        orderItems.splice(index, 1);
        renderOrderItems();
        updateOrderTotals();
    } else {
        console.error("嘗試移除無效的訂單項目索引:", index);
    }
}

/**
 * [V12 修改] 訂單明細渲染 (加入 <input> 框)
 */
function renderOrderItems() {
    if (!orderItemsTableBody) return;
    orderItemsTableBody.innerHTML = ''; 

    if (orderItems.length === 0) {
        orderItemsContainer.classList.remove('has-items');
        orderItemsTableBody.innerHTML = `<tr><td colspan="5" class="empty-order-message">尚未加入商品</td></tr>`;
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    orderItemsContainer.classList.add('has-items');
    if (checkoutBtn) checkoutBtn.disabled = false;

    orderItems.forEach((item, index) => {
        const total = item.price * item.quantity;
        const maxStock = getProductStock(item.product_id); 
        const row = document.createElement('tr');
        row.className = 'order-item-row';
        row.dataset.index = index; 

        row.innerHTML = `
            <td class="item-name">${item.name}</td>
            <td class="item-price">${formatCurrency(item.price)}</td>
            <td class="item-quantity">
                <div class="item-quantity-control">
                    <button class="quantity-btn decrease-btn" data-index="${index}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                    <input type="number" class="quantity-input" data-index="${index}" value="${item.quantity}" min="1" max="${maxStock}">
                    <button class="quantity-btn increase-btn" data-index="${index}" ${item.quantity >= maxStock ? 'disabled' : ''}>+</button>
                </div>
            </td>
            <td class="item-total">${formatCurrency(total)}</td>
            <td class="item-remove">
                 <button class="remove-item-btn" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;

        orderItemsTableBody.appendChild(row);
    });
}

function updateOrderTotals() {
    let subtotal = 0;
    let totalItems = 0;
    orderItems.forEach(item => {
        subtotal += item.price * item.quantity;
        totalItems += item.quantity;
    });

    const discount = 0; 
    const finalTotal = subtotal - discount;

    if (orderItemCount) orderItemCount.textContent = totalItems;
    if (orderSubtotal) orderSubtotal.textContent = formatCurrency(subtotal);
    if (orderDiscount) orderDiscount.textContent = formatCurrency(discount); 
    if (orderFinalTotal) orderFinalTotal.innerHTML = `<strong>${formatCurrency(finalTotal)}</strong>`;

    if (checkoutBtn) {
        checkoutBtn.textContent = `結帳 (${formatCurrency(finalTotal)})`;
        checkoutBtn.dataset.total = finalTotal.toFixed(0); 
        checkoutBtn.disabled = orderItems.length === 0;
    }
}

function clearOrder(force = false) {
    if (!force && orderItems.length > 0) {
        if (!confirm('確定要清空整筆訂單嗎？')) {
            return;
        }
    }
    orderItems = [];
    renderOrderItems();
    updateOrderTotals();
    console.log('🗑️ 訂單已清空');
}


// ===============================================
// 8. 結帳邏輯 - [V13.2 修改]
// ===============================================
function showCheckoutModal() {
    if (orderItems.length === 0) return;
    const totalAmount = parseFloat(checkoutBtn.dataset.total || 0);
    if (isNaN(totalAmount)) return;

    summaryTotalAmount.textContent = formatCurrency(totalAmount);
    paidAmountInput.value = totalAmount.toFixed(0);
    summaryChangeAmount.textContent = formatCurrency(0);
    checkoutErrorMessage.textContent = '';
    checkoutErrorMessage.classList.add('hidden');
    finalConfirmBtn.disabled = false;
    finalConfirmBtn.textContent = '確認結帳並入帳'; 

    checkoutModal.classList.add('active');

    // [V13.2 修復] 
    // 加入 100 毫秒延遲，確保 CSS 轉場動畫完成，
    // 這樣 .focus() 才能 100% 成功。
    setTimeout(() => {
        paidAmountInput.focus(); 
        paidAmountInput.select(); 
    }, 100); // 100 毫秒的延遲

    handlePaymentInput(); 
}

function handlePaymentInput() {
    const totalAmount = parseFloat(checkoutBtn.dataset.total || 0);
    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    const change = paidAmount - totalAmount;

    summaryChangeAmount.textContent = formatCurrency(change);

    if (paidAmount < totalAmount || isNaN(paidAmount)) {
        checkoutErrorMessage.textContent = '支付金額不足！';
        checkoutErrorMessage.classList.remove('hidden');
        finalConfirmBtn.disabled = true;
    } else {
        checkoutErrorMessage.classList.add('hidden');
        finalConfirmBtn.disabled = false;
    }
}

async function processCheckout() {
    if (!currentEmployee) {
        alert('錯誤：未選擇值班員工！');
        return;
    }
    if (finalConfirmBtn.disabled) return; 

    finalConfirmBtn.disabled = true;
    finalConfirmBtn.textContent = '處理中...';

    // 結帳前強制刷新庫存
    await loadProducts(); 
    
    let inventoryError = false;
    for (const item of orderItems) {
        const currentStock = getProductStock(item.product_id); 
        if (item.quantity > currentStock) {
            alert(`結帳失敗：商品「${item.name}」庫存不足 (僅剩 ${currentStock})！\n請返回修改訂單。`);
            inventoryError = true;
            break; 
        }
    }

    if (inventoryError) {
        finalConfirmBtn.disabled = false;
        finalConfirmBtn.textContent = '確認結帳並入帳';
        checkoutModal.classList.remove('active'); 
        renderOrderItems(); 
        return; 
    }

    // --- 庫存檢查通過，繼續結帳 ---

    const totalAmount = parseFloat(checkoutBtn.dataset.total);
    const employeeId = currentEmployee.id;
    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    const changeAmount = Math.max(0, paidAmount - totalAmount);
    const transactionTime = new Date().toISOString();

    try {
        // 1. 寫入 orders
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert([{
                employee_id: employeeId,
                total_amount: totalAmount,
                discount_amount: 0, 
                status: 'Completed',
                paid_amount: paidAmount,
                change_amount: changeAmount,
                sales_date: transactionTime
            }])
            .select('id') 
            .single(); 

        if (orderError) throw new Error(`寫入訂單主表失敗: ${orderError.message}`);
        const orderId = orderData.id;
        console.log(`訂單 ${orderId} 寫入成功。`);

        // 2. 寫入 order_items
        const itemsPayload = orderItems.map(item => ({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_sale: item.price,
            subtotal: item.price * item.quantity,
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsError) throw new Error(`寫入訂單明細失敗: ${itemsError.message}`);
        console.log('訂單明細寫入成功。');

        // 3. 扣減庫存
        const updatePromises = orderItems.map(item => {
            const newStock = getProductStock(item.product_id) - item.quantity;
            return supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.product_id);
        });

        const results = await Promise.allSettled(updatePromises);
        const stockErrors = results.filter(res => res.status === 'rejected');
        if (stockErrors.length > 0) {
            console.error('部分庫存更新失敗:', stockErrors.map(e => e.reason));
        } else {
            console.log('庫存扣減成功。');
        }

        // 4. 交易完成
        alert(`結帳成功！訂單號碼: ${orderId}\n應收金額: ${formatCurrency(totalAmount)}\n實收金額: ${formatCurrency(paidAmount)}\n找零金額: ${formatCurrency(changeAmount)}`);
        checkoutModal.classList.remove('active');
        clearOrder(true); 
        await loadProducts(); 

    } catch (err) {
        console.error('結帳過程中發生錯誤:', err);
        alert(`結帳失敗：${err.message}\n請稍後再試或聯繫管理員。`);
    } finally {
        finalConfirmBtn.disabled = false;
        finalConfirmBtn.textContent = '確認結帳並入帳';
    }
}


// ===============================================
// 9. 應用程式啟動與事件監聽 - [V13.2 修改]
// ===============================================

function initializeEmployeeModule() {
    loadEmployees();
    if (employeeModal) {
        window.requestAnimationFrame(() => {
            employeeModal.classList.add('active');
        });
    }
}

function initializeApp() {
    updateClock();
    setInterval(updateClock, 1000);

    if (!currentEmployee) {
        initializeEmployeeModule();
    } else {
        loadProducts();
        if (posMainApp) posMainApp.classList.remove('hidden');
    }

    // --- 事件綁定 ---
    if (goToBackendBtn) goToBackendBtn.onclick = handleBackendRedirect;
    if (changeEmployeeBtn) changeEmployeeBtn.onclick = handleEmployeeSwitch;
    if (clearOrderBtn) clearOrderBtn.addEventListener('click', () => clearOrder());

    // 結帳 Modal (按鈕點擊)
    if (checkoutBtn) checkoutBtn.addEventListener('click', showCheckoutModal);
    if (closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', () => checkoutModal.classList.remove('active'));
    if (paidAmountInput) paidAmountInput.addEventListener('input', handlePaymentInput);
    if (finalConfirmBtn) finalConfirmBtn.addEventListener('click', processCheckout);
    
    // [V12] 訂單明細表格的事件委派
    if (orderItemsTableBody) {
        // 處理 +/- 和移除按鈕 (click)
        orderItemsTableBody.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button'); 
            if (!button) return; 

            const index = parseInt(button.dataset.index, 10);
            if (isNaN(index)) return;

            if (button.classList.contains('increase-btn')) {
                increaseItemQuantity(index);
            } else if (button.classList.contains('decrease-btn')) {
                if (button.disabled) return;
                if (orderItems[index]?.quantity > 0) {
                   decreaseItemQuantity(index);
                }
            } else if (button.classList.contains('remove-item-btn')) {
                const removeButton = target.closest('.remove-item-btn');
                if (removeButton) {
                    const removeIndex = parseInt(removeButton.dataset.index, 10);
                    if (!isNaN(removeIndex)) {
                        removeItem(removeIndex);
                    }
                }
            }
        });

        // [V12] 處理手動輸入 (change)
        orderItemsTableBody.addEventListener('change', (e) => {
            const target = e.target;
            if (target.classList.contains('quantity-input')) {
                const index = parseInt(target.dataset.index, 10);
                if (!isNaN(index)) {
                    handleQuantityChange(index, target.value);
                }
            }
        });
    }

    // [V13.1] 統一的 Enter 鍵監聽器 (使用 keydown)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; // 只處理 Enter 鍵

        const isCheckoutModalActive = checkoutModal && checkoutModal.classList.contains('active');
        const isEmployeeModalActive = employeeModal && employeeModal.classList.contains('active');
        const targetTagName = e.target.tagName.toLowerCase();

        // 情況 1: 正在結帳 Modal 中
        if (isCheckoutModalActive) {
            // [V13.1] 只有當焦點在付款輸入框時，才觸發結帳
            if (e.target === paidAmountInput) {
                if (!finalConfirmBtn.disabled) {
                    e.preventDefault();
                    console.log('⚡ 觸發 Modal Enter 結帳');
                    processCheckout();
                }
            }
            return; 
        }

        // 情況 2: 正在員工 Modal 中
        if (isEmployeeModalActive) {
            return;
        }

        // 情況 3: 正在輸入框中 (例如訂單數量框)
        if (targetTagName === 'input') {
            e.target.blur(); // 觸發失焦，進而觸發 change 事件
            return;
        }

        // 情況 4: 在主畫面，且訂單不為空
        if (orderItems.length > 0) {
            e.preventDefault(); 
            console.log('⚡ 觸發 Global Enter 開啟結帳');
            showCheckoutModal();
        }
    });

    // 初始渲染
    renderOrderItems();
    updateOrderTotals();

    console.log('🚀 POS 系統腳本 (V13.2) 已啟動。');
}

// 確保 DOM 完全載入後再執行初始化
document.addEventListener('DOMContentLoaded', initializeApp);