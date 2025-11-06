/*
 * ====================================================================
 * [V50.3] 前台 折扣模組 (discounts.js)
 * - [V50.3] 支援 min_items_required (商品門檻) 邏輯
 * - [V50.3] loadDiscounts: 讀取 min_items_required
 * - [V50.3] renderAvailableDiscounts: 重寫，計算 maxUsable 並禁用 "+"
 * - [V50.3] validateAppliedDiscounts: 重寫，自動校正折扣數量
 * - [V50.3] handleDiscountAdd: 新增 maxUsable 檢查
 * ====================================================================
 */
import { supabase } from '../supabaseClient.js';
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { updateOrderTotals, updateFinalTotalDisplay } from './order.js';

export async function loadDiscounts() {
    try {
        const { data, error } = await supabase
            .from('discounts')
            // [V50.3] 讀取新欄位
            .select('id, name, amount, target_category, target_product_id, min_items_required')
            .eq('is_active', true) 
            .order('amount', { ascending: true }); 
        if (error) throw error;
        State.setAvailableDiscounts(data || []);
        console.log('✅ 折扣(V50.3)載入成功:', State.state.availableDiscounts);
    } catch (err) {
        console.error('載入折扣時發生錯誤:', err);
        State.setAvailableDiscounts([]);
    }
}

/**
 * [V50.3] (輔助函數) 
 * 根據折扣規則，計算訂單中有多少 "符合資格" 的商品
 */
