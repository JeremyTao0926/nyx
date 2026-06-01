import { useState, useEffect } from "react";
import { getPlatformStats } from "./adminUtils";
import type { PlatformStats, AdminRole } from "./adminUtils";

interface Props { role: AdminRole; C: any; }

function StatCard({ label, value, sub, color, C }: any) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
      <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, fontWeight:600, letterSpacing:".5px", textTransform:"uppercase" as const }}>{label}</div>
      <div style={{ fontSize:32, fontWeight:800, color:color||C.text }}>{value?.toLocaleString() ?? "—"}</div>
      {sub && <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export function AdminDashboard({ role, C }: Props) {
  const [stats, setStats]     = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const s = await getPlatformStats();
    setStats(s); setRefreshed(new Date()); setLoading(false);
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <div style={{ fontSize:24, fontWeight:800, color:C.text }}>平台總覽</div>
          {refreshed && <div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>最後更新：{refreshed.toLocaleTimeString()}</div>}
        </div>
        <button onClick={load} style={{ padding:"8px 18px", borderRadius:20, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          重新整理
        </button>
      </div>

      {loading ? (
        <div style={{ color:C.textMuted, padding:"40px 0" }}>載入中...</div>
      ) : !stats ? (
        <div style={{ color:C.rose }}>無法載入數據，請確認管理員權限</div>
      ) : (
        <>
          {/* User stats */}
          <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, marginBottom:14, letterSpacing:".5px", textTransform:"uppercase" as const }}>用戶數據</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14, marginBottom:28 }}>
            <StatCard label="真實用戶" value={stats.total_users} C={C} color={C.gold}/>
            <StatCard label="24小時活躍" value={stats.active_24h} sub={`佔總用戶 ${stats.total_users ? Math.round(stats.active_24h/stats.total_users*100) : 0}%`} C={C} color={C.mint}/>
            <StatCard label="7天活躍" value={stats.active_7d} C={C}/>
            <StatCard label="測試帳號" value={stats.test_users} C={C} color="rgba(245,237,214,0.4)"/>
            <StatCard label="封禁帳號" value={stats.banned_users} C={C} color={C.rose}/>
          </div>

          {/* Engagement */}
          <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, marginBottom:14, letterSpacing:".5px", textTransform:"uppercase" as const }}>互動數據</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14, marginBottom:28 }}>
            <StatCard label="總配對數" value={stats.total_matches} C={C}/>
            <StatCard label="今日新配對" value={stats.matches_today} C={C} color={C.gold}/>
            <StatCard label="今日訊息" value={stats.messages_today} C={C} color={C.mint}/>
            <StatCard label="真心話完成" value={stats.total_sparks} C={C}/>
            <StatCard label="今日真心話" value={stats.sparks_today} C={C}/>
          </div>

          {/* Moderation */}
          <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, marginBottom:14, letterSpacing:".5px", textTransform:"uppercase" as const }}>內容審核</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14 }}>
            <StatCard label="待處理檢舉" value={stats.pending_reports} C={C} color={stats.pending_reports > 0 ? C.rose : C.text}/>
          </div>
        </>
      )}
    </div>
  );
}
