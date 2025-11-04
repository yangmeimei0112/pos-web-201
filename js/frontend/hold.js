/*
 * ====================================================================
 * [V42.3] 前台 暫掛模組 (hold.js)
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

export function handleHoldOrder() {
    if (State.state.orderItems.length === 0) {
        alert("目前訂單為空，無需暫掛。");
        return;
    }
    const defaultName = State.state.currentHeldOrderName || `訂單 ${State.state.heldOrders.length + 1}`;
    let holdName = prompt("請為這筆暫掛訂單命名:", defaultName);
    
    if (holdName) {
        holdName = holdName.trim();
        const newHold = {
            name: holdName,
            items: State.state.orderItems,
            discounts: State.state.appliedDiscounts
        };
        State.state.heldOrders.push(newHold);
        saveHeldOrders();
        alert(`訂單 "${holdName}" 已暫掛！`);
        clearOrder(true);
    }
}

export function showRetrieveModal() {
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
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="btn-primary retrieve-held-btn" data-index="${index}">
                        取回
                    </button>
                </div>
            `;
            DOM.heldOrderListContainer.appendChild(itemEl);
        });
    }
    DOM.retrieveOrderModal.classList.add('active');
}

export function hideRetrieveModal() {
    DOM.retrieveOrderModal.classList.remove('active');
}

export function handleRetrieveModalClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const index = parseInt(target.dataset.index, 10);
    if (isNaN(index)) return;

    if (target.classList.contains('retrieve-held-btn')) {
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
        hideRetrieveModal();

    } else if (target.classList.contains('delete-held-btn')) {
        const orderName = State.state.heldOrders[index].name;
        if (confirm(`確定要永久刪除暫掛訂單 "${orderName}" 嗎？`)) {
            State.state.heldOrders.splice(index, 1);
            saveHeldOrders();
            showRetrieveModal();
        }
    }
}