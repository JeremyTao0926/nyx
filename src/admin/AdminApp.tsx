import { useState, useEffect } from "react";
import { sb, getMyAdminRole, canDo } from "./adminUtils";
import type { AdminRole } from "./adminUtils";
import { AdminDashboard } from "./AdminDashboard";
import { AdminUsers } from "./AdminUsers";
import { AdminReports } from "./AdminReports";
import { AdminAuditLog } from "./AdminAuditLog";

type AdminTab = "dashboard" | "users" | "test_data" | "reports" | "audit";

const TABS: { id: AdminTab; label: string; icon: string; requires: AdminRole }[] = [
  { id: "dashboard",  label: "總覽",     icon: "◈", requires: "analyst"     },
  { id: "users",      label: "用戶管理", icon: "👤", requires: "moderator"  },
  { id: "test_data",  label: "測試數據", icon: "🧪", requires: "tester"     },
  { id: "reports",    label: "檢舉處理", icon: "🚩", requires: "moderator"  },
  { id: "audit",      label: "操作日誌", icon: "📋", requires: "super_admin"},
];

const C = {
  bg: "#0C0A08", card: "#141210", border: "rgba(201,168,76,0.15)",
  gold: "#C9A84C", text: "#F5EDD6", textSub: "rgba(245,237,214,0.6)",
  textMuted: "rgba(245,237,214,0.35)", rose: "#E8365D",
  mint: "#00C9A7", grad: "linear-gradient(135deg,#C9A84C,#E2C068)",
};

export function AdminApp() {
  const [authed, setAuthed]   = useState(false);
  const [role, setRole]       = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<AdminTab>("dashboard");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [loginErr, setLoginErr] = useState("");

  useEffect(() => {
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const r = await getMyAdminRole();
        if (r) { setRole(r); setAuthed(true); }
      }
      setLoading(false);
    });
  }, []);

  async function login() {
    setLoginErr("");
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { setLoginErr(error.message); return; }
    const r = await getMyAdminRole();
    if (!r) { setLoginErr("你沒有管理員權限"); await sb.auth.signOut(); return; }
    setRole(r); setAuthed(true);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:C.gold, fontSize:14 }}>載入中...</div>
    </div>
  );

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:360, padding:"36px 32px", background:C.card, border:`1px solid ${C.border}`, borderRadius:20 }}>
        <div style={{ fontSize:24, fontWeight:800, color:C.gold, marginBottom:4 }}>NYX Admin</div>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:28 }}>管理後台 — 僅限授權人員</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="管理員電郵" type="email"
            style={{ padding:"12px 14px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit" }}/>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="密碼"
            style={{ padding:"12px 14px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit" }}/>
          {loginErr && <div style={{ fontSize:12.5, color:C.rose }}>{loginErr}</div>}
          <button onClick={login} style={{ padding:"13px", borderRadius:10, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>登入</button>
        </div>
      </div>
    </div>
  );

  const visibleTabs = TABS.filter(t => canDo(role, t.requires));

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", fontFamily:"Inter,'Noto Sans TC',sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width:220, background:C.card, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
        <div style={{ padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.gold }}>NYX Admin</div>
          <div style={{ fontSize:11.5, color:C.textMuted, marginTop:3 }}>
            {role === "super_admin" ? "超級管理員" : role === "moderator" ? "審核員" : role === "analyst" ? "分析師" : "測試員"}
          </div>
        </div>
        <div style={{ flex:1, padding:"12px 12px" }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, background:tab===t.id?"rgba(201,168,76,0.12)":"transparent", border:"none", color:tab===t.id?C.gold:C.textSub, fontFamily:"inherit", fontSize:13.5, cursor:"pointer", display:"flex", alignItems:"center", gap:10, marginBottom:4, textAlign:"left" as const, fontWeight:tab===t.id?600:400, transition:"all .15s" }}>
              <span style={{ fontSize:15 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"12px 12px", borderTop:`1px solid ${C.border}` }}>
          <button onClick={() => { sb.auth.signOut(); setAuthed(false); setRole(null); }}
            style={{ width:"100%", padding:"10px 12px", borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:"inherit", fontSize:13, cursor:"pointer" }}>
            登出
          </button>
        </div>
      </div>
      {/* Main content */}
      <div style={{ flex:1, padding:"32px", overflowY:"auto" }}>
        {tab === "dashboard"  && <AdminDashboard role={role!} C={C} />}
        {(tab === "users" || tab === "test_data") && <AdminUsers tab={tab} role={role!} C={C} />}
        {tab === "reports"    && <AdminReports role={role!} C={C} />}
        {tab === "audit"      && <AdminAuditLog C={C} />}
      </div>
    </div>
  );
}
