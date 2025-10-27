/* ====================================================================
   POS 系統核心 JS 邏輯 - script.js (整合版: 員工 + 商品 + 訂單核心)
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
} else {
    console.error("❌ Supabase CDN 尚未載入。請檢查 index.html 是否正確引入。");
}


// ===============================================
// 2. 應用程式全域狀態
// ===============================================
let currentEmployee = null;
let allProducts = []; // 儲存所有商品資料，包含庫存 (stock)
let activeCategory = 'ALL';
let orderItems = []; // 當前訂單明細


// ===============================================
// 3. DOM 元素 (★★★ 修復此處變數，以匹配新的 HTML ID ★★★)
// ===============================================

// DOM - 員工模組 (employee.js 部分)
const employeeModal = document.getElementById('employee-selection-modal');
const employeeList = document.getElementById('employee-list');
const loadingMessage = document.getElementById('loading-message');
const currentEmployeeDisplay = document.getElementById('current-employee-display'); // 變數名修正為統一命名
const posMainApp = document.getElementById('pos-main-app');

// 【修復】DOM 變數名稱與 ID
const goToBackendBtn = document.getElementById('go-to-backend-btn');       // 後台管理按鈕 (ID: go-to-backend-btn)
const changeEmployeeBtn = document.getElementById('change-employee-btn'); // 切換員工按鈕 (ID: change-employee-btn)

// DOM - POS 模組 (pos.js / script.js 部分)
const currentTimeDisplay = document.getElementById('current-time');
const categoryTabs = document.getElementById('category-tabs');
const productList = document.getElementById('product-list'); // 商品網格容器
const productLoadingMessage = document.getElementById('product-loading-message');

const orderItemsTableBody = document.getElementById('order-items-table-body'); // 訂單明細表格
const orderItemsContainer = document.getElementById('order-items-list-container'); 
const clearOrderBtn = document.getElementById('clear-order-btn');

const checkoutBtn = document.getElementById('checkout-btn');
const orderItemCount = document.getElementById('order-item-count');
const orderSubtotal = document.getElementById('order-subtotal');
const orderDiscount = document.getElementById('order-discount');
const orderFinalTotal = document.getElementById('order-final-total');

// 結帳 Modal 元素
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
// 貨幣格式化 (已檢查：toFixed(0) 適合 NT$)
const formatCurrency = (amount) => `NT$ ${Math.max(0, amount).toFixed(0)}`;


// ===============================================
// 5. 員工與時鐘函數 (整合自 employee.js 和原 script.js)
// ===============================================
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    loadProducts(); 
}

async function loadEmployees() {
    if (typeof supabase === 'undefined' || !employeeList) {
        console.error("錯誤: Supabase 或員工網格元素未準備好。");
        return;
    }

    loadingMessage.classList.remove('hidden');
    employeeList.innerHTML = ''; 

    const { data: employees, error } = await supabase
        .from('employees')
        .select('id, employee_name, employee_code')
        .eq('is_active', true) 
        .order('employee_name', { ascending: true }); 

    loadingMessage.classList.add('hidden');

    if (error) {
        console.error('Error loading employees:', error);
        employeeList.innerHTML = `<p style="color:red;">載入員工資料失敗！請檢查 RLS 權限。</p>`;
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
}

// 【修復：切換員工按鈕的邏輯】
const handleEmployeeSwitch = () => {
    // 1. 確認操作
    if (!confirm("確定要切換員工或登出嗎？這將清空當前訂單。")) {
        return;
    }
    
    // 2. 執行清空與重置操作
    clearOrder(true); // 清空訂單
    currentEmployee = null;
    if (currentEmployeeDisplay) {
        currentEmployeeDisplay.innerHTML = '<i class="fas fa-user-circle"></i> 請先選擇值班員工';
    }
    
    // 3. 顯示員工選擇 Modal
    if (posMainApp) posMainApp.classList.add('hidden'); // 隱藏主 POS 介面
    if (employeeModal) employeeModal.classList.add('active'); // 顯示員工選擇 Modal
    loadEmployees(); // 重新載入以確保列表為最新
};

// 【新增：後台管理按鈕的邏輯】
const handleBackendRedirect = () => {
    // 假設您的後台頁面檔案名為 'backend.html'
    // 可以在這裡加入權限檢查邏輯，但為了快速修復，先直接跳轉
    window.location.href = 'backend.html'; 
    console.log('🔗 跳轉至後台管理頁面...');
};


// ===============================================
// 6. 商品載入與渲染函數
// ===============================================
async function loadProducts() {
    productLoadingMessage.style.display = 'block';
    productList.innerHTML = '';

    const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock, category, is_active') 
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    productLoadingMessage.style.display = 'none';

    if (error) {
        console.error('Error loading products:', error);
        productList.innerHTML = `<p style="color:red; text-align:center;">載入商品資料失敗！請檢查 RLS 政策或 API 連線。</p>`;
        return;
    }

    allProducts = data;
    renderCategories(allProducts);
    filterAndRenderProducts(activeCategory);
}

function renderCategories(products) {
    const categories = ['ALL', ...new Set(products.map(p => p.category).filter(c => c))];
    categoryTabs.innerHTML = ''; 

    categories.forEach(category => {
        const button = document.createElement('button');
        button.classList.add('category-button');
        if (category === activeCategory) {
            button.classList.add('active');
        }
        button.textContent = category === 'ALL' ? '全部' : category;
        button.dataset.category = category;
        
        button.addEventListener('click', () => {
            setActiveCategory(category);
        });
        categoryTabs.appendChild(button);
    });
}

function setActiveCategory(category) {
    activeCategory = category;
    
    document.querySelectorAll('.category-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    filterAndRenderProducts(category);
}

function filterAndRenderProducts(category) {
    let filteredProducts = allProducts;

    if (category !== 'ALL') {
        filteredProducts = allProducts.filter(p => p.category === category);
    }

    productList.innerHTML = ''; 

    if (filteredProducts.length === 0) {
        productList.innerHTML = `<p style="text-align:center;">此分類下沒有可售賣的商品。</p>`;
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
                ${isOutOfStock ? 
                    '<i class="fas fa-times-circle"></i> 缺貨' : 
                    `<i class="fas fa-check-circle"></i> 庫存: ${product.stock}`}
            </p>
        `;

        if (!isOutOfStock) {
            // 點擊事件：使用 addItemToOrder 
            card.addEventListener('click', () => addItemToOrder(product));
        }
        
        productList.appendChild(card);
    });
}

// ===============================================
// 7. 訂單處理核心函數 (移除步驟 9 冗餘函數)
// ===============================================
function getProductStock(productId) {
    const product = allProducts.find(p => p.id === productId);
    return product ? product.stock : 0;
}

// 新增項目到訂單
function addItemToOrder(product) {
    const existingItem = orderItems.find(item => item.product_id === product.id);
    const maxStock = getProductStock(product.id);

    if (existingItem) {
        if (existingItem.quantity + 1 > maxStock) {
            alert(`商品「${product.name}」庫存不足！\n目前庫存: ${maxStock}，無法再新增。`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        if (1 > maxStock) {
            alert(`商品「${product.name}」庫存為 ${maxStock}，無法加入訂單。`);
            return;
        }
        const newItem = {
            product_id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1,
        };
        orderItems.push(newItem);
    }

    renderOrderItems();
    updateOrderTotals();
}

/**
 * 移除訂單項目 (僅保留最簡單的陣列索引移除法，避免步驟 9 的複雜性)
 * @param {number} index - 訂單項目在 orderItems 陣列中的索引
 */
function removeItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
    updateOrderTotals();
}

// 【注意：原程式碼中的 changeItemQuantity 和 handleQuantityInput 函數已移除，
//          以避免未完成的步驟 9 邏輯錯誤。】


/**
 * 訂單明細改為橫式表格顯示 (修復：移除數量增減/輸入的事件綁定，僅保留移除按鈕功能)
 */
function renderOrderItems() {
    if (!orderItemsTableBody) return;
    orderItemsTableBody.innerHTML = '';
    
    if (orderItems.length === 0) {
        orderItemsContainer.classList.remove('has-items');
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="5" class="empty-order-message">尚未加入商品</td>`;
        orderItemsTableBody.appendChild(emptyRow);
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    orderItemsContainer.classList.add('has-items'); 
    if (checkoutBtn) checkoutBtn.disabled = false;

    orderItems.forEach((item, index) => {
        const total = item.price * item.quantity;
        
        const row = document.createElement('tr');
        row.className = 'order-item-row';
        
        row.innerHTML = `
            <td class="item-name">${item.name}</td>
            <td class="item-price">${formatCurrency(item.price)}</td>
            
                        <td class="item-quantity">
                <span style="font-weight: 700;">${item.quantity}</span>
            </td>
            
            <td class="item-total">${formatCurrency(total)}</td>
            <td class="item-remove">
                <button class="remove-item-btn" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;

        // 僅綁定移除按鈕事件
        row.querySelector('.remove-item-btn').addEventListener('click', () => removeItem(index));

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
    if (orderFinalTotal) orderFinalTotal.innerHTML = `**${formatCurrency(finalTotal)}**`;

    if (checkoutBtn) {
        checkoutBtn.textContent = `結帳 (${formatCurrency(finalTotal)})`;
        checkoutBtn.dataset.total = finalTotal.toFixed(0);
    }
}

function clearOrder(force = false) {
    if (!force && orderItems.length === 0) return;
    
    orderItems = []; 
    renderOrderItems();
    updateOrderTotals();
    console.log('🗑️ 訂單已清空');
}

// ===============================================
// 8. 結帳邏輯
// ===============================================
function showCheckoutModal() {
    if (orderItems.length === 0) return;

    const totalAmount = parseFloat(checkoutBtn.dataset.total || 0);
    
    summaryTotalAmount.textContent = formatCurrency(totalAmount);
    
    // 初始支付金額設定為總金額
    paidAmountInput.value = totalAmount.toFixed(0); 
    summaryChangeAmount.textContent = formatCurrency(0);
    checkoutErrorMessage.classList.add('hidden');
    
    finalConfirmBtn.disabled = false;
    
    checkoutModal.classList.add('active');
    paidAmountInput.focus();
    paidAmountInput.select();
    
    handlePaymentInput(); 
}

function handlePaymentInput() {
    const totalAmount = parseFloat(checkoutBtn.dataset.total || 0);
    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    const change = paidAmount - totalAmount;

    summaryChangeAmount.textContent = formatCurrency(change);
    
    if (change < 0) {
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
        alert('請先選擇值班員工！');
        return;
    }

    if (finalConfirmBtn.disabled) return;
        
    finalConfirmBtn.disabled = true;
    finalConfirmBtn.textContent = '處理中...';

    // 庫存最終檢查 (防止超賣)
    for (const item of orderItems) {
        const product = allProducts.find(p => p.id === item.product_id);
        if (!product || item.quantity > product.stock) {
            alert(`交易失敗: 商品「${item.name}」庫存不足 (${product ? product.stock : 0})！請修正訂單數量。`);
            finalConfirmBtn.textContent = '確認結帳並入帳';
            finalConfirmBtn.disabled = false;
            checkoutModal.classList.remove('active'); // 關閉結帳頁面，回到點單
            return;
        }
    }
    // 檢查通過，繼續結帳流程

    const totalAmount = parseFloat(checkoutBtn.dataset.total);
    const employeeId = currentEmployee.id;

    // 獲取支付細節
    const paidAmount = parseFloat(paidAmountInput.value) || 0; 
    const changeAmount = Math.max(0, paidAmount - totalAmount); 
    const transactionTime = new Date().toISOString(); 

    // 步驟 1: 寫入 orders (訂單主表)
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
            { 
                employee_id: employeeId, 
                total_amount: totalAmount,
                discount_amount: 0,
                status: 'Completed',
                paid_amount: paidAmount, 
                change_amount: changeAmount,
                sales_date: transactionTime
            }
        ])
        .select() 
        .single(); 

    if (orderError) {
        console.error('寫入訂單主表失敗:', orderError);
        alert(`結帳失敗: 無法記錄主訂單。\n詳細錯誤: ${orderError.message}\n請檢查 Supabase RLS 權限或表格約束！`); 
        finalConfirmBtn.textContent = '確認結帳並入帳';
        finalConfirmBtn.disabled = false;
        return;
    }

    const orderId = orderData.id;
    console.log(`訂單 ${orderId} 寫入成功。`);

    // 步驟 2: 寫入 order_items (訂單明細表)
    const orderItemsPayload = orderItems.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_sale: item.price,
        subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload);

    if (itemsError) {
        console.error('寫入訂單明細失敗:', itemsError);
        alert(`結帳失敗: 無法記錄訂單明細。\n詳細錯誤: ${itemsError.message}\n請檢查 Supabase RLS 權限或表格約束！`);
        finalConfirmBtn.textContent = '確認結帳並入帳';
        finalConfirmBtn.disabled = false;
        return;
    }
    console.log('訂單明細寫入成功。');
    
    // 步驟 3: 扣減庫存 (更新 products 表)
    
    const updatePromises = orderItems.map(item => {
        const currentProduct = allProducts.find(p => p.id === item.product_id);
        const newStock = currentProduct.stock - item.quantity;
        
        return supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product_id);
    });
    
    const updateResults = await Promise.all(updatePromises);
    const stockErrors = updateResults.filter(res => res.error);

    if (stockErrors.length > 0) {
        console.error('部分庫存更新失敗:', stockErrors);
        alert('注意: 訂單已記錄，但部分庫存更新失敗！');
    } else {
        console.log('庫存扣減成功。');
    }

    // 步驟 4: 交易完成與介面重置
    
    alert(`結帳成功！訂單號碼: ${orderId}。找零金額: ${formatCurrency(changeAmount)}`);
    
    checkoutModal.classList.remove('active');
    clearOrder(); 
    loadProducts(); // 重新載入商品以更新庫存顯示
    
    finalConfirmBtn.textContent = '確認結帳並入帳'; // 恢復按鈕文字
    finalConfirmBtn.disabled = false; // 恢復按鈕狀態
}


