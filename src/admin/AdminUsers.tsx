import { useState, useEffect } from "react";
import { getUsers, banUser, unbanUser, markTestAccount, deleteTestData, canDo, getUserStats, disableUser, restoreUser, softDeleteUser, grantPremium } from "./adminUtils";
import type { UserRow, AdminRole } from "./adminUtils";

interface Props { tab: "users" | "test_data"; role: AdminRole; C: any; }

export function AdminUsers({ tab, role, C }: Props) {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const [testLabel, setTestLabel] = useState("");
  const [msg, setMsg] = useState("");

  const isTestTab = tab === "test_data";

  useEffect(() => { load(); }, [tab, search]);

  async function load() {
    setLoading(true);
    const opts = isTestTab ? { isTest: true, search } : { search, limit: 80 };
    const rows = await getUsers(opts);
    setUsers(rows); setLoading(false);
  }

  async function handleBan(u: UserRow) {
    if (!banReason.trim()) { setMsg("請填寫封禁原因"); return; }
    try {
      await banUser(u.id, banReason);
      setMsg("✓ 已封禁"); setBanReason(""); setSelected(null); load();
    } catch (e: any) { setMsg(e.message); }
  }

  async function handleUnban(u: UserRow) {
    try { await unbanUser(u.id); setMsg("✓ 已解封"); load(); } catch (e: any) { setMsg(e.message); }
  }

  async function handleGrantPremium(u: UserRow, plan: "premium" | "premium_plus" | null) {
    try {
      await grantPremium(u.id, plan);
      setMsg(plan ? `✓ 已授予 ${plan === "premium_plus" ? "Premium+" : "Premium"}` : "✓ 已移除 Premium");
      await load();
      // Refresh selected user data
      setSelected(prev => prev ? { ...prev, is_premium: plan !== null, premium_plan: plan } as any : prev);
    } catch (e: any) { setMsg(e.message); }
  }

  async function handleMarkTest(u: UserRow, isTest: boolean) {
    await markTestAccount(u.id, isTest, isTest ? testLabel : undefined);
    setMsg(isTest ? "✓ 已標記為測試帳號" : "✓ 已移除測試標記");
    setTestLabel(""); setSelected(null); load();
  }

  async function handleDeleteTestData(u: UserRow) {
    if (!confirm(`確定清除 ${u.display_name || u.username} 的所有測試數據？此操作不可逆。`)) return;
    try { await deleteTestData(u.id); setMsg("✓ 測試數據已清除"); load(); }
    catch (e: any) { setMsg(e.message); }
  }

  const INP = { padding:"9px 12px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, outline:"none", fontFamily:"inherit" };

  return (
    <div>
      <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6 }}>
        {isTestTab ? "測試數據管理" : "用戶管理"}
      </div>
      <div style={{ fontSize:13, color:C.textMuted, marginBottom:24 }}>
        {isTestTab ? "標記測試帳號、清除測試數據" : "查看用戶、封禁/解封"}
      </div>

      {msg && <div style={{ background:"rgba(0,201,167,0.1)", border:"1px solid rgba(0,201,167,0.25)", borderRadius:10, padding:"10px 14px", color:C.mint, fontSize:13, marginBottom:16 }} onClick={()=>setMsg("")}>{msg}</div>}

      {/* Search */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" as const }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋用戶名 / 電郵..."
          style={{ ...INP, flex:1 }}/>
        <button onClick={load} style={{ padding:"9px 18px", borderRadius:8, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>搜尋</button>
      </div>

      {/* Table */}
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", minWidth:520 }}>
        {/* Header — hidden on mobile */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 100px 140px", padding:"10px 16px", background:"rgba(255,255,255,0.03)", borderBottom:`1px solid ${C.border}` }} className="admin-table-header">
          {["用戶名","電郵","最後活躍","狀態","操作"].map(h => (
            <div key={h} style={{ fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:".5px", textTransform:"uppercase" as const }}>{h}</div>
          ))}
        </div>
        {loading ? <div style={{ padding:"24px", color:C.textMuted, fontSize:13 }}>載入中...</div>
        : users.length === 0 ? <div style={{ padding:"24px", color:C.textMuted, fontSize:13 }}>沒有找到用戶</div>
        : users.map(u => (
          <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 100px 140px", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, alignItems:"center" }}>
            <div>
              <div style={{ fontSize:13.5, color:C.text, fontWeight:500 }}>{u.display_name || u.username}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>@{u.username}</div>
              {u.is_test_account && <span style={{ fontSize:10, background:"rgba(74,144,217,0.15)", color:"#4A90D9", padding:"1px 7px", borderRadius:10, marginTop:3, display:"inline-block" }}>🧪 {u.test_label || "測試"}</span>}
            </div>
            <div style={{ fontSize:12.5, color:C.textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{u.email}</div>
            <div style={{ fontSize:12, color:C.textMuted }}>{u.last_active ? new Date(u.last_active).toLocaleDateString("zh-TW") : "從未"}</div>
            <div>
              {u.is_banned
                ? <span style={{ fontSize:11, background:"rgba(232,54,93,0.15)", color:C.rose, padding:"2px 8px", borderRadius:10 }}>封禁</span>
                : <span style={{ fontSize:11, background:"rgba(0,201,167,0.12)", color:C.mint, padding:"2px 8px", borderRadius:10 }}>正常</span>}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
              <button onClick={async () => { setSelected(u); const stats = await getUserStats(u.id); setUserStats(stats); }}
                style={{ fontSize:11, padding:"4px 10px", borderRadius:8, background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>
                詳情
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>{/* /overflowX */}

      {/* Detail panel */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }} onClick={()=>setSelected(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:480, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"28px", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>{selected.display_name || selected.username}</div>
            <div style={{ fontSize:12.5, color:C.textMuted, marginBottom:20 }}>ID: {selected.id}</div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              <div style={{ padding:"10px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                <div style={{ fontSize:11, color:C.textMuted }}>Email</div>
                <div style={{ fontSize:12, color:C.text }}>{selected.email}</div>
              </div>
              <div style={{ padding:"10px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                <div style={{ fontSize:11, color:C.textMuted }}>註冊時間</div>
                <div style={{ fontSize:12, color:C.text }}>{new Date(selected.created_at).toLocaleDateString("zh-TW")}</div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
              <div style={{ padding:"10px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                <div style={{ fontSize:11, color:C.textMuted }}>配對數</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.gold }}>{userStats?.matches ?? 0}</div>
              </div>
              <div style={{ padding:"10px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                <div style={{ fontSize:11, color:C.textMuted }}>訊息數</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.mint }}>{userStats?.messages ?? 0}</div>
              </div>
              <div style={{ padding:"10px", border:`1px solid ${C.border}`, borderRadius:10 }}>
                <div style={{ fontSize:11, color:C.textMuted }}>被檢舉</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.rose }}>{userStats?.reports ?? 0}</div>
              </div>
            </div>

            {selected.is_banned && (
              <div style={{ background:"rgba(232,54,93,0.1)", border:"1px solid rgba(232,54,93,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.rose, fontWeight:700 }}>已封禁</div>
                <div style={{ fontSize:12.5, color:C.textSub, marginTop:2 }}>{selected.ban_reason}</div>
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Mark test */}
              {canDo(role, "tester") && (
                <div style={{ padding:"14px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, fontWeight:600 }}>測試帳號</div>
                  {!selected.is_test_account ? (
                    <div style={{ display:"flex", gap:8 }}>
                      <input value={testLabel} onChange={e=>setTestLabel(e.target.value)} placeholder="標籤（如：Jeremy dev）" style={{ ...INP, flex:1 }}/>
                      <button onClick={()=>handleMarkTest(selected,true)} style={{ padding:"8px 14px", borderRadius:8, background:"rgba(74,144,217,0.2)", border:"1px solid rgba(74,144,217,0.3)", color:"#4A90D9", fontFamily:"inherit", fontSize:12, cursor:"pointer" }}>標記</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#4A90D9" }}>🧪 {selected.test_label}</span>
                      <button onClick={()=>handleMarkTest(selected,false)} style={{ padding:"6px 12px", borderRadius:8, background:"transparent", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:"inherit", fontSize:11, cursor:"pointer" }}>移除標記</button>
                      <button onClick={()=>handleDeleteTestData(selected)} style={{ padding:"6px 12px", borderRadius:8, background:"rgba(232,54,93,0.1)", border:"1px solid rgba(232,54,93,0.25)", color:C.rose, fontFamily:"inherit", fontSize:11, cursor:"pointer" }}>清除數據</button>
                    </div>
                  )}
                </div>
              )}


              {/* Account tools */}
              {role === "super_admin" && (
                <div style={{ padding:"14px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, fontWeight:600 }}>
                    帳號管理
                  </div>

                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button
                      onClick={async () => {
                        await disableUser(selected.id);
                        setMsg("✓ 帳號已停用");
                        load();
                      }}
                      style={{ padding:"8px 12px", borderRadius:8, background:"rgba(245,166,35,0.15)", border:"1px solid rgba(245,166,35,0.3)", color:"#F5A623", cursor:"pointer", fontFamily:"inherit" }}
                    >
                      停用帳號
                    </button>

                    <button
                      onClick={async () => {
                        await restoreUser(selected.id);
                        setMsg("✓ 帳號已恢復");
                        load();
                      }}
                      style={{ padding:"8px 12px", borderRadius:8, background:"rgba(0,201,167,0.12)", border:"1px solid rgba(0,201,167,0.25)", color:C.mint, cursor:"pointer", fontFamily:"inherit" }}
                    >
                      恢復帳號
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm("確定軟刪除此帳號？")) return;
                        await softDeleteUser(selected.id);
                        setMsg("✓ 帳號已軟刪除");
                        setSelected(null);
                        load();
                      }}
                      style={{ padding:"8px 12px", borderRadius:8, background:"rgba(232,54,93,0.12)", border:"1px solid rgba(232,54,93,0.25)", color:C.rose, cursor:"pointer", fontFamily:"inherit" }}
                    >
                      軟刪除
                    </button>
                  </div>
                </div>
              )}

              {/* Premium Management */}
              {canDo(role, "super_admin") && (
                <div style={{ padding:"14px", background:"rgba(201,168,76,0.04)", borderRadius:10, border:`1px solid rgba(201,168,76,0.15)` }}>
                  <div style={{ fontSize:12, color:C.gold, marginBottom:10, fontWeight:600 }}>Premium 管理</div>
                  <div style={{ fontSize:12, color:C.textMuted, marginBottom:10 }}>
                    目前：{(selected as any).is_premium
                      ? <span style={{ color:C.gold }}>✦ {(selected as any).premium_plan === "premium_plus" ? "Premium+" : "Premium"}</span>
                      : <span>無訂閱</span>}
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                    <button onClick={()=>handleGrantPremium(selected,"premium")} style={{ padding:"7px 13px", borderRadius:8, background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", color:C.gold, fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" }}>授予 Premium</button>
                    <button onClick={()=>handleGrantPremium(selected,"premium_plus")} style={{ padding:"7px 13px", borderRadius:8, background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.3)", color:"#A78BFA", fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" }}>授予 Premium+</button>
                    {(selected as any).is_premium && <button onClick={()=>handleGrantPremium(selected,null)} style={{ padding:"7px 13px", borderRadius:8, background:"rgba(255,60,60,0.08)", border:"1px solid rgba(255,60,60,0.2)", color:"#FF6B6B", fontFamily:"inherit", fontSize:12, cursor:"pointer" }}>移除</button>}
                  </div>
                </div>
              )}

              {/* Ban/Unban */}
              {canDo(role, "moderator") && (
                <div style={{ padding:"14px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, fontWeight:600 }}>帳號封禁</div>
                  {selected.is_banned ? (
                    <button onClick={()=>handleUnban(selected)} style={{ padding:"8px 16px", borderRadius:8, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" }}>解除封禁</button>
                  ) : (
                    <div style={{ display:"flex", gap:8 }}>
                      <input value={banReason} onChange={e=>setBanReason(e.target.value)} placeholder="封禁原因（必填）" style={{ ...INP, flex:1 }}/>
                      <button onClick={()=>handleBan(selected)} style={{ padding:"8px 14px", borderRadius:8, background:"rgba(232,54,93,0.2)", border:"1px solid rgba(232,54,93,0.35)", color:C.rose, fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" }}>封禁</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={()=>setSelected(null)} style={{ marginTop:18, width:"100%", padding:"11px", borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:"inherit", fontSize:13, cursor:"pointer" }}>關閉</button>
          </div>
        </div>
      )}
    </div>
  );
}
