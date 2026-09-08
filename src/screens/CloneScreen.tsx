import { useState, useEffect, useRef } from "react";
import { C, sb, sound, groqChat, getDailyLikeStatus } from "../utils";
import type { UserProfile, MatchItem, SimulationMessage, SimulationPersona } from "../types";
import { resolveAvatar } from "../avatar";
import { analyzeSimulationPersona, buildSimulationSystemPrompt, simulationConfidenceLabel, toGroqHistory } from "../simulation";

/* ─── Types ──────────────────────────────────────────── */
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
  persona: SimulationPersona;
  mode: "continue" | "fresh";
  importedMsgs: SimMessage[];  // real chat context
}

type CloneMode = "continue" | "fresh";

const CONTINUE_LOADING_STEPS = ["讀取聊天記錄...", "分析說話風格...", "建立人格模型...", "準備就緒"];
const FRESH_LOADING_STEPS = ["分析說話風格...", "建立人格模型...", "準備就緒"];

/* ─── Load every usable real message, page by page ───── */
async function loadAllTrainingMessages(
  matchId: string,
  myUserId: string,
  cloneUserId: string,
): Promise<SimulationMessage[]> {
  const pageSize = 500;
  const result: SimulationMessage[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from("chat_messages")
      .select("sender_id,content,created_at")
      .eq("match_id", matchId)
      .not("content", "like", "[SPARK_REACT]%")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const content = typeof row.content === "string" ? row.content.trim() : "";
      if (!content || (/^https?:\/\/\S+$/.test(content) && !content.includes(" "))) continue;
      if (row.sender_id !== myUserId && row.sender_id !== cloneUserId) continue;
      result.push({
        from: row.sender_id === cloneUserId ? "target" : "me",
        text: content,
        createdAt: row.created_at,
      });
    }
    if (rows.length < pageSize) break;
  }
  return result;
}

