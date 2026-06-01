import React, { useState, useEffect, useRef } from "react";
import { C, WRAP, sb, sound, fmtTime, fmtDate, fmtMsgTime, blockUser, reportUser, loadChatMsgs, sendChatMsg, markMsgsRead, uploadPhoto, buildSys, groqChat, compressImage, getTodaySpark, getBondInfo } from "../utils";
import type { DailySpark, BondInfo } from "../utils";
import { REPORT_CATEGORIES } from "../components/Modals";
import { Av, TypingBubble, NyxText, Lightbox } from "../components/Atoms";
import { EmojiPanel } from "../components/Modals";
import { SparkCard } from "../components/SparkCard";
import { MemoryWall } from "./MemoryWall";
import type { UserProfile, MatchItem, ChatMsg, ImgItem } from "../types";

const MAX_W = { maxWidth: 480, margin: "0 auto", width: "100%" };

/* ─── EncounterPanel — collapsible, auto-hides after reveal ─ */
function SparkPanel({ spark, matchId, myUserId, other, onSparkUpdate, onBondUpdate }:
  { spark: any; matchId: string; myUserId: string; other: any;
    onSparkUpdate: (s: any) => void; onBondUpdate: () => void }) {
  const [collapsed, setCollapsed] = useState(true); // default collapsed — not in the way
  const [hiding, setHiding] = useState(false);

  function handleDone() {
    onBondUpdate();
  }

  function dismiss() {
    setHiding(true);
    setTimeout(() => { setCollapsed(true); setHiding(false); }, 250);
  }

  if (collapsed) return (
    <div onClick={() => setCollapsed(false)}
      style={{ background: C.bgGold, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <span style={{ fontSize: 11, color: C.rose }}>♥</span>
      <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>今日真心話</span>
      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 2 }}>— 點擊展開</span>
      <span style={{ marginLeft: "auto", fontSize: 14, color: C.textMuted }}>⌄</span>
    </div>
  );

  return (
    <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, maxHeight: 360, overflowY: "auto", opacity: hiding ? 0 : 1, transition: "opacity .25s", ...MAX_W, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px 0" }}>
        <button onClick={dismiss} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, padding: "2px 6px" }}>
          收起 ⌃
        </button>
      </div>
      <div style={{ padding: "0 12px 4px" }}>
        {spark && <SparkCard
          spark={spark} myUserId={myUserId} matchId={matchId} otherName={other.name}
          onAnswered={s => {
            if(s) { onSparkUpdate(s);
              // Auto-collapse after reveal
              if (s.revealedAt) setTimeout(() => setCollapsed(true), 4000);
            }
            handleDone();
          }}
          onReact={text => {
            const special = `[SPARK_REACT]${text}`;
            sendChatMsg(matchId, myUserId, special);
          }}
        />}
      </div>
    </div>
  );
}


function onlineStatus(lastActive: string | null, hidden: boolean): { label: string; color: string; dot: boolean } {
  if (hidden || !lastActive) return { label: "", color: "transparent", dot: false };
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 5 * 60 * 1000) return { label: "在線", color: "#06d6a0", dot: true };
  if (diff < 60 * 60 * 1000) return { label: `${Math.floor(diff / 60000)}分鐘前`, color: "rgba(200,185,230,0.45)", dot: false };
  if (diff < 24 * 60 * 60 * 1000) return { label: `今天 ${fmtTime(new Date(lastActive))}`, color: "rgba(200,185,230,0.45)", dot: false };
  return { label: `${Math.floor(diff / 86400000)}天前`, color: "rgba(200,185,230,0.35)", dot: false };
}

