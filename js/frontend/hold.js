/*
 * ====================================================================
 * [V44.0] 前台 暫掛模組 (hold.js)
 * - [V44.0] 重構為單一 Modal 介面
 * ====================================================================
 */
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { clearOrder, renderOrderItems, updateOrderTotals } from './order.js';

const HELD_ORDERS_KEY = 'posHeldOrders';

export function loadHeldOrdersFromStorage() {
    const storedOrders = localStorage.getItem(HELD_ORDERS_KEY);
    State.setHeldOrders(storedOrders ? JSON.parse(storedOrders) : []);
    updateHeldOrderCount();
}
function saveHeldOrders() {
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(State.state.heldOrders));
    updateHeldOrderCount();
}
export function updateHeldOrderCount() {
    if (State.state.heldOrders.length > 0) {
        DOM.heldOrderCount.textContent = State.state.heldOrders.length;
        DOM.heldOrderCount.classList.remove('hidden');
    } else {
        DOM.heldOrderCount.classList.add('hidden');
    }
}

/**
 * [V44.0] 渲染 Modal 內的列表
 */
function renderHeldOrderList() {
    DOM.heldOrderListContainer.innerHTML = '';
    if (State.state.heldOrders.length === 0) {
        DOM.heldOrderListContainer.innerHTML = '<p class="empty-order-message">沒有暫掛中的訂單</p>';
    } else {
        State.state.heldOrders.forEach((order, index) => {
            const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
            const subtotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const discountTotal = (order.discounts || []).reduce((acc, d) => acc + (d.amount * d.quantity), 0);
            const total = subtotal - discountTotal;

            const itemEl = document.createElement('div');
            itemEl.className = 'held-order-item';
            itemEl.innerHTML = `
                <div>
                    <div class="held-order-name">${order.name}</div>
                    <div class="held-order-info">${itemCount} 個品項, 總計 ${formatCurrency(total)}</div>
                </div>
                <div class="held-order-actions">
                    <button class="btn-danger delete-held-btn" data-index="${index}" title="刪除此暫掛單">
                        <i class="fas fa-trash-alt"></i> 刪除
                    </button>
                    <button class="btn-primary retrieve-held-btn" data-index="${index}">
                        取回
                    </button>
                </div>
            `;
            DOM.heldOrderListContainer.appendChild(itemEl);
        });
    }
}

/**
 * [V44.0] 開啟 "暫掛/取單" 視窗 (取代舊的 handleHoldOrder 和 showRetrieveModal)
 */
export function openHoldRetrieveModal() {
    // 1. 根據目前訂單狀態，決定 "暫掛" 功能是否可用
    if (State.state.orderItems.length === 0) {
        // 沒有訂單，禁用暫掛區
        DOM.holdOrderInputSection.setAttribute('disabled', true);
        DOM.holdOrderNameInput.value = "目前訂單為空";
    } else {
        // 有訂單，啟用暫掛區
        DOM.holdOrderInputSection.removeAttribute('disabled');
        DOM.holdOrderError.classList.add('hidden');
        // 預填名稱
        DOM.holdOrderNameInput.value = State.state.currentHeldOrderName || `訂單 ${State.state.heldOrders.length + 1}`;
    }
    
    // 2. 渲染 "取單" 列表
    renderHeldOrderList();
    
    // 3. 開啟 Modal
    DOM.holdRetrieveModal.classList.add('active');
}

/**
 * [V44.0] 關閉 Modal
 */
export function closeHoldRetrieveModal() {
    DOM.holdRetrieveModal.classList.remove('active');
}

/**
 * [V44.0] 處理 Modal 內 "儲存目前訂單" 按鈕
 */
export function handleSaveHeldOrderClick() {
    const holdName = DOM.holdOrderNameInput.value.trim();
    if (!holdName) {
        DOM.holdOrderError.classList.remove('hidden');
        return;
    }
    DOM.holdOrderError.classList.add('hidden');

    // 檢查名稱是否重複
    if (State.state.heldOrders.some(order => order.name === holdName)) {
        if (!confirm(`已有名為 "${holdName}" 的暫掛單，您要覆蓋它嗎？`)) {
            return;
        }
        // 刪除舊的
        const index = State.state.heldOrders.findIndex(order => order.name === holdName);
        State.state.heldOrders.splice(index, 1);
    }
    
    const newHold = {
        name: holdName,
        items: State.state.orderItems,
        discounts: State.state.appliedDiscounts
    };
    State.state.heldOrders.push(newHold);
    saveHeldOrders();
    
    alert(`訂單 "${holdName}" 已暫掛！`);
    clearOrder(true);
    closeHoldRetrieveModal();
}

/**
 * [V44.0] 處理 Modal 內 "列表" 的點擊 (取單 / 刪除)
 */
export function handleRetrieveModalClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const index = parseInt(target.dataset.index, 10);
    if (isNaN(index)) return;

    if (target.classList.contains('retrieve-held-btn')) {
        // 點擊 "取回"
        if (State.state.orderItems.length > 0) {
            if (!confirm("您目前有未結帳的訂單，取回訂單將會覆蓋它。確定要繼續嗎？")) {
                return;
            }
        }
        
        const retrievedOrder = State.state.heldOrders.splice(index, 1)[0]; 
        if (!retrievedOrder) return; 
        
        saveHeldOrders(); 

        State.setOrderItems(retrievedOrder.items);
        State.setAppliedDiscounts(retrievedOrder.discounts || []);
        State.setCurrentHeldOrderName(retrievedOrder.name); 

        alert(`訂單 "${retrievedOrder.name}" 已取回並可編輯。\n(此暫掛單已從列表移除)`);

        renderOrderItems();
        updateOrderTotals(); 
        closeHoldRetrieveModal();

    } else if (target.classList.contains('delete-held-btn')) {
        // 點擊 "刪除"
        const orderName = State.state.heldOrders[index].name;
        if (confirm(`確定要永久刪除暫掛訂單 "${orderName}" 嗎？`)) {
            State.state.heldOrders.splice(index, 1);
            saveHeldOrders();
            renderHeldOrderList(); // 僅刷新列表
        }
    }
}