/* ─── Load real chat context for Continue mode ────────── */
async function loadRecentContext(matchId: string, limit = 20): Promise<{
  senderId: string; content: string; createdAt: string;
}[]> {
  const { data, error } = await sb.from("chat_messages")
    .select("sender_id, content, created_at")
    .eq("match_id", matchId)
    .not("content", "like", "[SPARK_REACT]%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse().map(row => ({
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  }));
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
        style={{ background: C.bgCard, border: `1px solid ${C.borderHigh}`, borderRadius: 18, padding: "20px 20px", textAlign: "left" as const, cursor: "pointer", fontFamily: "inherit", transition: "all .2s", boxShadow:C.shadow }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.gold)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = C.borderHigh)}>
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
function CloneLoading({ name, mode, detail }: { name: string; mode: CloneMode; detail?: string }) {
  const [step, setStep] = useState(0);
  const steps = mode === "continue" ? CONTINUE_LOADING_STEPS : FRESH_LOADING_STEPS;
  const stepCount = steps.length;

  useEffect(() => {
    const iv = setInterval(() => setStep(s => Math.min(s + 1, stepCount - 1)), 900);
    return () => clearInterval(iv);
  }, [stepCount]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24, padding: 32 }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🪞</div>
        <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.gold}`, animation: "spin 1.5s linear infinite", borderTopColor: "transparent" }}/>
      </div>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>建立 {name} Clone</div>
        <div style={{ fontSize: 13.5, color: C.gold }}>{detail || steps[step]}</div>
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

  // Keep the full simulation in the UI/DB, but send only the recent turn
  // window. Long-term style memory lives in the persona and retrieved examples.
  function getConvoHistory() {
    return toGroqHistory(msgs
      .filter(message => !message.isContext)
      .map(message => ({ role: message.role, content: message.content })));
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
      const realContext: SimulationMessage[] = isContinue
        ? session.importedMsgs.map(message => ({
            from: message.role === "clone" ? "target" : "me",
            text: message.content,
            createdAt: message.createdAt.toISOString(),
          }))
        : [];
      const sysPrompt = buildSimulationSystemPrompt({
        targetName: session.cloneName,
        myName,
        persona: session.persona,
        userInput: txt,
        realContext,
      });

      const reply = await groqChat(
        [...history, { role: "user" as const, content: txt }],
        sysPrompt,
        undefined,
        260,
        0.72,
      );

      const cloneMsg: SimMessage = { id: Date.now()+"c", role: "clone", content: reply, createdAt: new Date() };
      setMsgs(p => [...p, cloneMsg]);
      sound.pop();

      // Save to DB
      void sb.from("simulation_messages").insert([
        { session_id: session.id, role: "user", content: txt },
        { session_id: session.id, role: "clone", content: reply },
      ]).then(({ error }) => {
        if (error) console.error("Unable to save simulation messages", error);
        return sb.from("simulation_sessions").update({ last_active_at: new Date().toISOString() }).eq("id", session.id);
      });
    } catch (error) {
      console.error("Simulation response failed", error);
      setMsgs(p => [...p, { id: Date.now()+"e", role: "clone" as const, content: "暫時無法模擬，請再試一次。", createdAt: new Date() }]);
    }
    setGenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Context imported notice */}
      {isContinue && session.importedMsgs.length > 0 && (
        <div style={{ padding: "8px 16px", background: C.goldSoft, borderBottom: `1px solid ${C.border}`, textAlign: "center" as const }}>
          <span style={{ fontSize: 11.5, color: C.textMuted }}>
            ↑ 最近 {session.importedMsgs.length} 條作為即時脈絡 · 全部 {session.persona.sourceMessageCount} 條已學習 · {simulationConfidenceLabel(session.persona)} · AI 推測
          </span>
        </div>
      )}
      {!isContinue && (
        <div style={{ padding: "8px 16px", background: C.goldSoft, borderBottom: `1px solid ${C.border}`, textAlign: "center" as const }}>
          <span style={{ fontSize: 11.5, color: C.textMuted }}>
            {simulationConfidenceLabel(session.persona)} · 已學習 {session.persona.sourceMessageCount} 條對方訊息 · AI 推測，不代表本人
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
                  background: isMe ? C.grad : isCtx ? C.surfHigh : C.bgCard,
                  border: isMe ? undefined : isCtx ? `1px solid ${C.border}` : `1px solid ${C.gold}18`,
                  color: isMe ? "#fff" : C.text, fontSize: 14.5, lineHeight: 1.6,
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
            <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: C.bgCard, border: `1px solid ${C.border}`, boxShadow:C.shadow }}>
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
      <div style={{ padding: "10px 14px 28px", borderTop: `1px solid ${C.border}`, background: C.nav, backdropFilter: "blur(24px) saturate(145%)" }}>
        {isContinue && msgs.filter(m => !m.isContext).length === 0 && (
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" as const, marginBottom: 8 }}>
            試試你接下來想說的話 ↓
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 24, padding: "8px 8px 8px 14px", boxShadow:"0 5px 18px rgba(57,42,101,0.06)" }}>
          <textarea ref={textRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isContinue ? "試試你下一句想說..." : `給 ${session.cloneName} 發消息...`}
            rows={1}
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, resize: "none", fontSize: 14.5, lineHeight: 1.55, width: "100%", maxHeight: 100, overflowY: "auto", fontFamily: "inherit" }}/>
          <button onClick={send} disabled={!input.trim() || generating}
            style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: (input.trim() && !generating) ? C.grad : C.surfHigh, border: "none", color: (input.trim() && !generating) ? "#fff" : C.textDim, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
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
  const [trainingDetail, setTrainingDetail] = useState("");

  async function startMode(m: CloneMode) {
    // Check clone limit
    const status = await getDailyLikeStatus(myUserId);
    if (status.cloneRemaining <= 0) {
      setError(`今日 Clone 次數已用完（${status.cloneUsed}/${status.cloneLimit}）
