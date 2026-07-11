import React, { useState, useEffect, useRef } from "react";
import { sb, getMyAdminRole, canDo } from "./adminUtils";
import type { AdminRole } from "./adminUtils";
import { AdminDashboard } from "./AdminDashboard";
import { AdminUsers } from "./AdminUsers";
import { AdminReports } from "./AdminReports";
import { AdminAuditLog } from "./AdminAuditLog";

type AdminTab = "dashboard" | "users" | "test_data" | "reports" | "audit";

const TABS: { id: AdminTab; label: string; icon: string; requires: AdminRole }[] = [
  { id: "dashboard", label: "總覽",     icon: "◈", requires: "analyst"    },
  { id: "users",     label: "用戶管理", icon: "U", requires: "moderator"  },
  { id: "test_data", label: "測試數據", icon: "T", requires: "tester"     },
  { id: "reports",   label: "檢舉處理", icon: "R", requires: "moderator"  },
  { id: "audit",     label: "操作日誌", icon: "L", requires: "super_admin"},
];

const C = {
  bg: "#0C0A08", card: "#141210", border: "rgba(201,168,76,0.15)",
  gold: "#C9A84C", goldSoft: "rgba(201,168,76,0.1)",
  text: "#F5EDD6", textSub: "rgba(245,237,214,0.6)",
  textMuted: "rgba(245,237,214,0.35)", rose: "#E8365D",
  mint: "#00C9A7", grad: "linear-gradient(135deg,#C9A84C,#E2C068)",
  surf: "rgba(255,255,255,0.04)",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "超級管理員", moderator: "審核員",
  analyst: "分析師", tester: "測試員",
};

/* ── SVG tab icons ── */
function TabIcon({ id, active }: { id: AdminTab; active: boolean }) {
  const color = active ? C.gold : C.textMuted;
  const s = 20;
  const icons: Record<AdminTab, React.ReactElement> = {
    dashboard: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    users:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    test_data: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11"/><path d="M9 14H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-4"/><path d="M9 14l-4 7"/><path d="M15 14l4 7"/></svg>,
    reports:   <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    audit:     <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  };
  return icons[id];
}