function calculateApplicableItemCount(discount) {
    const orderItems = State.state.orderItems;
    
    // 規則 1: 適用單品
    if (discount.target_product_id) {
        const targetItem = orderItems.find(item => item.product_id === discount.target_product_id);
        return targetItem ? targetItem.quantity : 0;
    }
    
    // 規則 2: 適用分類
    if (discount.target_category) {
        return orderItems
            .filter(item => item.category === discount.target_category)
            .reduce((sum, item) => sum + item.quantity, 0);
    }
    
    // 規則 3: 全單適用
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * [V50.3] (核心邏輯修改)
 * 檢查單一折扣是否適用 (僅檢查規則，不檢查門檻)
 */
export function isDiscountApplicable(discount, applicableItemCount, subtotal) {
    // 規則 1: 折扣金額 > 小計 (且小計 > 0)
    if (discount.amount > subtotal && subtotal > 0) {
        return { applicable: false, reason: "折扣金額大於小計" };
    }

    // 規則 2: 門檻 (商品數)
    // 檢查 "符合資格" 的商品數是否 > 0
    if (applicableItemCount > 0) {
        return { applicable: true, reason: "" };
    }
    
    // 規則 3: 判斷失敗原因
    if (discount.target_product_id) {
        return { applicable: false, reason: `需購買 ID:${discount.target_product_id} 商品` };
    }
    if (discount.target_category) {
        return { applicable: false, reason: `需購買 ${discount.target_category} 分類商品` };
    }
    
    // 規則 4: 全單 (但訂單為空)
    return { applicable: false, reason: "訂單為空" };
}

/**
 * [V50.3] (核心邏輯重寫)
 * 重新渲染折扣 Modal 內的列表
 */
export function renderAvailableDiscounts() {
    DOM.applicableDiscountsList.innerHTML = '';
    DOM.inapplicableDiscountsList.innerHTML = '';
    
    const subtotal = State.state.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    State.state.availableDiscounts.forEach(discount => {
        // [V50.3] 1. 計算有多少商品符合此折扣規則
        const applicableItemCount = calculateApplicableItemCount(discount);
        
        // [V50.3] 2. 檢查是否 "可用" (滿足基礎條件)
        const { applicable, reason } = isDiscountApplicable(discount, applicableItemCount, subtotal);
        
        // [V50.3] 3. 計算 "最大可使用次數"
        const minItems = discount.min_items_required || 1;
        const maxUsable = Math.floor(applicableItemCount / minItems);
        
        const applied = State.state.appliedDiscounts.find(d => d.id === discount.id);
        const currentQuantity = applied ? applied.quantity : 0;

        // [V50.3] 4. 產生 UI 文字
        const targetText = discount.target_product_id 
            ? `(限 ID:${discount.target_product_id})` 
            : (discount.target_category ? `(限 ${discount.target_category})` : '(全單適用)');
        
        const minItemsText = minItems > 1 
            ? `(每 ${minItems} 件可使用 1 次)` 
            : ''; // 1 件時不顯示

        const itemHtml = `
            <div class="discount-item ${applicable ? '' : 'disabled'}">
                <div class="discount-info">
                    <span class="discount-name">${discount.name}</span>
                    <span class="discount-amount">-${formatCurrency(discount.amount)}</span>
                    <div class="discount-target">${targetText}</div>
                    <div class="discount-rule">${minItemsText}</div> </div>
                
                ${applicable ? `
                    <div class="discount-controls">
                        <button class="qty-btn decrease-btn" data-id="${discount.id}" ${currentQuantity === 0 ? 'disabled' : ''}>-</button>
                        <span class="discount-quantity">${currentQuantity}</span>
                        <button class="qty-btn increase-btn" data-id="${discount.id}" ${currentQuantity >= maxUsable ? 'disabled' : ''}>+</button>
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

/**
 * [V50.3] (核心邏輯修改)
 * 增加一個折扣的數量 (加入上限檢查)
 */
export function handleDiscountAdd(discountId) {
    const discount = State.state.availableDiscounts.find(d => d.id === discountId);
    if (!discount) return;

    // [V50.3] 重新計算最大可使用次數
    const applicableItemCount = calculateApplicableItemCount(discount);
    const minItems = discount.min_items_required || 1;
    const maxUsable = Math.floor(applicableItemCount / minItems);

    const appliedIndex = State.state.appliedDiscounts.findIndex(d => d.id === discountId);
    
    if (appliedIndex > -1) {
        // 已存在，檢查是否能 +1
        if (State.state.appliedDiscounts[appliedIndex].quantity < maxUsable) {
            State.state.appliedDiscounts[appliedIndex].quantity += 1;
        } else {
            console.warn(`折扣 ${discount.name} 已達最大使用次數 ${maxUsable}`);
        }
    } else {
        // 不存在，新增一筆 (前提是 maxUsable > 0)
        if (maxUsable > 0) {
            State.state.appliedDiscounts.push({
                id: discount.id,
                name: discount.name,
                amount: discount.amount,
                quantity: 1,
                min_items_required: minItems, // [V50.3] 儲存門檻
                target_category: discount.target_category,
                target_product_id: discount.target_product_id
            });
        }
    }
    
    renderAvailableDiscounts();
    updateDiscountModalTotals();
}

/**
 * 減少一個折扣的數量
 */
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

/**
 * 更新折扣 Modal 頁腳的即時總計
 */
export function updateDiscountModalTotals() {
    const subtotal = State.state.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalDiscountAmount = State.state.appliedDiscounts.reduce((acc, d) => acc + (d.amount * d.quantity), 0);
    const finalTotal = subtotal - totalDiscountAmount;

    DOM.modalSubtotal.textContent = formatCurrency(subtotal);
    DOM.modalDiscountTotal.textContent = `- ${formatCurrency(totalDiscountAmount)}`;
    DOM.modalFinalTotal.textContent = formatCurrency(finalTotal);
}

/**
 * [V50.3] (核心邏輯重寫)
 * 當訂單變動時，自動校正已套用的折扣 "數量"
 */
export function validateAppliedDiscounts(subtotal) {
    let discountsRemoved = false;
    let discountsAdjusted = false;

    for (let i = State.state.appliedDiscounts.length - 1; i >= 0; i--) {
        const applied = State.state.appliedDiscounts[i];
        
        // [V50.3] 1. 檢查折扣是否還存在
        const definition = State.state.availableDiscounts.find(d => d.id === applied.id);
        if (!definition) {
            State.state.appliedDiscounts.splice(i, 1);
            discountsRemoved = true;
            continue;
        }

        // [V50.3] 2. 重新計算最大可使用次數
        const applicableItemCount = calculateApplicableItemCount(definition);
        const minItems = definition.min_items_required || 1;
        const maxUsable = Math.floor(applicableItemCount / minItems);

        // [V50.3] 3. 檢查金額是否依然 > 小計
        if (definition.amount > subtotal && subtotal > 0) {
            State.state.appliedDiscounts.splice(i, 1);
            discountsRemoved = true;
            continue;
        }

        // [V50.3] 4. 檢查是否已不滿足門檻 (maxUsable = 0)
        if (maxUsable === 0) {
            State.state.appliedDiscounts.splice(i, 1);
            discountsRemoved = true;
        } 
        // [V50.3] 5. 檢查是否 "超過" 最大次數
        else if (applied.quantity > maxUsable) {
            applied.quantity = maxUsable; // 自動校正
            discountsAdjusted = true;
        }
    }
    
    if (discountsRemoved) {
        alert("訂單變更導致部分折扣已不適用，系統已自動移除。");
    } else if (discountsAdjusted) {
        alert("訂單變更導致部分折扣可使用次數減少，系統已自動校正。");
    }
}

/**
 * 更新主畫面的折扣按鈕
 */
export function updateDiscountButton(totalDiscountAmount) {
    if (totalDiscountAmount > 0) {
        DOM.orderDiscount.innerHTML = `
            <span id="discount-summary-text" class="discount-summary-text" title="點擊以編輯折扣">
                - ${formatCurrency(totalDiscountAmount)}
            </span>
        `;
        DOM.orderDiscount.querySelector('#discount-summary-text')?.addEventListener('click', openDiscountModal);
    } else {
        DOM.orderDiscount.innerHTML = `
            <button id="open-discount-modal-btn" class="discount-button" ${State.state.orderItems.length === 0 ? 'disabled' : ''}>
                <i class="fas fa-tags"></i> 套用折扣
            </button>
        `;
        DOM.orderDiscount.querySelector('#open-discount-modal-btn')?.addEventListener('click', openDiscountModal);
    }
}

/**
 * 開啟折扣 Modal
 */
export function openDiscountModal() {
    if (State.state.orderItems.length === 0) {
        alert("請先加入商品");
        return;
    }
    renderAvailableDiscounts();
    updateDiscountModalTotals();
    DOM.discountModal.classList.add('active');
}

/**
 * 關閉折扣 Modal
 */
export function closeDiscountModal() {
    DOM.discountModal.classList.remove('active');
    updateOrderTotals();
}