${status.plan === "free" ? "升級 Premium 獲得更多次數" : "明天再試"}`);
      return;
    }
    setMode(m); setPhase("loading"); setError(""); setTrainingDetail("讀取全部可用聊天記錄…");
    try {
      // Get clone's profile
      const { data: otherProf } = await sb.from("profiles")
        .select("avatar_url,gender,display_name,username")
        .eq("id", other.id).maybeSingle();
      const cloneName = otherProf?.display_name || otherProf?.username || other.name;
      const cloneAvatar = resolveAvatar(otherProf?.avatar_url || other.avatar,otherProf?.gender);

      // Page through all available messages, then compress them into a
      // hierarchical persona. There is no arbitrary 60/100/300-message cap.
      const trainingMessages = await loadAllTrainingMessages(matchId, myUserId, other.id);
      const persona = await analyzeSimulationPersona(cloneName, trainingMessages, progress => {
        setTrainingDetail(progress.label);
      });

      // Import context for continue mode
      let importedMsgs: SimMessage[] = [];
      if (m === "continue") {
        const rawMsgs = await loadRecentContext(matchId, 24);
        importedMsgs = rawMsgs.map((msg, i) => ({
          id: `ctx-${i}`,
          role: msg.senderId === myUserId ? "user" as const : "clone" as const,
          content: msg.content,
          isContext: true,
          createdAt: new Date(msg.createdAt),
        }));
      }

      // The database validates match ownership and records daily usage in one
      // transaction so concurrent taps cannot bypass limits.
      const { data: sessionId, error: sessionError } = await sb.rpc("create_private_simulation_session", {
        p_match_id: matchId,
        p_clone_user_id: other.id,
        p_clone_name: cloneName,
        p_clone_avatar: cloneAvatar || null,
        p_persona_profile: { ...persona, mode: m },
        p_messages_used: trainingMessages.length,
        p_source_batch_count: persona.sourceBatchCount,
        p_mode: m,
      });
      if (sessionError) throw sessionError;
      if (typeof sessionId !== "string") throw new Error("無法建立模擬工作階段");

      setSession({
        id: sessionId, cloneName, cloneAvatar, persona, mode: m, importedMsgs
      });
      setPhase("chat");
    } catch (e: unknown) {
      const rawMessage = e instanceof Error ? e.message : "建立失敗";
      const message = rawMessage.includes("CLONE_DAILY_LIMIT_REACHED")
        ? "今日模擬次數已用完，請明天再試或升級方案。"
        : rawMessage.includes("SIMULATION_NOT_ALLOWED")
          ? "這段配對目前無法建立模擬。"
          : rawMessage;
      setError(message); setPhase("select");
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
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "center", background: C.overlay, backdropFilter:"blur(14px)" }}>
      <div
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        style={{ width: "100%", maxWidth: 480, background: C.bg, display: "flex", flexDirection: "column", height: "100%", position: "relative",
          transform: `translateX(${swipeDx}px)`,
          transition: swipeDx === 0 ? "transform .3s cubic-bezier(.32,.72,0,1)" : "none",
          boxShadow: swipeDx > 10 ? "-8px 0 28px rgba(57,42,101,0.24)" : "none" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: C.nav, backdropFilter: "blur(24px) saturate(145%)", flexShrink: 0 }}>
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
              style={{ fontSize: 11.5, color: C.textMuted, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
              換模式
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {phase === "select" && <ModeSelect cloneName={other.name} onSelect={startMode}/>}
          {phase === "loading" && <CloneLoading name={other.name} mode={mode} detail={trainingDetail}/>}
          {phase === "chat" && session && (
            <CloneChat session={session} myProfile={myProfile} onReset={() => setPhase("select")}/>
          )}
          {error && (
            <div style={{ padding: 24, textAlign: "center" as const }}>
              <div style={{ color: C.rose, fontSize: 14, marginBottom: 12 }}>{error}</div>
              <button onClick={() => setPhase("select")} style={{ padding: "10px 24px", borderRadius: 20, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>重試</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
