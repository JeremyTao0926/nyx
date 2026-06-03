import { useState, useEffect } from "react";
import { getAuditLog } from "./adminUtils";

export function AdminAuditLog({ C }: { C: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog(100).then(d => { setLogs(d); setLoading(false); });
  }, []);

  const ACTION_LABELS: Record<string,string> = {
    ban_user:"封禁用戶", unban_user:"解封用戶", mark_test_account:"標記測試",
    delete_test_data:"清除測試數據", resolve_report:"處理檢舉",
  };

  return (
    <div>
      <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6 }}>操作日誌</div>
      <div style={{ fontSize:13, color:C.textMuted, marginBottom:24 }}>所有管理員操作記錄</div>

      {loading ? <div style={{ color:C.textMuted }}>載入中...</div>
      : logs.length === 0 ? <div style={{ color:C.textMuted }}>還沒有記錄</div>
      : (
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", minWidth:480 }}>
            {logs.map((log, i) => (
              <div key={log.id} style={{ display:"grid", gridTemplateColumns:"160px 1fr 1fr 120px", gap:16, padding:"12px 18px", borderBottom:i<logs.length-1?`1px solid ${C.border}`:"none", alignItems:"center" }}>
                <div style={{ fontSize:12, color:C.textMuted }}>{new Date(log.created_at).toLocaleString("zh-TW", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
                <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{ACTION_LABELS[log.action] || log.action}</div>
                <div style={{ fontSize:12.5, color:C.textSub }}>
                  {log.admin?.display_name || log.admin?.username || log.admin_id?.slice(0,8)}
                </div>
                <div style={{ fontSize:11.5, color:C.textMuted }}>
                  {log.target_type}: {log.target_id?.slice(0,8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
