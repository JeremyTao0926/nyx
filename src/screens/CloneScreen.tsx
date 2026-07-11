import { useState, useEffect, useRef } from "react";
import { C, sb, sound, groqChat, getDailyLikeStatus } from "../utils";
import type { UserProfile, MatchItem } from "../types";

/* ─── Types ──────────────────────────────────────────── */
interface PersonaProfile {
  style: string;
  avgLength: string;
  emojiFreq: string;
  humor: string;
  warmth: string;
  flirting: string;
  signature: string[];
  styleDescription: string;  // plain language description
}

interface SimMessage {
  id: string;
  role: "user" | "clone";
  content: string;
  isContext?: boolean; // imported from real chat, read-only
  createdAt: Date;
}

interface CloneSession {
  id: string;
  cloneName: string;
  cloneAvatar: string;
  persona: PersonaProfile;
  mode: "continue" | "fresh";
  importedMsgs: SimMessage[];  // real chat context
}

type CloneMode = "continue" | "fresh";

/* ─── Build persona — style only, NO copy-paste ──────── */
async function buildPersona(
  matchId: string, cloneUserId: string, cloneName: string
): Promise<PersonaProfile> {
  const { data: msgs } = await sb.from("chat_messages")
    .select("sender_id, content")
    .eq("match_id", matchId)
    .not("content", "like", "[SPARK_REACT]%")
    .not("content", "like", "https://%")
    .order("created_at", { ascending: false })
    .limit(300);

  const cloneMsgs = (msgs || [])
    .filter((m: any) => m.sender_id === cloneUserId)
    .map((m: any) => m.content)
    .slice(0, 100);

  if (cloneMsgs.length < 5) {
    return {
      style: "casual", avgLength: "short", emojiFreq: "low",
      humor: "medium", warmth: "neutral", flirting: "none",
      signature: [], styleDescription: "說話簡短直接"
    };
  }

  const sample = cloneMsgs.slice(0, 60).join("\n");
  const prompt = `分析以下「${cloneName}」的聊天消息風格特徵。
  
消息樣本：
${sample}

只輸出JSON，不加任何解釋：
{
  "style": "一個詞描述整體風格，如playful/cool/sweet/cold/energetic",
  "avgLength": "very_short(1-5字)/short(5-15字)/medium(15-40字)/long(40+字)",
  "emojiFreq": "none/low/medium/high",
  "humor": "low/medium/high",
  "warmth": "cold/neutral/warm/very_warm",
  "flirting": "none/subtle/moderate/direct",
  "signature": ["最多4個他/她的口頭禪或常用表達，直接引用原文"],
  "styleDescription": "用一句話描述這個人的說話風格，例如：說話很短，偶爾用梗，不太主動"
}`;

  try {
    const raw = await groqChat(
      [{ role: "user", content: prompt }],
      "你是說話風格分析師。只輸出合法JSON。"
    );
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return {
      style: "casual", avgLength: "short", emojiFreq: "low",
      humor: "medium", warmth: "neutral", flirting: "none",
      signature: [], styleDescription: "說話風格隨意自然"
    };
  }
}

/* ─── Load real chat context for Continue mode ────────── */
async function loadRecentContext(matchId: string, limit = 20): Promise<{
  senderId: string; content: string; createdAt: string;
}[]> {
  const { data } = await sb.from("chat_messages")
    .select("sender_id, content, created_at")
    .eq("match_id", matchId)
    .not("content", "like", "[SPARK_REACT]%")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data || []) as any[]).reverse();
}

/* ─── System prompts ─────────────────────────────────── */
function buildFreshPrompt(cloneName: string, p: PersonaProfile, myName: string): string {
  const lengthGuide: Record<string,string> = {
    very_short: "回覆極短，1-5個字",
    short: "回覆短，5-15個字",
    medium: "回覆中等，15-40個字",
    long: "回覆較長，可超過40字"
  };
  const emojiGuide: Record<string,string> = {
    none: "從不用表情符號",
    low: "偶爾用1個表情",
    medium: "適量用表情",
    high: "頻繁使用表情"
  };

  return `你就是「${cloneName}」本人，正在和「${myName}」聊天。

你的真實說話特點：
- ${p.styleDescription}
- 回覆長度：${lengthGuide[p.avgLength] || "簡短"}
- 表情符號：${emojiGuide[p.emojiFreq] || "偶爾用"}
- 幽默感：${p.humor === "high" ? "很愛開玩笑" : p.humor === "medium" ? "偶爾幽默" : "不太開玩笑"}
- 調情方式：${p.flirting === "none" ? "完全不調情" : p.flirting === "subtle" ? "非常隱晦" : p.flirting === "moderate" ? "適度" : "比較直接"}
${p.signature.length > 0 ? `- 你的口頭禪：${p.signature.join("、")}` : ""}

關鍵規則：
1. 生成符合你風格的【全新回覆】，禁止複製或改寫你過去說過的話
2. 直接回覆，不要解釋，不要分析
3. 絕對不說自己是AI、機器人或模擬
4. 不要一次回答太多問題，保持自然聊天節奏
5. 回覆長度嚴格按照你的風格`;
}

