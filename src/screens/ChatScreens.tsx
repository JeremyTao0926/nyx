import React, { useState, useEffect, useRef } from "react";
import { C, WRAP, sb, sound, fmtTime, fmtDate, fmtMsgTime, blockUser, reportUser, loadChatMsgs, sendChatMsg, markMsgsRead, uploadPhoto, buildSys, groqChat, compressImage, getTodaySpark, getBondInfo } from "../utils";
import type { DailySpark, BondInfo } from "../utils";
import { SparkCard } from "../components/SparkCard";
import { REPORT_CATEGORIES } from "../components/Modals";
import { Av, TypingBubble, NyxText, Lightbox } from "../components/Atoms";
import { EmojiPanel } from "../components/Modals";
import { MemoryWall } from "./MemoryWall";
import { CloneScreen } from "./CloneScreen";
import type { UserProfile, MatchItem, ChatMsg, ImgItem } from "../types";
import { ProfileSheet } from './ExploreScreen';
import { PremiumBadge } from '../components/PremiumBadge';

const MAX_W = { maxWidth: 480, margin: "0 auto", width: "100%" };

// Module-level cache — persists across navigation, never resets
const _analysisCache = new Map<string, string>();

/* ─── SparkPanel — collapsible daily spark in chat ──── */
function SparkPanel({ spark, matchId, myUserId, other, onSparkUpdate, onBondUpdate }:
  { spark: any; matchId: string; myUserId: string; other: any;
    onSparkUpdate: (s: any) => void; onBondUpdate: () => void }) {
  // Always start collapsed — user opens when ready
  const [collapsed, setCollapsed] = useState(true);
  const [hiding, setHiding] = useState(false);

  const isUser1 = myUserId === spark?.user1Id;
  const myAnswer = spark ? (isUser1 ? spark.answerUser1 : spark.answerUser2) : null;
  const revealed = !!spark?.revealedAt;
  // Show dot if today's spark exists and I haven't answered yet
  const hasNew = spark && !myAnswer && !revealed;

  function dismiss() {
    setHiding(true);
    setTimeout(() => { setCollapsed(true); setHiding(false); }, 250);
  }

  if (collapsed) return (
    <div onClick={() => setCollapsed(false)}
      style={{ background: C.bgGold, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <span style={{ fontSize: 11, color: C.rose }}>♥</span>
      <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>今日真心話</span>
      {hasNew
        ? <span style={{ fontSize: 10, background: C.rose, color: "#fff", borderRadius: 10, padding: "1px 7px", fontWeight: 700, marginLeft: 2 }}>新</span>
        : revealed
          ? <span style={{ fontSize: 11, color: C.mint, marginLeft: 2 }}>已揭曉</span>
          : myAnswer
            ? <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 2 }}>等待對方...</span>
            : null
      }
      <span style={{ marginLeft: "auto", fontSize: 14, color: C.textMuted }}>⌄</span>
    </div>
  );

  return (
    <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, maxHeight: 360, overflowY: "auto", opacity: hiding ? 0 : 1, transition: "opacity .25s" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px 0" }}>
        <button onClick={dismiss} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}>
          收起 ⌃
        </button>
      </div>
      <div style={{ padding: "0 12px 4px" }}>
        {spark && <SparkCard
          spark={spark} myUserId={myUserId} matchId={matchId} otherName={other.name}
          onAnswered={s => {
            if (s) {
              onSparkUpdate(s);
              if (s.revealedAt) setTimeout(() => setCollapsed(true), 4000);
            }
            onBondUpdate();
          }}
          onReact={text => { sendChatMsg(matchId, myUserId, `[SPARK_REACT]${text}`); }}
        />}
      </div>
    </div>
  );
}


/* ─── EncounterPanel — collapsible, auto-hides after reveal ─ */

function onlineStatus(lastActive: string | null, hidden: boolean): { label: string; color: string; dot: boolean } {
  if (hidden || !lastActive) return { label: "", color: "transparent", dot: false };
  const diff = Date.now() - new Date(lastActive).getTime();
  if (diff < 5 * 60 * 1000) return { label: "在線", color: "#06d6a0", dot: true };
  if (diff < 60 * 60 * 1000) return { label: `${Math.floor(diff / 60000)}分鐘前`, color: "rgba(200,185,230,0.45)", dot: false };
  if (diff < 24 * 60 * 60 * 1000) return { label: `今天 ${fmtTime(new Date(lastActive))}`, color: "rgba(200,185,230,0.45)", dot: false };
  return { label: `${Math.floor(diff / 86400000)}天前`, color: "rgba(200,185,230,0.35)", dot: false };
}

