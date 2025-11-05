/*
 * ====================================================================
 * [V42.3] 前台 折扣模組 (discounts.js)
 * [V43.2] 修正 import 路徑
 * ====================================================================
 */
// [V43.2] 修正 import 路徑
import { supabase } from '../supabaseClient.js';
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { updateOrderTotals, updateFinalTotalDisplay } from './order.js';

export async function loadDiscounts() {
    try {
        const { data, error } = await supabase
            .from('discounts')
            .select('id, name, amount, target_category, target_product_id')
            .eq('is_active', true) 
            .order('amount', { ascending: true }); 
        if (error) throw error;
        State.setAvailableDiscounts(data || []);
        console.log('✅ 折扣(V41.2)載入成功:', State.state.availableDiscounts);
    } catch (err) {
        console.error('載入折扣時發生錯誤:', err);
        State.setAvailableDiscounts([]);
    }
}

export function isDiscountApplicable(discount, orderItems, subtotal) {
    if (discount.amount > subtotal && subtotal > 0) {
        return { applicable: false, reason: "折扣金額大於小計" };
    }
    if (discount.target_product_id) {
        const hasTargetProduct = orderItems.some(item => item.product_id === discount.target_product_id);
        if (hasTargetProduct) {
            return { applicable: true, reason: "" };
        } else {
            return { applicable: false, reason: `需購買 ID:${discount.target_product_id} 商品` };
        }
    }
    if (discount.target_category) {
        const hasTargetCategory = orderItems.some(item => item.category === discount.target_category);
        if (hasTargetCategory) {
            return { applicable: true, reason: "" };
        } else {
            return { applicable: false, reason: `需購買 ${discount.target_category} 分類商品` };
        }
    }
    return { applicable: true, reason: "" };
}

export function renderAvailableDiscounts() {
    DOM.applicableDiscountsList.innerHTML = '';
    DOM.inapplicableDiscountsList.innerHTML = '';
    
    const subtotal = State.state.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    State.state.availableDiscounts.forEach(discount => {
        const { applicable, reason } = isDiscountApplicable(discount, State.state.orderItems, subtotal);
        const applied = State.state.appliedDiscounts.find(d => d.id === discount.id);
        const currentQuantity = applied ? applied.quantity : 0;

        const targetText = discount.target_product_id 
            ? `(限 ID:${discount.target_product_id})` 
            : (discount.target_category ? `(限 ${discount.target_category})` : '(全單適用)');

        const itemHtml = `
            <div class="discount-item ${applicable ? '' : 'disabled'}">
                <div class="discount-info">
                    <span class="discount-name">${discount.name}</span>
                    <span class="discount-amount">-${formatCurrency(discount.amount)}</span>
                    <div class="discount-target">${targetText}</div>
                </div>
                
                ${applicable ? `
                    <div class="discount-controls">
                        <button class="qty-btn decrease-btn" data-id="${discount.id}" ${currentQuantity === 0 ? 'disabled' : ''}>-</button>
                        <span class="discount-quantity">${currentQuantity}</span>
                        <button class="qty-btn increase-btn" data-id="${discount.id}">+</button>
                    </div>
                ` : `
                    <div class="discount-reason">${reason}</div>
                `}
            </div>
        `;

        if (applicable) {
            DOM.applicableDiscountsList.innerHTML += itemHtml;
        } else {
            DOM.inapplicableDiscountsList.innerHTML += itemHtml;
        }
    });
}

export function handleDiscountAdd(discountId) {
    const discount = State.state.availableDiscounts.find(d => d.id === discountId);
    if (!discount) return;

    const appliedIndex = State.state.appliedDiscounts.findIndex(d => d.id === discountId);
    
    if (appliedIndex > -1) {
        State.state.appliedDiscounts[appliedIndex].quantity += 1;
    } else {
        State.state.appliedDiscounts.push({
            id: discount.id,
            name: discount.name,
            amount: discount.amount,
            quantity: 1
        });
    }
    
    renderAvailableDiscounts();
    updateDiscountModalTotals();
}

export function handleDiscountRemove(discountId) {
    const appliedIndex = State.state.appliedDiscounts.findIndex(d => d.id === discountId);
    if (appliedIndex === -1) return;

    State.state.appliedDiscounts[appliedIndex].quantity -= 1;

    if (State.state.appliedDiscounts[appliedIndex].quantity === 0) {
        State.state.appliedDiscounts.splice(appliedIndex, 1);
    }
    
    renderAvailableDiscounts();
    updateDiscountModalTotals();
}

export function updateDiscountModalTotals() {
    const subtotal = State.state.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalDiscountAmount = State.state.appliedDiscounts.reduce((acc, d) => acc + (d.amount * d.quantity), 0);
    const finalTotal = subtotal - totalDiscountAmount;

    DOM.modalSubtotal.textContent = formatCurrency(subtotal);
    DOM.modalDiscountTotal.textContent = `- ${formatCurrency(totalDiscountAmount)}`;
    DOM.modalFinalTotal.textContent = formatCurrency(finalTotal);
}

export function validateAppliedDiscounts(subtotal) {
    let discountsRemoved = false;
    for (let i = State.state.appliedDiscounts.length - 1; i >= 0; i--) {
        const applied = State.state.appliedDiscounts[i];
        const definition = State.state.availableDiscounts.find(d => d.id === applied.id);
        
        if (!definition) {
            State.state.appliedDiscounts.splice(i, 1);
            discountsRemoved = true;
            continue;
        }

        const { applicable } = isDiscountApplicable(definition, State.state.orderItems, subtotal);
        if (!applicable) {
            State.state.appliedDiscounts.splice(i, 1);
            discountsRemoved = true;
        }
    }
    
    if (discountsRemoved) {
        alert("訂單變更導致部分折扣已不適用，系統已自動移除。");
    }
}

export function updateDiscountButton(totalDiscountAmount) {
    if (totalDiscountAmount > 0) {
        DOM.orderDiscount.innerHTML = `
            <span id="discount-summary-text" class="discount-summary-text" title="點擊以編輯折扣">
                - ${formatCurrency(totalDiscountAmount)}
            </span>
        `;
        document.getElementById('discount-summary-text').addEventListener('click', openDiscountModal);
    } else {
        DOM.orderDiscount.innerHTML = `
            <button id="open-discount-modal-btn" class="discount-button" ${State.state.orderItems.length === 0 ? 'disabled' : ''}>
                <i class="fas fa-tags"></i> 套用折扣
            </button>
        `;
        // [V43.2] 修正：必須綁定到 DOM.orderDiscount 上才能抓到動態按鈕
        DOM.orderDiscount.querySelector('#open-discount-modal-btn')?.addEventListener('click', openDiscountModal);
    }
}

export function openDiscountModal() {
    if (State.state.orderItems.length === 0) {
        alert("請先加入商品");
        return;
    }
    renderAvailableDiscounts();
    updateDiscountModalTotals();
    DOM.discountModal.classList.add('active');
}

export function closeDiscountModal() {
    DOM.discountModal.classList.remove('active');
    updateOrderTotals();
}