/*
 * ====================================================================
 * [V42.3] 前台 商品模組 (products.js)
 * [V43.2] 修正 import 路徑
 * ====================================================================
 */
// [V43.2] 修正 import 路徑
import { supabase } from '../supabaseClient.js';
import * as DOM from './dom.js';
import * as State from './state.js';
import { formatCurrency } from './utils.js';
import { addItemToOrder } from './order.js';
import { updateStockWarningBell } from './warnings.js';

export async function loadProducts() {
    const isInitialLoad = State.state.allProducts.length === 0;
    
    if (isInitialLoad) {
        DOM.productLoadingMessage.style.display = 'block'; 
        DOM.productList.innerHTML = ''; 
    }
    
    State.setLowStockItems([]); 
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, price, stock, category, is_active, sort_order, warning_threshold')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }) 
            .order('id', { ascending: true });
            
        if (isInitialLoad) {
            DOM.productLoadingMessage.style.display = 'none';
        }
        if (error) throw error;
        
        if (!isInitialLoad && JSON.stringify(State.state.allProducts) === JSON.stringify(data)) {
            return; 
        }
        
        State.setAllProducts(data); 
        
        data.forEach(product => {
            if (product.warning_threshold !== null && product.warning_threshold >= 0) {
                if (product.stock <= product.warning_threshold) {
                    State.state.lowStockItems.push(product); // 直接修改
                }
            }
        });
        updateStockWarningBell(); 

        if (isInitialLoad) {
            renderCategories(data); 
        }
        renderProducts(State.state.activeCategory); 

    } catch (err) {
        console.error('載入商品時發生錯誤:', err);
        if (isInitialLoad) {
            DOM.productLoadingMessage.style.display = 'none';
            DOM.productList.innerHTML = `<p style="color:red; text-align:center;">載入商品資料失敗！請檢查 RLS 權限。</p>`;
        }
    }
}

export function renderCategories(products) {
    const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];
    DOM.categoryTabs.innerHTML = '';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.classList.add('category-button');
        if (category === State.state.activeCategory) {
            button.classList.add('active');
        }
        button.textContent = category === 'ALL' ? '全部' : category;
        button.dataset.category = category;
        button.addEventListener('click', () => {
            State.setActiveCategory(category);
            document.querySelectorAll('.category-button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === category);
            });
            renderProducts(category);
        });
        DOM.categoryTabs.appendChild(button);
    });
}

export function renderProducts(category) {
    let filteredProducts = (category === 'ALL')
        ? State.state.allProducts
        : State.state.allProducts.filter(p => p.category === category);
    
    DOM.productList.innerHTML = '';
    if (filteredProducts.length === 0) {
        DOM.productList.innerHTML = `<p style="text-align:center; padding: 20px; color: #777;">此分類下沒有商品。</p>`;
        return;
    }
    
    filteredProducts.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const card = document.createElement('div');
        card.classList.add('product-card');
        if (isOutOfStock) {
            card.classList.add('out-of-stock');
        }
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p class="price">${formatCurrency(product.price)}</p>
            <p class="stock-status">
                ${isOutOfStock ? '<i class="fas fa-times-circle"></i> 缺貨' : `<i class="fas fa-check-circle"></i> 庫存: ${product.stock}`}
            </p>
        `;
        if (!isOutOfStock) {
            card.addEventListener('click', () => addItemToOrder(product));
        }
        DOM.productList.appendChild(card);
    });
}