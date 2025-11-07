/*
 * ====================================================================
 * [V56.1] 共用工具 (utils.js)
 * - [V56.1] 移除 'random' 函數 (它只應存在於 frontend/utils.js)
 * ====================================================================
 */

export const formatCurrency = (amount) => {
    if (amount === null || isNaN(amount)) return 'N/A';
    if (String(amount).includes('.')) {
        return `NT$ ${parseFloat(amount).toFixed(1)}`;
    }
    return `NT$ ${parseFloat(amount).toFixed(0)}`;
}

export const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
        return new Date(isoString).toLocaleString('zh-Hant', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString; 
    }
};

export function animateValue(element, start, end, duration, isCurrency = false, isDecimal = false) {
    if (start === end) {
        if (isCurrency) {
            if (isDecimal) {
                element.textContent = `NT$ ${end.toFixed(1)}`;
            } else {
                element.textContent = `NT$ ${Math.floor(end)}`;
            }
        } else {
            element.textContent = Math.floor(end);
        }
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let currentValue = progress * (end - start) + start;
        if (isCurrency) {
            if (isDecimal) {
                element.textContent = `NT$ ${currentValue.toFixed(1)}`;
            } else {
                element.textContent = `NT$ ${Math.floor(currentValue)}`;
            }
        } else {
            element.textContent = Math.floor(currentValue);
        }
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
             if (isCurrency) {
                if (isDecimal) {
                    element.textContent = `NT$ ${end.toFixed(1)}`;
                } else {
                    element.textContent = `NT$ ${Math.floor(end)}`;
                }
            } else {
                element.textContent = Math.floor(end);
            }
        }
    };
    window.requestAnimationFrame(step);
}