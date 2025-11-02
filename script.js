/* ====================================================================
   POS 系統核心 JS 邏輯 - script.js (V28.3 - 修正結帳庫存更新邏輯)
   - [修正] V28.2: processCheckout 函數中的庫存扣減邏輯
     (還原 V18.2 的 update 方式，移除不存在的 RPC 'decrement_stock')
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
let availableDiscounts = []; 
let currentDiscountId = 0; 
let currentDiscountAmount = 0; 
let heldOrders = []; // [V18] 儲存暫掛訂單
let currentHeldOrderName = null; // [V18] 標記當前是否為 "取回" 的訂單
let lowStockItems = []; // [V28.2] 新增: 低庫存商品


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
const orderDiscount = document.getElementById('order-discount'); // 這是 <dd> 標籤
const orderFinalTotal = document.getElementById('order-final-total');
// 結帳 Modal
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
const summaryTotalAmount = document.getElementById('summary-total-amount');
const paidAmountInput = document.getElementById('paid-amount');
const summaryChangeAmount = document.getElementById('summary-change-amount');
const finalConfirmBtn = document.getElementById('final-confirm-btn');
const checkoutErrorMessage = document.getElementById('checkout-error-message');
// [V18] 暫掛/取單 DOM
const holdOrderBtn = document.getElementById('hold-order-btn');
const retrieveOrderBtn = document.getElementById('retrieve-order-btn');
const heldOrderCount = document.getElementById('held-order-count');
const retrieveOrderModal = document.getElementById('retrieve-order-modal');
const closeRetrieveModalBtn = document.getElementById('close-retrieve-modal');
const heldOrderListContainer = document.getElementById('held-order-list-container');
// [V28.2] 庫存預警 DOM
const stockWarningBell = document.getElementById('stock-warning-bell');
const stockWarningDot = document.getElementById('stock-warning-dot');
const stockWarningModal = document.getElementById('stock-warning-modal');
const closeWarningModalBtn = document.getElementById('close-warning-modal'); 
const stockWarningTbody = document.getElementById('stock-warning-tbody');


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
// 5. 員工、折扣、時鐘函數 - [V17]
// ===============================================
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateString = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = `${dateString} ${timeString}`;
    }
}
async function loadDiscounts() {
    try {
        const { data, error } = await supabase
            .from('discounts')
            .select('id, name, amount')
            .eq('is_active', true) 
            .order('amount', { ascending: true }); 
        if (error) throw error;
        availableDiscounts = data || [];
        console.log('✅ 折扣載入成功:', availableDiscounts);
        updateOrderTotals();
    } catch (err) {
        console.error('載入折扣時發生錯誤:', err);
        availableDiscounts = [];
        updateOrderTotals();
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
    if (!availableDiscounts || availableDiscounts.length === 0) {
        loadDiscounts(); 
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
        currentEmployeeDisplay.innerHTML = '<i class="fas fa-user-circle"></i> 請先選擇值班人員';
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
// 6. [V28.2] 商品載入與渲染函數 (修改)
// ===============================================
async function loadProducts() {
    if (!productLoadingMessage || !productList) {
        console.error("商品載入區域 DOM 元素未找到。");
        return;
    }
    productLoadingMessage.style.display = 'block';
    productList.innerHTML = '';
    lowStockItems = []; // [V28.2] 重置低庫存列表
    
    try {
        const { data, error } = await supabase
            .from('products')
            // [V28.2] 新增 warning_threshold
            .select('id, name, price, stock, category, is_active, sort_order, warning_threshold')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }) 
            .order('id', { ascending: true });
            
        productLoadingMessage.style.display = 'none';
        if (error) throw error;
        
        allProducts = data; 
        
        // [V28.2] 檢查庫存預警
        allProducts.forEach(product => {
            if (product.warning_threshold !== null && product.warning_threshold >= 0) {
                if (product.stock <= product.warning_threshold) {
                    lowStockItems.push(product);
                }
            }
        });
        updateStockWarningBell(); // [V28.2] 更新鈴鐺狀態

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
// 7. 訂單處理核心函數 - [V18.2 修改]
// ===============================================
function getProductStock(productId) {
    const product = allProducts.find(p => p.id === productId);
    return product ? product.stock : 0;
}
function addItemToOrder(product) {
    // [V18.2] 移除 V18.1 的編輯鎖定
    const existingItemIndex = orderItems.findIndex(item => item.product_id === product.id && !item.note); 
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
            note: "" 
        });
    }
    renderOrderItems();
    updateOrderTotals();
}
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
function decreaseItemQuantity(index) {
    const item = orderItems[index];
    if (!item) return;
    if (item.quantity > 1) {
        item.quantity -= 1;
        renderOrderItems();
        updateOrderTotals();
    } else {
        if (confirm(`確定要將「${item.name}」${item.note ? `(備註: ${item.note})` : ''} 從訂單中移除嗎？`)) {
            removeItem(index);
        } else {
            renderOrderItems();
        }
    }
}
function handleQuantityChange(index, newQuantityStr) {
    const item = orderItems[index];
    if (!item) return;
    let newQuantity = parseInt(newQuantityStr, 10);
    const maxStock = getProductStock(item.product_id);
    if (isNaN(newQuantity) || newQuantity < 1) {
        if (confirm(`數量無效。您是否要將「${item.name}」${item.note ? `(備註: ${item.note})` : ''} 從訂單中移除？`)) {
            removeItem(index); 
        } else {
            renderOrderItems(); 
        }
        return;
    }
    if (newQuantity > maxStock) {
        alert(`庫存不足！「${item.name}」僅剩 ${maxStock} 件。`);
        newQuantity = maxStock; 
    }
    item.quantity = newQuantity;
    renderOrderItems(); 
    updateOrderTotals();
}
function handleEditNote(index) {
    const item = orderItems[index];
    if (!item) return;
    const currentNote = item.note || "";
    const newNote = prompt(`請輸入「${item.name}」的備註：`, currentNote);
    if (newNote !== null) {
        item.note = newNote.trim(); 
        console.log(`項目 ${index} 的備註更新為: ${item.note}`);
        renderOrderItems(); 
    }
}
function removeItem(index) {
    if (index >= 0 && index < orderItems.length) {
        orderItems.splice(index, 1);
        renderOrderItems();
        updateOrderTotals(); 
    } else {
        console.error("嘗試移除無效的訂單項目索引:", index);
    }
}
function renderOrderItems() {
    if (!orderItemsTableBody) return;
    orderItemsTableBody.innerHTML = ''; 
    if (orderItems.length === 0) {
        orderItemsTableBody.innerHTML = `<tr><td colspan="5" class="empty-order-message">尚未加入商品</td></tr>`;
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }
    if (checkoutBtn) checkoutBtn.disabled = false;
    orderItems.forEach((item, index) => {
        const total = item.price * item.quantity;
        const maxStock = getProductStock(item.product_id); 
        const row = document.createElement('tr');
        row.className = 'order-item-row';
        row.dataset.index = index; 
        let noteHtml;
        if (item.note) {
            noteHtml = `
                <span class="item-note-display" title="${item.note}">${item.note}</span>
                <button class="note-btn edit-note-btn" data-index="${index}"><i class="fas fa-pen"></i> 編輯備註</button>
            `;
        } else {
            noteHtml = `
                <button class="note-btn add-note-btn" data-index="${index}"><i class="fas fa-plus"></i> 新增備註</button>
            `;
        }
        row.innerHTML = `
            <td class="item-name">
                ${item.name}
                ${noteHtml} 
            </td>
            <td class="item-price">${formatCurrency(item.price)}</td>
            <td class="item-quantity">
                <div class="item-controls">
                    <button class="qty-btn decrease-btn" data-action="decrease" data-index="${index}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                    <input type="number" class="item-qty-input" data-action="set-quantity" data-index="${index}" value="${item.quantity}" min="1" max="${maxStock}">
                    <button class="qty-btn increase-btn" data-action="increase" data-index="${index}" ${item.quantity >= maxStock ? 'disabled' : ''}>+</button>
                </div>
            </td>
            <td class="item-total">${formatCurrency(total)}</td>
            <td class="item-remove">
                 <button class="remove-item-btn" data-action="remove" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
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

    if (currentDiscountAmount > subtotal && subtotal > 0) {
        console.warn("折扣金額大於小計，自動重設折扣。");
        currentDiscountId = 0;
        currentDiscountAmount = 0;
    }
    
    if (orderItemCount) orderItemCount.textContent = totalItems;
    if (orderSubtotal) orderSubtotal.textContent = formatCurrency(subtotal);
    
    renderDiscountDropdown(subtotal, false); 
    updateFinalTotalDisplay(subtotal);
}
function renderDiscountDropdown(subtotal, isDisabled = false) {
    if (orderDiscount) {
        const optionsHtml = availableDiscounts
            .filter(d => d.amount <= subtotal || d.amount === 0) 
            .map(d => `<option value="${d.id}_${d.amount}">${d.name} (-${formatCurrency(d.amount)})</option>`)
            .join('');
        
        const disabledAttr = (orderItems.length === 0 || isDisabled) ? 'disabled' : '';

        orderDiscount.innerHTML = `
            <select id="discount-select" class="discount-select" ${disabledAttr}>
                <option value="0_0">無折扣</option>
                ${optionsHtml}
            </select>
        `;
        const selectEl = document.getElementById('discount-select');
        if (selectEl) {
            selectEl.value = `${currentDiscountId}_${currentDiscountAmount}`;
        }
    }
}
function updateFinalTotalDisplay(subtotal) {
    if (subtotal === undefined) {
        subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }
    const finalTotal = subtotal - currentDiscountAmount; 
    if (orderFinalTotal) orderFinalTotal.textContent = formatCurrency(finalTotal);
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
    currentDiscountId = 0; 
    currentDiscountAmount = 0; 
    currentHeldOrderName = null; 
    
    renderOrderItems();
    updateOrderTotals(); 
    console.log('🗑️ 訂單已清空');
}


// ===============================================
// 8. [V28.3 修正] 結帳邏輯
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
    finalConfirmBtn.textContent = '確認結帳'; 
    checkoutModal.classList.add('active');
    setTimeout(() => {
        paidAmountInput.focus(); 
        paidAmountInput.select(); 
    }, 100); 
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

    // [V28.3] 修正: 結帳前 *必須* 重新載入一次商品，以獲取最新庫存
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
        finalConfirmBtn.textContent = '確認結帳';
        checkoutModal.classList.remove('active'); 
        renderOrderItems(); // 重新渲染訂單 (也許庫存已變)
        return; 
    }

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
                discount_amount: currentDiscountAmount, 
                discount_id: currentDiscountId > 0 ? currentDiscountId : null, 
                status: 'Completed',
                paid_amount: paidAmount,
                change_amount: changeAmount,
                sales_date: transactionTime
            }])
            .select('id') 
            .single(); 

        if (orderError) throw new Error(`寫入訂單主表失敗: ${orderError.message}`);
        const orderId = orderData.id;
        console.log(`訂單 ${orderId} 寫入成功 (含折扣)。`);

        // 2. 寫入 order_items
        const itemsPayload = orderItems.map(item => ({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_sale: item.price,
            subtotal: item.price * item.quantity,
            note: item.note 
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsError) throw new Error(`寫入訂單明細失敗: ${itemsError.message}`);
        console.log('訂單明細寫入成功 (含商品備註)。');

        // 3. [V28.3 修正] 扣減庫存 (還原 V18.2 的 update 邏輯)
        const updatePromises = orderItems.map(item => {
            // 讀取 'allProducts' (在函數開頭剛刷新) 的庫存
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
            // 即使更新失敗，也繼續完成結帳
        } else {
            console.log('庫存扣減成功。');
        }

        // 4. 交易完成
        alert(`結帳成功！訂單號碼: ${orderId}\n應收金額: ${formatCurrency(totalAmount)}\n實收金額: ${formatCurrency(paidAmount)}\n找零金額: ${formatCurrency(changeAmount)}`);
        checkoutModal.classList.remove('active');
        clearOrder(true); 
        
        // [V28.3] 再次載入商品，確保UI (鈴鐺 和 庫存數字) 顯示最新狀態
        await loadProducts(); 

    } catch (err) {
        console.error('結帳過程中發生錯誤:', err);
        alert(`結帳失敗：${err.message}\n請稍後再試或聯繫管理員。`);
    } finally {
        finalConfirmBtn.disabled = false;
        finalConfirmBtn.textContent = '確認結帳';
    }
}


// ===============================================
// [V18.2 修改] 區塊 9: 暫掛/取單功能
// ===============================================
const HELD_ORDERS_KEY = 'posHeldOrders';

// 從 LocalStorage 載入暫掛訂單
function loadHeldOrdersFromStorage() {
    const storedOrders = localStorage.getItem(HELD_ORDERS_KEY);
    heldOrders = storedOrders ? JSON.parse(storedOrders) : [];
    updateHeldOrderCount();
}

// 儲存暫掛訂單到 LocalStorage
function saveHeldOrders() {
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(heldOrders));
    updateHeldOrderCount();
}

// 更新 "取回訂單" 按鈕上的計數
function updateHeldOrderCount() {
    if (heldOrderCount) {
        if (heldOrders.length > 0) {
            heldOrderCount.textContent = heldOrders.length;
            heldOrderCount.classList.remove('hidden');
        } else {
            heldOrderCount.classList.add('hidden');
        }
    }
}

// 處理 "暫掛訂單" 按鈕
function handleHoldOrder() {
    if (orderItems.length === 0) {
        alert("目前訂單為空，無需暫掛。");
        return;
    }
    
    // [V18.2] 如果是取回的訂單，建議使用原名稱
    const defaultName = currentHeldOrderName || `訂單 ${heldOrders.length + 1}`;
    let holdName = prompt("請為這筆暫掛訂單命名:", defaultName);
    
    if (holdName) {
        holdName = holdName.trim();
        const newHold = {
            name: holdName,
            items: orderItems,
            discountId: currentDiscountId,
            discountAmount: currentDiscountAmount
        };
        heldOrders.push(newHold);
        saveHeldOrders();
        alert(`訂單 "${holdName}" 已暫掛！`);
        clearOrder(true); // 強制清空
    }
}

// 顯示 "取回訂單" Modal
function showRetrieveModal() {
    if (!heldOrderListContainer || !retrieveOrderModal) return;

    heldOrderListContainer.innerHTML = '';
    if (heldOrders.length === 0) {
        heldOrderListContainer.innerHTML = '<p class="empty-order-message">沒有暫掛中的訂單</p>';
    } else {
        heldOrders.forEach((order, index) => {
            const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
            const total = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0) - order.discountAmount;

            const itemEl = document.createElement('div');
            itemEl.className = 'held-order-item';
            itemEl.innerHTML = `
                <div>
                    <div class="held-order-name">${order.name}</div>
                    <div class="held-order-info">${itemCount} 個品項, 總計 ${formatCurrency(total)}</div>
                </div>
                <div class="held-order-actions">
                    <button class="btn-danger delete-held-btn" data-index="${index}" title="刪除此暫掛單">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="btn-primary retrieve-held-btn" data-index="${index}">
                        取回
                    </button>
                </div>
            `;
            heldOrderListContainer.appendChild(itemEl);
        });
    }
    
    retrieveOrderModal.classList.add('active');
}

// 隱藏 "取回訂單" Modal
function hideRetrieveModal() {
    if (retrieveOrderModal) retrieveOrderModal.classList.remove('active');
}

// 處理從 Modal 點擊 "取回" 或 "刪除"
function handleRetrieveModalClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const index = parseInt(target.dataset.index, 10);
    if (isNaN(index)) return;

    if (target.classList.contains('retrieve-held-btn')) {
        // --- [V18.1] 取回訂單 (並立即刪除) ---
        if (orderItems.length > 0) {
            if (!confirm("您目前有未結帳的訂單，取回訂單將會覆蓋它。確定要繼續嗎？")) {
                return;
            }
        }
        
        const retrievedOrder = heldOrders.splice(index, 1)[0]; 
        if (!retrievedOrder) return; 
        
        saveHeldOrders(); // [V18.1] 立即儲存 (更新 LocalStorage)

        // 載入訂單資料
        orderItems = retrievedOrder.items;
        currentDiscountId = retrievedOrder.discountId || 0;
        currentDiscountAmount = retrievedOrder.discountAmount || 0;
        currentHeldOrderName = retrievedOrder.name; // [V18.1] 標記這是一筆暫掛單 (用名稱)

        alert(`訂單 "${retrievedOrder.name}" 已取回並可編輯。\n(此暫掛單已從列表移除)`);

        renderOrderItems();
        updateOrderTotals(); // [V18.2] 這會重新啟用折扣選單
        hideRetrieveModal();

    } else if (target.classList.contains('delete-held-btn')) {
        // --- 刪除暫掛單 ---
        const orderName = heldOrders[index].name;
        if (confirm(`確定要永久刪除暫掛訂單 "${orderName}" 嗎？`)) {
            heldOrders.splice(index, 1);
            saveHeldOrders();
            showRetrieveModal(); // 重新整理 Modal 列表
        }
    }
}


// ===============================================
// [V28.2] 區塊 10: 庫存預警功能
// ===============================================
/**
 * [V28.2] 綁定鈴鐺和 Modal 事件
 */
