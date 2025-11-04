/*
 * ====================================================================
 * [V42.0] Supabase Client (共用連線檔)
 * ====================================================================
 * 此檔案集中管理 Supabase 連線，
 * 前台和後台的 JS 檔案將會 'import' 這個檔案中的 'supabase' 物件。
 * * 注意：所有 import 此檔案的 <script> 標籤都必須加上 type="module"
 */

// 從 CDN 取得 Supabase 的 createClient 函數
const { createClient } = window.supabase;

const SUPABASE_URL = "https://ojqstguuubieqgcufwwg.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qcXN0Z3V1dWJpZXFnY3Vmd3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Nzk4NjgsImV4cCI6MjA3NzA1NTg2OH0.n-gbI2qzyrVMHvmbchBHVDZ_7cLjWyLm4eUTrwit1-c";

if (!createClient) {
    console.error("❌ Supabase CDN 尚未載入。");
    alert("系統初始化失敗，請檢查網路連線後重試。");
}

// 建立並匯出 (export) Supabase client 實例
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase Client (V42.0) 已初始化 🚀");