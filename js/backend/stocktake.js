/*
 * ====================================================================
 * [V42.1] 後台 庫存盤點 (stocktake.js)
 * ====================================================================
 */
import { supabase as db } from '../supabaseClient.js';
import * as DOM from './dom.js';

export async function loadStocktakeList(isRealtimeCall = false) {
    if (isRealtimeCall) {
        const activeSection = document.querySelector('.management-section.active');
        if (!activeSection || activeSection.id !== 'stocktake-section') {
            console.log("[Realtime] 收到 products 刷新，但目前不在盤點頁，跳過。");
            return;
        }
    }

    if (!DOM.stocktakeListTbody) return;
    DOM.stocktakeListTbody.innerHTML = '<tr><td colspan="6" class="loading-message">載入商品資料中...</td></tr>';
    try {
        const { data, error } = await db
            .from('products')
            .select('id, name, category, stock')
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        renderStocktakeTable(data);
    } catch (err) {
        console.error("載入盤點清單時發生錯誤:", err);
        DOM.stocktakeListTbody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderStocktakeTable(products) {
    if (!products || products.length === 0) {
        DOM.stocktakeListTbody.innerHTML = '<tr><td colspan="6" class="loading-message">沒有商品可供盤點。</td></tr>';
        return;
    }
    DOM.stocktakeListTbody.innerHTML = '';
    products.forEach(product => {
        const row = document.createElement('tr');
        row.dataset.productId = product.id; 
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td class="db-stock">${product.stock}</td>
            <td>
                <input type="number" class="stocktake-input" data-id="${product.id}" value="${product.stock}" min="0">
            </td>
            <td class="stock-diff zero">0</td>
        `;
        DOM.stocktakeListTbody.appendChild(row);
    });
}
export function handleStocktakeInputChange(e) {
    const target = e.target;
    if (!target.classList.contains('stocktake-input')) return;
    const row = target.closest('tr');
    if (!row) return;
    const dbStockEl = row.querySelector('.db-stock');
    const diffEl = row.querySelector('.stock-diff');
    const dbStock = parseInt(dbStockEl.textContent, 10);
    const actualStock = parseInt(target.value, 10);
    if (isNaN(dbStock) || isNaN(actualStock) || actualStock < 0) {
        diffEl.textContent = 'N/A';
        diffEl.className = 'stock-diff';
        if (actualStock < 0) target.value = 0;
        return;
    }
    const diff = actualStock - dbStock;
    diffEl.textContent = diff;
    diffEl.className = 'stock-diff'; 
    if (diff > 0) {
        diffEl.classList.add('positive');
        diffEl.textContent = `+${diff}`; 
    } else if (diff < 0) {
        diffEl.classList.add('negative');
    } else {
        diffEl.classList.add('zero');
    }
}
export async function handleUpdateAllStock() {
    if (!confirm("您確定要使用目前輸入的「實際盤點數量」覆蓋所有商品庫存嗎？\n\n【警告】此操作無法復原。")) {
        return;
    }
    DOM.updateAllStockBtn.disabled = true;
    DOM.updateAllStockBtn.textContent = '更新中...';
    const payload = [];
    const rows = DOM.stocktakeListTbody.querySelectorAll('tr');
    rows.forEach(row => {
        const id = row.dataset.productId;
        const input = row.querySelector('.stocktake-input');
        if (id && input) {
            const new_stock = parseInt(input.value, 10);
            if (!isNaN(new_stock) && new_stock >= 0) {
                payload.push({
                    id: parseInt(id, 10),
                    new_stock: new_stock
                });
            } else {
                console.warn(`ID ${id} 的庫存值無效 (${input.value})，已跳過。`);
            }
        }
    });
    if (payload.length === 0) {
        alert("沒有有效的庫存資料可更新。");
        DOM.updateAllStockBtn.disabled = false;
        DOM.updateAllStockBtn.textContent = '✔ 一鍵更新庫存';
        return;
    }
    try {
        const { error } = await db.rpc('bulk_update_stock', { updates: payload });
        if (error) throw error;
        alert(`成功更新 ${payload.length} 項商品的庫存！`);
        await loadStocktakeList(); 
    } catch (err) {
        console.error("批次更新庫存時發生錯誤:", err);
        alert(`更新失敗: ${err.message}`);
    } finally {
        DOM.updateAllStockBtn.disabled = false;
        DOM.updateAllStockBtn.textContent = '✔ 一鍵更新庫存';
    }
}