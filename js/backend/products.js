/*
 * ====================================================================
 * [V42.2] 後台 商品管理 (products.js)
 * - [V42.2] 新增 export getCurrentProductList() 供匯出功能使用
 * ====================================================================
 */
import { supabase as db } from '../supabaseClient.js';
import { formatCurrency } from '../common/utils.js';
import * as DOM from './dom.js';
import { showProductModal } from './ui.js';
import { renderStocktakeTable } from './stocktake.js'; 

let currentProductList = []; 
// [V42.2] 新增 Getter 函數
export function getCurrentProductList() {
    return currentProductList;
}

export async function loadProducts(isRealtimeCall = false) { 
    if (isRealtimeCall) {
        const activeSection = document.querySelector('.management-section.active');
        if (!activeSection || (activeSection.id !== 'product-management-section' && activeSection.id !== 'stocktake-section')) {
            console.log("[Realtime] 收到 products 刷新，但目前不在商品頁或盤點頁，跳過。");
            return;
        }
    }

    try {
        const { data, error } = await db.from('products').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }); 
        if (error) throw error;
        
        if (JSON.stringify(currentProductList) === JSON.stringify(data)) {
            return;
        }
        
        currentProductList = JSON.parse(JSON.stringify(data)); 
        
        if (document.getElementById('product-management-section').classList.contains('active')) {
             renderProductTable(data); 
        }
        if (document.getElementById('stocktake-section').classList.contains('active')) {
            renderStocktakeTable(data);
        }
    } catch (err) {
        console.error("載入商品時發生錯誤:", err);
        DOM.productTableBody.innerHTML = `<tr><td colspan="11" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderProductTable(products) { 
    if (!products || products.length === 0) {
        DOM.productTableBody.innerHTML = '<tr><td colspan="11" class="loading-message">目前沒有任何商品。</td></tr>';
        return;
    }
    DOM.productTableBody.innerHTML = ''; 
    products.forEach((product, index) => {
        const row = document.createElement('tr');
        const statusText = product.is_active ? '<span class="status-active">✔ 上架中</span>' : '<span class="status-inactive">✘ 已下架</span>';
        const isFirst = index === 0;
        const isLast = index === products.length - 1;
        const sortButtons = `
            <td class="product-sort">
                <button class="sort-btn sort-up-btn" data-id="${product.id}" ${isFirst ? 'disabled' : ''}>▲</button>
                <button class="sort-btn sort-down-btn" data-id="${product.id}" ${isLast ? 'disabled' : ''}>▼</button>
            </td>
        `;
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${formatCurrency(product.cost)}</td>
            <td>${product.stock}</td>
            <td>${product.par_stock ?? 0}</td>
            <td>${product.warning_threshold ?? 'N/A'}</td>
            <td>${statusText}</td>
            ${sortButtons}
            <td>
                <button class="btn-secondary edit-btn" data-id="${product.id}">編輯/上下架</button>
                <button class="btn-danger delete-btn" data-id="${product.id}">刪除</button>
            </td>
        `;
        DOM.productTableBody.appendChild(row);
    });
}

export async function handleProductFormSubmit(e) { 
    e.preventDefault(); 
    DOM.productFormErrorMessage.textContent = ''; 
    const saveBtn = document.getElementById('save-product-btn'); 
    saveBtn.disabled = true; 
    saveBtn.textContent = '儲存中...'; 
    
    const formData = new FormData(DOM.productForm); 
    const productData = Object.fromEntries(formData.entries()); 
    const productId = productData.id; 
    
    productData.is_active = document.getElementById('product-is-active').checked; 
    productData.price = parseFloat(productData.price); 
    productData.cost = parseFloat(productData.cost) || 0; 
    productData.stock = parseInt(productData.stock, 10); 
    productData.warning_threshold = parseInt(productData.warning_threshold, 10) || 0; 
    productData.par_stock = parseInt(productData.par_stock, 10) || 0;

    try {
        let response; 
        if (productId) { 
            const { id, ...updateData } = productData; 
            response = await db.from('products').update(updateData).eq('id', productId).select(); 
        } else { 
            delete productData.id; 
            const newSortOrder = (currentProductList.length + 1) * 10; 
            productData.sort_order = newSortOrder; 
            response = await db.from('products').insert([productData]).select(); 
        } 
        const { data, error } = response; 
        if (error) { throw error; } 
        console.log('商品儲存成功:', data); 
        DOM.productModal.classList.remove('active');
        DOM.productForm.reset();
        await loadProducts(); 
    } catch (err) { 
        console.error("儲存商品時發生錯誤:", err); 
        DOM.productFormErrorMessage.textContent = `儲存失敗: ${err.message}`; 
    } finally { 
        saveBtn.disabled = false; 
        saveBtn.textContent = '儲存'; 
    }
}
export async function handleProductDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的商品嗎？\n\n注意：此操作無法復原。\n如果只是暫時不賣，請使用「編輯/上下架」功能。`)) { return; } 
    try { const { error } = await db.from('products').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該商品已有銷售紀錄，無法永久刪除。\n\n提示：請使用「編輯/上下架」功能將其「下架」，即可在前台隱藏該商品。`); } else { throw error; } } else { console.log(`商品 ${id} 刪除成功`); 
        await loadProducts();
    } } catch (err) { console.error("刪除商品時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
export async function handleProductSortSwap(productId, direction) { 
    const productIndex = currentProductList.findIndex(p => p.id == productId); if (productIndex === -1) return; const newIndex = (direction === 'up') ? productIndex - 1 : productIndex + 1; if (newIndex < 0 || newIndex >= currentProductList.length) return; const [item] = currentProductList.splice(productIndex, 1); currentProductList.splice(newIndex, 0, item); renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = true); 
    try { const updatePayload = currentProductList.map((product, index) => ({ id: product.id, sort_order: index * 10 })); const { error } = await db.rpc('bulk_update_sort_order', { updates: updatePayload }); if (error) throw error; console.log('商品排序更新成功！'); } catch (err) { console.error("交換商品排序並呼叫 RPC 時發生錯誤:", err); alert(`排序更新失敗: ${err.message}。介面將重新整理至資料庫狀態。`); await loadProducts(); } finally { renderProductTable(currentProductList); document.querySelectorAll('.sort-btn, .edit-btn, .delete-btn').forEach(btn => btn.disabled = false); }
}
export async function handleProductTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-btn')) { const { data, error } = await db.from('products').select('*').eq('id', id).single(); if (error) { alert(`查詢商品資料失敗: ${error.message}`); return; } showProductModal(data); } if (target.classList.contains('delete-btn')) { await handleProductDelete(id); } if (target.classList.contains('sort-up-btn')) { await handleProductSortSwap(id, 'up'); } if (target.classList.contains('sort-down-btn')) { await handleProductSortSwap(id, 'down'); }
}