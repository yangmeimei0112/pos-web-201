/*
 * ====================================================================
 * [V52.0] 後台 Realtime (realtime.js)
 * - [V52.0] 報表刷新日誌改為 2 秒
 * ====================================================================
 */

// [V43.2] 修正 import 路徑
import { supabase as db } from '../supabaseClient.js';
import { loadProducts } from './products.js';
import { loadEmployees } from './employees.js';
import { loadAllOrdersForSequence } from './orders.js';
import { loadDiscounts } from './discounts.js';
import { loadStocktakeList } from './stocktake.js';
import { loadDashboardData, loadTopSellingProducts, loadEmployeeSalesStats } from './reports.js';

export let autoRefreshInterval = null;

export function refreshReportData() {
    if (document.querySelector('.modal.active')) {
        console.log("[V52.0] Modal 開啟中，跳過報表刷新。");
        return;
    }
    
    const activeSection = document.querySelector('.management-section.active');
    if (activeSection && activeSection.id === 'reports-section') {
        console.log("[V52.0] 2秒自動刷新: 報表"); // [V52.0] 修改
        loadDashboardData();
        loadTopSellingProducts();
        loadEmployeeSalesStats();
    }
}

export function setupGlobalRealtime() {
    console.log("✅ [Realtime] 啟動全局監聽...");
    
    db.channel('public:products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },
            (payload) => {
                console.log('🔄 [Realtime] 偵測到 products 變更');
                loadProducts(true); // 傳入 true 表示是 Realtime 呼叫
            }
        ).subscribe();

    db.channel('public:employees')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' },
            () => {
                console.log('🔄 [Realtime] 偵測到 employees 變更');
                loadEmployees(true); 
            }
        ).subscribe();

    db.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
            () => {
                console.log('🔄 [Realtime] 偵測到 orders 變更');
                loadAllOrdersForSequence(true); 
            }
        ).subscribe();
        
    db.channel('public:order_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
            () => {
                console.log('🔄 [Realtime] 偵測到 order_items 變更');
                loadAllOrdersForSequence(true); 
            }
        ).subscribe();

    db.channel('public:discounts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'discounts' },
            () => {
                console.log('🔄 [Realtime] 偵測到 discounts 變更');
                loadDiscounts(true); 
            }
        ).subscribe();
    
    db.channel('public:order_discounts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_discounts' },
            () => {
                console.log('🔄 [Realtime] 偵測到 order_discounts 變更');
                loadAllOrdersForSequence(true); 
            }
        ).subscribe();
}