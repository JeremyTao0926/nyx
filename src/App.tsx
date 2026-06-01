import { useState, useEffect } from "react";
import { sb, C, WRAP, GLOBAL_CSS, getProfile, getMatches, getUnreadCount } from "./utils";
import type { UserProfile, MatchItem } from "./types";
import { LoginScreen, SplashScreen } from "./screens/AuthScreens";
import { ChatListScreen, RealChatScreen } from "./screens/ChatScreens";
import { NyxChatScreen } from "./screens/NyxChatScreen";
import { ExploreScreen } from "./screens/ExploreScreen";
import { SparkScreen } from "./screens/SparkScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";

type Tab = "explore" | "spark" | "chat" | "profile";

/* ─── SVG Icons ──────────────────────────────────────── */
function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const c = active ? C.gold : "rgba(245,237,214,0.30)";
  const w = "1.7";
  if (tab === "explore") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if (tab === "spark")   return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
  if (tab === "chat")    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if (tab === "profile") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return null;
}

const TAB_LABELS: Record<Tab, string> = { explore:"探索", spark:"真心話", chat:"消息", profile:"我的" };

/* ─── Bottom Tab Bar ─────────────────────────────────── */
function BottomTabBar({ tab, setTab, unread }: { tab: Tab; setTab: (t: Tab) => void; unread: number }) {
  const tabs: Tab[] = ["explore", "spark", "chat", "profile"];
  return (
    <div style={{ display:"flex", background:"rgba(12,10,8,0.98)", backdropFilter:"blur(24px)", borderTop:`1px solid ${C.border}`, paddingBottom:"env(safe-area-inset-bottom,0px)", flexShrink:0 }}>
      {tabs.map(id => (
        <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"10px 0 7px", background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, fontFamily:"inherit", position:"relative" }}>
          <div style={{ position:"relative" }}>
            <TabIcon tab={id} active={tab===id}/>
            {id==="chat" && unread>0 && <div style={{ position:"absolute", top:-4, right:-6, minWidth:16, height:16, borderRadius:8, background:C.gradRose, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, border:`2px solid ${C.bg}`, padding:"0 3px" }}>{unread>99?"99+":unread}</div>}
          </div>
          <span style={{ fontSize:10.5, color:tab===id?C.gold:"rgba(245,237,214,0.28)", fontWeight:tab===id?600:400, transition:"color .2s" }}>{TAB_LABELS[id]}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── App ────────────────────────────────────────────── */
export default function App() {
  const [authed, setAuthed]         = useState(false);
  const [userId, setUserId]         = useState<string|null>(null);
  const [profile, setProfile]       = useState<UserProfile|null>(null);
  const [splashSeen, setSplashSeen] = useState(false);
  const [tab, setTab]               = useState<Tab>("explore");
  const [loading, setLoading]       = useState(true);
  const [inChat, setInChat]         = useState(false);
  const [activeMatch, setActiveMatch] = useState<MatchItem|null>(null);
  const [matches, setMatches]       = useState<MatchItem[]>([]);
  const [unreadPerMatch, setUnreadPerMatch] = useState<Record<string,number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setAuthed(true); setUserId(session.user.id); setSplashSeen(true); }
      setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      if (session?.user) { setAuthed(true); setUserId(session.user.id); }
      else { setAuthed(false); setUserId(null); setProfile(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !authed) return;
    sb.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", userId);
    loadAll();
    const ch = sb.channel(`app-${userId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`user_id=eq.${userId}` }, () => loadAll())
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, () => loadUnread())
      .subscribe();
    const iv = setInterval(() => sb.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", userId), 4*60*1000);
    return () => { sb.removeChannel(ch); clearInterval(iv); };
  }, [userId, authed]);

  async function loadAll() {
    let p = await getProfile(userId!);
    if (!p) {
      const { data: au } = await sb.auth.getUser();
      const email = au?.user?.email || "";
      const meta  = au?.user?.user_metadata || {};
      const uname = meta.username || email.split("@")[0] || "user";
      await sb.from("profiles").upsert({ id:userId, username:uname, display_name:uname, email, gender:"male", mbti:"INFP", onboarding_done:false }, { onConflict:"id", ignoreDuplicates:true });
      p = await getProfile(userId!);
    }
    if (p) { setProfile(p); if (!(p as any).onboarding_done) setShowOnboarding(true); }
    const m = await getMatches(userId!);
    setMatches(m);
    loadUnread();
  }

  async function loadUnread() {
    if (!userId) return;
    try {
      const { data } = await sb.rpc("get_unread_per_match", { p_user_id: userId });
      const map: Record<string,number> = {}; let total = 0;
      (data||[]).forEach((r: any) => { map[r.match_id] = Number(r.unread_count); total += Number(r.unread_count); });
      setUnreadPerMatch(map); setTotalUnread(total);
    } catch { setTotalUnread(await getUnreadCount(userId)); }
  }

  function openMatch(m: MatchItem) {
    setActiveMatch(m); setInChat(true); setTab("chat");
    setUnreadPerMatch(p => { const n={...p}; delete n[m.matchId]; return n; });
    setTotalUnread(p => Math.max(0, p-(unreadPerMatch[m.matchId]||0)));
    getMatches(userId!).then(setMatches);
  }

  async function logout() { await sb.auth.signOut(); setSplashSeen(false); setInChat(false); setActiveMatch(null); }
  function updateLocal(patch: Partial<UserProfile>) { setProfile(p => p ? {...p,...patch} : p); }

  if (loading) return <>
    <style>{GLOBAL_CSS}</style>
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
    </div>
  </>;

  if (!authed) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={() => setAuthed(true)}/></>;
  if (!splashSeen) return <><style>{GLOBAL_CSS}</style><SplashScreen onDone={() => setSplashSeen(true)}/></>;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", ...WRAP, background:C.bg, overflow:"hidden" }}>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {/* EXPLORE */}
          {tab==="explore" && userId && profile &&
            <ExploreScreen userId={userId} profile={profile} onUpdate={updateLocal} onOpenMatch={openMatch}/>}
          {/* SPARK */}
          {tab==="spark" && <SparkScreen/>}
          {/* CHAT */}
          {tab==="chat" && !inChat && profile &&
            <ChatListScreen profile={profile} matches={matches} unreadPerMatch={unreadPerMatch} onOpenNyx={() => setInChat(true)} onOpenMatch={openMatch}/>}
          {tab==="chat" && inChat && userId && profile && !activeMatch &&
            <NyxChatScreen userId={userId} profile={profile} onBack={() => setInChat(false)}/>}
          {tab==="chat" && inChat && userId && profile && activeMatch &&
            <RealChatScreen matchId={activeMatch.matchId} myUserId={userId} myProfile={profile} other={activeMatch} onBack={() => { setInChat(false); setActiveMatch(null); loadUnread(); getMatches(userId!).then(setMatches); }}/>}
          {/* PROFILE */}
          {tab==="profile" && profile && userId &&
            <ProfileScreen profile={profile} userId={userId} onLogout={logout} onUpdate={updateLocal}/>}
        </div>
        <BottomTabBar tab={tab} setTab={t => { setTab(t); if (t!=="chat") setInChat(false); }} unread={totalUnread}/>
      </div>
      {showOnboarding && userId && <OnboardingScreen userId={userId} onDone={() => { setShowOnboarding(false); updateLocal({ onboarding_done:true } as any); }}/>}
    </>
  );
}