/* ─── Analysis Sheet ─────────────────────────────────── */
function AnalysisSheet({ msg, context, gender, mbti, cache, onCache, onClose }:
  { msg: ChatMsg; context: ChatMsg[]; gender: "male" | "female"; mbti: string; cache: Map<string, string>; onCache: (id: string, r: string) => void; onClose: () => void }) {
  const [result, setResult] = useState(cache.get(msg.id) || "");
  const [loading, setLoading] = useState(!cache.has(msg.id));
  const sys = buildSys(mbti, gender);

  useEffect(() => {
    if (cache.has(msg.id)) return;
    analyze();
  }, []);

  async function analyze() {
    const ctxStr = context.slice(-6).map(m => `${m.senderId === "me" ? "我" : "對方"}：${m.content}`).join("\n");
    const rp = gender === "male" ? "\n（Frame/IOI/IOD/Beta角度）" : "";
    const prompt = `解讀這條訊息：「${msg.content}」\n近期對話：\n${ctxStr}\n\n1.背後心理${rp} 2.測試還是真實表達 3.投入度變化 4.建議回法（保守vs進攻）\n精準簡短。`;
    try {
      const r = await groqChat([{ role: "system", content: sys }, { role: "user", content: prompt }]);
      setResult(r);
      onCache(msg.id, r);
    } catch { setResult("分析失敗 😔"); }
    setLoading(false);
  }

  return <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,3,14,0.92)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ ...MAX_W, background: C.surf, borderRadius: "24px 24px 0 0", border: `1px solid ${C.border}`, padding: "24px 22px 44px", maxHeight: "72vh", overflowY: "auto", animation: "slideUp .32s cubic-bezier(.34,1.56,.64,1)" }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 18px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>訊息解讀</div>
        {cache.has(msg.id) && <span style={{ fontSize: 10, color: C.teal, background: "rgba(6,214,160,0.12)", padding: "2px 8px", borderRadius: 10 }}>已緩存</span>}
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.textMuted, fontStyle: "italic", borderLeft: `2px solid ${C.gold}` }}>{msg.content}</div>
      {loading
        ? <div style={{ display: "flex", gap: 6, padding: "12px 0" }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.pink, display: "inline-block", animation: `dot 1.1s ${i * .18}s ease-in-out infinite` }} />)}</div>
        : <NyxText text={result} />}
    </div>
  </div>;
}

