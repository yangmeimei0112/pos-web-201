/*
 * ====================================================================
 * [V42.1] 後台 員工管理 (employees.js)
 * ====================================================================
 */
import { supabase as db } from '../supabaseClient.js';
import * as DOM from './dom.js';
import { showEmployeeModal } from './ui.js';

export async function loadEmployees(isRealtimeCall = false) { 
    if (isRealtimeCall) {
        const activeSection = document.querySelector('.management-section.active');
        if (!activeSection || activeSection.id !== 'employee-management-section') {
            console.log("[Realtime] 收到 employees 刷新，但目前不在員工頁，跳過。");
            return;
        }
    }

    try { 
        const { data, error } = await db.from('employees').select('*').order('id', { ascending: true }); 
        if (error) throw error; 
        renderEmployeeTable(data); 
    } catch (err) { 
        console.error("載入員工時發生錯誤:", err); 
        DOM.employeeTableBody.innerHTML = `<tr><td colspan="6" class="loading-message error">資料載入失败: ${err.message}</td></tr>`; 
    }
}
export function renderEmployeeTable(employees) { 
    if (!employees || employees.length === 0) { 
        DOM.employeeTableBody.innerHTML = '<tr><td colspan="6" class="loading-message">目前沒有任何員工資料。</td></tr>'; 
        return; 
    } 
    DOM.employeeTableBody.innerHTML = ''; 
    employees.forEach(emp => { 
        const row = document.createElement('tr'); 
        const statusText = emp.is_active ? '<span class="status-active">✔ 在職中</span>' : '<span class="status-inactive">✘ 已停用</span>'; 
        const toggleActiveButton = emp.is_active 
            ? `<button class="btn-secondary deactivate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">停用</button>` 
            : `<button class="btn-primary activate-employee-btn" data-id="${emp.id}" style="padding: 5px 10px; font-size: 0.9em; margin-right: 5px;">啟用</button>`; 
        
        row.innerHTML = ` 
            <td>${emp.id}</td>
            <td>${emp.employee_name}</td>
            <td>${emp.employee_code}</td>
            <td>${emp.shift_preference || ''}</td>
            <td>${statusText}</td>
            <td> 
                <button class="btn-secondary edit-employee-btn" data-id="${emp.id}">編輯</button> 
                ${toggleActiveButton} 
                <button class="btn-danger delete-employee-btn" data-id="${emp.id}">刪除</button> 
            </td> 
        `; 
        DOM.employeeTableBody.appendChild(row); 
    });
}

export async function handleEmployeeFormSubmit(e) { 
    e.preventDefault(); 
    DOM.employeeFormErrorMessage.textContent = ''; 
    const saveBtn = document.getElementById('save-employee-btn'); 
    saveBtn.disabled = true; 
    saveBtn.textContent = '儲存中...'; 
    
    const formData = new FormData(DOM.employeeForm); 
    const employeeData = Object.fromEntries(formData.entries()); 
    const employeeId = employeeData.id; 
    employeeData.is_active = document.getElementById('employee-is-active').checked; 
    
    if (employeeData.shift_preference !== undefined) {
        employeeData.shift_preference = employeeData.shift_preference.trim() || null;
    }

    try { 
        let response; 
        if (employeeId) { 
            const { id, ...updateData } = employeeData; 
            response = await db.from('employees').update(updateData).eq('id', employeeId).select(); 
        } else { 
            delete employeeData.id; 
            response = await db.from('employees').insert([employeeData]).select(); 
        } 
        const { data, error } = response; 
        if (error) { throw error; } 
        console.log('員工儲存成功:', data); 
        DOM.employeeModal.classList.remove('active'); // [V42.1] 直接呼叫
        DOM.employeeForm.reset();
        await loadEmployees(); 
    } catch (err) { 
        console.error("儲存員工時發生錯誤:", err); 
        DOM.employeeFormErrorMessage.textContent = `儲存失敗: ${err.message}`; 
    } finally { 
        saveBtn.disabled = false; 
        saveBtn.textContent = '儲存'; 
    }
}
export async function handleToggleEmployeeActive(id, newActiveState) { 
    const actionText = newActiveState ? '啟用' : '停用'; if (!confirm(`您確定要 ${actionText} ID 為 ${id} 的員工嗎？\n(這將影響他們能否登入前台)`)) { return; } 
    try { const { error } = await db.from('employees').update({ is_active: newActiveState }).eq('id', id); if (error) { if (error.code === '23503') { alert(`${actionText} 失敗：此員工可能仍被歷史訂單關聯中。`); } else { throw error; } } else { console.log(`員工 ${id} ${actionText} 成功`); 
        await loadEmployees();
    } } catch (err) { console.error(`員工 ${actionText} 時發生錯誤:`, err); alert(`${actionText} 失敗: ${err.message}`); }
}
export async function handleEmployeeDelete(id) { 
    if (!confirm(`您確定要「永久刪除」ID 為 ${id} 的員工嗎？\n\n警告：此操作無法復原。\n如果該員工已有訂單紀錄，請改用「停用」功能。`)) { return; } 
    try { const { error } = await db.from('employees').delete().eq('id', id); if (error) { if (error.code === '23503') { alert(`刪除失敗：該員工已有歷史訂單紀錄，無法永久刪除。\n\n提示：請使用「停用」功能來取代。`); } else { throw error; } } else { console.log(`員工 ${id} 刪除成功`); 
        await loadEmployees();
    } } catch (err) { console.error("刪除員工時發生未預期的錯誤:", err); alert(`刪除失敗: ${err.message}`); }
}
export async function handleEmployeeTableClick(e) { 
    const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (!id) return; if (target.classList.contains('edit-employee-btn')) { const { data, error } = await db.from('employees').select('*').eq('id', id).single(); if (error) { alert(`查詢員工資料失敗: ${error.message}`); return; } showEmployeeModal(data); } if (target.classList.contains('deactivate-employee-btn')) { await handleToggleEmployeeActive(id, false); } if (target.classList.contains('activate-employee-btn')) { await handleToggleEmployeeActive(id, true); } if (target.classList.contains('delete-employee-btn')) { await handleEmployeeDelete(id); }
}