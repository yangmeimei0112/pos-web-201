/*
 * ====================================================================
 * [V51.0] 前台 Realtime (realtime.js)
 * - 監聽 products 和 discounts 表的變化
 * ====================================================================
 */
import { supabase } from '../supabaseClient.js';
import { loadProducts } from './products.js';
import { loadDiscounts } from './discounts.js';

let productChannel = null;
let discountChannel = null;

/**
 * [V51.0] 啟動前台 Realtime 監聽
 */
export function setupFrontendRealtime() {
    // 檢查是否已在監聽
    if (productChannel || discountChannel) {
        console.log("✅ [Realtime] 前台監聽已啟動。");
        return;
    }
    
    console.log("✅ [Realtime] 啟動前台即時監聽...");
    
    // 1. 監聽商品 (products)
    productChannel = supabase.channel('public:products:frontend')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'products' },
            (payload) => {
                console.log('🔄 [Realtime] 偵測到 products 變更，重新載入商品...');
                // 傳入 true 強制刷新，忽略快取
                loadProducts(true); 
            }
        ).subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('✅ [Realtime] 已訂閱商品');
        });

    // 2. 監聽折扣 (discounts)
    discountChannel = supabase.channel('public:discounts:frontend')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'discounts' },
            (payload) => {
                console.log('🔄 [Realtime] 偵測到 discounts 變更，重新載入折扣...');
                loadDiscounts(); 
            }
        ).subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('✅ [Realtime] 已訂閱折扣');
        });
}

/**
 * [V51.0] 停止前台 Realtime 監聽 (登出時)
 */
export function removeFrontendRealtime() {
    console.log("⏹️ [Realtime] 停止前台即時監聽...");
    if (productChannel) {
        supabase.removeChannel(productChannel);
        productChannel = null;
    }
    if (discountChannel) {
        supabase.removeChannel(discountChannel);
        discountChannel = null;
    }
}