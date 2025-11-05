/*
 * ====================================================================
 * [V47.0] 前台 結帳模組 (checkout.js)
 * - [V46.0] 新增 showCheckoutSuccess / closeCheckoutSuccess 函數
 * - [V47.0] 修正 V46.0 中 showCheckoutSuccess 的錯字 (formatCSSCurrency)
 * ====================================================================
 */
import { supabase } from '../supabaseClient.js';
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { clearOrder } from './order.js';
import { loadProducts } from './products.js';
import { showCustomAlert } from './alert.js'; 

let successResolve = null; 

/**
 * [V46.0] 顯示精美的結帳成功視窗
 */
export function showCheckoutSuccess(orderId, total, paid, change) {
    return new Promise((resolve) => {
        // 1. 填入收據資訊
        DOM.successOrderId.textContent = `訂單號碼: #${orderId}`;
        DOM.successTotal.textContent = formatCurrency(total);
        DOM.successPaid.textContent = formatCurrency(paid);
        // [V47.0] 修正 V46.0 錯字
        DOM.successChange.textContent = formatCurrency(change); 
        
        // 2. 儲存 resolve
        successResolve = resolve;

        // 3. 顯示視窗
        DOM.checkoutSuccessModal.classList.add('active');
        
        // 4. 聚焦確認按鈕
        setTimeout(() => DOM.successModalConfirm.focus(), 50);
    });
}

/**
 * [V46.0] 關閉結帳成功視窗
 */
export function closeCheckoutSuccess() {
    if (!DOM.checkoutSuccessModal.classList.contains('active')) return;

    DOM.checkoutSuccessModal.classList.remove('active');
    if (successResolve) {
        successResolve();
        successResolve = null;
    }
}

export function showCheckoutModal() {
    if (State.state.orderItems.length === 0) return;
    const totalAmount = parseFloat(DOM.checkoutBtn.dataset.total || 0);
    if (isNaN(totalAmount)) return;
    
    DOM.summaryTotalAmount.textContent = formatCurrency(totalAmount);
    DOM.paidAmountInput.value = totalAmount.toFixed(0);
    DOM.summaryChangeAmount.textContent = formatCurrency(0);
    DOM.checkoutErrorMessage.textContent = '';
    DOM.checkoutErrorMessage.classList.add('hidden');
    DOM.finalConfirmBtn.disabled = false;
    DOM.finalConfirmBtn.textContent = '確認結帳'; 
    DOM.checkoutModal.classList.add('active');
    
    setTimeout(() => {
        DOM.paidAmountInput.focus(); 
        DOM.paidAmountInput.select(); 
    }, 100); 
    handlePaymentInput(); 
}

export function handlePaymentInput() {
    const totalAmount = parseFloat(DOM.checkoutBtn.dataset.total || 0);
    const paidAmount = parseFloat(DOM.paidAmountInput.value) || 0;
    const change = paidAmount - totalAmount;
    DOM.summaryChangeAmount.textContent = formatCurrency(change);
    
    if (paidAmount < totalAmount || isNaN(paidAmount)) {
        DOM.checkoutErrorMessage.textContent = '支付金額不足！';
        DOM.checkoutErrorMessage.classList.remove('hidden');
        DOM.finalConfirmBtn.disabled = true;
    } else {
        DOM.checkoutErrorMessage.classList.add('hidden');
        DOM.finalConfirmBtn.disabled = false;
    }
}

export async function processCheckout() {
    if (!State.state.currentEmployee) {
        await showCustomAlert('錯誤：未選擇值班員工！', '錯誤');
        return;
    }
    if (DOM.finalConfirmBtn.disabled) return; 

    DOM.finalConfirmBtn.disabled = true;
    DOM.finalConfirmBtn.textContent = '處理中...';

    const totalAmount = parseFloat(DOM.checkoutBtn.dataset.total);
    const employeeId = State.state.currentEmployee.id;
    const paidAmount = parseFloat(DOM.paidAmountInput.value) || 0;
    const changeAmount = Math.max(0, paidAmount - totalAmount);

    const rpcItemsPayload = State.state.orderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || "" 
    }));

    const rpcDiscountsPayload = State.state.appliedDiscounts.map(d => ({
        discount_id: d.id,
        name: d.name,
        amount: d.amount,
        quantity: d.quantity
    }));

    try {
        const { data: newOrderId, error } = await supabase.rpc('fn_process_checkout', {
            p_employee_id: employeeId,
            p_total_amount: totalAmount,
            p_paid_amount: paidAmount,
            p_change_amount: changeAmount,
            p_items: rpcItemsPayload,
            p_discounts: rpcDiscountsPayload
        });

        if (error) throw error; 

        if (newOrderId === -1 || !newOrderId) {
             throw new Error("資料庫回傳結帳失敗，可能是庫存不足或商品不存在。");
        }

        DOM.checkoutModal.classList.remove('active');
        await showCheckoutSuccess(newOrderId, totalAmount, paidAmount, changeAmount);

        clearOrder(true); 
        await loadProducts(); 

    } catch (err) {
        console.error('結帳過程中發生錯誤:', err);
        
        let alertMessage = `結帳失敗：${err.message}\n請稍後再試或聯繫管理員。`;
        if (err.message.includes("庫存不足")) {
             const match = err.message.match(/EXCEPTION: (.*)/);
             if (match && match[1]) {
                 alertMessage = `結帳失敗：\n${match[1]}\n\n訂單未成立，請返回修改訂單。`;
             } else {
                 alertMessage = "結帳失敗：商品庫存不足！\n訂單未成立，請返回修改訂單。";
             }
             await loadProducts(); 
        }
        
        // [V47.0] 失敗時使用 V45.0 的 alert (現在已是紅色樣式)
        await showCustomAlert(alertMessage, "結帳失敗");

    } finally {
        DOM.finalConfirmBtn.disabled = false;
        DOM.finalConfirmBtn.textContent = '確認結帳';
    }
}