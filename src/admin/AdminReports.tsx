import { useState, useEffect } from "react";
import { getReports, authorizeReview, resolveReport, banUser, sb, getAppeals, resolveAppeal } from "./adminUtils";
import type { Report, AdminRole, Appeal } from "./adminUtils";

interface Props { role: AdminRole; C: any; }

const CATEGORY_LABELS: Record<string,string> = {
  fake:"假帳號", harassment:"騷擾", nudity:"不雅內容", scam:"詐騙", other:"其他"
};

export function AdminReports({ role, C }: Props) {
  const [reports, setReports]   = useState<Report[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [active, setActive]     = useState<Report | null>(null);
  const [notes, setNotes]       = useState("");
  const [msg, setMsg]           = useState("");
  const [authorized, setAuthorized] = useState<Set<string>>(new Set());
  const [appeals, setAppeals] = useState<Appeal[]>([]);

  useEffect(() => { load(); }, [showDone]);

  async function load() {
    setLoading(true);
    setReports(await getReports(!showDone));
    try { setAppeals(await getAppeals(!showDone)); } catch { setAppeals([]); }
    setLoading(false);
  }

  async function authorize(r: Report) {
    await authorizeReview(r.id, "審核員已授權查看此檢舉內容");
    setAuthorized(s => new Set([...s, r.id]));
    setMsg("✓ 已記錄授權，現在可以查看相關內容");
  }

  async function resolve(action: "warning" | "ban" | "dismissed") {
    if (!active) return;
    if (!notes.trim()) { setMsg("請填寫處理說明"); return; }
    await resolveReport(active.id, action, notes);
    if (action === "ban") {
      await banUser(active.reported_id, `檢舉處理：${notes}`);
    }
    setMsg(`✓ 已標記為：${action === "ban" ? "封禁" : action === "warning" ? "警告" : "忽略"}`);
    setActive(null); setNotes(""); load();
  }

  const INP = { padding:"9px 12px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" as const };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:C.text }}>檢舉處理</div>
          <div style={{ fontSize:13, color:C.textMuted, marginTop:3 }}>查看並處理用戶檢舉 — 查看聊天需要授權</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setShowDone(false)} style={{ padding:"7px 16px", borderRadius:20, background:!showDone?"rgba(201,168,76,0.15)":"transparent", border:`1px solid ${!showDone?C.gold:C.border}`, color:!showDone?C.gold:C.textMuted, fontFamily:"inherit", fontSize:12.5, cursor:"pointer" }}>待處理</button>
          <button onClick={()=>setShowDone(true)} style={{ padding:"7px 16px", borderRadius:20, background:showDone?"rgba(201,168,76,0.15)":"transparent", border:`1px solid ${showDone?C.gold:C.border}`, color:showDone?C.gold:C.textMuted, fontFamily:"inherit", fontSize:12.5, cursor:"pointer" }}>已處理</button>
        </div>
      </div>

      {msg && <div style={{ background:"rgba(0,201,167,0.1)", border:"1px solid rgba(0,201,167,0.25)", borderRadius:10, padding:"10px 14px", color:C.mint, fontSize:13, marginBottom:16, cursor:"pointer" }} onClick={()=>setMsg("")}>{msg}</div>}

      {/* ── 申訴處理 ── */}
      {appeals.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:12 }}>帳號申訴（{appeals.length}）</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {appeals.map(a => (
              <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{a.username || a.user_id.slice(0,8)}</span>
                  <span style={{ fontSize:11, background:"rgba(245,166,35,0.15)", color:"#F5A623", padding:"2px 8px", borderRadius:10 }}>{a.blockType}</span>
                  <span style={{ fontSize:11.5, color:C.textMuted }}>{new Date(a.created_at).toLocaleString("zh-TW")}</span>
                  {a.status !== "pending" && <span style={{ fontSize:11, background: a.status==="approved" ? "rgba(0,201,167,0.12)" : "rgba(232,54,93,0.15)", color: a.status==="approved" ? C.mint : C.rose, padding:"2px 8px", borderRadius:10 }}>{a.status==="approved"?"已批准":"已駁回"}</span>}
                </div>
                <div style={{ fontSize:13.5, color:C.textSub, lineHeight:1.6, marginBottom: a.status==="pending" ? 12 : 0, whiteSpace:"pre-wrap" }}>{a.message}</div>
                {a.status === "pending" && (
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={async ()=>{
                      if (!confirm(`批准申訴並恢復 ${a.username || "此用戶"} 的帳號？`)) return;
                      try { await resolveAppeal(a.id, a.user_id, true, "申訴通過，帳號已恢復"); setMsg("✓ 已批准，帳號已恢復"); load(); }
                      catch (e: any) { setMsg("✗ 批准失敗：" + (e?.message || e)); }
                    }} style={{ padding:"7px 18px", borderRadius:20, background:"rgba(0,201,167,0.12)", border:"1px solid rgba(0,201,167,0.35)", color:C.mint, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>批准並恢復帳號</button>
                    <button onClick={async ()=>{
                      const note = prompt("駁回原因（會顯示給用戶）：") || "";
                      if (!note.trim()) return;
                      try { await resolveAppeal(a.id, a.user_id, false, note.trim()); setMsg("✓ 已駁回"); load(); }
                      catch (e: any) { setMsg("✗ 駁回失敗：" + (e?.message || e)); }
                    }} style={{ padding:"7px 18px", borderRadius:20, background:"rgba(232,54,93,0.1)", border:"1px solid rgba(232,54,93,0.35)", color:C.rose, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>駁回</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <div style={{ color:C.textMuted }}>載入中...</div>
      : reports.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:C.textMuted }}>
          <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>✓</div>
          <div>{showDone ? "沒有已處理的檢舉" : "目前沒有待處理的檢舉"}</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 18px" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:11, background:"rgba(232,54,93,0.12)", color:C.rose, padding:"2px 8px", borderRadius:10, fontWeight:600 }}>
                      {CATEGORY_LABELS[r.category] || r.category}
                    </span>
                    <span style={{ fontSize:11, color:C.textMuted }}>{new Date(r.created_at).toLocaleDateString("zh-TW")}</span>
                  </div>
                  <div style={{ fontSize:13.5, color:C.text, marginBottom:4 }}>
                    <span style={{ color:C.textMuted }}>檢舉人：</span>{r.reporter_name || "匿名"}
                    <span style={{ color:C.textMuted, margin:"0 8px" }}>→</span>
                    <span style={{ color:C.rose }}>{r.reported_name || "未知"}</span>
                  </div>
                  <div style={{ fontSize:13, color:C.textSub }}>{r.reason}</div>
                </div>
                {!showDone && (
                  <button onClick={() => setActive(r)}
                    style={{ padding:"8px 16px", borderRadius:10, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:12.5, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                    處理
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action modal */}
      {active && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }} onClick={()=>setActive(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:500, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"28px" }}>
            <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:4 }}>處理檢舉</div>
            <div style={{ fontSize:12.5, color:C.textMuted, marginBottom:20 }}>
              被檢舉：<span style={{ color:C.rose }}>{active.reported_name}</span> |
              類別：{CATEGORY_LABELS[active.category]} |
              原因：{active.reason}
            </div>

            {/* Privacy gate for chat view */}
            {!authorized.has(active.id) ? (
              <div style={{ background:"rgba(201,168,76,0.08)", border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", marginBottom:20 }}>
                <div style={{ fontSize:13, color:C.gold, fontWeight:600, marginBottom:6 }}>⚠️ 需要授權才能查看相關聊天</div>
                <div style={{ fontSize:12.5, color:C.textMuted, marginBottom:12 }}>查看聊天記錄需要明確授權，此操作將被記錄在審計日誌中。</div>
                <button onClick={()=>authorize(active)} style={{ padding:"8px 16px", borderRadius:8, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
                  我確認授權查看此檢舉相關內容
                </button>
              </div>
            ) : (
              <div style={{ background:"rgba(0,201,167,0.08)", border:`1px solid rgba(0,201,167,0.2)`, borderRadius:12, padding:"12px 14px", marginBottom:20 }}>
                <div style={{ fontSize:12.5, color:C.mint }}>✓ 已授權 — 如需查看聊天，請至 Supabase 後台查詢（不在此 UI 直接顯示）</div>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:C.textMuted, marginBottom:6, fontWeight:600 }}>處理說明（必填）</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="說明處理原因..."
                style={{ ...INP, resize:"none" as const, lineHeight:1.6 }}/>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>resolve("dismissed")} style={{ flex:1, padding:"11px", borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:"inherit", fontSize:13, cursor:"pointer" }}>忽略</button>
              <button onClick={()=>resolve("warning")} style={{ flex:1, padding:"11px", borderRadius:10, background:"rgba(245,166,35,0.15)", border:"1px solid rgba(245,166,35,0.3)", color:"#F5A623", fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>警告</button>
              <button onClick={()=>resolve("ban")} style={{ flex:1, padding:"11px", borderRadius:10, background:"rgba(232,54,93,0.15)", border:"1px solid rgba(232,54,93,0.3)", color:C.rose, fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer" }}>封禁</button>
            </div>

            <button onClick={()=>setActive(null)} style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:10, background:"transparent", border:"none", color:C.textMuted, fontFamily:"inherit", fontSize:13, cursor:"pointer" }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
