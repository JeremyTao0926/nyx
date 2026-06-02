import { useState, useEffect, useRef } from "react";
import { C, sound, fmtTime, buildSys, groqChat, groqVision, toB64, getOrCreateConv, loadNyxMsgs, saveNyxMsg, loadHistory, saveHistory, updateProfile, splitA, splitC, detMs, casMs, sleep, detectMode, saveAnalysis, loadAnalysisHistory, mbtiCompatibility } from "../utils";
import { Av, TypingBubble, NyxText, Lightbox, NyxAnalysisSheet } from "../components/Atoms";
import { MbtiSheet, EmojiPanel, SimulateModal } from "../components/Modals";
import type { Msg, GMsg, ImgItem, ExtractedConvo, LB, AppMode, UserProfile, NyxAnalysis } from "../types";

/* ─── Nyx Analysis Sheet ─────────────────────────────── */
export function NyxChatScreen({ userId, profile, onBack }: { userId: string; profile: UserProfile; onBack: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); const [hist, setHist] = useState<GMsg[]>([]);
  const [convId, setConvId] = useState<string | null>(null); const [loaded, setLoaded] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("normal");
  const [simMsgs, setSimMsgs] = useState<Msg[]>([]); const [simHist, setSimHist] = useState<GMsg[]>([]);
  const [simImgs, setSimImgs] = useState<ImgItem[]>([]); const [simName, setSimName] = useState(""); const [simStyle, setSimStyle] = useState(""); const [simAvatar, setSimAvatar] = useState("");
  const [mbti, setMbti] = useState(profile.mbti || "INFP"); const [gender, setGender] = useState<"male" | "female">(profile.gender || "male");
  const [typing, setTyping] = useState(false); const [pendingImgs, setPendingImgs] = useState<ImgItem[]>([]);
  const [showEmoji, setShowEmoji] = useState(false); const [showMbti, setShowMbti] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [menuMsg, setMenuMsg] = useState<Msg | null>(null);
  const [analysisTarget, setAnalysisTarget] = useState<{ msg: Msg; isUser: boolean } | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Map<string, string>>(new Map());
  const [lb, setLb] = useState<LB>(null);
  const bottomRef = useRef<HTMLDivElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null); const inputRef = useRef<HTMLDivElement>(null);
  const isSim = appMode === "simulate"; const curMsgs = isSim ? simMsgs : msgs;

  useEffect(() => {
    (async () => {
      const cid = await getOrCreateConv(userId); setConvId(cid);
      const [m, h] = await Promise.all([loadNyxMsgs(cid), loadHistory(cid)]);
      if (m.length === 0) { const w: Msg = { id: "w0", from: "nyx", text: "嗨 👋\n\n把你和她的聊天貼給我，或上傳截圖，我來分析。\n或者直接問我任何問題 💬", timestamp: new Date() }; setMsgs([w]); await saveNyxMsg(cid, "nyx", w.text!); } else setMsgs(m);
      setHist(h); setLoaded(true);
    })();
  }, [userId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, simMsgs, typing]);
  useEffect(() => { if (!showEmoji) return; const h = (e: MouseEvent) => { if (inputRef.current && !inputRef.current.contains(e.target as Node)) setShowEmoji(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [showEmoji]);

  function addMsg(m: Omit<Msg, "id" | "timestamp">) { const msg = { ...m, id: Date.now() + Math.random() + "", timestamp: new Date() }; if (isSim) setSimMsgs(p => [...p, msg]); else setMsgs(p => [...p, msg]); }
  function addImages(files: FileList) { Array.from(files).slice(0, 10 - pendingImgs.length).forEach(file => { const r = new FileReader(); r.onloadend = () => setPendingImgs(p => [...p, { file, preview: r.result as string }]); r.readAsDataURL(file); }); }
  function insertEmoji(e: string) { const el = textRef.current; if (!el) return; const s = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? el.value.length; el.value = el.value.slice(0, s) + e + el.value.slice(en); el.selectionStart = el.selectionEnd = s + e.length; el.focus(); el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 130) + "px"; }

  async function streamChunks(chunks: string[], det: boolean, saver?: (t: string) => void) {
    for (let i = 0; i < chunks.length; i++) {
      setTyping(true); await sleep(det ? detMs(chunks[i]) : casMs(chunks[i]));
      setTyping(false); addMsg({ from: "nyx", text: chunks[i] }); saver?.(chunks[i]);
      if (i < chunks.length - 1) await sleep(200);
    }
    setTyping(false);
  }

  async function send() {
    const txt = textRef.current?.value?.trim() ?? ""; if (!txt && pendingImgs.length === 0) return;
    const cImgs = [...pendingImgs]; addMsg({ from: "user", text: txt || undefined, images: cImgs.map(i => i.preview) });
    if (convId && !isSim) saveNyxMsg(convId, "user", txt || "[圖片]");
    setPendingImgs([]); if (textRef.current) { textRef.current.value = ""; textRef.current.style.height = "auto"; }
    sound.send(); if (isSim) { await runSim(txt); return; }
    const isA = detectMode(txt, cImgs.length > 0) === "analysis";
    const sys = buildSys(mbti, gender);
    const note = isA ? "[分析模式]按格式完整分析每段獨立" : "[聊天模式]真實朋友短句最多2-3句不用格式";
    const uTxt = `${note}\n${txt}${cImgs.length > 0 && !txt ? " [截圖]" : ""}`;
    setTyping(true);
    try {
      let full: string;
      if (cImgs.length > 0) { const b64s = await Promise.all(cImgs.map(i => toB64(i.file))); const hCtx = hist.slice(-4).map(h => `${h.role === "user" ? "我" : "Nyx"}：${typeof h.content === "string" ? h.content : "[圖片]"}`).join("\n"); full = await groqVision(b64s, hCtx ? `近期：\n${hCtx}\n\n${uTxt}` : uTxt, sys); }
      else full = await groqChat([{ role: "system", content: sys }, ...hist, { role: "user", content: uTxt }]);
      const nH = [...hist, { role: "user" as const, content: uTxt }, { role: "assistant" as const, content: full }];
      setHist(nH); if (convId) saveHistory(convId, nH);
      const chunks = isA ? splitA(full) : splitC(full);
      await streamChunks(chunks, isA, t => { if (convId) saveNyxMsg(convId, "nyx", t); });
    } catch { setTyping(false); addMsg({ from: "nyx", text: "出了點問題 😔 請再試一次" }); }
  }

  async function runSim(txt: string) {
    setTyping(true);
    try {
      const full = await groqChat([{ role: "system", content: `你正在扮演一個真實女生。風格：${simStyle || "自然親切"}。直接用她的語氣回應，不要解釋。` }, ...simHist, { role: "user", content: txt || "[圖片]" }]);
      setSimHist(p => [...p, { role: "user", content: txt }, { role: "assistant", content: full }]);
      await streamChunks(splitC(full), false);
    } catch { setTyping(false); addMsg({ from: "nyx", text: "模擬失敗 😔" }); }
  }

  function enterSim(imgs: ImgItem[], mode: "new" | "continue", ex: ExtractedConvo | null) {
    setSimImgs(imgs); setSimName(ex?.name ?? ""); setSimStyle(ex?.styleDesc ?? ""); setShowSim(false);
    const init: Msg[] = [];
    if (mode === "continue" && ex?.messages.length) ex.messages.forEach((m, i) => init.push({ id: `ex${i}`, from: m.from === "me" ? "user" : "nyx", text: m.text, timestamp: new Date() }));
    init.push({ id: "ss", from: "nyx", text: mode === "new" ? `💭 模擬開始\n直接輸入你想對${ex?.name || "她"}說的話` : `💭 已載入對話\n接著打下一句吧`, timestamp: new Date() });
    setSimMsgs(init); setSimHist([]); setAppMode("simulate");
  }

  const ac = isSim ? "#ff9a3c" : C.pink;

  return <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: isSim ? "radial-gradient(ellipse 70% 40% at 50% 0%,rgba(255,154,60,0.06) 0%,transparent 70%)" : "radial-gradient(ellipse 70% 40% at 50% 0%,rgba(155,114,207,0.07) 0%,transparent 70%)", transition: "background .5s" }} />
    {/* Header - centered */}
    <div style={{ position: "relative", zIndex: 10, padding: "14px 16px", background: "rgba(8,6,20,0.95)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${isSim ? "rgba(255,154,60,0.2)" : C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit", width: 32, flexShrink: 0 }}>‹</button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{isSim ? (simName || "模擬對話") : "Nyx"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSim ? "#ff9a3c" : C.teal, boxShadow: `0 0 6px ${isSim ? "#ff9a3c" : C.teal}`, display: "inline-block" }} />
          <span style={{ fontSize: 11.5, color: isSim ? "rgba(255,154,60,0.8)" : `rgba(6,214,160,0.8)` }}>{isSim ? "模擬中..." : "AI 戀愛分析師"}{typing && " · 輸入中..."}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {isSim
          ? <button onClick={() => setAppMode("normal")} style={{ background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.35)", borderRadius: 20, padding: "5px 12px", color: "#ff9a3c", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>退出</button>
          : <button onClick={() => { setShowSim(true); sound.tap(); }} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ff9a3c"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textMuted; }}>💭</button>}
        {!isSim && <button onClick={() => setGender(g => g === "male" ? "female" : "male")} style={{ background: gender === "male" ? "rgba(100,180,255,0.12)" : "rgba(255,107,157,0.12)", border: gender === "male" ? "1px solid rgba(100,180,255,0.35)" : "1px solid rgba(255,107,157,0.35)", borderRadius: 20, padding: "5px 10px", color: gender === "male" ? "#a0d4ff" : C.pink, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{gender === "male" ? "♂" : "♀"}</button>}
        {!isSim && <button onClick={() => { setShowMbti(true); sound.tap(); }} style={{ background: "rgba(201,24,74,0.15)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 10px", color: C.pink, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✦ {mbti}</button>}
      </div>
    </div>
    {/* Messages */}
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 16px 12px", display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1 }}>
      {!loaded && <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted, fontSize: 13 }}>載入中...</div>}
      {curMsgs.map(msg => (
        <div key={msg.id} style={{ display: "flex", flexDirection: msg.from === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, animation: `${msg.from === "user" ? "userIn" : "nyxIn"} .3s cubic-bezier(.34,1.4,.64,1) both` }}
          onContextMenu={e => { e.preventDefault(); if (msg.text) setMenuMsg(msg); }}>
          {msg.from === "nyx" && (isSim ? <Av url={simAvatar} name={simName} size={30} grad="linear-gradient(145deg,#ff9a3c,#ff6b6b)" /> : <Av size={30} />)}
          <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: msg.from === "user" ? "flex-end" : "flex-start" }}>
            {msg.images && msg.images.length > 0 && <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: msg.text ? 6 : 0, justifyContent: msg.from === "user" ? "flex-end" : "flex-start" }}>{msg.images.map((src, i) => <img key={i} src={src} alt="" onClick={() => setLb({ images: msg.images!, index: i })} style={{ height: 72, width: 72, objectFit: "cover" as const, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "zoom-in" }} />)}</div>}
            {msg.text && <div style={{ padding: msg.from === "nyx" ? "14px 16px" : "11px 16px", borderRadius: msg.from === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px", background: msg.from === "user" ? C.grad : isSim ? "rgba(28,18,24,0.98)" : "rgba(16,12,36,0.98)", border: msg.from === "nyx" ? `1px solid ${isSim ? "rgba(255,154,60,0.12)" : C.border}` : undefined, boxShadow: msg.from === "user" ? `0 4px 20px rgba(255,56,92,0.3)` : "0 4px 16px rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
              {msg.from === "nyx" ? <NyxText text={msg.text} /> : <div style={{ fontSize: 14.5, color: "#fff", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.text}</div>}
            </div>}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexDirection: msg.from === "user" ? "row-reverse" : "row" }}>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>{fmtTime(msg.timestamp)}</div>
            </div>
          </div>
        </div>
      ))}
      {typing && <TypingBubble sim={isSim} name={simName} url={simAvatar} />}
      <div ref={bottomRef} />
    </div>
    {/* Input */}
    <div style={{ position: "relative", zIndex: 10, padding: "10px 14px 16px", background: "rgba(8,6,20,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${isSim ? "rgba(255,154,60,0.15)" : C.border}` }}>
      {pendingImgs.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" as const }}>
        {pendingImgs.map((img, i) => <div key={i} style={{ position: "relative" }}><img src={img.preview} alt="" style={{ height: 56, width: 56, objectFit: "cover" as const, borderRadius: 10, border: `1px solid ${ac}55` }} /><button onClick={() => setPendingImgs(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: C.pink, border: "none", color: "#fff", fontSize: 9, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button></div>)}
        {pendingImgs.length < 10 && <button onClick={() => fileRef.current?.click()} style={{ height: 56, width: 56, borderRadius: 10, border: `2px dashed ${ac}44`, background: "transparent", color: `${ac}66`, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
      </div>}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { if (e.target.files) addImages(e.target.files); }} />
      <div ref={inputRef} style={{ position: "relative" }}>
        {showEmoji && <EmojiPanel onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${showEmoji ? `${ac}55` : C.border}`, borderRadius: 26, padding: "8px 8px 8px 14px", transition: "border-color .2s" }} onFocusCapture={e => (e.currentTarget.style.borderColor = `${ac}55`)} onBlurCapture={e => { if (!showEmoji) e.currentTarget.style.borderColor = C.border; }}>
          <button onClick={() => { setShowEmoji(p => !p); sound.tap(); }} style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: showEmoji ? `${ac}22` : "transparent", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showEmoji ? ac : C.textMuted }}>😊</button>
          <button onClick={() => fileRef.current?.click()} style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "transparent", border: "none", color: C.textMuted, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }} onMouseEnter={e => (e.currentTarget.style.color = C.violet)} onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>⊕</button>
          <textarea ref={textRef} onChange={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={isSim ? `輸入你想對${simName || "她"}說的話...` : "貼上聊天內容，或問 Nyx 任何問題..."} rows={1} style={{ background: "transparent", border: "none", outline: "none", color: C.text, resize: "none", fontSize: 14.5, lineHeight: 1.55, width: "100%", maxHeight: 130, overflowY: "auto", paddingTop: 5, fontFamily: "'Plus Jakarta Sans','Noto Sans TC',sans-serif" }} />
          <button onClick={send} disabled={typing} style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(145deg,${ac},${isSim ? "#ff6b6b" : C.violet})`, border: "none", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 3px 14px ${ac}70`, transition: "all .2s", opacity: typing ? .5 : 1, fontFamily: "inherit" }}>{typing ? <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : <span style={{ marginLeft: 2 }}>➤</span>}</button>
        </div>
      </div>
      </div>
    {showMbti && <MbtiSheet mbti={mbti} onSelect={m => { setMbti(m); updateProfile(userId, { mbti: m }); }} onClose={() => setShowMbti(false)} />}
    {showSim && <SimulateModal onEnter={enterSim} onClose={() => setShowSim(false)} />}
    {lb && <Lightbox lb={lb} onClose={() => setLb(null)} />}

    {/* Long press menu */}
    {menuMsg && <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={() => setMenuMsg(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", minWidth: 200, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", animation: "springIn .2s ease" }}>
        {[
          { icon: "📋", label: "複製", fn: () => navigator.clipboard?.writeText(menuMsg.text || "") },
          { icon: menuMsg.from === "user" ? "🔍" : "🔍", label: menuMsg.from === "user" ? "這句話效果如何？" : "解讀對方訊息", fn: () => { setAnalysisTarget({ msg: menuMsg, isUser: menuMsg.from === "user" }); } },
        ].map((item, i) => <button key={i} onClick={() => { item.fn(); setMenuMsg(null); sound.tap(); }} style={{ width: "100%", padding: "14px 20px", background: "transparent", border: "none", borderBottom: i < 1 ? `1px solid ${C.border}` : "none", color: C.text, fontFamily: "inherit", fontSize: 14, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 12 }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{item.icon} {item.label}</button>)}
      </div>
    </div>}

    {/* Analysis sheet with cache */}
    {analysisTarget && <NyxAnalysisSheet
      msg={analysisTarget.msg} isUser={analysisTarget.isUser}
      ctx={curMsgs} gender={gender} mbti={mbti}
      cache={analysisCache} onCache={(id, r) => setAnalysisCache(p => new Map(p).set(id, r))}
      onClose={() => setAnalysisTarget(null)} />}
  </div>;
}
