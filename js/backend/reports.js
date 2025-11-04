/*
 * ====================================================================
 * [V42.1] 後台 報表 (reports.js)
 * ====================================================================
 */
import { supabase as db } from '../supabaseClient.js';
import { formatCurrency, animateValue } from '../common/utils.js';
import * as DOM from './dom.js';

export async function loadDashboardData() {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        const { data, error } = await db.rpc('fn_get_dashboard_stats', {
            p_start_date: todayStart,
            p_end_date: todayEnd
        });

        if (error) throw error;
        
        const stats = data;
        const totalOrders = stats.total_orders;
        const totalSales = stats.total_sales;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const totalCost = stats.total_cost;
        const totalProfit = stats.total_profit;
        
        const animDuration = 1000; 
        
        const currentTotalSales = parseFloat(DOM.dashboardTotalSales.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalOrders = parseFloat(DOM.dashboardTotalOrders.textContent) || 0;
        const currentAvgOrderValue = parseFloat(DOM.dashboardAvgOrderValue.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalCost = parseFloat(DOM.dashboardTotalCost.textContent.replace(/[^0-9.-]+/g,"")) || 0;
        const currentTotalProfit = parseFloat(DOM.dashboardTotalProfit.textContent.replace(/[^0-9.-]+/g,"")) || 0;

        animateValue(DOM.dashboardTotalSales, currentTotalSales, totalSales, animDuration, true, false);
        animateValue(DOM.dashboardTotalOrders, currentTotalOrders, totalOrders, animDuration, false, false);
        animateValue(DOM.dashboardAvgOrderValue, currentAvgOrderValue, avgOrderValue, animDuration, true, true); 
        animateValue(DOM.dashboardTotalCost, currentTotalCost, totalCost, animDuration, true, false);
        animateValue(DOM.dashboardTotalProfit, currentTotalProfit, totalProfit, animDuration, true, false);

    } catch (err) {
        console.error("載入總覽數據時發生錯誤:", err);
        DOM.dashboardTotalSales.textContent = '讀取失敗';
        DOM.dashboardTotalOrders.textContent = '讀取失敗';
        DOM.dashboardAvgOrderValue.textContent = 'N/A';
        DOM.dashboardTotalCost.textContent = 'N/A';
        DOM.dashboardTotalProfit.textContent = 'N/A';
    }
}
export async function loadTopSellingProducts() {
    try {
        const { data, error } = await db.rpc('get_top_selling_products', { limit_count: 10 });
        if (error) throw error;
        renderTopProductsTable(data);
    } catch (err) {
        console.error("載入熱銷排行時發生錯誤:", err);
        DOM.topProductsTableBody.innerHTML = `<tr><td colspan="5" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderTopProductsTable(products) {
    if (!products || products.length === 0) {
        DOM.topProductsTableBody.innerHTML = '<tr><td colspan="5" class="loading-message">尚無銷售紀錄。</td></tr>';
        return;
    }
    DOM.topProductsTableBody.innerHTML = ''; 
    products.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.product_name || 'N/A'}</td>
            <td>${item.total_sold}</td>
            <td>${formatCurrency(item.total_revenue)}</td>
            <td>${formatCurrency(item.total_profit)}</td>
        `;
        DOM.topProductsTableBody.appendChild(row);
    });
}
export async function loadEmployeeSalesStats() {
    try {
        const { data, error } = await db.rpc('get_employee_sales_stats');
        if (error) throw error;
        renderEmployeeSalesTable(data);
    } catch (err) {
        console.error("載入員工銷售排行時發生錯誤:", err);
        DOM.employeeSalesTableBody.innerHTML = `<tr><td colspan="4" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderEmployeeSalesTable(stats) {
    if (!stats || stats.length === 0) {
        DOM.employeeSalesTableBody.innerHTML = '<tr><td colspan="4" class="loading-message">尚無員工銷售紀錄。</td></tr>';
        return;
    }
    DOM.employeeSalesTableBody.innerHTML = ''; 
    stats.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.employee_name || 'N/A'}</td>
            <td>${formatCurrency(item.total_sales)}</td>
            <td>${item.total_orders}</td>
        `;
        DOM.employeeSalesTableBody.appendChild(row);
    });
}