function buildContinuePrompt(
  cloneName: string, p: PersonaProfile, myName: string,
  contextMsgs: { role: "user"|"clone"; content: string }[]
): string {
  const contextStr = contextMsgs.slice(-12).map(m =>
    `${m.role === "user" ? myName : cloneName}：${m.content}`
  ).join("\n");

  return `你就是「${cloneName}」本人，以下是你們最近的真實聊天記錄。

真實對話記錄（最近）：
${contextStr}

你的說話特點：${p.styleDescription}
${p.signature.length > 0 ? `口頭禪：${p.signature.join("、")}` : ""}
回覆長度偏好：${p.avgLength === "very_short" || p.avgLength === "short" ? "短" : "中等"}

規則：
1. 根據對話脈絡，用你的真實說話風格生成【自然的下一句話】
2. 考慮對方說了什麼，做出符合你性格的真實反應
3. 禁止複製過去說過的話
4. 不要解釋自己的行為，直接說話
5. 絕對不說自己是AI`;
}

/* ─── Mode select screen ─────────────────────────────── */
function ModeSelect({ cloneName, onSelect }: { cloneName: string; onSelect: (m: CloneMode) => void }) {
  return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13.5, color: C.textMuted, textAlign: "center" as const, marginBottom: 8 }}>
        選擇模擬模式
      </div>

      {/* Continue mode */}
      <button onClick={() => onSelect("continue")}
        style={{ background: C.bgCard, border: `1px solid ${C.gold}44`, borderRadius: 18, padding: "20px 20px", textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.gold)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = `${C.gold}44`)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>延續對話</div>
        </div>
        <div style={{ fontSize: 13.5, color: C.textSub, lineHeight: 1.65 }}>
          導入你們最近的真實聊天記錄<br/>
          練習下一句怎麼說，AI 模擬 {cloneName} 可能的反應<br/>
          <span style={{ color: C.gold, fontSize: 12 }}>適合：不知道怎麼接話、想試試不同策略</span>
        </div>
      </button>

      {/* Fresh mode */}
      <button onClick={() => onSelect("fresh")}
        style={{ background: C.bgCard, border: `1px solid rgba(201,168,76,0.25)`, borderRadius: 18, padding: "20px 20px", textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.gold)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)")}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>✨</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>全新開始</div>
        </div>
        <div style={{ fontSize: 13.5, color: C.textSub, lineHeight: 1.65 }}>
          不帶任何歷史記錄，用 {cloneName} 的說話風格<br/>
          從零開始模擬一段對話<br/>
          <span style={{ color: C.textMuted, fontSize: 12 }}>適合：測試破冰、練習不同話題</span>
        </div>
      </button>
    </div>
  );
}

