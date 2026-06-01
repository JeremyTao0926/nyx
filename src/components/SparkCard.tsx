import { useState } from "react";
import { C, sound, submitSparkAnswer, sb } from "../utils";
import type { DailySpark } from "../utils";

interface Props {
  spark: DailySpark;
  myUserId: string;
  matchId: string;
  otherName: string;
  onAnswered?: (updated: DailySpark) => void;
  onReact?: (reaction: string) => void; // sends reaction as special chat message
}

export function SparkCard({ spark: initSpark, myUserId, matchId, otherName, onAnswered, onReact }: Props) {
  const [spark, setSpark] = useState(initSpark);
  const [input, setInput] = useState("");
  const [reactInput, setReactInput] = useState("");
  const [showReact, setShowReact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reacted, setReacted] = useState(false);

  const isUser1 = myUserId === spark.user1Id;
  const myAnswer   = isUser1 ? spark.answerUser1 : spark.answerUser2;
  const otherAnswer = isUser1 ? spark.answerUser2 : spark.answerUser1;
  const revealed = !!spark.revealedAt;
  const otherAnswered = !!otherAnswer && !myAnswer && !revealed;
  const iWaiting  = !!myAnswer && !otherAnswer && !revealed;

  async function submit() {
    if (!input.trim() || myAnswer || submitting) return;
    setSubmitting(true); sound.pop();
    const ans = input.trim();
    const { revealed: r, spark: updated } = await submitSparkAnswer(spark.id, myUserId, spark.user1Id, ans);

    // Re-fetch to get definitive state (fixes B not seeing reveal)
    const { data } = await sb.from("daily_sparks").select("*").eq("id", spark.id).single();
    if (data) {
      const fresh: DailySpark = {
        id: data.id, matchId: data.match_id, user1Id: data.user1_id, user2Id: data.user2_id,
        question: data.question, answerUser1: data.answer_user1, answerUser2: data.answer_user2,
        sparkDate: data.spark_date, revealedAt: data.revealed_at ? new Date(data.revealed_at) : undefined,
      };
      setSpark(fresh);
      onAnswered?.(fresh);
      if (fresh.revealedAt) {
        sound.match();
        // Save to memory wall
        sb.from("memories").insert({
          match_id: fresh.matchId, user1_id: fresh.user1Id, user2_id: fresh.user2Id,
          type: "spark", title: fresh.question.slice(0, 28) + "...",
          content: { question: fresh.question, answerA: fresh.answerUser1, answerB: fresh.answerUser2 },
        }).then(() => {});
        sb.from("matches").update({ spark_count: sb.rpc("increment" as any, {}) as any }).eq("id", fresh.matchId).then(() => {});
      }
    }

    // Broadcast to other
    sb.channel(`encounter-notify-${matchId}`, { config: { broadcast: { self: false } } })
      .send({ type: "broadcast", event: "spark_answered", payload: { userId: myUserId } });

    setSubmitting(false);
  }

  function sendReaction() {
    if (!reactInput.trim() || reacted) return;
    const msg = `💬 對「${spark.question.slice(0, 20)}...」的回應：${reactInput.trim()}`;
    onReact?.(msg);
    setReacted(true);
    setShowReact(false);
    sound.pop();
  }

  return (
    <div style={{ margin: "8px 0", animation: "cardReveal .4s ease" }}>
      <div style={{ background: `linear-gradient(135deg,rgba(14,12,8,0.98),rgba(22,16,12,0.97))`, border: `1px solid ${C.rose}33`, borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${C.rose}18`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.rose }}>♥</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.rose, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>今日真心話</span>
          {revealed && <span style={{ marginLeft: "auto", fontSize: 10.5, color: C.mint, fontWeight: 600 }}>已揭曉</span>}
          {otherAnswered && <span style={{ marginLeft: "auto", fontSize: 11, color: C.rose, fontWeight: 700, animation: "glowPulse 1.5s ease-in-out infinite" }}>{otherName} 已回答，等你！</span>}
        </div>

        <div style={{ padding: "16px 16px 14px" }}>
          {/* Question */}
          <div style={{ fontSize: 15, color: C.text, lineHeight: 1.65, fontWeight: 600, marginBottom: 14, fontStyle: "italic" }}>
            「{spark.question}」
          </div>

          {!revealed ? (
            !myAnswer ? (
              <div>
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="說說你的想法..." rows={2}
                  style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" as const, lineHeight: 1.6 }}
                  onFocus={e => (e.target.style.borderColor = C.rose)} onBlur={e => (e.target.style.borderColor = C.border)} />
                <button onClick={submit} disabled={!input.trim() || submitting}
                  style={{ marginTop: 8, width: "100%", padding: "12px", borderRadius: 12, background: input.trim() ? C.gradRose : "rgba(255,255,255,0.06)", border: "none", color: input.trim() ? "#fff" : C.textDim, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", transition: "all .2s" }}>
                  {submitting ? "提交中..." : "提交"}
                </button>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>你的回答</div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{myAnswer}</div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.rose, display: "inline-block", animation: `dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}</div>
                  <span style={{ fontSize: 12, color: C.textMuted }}>等待 {otherName} 回答...</span>
                </div>
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[{ label: "你", ans: myAnswer, color: C.rose }, { label: otherName, ans: otherAnswer, color: C.gold }].map(p => (
                <div key={p.label} style={{ borderRadius: 14, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11.5, color: p.color, fontWeight: 700, marginBottom: 6 }}>{p.label}</div>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65 }}>{p.ans || "..."}</div>
                </div>
              ))}

              {/* React button */}
              {!reacted && onReact && (
                <div>
                  {!showReact ? (
                    <button onClick={() => setShowReact(true)}
                      style={{ width: "100%", padding: "10px", borderRadius: 12, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "inherit", fontSize: 13, cursor: "pointer", transition: "all .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.rose; e.currentTarget.style.color = C.rose; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}>
                      💬 回應對方的答案
                    </button>
                  ) : (
                    <div>
                      <textarea value={reactInput} onChange={e => setReactInput(e.target.value)} placeholder={`對 ${otherName} 的回答說點什麼...`} rows={2}
                        style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.rose}44`, borderRadius: 12, color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" as const, lineHeight: 1.6 }}
                        autoFocus />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => setShowReact(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>取消</button>
                        <button onClick={sendReaction} disabled={!reactInput.trim()}
                          style={{ flex: 2, padding: "10px", borderRadius: 12, background: reactInput.trim() ? C.gradRose : "rgba(255,255,255,0.06)", border: "none", color: reactInput.trim() ? "#fff" : C.textDim, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: reactInput.trim() ? "pointer" : "default" }}>
                          發送回應
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {reacted && <div style={{ fontSize: 12, color: C.mint, textAlign: "center" as const, paddingTop: 2 }}>✓ 已發送回應</div>}

              <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" as const, fontStyle: "italic" }}>✦ 已存入共同回憶</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
