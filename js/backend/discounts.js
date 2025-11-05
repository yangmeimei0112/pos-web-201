/*
 * ====================================================================
 * [V42.1] 後台 折扣管理 (discounts.js)
 * [V43.2] 修正 import 路徑
 * ====================================================================
 */
// [V43.2] 修正 import 路徑
import { supabase as db } from '../supabaseClient.js';
import { formatCurrency } from '../common/utils.js';
import * as DOM from './dom.js';
import { showDiscountModal } from './ui.js';

export async function loadDiscounts(isRealtimeCall = false) {
    if (isRealtimeCall) {
        const activeSection = document.querySelector('.management-section.active');
        if (!activeSection || activeSection.id !== 'discount-management-section') {
            console.log("[Realtime] 收到 discounts 刷新，但目前不在折扣頁，跳過。");
            return;
        }
    }

    try {
        const { data, error } = await db
            .from('discounts')
            .select('*')
            .order('id', { ascending: true }); 
        if (error) throw error;
        renderDiscountTable(data); 
    } catch (err) {
        console.error("載入折扣時發生錯誤:", err);
        DOM.discountTableBody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderDiscountTable(discounts) {
    if (!discounts || discounts.length === 0) {
        DOM.discountTableBody.innerHTML = '<tr><td colspan="6" class="loading-message">目前沒有任何折扣。</td></tr>';
        return;
    }
    DOM.discountTableBody.innerHTML = ''; 
    discounts.forEach(item => {
        const row = document.createElement('tr');
        const statusText = item.is_active ? '<span class="status-active">✔ 啟用中</span>' : '<span class="status-inactive">✘ 已停用</span>';
        
        let targetText = '全單適用';
        if (item.target_product_id) {
            targetText = `單品ID: ${item.target_product_id}`;
        } else if (item.target_category) {
            targetText = `分類: ${item.target_category}`;
        }

        const toggleActiveButton = item.is_active
            ? `<button class="btn-secondary deactivate-discount-btn" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>`
            : `<button class="btn-primary activate-discount-btn" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`;
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${formatCurrency(item.amount)}</td>
            <td>${targetText}</td>
            <td>${statusText}</td>
            <td>
                <button class="btn-secondary edit-discount-btn" data-id="${item.id}">編輯</button>
                ${toggleActiveButton}
                <button class="btn-danger delete-discount-btn" data-id="${item.id}">刪除</button>
            </td>
        `;
        DOM.discountTableBody.appendChild(row);
    });
}

export async function handleDiscountFormSubmit(e) {
    e.preventDefault();
    DOM.discountFormErrorMessage.textContent = '';
    const saveBtn = document.getElementById('save-discount-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    
    const formData = new FormData(DOM.discountForm);
    const discountData = Object.fromEntries(formData.entries());
    const discountId = discountData.id;
    
    discountData.is_active = document.getElementById('discount-is-active').checked;
    discountData.amount = parseFloat(discountData.amount);

    discountData.target_category = discountData.target_category.trim() || null;
    discountData.target_product_id = parseInt(discountData.target_product_id, 10) || null;

    try {
        let response;
        if (discountId) {
            const { id, ...updateData } = discountData;
            response = await db.from('discounts').update(updateData).eq('id', discountId).select();
        } else {
            delete discountData.id;
            response = await db.from('discounts').insert([discountData]).select();
        }
        const { data, error } = response;
        if (error) { throw error; } 
        console.log('折扣儲存成功:', data);
        DOM.discountModal.classList.remove('active');
        DOM.discountForm.reset();
        await loadDiscounts(); 
    } catch (err) {
        console.error("儲存折扣時發生錯誤:", err);
        DOM.discountFormErrorMessage.textContent = `儲存失敗: ${err.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}
export async function handleToggleDiscountActive(id, newActiveState) {
    const actionText = newActiveState ? '啟用' : '停用';
    if (!confirm(`您確定要 ${actionText} ID 為 ${id} 的折扣嗎？\n(這將影響前台能否選取)`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .update({ is_active: newActiveState }) 
            .eq('id', id);
        if (error) throw error;
        console.log(`折扣 ${id} ${actionText} 成功`);
        await loadDiscounts(); 
    } catch (err) {
        console.error(`折扣 ${actionText} 時發生錯誤:`, err);
        alert(`${actionText} 失敗: ${err.message}`);
    }
}
export async function handleDiscountDelete(id) {
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的折扣嗎？\n\n警告：此操作無法復原。\n如果已有訂單使用此折扣，建議改用「停用」。`)) {
        return;
    }
    try {
        const { error } = await db
            .from('discounts')
            .delete()
            .eq('id', id);
        if (error) {
            if (error.code === '23503') { 
                alert(`刪除失敗：該折扣已被歷史訂單使用，無法永久刪除。\n\n提示：請改用「停用」功能來取代。`);
            } else {
                throw error;
            }
        } else {
            console.log(`折扣 ${id} 刪除成功`);
            await loadDiscounts(); 
        }
    } catch (err) {
        console.error("刪除折扣時發生未預期的錯誤:", err);
        alert(`刪除失敗: ${err.message}`);
    }
}
export async function handleDiscountTableClick(e) {
    const target = e.target.closest('button'); 
    if (!target) return; 
    const id = target.dataset.id;
    if (!id) return; 

    if (target.classList.contains('edit-discount-btn')) {
        const { data, error } = await db.from('discounts').select('*').eq('id', id).single();
        if (error) { alert(`查詢折扣資料失敗: ${error.message}`); return; }
        showDiscountModal(data); 
    }
    if (target.classList.contains('deactivate-discount-btn')) {
        await handleToggleDiscountActive(id, false); 
    }
    if (target.classList.contains('activate-discount-btn')) {
        await handleToggleDiscountActive(id, true); 
    }
    if (target.classList.contains('delete-discount-btn')) {
        await handleDiscountDelete(id);
    }
}