/* ─── Loading ─────────────────────────────────────────── */
function CloneLoading({ name, mode }: { name: string; mode: CloneMode }) {
  const [step, setStep] = useState(0);
  const steps = mode === "continue"
    ? ["讀取聊天記錄...", "分析說話風格...", "建立人格模型...", "準備就緒"]
    : ["分析說話風格...", "建立人格模型...", "準備就緒"];

  useEffect(() => {
    const iv = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24, padding: 32 }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🪞</div>
        <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.gold}`, animation: "spin 1.5s linear infinite", borderTopColor: "transparent" }}/>
      </div>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>建立 {name} Clone</div>
        <div style={{ fontSize: 13.5, color: C.gold }}>{steps[step]}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= step ? C.gold : C.border, transition: "all .3s" }}/>)}
      </div>
    </div>
  );
}

/* ─── Chat UI ─────────────────────────────────────────── */
function CloneChat({ session, myProfile, onReset }: {
  session: CloneSession; myProfile: UserProfile; onReset: () => void;
}) {
  const [msgs, setMsgs] = useState<SimMessage[]>(session.importedMsgs);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const myName = myProfile.display_name || myProfile.username;
  const isContinue = session.mode === "continue";

  // Build history for Groq (exclude context messages)
  function getConvoHistory() {
    return msgs
      .filter(m => !m.isContext)
      .map(m => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const txt = input.trim();
    if (!txt || generating) return;
    setInput(""); setGenerating(true);
    if (textRef.current) { textRef.current.value = ""; textRef.current.style.height = "auto"; }

    const userMsg: SimMessage = { id: Date.now()+"u", role: "user", content: txt, createdAt: new Date() };
    setMsgs(p => [...p, userMsg]);

    try {
      const history = getConvoHistory();
      // Build context-aware prompt
      const sysPrompt = isContinue
        ? buildContinuePrompt(session.cloneName, session.persona, myName,
            [...msgs.filter(m => !m.isContext).map(m => ({ role: m.role as "user"|"clone", content: m.content })),
             { role: "user", content: txt }])
        : buildFreshPrompt(session.cloneName, session.persona, myName);

      const reply = await groqChat(
        [...history, { role: "user" as const, content: txt }],
        sysPrompt
      );

      const cloneMsg: SimMessage = { id: Date.now()+"c", role: "clone", content: reply, createdAt: new Date() };
      setMsgs(p => [...p, cloneMsg]);
      sound.pop();

      // Save to DB
      sb.from("simulation_messages").insert([
        { session_id: session.id, role: "user", content: txt },
        { session_id: session.id, role: "clone", content: reply },
      ]).then(() => {
        sb.from("simulation_sessions").update({ last_active_at: new Date().toISOString() }).eq("id", session.id);
      });
    } catch {
      setMsgs(p => [...p, { id: Date.now()+"e", role: "clone" as const, content: "...", createdAt: new Date() }]);
    }
    setGenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Context imported notice */}
      {isContinue && session.importedMsgs.length > 0 && (
        <div style={{ padding: "8px 16px", background: "rgba(201,168,76,0.07)", borderBottom: `1px solid ${C.border}`, textAlign: "center" as const }}>
          <span style={{ fontSize: 11.5, color: C.textMuted }}>
            ↑ 導入了最近 {session.importedMsgs.length} 條真實對話作為背景
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {msgs.map(m => {
          const isMe = m.role === "user";
          const isCtx = m.isContext;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginBottom: isCtx ? 6 : 10, opacity: isCtx ? 0.55 : 1 }}>
              {!isMe && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: session.cloneAvatar ? `url(${session.cloneAvatar}) center/cover` : C.grad, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.bg, fontWeight: 700 }}>
                  {!session.cloneAvatar && session.cloneName[0]}
                </div>
              )}
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                <div style={{ padding: "10px 14px",
                  borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                  background: isMe ? C.grad : isCtx ? "rgba(255,255,255,0.06)" : "rgba(28,22,14,0.98)",
                  border: isMe ? undefined : isCtx ? `1px solid ${C.border}` : `1px solid ${C.gold}18`,
                  color: "#fff", fontSize: 14.5, lineHeight: 1.6,
                  whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.content}
                </div>
                {isCtx && (
                  <div style={{ fontSize: 9.5, color: C.textDim, marginTop: 2, fontStyle: "italic" }}>真實記錄</div>
                )}
              </div>
            </div>
          );
        })}

        {generating && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: session.cloneAvatar ? `url(${session.cloneAvatar}) center/cover` : C.grad, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.bg, fontWeight: 700 }}>
              {!session.cloneAvatar && session.cloneName[0]}
            </div>
            <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: "rgba(28,22,14,0.98)", border: `1px solid ${C.gold}18` }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, display: "inline-block", animation: `dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}
              </div>
            </div>
          </div>
        )}

        {/* Try different button */}
        {msgs.filter(m => !m.isContext).length > 0 && !generating && (
          <div style={{ textAlign: "center" as const, marginTop: 8, marginBottom: 8 }}>
            <button onClick={onReset} style={{ fontSize: 12, color: C.textMuted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit" }}>
              換個模式試試
            </button>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px 28px", borderTop: `1px solid ${C.border}`, background: "rgba(12,10,8,0.96)", backdropFilter: "blur(20px)" }}>
        {isContinue && msgs.filter(m => !m.isContext).length === 0 && (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" as const, marginBottom: 8 }}>
            試試你接下來想說的話 ↓
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "8px 8px 8px 14px" }}>
          <textarea ref={textRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isContinue ? "試試你下一句想說..." : `給 ${session.cloneName} 發消息...`}
            rows={1}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, resize: "none", fontSize: 14.5, lineHeight: 1.55, width: "100%", maxHeight: 100, overflowY: "auto", fontFamily: "inherit" }}/>
          <button onClick={send} disabled={!input.trim() || generating}
            style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: (input.trim() && !generating) ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main CloneScreen ───────────────────────────────── */
export function CloneScreen({ matchId, myUserId, myProfile, other, onClose }: {
  matchId: string; myUserId: string; myProfile: UserProfile; other: MatchItem; onClose: () => void;
}) {
  const [phase, setPhase] = useState<"select"|"loading"|"chat">("select");
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const isSwiping = useRef(false);
  const [mode, setMode] = useState<CloneMode>("fresh");
  const [session, setSession] = useState<CloneSession|null>(null);
  const [error, setError] = useState("");

  const [cloneStatus, setCloneStatus] = useState<{used:number;limit:number;plan:string}|null>(null);

  useEffect(() => {
    getDailyLikeStatus(myUserId).then(s => setCloneStatus({used: s.cloneUsed, limit: s.cloneLimit, plan: s.plan}));
  }, [myUserId]);

  async function startMode(m: CloneMode) {
    // Check clone limit
    const status = await getDailyLikeStatus(myUserId);
    if (status.cloneRemaining <= 0) {
      setError(`今日 Clone 次數已用完（${status.cloneUsed}/${status.cloneLimit}）
${status.plan === "free" ? "升級 Premium 獲得更多次數" : "明天再試"}`);
      return;
    }
    setMode(m); setPhase("loading"); setError("");
    try {
      // Get clone's profile
      const { data: otherProf } = await sb.from("profiles")
        .select("avatar_url,display_name,username")
        .eq("id", other.id).maybeSingle();
      const cloneName = otherProf?.display_name || otherProf?.username || other.name;
      const cloneAvatar = otherProf?.avatar_url || other.avatar || "";

      // Build persona
      const persona = await buildPersona(matchId, other.id, cloneName);

      // Import context for continue mode
      let importedMsgs: SimMessage[] = [];
      if (m === "continue") {
        const rawMsgs = await loadRecentContext(matchId, 16);
        importedMsgs = rawMsgs.map((msg: any, i: number) => ({
          id: `ctx-${i}`,
          role: msg.sender_id === myUserId ? "user" as const : "clone" as const,
          content: msg.content,
          isContext: true,
          createdAt: new Date(msg.createdAt),
        }));
      }

      // Create session
      const { data: sess } = await sb.from("simulation_sessions").insert({
        user_id: myUserId, match_id: matchId, clone_user_id: other.id,
        clone_name: cloneName, clone_avatar: cloneAvatar,
        persona_profile: { ...persona, mode: m },
        messages_used: importedMsgs.length,
      }).select().single();

      // Increment clone_used_today
      await sb.from("profiles").update({ clone_used_today: (status.cloneUsed || 0) + 1 }).eq("id", myUserId);
      setSession({
        id: sess.id, cloneName, cloneAvatar, persona, mode: m, importedMsgs
      });
      setCloneStatus(s => s ? {...s, used: s.used+1} : s);
      setPhase("chat");
    } catch (e: any) {
      setError(e.message || "建立失敗"); setPhase("select");
    }
  }

  function onSwipeStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }
  function onSwipeMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (swipeStartX.current < 40 && dx > 0 && dy < 60) {
      isSwiping.current = true;
      setSwipeDx(Math.min(dx, 260));
    }
  }
  function onSwipeEnd() {
    if (isSwiping.current && swipeDx > 100) {
      if (phase === "chat") setPhase("select");
      else onClose();
    }
    setSwipeDx(0);
    isSwiping.current = false;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        style={{ width: "100%", maxWidth: 480, background: C.bg, display: "flex", flexDirection: "column", height: "100%", position: "relative",
          transform: `translateX(${swipeDx}px)`,
          transition: swipeDx === 0 ? "transform .3s cubic-bezier(.32,.72,0,1)" : "none",
          boxShadow: swipeDx > 10 ? "-8px 0 24px rgba(0,0,0,0.5)" : "none" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: "rgba(12,10,8,0.97)", backdropFilter: "blur(20px)", flexShrink: 0 }}>
          <button onClick={phase === "chat" ? () => setPhase("select") : onClose}
            style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit" }}>
            {phase === "chat" ? "‹" : "✕"}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🪞</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {other.name} · {mode === "continue" ? "延續對話" : "全新開始"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.gold, marginTop: 1 }}>AI 模擬 · 不影響真實對話</div>
          </div>
          {phase === "chat" && (
            <button onClick={() => setPhase("select")}
              style={{ fontSize: 11.5, color: C.textMuted, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 14, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
              換模式
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {phase === "select" && <ModeSelect cloneName={other.name} onSelect={startMode}/>}
          {phase === "loading" && <CloneLoading name={other.name} mode={mode}/>}
          {phase === "chat" && session && (
            <CloneChat session={session} myProfile={myProfile} onReset={() => setPhase("select")}/>
          )}
          {error && (
            <div style={{ padding: 24, textAlign: "center" as const }}>
              <div style={{ color: C.rose, fontSize: 14, marginBottom: 12 }}>{error}</div>
              <button onClick={() => setPhase("select")} style={{ padding: "10px 24px", borderRadius: 20, background: C.grad, border: "none", color: C.bg, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>重試</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
