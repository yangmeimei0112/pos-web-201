/*
 * ====================================================================
 * [V46.0] 前台 員工模組 (employee.js)
 * - [V46.0] 修正 V45.0 遺漏的 loadProducts 匯入
 * - [優化] 移除 setInterval (改用 Realtime)
 * - [優化] 新增 sessionStorage 儲存登入狀態
 * ====================================================================
 */
import { supabase } from '../supabaseClient.js';
import * as DOM from './dom.js';
import * as State from './state.js';
import { loadProducts } from './products.js'; 
import { loadDiscounts } from './discounts.js';

export function selectEmployee(id, name) {
    State.setCurrentEmployee({ id, name });
    
    // [優化] 將登入狀態存入 sessionStorage，以便從後台返回時讀取
    try {
        const employeeData = JSON.stringify({ id, name });
        sessionStorage.setItem('currentPOS_Employee', employeeData);
    } catch (e) {
        console.error("無法寫入 sessionStorage:", e);
    }
    
    DOM.currentEmployeeDisplay.innerHTML = `<i class="fas fa-id-card-alt"></i> ${name} 值班中`;
    DOM.employeeModal.classList.remove('active');
    DOM.posMainApp.classList.remove('hidden');
    
    console.log(`✅ 員工 ${name} (ID: ${id}) 開始值班。`);
    
    if (State.state.allProducts.length === 0) {
        loadProducts();
    }
    if (State.state.availableDiscounts.length === 0) {
        loadDiscounts(); 
    }
}

export async function loadEmployees() {
    if (!supabase || !DOM.employeeList) {
        console.error("錯誤: Supabase 或員工列表元素未準備好。");
        DOM.loadingMessage.textContent = '初始化錯誤';
        return;
    }
    DOM.loadingMessage.classList.remove('hidden');
    DOM.employeeList.innerHTML = '';
    try {
        const { data: employees, error } = await supabase
            .from('employees')
            .select('id, employee_name, employee_code')
            .eq('is_active', true) 
            .order('employee_name', { ascending: true });
            
        DOM.loadingMessage.classList.add('hidden');
        if (error) throw error; 
        if (!employees || employees.length === 0) {
            DOM.employeeList.innerHTML = `<p>找不到可用的員工資料。</p>`;
            return;
        }
        employees.forEach(employee => {
            const button = document.createElement('button');
            button.classList.add('employee-button');
            button.dataset.id = employee.id;
            button.dataset.name = employee.employee_name;
            button.innerHTML = `
                <i class="fas fa-user"></i>
                <span class="employee-name-display">${employee.employee_name}</span>
                <span class="employee-code-display">${employee.employee_code}</span>
            `;
            button.addEventListener('click', () => selectEmployee(employee.id, employee.employee_name));
            DOM.employeeList.appendChild(button);
        });
    } catch (err) {
        console.error('載入員工時發生錯誤:', err);
        DOM.loadingMessage.classList.add('hidden');
        DOM.employeeList.innerHTML = `<p style="color:red;">載入員工資料失敗！請檢查 RLS 權限。</p>`;
    }
}

export function handleEmployeeSwitch(clearOrderFn) {
    if (!confirm("確定要切換員工或登出嗎？這將清空當前訂單。")) {
        return;
    }
    clearOrderFn(true); 
    State.setCurrentEmployee(null);
    
    // [優化] 清除 sessionStorage 中的登入狀態
    sessionStorage.removeItem('currentPOS_Employee');
    
    DOM.currentEmployeeDisplay.innerHTML = '<i class="fas fa-user-circle"></i> 請先選擇值班人員';
    DOM.posMainApp.classList.add('hidden');
    DOM.employeeModal.classList.add('active');
    
    loadEmployees();
}

export function initializeEmployeeModule() {
    // [優化] 確保在顯示選擇畫面時，舊的 sessionStorage (如果有的話) 被清除
    sessionStorage.removeItem('currentPOS_Employee');
    loadEmployees();
    DOM.employeeModal.classList.add('active');
}