/* ─── Analysis Sheet ─────────────────────────────────── */
function AnalysisSheet({ msg, isMe, context, gender, mbti, matchDaysSince, otherMsgCount, otherProfile, cache, onCache, onClose }:
  { msg: ChatMsg; isMe: boolean; context: ChatMsg[]; gender: "male" | "female"; mbti: string;
    matchDaysSince?: number; otherMsgCount?: number; otherProfile?: any;
    cache: Map<string, string>; onCache: (id: string, r: string) => void; onClose: () => void }) {
  const [result, setResult] = useState(cache.get(msg.id) || "");
  const [loading, setLoading] = useState(!cache.has(msg.id));
  const sys = buildSys(mbti, gender);

  useEffect(() => {
    if (cache.has(msg.id)) return;
    analyze();
  }, []);

  async function analyze() {
    // ── Other person profile — declare first (used throughout) ──
    const op = otherProfile || {};
    const otherMbti = (op.mbti || "").toUpperCase();
    const otherGender = op.gender === "male" ? "男" : op.gender === "female" ? "女" : "對方";
    const otherHe = op.gender === "male" ? "他" : op.gender === "female" ? "她" : "對方";
    const otherName = op.name || "對方";
    const otherAge = op.age ? `${op.age}歲` : "";
    const otherJob = op.occupation || "";
    const otherHobbies = (op.hobbies || []).slice(0, 5).join("、");
    const otherBio = op.bio ? op.bio.slice(0, 60) : "";
    const otherProfileStr = [
      otherName && `姓名：${otherName}`,
      otherAge && `年齡：${otherAge}`,
      otherJob && `職業：${otherJob}`,
      otherMbti && `MBTI：${otherMbti}`,
      otherHobbies && `興趣：${otherHobbies}`,
      otherBio && `自我介紹：${otherBio}`,
    ].filter(Boolean).join("｜");

    const msgIdx = context.findIndex(m => m.id === msg.id);
    const before = msgIdx > 0
      ? context.slice(Math.max(0, msgIdx - 30), msgIdx)
      : context.slice(-30);

    // ── Baseline: other person avg message length ──────────
    const otherMsgs = before.filter(m => m.senderId === "對方");
    const myMsgs    = before.filter(m => m.senderId === "我");
    const avgOtherLen = otherMsgs.length > 0
      ? Math.round(otherMsgs.reduce((s, m) => s + m.content.length, 0) / otherMsgs.length) : 10;
    const thisLen = msg.content.length;
    const relativeLen = thisLen < avgOtherLen * 0.5 ? "比平時短很多"
      : thisLen > avgOtherLen * 1.5 ? "比平時長很多" : "和平時差不多";

    // ── Conversation trend (length-based) ─────────────────
    const recentOther = before.slice(-10).filter(m => m.senderId === "對方");
    const earlyOther  = before.slice(0, Math.max(1, before.length - 10)).filter(m => m.senderId === "對方");
    const recentAvg = recentOther.reduce((s, m) => s + m.content.length, 0) / Math.max(1, recentOther.length);
    const earlyAvg  = earlyOther.reduce((s, m) => s + m.content.length, 0) / Math.max(1, earlyOther.length);
    const trend = recentAvg > earlyAvg * 1.25 ? "升溫中" : recentAvg < earlyAvg * 0.7 ? "冷卻中" : "平穩";

    // ── Initiative ratio: who sends more ──────────────────
    const myRatio = before.length > 0 ? Math.round(myMsgs.length / before.length * 100) : 50;
    const initiativeStr = myRatio > 62 ? `我主動偏多（我發${myRatio}%，主動權偏低）`
      : myRatio < 38 ? `對方主動偏多（我發${myRatio}%，框架較好）`
      : `雙方比較平衡（我發${myRatio}%）`;

    // ── Response speed trend (from timestamps) ────────────
    const timestamps = before.map(m => new Date(m.timestamp).getTime()).filter(t => !isNaN(t));
    let speedTrend = "";
    if (timestamps.length >= 6) {
      const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]).filter(g => g > 0 && g < 3600000); // gaps < 1hr
      if (gaps.length >= 4) {
        const earlyGaps = gaps.slice(0, Math.floor(gaps.length / 2));
        const recentGaps = gaps.slice(Math.floor(gaps.length / 2));
        const earlyAvgG = earlyGaps.reduce((s, g) => s + g, 0) / earlyGaps.length;
        const recentAvgG = recentGaps.reduce((s, g) => s + g, 0) / recentGaps.length;
        speedTrend = recentAvgG < earlyAvgG * 0.7 ? "回覆速度加快（升溫訊號）"
          : recentAvgG > earlyAvgG * 1.5 ? "回覆速度變慢（降溫或測試）"
          : "回覆速度穩定";
      }
    }

    // ── Consecutive message bursts ────────────────────────
    // Detect if someone sent multiple msgs in a row (shows eagerness/desperation)
    let burstNote = "";
    if (before.length >= 3) {
      let maxOtherBurst = 0, maxMyBurst = 0;
      let curOther = 0, curMy = 0;
      for (const m of before) {
        if (m.senderId === "對方") { curOther++; curMy = 0; maxOtherBurst = Math.max(maxOtherBurst, curOther); }
        else { curMy++; curOther = 0; maxMyBurst = Math.max(maxMyBurst, curMy); }
      }
      if (maxOtherBurst >= 3) burstNote = `${otherHe}曾連發${maxOtherBurst}條未等你回覆（顯示${otherHe}較主動/急切）`;
      else if (maxMyBurst >= 3) burstNote = `我曾連發${maxMyBurst}條未等對方回覆（稀缺性受損）`;
    }

    // ── Silence gaps: who broke silence ───────────────────
    let silenceNote = "";
    if (timestamps.length >= 2) {
      const maxGap = Math.max(...before.slice(1).map((m, i) =>
        new Date(m.timestamp).getTime() - new Date(before[i].timestamp).getTime()
      ).filter(g => !isNaN(g)));
      if (maxGap > 6 * 3600000) { // gap > 6 hours
        const gapHours = Math.round(maxGap / 3600000);
        const afterGapMsg = before.find((m, i) => i > 0 &&
          new Date(m.timestamp).getTime() - new Date(before[i-1].timestamp).getTime() === maxGap);
        const whoResumed = afterGapMsg?.senderId === "我" ? "我先開口" : `${otherHe}先開口`;
        silenceNote = `曾有${gapHours}小時沉默，${whoResumed}打破。`;
      }
    }

    // ── Density: msgs per day ─────────────────────────────
    const days = Math.max(1, matchDaysSince || 1);
    const totalMsgs = context.length;
    const density = Math.round(totalMsgs / days);
    const densityStr = density < 5 ? "對話密度低（每天不到5條，進展緩慢）"
      : density < 20 ? "對話密度中等（每天約${density}條）"
      : "對話密度高（每天${density}條以上，進展較快）";

    // ── Cross-session enthusiasm analysis ────────────────
    // Split ALL context into sessions by 3h gaps
    const SESSION_GAP = 3 * 3600000; // 3 hours
    const allMsgs = context.slice(-100); // cap at 100 for performance
    const sessions: typeof context[] = [];
    let curSession: typeof context = [];
    for (let i = 0; i < allMsgs.length; i++) {
      if (i === 0) { curSession.push(allMsgs[i]); continue; }
      const gap = new Date(allMsgs[i].timestamp).getTime() - new Date(allMsgs[i-1].timestamp).getTime();
      if (gap > SESSION_GAP) { if (curSession.length > 0) sessions.push(curSession); curSession = []; }
      curSession.push(allMsgs[i]);
    }
    if (curSession.length > 0) sessions.push(curSession);

    // Score each session: other person's enthusiasm (0-100)
    function sessionScore(sess: typeof context) {
      const otherInSess = sess.filter(m => m.senderId === "對方");
      const myInSess    = sess.filter(m => m.senderId === "我");
      if (otherInSess.length === 0) return 0;
      const avgLen      = otherInSess.reduce((s, m) => s + m.content.length, 0) / otherInSess.length;
      const initRatio   = otherInSess.length / Math.max(sess.length, 1); // higher = they initiate more
      const msgCount    = Math.min(otherInSess.length / 5, 1); // normalize to 0-1
      return Math.round((avgLen / 20 * 40 + initRatio * 40 + msgCount * 20));
    }

    const recentSessions = sessions.slice(-4); // last 4 sessions
    const sessionScores  = recentSessions.map(s => sessionScore(s));

    let sessionTrendStr = "";
    let inflectionAdvice = "";
    if (sessionScores.length >= 2) {
      const latest  = sessionScores[sessionScores.length - 1];
      const prev    = sessionScores[sessionScores.length - 2];
      const prevPrev = sessionScores.length >= 3 ? sessionScores[sessionScores.length - 3] : prev;
      const dropping = latest < prev * 0.75 && prev <= prevPrev * 1.1;
      const spiking  = latest > prev * 1.3;
      const recovering = latest > prev * 1.2 && prev < prevPrev * 0.85;

      if (dropping) {
        sessionTrendStr = `跨對話趨勢：熱情明顯下滑（前次${prev}分→本次${latest}分）`;
        inflectionAdvice = "熱情退潮，建議冷處理：減少主動、縮短回覆、製造距離感，讓對方重新感受到你的稀缺性。";
      } else if (recovering) {
        sessionTrendStr = `跨對話趨勢：本次明顯回暖（低谷${prev}分→本次${latest}分）`;
        inflectionAdvice = "對方正在回暖，這是追擊時機：可以主動提線下，或說一句有點進攻性的話趁熱打鐵。";
      } else if (spiking) {
        sessionTrendStr = `跨對話趨勢：本次熱情明顯升溫（前次${prev}分→本次${latest}分）`;
        inflectionAdvice = "對方熱情上升，可以適度推進：加快節奏，試探性給訊號，看${otherHe}的反應。";
      } else if (sessionScores.every((s, i) => i === 0 || s <= sessionScores[i-1] * 1.1)) {
        sessionTrendStr = `跨對話趨勢：持續緩慢降溫（${sessionScores.join("→")}分）`;
        inflectionAdvice = "長期緩慢降溫，當前最重要的是停止主動追，讓${otherHe}有空間想起你。";
      } else {
        sessionTrendStr = `跨對話趨勢：較穩定（近期評分：${sessionScores.join("→")}分）`;
        inflectionAdvice = "";
      }
    }

    const ctxStr = before.slice(-14).map(m => `${m.senderId}：${m.content}`).join("\n");

    const stage = days < 3 ? "剛認識（前3天）"
      : days < 7 ? "認識不到一週"
      : days < 30 ? "認識一到四週"
      : "認識超過一個月";

    // Relationship velocity: progress vs time
    const velocity = totalMsgs < days * 3 ? "進展偏慢（訊息少）"
      : totalMsgs > days * 30 ? "進展很快（大量互動）"
      : "進展正常";

    // Gender-specific framework
    const myGender = gender; // "male" | "female"
    const isManChasing = myGender === "male"; // simplified assumption (heterosexual default)

    const genderFrame = isManChasing
      ? `用戶是男性，追求對象是女性。框架重點：
- 不能太殷勤，主動要有節制，稀缺性對男性尤其重要
- 要製造吸引力而不是安全感
- Frame 要穩，不能被她的情緒帶著走
- 偶爾不回應比立刻回應更有效`
      : `用戶是女性，追求對象是男性。框架重點：
- 適當展示需要感和脆弱反而加分
- 讓他有保護欲比展示自己厲害更有效
- 主動可以，但要給他追回來的空間
- 讚美他的能力比讚美他的外表更讓男人上癮`;

    // (otherProfile vars declared at top of function)

    const mbtiInsight = (() => {
      const o = otherMbti;
      if (!o) return "";
      const isIntro = o.startsWith("I");
      const isNF = o.includes("NF");
      const isNT = o.includes("NT");
      const isJ = o.endsWith("J");
      const isSF = o.includes("SF");
      return [
        isIntro ? `${otherHe}是內向型，話少是正常，不要過度解讀沉默。` : `${otherHe}是外向型，話少可能真的是興趣降低。`,
        isNF ? `NF型重情感連結，直接表白或問喜不喜歡會讓${otherHe}關閉，要側面接近製造共鳴。` : "",
        isNT ? `NT型理性，不吃甜言蜜語，展示有趣和智識吸引力更有效，太煽情${otherHe}會反感。` : "",
        isSF ? `SF型重安全感，太神秘讓${otherHe}不安，需要一定穩定感。` : "",
        isJ ? `J型不耐模糊，曖昧太久${otherHe}會失去興趣，要適時給清晰訊號。` : `P型討厭壓力，太直接${otherHe}會逃，保持輕鬆感。`,
      ].filter(Boolean).join(" ");
    })();

    // My MBTI execution note
    const myMbtiNote = (() => {
      const m = (mbti || "").toUpperCase();
      if (m.startsWith("I")) return `（注意：你是內向型${m}，建議選擇符合你風格的說法，不要強迫自己太外向）`;
      if (m.includes("NT")) return `（你是${m}型，理性分析是你的強項，但記得加一點情感溫度）`;
      return "";
    })();

    const sysPrompt = `你是一個直接、有效的戀愛顧問，專門分析聊天對話。

${genderFrame}

吸引力底層原理（思考框架，不要輸出這些名詞）：
- 稀缺性：容易得到的不被珍惜
- 框架控制：誰在追求誰的認可
- 投入度訊號：長度、速度、主動性是真實興趣指標
- 神秘感：保留空間比全盤托出更吸引人
- 間歇性強化：不穩定的吸引力讓人上癮

${mbtiInsight}

輸出要求：
- 不提任何理論名詞
- 每點不超過2行
- 給具體可以發的話，不說廢話
- 直接切入重點`;

    const prompt = isMe
      ? `【對方資料】${otherProfileStr || "未知"}

【關係數據】
- 認識天數：${days}天｜總訊息：${totalMsgs}條｜${densityStr}
- ${velocity}｜${initiativeStr}
- 對話走勢：${trend}${speedTrend ? "｜"+speedTrend : ""}
- ${silenceNote || "無明顯沉默期"}
${sessionTrendStr ? "- "+sessionTrendStr+"\n" : ""}- 關係階段：${stage}${myMbtiNote}
${inflectionAdvice ? "【跨對話分析】"+inflectionAdvice : ""}

【對話背景（最近14條，格式：發話人：內容）】
說明：「我」= 用戶本人，「對方」= ${otherName}
${ctxStr}

【要分析的訊息】由「我」發出：「${msg.content}」

分析：
1. 在這個語境下這句話的問題（直接指出，不要客氣）
2. ${otherHe}看到這句話真實的感受
3. 有沒有太殷勤/太主動/框架失誤/說太多
4. 更好的說法（1-2條，要自然不要像套路，禁止用問句結尾）

禁止輸出：「你可以問對方...」「你可以說你喜歡...」這類開放式問題建議。
給的話要能直接複製發出去，聽起來像正常人說的話。
如果跨對話分析顯示有轉折點，在結尾單獨一行給出戰略建議（冷處理或追擊）。`
      : `【對方資料】${otherProfileStr || "未知"}

【關係數據】
- 認識天數：${days}天｜總訊息：${totalMsgs}條｜${densityStr}
- ${velocity}｜${initiativeStr}
- 對話走勢：${trend}${speedTrend ? "｜"+speedTrend : ""}
- ${silenceNote || "無明顯沉默期"}
${sessionTrendStr ? "- "+sessionTrendStr+"\n" : ""}- ${otherHe}這句話長度：${relativeLen}
- 關係階段：${stage}${myMbtiNote}
${inflectionAdvice ? "【跨對話分析】"+inflectionAdvice : ""}

【對話背景（最近14條，格式：發話人：內容）】
說明：「我」= 用戶本人，「對方」= ${otherName}（${otherGender}性）
${ctxStr}

【要分析的訊息】由「對方」（${otherName}）發出：「${msg.content}」
注意：這句話是${otherHe}說的，不是用戶說的。

分析：
1. 在這個語境+${otherHe}的性格下，這句話真正的意思
2. ${otherHe}的投入度：升溫/降溫/維持（給出判斷依據）
3. 這是測試你的反應、敷衍、還是真實表達
4. 最佳回應（給2條：一條穩一條進，要自然，禁止用問句結尾，禁止給套路式的溫柔回應）

如果${otherHe}有具體興趣愛好，可以在回應中自然 callback，但不要刻意。
給的話要能直接發出去，聽起來像正常聊天不像AI寫的。
如果跨對話分析顯示有轉折點，在結尾單獨一行給出戰略建議（冷處理或追擊），直接說做什麼。`;

    try {
      const r = await groqChat([{ role: "user", content: prompt }], sysPrompt, undefined, 500);
      setResult(r); onCache(msg.id, r);
    } catch { setResult("分析失敗 😔"); }
    setLoading(false);
  }


  const sheetSwipeY = useRef(0);
  const [sheetTranslate, setSheetTranslate] = useState(0);

  function onSheetTouchStart(e: React.TouchEvent) {
    sheetSwipeY.current = e.touches[0].clientY;
  }
  function onSheetTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - sheetSwipeY.current;
    if (dy > 0) setSheetTranslate(dy);
  }
  function onSheetTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - sheetSwipeY.current;
    if (dy > 80) { onClose(); }
    else setSheetTranslate(0);
  }

  return <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,3,14,0.92)", backdropFilter: "blur(16px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()}
      onTouchStart={onSheetTouchStart}
      onTouchMove={onSheetTouchMove}
      onTouchEnd={onSheetTouchEnd}
      style={{ ...MAX_W, background: C.surf, borderRadius: "24px 24px 0 0", border: `1px solid ${C.border}`, padding: "24px 22px 44px", maxHeight: "72vh", overflowY: "auto", animation: "slideUp .32s cubic-bezier(.34,1.56,.64,1)", transform: `translateY(${sheetTranslate}px)`, transition: sheetTranslate === 0 ? "transform .3s ease" : "none" }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 18px", cursor: "pointer" }} onClick={onClose}/>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          {isMe ? "分析我的說法" : "對方訊息解讀"}
        </div>
        {!loading && result && <span style={{ fontSize: 10, color: C.mint, background: "rgba(0,201,167,0.12)", padding: "2px 8px", borderRadius: 10 }}>已緩存</span>}
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.textMuted, fontStyle: "italic", borderLeft: `2px solid ${C.gold}` }}>{msg.content}</div>
      {loading ? (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold, display: "inline-block", animation: `dot 1.1s ${i*.18}s ease-in-out infinite` }}/>)}
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, animation: "fadeIn .5s ease" }}>
            分析中，通常需要5-10秒...
          </div>
        </div>
      ) : <NyxText text={result} />}
    </div>
  </div>;
}

