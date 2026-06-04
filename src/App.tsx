import { useState, useEffect, useRef } from "react";
import { sb, C, WRAP, GLOBAL_CSS, getProfile, getMatches, getUnreadCount } from "./utils";
import type { UserProfile, MatchItem } from "./types";
import { LoginScreen, SplashScreen } from "./screens/AuthScreens";
import { initPush, removePush } from "./pushNotifications";
import { ChatListScreen, RealChatScreen } from "./screens/ChatScreens";
import { NyxChatScreen } from "./screens/NyxChatScreen";
import { ExploreScreen } from "./screens/ExploreScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";

type Tab = "explore" | "chat" | "profile";

/* ─── SVG Icons ──────────────────────────────────────── */
function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const c = active ? C.gold : "rgba(245,237,214,0.30)";
  const w = "1.7";
  if (tab === "explore") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if (tab === "chat")    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if (tab === "profile") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return null;
}

const TAB_LABELS: Record<Tab, string> = { explore:"探索", chat:"消息", profile:"我的" };

/* ─── Bottom Tab Bar ─────────────────────────────────── */
function BottomTabBar({ tab, setTab, unread }: { tab: Tab; setTab: (t: Tab) => void; unread: number }) {
  const tabs: Tab[] = ["explore", "chat", "profile"];
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

/* ── PWA Install Banner ── */
function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = (window.navigator as any).standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;
    setIsIOS(ios);
    const dismissed = localStorage.getItem("nyx-install-dismissed");
    if (dismissed) return;
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div style={{ position:"fixed", bottom:72, left:12, right:12, zIndex:999,
      background:"rgba(20,18,12,0.97)", backdropFilter:"blur(20px)",
      border:"1px solid rgba(201,168,76,0.3)", borderRadius:16,
      padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:12,
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"slideUp .3s cubic-bezier(.32,.72,0,1)" }}>
      <div style={{ width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#C9A84C,#E2C068)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>N</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:14,fontWeight:700,color:"#F5EDD6",marginBottom:3 }}>加入主畫面以接收通知</div>
        {isIOS
          ? <div style={{ fontSize:12,color:"rgba(245,237,214,0.55)",lineHeight:1.5 }}>點底部 <span style={{ fontSize:13 }}>⎙</span> 分享 → 「加入主畫面」</div>
          : <div style={{ fontSize:12,color:"rgba(245,237,214,0.55)",lineHeight:1.5 }}>瀏覽器右上角 ⋮ → 「加入主畫面」</div>}
      </div>
      <button onClick={()=>{ setShow(false); localStorage.setItem("nyx-install-dismissed","1"); }}
        style={{ background:"none",border:"none",color:"rgba(245,237,214,0.35)",fontSize:18,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1 }}>✕</button>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed]         = useState(false);
  const [userId, setUserId]         = useState<string|null>(null);
  const [profile, setProfile]       = useState<UserProfile|null>(null);
  const [splashSeen, setSplashSeen] = useState(false);
  const [resuming, setResuming] = useState(false);
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

  // Push notifications — separate from realtime, runs once after login
  useEffect(() => {
    if (!userId || !authed) return;
    const timer = setTimeout(() => initPush(userId).catch(() => {}), 2000);
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NOTIFICATION_CLICK") setTab("chat");
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [userId, authed]);

  useEffect(() => {
    if (!userId || !authed) return;
    sb.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", userId);
    loadAll();

    const ch = sb.channel(`app-${userId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"matches",
        filter:`user1_id=eq.${userId}` }, () => { getMatches(userId!).then(setMatches); })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"matches",
        filter:`user2_id=eq.${userId}` }, () => { getMatches(userId!).then(setMatches); })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications",
        filter:`user_id=eq.${userId}` }, () => loadAll())
      .subscribe();

    // Poll every 5s — most reliable way to get new messages on free tier
    const pollInterval = setInterval(() => {
      loadUnread();
      getMatches(userId!).then(setMatches);
    }, 5000);

    // Reload matches when tab becomes visible again (user returns to app)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Show brief loading splash
        setResuming(true);
        setTimeout(() => setResuming(false), 1200);
        getMatches(userId!).then(setMatches);
        loadUnread();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const iv = setInterval(() => sb.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", userId), 4*60*1000);
    return () => { sb.removeChannel(ch); clearInterval(iv); clearInterval(pollInterval); document.removeEventListener("visibilitychange", onVisible); };
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

  async function logout() {
    if (userId) await removePush(userId).catch(() => {});
    await sb.auth.signOut();
    setSplashSeen(false); setInChat(false); setActiveMatch(null);
  }
  function updateLocal(patch: Partial<UserProfile>) { setProfile(p => p ? {...p,...patch} : p); }

  // Tab swipe refs — declared before any early returns (Rules of Hooks)
  const appSwipeStartX = useRef(0);
  const appSwipeStartY = useRef(0);
  const appSwiping = useRef(false);
  const [appSwipeDx, setAppSwipeDx] = useState(0);

  if (loading) return <>
    <style>{GLOBAL_CSS}</style>
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
    </div>
  </>;

  if (!authed) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={() => setAuthed(true)}/></>;
  if (!splashSeen || resuming) return <><style>{GLOBAL_CSS}</style><SplashScreen onDone={() => { setSplashSeen(true); setResuming(false); }}/></>;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <InstallBanner/>
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", ...WRAP, background:C.bg, overflow:"hidden" }}
        onTouchStart={e=>{
          // only trigger from edge (left <30px or right >screen-30px)
          const x = e.touches[0].clientX;
          const w = window.innerWidth;
          if (x < 30 || x > w - 30) {
            appSwipeStartX.current = x;
            appSwipeStartY.current = e.touches[0].clientY;
            appSwiping.current = true;
          } else {
            appSwiping.current = false;
          }
        }}
        onTouchMove={e=>{
          if (!appSwiping.current) return;
          const dx = e.touches[0].clientX - appSwipeStartX.current;
          const dy = Math.abs(e.touches[0].clientY - appSwipeStartY.current);
          if (dy > 40) { appSwiping.current = false; return; } // vertical scroll, cancel
          if (Math.abs(dx) > 8) setAppSwipeDx(dx);
        }}
        onTouchEnd={e=>{
          if (!appSwiping.current) { setAppSwipeDx(0); return; }
          const dx = e.changedTouches[0].clientX - appSwipeStartX.current;
          const TABS: Tab[] = ["explore","chat","profile"];
          const cur = TABS.indexOf(tab);
          if (dx < -50 && cur < TABS.length - 1) setTab(TABS[cur + 1]);
          else if (dx > 50 && cur > 0) setTab(TABS[cur - 1]);
          setAppSwipeDx(0);
          appSwiping.current = false;
        }}>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {/* EXPLORE */}
          {tab==="explore" && userId && profile &&
            <ExploreScreen userId={userId} profile={profile} onUpdate={updateLocal} onOpenMatch={openMatch}/>}
          {/* CHAT */}
          {tab==="chat" && userId && profile && <>
            {/* position:relative container so absolute children stay within bounds */}
            <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0 }}>
                <ChatListScreen profile={profile} matches={matches} unreadPerMatch={unreadPerMatch} onOpenNyx={() => setInChat(true)} onOpenMatch={openMatch}/>
              </div>
              {inChat && <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", justifyContent:"center" }}><div style={{ width:"100%", maxWidth:480, height:"100%", position:"relative" }}>
                {!activeMatch
                  ? <NyxChatScreen userId={userId} profile={profile} onBack={() => setInChat(false)}/>
                  : <RealChatScreen matchId={activeMatch.matchId} myUserId={userId} myProfile={profile} other={activeMatch} onBack={() => { setInChat(false); setActiveMatch(null); loadUnread(); getMatches(userId!).then(setMatches); }}/>
                }
              </div></div>}
            </div>
          </>}
          {/* PROFILE */}
          {tab==="profile" && profile && userId &&
            <ProfileScreen profile={profile} userId={userId} onLogout={logout} onUpdate={updateLocal}
              onOpenChat={(matchId, otherId, name, avatar) => {
                const m = matches.find(x=>x.matchId===matchId) || { id: otherId, matchId, name, avatar, lastMsg:"", time:"", unread:0 };
                setActiveMatch(m as any);
                setInChat(true);
                setTab("chat");
              }}/>}
        </div>
        <BottomTabBar tab={tab} setTab={t => { setTab(t); if (t!=="chat") setInChat(false); }} unread={totalUnread}/>
      </div>
      {showOnboarding && userId && <OnboardingScreen userId={userId} onDone={() => { setShowOnboarding(false); updateLocal({ onboarding_done:true } as any); }}/>}
    </>
  );
}