export function AdminApp() {
  const [authed, setAuthed]   = useState(false);
  const [role, setRole]       = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<AdminTab>("dashboard");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

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
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── LOGIN ── */
  if (!authed) return (
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Noto Sans TC',system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
      <div style={{ width:"100%", maxWidth:400, padding:"36px 28px", background:C.card, border:`1px solid ${C.border}`, borderRadius:20 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:C.bg }}>N</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:C.gold, lineHeight:1 }}>NYX Admin</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>管理後台 — 僅限授權人員</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="管理員電郵" type="email" autoComplete="email"
            style={{ padding:"13px 14px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:12, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit", width:"100%", transition:"border-color .2s" }}
            onFocus={e=>e.target.style.borderColor=C.gold} onBlur={e=>e.target.style.borderColor=C.border}/>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="密碼" autoComplete="current-password"
            style={{ padding:"13px 14px", background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:12, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit", width:"100%", transition:"border-color .2s" }}
            onFocus={e=>e.target.style.borderColor=C.gold} onBlur={e=>e.target.style.borderColor=C.border}/>
          {loginErr && <div style={{ fontSize:12.5, color:C.rose, padding:"8px 12px", background:"rgba(232,54,93,0.08)", borderRadius:8 }}>{loginErr}</div>}
          <button onClick={login} style={{ padding:"14px", borderRadius:12, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 }}>登入</button>
        </div>
      </div>
    </div>
  );

  const visibleTabs = TABS.filter(t => canDo(role, t.requires));

  /* ── MAIN LAYOUT ── */
  return (
    <div style={{ height:"100dvh", background:C.bg, fontFamily:"'Noto Sans TC',system-ui,sans-serif", overflow:"hidden", display:"flex", flexDirection:"column" as const }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{margin:0;padding:0;background:#0C0A08;}

        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:2px}
        @media(min-width:768px){
          .admin-layout{display:flex!important}
          .admin-sidebar{display:flex!important;position:static!important;transform:none!important;box-shadow:none!important}
          .admin-topbar{display:none!important}
          .admin-mobile-nav{display:none!important}
          .admin-content{padding:32px!important}
        }
        @media(max-width:767px){
          .admin-sidebar-overlay{display:block}
        }
      `}</style>

      {/* ── MOBILE TOP BAR ── */}
      <div className="admin-topbar" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", paddingTop:"calc(12px + env(safe-area-inset-top, 0px))", background:C.card, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:40 }}>
        <button onClick={()=>setSidebarOpen(true)} style={{ width:38, height:38, borderRadius:10, background:C.surf, border:`1px solid ${C.border}`, color:C.text, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:4 }}>
          <div style={{ width:16, height:1.5, background:C.text, borderRadius:1 }}/>
          <div style={{ width:12, height:1.5, background:C.text, borderRadius:1 }}/>
          <div style={{ width:16, height:1.5, background:C.text, borderRadius:1 }}/>
        </button>
        <div style={{ fontSize:15, fontWeight:700, color:C.gold }}>NYX Admin</div>
        <div style={{ fontSize:11, color:C.textMuted, background:C.goldSoft, border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px" }}>
          {ROLE_LABEL[role!]}
        </div>
      </div>

      {/* ── SIDEBAR OVERLAY (mobile) ── */}
      {sidebarOpen && <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(8px)" }} onClick={()=>setSidebarOpen(false)}/>}

      <div className="admin-layout" style={{ display:"block", flex:1, overflow:"hidden" }}>
        {/* ── SIDEBAR ── */}
        <div className="admin-sidebar" style={{
          width:240, background:C.card, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", padding:"0 0 24px",
          flexShrink:0,
          // mobile: fixed slide-in
          position:"fixed", top:0, left:0, height:"100dvh", zIndex:60,
          transform:sidebarOpen?"translateX(0)":"translateX(-100%)",
          transition:"transform .28s cubic-bezier(.32,.72,0,1)",
          boxShadow:sidebarOpen?"8px 0 32px rgba(0,0,0,0.5)":"none",
        }}>
          {/* Sidebar header */}
          <div style={{ padding:"20px 20px 18px", paddingTop:"calc(20px + env(safe-area-inset-top, 0px))", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:C.bg, flexShrink:0 }}>N</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.gold, lineHeight:1 }}>NYX Admin</div>
              <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{ROLE_LABEL[role!]}</div>
            </div>
            {/* Mobile close */}
            <button onClick={()=>setSidebarOpen(false)} style={{ width:28, height:28, borderRadius:"50%", background:C.surf, border:`1px solid ${C.border}`, color:C.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✕</button>
          </div>

          {/* Nav items */}
          <div style={{ flex:1, padding:"12px 10px", overflowY:"auto" }}>
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false); }}
                style={{ width:"100%", padding:"11px 12px", borderRadius:12, background:tab===t.id?"rgba(201,168,76,0.1)":"transparent", border:`1px solid ${tab===t.id?"rgba(201,168,76,0.25)":"transparent"}`, color:tab===t.id?C.gold:C.textSub, fontFamily:"inherit", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:11, marginBottom:3, textAlign:"left" as const, fontWeight:tab===t.id?600:400, transition:"all .15s" }}
                onMouseEnter={e=>{ if(tab!==t.id)(e.currentTarget as HTMLElement).style.background=C.surf; }}
                onMouseLeave={e=>{ if(tab!==t.id)(e.currentTarget as HTMLElement).style.background="transparent"; }}>
                <TabIcon id={t.id} active={tab===t.id}/>
                {t.label}
                {t.id==="reports" && <span style={{ marginLeft:"auto", minWidth:18, height:18, borderRadius:9, background:C.rose, color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>!</span>}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div style={{ padding:"12px 10px", borderTop:`1px solid ${C.border}` }}>
            <button onClick={() => { sb.auth.signOut(); setAuthed(false); setRole(null); setSidebarOpen(false); }}
              style={{ width:"100%", padding:"11px 12px", borderRadius:12, background:"transparent", border:`1px solid rgba(232,54,93,0.25)`, color:C.rose, fontFamily:"inherit", fontSize:13.5, cursor:"pointer", display:"flex", alignItems:"center", gap:10, fontWeight:500, transition:"all .15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(232,54,93,0.07)")}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              登出
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="admin-content" style={{ flex:1, padding:"16px", overflowY:"auto", paddingBottom:"calc(72px + env(safe-area-inset-bottom, 0px))" }}>
          {tab === "dashboard"  && <AdminDashboard role={role!} C={C} />}
          {(tab === "users" || tab === "test_data") && <AdminUsers tab={tab} role={role!} C={C} />}
          {tab === "reports"    && <AdminReports role={role!} C={C} />}
          {tab === "audit"      && <AdminAuditLog C={C} />}
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="admin-mobile-nav" style={{ display:"flex", position:"fixed", bottom:0, left:0, right:0, background:C.card, borderTop:`1px solid ${C.border}`, zIndex:40, paddingBottom:"env(safe-area-inset-bottom, 0px)" }}>
        {visibleTabs.slice(0,5).map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"10px 4px 10px", background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, position:"relative" }}>
            {tab===t.id && <div style={{ position:"absolute", top:0, left:"25%", right:"25%", height:2, background:C.grad, borderRadius:"0 0 2px 2px" }}/>}
            <TabIcon id={t.id} active={tab===t.id}/>
            <span style={{ fontSize:10, color:tab===t.id?C.gold:C.textMuted, fontWeight:tab===t.id?600:400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom nav spacer on mobile */}
      <div className="admin-mobile-nav" style={{ height:"calc(64px + env(safe-area-inset-bottom, 0px))" }}/>
    </div>
  );
}