/* ─── Other User Profile Modal ───────────────────────── */
/* ─── Msg Context Menu ───────────────────────────────── */
function MsgMenu({ msg, isMe, onCopy, onDelete, onHide, onRecall, onReply, onAnalyze, onClose, menuY }:
  { msg: ChatMsg; isMe: boolean; onCopy: () => void;
    onDelete?: () => void; onHide?: () => void; onRecall?: () => void;
    onReply: () => void; onAnalyze?: () => void; onClose: () => void; menuY?: number }) {

  const canRecall = isMe && msg.timestamp && (Date.now() - new Date(msg.timestamp).getTime()) < 2 * 60 * 1000;
  const isRecalled = msg.content === "[已撤回]";

  const actions = [
    { icon: "↩️", label: "回覆", fn: onReply },
    !isRecalled ? { icon: "📋", label: "複製", fn: onCopy } : null,
    onAnalyze && !isRecalled ? { icon: "🔍", label: isMe ? "分析" : "解讀", fn: onAnalyze } : null,
    canRecall && onRecall ? { icon: "↩", label: "撤回", fn: onRecall, danger: false } : null,
    isMe && onDelete && !isRecalled ? { icon: "🗑", label: "刪除", fn: onDelete, danger: true } : null,
    !isMe && onHide ? { icon: "✕", label: "隱藏", fn: onHide } : null,
  ].filter(Boolean) as any[];

  // Position: show near where menu was triggered

  const menuH = actions.length * 48;
  // Place menu just BELOW the touch point, clamped to screen
  const topPos = Math.min((menuY || 200) + 12, window.innerHeight - menuH - 16);

  // Horizontal alignment:
  // Left bubble: left edge = 16px padding + 32px avatar + 8px gap = 56px from container left
  // Right bubble: right edge = 16px from container right
  const leftVal  = isMe ? "auto" : 56;
  const rightVal = isMe ? 16 : "auto";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:150 }} onClick={onClose}>
      {/* Very subtle dim only */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.18)" }}/>

      {/* 480px container */}
      <div style={{ position:"relative", maxWidth:480, margin:"0 auto", height:"100%", pointerEvents:"none" }}>
        <div onClick={e => e.stopPropagation()}
          style={{ position:"absolute", top:topPos,
            left:leftVal, right:rightVal,
            width:180, pointerEvents:"all",
            background:"rgba(18,16,12,0.82)",
            backdropFilter:"blur(28px)",
            WebkitBackdropFilter:"blur(28px)",
            border:`1px solid rgba(201,168,76,0.18)`,
            borderRadius:14, overflow:"hidden",
            boxShadow:"0 4px 24px rgba(0,0,0,0.4)",
            animation:"dropDown .15s ease" }}>
          {actions.map((action, i) => (
            <button key={i} onClick={() => { action.fn(); onClose(); sound.tap(); }}
              style={{ width:"100%", padding:"12px 18px", background:"transparent", border:"none",
                borderBottom: i < actions.length-1 ? `1px solid rgba(255,255,255,0.06)` : "none",
                color: action.danger ? C.rose : C.text,
                fontFamily:"inherit", fontSize:14.5, cursor:"pointer",
                textAlign:"left" as const, display:"block", transition:"background .12s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Conversation List ──────────────────────────────── */
export function ChatListScreen({ profile, matches, unreadPerMatch, typingMatchIds, onOpenNyx, onOpenMatch }:
  { profile: UserProfile; matches: MatchItem[]; unreadPerMatch: Record<string, number>; typingMatchIds?: Set<string>; onOpenNyx: () => void; onOpenMatch: (m: MatchItem) => void }) {
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
    ...sortedMatches.map(m => ({ id: m.id, matchId: m.matchId, isNyx: false, name: m.name, lastMsg: previewMsg(m.lastMsg), time: m.time, unread: unreadPerMatch[m.matchId] || 0, avatar: m.avatar, online: false, lastActive: (m as any).lastActive || null, isPremium: (m as any).isPremium || false, premiumPlan: (m as any).premiumPlan || null }))
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
                  {!item.isNyx && <PremiumBadge plan={(item as any).isPremium ? ((item as any).premiumPlan || "premium") : null} mini />}
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
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<string>>(new Set());
  const [menuY, setMenuY] = useState<number>(0);
  const [spark, setSpark] = useState<DailySpark | null>(null);
  const [bond, setBond] = useState<BondInfo | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingCh = useRef<any>(null);
  const hideOnline = (myProfile as any).hide_online_status;

  useEffect(() => {
    loadChatMsgs(matchId).then(m => { setMsgs(m); setLoaded(true); });
    markMsgsRead(matchId, myUserId);
    getTodaySpark(matchId, myUserId, other.id).then(s => setSpark(s));
    getBondInfo(matchId).then(b => setBond(b));

    // Refresh spark at midnight if chat stays open
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24,0,0,0);
    const msToMidnight = midnight.getTime() - now.getTime();
    const midnightTimer = setTimeout(() => {
      getTodaySpark(matchId, myUserId, other.id).then(s => setSpark(s));
    }, msToMidnight);

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
          is_premium: (data as any).is_premium || false, premium_plan: (data as any).premium_plan || null,
          occupation: data.occupation || null, education: data.education || null,
          income: data.income || null, height_cm: data.height_cm || null,
          drinking: data.drinking || null, smoking: data.smoking || null,
          exercise: data.exercise || null, has_pets: data.has_pets || null,
          want_children: data.want_children || null, relationship_goal: data.relationship_goal || null,
          love_language: data.love_language || null,
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
        // Handle read receipts
        if (m.read_at && m.sender_id === myUserId) {
          setMsgs(p => p.map(msg => msg.id === m.id ? { ...msg, readAt: new Date(m.read_at) } : msg));
        }
        // Handle recall — update content for both parties
        if (m.is_recalled) {
          setMsgs(p => p.map(msg => msg.id === m.id ? { ...msg, content: "[已撤回]", isRecalled: true } : msg));
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

    return () => { sb.removeChannel(msgCh); if (typingCh.current) sb.removeChannel(typingCh.current); sb.removeChannel(encounterCh); clearTimeout(midnightTimer); };
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
          // Broadcast for instant update
          sb.channel(`user-inbox:${other.id}`).send({
            type: "broadcast", event: "new_message",
            payload: { matchId, senderName: myProfile?.display_name || myProfile?.username || "", preview: "📷 圖片", ts: Date.now() }
          });
          // Push notify recipient about image
          sb.functions.invoke("send-push", {
            body: {
              recipient_id: other.id,
              title: myProfile?.display_name || myProfile?.username || "NYX",
              body: "📷 傳送了一張圖片",
              url: "/?tab=chat",
              sender_avatar: myProfile?.avatar_url || "",
            },
          }).catch(() => {});
        } catch (e) { console.error("Image upload failed:", e); }
      }
    if (txt) {
      const content = replyTo ? `↩️ ${replyTo.content.slice(0, 30)}${replyTo.content.length > 30 ? "..." : ""}\n${txt}` : txt;
      setReplyTo(null);
      const opt: ChatMsg = { id: Date.now() + "t", senderId: myUserId, content, timestamp: new Date() };
      setMsgs(p => [...p, opt]); sound.send();
      await sendChatMsg(matchId, myUserId, content);
      // Broadcast to recipient for instant UI update (no DB round-trip)
      sb.channel(`user-inbox:${other.id}`).send({
        type: "broadcast", event: "new_message",
        payload: {
          matchId,
          senderName: myProfile?.display_name || myProfile?.username || "",
          preview: content.length > 40 ? content.slice(0, 40) + "..." : content,
          ts: Date.now()
        }
      });
      // Push notify the recipient
      sb.functions.invoke("send-push", {
        body: {
          recipient_id: other.id,
          title: myProfile?.display_name || myProfile?.username || "NYX",
          body: content.startsWith("↩️") ? content.split("\n").slice(1).join("\n").slice(0, 60) : content.slice(0, 60),
          url: "/?tab=chat",
          sender_avatar: myProfile?.avatar_url || "",
        },
      }).catch(() => {});
    }
  }

  async function deleteMsg(msgId: string) {
    await sb.from("chat_messages").delete().eq("id", msgId).eq("sender_id", myUserId);
    setMsgs(p => p.filter(m => m.id !== msgId));
  }

  function hideMsg(msgId: string) {
    // Only hide locally — cannot delete other person's DB record
    setHiddenMsgIds(p => new Set([...p, msgId]));
  }

  async function recallMsg(msgId: string) {
    // Mark as recalled — both users see "已撤回"
    await sb.from("chat_messages").update({ content: "[已撤回]", is_recalled: true }).eq("id", msgId).eq("sender_id", myUserId);
    setMsgs(p => p.map(m => m.id === msgId ? { ...m, content: "[已撤回]", isRecalled: true } : m));
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
    msgs.filter(m => !hiddenMsgIds.has(m.id)).forEach((msg, idx) => {
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

      // Special: SPARK_REACT message card — same row structure as normal messages
      if (isSparkReact(msg.content)) {
        const txt = getSparkReactText(msg.content);
        els.push(
          <div key={msg.id}
          onTouchStart={(e) => { const y = e.touches[0].clientY; longPressTimer.current = setTimeout(() => { sound.tap(); setMenuY(y); setMenuMsg(msg); }, 500); }}
          onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onContextMenu={e => { e.preventDefault(); setMenuMsg(msg); }}
          style={{ display:"flex", flexDirection:isMe?"row-reverse":"row", alignItems:"flex-end", gap:8, marginBottom:10, animation:"fadeUp .3s ease" }}>
            {/* Avatar — only render for other person */}
            {!isMe && (
              <div style={{ width:32, flexShrink:0, cursor:"pointer" }} onClick={()=>setShowOtherProfile(true)}>
                <Av url={other.avatar} name={other.name} size={30} grad="linear-gradient(145deg,#ff9a3c,#ff6b6b)" />
              </div>
            )}
            <div style={{ maxWidth:"72%", background:isMe?`linear-gradient(135deg,${C.bgGold},rgba(30,26,14,0.95))`:`linear-gradient(135deg,rgba(20,18,14,0.98),rgba(28,22,14,0.95))`, border:`1px solid ${C.rose}44`, borderRadius:16, padding:"12px 14px", boxShadow:"0 2px 12px rgba(0,0,0,0.3)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                <span style={{ fontSize:11, color:C.rose }}>♥</span>
                <span style={{ fontSize:10.5, fontWeight:700, color:C.rose, letterSpacing:".5px", textTransform:"uppercase" as const }}>真心話回應</span>
              </div>
              <div style={{ fontSize:14, color:C.text, lineHeight:1.6 }}>{txt.replace(/^\[.*?\]/,"").replace(/^.*？：/,"")}</div>
              <div style={{ fontSize:10.5, color:C.textMuted, marginTop:6, textAlign:isMe?"right":"left" as const }}>{fmtTime(msg.timestamp)}</div>
            </div>
          </div>
        );
        return;
      }

      const displayContent = msg.content.includes("\n") && msg.content.startsWith("↩️")
        ? msg.content.split("\n").slice(1).join("\n") : msg.content;

      els.push(
        <div key={msg.id}
          style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginBottom: isLastInGroup ? 10 : 2, animation: `${isMe ? "userIn" : "nyxIn"} .25s ease both` }}
          onContextMenu={e => { e.preventDefault(); setMenuMsg(msg); }}
          onMouseDown={(e) => { const y = e.clientY; longPressTimer.current = setTimeout(() => { setMenuY(y); setMenuMsg(msg); }, 500); }}
          onMouseUp={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onMouseLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onTouchStart={(e) => { const y = e.touches[0].clientY; longPressTimer.current = setTimeout(() => { sound.tap(); setMenuY(y); setMenuMsg(msg); }, 500); }}
          onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}>
          {/* Avatar — only render div for other person's messages */}
          {!isMe && (
            <div style={{ width: 32, flexShrink: 0, cursor:"pointer" }} onClick={()=>setShowOtherProfile(true)}>
              {showAvatar && <Av url={other.avatar} name={other.name} size={30} grad="linear-gradient(145deg,#ff9a3c,#ff6b6b)" />}
            </div>
          )}
          <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
            {msg.content.startsWith("↩️") && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2, opacity: .7 }}>{msg.content.split("\n")[0]}</div>}
            <div style={{ padding: isImage ? "4px" : "10px 14px", borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
              background: (msg as any).isRecalled || msg.content === "[已撤回]" ? "transparent" : isMe ? C.grad : "rgba(24,20,36,0.98)",
              border: (msg as any).isRecalled || msg.content === "[已撤回]" ? `1px dashed ${C.border}` : isMe ? undefined : `1px solid ${C.border}`,
              color: (msg as any).isRecalled || msg.content === "[已撤回]" ? C.textMuted : "#fff",
              fontSize: (msg as any).isRecalled || msg.content === "[已撤回]" ? 12.5 : 14.5,
              lineHeight: 1.6, boxShadow: isMe && !((msg as any).isRecalled) ? `0 3px 12px rgba(255,56,92,0.25)` : "none",
              whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: (msg as any).isRecalled || msg.content === "[已撤回]" ? "italic" : "normal" }}>
              {(msg as any).isRecalled || msg.content === "[已撤回]"
                ? "↺ 已撤回"
                : isImage
                  ? <img src={msg.content} alt="📷" style={{ maxWidth: 220, maxHeight: 280, borderRadius: 10, objectFit: "cover" as const, display: "block", cursor: "pointer" }} onClick={() => setLightboxImg(msg.content)} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
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

  // Hinge-style swipe right to go back
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const isSwiping = useRef(false);

  function onSwipeTouchStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }
  function onSwipeTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    // Only track horizontal swipe from left edge
    if (swipeStartX.current < 40 && dx > 0 && dy < 60) {
      isSwiping.current = true;
      setSwipeDx(dx);
    }
  }
  function onSwipeTouchEnd() {
    if (isSwiping.current && swipeDx > 100) {
      onBack();
    } else {
      setSwipeDx(0);
    }
    isSwiping.current = false;
  }

  return <div
    onTouchStart={onSwipeTouchStart}
    onTouchMove={onSwipeTouchMove}
    onTouchEnd={onSwipeTouchEnd}
    style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg,
      touchAction: "pan-y", position: "absolute", inset: 0,
      transform: `translateX(${swipeDx}px)`,
      transition: swipeDx === 0 ? "transform .3s cubic-bezier(.32,.72,0,1)" : "none",
      boxShadow: swipeDx > 10 ? `-8px 0 24px rgba(0,0,0,0.5)` : "none" }}>
    {/* Header - centered name */}
    <div style={{ padding: "14px 16px", background: "rgba(9,9,15,0.95)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit", width: 36 }}>‹</button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 0 }} onClick={() => setShowOtherProfile(true)}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{other.name}</div><PremiumBadge plan={(other as any).isPremium ? ((other as any).premiumPlan || "premium") : null} mini /></div>
          {otherStatus.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 6px ${C.teal}`, flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 11.5, color: otherTyping ? C.teal : (otherStatus.label ? otherStatus.color : C.textMuted) }}>
          {otherTyping ? "輸入中..." : (otherStatus.label || "已配對")}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <button onClick={() => setShowClone(true)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:20, background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, cursor:"pointer", fontFamily:"inherit" }}>
          <span style={{ fontSize:13 }}>🪞</span>
          <span style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>Clone</span>
        </button>
        <button onClick={() => setShowMemory(true)} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:20, background:C.goldSoft, border:`1px solid ${C.gold}33`, cursor:"pointer", fontFamily:"inherit" }}>
          <span style={{ fontSize:12, color:C.gold }}>✦</span>
          <span style={{ fontSize:11, color:C.gold, fontWeight:600 }}>{bond ? bond.label : "回憶"}</span>
        </button>
        <button onClick={() => setShowReport(true)} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer", fontFamily: "inherit", width: 32, display: "flex", justifyContent: "flex-end" }}>⋮</button>
      </div>
    </div>



    {/* Daily Spark */}
    {spark && <SparkPanel
      spark={spark} matchId={matchId} myUserId={myUserId} other={other}
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
          <button onClick={() => { setShowEmoji(p => !p); sound.tap(); }} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: showEmoji ? "rgba(201,168,76,0.15)" : "transparent", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showEmoji ? C.gold : C.textMuted }}>😊</button>
          <button onClick={() => fileRef.current?.click()} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "transparent", border: "none", color: C.textMuted, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="上傳相片" onMouseEnter={e => (e.currentTarget.style.color = C.gold)} onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>⊕</button>
          <textarea ref={textRef} value={input} onChange={e => { handleInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`傳訊息給 ${other.name}...`} rows={1} style={{ background: "transparent", border: "none", outline: "none", color: C.text, resize: "none", fontSize: 14.5, lineHeight: 1.55, width: "100%", maxHeight: 100, overflowY: "auto", paddingTop: 5, fontFamily: "'Plus Jakarta Sans','Noto Sans TC',sans-serif" }} />
          <button onClick={send} style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: (input.trim() || pendingImg) ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", fontFamily: "inherit", boxShadow: (input.trim() || pendingImg) ? `0 3px 14px rgba(255,56,92,0.5)` : "none" }}><span style={{ marginLeft: 2 }}>➤</span></button>
        </div>
      </div>
    </div>

    {/* Other profile */}
    {lightboxImg && <Lightbox lb={{ images:[lightboxImg], index:0 }} onClose={() => setLightboxImg(null)} />}
    {showOtherProfile && otherProfileData && <ProfileSheet
        p={{
          id: otherProfileData.id||"",
          name: otherProfileData.name||"",
          age: otherProfileData.age||null,
          mbti: otherProfileData.mbti||"",
          bio: otherProfileData.bio||"",
          avatar: otherProfileData.avatar||"",
          photos: otherProfileData.photos||[],
          location: otherProfileData.location||"",
          country: otherProfileData.country||"",
          ethnicity: [],
          hobbies: otherProfileData.hobbies||[],
          verified: false,
          occupation: otherProfileData.occupation||null,
          education: otherProfileData.education||null,
          income: otherProfileData.income||null,
          height_cm: otherProfileData.height_cm||null,
          drinking: otherProfileData.drinking||null,
          smoking: otherProfileData.smoking||null,
          exercise: otherProfileData.exercise||null,
          has_pets: otherProfileData.has_pets||null,
          want_children: otherProfileData.want_children||null,
          relationship_goal: otherProfileData.relationship_goal||null,
          love_language: otherProfileData.love_language||null,
          is_premium: otherProfileData.is_premium||false,
          premium_plan: otherProfileData.premium_plan||null,
        }}
        myMbti=""
        myProfile={null}
        mode="matched"
        onClose={() => setShowOtherProfile(false)}
        onLike={()=>{}} onSuperlike={()=>{}} onChat={()=>{}}
      />}
    {showMemory && <MemoryWall matchId={matchId} otherName={other.name} onClose={() => setShowMemory(false)} />}
    {showClone && (
      <div style={{ position:"fixed",inset:0,zIndex:100 }}
        onTouchStart={e=>e.stopPropagation()}
        onTouchMove={e=>e.stopPropagation()}
        onTouchEnd={e=>e.stopPropagation()}>
        <CloneScreen matchId={matchId} myUserId={myUserId} myProfile={myProfile} other={other} onClose={() => setShowClone(false)} />
      </div>
    )}

    {/* Msg menu */}
    {menuMsg && <MsgMenu msg={menuMsg} isMe={menuMsg.senderId === myUserId}
      onCopy={() => navigator.clipboard?.writeText(menuMsg.content)}
      onDelete={menuMsg.senderId === myUserId ? () => deleteMsg(menuMsg.id) : undefined}
      onHide={menuMsg.senderId !== myUserId ? () => hideMsg(menuMsg.id) : undefined}
      onRecall={menuMsg.senderId === myUserId ? () => recallMsg(menuMsg.id) : undefined}
      onReply={() => setReplyTo(menuMsg)}
      onAnalyze={() => setAnalysisTarget(menuMsg)}
      onClose={() => setMenuMsg(null)} menuY={menuY} />}

    {/* Analysis sheet */}
    {analysisTarget && <AnalysisSheet
      msg={analysisTarget}
      isMe={analysisTarget.senderId === myUserId}
      context={msgs.map(m => ({ ...m, senderId: m.senderId === myUserId ? "我" : "對方" }))}
      matchDaysSince={Math.floor((Date.now() - (msgs[0]?.timestamp ? new Date(msgs[0].timestamp).getTime() : Date.now())) / 86400000)}
      otherMsgCount={(msgs.filter(m => m.senderId !== myUserId)).length}
      otherProfile={otherProfileData || null}
      gender={myProfile.gender}
      mbti={myProfile.mbti}
      cache={_analysisCache}
      onCache={(id, r) => { _analysisCache.set(id, r); }}
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
