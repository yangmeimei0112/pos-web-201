/*
 * ====================================================================
 * [V42.3] 前台 全域狀態 (state.js)
 * ====================================================================
 */
export const state = {
    currentEmployee: null,
    allProducts: [], 
    activeCategory: 'ALL',
    orderItems: [], 
    availableDiscounts: [], 
    appliedDiscounts: [], 
    heldOrders: [], 
    currentHeldOrderName: null, 
    lowStockItems: [], 
    productLoadInterval: null
};

// --- State Setters ---
// (使用函數來修改狀態，確保一致性)

export function setCurrentEmployee(employee) {
    state.currentEmployee = employee;
}

export function setAllProducts(products) {
    state.allProducts = products;
}

export function setActiveCategory(category) {
    state.activeCategory = category;
}

export function setOrderItems(items) {
    state.orderItems = items;
}

export function setAvailableDiscounts(discounts) {
    state.availableDiscounts = discounts;
}

export function setAppliedDiscounts(discounts) {
    state.appliedDiscounts = discounts;
}

export function setHeldOrders(orders) {
    state.heldOrders = orders;
}

export function setCurrentHeldOrderName(name) {
    state.currentHeldOrderName = name;
}

export function setLowStockItems(items) {
    state.lowStockItems = items;
}

export function setProductLoadInterval(interval) {
    state.productLoadInterval = interval;
}

// --- State Getters (方便存取) ---

export const getProductById = (id) => {
    return state.allProducts.find(p => p.id === id);
};