// ===============================================
// 9. 應用程式啟動與事件監聽 (★★★ 修復此處事件綁定邏輯 ★★★)
// ===============================================

function initializeEmployeeModule() {
    // 1. 載入員工資料並顯示 Modal (來自 employee.js)
    loadEmployees();
    
    // 確保 Modal 顯示
    if (employeeModal) {
        window.requestAnimationFrame(() => {
            employeeModal.classList.add('active');
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // 初始設定
    updateClock();
    setInterval(updateClock, 1000); 

    initializeEmployeeModule(); // 呼叫員工模組初始化

    // 【修復】綁定「後台管理」按鈕事件 (跳轉頁面)
    if (goToBackendBtn) {
        goToBackendBtn.onclick = handleBackendRedirect; // 呼叫跳轉函數
    }
    
    // 【新增】綁定「切換員工」按鈕事件 (打開 Modal)
    if (changeEmployeeBtn) {
        changeEmployeeBtn.onclick = handleEmployeeSwitch; // 呼叫切換員工函數
    }

    // 介面按鈕事件 (來自 pos.js 的清空按鈕)
    if (clearOrderBtn) {
        clearOrderBtn.addEventListener('click', () => {
            if (orderItems.length > 0) { 
                if (confirm('確定要清空整筆訂單嗎？')) {
                    clearOrder();
                }
            }
        });
    }

    // 結帳相關事件監聽
    if (checkoutBtn) checkoutBtn.addEventListener('click', showCheckoutModal);
    if (closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', () => {
        checkoutModal.classList.remove('active');
    });
    if (paidAmountInput) paidAmountInput.addEventListener('input', handlePaymentInput);
    if (finalConfirmBtn) finalConfirmBtn.addEventListener('click', processCheckout);
    
    // 初始渲染空訂單
    renderOrderItems(); 
    updateOrderTotals();
    
    console.log('🚀 POS 系統腳本已啟動，所有模組成功整合。');
});