/*
 * ====================================================================
 * [V42.4] 前台 訂單模組 (order.js)
 * [V43.2] 修正 import 路徑
 * ====================================================================
 */
// [V43.2] 修正 import 路徑
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { openDiscountModal, validateAppliedDiscounts, updateDiscountButton } from './discounts.js';

// --- Private Helper ---
function getProductStock(productId) {
    const product = State.getProductById(productId);
    return product ? product.stock : 0;
}

// --- Exported Functions ---

export function addItemToOrder(product) {
    const existingItemIndex = State.state.orderItems.findIndex(item => item.product_id === product.id && !item.note); 
    const maxStock = getProductStock(product.id);
    if (existingItemIndex > -1) {
        const existingItem = State.state.orderItems[existingItemIndex];
        if (existingItem.quantity + 1 > maxStock) {
            alert(`商品「${product.name}」庫存不足！\n目前庫存: ${maxStock}，無法再新增。`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        if (1 > maxStock) {
            alert(`商品「${product.name}」庫存為 0，無法加入訂單。`);
            return;
        }
        State.state.orderItems.push({
            product_id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1,
            note: "",
            category: product.category
        });
    }
    renderOrderItems();
    updateOrderTotals();
}

export function increaseItemQuantity(index) {
    const item = State.state.orderItems[index];
    if (!item) return;
    const maxStock = getProductStock(item.product_id);
    if (item.quantity + 1 > maxStock) {
        alert(`商品「${item.name}」庫存不足！\n目前庫存: ${maxStock}，無法再增加。`);
        return;
    }
    item.quantity += 1;
    renderOrderItems();
    updateOrderTotals();
}

export function decreaseItemQuantity(index) {
    const item = State.state.orderItems[index];
    if (!item) return;
    if (item.quantity > 1) {
        item.quantity -= 1;
        renderOrderItems();
        updateOrderTotals();
    } else {
        if (confirm(`確定要將「${item.name}」${item.note ? `(備註: ${item.note})` : ''} 從訂單中移除嗎？`)) {
            removeItem(index);
        } else {
            renderOrderItems();
        }
    }
}

export function handleQuantityChange(index, newQuantityStr) {
    const item = State.state.orderItems[index];
    if (!item) return;
    let newQuantity = parseInt(newQuantityStr, 10);
    const maxStock = getProductStock(item.product_id);
    if (isNaN(newQuantity) || newQuantity < 1) {
        if (confirm(`數量無效。您是否要將「${item.name}」${item.note ? `(備註: ${item.note})` : ''} 從訂單中移除？`)) {
            removeItem(index); 
        } else {
            renderOrderItems(); 
        }
        return;
    }
    if (newQuantity > maxStock) {
        alert(`庫存不足！「${item.name}」僅剩 ${maxStock} 件。`);
        newQuantity = maxStock; 
    }
    item.quantity = newQuantity;
    renderOrderItems(); 
    updateOrderTotals();
}

export function handleEditNote(index) {
    const item = State.state.orderItems[index];
    if (!item) return;
    const currentNote = item.note || "";
    const newNote = prompt(`請輸入「${item.name}」的備註：`, currentNote);
    if (newNote !== null) {
        item.note = newNote.trim(); 
        console.log(`項目 ${index} 的備註更新為: ${item.note}`);
        renderOrderItems(); 
    }
}

export function removeItem(index) {
    if (index >= 0 && index < State.state.orderItems.length) {
        State.state.orderItems.splice(index, 1);
        renderOrderItems();
        updateOrderTotals(); 
    } else {
        console.error("嘗試移除無效的訂單項目索引:", index);
    }
}

export function renderOrderItems() {
    DOM.orderItemsTableBody.innerHTML = ''; 
    if (State.state.orderItems.length === 0) {
        DOM.orderItemsTableBody.innerHTML = `<tr><td colspan="5" class="empty-order-message">尚未加入商品</td></tr>`;
        DOM.checkoutBtn.disabled = true;
        updateDiscountButton(0); 
        return;
    }
    DOM.checkoutBtn.disabled = false;
    
    State.state.orderItems.forEach((item, index) => {
        const total = item.price * item.quantity;
        const maxStock = getProductStock(item.product_id); 
        const row = document.createElement('tr');
        row.className = 'order-item-row';
        row.dataset.index = index; 
        
        let noteHtml;
        if (item.note) {
            noteHtml = `
                <div class="item-note-wrapper">
                    <span class="item-note-display" title="${item.note}">${item.note}</span>
                    <button class="note-btn edit-note-btn" data-index="${index}" title="編輯備註">
                        <i class="fas fa-pen"></i>
                    </button>
                </div>
            `;
        } else {
            noteHtml = `
                <button class="note-btn add-note-btn" data-index="${index}">
                    <i class="fas fa-plus"></i> 新增備註
                </button>
            `;
        }
        
        row.innerHTML = `
            <td class="item-name">
                <span class="item-name-display">${item.name}</span>
                ${noteHtml} 
            </td>
            <td class="item-price">${formatCurrency(item.price)}</td>
            <td class="item-quantity">
                <div class="item-controls">
                    <button class="qty-btn decrease-btn" data-action="decrease" data-index="${index}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
                    <input type="number" class="item-qty-input" data-action="set-quantity" data-index="${index}" value="${item.quantity}" min="1" max="${maxStock}">
                    <button class="qty-btn increase-btn" data-action="increase" data-index="${index}" ${item.quantity >= maxStock ? 'disabled' : ''}>+</button>
                </div>
            </td>
            <td class="item-total">${formatCurrency(total)}</td>
            <td class="item-remove">
                 <button class="remove-item-btn" data-action="remove" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        DOM.orderItemsTableBody.appendChild(row);
    });
}

export function updateOrderTotals() {
    let subtotal = 0;
    let totalItems = 0;
    State.state.orderItems.forEach(item => {
        subtotal += item.price * item.quantity;
        totalItems += item.quantity;
    });

    validateAppliedDiscounts(subtotal);

    let totalDiscountAmount = 0;
    State.state.appliedDiscounts.forEach(d => {
        totalDiscountAmount += d.amount * d.quantity;
    });

    DOM.orderItemCount.textContent = totalItems;
    DOM.orderSubtotal.textContent = formatCurrency(subtotal);
    
    updateDiscountButton(totalDiscountAmount); 
    updateFinalTotalDisplay(subtotal, totalDiscountAmount);
}

export function updateFinalTotalDisplay(subtotal, totalDiscountAmount) {
    if (subtotal === undefined) {
        subtotal = State.state.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }
    if (totalDiscountAmount === undefined) {
        totalDiscountAmount = State.state.appliedDiscounts.reduce((acc, d) => acc + (d.amount * d.quantity), 0);
    }
    
    const finalTotal = subtotal - totalDiscountAmount; 
    DOM.orderFinalTotal.textContent = formatCurrency(finalTotal);
    DOM.checkoutBtn.textContent = `結帳 (${formatCurrency(finalTotal)})`;
    DOM.checkoutBtn.dataset.total = finalTotal.toFixed(0); 
    DOM.checkoutBtn.disabled = State.state.orderItems.length === 0;
}

export function clearOrder(force = false) {
    if (!force && State.state.orderItems.length > 0) {
        if (!confirm('確定要清空整筆訂單嗎？')) {
            return;
        }
    }
    State.setOrderItems([]);
    State.setAppliedDiscounts([]); 
    State.setCurrentHeldOrderName(null); 
    
    renderOrderItems();
    updateOrderTotals(); 
    console.log('🗑️ 訂單已清空');
}