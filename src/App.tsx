import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { sb, C, WRAP, GLOBAL_CSS, getProfile, getMatches, getUnreadCount, updateProfile, uploadAvatar } from "./utils";
import type { UserProfile, MatchItem } from "./types";
import { AccountSetupScreen, LoginScreen, SplashScreen } from "./screens/AuthScreens";
import { initPush, removePush } from "./pushNotifications";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { isNativeApp } from "./platform";
import { clearPendingAvatar, loadPendingAvatar } from "./pendingAvatar";
import { listenForNativeAuthCallbacks } from "./auth";
import { getActivePremiumPlan } from "./subscription";

type Tab = "explore" | "chat" | "profile";

const ExploreScreen = lazy(() => import("./screens/ExploreScreen").then(module => ({ default: module.ExploreScreen })));
const ChatListScreen = lazy(() => import("./screens/ChatScreens").then(module => ({ default: module.ChatListScreen })));
const RealChatScreen = lazy(() => import("./screens/ChatScreens").then(module => ({ default: module.RealChatScreen })));
const NyxChatScreen = lazy(() => import("./screens/NyxChatScreen").then(module => ({ default: module.NyxChatScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen").then(module => ({ default: module.ProfileScreen })));

function ScreenLoader() {
  return (
    <div role="status" aria-label="頁面載入中" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ width:34, height:34, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
    </div>
  );
}

/* ─── SVG Icons ──────────────────────────────────────── */
function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const c = active ? C.gold : C.textDim;
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
    <nav aria-label="主要導覽" style={{ display:"flex", margin:0, padding:"5px 10px calc(5px + env(safe-area-inset-bottom,0px))", background:C.nav, backdropFilter:"blur(28px) saturate(145%)", WebkitBackdropFilter:"blur(28px) saturate(145%)", borderTop:`1px solid ${C.border}`, boxShadow:"0 -12px 34px rgba(57,42,101,.08)", flexShrink:0 }}>
      {tabs.map(id => (
        <button key={id} type="button" aria-label={TAB_LABELS[id]} aria-current={tab===id ? "page" : undefined} onClick={() => setTab(id)} style={{ flex:1, minHeight:54, padding:"7px 0 5px", background:tab===id?C.goldSoft:"transparent", border:tab===id?`1px solid ${C.borderHigh}`:"1px solid transparent", borderRadius:19, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, fontFamily:"inherit", position:"relative", transition:"background .22s, border-color .22s, transform .22s" }}>
          <div style={{ position:"relative" }}>
            <TabIcon tab={id} active={tab===id}/>
            {id==="chat" && unread>0 && <div style={{ position:"absolute", top:-4, right:-6, minWidth:16, height:16, borderRadius:8, background:C.gradRose, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, border:`2px solid ${C.bg}`, padding:"0 3px" }}>{unread>99?"99+":unread}</div>}
          </div>
          <span style={{ fontSize:10.5, color:tab===id?C.gold:C.textDim, fontWeight:tab===id?700:500, transition:"color .2s" }}>{TAB_LABELS[id]}</span>
        </button>
      ))}
    </nav>
  );
}

/* ─── App ────────────────────────────────────────────── */

/* ── PWA Install Banner ── */
function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent));

  useEffect(() => {
    if (isNativeApp) return;
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;
    const dismissed = localStorage.getItem("nyx-install-dismissed");
    if (dismissed) return;
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div style={{ position:"fixed", bottom:72, left:12, right:12, zIndex:999,
      background:C.glass, backdropFilter:"blur(24px) saturate(150%)",
      border:`1px solid ${C.borderHigh}`, borderRadius:18,
      padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:12,
      boxShadow:C.shadowStrong, animation:"slideUp .3s cubic-bezier(.32,.72,0,1)" }}>
      <div style={{ width:40,height:40,borderRadius:12,background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0 }}>N</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:3 }}>加入主畫面以接收通知</div>
        {isIOS
          ? <div style={{ fontSize:12,color:C.textMuted,lineHeight:1.5 }}>點底部 <span style={{ fontSize:13 }}>⎙</span> 分享 → 「加入主畫面」</div>
          : <div style={{ fontSize:12,color:C.textMuted,lineHeight:1.5 }}>瀏覽器右上角 ⋮ → 「加入主畫面」</div>}
      </div>
      <button type="button" aria-label="關閉安裝提示" onClick={()=>{ setShow(false); localStorage.setItem("nyx-install-dismissed","1"); }}
        style={{ background:"none",border:"none",color:C.textMuted,fontSize:18,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1 }}>✕</button>
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
  const [typingMatchIds, setTypingMatchIds] = useState<Set<string>>(new Set());
  const [unreadPerMatch, setUnreadPerMatch] = useState<Record<string,number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const finishSplash = useCallback(() => { setSplashSeen(true); setResuming(false); }, []);

  useEffect(() => listenForNativeAuthCallbacks(message => {
    window.dispatchEvent(new CustomEvent("nyx:auth-error", { detail: message }));
  }), []);

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setProfileLoading(true); setLoadError(""); setAuthed(true); setUserId(session.user.id); setSplashSeen(true); }
      setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      if (session?.user) { setProfileLoading(true); setLoadError(""); setAuthed(true); setUserId(session.user.id); }
      else { setAuthed(false); setUserId(null); setProfile(null); setLoadError(""); setShowOnboarding(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Push notifications — separate from realtime, runs once after login
  useEffect(() => {
    if (!userId || !authed) return;
    const timer = setTimeout(() => initPush(userId, false).catch(() => {}), 2000);
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NOTIFICATION_CLICK") setTab("chat");
    };
    const nativeHandler = () => setTab("chat");
    navigator.serviceWorker?.addEventListener("message", handler);
    window.addEventListener("nyx:native-notification-click", nativeHandler);
    return () => {
      clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener("message", handler);
      window.removeEventListener("nyx:native-notification-click", nativeHandler);
    };
  }, [userId, authed]);

  // Handle Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const plan = params.get("plan");
    let stopped = false;
    if (payment === "success" && (plan === "premium" || plan === "premium_plus")) {
      // Clean URL
      window.history.replaceState({}, "", "/");
      if (userId) {
        // Stripe redirects can beat its webhook by a few seconds. Poll briefly
        // so the paid badge and gates update without forcing an app restart.
        void (async () => {
          for (let attempt = 0; attempt < 6 && !stopped; attempt += 1) {
            if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1500));
            const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
            if (!data || stopped) continue;
            setProfile(current => current ? { ...current, ...(data as UserProfile) } : data as UserProfile);
            if (getActivePremiumPlan(data) === plan) return;
          }
        })();
        alert(`付款完成，正在同步 ${plan === "premium_plus" ? "NYX Premium+" : "NYX Premium"} 會員權限。`);
      }
    }
    if (payment === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
    return () => { stopped = true; };
  }, [userId]);

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await sb.rpc("get_unread_per_match", { p_user_id: userId });
      const rows = (data || []) as { match_id: string; unread_count: number | string }[];
      const map: Record<string,number> = {};
      let total = 0;
      rows.forEach(row => {
        map[row.match_id] = Number(row.unread_count);
        total += Number(row.unread_count);
      });
      setUnreadPerMatch(map);
      setTotalUnread(total);
    } catch {
      setTotalUnread(await getUnreadCount(userId));
    }
  }, [userId]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    let p = await getProfile(userId);
    const { data: au, error: authError } = await sb.auth.getUser();
    if (authError) throw authError;
    const meta = au?.user?.user_metadata || {};
    const registrationProfile = meta.registration_profile as (Partial<UserProfile> & { onboarding_done?: boolean }) | undefined;
    if (!p) {
      const email = au?.user?.email || null;
      const providerName = meta.full_name || meta.name || meta.display_name || "";
      const fallbackName = au?.user?.phone ? `NYX ${au.user.phone.slice(-4)}` : "NYX Member";
      const uname = meta.username || `nyx_${userId.replace(/-/g, "").slice(0, 10)}`;
      const { error } = await sb.from("profiles").upsert({
        id: userId,
        username: uname,
        display_name: registrationProfile?.display_name || providerName || (email ? email.split("@")[0] : fallbackName),
        email,
        birthday: registrationProfile?.birthday || meta.birthday || null,
        gender: registrationProfile?.gender || meta.gender || "male",
        mbti: registrationProfile?.mbti || meta.mbti || "INFP",
        avatar_url: meta.avatar_url || meta.picture || null,
        onboarding_done: registrationProfile?.onboarding_done ?? false,
      }, { onConflict:"id", ignoreDuplicates:true });
      if (error) throw error;
      p = await getProfile(userId);
    }
    if (p && registrationProfile) {
      try {
        await updateProfile(userId, registrationProfile);
        p = { ...p, ...registrationProfile };
        const { error } = await sb.auth.updateUser({ data: { registration_profile: null } });
        if (error) console.error("Unable to clear completed registration metadata", error);
      } catch (error) {
        // Keep the metadata so the profile can be completed on the next load.
        console.error("Unable to apply registration profile", error);
      }
    }
    if (p) {
      const providerPatch: Record<string, unknown> = {};
      const providerAvatar = meta.avatar_url || meta.picture;
      const providerName = meta.full_name || meta.name;
      if (au?.user?.email && !(p as UserProfile & { email?: string | null }).email) providerPatch.email = au.user.email;
      if (providerAvatar && !p.avatar_url) providerPatch.avatar_url = providerAvatar;
      if (providerName && (!p.display_name || p.display_name.startsWith("NYX "))) providerPatch.display_name = providerName;
      if (Object.keys(providerPatch).length) {
        await updateProfile(userId, providerPatch as Partial<UserProfile>);
        p = { ...p, ...providerPatch } as UserProfile;
      }
    }
    const accountEmail = au?.user?.email;
    if (p && accountEmail) {
      const pendingAvatar = await loadPendingAvatar(accountEmail).catch(() => undefined);
      if (pendingAvatar) {
        try {
          const avatarUrl = await uploadAvatar(new File([pendingAvatar], "avatar.jpg", { type: "image/jpeg" }), userId);
          await updateProfile(userId, { avatar_url: avatarUrl });
          p = { ...p, avatar_url: avatarUrl };
          await clearPendingAvatar(accountEmail);
        } catch (error) {
          console.error("Unable to finish pending avatar upload", error);
        }
      }
    }
    if (!p) throw new Error("Profile could not be created");
    setProfile(p);
    setShowOnboarding(!p.onboarding_done);
    setMatches(await getMatches(userId));
    await loadUnread();
  }, [loadUnread, userId]);

  useEffect(() => {
    if (!userId || !authed) return;
    // Update last_active immediately on login and on every app focus
    const updateActive = async () => {
      const { error } = await sb.rpc("touch_last_active");
      if (error) await sb.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", userId);
    };
    void updateActive();
    const onFocus = () => { if (document.visibilityState === "visible") void updateActive(); };
    document.addEventListener("visibilitychange", onFocus);
    const initialLoadTimer = setTimeout(() => {
      void loadAll()
        .catch(error => {
          console.error("Unable to load account data", error);
          setLoadError("暫時無法載入帳號資料，請檢查網路後重試");
        })
        .finally(() => setProfileLoading(false));
    }, 0);

    // Broadcast channel — instant UI update, no DB round-trip
    const broadcastCh = sb.channel(`user-inbox:${userId}`)
      .on("broadcast", { event: "new_message" }, payload => {
        const { matchId, preview, ts } = payload.payload || {};
        // Instantly update the match in state
        setMatches(prev => {
          const now = ts || Date.now();
          const updated = prev.map(m =>
            m.matchId === matchId
              ? { ...m, lastMsg: preview || m.lastMsg, time: new Date(now).toISOString() }
              : m
          );
          // Re-sort by time
          return [...updated].sort((a, b) =>
            new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()
          );
        });
        // Update unread count instantly
        setUnreadPerMatch((prev: Record<string,number>) => ({
          ...prev,
          [matchId]: (prev[matchId] || 0) + 1
        }));
      })
      .on("broadcast", { event: "new_match" }, () => {
        getMatches(userId).then(setMatches);
      })
      .subscribe();

    // postgres_changes for matches & notifications (low frequency, reliable)
    const ch = sb.channel(`app-${userId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"matches",
        filter:`user1_id=eq.${userId}` }, () => { getMatches(userId!).then(setMatches); })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"matches",
        filter:`user2_id=eq.${userId}` }, () => { getMatches(userId!).then(setMatches); })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications",
        filter:`user_id=eq.${userId}` }, () => { void loadAll().catch(error => console.error("Unable to refresh account data", error)); })
      .subscribe();

    // Fallback poll every 30s (safety net only)
    const pollInterval = setInterval(() => {
      loadUnread();
      getMatches(userId!).then(setMatches);
    }, 30000);

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

    const iv = setInterval(() => { if (document.visibilityState === "visible") void updateActive(); }, 4*60*1000);
    return () => { clearTimeout(initialLoadTimer); sb.removeChannel(ch); sb.removeChannel(broadcastCh); clearInterval(iv); clearInterval(pollInterval); document.removeEventListener("visibilitychange", onVisible); document.removeEventListener("visibilitychange", onFocus); };
  }, [userId, authed, loadAll, loadUnread]);

  // Matches arrive after the initial account load, so typing subscriptions
  // must track the current match list instead of being frozen at login time.
  useEffect(() => {
    if (!userId || !authed || matches.length === 0) return;
    const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    const typingChannels = matches.map(match => sb.channel(`typing-${match.matchId}`)
      .on("broadcast", { event: "typing" }, payload => {
        if (payload.payload?.userId === userId) return;
        setTypingMatchIds(current => {
          const next = new Set(current);
          next.add(match.matchId);
          return next;
        });
        clearTimeout(typingTimers[match.matchId]);
        typingTimers[match.matchId] = setTimeout(() => {
          setTypingMatchIds(current => {
            const next = new Set(current);
            next.delete(match.matchId);
            return next;
          });
        }, 3000);
      })
      .subscribe());

    return () => {
      Object.values(typingTimers).forEach(clearTimeout);
      typingChannels.forEach(channel => { void sb.removeChannel(channel); });
    };
  }, [authed, matches, userId]);

  async function retryLoadAll() {
    setProfileLoading(true);
    setLoadError("");
    try {
      await loadAll();
    } catch (error) {
      console.error("Unable to load account data", error);
      setLoadError("暫時無法載入帳號資料，請檢查網路後重試");
    } finally {
      setProfileLoading(false);
    }
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
    setSplashSeen(false); setInChat(false); setActiveMatch(null); setShowOnboarding(false);
  }
  function updateLocal(patch: Partial<UserProfile>) { setProfile(p => p ? {...p,...patch} : p); }

  // Tab swipe refs — declared before any early returns (Rules of Hooks)
  const appSwipeStartX = useRef(0);
  const appSwipeStartY = useRef(0);
  const appSwiping = useRef(false);

  if (loading) return <>
    <style>{GLOBAL_CSS}</style>
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
    </div>
  </>;

  if (!authed) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={() => setAuthed(true)}/></>;
  if (!splashSeen || resuming) return <><style>{GLOBAL_CSS}</style><SplashScreen onDone={finishSplash}/></>;
  if (!profile) return <>
    <style>{GLOBAL_CSS}</style>
    <div style={{ minHeight:"100dvh", background:C.bg, color:C.text, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:18, padding:24, textAlign:"center" }}>
      {profileLoading
        ? <div style={{ width:40, height:40, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
        : <>
          <div style={{ fontSize:15, lineHeight:1.6, color:C.textSub }}>{loadError || "暫時無法載入帳號資料"}</div>
          <button type="button" onClick={retryLoadAll} style={{ minHeight:46, padding:"0 24px", borderRadius:24, border:"none", background:C.grad, color:"#fff", fontFamily:"inherit", fontWeight:800, cursor:"pointer", boxShadow:`0 8px 24px ${C.goldGlow}` }}>重新載入</button>
        </>}
    </div>
  </>;
  if (profile && (profile.is_banned || profile.is_active === false || profile.deleted_at)) {
    return <><style>{GLOBAL_CSS}</style><BlockedScreen profile={profile} onLogout={logout}/></>;
  }
  if (!profile.birthday || !profile.username || !profile.display_name) {
    return <>
      <style>{GLOBAL_CSS}</style>
      <AccountSetupScreen userId={userId!} profile={profile} onLogout={logout} onComplete={patch => updateLocal(patch)}/>
    </>;
  }


  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <InstallBanner/>
      <div className="nyx-app-shell" style={{ display:"flex", flexDirection:"column", ...WRAP, background:C.bg, overflow:"hidden", boxSizing:"border-box" as const }}
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
          const dy = Math.abs(e.touches[0].clientY - appSwipeStartY.current);
          if (dy > 40) { appSwiping.current = false; return; } // vertical scroll, cancel
        }}
        onTouchEnd={e=>{
          if (!appSwiping.current) return;
          const dx = e.changedTouches[0].clientX - appSwipeStartX.current;
          const TABS: Tab[] = ["explore","chat","profile"];
          const cur = TABS.indexOf(tab);
          if (dx < -50 && cur < TABS.length - 1) setTab(TABS[cur + 1]);
          else if (dx > 50 && cur > 0) setTab(TABS[cur - 1]);
          appSwiping.current = false;
        }}>
        <Suspense fallback={<ScreenLoader/>}>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {/* EXPLORE */}
          {tab==="explore" && userId && profile &&
            <ExploreScreen userId={userId} profile={profile} onUpdate={updateLocal} onOpenMatch={openMatch}/>}
          {/* CHAT */}
          {tab==="chat" && userId && profile && <>
            {/* position:relative container so absolute children stay within bounds */}
            <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0 }}>
                <ChatListScreen profile={profile} matches={matches} unreadPerMatch={unreadPerMatch} typingMatchIds={typingMatchIds} onOpenNyx={() => setInChat(true)} onOpenMatch={openMatch}/>
              </div>
              {inChat && <div className="nyx-fullscreen-layer" style={{ position:"fixed", inset:0, zIndex:50, display:"flex", justifyContent:"center", background:C.bg }}><div style={{ width:"100%", maxWidth:480, height:"100%", position:"relative" }}>
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
                setActiveMatch(m);
                setInChat(true);
                setTab("chat");
              }}/>}
        </div>
        </Suspense>
        <BottomTabBar tab={tab} setTab={t => { setTab(t); if (t!=="chat") setInChat(false); }} unread={totalUnread}/>
      </div>
      {showOnboarding && userId && (
        <OnboardingScreen userId={userId} onDone={() => { setShowOnboarding(false); updateLocal({ onboarding_done:true }); }}/>
      )}
    </>
  );
}


/** 帳號被停用/封禁/刪除時的攔截頁，含申訴通道 */
type AccountAppeal = {
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_note?: string | null;
};

function BlockedScreen({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  const [appeal, setAppeal] = useState<AccountAppeal | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { (async () => {
    const { data } = await sb.from("appeals").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1);
    if (data && data[0]) setAppeal(data[0]);
  })(); }, [profile.id]);

  const reason = profile.is_banned
    ? `此帳號已被封禁${profile.ban_reason ? `：${profile.ban_reason}` : ""}`
    : profile.deleted_at ? "此帳號已被刪除" : "此帳號已被停用";

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    const { data, error } = await sb.from("appeals").insert({ user_id: profile.id, message: text.trim() }).select("*");
    setBusy(false);
    if (error) { setErr("提交失敗：" + error.message); return; }
    setAppeal(data && data[0] ? data[0] : { status: "pending", created_at: new Date().toISOString() });
    setShowForm(false); setText("");
  }

  const pending = appeal?.status === "pending";
  const rejected = appeal?.status === "rejected";

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:"0 32px", textAlign:"center", fontFamily:"'Plus Jakarta Sans','Noto Sans TC',sans-serif" }}>
      <div style={{ fontSize:44, opacity:.5 }}>🚫</div>
      <div style={{ fontSize:19, fontWeight:800, color:C.text }}>無法使用此帳號</div>
      <div style={{ fontSize:14, color:C.textMuted, lineHeight:1.7 }}>{reason}</div>

      {pending && (
        <div style={{ background:C.goldSoft, border:`1px solid ${C.borderHigh}`, borderRadius:12, padding:"12px 18px", fontSize:13, color:C.gold, lineHeight:1.6 }}>
          申訴已提交，等待審核<br/>
          <span style={{ opacity:.7 }}>{new Date(appeal.created_at).toLocaleString("zh-TW")}</span>
        </div>
      )}
      {rejected && !showForm && (
        <div style={{ background:C.dangerSoft, border:`1px solid ${C.danger}4d`, borderRadius:12, padding:"12px 18px", fontSize:13, color:C.danger, lineHeight:1.6, maxWidth:320 }}>
          上次申訴已被駁回{appeal.admin_note ? `：${appeal.admin_note}` : ""}
        </div>
      )}

      {!pending && !showForm && (
        <button onClick={()=>setShowForm(true)} style={{ padding:"12px 36px", borderRadius:50, background:"transparent", border:`1px solid ${C.gold}`, color:C.gold, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>
          {rejected ? "再次申訴" : "提交申訴"}
        </button>
      )}

      {showForm && (
        <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:10 }}>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder="請說明情況（例如：我認為這是誤判，原因是⋯）"
            style={{ width:"100%", boxSizing:"border-box", background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", color:C.text, fontFamily:"inherit", fontSize:14, resize:"vertical", outline:"none" }}/>
          {err && <div style={{ fontSize:12.5, color:C.rose }}>{err}</div>}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{ setShowForm(false); setErr(""); }} style={{ flex:1, padding:"12px", borderRadius:50, background:"transparent", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:"inherit", fontSize:14, cursor:"pointer" }}>取消</button>
            <button onClick={submit} disabled={busy || !text.trim()} style={{ flex:1, padding:"12px", borderRadius:50, background:C.grad, border:"none", color:"#fff", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer", opacity: busy || !text.trim() ? .5 : 1 }}>{busy ? "提交中…" : "送出申訴"}</button>
          </div>
        </div>
      )}

      <button onClick={onLogout} style={{ marginTop:4, padding:"12px 36px", borderRadius:50, background:C.grad, border:"none", color:"#fff", fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>登出</button>
    </div>
  );
}
