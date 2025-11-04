/*
 * ====================================================================
 * [V42.2] 後台 訂單管理 (orders.js)
 * - [V42.2] 新增 export getAllOrders() 供匯出功能使用
 * ====================================================================
 */
import { supabase as db } from '../supabaseClient.js';
import { formatCurrency, formatDate } from '../common/utils.js';
import * as DOM from './dom.js';

let allOrders = []; 
// [V42.2] 新增 Getter 函數
export function getAllOrders() {
    return allOrders;
}

export async function loadAllOrdersForSequence(isRealtimeCall = false) {
    if (isRealtimeCall) {
        const activeSection = document.querySelector('.management-section.active');
        if (!activeSection || activeSection.id !== 'orders-section') {
            console.log("[Realtime] 收到 orders 刷新，但目前不在訂單頁，跳過。");
            return;
        }
    }

    try {
        const { data, error } = await db.from('orders').select(`id, sales_date, total_amount, employees ( employee_name )`).order('id', { ascending: false }); 
        if (error) throw error;
        
        if (JSON.stringify(allOrders) === JSON.stringify(data)) {
            return;
        }
        
        allOrders = data; 
        renderOrderTable(allOrders); 
    } catch (err) {
        console.error("載入所有訂單時發生錯誤:", err);
        allOrders = []; 
        DOM.orderListTableBody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失敗: ${err.message}</td></tr>`;
    }
}
export function renderOrderTable(ordersToRender) {
    const totalOrders = allOrders.length; 
    if (!ordersToRender || ordersToRender.length === 0) {
        const message = DOM.filterSequenceNumber.value ? '找不到指定的訂單。' : '目前沒有任何訂單。';
        DOM.orderListTableBody.innerHTML = `<tr><td colspan="6" class="loading-message">${message}</td></tr>`;
        return;
    }
    DOM.orderListTableBody.innerHTML = ''; 
    ordersToRender.forEach(order => {
        const originalIndex = allOrders.findIndex(o => o.id === order.id);
        const sequenceNumber = totalOrders - originalIndex; 
        const empName = order.employees ? order.employees.employee_name : 'N/A';
        const salesTime = formatDate(order.sales_date); 
        const row = document.createElement('tr');
        row.className = 'order-row';
        row.dataset.id = order.id; 
        row.innerHTML = `
            <td>${sequenceNumber}</td> 
            <td>${order.id}</td>
            <td><span class="expand-arrow">►</span> ${salesTime}</td> 
            <td>${empName}</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>
                <button class="btn-danger delete-order-btn" data-id="${order.id}">刪除</button>
            </td>
        `;
        DOM.orderListTableBody.appendChild(row);
        const detailRow = document.createElement('tr');
        detailRow.className = 'order-detail-row';
        detailRow.dataset.id = order.id;
        detailRow.innerHTML = `
            <td colspan="6" class="order-detail-cell"> 
                <div class="order-detail-content">
                    <div class="order-detail-summary">
                        <p><strong>經手員工:</strong> ${empName}</p>
                        <p><strong>銷售時間:</strong> ${salesTime}</p>
                        <p><strong>總金額:</strong> ${formatCurrency(order.total_amount)}</p>
                    </div>
                    <div class="table-container modal-table-container">
                        <table id="order-details-table">
                            <thead> <tr> <th>商品名稱</th> <th>售價</th> <th>數量</th> <th>小計</th> </tr> </thead>
                            <tbody id="order-details-tbody-${order.id}">
                                <tr><td colspan="4" class="loading-message">載入明細中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </td>
        `;
        DOM.orderListTableBody.appendChild(detailRow);
    });
}

export async function loadOrderDetails(orderId, targetTbody) { 
    if (!orderId || !targetTbody) return; 
    if (targetTbody.dataset.loaded === 'true') { return; } 
    
    try { 
        // 1. 查詢所有 "品項"
        const { data: items, error: itemsError } = await db 
            .from('order_items') 
            .select(` quantity, price_at_sale, note, products ( name ) `) 
            .eq('order_id', orderId)
            .not('product_id', 'is', null)
            .order('id', { ascending: true });
            
        if (itemsError) throw itemsError;

        // 2. 查詢所有 "折扣"
        const { data: discounts, error: discountsError } = await db
            .from('order_discounts')
            .select(` quantity, name_at_sale, amount_at_sale `)
            .eq('order_id', orderId);
            
        if (discountsError) throw discountsError;

        // 3. 渲染
        targetTbody.innerHTML = ''; 
        
        if (items.length === 0 && discounts.length === 0) {
             targetTbody.innerHTML = '<tr><td colspan="4" class="loading-message">此訂單沒有品項或折扣。</td></tr>'; 
             return;
        }

        // 渲染品項
        items.forEach(item => { 
            const row = document.createElement('tr'); 
            const prodName = item.products ? item.products.name : 'N/A';
            const noteHtml = item.note ? `<span class="item-note-display-backend">備註: ${item.note}</span>` : '';
            const subtotal = item.price_at_sale * item.quantity;
            row.innerHTML = ` 
                <td>${prodName}${noteHtml}</td>
                <td>${formatCurrency(item.price_at_sale)}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(subtotal)}</td> 
            `; 
            targetTbody.appendChild(row); 
        }); 
        
        // 渲染折扣
        discounts.forEach(discount => {
            const row = document.createElement('tr');
            const subtotal = -(discount.amount_at_sale * discount.quantity);
            const nameHtml = `<span style="color: #28a745; font-weight: 700;">[折扣] ${discount.name_at_sale}</span>`;
            
            row.innerHTML = `
                <td>${nameHtml}</td>
                <td>${formatCurrency(-discount.amount_at_sale)}</td>
                <td>${discount.quantity}</td>
                <td style="color: #28a745;">${formatCurrency(subtotal)}</td>
            `;
            targetTbody.appendChild(row);
        });

        targetTbody.dataset.loaded = 'true'; 
    } catch (err) { 
        console.error("載入訂單明細時發生錯誤:", err); 
        targetTbody.innerHTML = `<tr><td colspan="4" class="loading-message error">明細載入失敗: ${err.message}</td></tr>`; 
    }
}
export async function handleOrderTableClick(e) { 
    const target = e.target; const orderRow = target.closest('tr.order-row'); if (target.classList.contains('delete-order-btn')) { e.stopPropagation(); const id = target.dataset.id; await handleDeleteOrder(id); return; } if (orderRow) { const id = orderRow.dataset.id; const detailRow = DOM.orderListTableBody.querySelector(`tr.order-detail-row[data-id="${id}"]`); if (orderRow.classList.contains('expanded')) { orderRow.classList.remove('expanded'); detailRow.classList.remove('expanded'); orderRow.querySelector('.expand-arrow').style.transform = 'rotate(0deg)'; } else { orderRow.classList.add('expanded'); detailRow.classList.add('expanded'); orderRow.querySelector('.expand-arrow').style.transform = 'rotate(90deg)'; const detailTbody = detailRow.querySelector(`#order-details-tbody-${id}`); await loadOrderDetails(id, detailTbody); } }
}
export async function handleDeleteOrder(id) { 
    if (!confirm(`您確定要「永久刪除」訂單 ID ${id} 嗎？\n\n警告：此操作無法復原，將一併刪除所有相關明細。`)) { return; } 
    try { const { data, error } = await db.rpc('delete_order_and_items', { order_id_to_delete: id }); if (error) throw error; console.log(data); alert(`訂單 ${id} 已刪除。`); 
        await loadAllOrdersForSequence();
    } catch (err) { console.error("刪除單筆訂單時發生錯誤:", err); alert(`刪除失败: ${err.message}`); }
}
export async function handleDeleteAllOrders() { 
    if (!confirm("【極度危險】\n您確定要刪除「所有」訂單紀錄嗎？\n此操作將清空訂單和明細表。")) { return; } if (!confirm("【最終確認】\n此操作無法復原，所有銷售資料將被清除。是否繼續？")) { return; } 
    try { const { data, error } = await db.rpc('delete_all_orders_and_items'); if (error) throw error; console.log(data); alert('所有訂單均已成功刪除。'); 
        await loadAllOrdersForSequence();
    } catch (err) { console.error("刪除所有訂單時發生錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}

// 篩選按鈕
export function setupOrderFilters() {
    DOM.filterSearchBtn.addEventListener('click', () => {
        const seqNum = parseInt(DOM.filterSequenceNumber.value, 10);
        const total = allOrders.length;
        if (isNaN(seqNum) || seqNum < 1 || seqNum > total) {
            alert(`請輸入有效的數字 (1 到 ${total} 之間)。`);
            renderOrderTable(allOrders); 
            return;
        }
        const index = total - seqNum; 
        if (index >= 0 && index < total) {
            renderOrderTable([allOrders[index]]); 
        } else {
            renderOrderTable([]); 
        }
    }); 
    DOM.filterClearBtn.addEventListener('click', () => { 
        DOM.filterSequenceNumber.value = '';
        renderOrderTable(allOrders); 
    });
}