function setupWarningBell() {
    if (stockWarningBell) {
        stockWarningBell.addEventListener('click', showStockWarningModal);
    }
    if (closeWarningModalBtn) { 
        closeWarningModalBtn.addEventListener('click', hideStockWarningModal);
    }
    if (stockWarningModal) {
        stockWarningModal.addEventListener('click', (e) => {
            if (e.target === stockWarningModal) {
                hideStockWarningModal();
            }
        });
    }
}

/**
 * [V28.2] 根據低庫存列表更新鈴鐺 (紅點)
 */
function updateStockWarningBell() {
    if (!stockWarningBell || !stockWarningDot) return;

    if (lowStockItems.length > 0) {
        stockWarningBell.classList.add('active');
        // console.log("低庫存商品:", lowStockItems.map(p => p.name));
    } else {
        stockWarningBell.classList.remove('active');
        // console.log("庫存充足。");
    }
}

/**
 * [V28.2] 顯示低庫存 Modal
 */
function showStockWarningModal() {
    if (!stockWarningTbody || !stockWarningModal) return;

    if (lowStockItems.length === 0) {
        alert("目前所有商品庫存充足！");
        return;
    }

    stockWarningTbody.innerHTML = ''; // 清空
    lowStockItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.stock}</td>
            <td>${item.warning_threshold}</td>
        `;
        stockWarningTbody.appendChild(row);
    });

    stockWarningModal.classList.add('active');
}

/**
 * [V28.2] 隱藏低庫存 Modal
 */
function hideStockWarningModal() {
    if (stockWarningModal) {
        stockWarningModal.classList.remove('active');
    }
}


// ===============================================
// 11. 應用程式啟動與事件監聽 (原 10) - [V28.2 修改]
// ===============================================

function initializeEmployeeModule() {
    loadEmployees();
    if (employeeModal) {
        const firstEmployeeModal = document.getElementById('employee-selection-modal');
        if (firstEmployeeModal) {
            window.requestAnimationFrame(() => {
                firstEmployeeModal.classList.add('active');
            });
        }
    }
}

function initializeApp() {
    updateClock();
    setInterval(updateClock, 1000);

    loadHeldOrdersFromStorage(); // [V18] 啟動時載入暫掛單
    setupWarningBell(); // [V28.2] 啟用鈴鐺

    if (!currentEmployee) {
        initializeEmployeeModule();
    } else {
        loadProducts(); // [V28.2] loadProducts 會自動載入折扣
        if (posMainApp) posMainApp.classList.remove('hidden');
    }

    // --- 事件綁定 ---
    if (goToBackendBtn) goToBackendBtn.onclick = handleBackendRedirect;
    if (changeEmployeeBtn) changeEmployeeBtn.onclick = handleEmployeeSwitch;
    if (clearOrderBtn) clearOrderBtn.addEventListener('click', () => clearOrder());

    // 結帳 Modal
    if (checkoutBtn) checkoutBtn.addEventListener('click', showCheckoutModal);
    if (closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', () => checkoutModal.classList.remove('active'));
    if (paidAmountInput) paidAmountInput.addEventListener('input', handlePaymentInput);
    if (finalConfirmBtn) finalConfirmBtn.addEventListener('click', processCheckout);
    
    // [V18.2] 訂單明細表格的事件委派
    if (orderItemsTableBody) {
        // (click) 處理 +/-/移除/備註
        orderItemsTableBody.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button'); 
            
            // [V28.2] 處理備註按鈕
            if (button && (button.classList.contains('add-note-btn') || button.classList.contains('edit-note-btn'))) {
                const index = parseInt(button.dataset.index, 10);
                if (!isNaN(index)) {
                    handleEditNote(index);
                }
                return; // 處理完畢
            }

            // [V28.2] 處理 +/-/移除 按鈕
            const actionButton = target.closest('[data-action]');
            if (actionButton) {
                const action = actionButton.dataset.action;
                const index = parseInt(actionButton.dataset.index, 10);
                if (isNaN(index)) return;

                if (action === 'increase') {
                    increaseItemQuantity(index);
                } else if (action === 'decrease') {
                    if (actionButton.disabled) return;
                    if (orderItems[index]?.quantity > 0) {
                       decreaseItemQuantity(index);
                    }
                } else if (action === 'remove') {
                    removeItem(index);
                }
            }
        });

        // (change) 處理手動輸入
        orderItemsTableBody.addEventListener('change', (e) => {
            const target = e.target;
            if (target.dataset.action === 'set-quantity') { // [V28.2] 修正: 監聽 data-action
                const index = parseInt(target.dataset.index, 10);
                if (!isNaN(index)) {
                    handleQuantityChange(index, target.value);
                }
            }
        });
    }

    // [V17] 折扣下拉選單
    const orderTotals = document.querySelector('.order-totals');
    if (orderTotals) {
        orderTotals.addEventListener('change', (e) => {
            // [V28.2] 適配 V18.2 的折扣 <dd> ID
            if (e.target.id === 'discount-select') {
                const selectedValue = e.target.value; 
                const [id, amount] = selectedValue.split('_').map(Number);
                const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                if (amount > subtotal) {
                    alert(`折扣金額 (NT$ ${amount}) 不能超過小計 (NT$ ${subtotal})。\n將自動取消折扣。`);
                    currentDiscountId = 0;
                    currentDiscountAmount = 0;
                    updateOrderTotals(); 
                } else {
                    currentDiscountId = id;
                    currentDiscountAmount = amount;
                    updateFinalTotalDisplay(subtotal); 
                }
                console.log(`折扣已選擇: ID=${currentDiscountId}, 金額=${currentDiscountAmount}`);
            }
        });
    }

    // [V13.1] Enter 鍵
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; 
        const isCheckoutModalActive = checkoutModal && checkoutModal.classList.contains('active');
        const isEmployeeModalActive = employeeModal && employeeModal.classList.contains('active');
        const isRetrieveModalActive = retrieveOrderModal && retrieveOrderModal.classList.contains('active'); 
        const isWarningModalActive = stockWarningModal && stockWarningModal.classList.contains('active'); // [V28.2]
        const targetTagName = e.target.tagName.toLowerCase();
        
        if (isCheckoutModalActive) {
            if (e.target === paidAmountInput) {
                if (!finalConfirmBtn.disabled) {
                    e.preventDefault();
                    console.log('⚡ 觸發 Modal Enter 結帳');
                    processCheckout();
                }
            }
            return; 
        }
        if (isEmployeeModalActive || isRetrieveModalActive || isWarningModalActive) { // [V28.2]
            return;
        }
        if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'select') {
            e.target.blur();
            return;
        }
        if (orderItems.length > 0) {
            e.preventDefault(); 
            console.log('⚡ 觸發 Global Enter 開啟結帳');
            showCheckoutModal();
        }
    });

    // [V18] 暫掛/取單按鈕
    if (holdOrderBtn) holdOrderBtn.addEventListener('click', handleHoldOrder);
    if (retrieveOrderBtn) retrieveOrderBtn.addEventListener('click', showRetrieveModal);
    if (closeRetrieveModalBtn) closeRetrieveModalBtn.addEventListener('click', hideRetrieveModal);
    if (heldOrderListContainer) heldOrderListContainer.addEventListener('click', handleRetrieveModalClick);
    
    // [V28.2] 庫存預警 Modal (事件綁定已移至 setupWarningBell)
    // (V28.2 註: V19.1 的 'warning-close-btn' 綁定已在 setupWarningBell 中完成)

    // 初始渲染
    renderOrderItems();
    updateOrderTotals(); 

    console.log('🚀 POS 系統腳本 (V18.2 + V28.2) 已啟動。');
}

// 確保 DOM 完全載入後再執行初始化
document.addEventListener('DOMContentLoaded', initializeApp);