// ====================================================================
// !!! 警告：以下密鑰為公開可見，僅用於本地測試。下一步將修正為安全寫法 !!!
// ====================================================================
const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";

// 檢查 Supabase 是否已載入
if (!window.supabase) {
    console.error("❌ Supabase 尚未載入。請確認 CDN 是否正確引入並在 script.js 之前載入。");
    alert("Supabase 載入失敗，請檢查網頁設定。");
} else {
    // ✅ 正確初始化 Supabase
    const { createClient } = window.supabase;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 存儲當前值班員工的 ID 和名稱
    let currentEmployee = null;

    // DOM 元素
    const modal = document.getElementById('employee-selection-modal');
    const employeeList = document.getElementById('employee-list');
    const loadingMessage = document.getElementById('loading-message');
    const posMainApp = document.getElementById('pos-main-app');
    const employeeDisplay = document.getElementById('current-employee-display');
    const currentTimeDisplay = document.getElementById('current-time');

    /**
     * 步驟 A: 初始化 - 顯示時間
     */
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('zh-Hant', { year: 'numeric', month: '2-digit', day: '2-digit' });
        currentTimeDisplay.textContent = `${dateString} ${timeString}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    /**
     * 步驟 B: 從 Supabase 載入員工列表
     */
    async function loadEmployees() {
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
            employeeList.innerHTML = `<p style="color:red;">載入員工資料失敗！請檢查 Supabase 連線及 RLS 權限。</p>`;
            return;
        }

        if (employees.length === 0) {
            employeeList.innerHTML = '<p>後台尚未設定任何員工資料。</p>';
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

    /**
     * 步驟 C: 處理員工選擇 (登入)
     */
    function selectEmployee(id, name) {
        currentEmployee = { id, name };
        employeeDisplay.innerHTML = `<i class="fas fa-id-card-alt"></i> ${name} 值班中`;
        modal.classList.remove('active');
        posMainApp.classList.remove('hidden');
        console.log(`員工 ${name} (ID: ${id}) 已登入。`);
    }

    /**
     * 應用程式啟動
     */
    document.addEventListener('DOMContentLoaded', () => {
        modal.classList.add('active');
        loadEmployees();
        document.getElementById('go-to-backend-btn').addEventListener('click', () => {
            alert('切換到後台管理介面 (後續步驟實作)');
        });
    });
}
