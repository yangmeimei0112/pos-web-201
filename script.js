// ====================================================================
// 警告：以下密鑰為公開可見，僅用於本地測試。下一步將修正為安全寫法！
// ====================================================================
const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";

// 檢查 Supabase 是否已載入並初始化
let supabase;
if (window.supabase) {
    // ✅ 正確初始化 Supabase
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("❌ Supabase 尚未載入。請檢查 CDN 是否正確引入。");
    // 為了不阻擋 DOMContentLoaded，這裡不使用 alert
}


// 全域資料儲存
let currentEmployee = null;
let allProducts = []; // 儲存所有從 Supabase 載入的商品
let activeCategory = 'ALL'; // 當前選中的分類
// TODO: 下一步加入 orderItems = [] 訂單項目

// DOM 元素
const modal = document.getElementById('employee-selection-modal');
const employeeList = document.getElementById('employee-list');
const loadingMessage = document.getElementById('loading-message');
const posMainApp = document.getElementById('pos-main-app');
const employeeDisplay = document.getElementById('current-employee-display');
const currentTimeDisplay = document.getElementById('current-time');
const categoryTabs = document.getElementById('category-tabs');
const productList = document.getElementById('product-list');
const productLoadingMessage = document.getElementById('product-loading-message');

/**
 * 步驟 A: 初始化 - 顯示時間
 */
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit' });
    currentTimeDisplay.textContent = `${dateString} ${timeString}`;
}
// 每秒更新一次時間顯示
setInterval(updateClock, 1000);
updateClock(); // 立即更新一次

/**
 * 步驟 B: 從 Supabase 載入員工列表 (保持不變)
 */
async function loadEmployees() {
    // ... (內容保持不變，略過) ...
    // 員工選擇邏輯 (selectEmployee) 也保持不變
}

// -------------------------------------------------------------
// V4 新增的核心功能：商品載入與顯示
// -------------------------------------------------------------

/**
 * 步驟 D: 從 Supabase 載入所有商品資料
 */
async function loadProducts() {
    productLoadingMessage.style.display = 'block'; // 顯示載入中
    productList.innerHTML = '';

    const { data, error } = await supabase
        .from('products')
        .select('*') // 載入所有欄位
        .eq('is_active', true) // 只載入啟用中的商品
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    productLoadingMessage.style.display = 'none'; // 隱藏載入中

    if (error) {
        console.error('Error loading products:', error);
        productList.innerHTML = `<p style="color:red; text-align:center;">載入商品資料失敗！請檢查 RLS 政策或 API 連線。</p>`;
        return;
    }

    allProducts = data; // 將所有商品儲存在全域變數
    renderCategories(allProducts); // 渲染分類標籤
    filterAndRenderProducts(activeCategory); // 渲染所有商品（預設 ALL）
}


/**
 * 步驟 E: 根據載入的商品，渲染分類按鈕
 */
function renderCategories(products) {
    // 從商品列表中提取所有不重複的分類
    const categories = ['ALL', ...new Set(products.map(p => p.category))];
    categoryTabs.innerHTML = ''; // 清空現有分類

    categories.forEach(category => {
        const button = document.createElement('button');
        button.classList.add('category-button');
        if (category === activeCategory) {
            button.classList.add('active');
        }
        button.textContent = category;
        button.dataset.category = category;
        
        button.addEventListener('click', () => {
            setActiveCategory(category);
        });
        categoryTabs.appendChild(button);
    });
}

/**
 * 步驟 F: 處理分類點擊事件
 */
function setActiveCategory(category) {
    activeCategory = category;
    
    // 更新按鈕的 active 狀態
    document.querySelectorAll('.category-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    filterAndRenderProducts(category);
}

/**
 * 步驟 G: 根據分類過濾並渲染商品卡片
 */
function filterAndRenderProducts(category) {
    let filteredProducts = allProducts;

    if (category !== 'ALL') {
        filteredProducts = allProducts.filter(p => p.category === category);
    }

    productList.innerHTML = ''; // 清空商品列表

    if (filteredProducts.length === 0) {
        productList.innerHTML = `<p style="text-align:center;">此分類下沒有可售賣的商品。</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        // 檢查庫存狀態
        const isOutOfStock = product.stock <= 0;
        
        const card = document.createElement('div');
        card.classList.add('product-card');
        if (isOutOfStock) {
            card.classList.add('out-of-stock');
        }
        
        // 為了簡單，暫時不處理圖片，只顯示文字
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p class="price">NT$ ${product.price.toFixed(0)}</p>
            <p class="stock-status">
                ${isOutOfStock ? 
                    '<i class="fas fa-times-circle"></i> 缺貨' : 
                    `<i class="fas fa-check-circle"></i> 庫存: ${product.stock}`}
            </p>
        `;

        // TODO: 下一步將在這裡加入點擊事件，將商品加入訂單

        productList.appendChild(card);
    });
}


// -------------------------------------------------------------
// 應用程式啟動
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. 確保員工選擇視窗是啟動的
    modal.classList.add('active'); 
    
    // 2. 載入員工資料 (此處邏輯不變)
    loadEmployees();
    
    // 3. 設置進入後台按鈕的邏輯 (不變)
    document.getElementById('go-to-backend-btn').addEventListener('click', () => {
        alert('切換到後台管理介面 (後續步驟實作)');
    });
});


/**
 * 從 Step 3 複製的 loadEmployees (為節省篇幅，此處僅保留框架)
 */
async function loadEmployees() {
    if (!supabase) return; // 如果 Supabase 載入失敗，則直接退出

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
    // ... (渲染員工按鈕邏輯) ...
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

function selectEmployee(id, name) {
    currentEmployee = { id, name };
    employeeDisplay.innerHTML = `<i class="fas fa-id-card-alt"></i> ${name} 值班中`;
    modal.classList.remove('active');
    posMainApp.classList.remove('hidden');
    console.log(`員工 ${name} (ID: ${id}) 已登入。`);
    
    // *** 登入後，呼叫載入商品功能 ***
    loadProducts(); 
}