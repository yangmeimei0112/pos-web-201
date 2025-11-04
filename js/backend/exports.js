/*
 * ====================================================================
 * [V42.2] 後台 匯出 (exports.js)
 * - [V42.2] 匯入 getCurrentProductList 和 getAllOrders
 * ====================================================================
 */
import { formatDate } from '../common/utils.js';
import { getCurrentProductList } from './products.js'; // [V42.2]
import { getAllOrders } from './orders.js'; // [V42.2]

export function handleExportProducts() {
    if (typeof XLSX === 'undefined') {
        alert("錯誤：Excel 匯出函式庫 (SheetJS) 尚未載入。");
        return;
    }
    const currentProductList = getCurrentProductList(); // [V42.2]
    if (currentProductList.length === 0) {
        alert("沒有商品資料可匯出。");
        return;
    }
    const dataToExport = currentProductList.map(p => ({
        '商品ID': p.id,
        '名稱': p.name,
        '分類': p.category,
        '售價': p.price,
        '成本': p.cost ?? 0,
        '庫存 (浮動)': p.stock,
        '正常庫存 (固定)': p.par_stock ?? 0,
        '預警門檻': p.warning_threshold ?? 'N/A',
        '狀態': p.is_active ? '上架中' : '已下架',
        '排序值': p.sort_order
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    XLSX.writeFile(wb, "商品列表.xlsx");
}

export function handleExportOrders() {
    if (typeof XLSX === 'undefined') {
        alert("錯誤：Excel 匯出函式庫 (SheetJS) 尚未載入。");
        return;
    }
    const allOrders = getAllOrders(); // [V42.2]
    if (allOrders.length === 0) {
        alert("沒有訂單資料可匯出。");
        return;
    }
    const totalOrders = allOrders.length; 
    const dataToExport = allOrders.map((order, index) => ({
        '第幾筆': totalOrders - index,
        '訂單ID': order.id,
        '銷售日期': formatDate(order.sales_date),
        '經手員工': order.employees ? order.employees.employee_name : 'N/A',
        '總金額': order.total_amount
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "訂單列表");
    XLSX.writeFile(wb, "訂單列表.xlsx");
}