/* ─── Other User Profile Modal ───────────────────────── */
function OtherProfileModal({ profile, onClose }: { profile: any; onClose: () => void }) {
  const [lb, setLb] = useState<{images:string[];index:number}|null>(null);
  const status = onlineStatus(profile.lastActive, false);
  return <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "rgba(4,3,14,0.98)", animation: "fadeIn .25s ease" }}>
    <div style={{ ...MAX_W, display: "flex", flexDirection: "column", height: "100%", background: C.bg, margin: "0 auto" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.border}`, background: "rgba(9,9,15,0.95)", backdropFilter: "blur(20px)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{profile.name}</div>
        {status.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color, boxShadow: `0 0 6px ${status.color}` }} />}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ height: 240, background: profile.avatar ? `url(${profile.avatar}) center/cover` : `linear-gradient(145deg,rgba(255,56,92,0.3),rgba(201,24,74,0.2))`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!profile.avatar && <div style={{ fontSize: 64, opacity: .3 }}>👤</div>}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(transparent,rgba(9,9,15,0.97))" }} />
          <div style={{ position: "absolute", bottom: 16, left: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{profile.name}{profile.age && <span style={{ fontSize: 16, fontWeight: 400, opacity: .8 }}> {profile.age}</span>}</div>
              {status.dot && <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />}
            </div>
            {profile.location && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>📍 {profile.location}</div>}
            {!status.dot && status.label && <div style={{ fontSize: 11, color: status.color, marginTop: 2 }}>{status.label}</div>}
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
            {profile.mbti && <span style={{ background: "rgba(255,56,92,0.15)", border: `1px solid rgba(255,56,92,0.3)`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: C.pink }}>✦ {profile.mbti}</span>}
            {profile.country && <span style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: C.textMuted }}>🌏 {profile.country}</span>}
          </div>
          {profile.bio && <div style={{ fontSize: 14, color: "rgba(248,244,255,0.75)", lineHeight: 1.7, marginBottom: 16 }}>{profile.bio}</div>}
          {profile.hobbies?.length > 0 && <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 10 }}>興趣</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>{profile.hobbies.map((h: string) => <span key={h} style={{ background: "rgba(6,214,160,0.1)", border: `1px solid rgba(6,214,160,0.2)`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: C.teal }}>{h}</span>)}</div>
          </div>}
          {profile.photos?.length > 0 && <div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 10 }}>相片</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{profile.photos.map((p: string, i: number) => <img key={i} src={p} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" as const, borderRadius: 10, border: `1px solid ${C.border}` }} />)}</div>
          </div>}
        </div>
      </div>
    {lb && <Lightbox lb={lb} onClose={() => setLb(null)} />}
    </div>
  </div>;
}

/* ─── Msg Context Menu ───────────────────────────────── */
function MsgMenu({ msg, isMe, onCopy, onDelete, onReply, onAnalyze, onClose }:
  { msg: ChatMsg; isMe: boolean; onCopy: () => void; onDelete?: () => void; onReply: () => void; onAnalyze?: () => void; onClose: () => void }) {
  const items = [
    { icon: "📋", label: "複製", fn: onCopy },
    { icon: "↩️", label: "回覆", fn: onReply },
    ...(!isMe && onAnalyze ? [{ icon: "🔍", label: "分析此訊息", fn: onAnalyze }] : []),
    ...(isMe ? [{ icon: "🗑️", label: "刪除", fn: onDelete || (() => {}), danger: true }] : []),
  ];
  return <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", minWidth: 200, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", animation: "springIn .2s ease" }}>
      {items.map((item: any, i) => <button key={i} onClick={() => { item.fn(); onClose(); sound.tap(); }} style={{ width: "100%", padding: "14px 20px", background: "transparent", border: "none", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", color: item.danger ? "#ff6b6b" : C.text, fontFamily: "inherit", fontSize: 14, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 12 }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{item.icon} {item.label}</button>)}
    </div>
  </div>;
}

/* ─── Conversation List ──────────────────────────────── */
export function ChatListScreen({ profile, matches, unreadPerMatch, onOpenNyx, onOpenMatch }:
  { profile: UserProfile; matches: MatchItem[]; unreadPerMatch: Record<string, number>; onOpenNyx: () => void; onOpenMatch: (m: MatchItem) => void }) {
  const [search, setSearch] = useState("");
  const [nyxLastMsg, setNyxLastMsg] = useState("嗨，把聊天貼給我分析 💫");
  const [nyxTime, setNyxTime] = useState(fmtTime(new Date()));
  const hideOnline = (profile as any).hide_online_status;

  // Load last Nyx message
  useEffect(() => {
    sb.from("conversations").select("id").eq("user_id", profile.id).maybeSingle().then(({ data: conv }) => {
      if (!conv) return;
      sb.from("messages").select("content,created_at,role").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data: msg }) => {
        if (msg?.content) {
          const preview = msg.content.replace(/^#{1,3}\s/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").slice(0, 40);
          setNyxLastMsg((msg.role === "user" ? "你：" : "") + preview + (msg.content.length > 40 ? "..." : ""));
          setNyxTime(fmtTime(new Date(msg.created_at)));
        }
      });
    });
  }, [profile.id]);

  const sortedMatches = [...matches].sort((a, b) => {
    const ta = typeof a.time === "number" ? a.time : new Date(a.time || 0).getTime();
    const tb = typeof b.time === "number" ? b.time : new Date(b.time || 0).getTime();
    return tb - ta;
  });

  function previewMsg(msg: string): string {
    if (!msg) return "";
    if (msg.startsWith("https://") || msg.startsWith("http://")) return "📷 相片";
    return msg.length > 30 ? msg.slice(0, 30) + "..." : msg;
  }

  const all = [
    { id: "nyx", isNyx: true, name: "Nyx ✦", lastMsg: nyxLastMsg, time: nyxTime, unread: 0, avatar: "", online: true, lastActive: null },
    ...sortedMatches.map(m => ({ id: m.id, isNyx: false, name: m.name, lastMsg: previewMsg(m.lastMsg), time: m.time, unread: unreadPerMatch[m.matchId] || 0, avatar: m.avatar, online: false, lastActive: (m as any).lastActive || null }))
  ].filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, animation: "tabSwitch .3s ease" }}>
    <div style={{ padding: "52px 20px 14px", background: "rgba(9,9,15,0.96)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Zen Kaku Gothic New',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: ".1em", background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>NYX</div>
        <Av url={profile.avatar_url} name={profile.display_name || profile.username} size={32} />
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋對話..." style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 20, color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
    </div>
    <div style={{ flex: 1, overflowY: "auto" }}>
      {all.map((item, idx) => {
        const hasUnread = item.unread > 0;
        const status = item.isNyx ? { label: "在線", color: C.teal, dot: true } : onlineStatus(item.lastActive, hideOnline);
        return <div key={item.id} style={{ animation: `nyxIn .3s ${idx * .05}s ease both` }}>
          <div onClick={() => { sound.tap(); item.isNyx ? onOpenNyx() : onOpenMatch(matches.find(m => m.id === item.id)!); }}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", cursor: "pointer", transition: "background .15s", background: hasUnread ? "rgba(255,56,92,0.04)" : "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,56,92,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = hasUnread ? "rgba(255,56,92,0.04)" : "transparent")}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Av url={item.avatar} name={item.name} size={52} grad={item.isNyx ? C.grad : "linear-gradient(145deg,#ff9a3c,#ff6b6b)"} />
              {status.dot && <span style={{ position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: "50%", background: status.color, border: "2px solid #09090f", boxShadow: `0 0 6px ${status.color}` }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: hasUnread ? 800 : 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{item.name}</div>
                  {!item.isNyx && status.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, flexShrink: 0 }} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted }}>{typeof item.time === 'number' ? fmtMsgTime(new Date(item.time)) : item.time}</div>
                  {hasUnread && <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: C.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, padding: "0 5px" }}>{item.unread}</div>}
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: hasUnread ? C.text : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontWeight: hasUnread ? 600 : 400 }}>
                {item.isNyx
                  ? item.lastMsg
                  : hasUnread
                    ? `${item.unread} 條新訊息`
                    : item.lastMsg || "打個招呼吧 💕"
                }
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: `rgba(255,56,92,0.08)`, marginLeft: 86 }} />
        </div>;
      })}
    </div>
  </div>;
}

/* ─── Real Chat Screen ───────────────────────────────── */
export function RealChatScreen({ matchId, myUserId, myProfile, other, onBack }:
  { matchId: string; myUserId: string; myProfile: UserProfile; other: MatchItem; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [otherProfileData, setOtherProfileData] = useState<any>(null);
  const [showOtherProfile, setShowOtherProfile] = useState(false);
  const [menuMsg, setMenuMsg] = useState<ChatMsg | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [pendingImg, setPendingImg] = useState<{ file: File; preview: string } | null>(null);
  const [analysisTarget, setAnalysisTarget] = useState<ChatMsg | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Map<string, string>>(new Map());
  // Daily Spark + Memory
  const [spark, setSpark] = useState<DailySpark | null>(null);
  const [bond, setBond] = useState<BondInfo | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingCh = useRef<any>(null);
  const hideOnline = (myProfile as any).hide_online_status;

  useEffect(() => {
    loadChatMsgs(matchId).then(m => { setMsgs(m); setLoaded(true); });
    markMsgsRead(matchId, myUserId);
    // Load spark + bond on mount
    getTodaySpark(matchId, myUserId, other.id).then(s => { console.log("spark loaded:", s); setSpark(s); });
    getBondInfo(matchId).then(b => setBond(b));

    // Realtime: use Broadcast channel (no RLS needed) to notify other person
    const encounterCh = sb.channel(`encounter-notify-${matchId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "spark_answered" }, () => {
        getTodaySpark(matchId, myUserId, other.id).then(s => {
          setSpark(s);
          if (s?.answerUser1 && s?.answerUser2) { sound.match(); getBondInfo(matchId).then(setBond); }
        });
      })
      .subscribe();

    // Load other user profile
    sb.from("profiles").select("*,cover_url").eq("id", other.id).maybeSingle().then(({ data }) => {
      if (data) {
        setOtherProfileData({
          name: data.display_name || data.username, age: data.birthday ? calcAge(data.birthday) : null,
          avatar: data.avatar_url, cover: (data as any).cover_url || null, bio: data.bio, mbti: data.mbti, location: data.location_text,
          country: data.country, hobbies: data.hobbies || [], photos: data.photos || [],
          lastActive: data.last_active, hideOnline: data.hide_online_status,
        });
      }
    });

    // Realtime messages
    const msgCh = sb.channel(`chat-${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `match_id=eq.${matchId}` }, payload => {
        const m = payload.new as any;
        if (m.sender_id !== myUserId) {
          const isImg = m.is_image === true || (typeof m.content === "string" && (m.content.startsWith("https://") || m.content.startsWith("http://")) && !m.content.includes(" ") && !m.content.includes("\n"));
          setMsgs(p => [...p, { id: m.id, senderId: m.sender_id, content: m.content, timestamp: new Date(m.created_at), isImage: isImg }]);
          sound.send();
          markMsgsRead(matchId, myUserId);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `match_id=eq.${matchId}` }, payload => {
        const m = payload.new as any;
        if (m.read_at && m.sender_id === myUserId) {
          setMsgs(p => p.map(msg => msg.id === m.id ? { ...msg, readAt: new Date(m.read_at) } : msg));
        }
      })
      .subscribe();

    // Typing broadcast
    typingCh.current = sb.channel(`typing-${matchId}`)
      .on("broadcast", { event: "typing" }, payload => {
        if (payload.payload?.userId !== myUserId) {
          setOtherTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      }).subscribe();

    return () => { sb.removeChannel(msgCh); if (typingCh.current) sb.removeChannel(typingCh.current); sb.removeChannel(encounterCh); };
  }, [matchId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, otherTyping]);

  function calcAge(b: string): number | null {
    const born = new Date(b), today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age--;
    return age;
  }

  function handleInput(val: string) {
    setInput(val);
    typingCh.current?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId } });
  }

  function addImg(file: File) {
    const r = new FileReader(); r.onloadend = () => setPendingImg({ file, preview: r.result as string }); r.readAsDataURL(file);
  }

  async function send() {
    if (!input.trim() && !pendingImg) return;
    const txt = input.trim(); const img = pendingImg;
    setInput(""); setPendingImg(null);
    if (textRef.current) { textRef.current.value = ""; textRef.current.style.height = "auto"; }

      // Send image
      if (img) {
        try {
          const compressed = await compressImage(img.file); const url = await uploadPhoto(new File([compressed], img.file.name, {type: 'image/jpeg'}), myUserId, Date.now());
          const opt: ChatMsg = { id: Date.now() + "i", senderId: myUserId, content: url, timestamp: new Date(), isImage: true };
          setMsgs(p => [...p, opt]); sound.send();
          await sb.from("chat_messages").insert({ match_id: matchId, sender_id: myUserId, content: url, is_image: true });
        } catch (e) { console.error("Image upload failed:", e); }
      }
    if (txt) {
      const content = replyTo ? `↩️ ${replyTo.content.slice(0, 30)}${replyTo.content.length > 30 ? "..." : ""}\n${txt}` : txt;
      setReplyTo(null);
      const opt: ChatMsg = { id: Date.now() + "t", senderId: myUserId, content, timestamp: new Date() };
      setMsgs(p => [...p, opt]); sound.send();
      await sendChatMsg(matchId, myUserId, content);
    }
  }

  async function deleteMsg(msgId: string) {
    await sb.from("chat_messages").delete().eq("id", msgId).eq("sender_id", myUserId);
    setMsgs(p => p.filter(m => m.id !== msgId));
  }

  function insertEmoji(e: string) {
    setInput(p => p + e);
    textRef.current?.focus();
  }

  // Online status of other user
  const otherStatus = otherProfileData ? onlineStatus(otherProfileData.lastActive, otherProfileData.hideOnline || hideOnline) : { label: "", color: "transparent", dot: false };

  // Render messages with date groups
  function isSparkReact(content: string) { return typeof content === "string" && content.startsWith("[SPARK_REACT]"); }
  function getSparkReactText(content: string) { return content.replace("[SPARK_REACT]", ""); }

  function renderMsgs() {
    const els: React.ReactNode[] = [];
    let lastDate = "";
    msgs.forEach((msg, idx) => {
      const dateStr = fmtDate(msg.timestamp);
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        els.push(<div key={`d-${idx}`} style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
          <div style={{ fontSize: 11.5, color: C.textMuted, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "3px 14px", border: `1px solid ${C.border}` }}>{dateStr}</div>
        </div>);
      }
      const isMe = msg.senderId === myUserId;
      const isLastInGroup = idx === msgs.length - 1 || msgs[idx + 1]?.senderId !== msg.senderId;
      const showAvatar = !isMe && isLastInGroup;
      const isImage = msg.isImage || (typeof msg.content === "string" && (msg.content.startsWith("https://") || msg.content.startsWith("http://")) && !msg.content.includes(" ") && !msg.content.includes("\n"));

      // Special: SPARK_REACT message card
      if (isSparkReact(msg.content)) {
        const txt = getSparkReactText(msg.content);
        els.push(
          <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", margin:"6px 0", animation:"fadeUp .3s ease" }}>
            <div style={{ maxWidth:"80%", background:isMe?`linear-gradient(135deg,${C.bgGold},rgba(30,26,14,0.95))`:`linear-gradient(135deg,rgba(20,18,14,0.98),rgba(28,22,14,0.95))`, border:`1px solid ${C.rose}44`, borderRadius:16, padding:"12px 14px", boxShadow:"0 2px 12px rgba(0,0,0,0.3)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                <span style={{ fontSize:11, color:C.rose }}>♥</span>
                <span style={{ fontSize:10.5, fontWeight:700, color:C.rose, letterSpacing:".5px", textTransform:"uppercase" as const }}>真心話回應</span>
              </div>
              <div style={{ fontSize:14, color:C.text, lineHeight:1.6 }}>{txt.replace(/^\[.*?\]/,"").replace(/^.*？：/,"")}</div>
              <div style={{ fontSize:10.5, color:C.textMuted, marginTop:6, textAlign:isMe?"right":"left" as const }}>{fmtTime(msg.timestamp)}</div>
            </div>
          </div>
        );
        return; // forEach equivalent of continue
      }

      const displayContent = msg.content.includes("\n") && msg.content.startsWith("↩️")
        ? msg.content.split("\n").slice(1).join("\n") : msg.content;

      els.push(
        <div key={msg.id}
          style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginBottom: isLastInGroup ? 10 : 2, animation: `${isMe ? "userIn" : "nyxIn"} .25s ease both` }}
          onContextMenu={e => { e.preventDefault(); setMenuMsg(msg); }}>
          {/* Avatar placeholder for spacing even when not shown */}
          <div style={{ width: 32, flexShrink: 0 }}>
            {showAvatar && <Av url={other.avatar} name={other.name} size={30} grad="linear-gradient(145deg,#ff9a3c,#ff6b6b)" />}
          </div>
          <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
            {msg.content.startsWith("↩️") && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2, opacity: .7 }}>{msg.content.split("\n")[0]}</div>}
            <div style={{ padding: isImage ? "4px" : "10px 14px", borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px", background: isMe ? C.grad : "rgba(24,20,36,0.98)", border: isMe ? undefined : `1px solid ${C.border}`, color: "#fff", fontSize: 14.5, lineHeight: 1.6, boxShadow: isMe ? `0 3px 12px rgba(255,56,92,0.25)` : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {isImage
                ? <img src={msg.content} alt="📷" style={{ maxWidth: 220, maxHeight: 280, borderRadius: 10, objectFit: "cover" as const, display: "block", cursor: "pointer" }} onClick={() => window.open(msg.content, "_blank")} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : displayContent}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
              <div style={{ fontSize: 10, color: C.textMuted }}>{fmtTime(msg.timestamp)}</div>
              {isMe && isLastInGroup && <div style={{ fontSize: 10, color: msg.readAt ? C.teal : C.textMuted }}>{msg.readAt ? "✓✓" : "✓"}</div>}
            </div>
          </div>
        </div>
      );
    });
    return els;
  }

  const ac = C.pink;

  return <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
    {/* Header - centered name */}
    <div style={{ padding: "14px 16px", background: "rgba(9,9,15,0.95)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit", width: 36 }}>‹</button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 0 }} onClick={() => setShowOtherProfile(true)}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{other.name}</div>
          {otherStatus.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 6px ${C.teal}`, flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 11.5, color: otherTyping ? C.teal : (otherStatus.label ? otherStatus.color : C.textMuted) }}>
          {otherTyping ? "輸入中..." : (otherStatus.label || "已配對")}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <button onClick={() => setShowMemory(true)} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:20, background:C.goldSoft, border:`1px solid ${C.gold}33`, cursor:"pointer", fontFamily:"inherit" }}>
          <span style={{ fontSize:12, color:C.gold }}>✦</span>
          <span style={{ fontSize:11, color:C.gold, fontWeight:600 }}>{bond ? bond.label : "回憶"}</span>
        </button>
        <button onClick={() => setShowReport(true)} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer", fontFamily: "inherit", width: 32, display: "flex", justifyContent: "flex-end" }}>⋮</button>
      </div>
    </div>

    {/* Daily Spark card pinned below header */}
    {spark && <SparkPanel
      spark={spark}
      matchId={matchId} myUserId={myUserId} other={other}
      onSparkUpdate={s => setSpark(s)}
      onBondUpdate={() => getBondInfo(matchId).then(setBond)}
    />}

    {/* Messages */}
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column" }}>
      {!loaded && <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13, padding: 20 }}>載入中...</div>}
      {renderMsgs()}
      {otherTyping && <TypingBubble url={other.avatar} name={other.name} sim={true} />}
      <div ref={bottomRef} />
    </div>

    {/* Reply preview */}
    {replyTo && <div style={{ padding: "8px 16px", background: "rgba(255,56,92,0.08)", borderTop: `1px solid rgba(255,56,92,0.2)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: 12, color: C.textMuted }}>↩️ 回覆：{replyTo.content.slice(0, 40)}{replyTo.content.length > 40 ? "..." : ""}</div>
      <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>✕</button>
    </div>}

    {/* Pending image */}
    {pendingImg && <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <img src={pendingImg.preview} alt="" style={{ height: 56, width: 56, objectFit: "cover" as const, borderRadius: 8 }} />
      <div style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>準備發送相片</div>
      <button onClick={() => setPendingImg(null)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>
    </div>}

    {/* Input */}
    <div style={{ padding: "10px 14px 16px", background: "rgba(9,9,15,0.96)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}` }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) addImg(e.target.files[0]); }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) addImg(e.target.files[0]); }} />
      <div ref={inputRef} style={{ position: "relative" }}>
        {showEmoji && <EmojiPanel onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${showEmoji ? `${ac}55` : C.border}`, borderRadius: 26, padding: "8px 8px 8px 6px", transition: "border-color .2s" }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = `${ac}55`)}
          onBlurCapture={e => { if (!showEmoji) e.currentTarget.style.borderColor = C.border; }}>
          <button onClick={() => { setShowEmoji(p => !p); sound.tap(); }} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: showEmoji ? `rgba(255,56,92,0.18)` : "transparent", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showEmoji ? ac : C.textMuted }}>😊</button>
          <button onClick={() => fileRef.current?.click()} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "transparent", border: "none", color: C.textMuted, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="上傳相片" onMouseEnter={e => (e.currentTarget.style.color = ac)} onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>🖼️</button>
          <button onClick={() => cameraRef.current?.click()} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "transparent", border: "none", color: C.textMuted, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="拍攝" onMouseEnter={e => (e.currentTarget.style.color = C.teal)} onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>📷</button>
          <textarea ref={textRef} value={input} onChange={e => { handleInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`傳訊息給 ${other.name}...`} rows={1} style={{ background: "transparent", border: "none", outline: "none", color: C.text, resize: "none", fontSize: 14.5, lineHeight: 1.55, width: "100%", maxHeight: 100, overflowY: "auto", paddingTop: 5, fontFamily: "'Plus Jakarta Sans','Noto Sans TC',sans-serif" }} />
          <button onClick={send} style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: (input.trim() || pendingImg) ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", fontFamily: "inherit", boxShadow: (input.trim() || pendingImg) ? `0 3px 14px rgba(255,56,92,0.5)` : "none" }}><span style={{ marginLeft: 2 }}>➤</span></button>
        </div>
      </div>
    </div>

    {/* Other profile */}
    {showOtherProfile && otherProfileData && <OtherProfileModal profile={otherProfileData} onClose={() => setShowOtherProfile(false)} />}
    {showMemory && <MemoryWall matchId={matchId} otherName={other.name} onClose={() => setShowMemory(false)} />}
    {showMemory && <MemoryWall matchId={matchId} otherName={other.name} onClose={() => setShowMemory(false)} />}

    {/* Msg menu */}
    {menuMsg && <MsgMenu msg={menuMsg} isMe={menuMsg.senderId === myUserId}
      onCopy={() => navigator.clipboard?.writeText(menuMsg.content)}
      onDelete={() => deleteMsg(menuMsg.id)}
      onReply={() => setReplyTo(menuMsg)}
      onAnalyze={menuMsg.senderId !== myUserId ? () => setAnalysisTarget(menuMsg) : undefined}
      onClose={() => setMenuMsg(null)} />}

    {/* Analysis sheet */}
    {analysisTarget && <AnalysisSheet
      msg={analysisTarget}
      context={msgs.map(m => ({ ...m, senderId: m.senderId === myUserId ? "me" : "other" }))}
      gender={myProfile.gender}
      mbti={myProfile.mbti}
      cache={analysisCache}
      onCache={(id, r) => setAnalysisCache(p => new Map(p).set(id, r))}
      onClose={() => setAnalysisTarget(null)} />}

    {/* Report */}
    {showReport && <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(4,3,14,0.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowReport(false)}>
      <div onClick={e => e.stopPropagation()} style={{ ...MAX_W, background: C.surf, borderRadius: "24px 24px 0 0", border: `1px solid ${C.border}`, padding: "28px 24px 44px", animation: "slideUp .32s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 22px" }} />
        <div style={{ marginBottom: 8 }}>
          {REPORT_CATEGORIES.map((cat, i) => <button key={cat.id} onClick={async () => { await reportUser(myUserId, other.id, cat.label, cat.id); alert("已檢舉，我們將盡快審核"); setShowReport(false); }} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: "inherit", fontSize: 13.5, cursor: "pointer", marginBottom: 8, textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "background .15s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}><span style={{fontSize:18}}>{cat.icon}</span>{cat.label}</button>)}
        </div>
        <div style={{ height: 1, background: C.border, marginBottom: 10 }} />
        <button onClick={async () => { await blockUser(myUserId, other.id); setShowReport(false); onBack(); }} style={{ width: "100%", padding: "13px", borderRadius: 14, background: "rgba(255,60,60,0.06)", border: "1px solid rgba(255,60,60,0.2)", color: "#FF6B6B", fontFamily: "inherit", fontSize: 14, cursor: "pointer", marginBottom: 8 }}>封鎖 {other.name}</button>
        <button onClick={() => setShowReport(false)} style={{ width: "100%", padding: "11px", borderRadius: 14, background: "transparent", border: "none", color: C.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>取消</button>
      </div>
    </div>}
  </div>;
}
