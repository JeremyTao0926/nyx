import { useCallback, useEffect, useState } from "react";
import { C } from "../utils";

const ROUND_SECONDS = 15;

const QUESTIONS = [
  { question: "只能選一個？", options: ["❤️ 真愛", "💰 一百萬美元"] },
  { question: "第一次約會更重要？", options: ["有趣", "真誠"] },
  { question: "理想週末？", options: ["旅行", "宅家"] },
  { question: "戀愛中更看重？", options: ["陪伴", "成長"] },
  { question: "你比較像？", options: ["感性", "理性"] },
];

export function GameScreen() {
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const advance = useCallback(() => {
    if (round >= QUESTIONS.length - 1) {
      setCompleted(true);
      setTimeLeft(0);
      return;
    }

    setRound(current => current + 1);
    setSelected(null);
    setTimeLeft(ROUND_SECONDS);
  }, [round]);

  useEffect(() => {
    if (completed || selected) return;
    if (timeLeft <= 0) {
      const timer = window.setTimeout(advance, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setTimeLeft(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [advance, completed, selected, timeLeft]);

  useEffect(() => {
    if (!selected || completed) return;
    const timer = window.setTimeout(advance, 600);
    return () => window.clearTimeout(timer);
  }, [advance, completed, selected]);

  function restart() {
    setRound(0);
    setSelected(null);
    setCompleted(false);
    setTimeLeft(ROUND_SECONDS);
  }

  const progress = completed ? 100 : ((round + 1) / QUESTIONS.length) * 100;
  const q = QUESTIONS[round];

  return (
    <main style={{
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      background: C.gradAmbient,
      padding: "max(40px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom))",
      overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 420, margin: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <header>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Heart Rush</div>
              <h1 style={{ margin: "5px 0 0", color: C.text, fontSize: 23, lineHeight: 1.2 }}>快速心動問答</h1>
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 999, background: C.glass, border: `1px solid ${C.border}`, color: C.textSub, fontSize: 12, fontWeight: 700, boxShadow: C.shadow }}>
              {completed ? "完成" : `${round + 1} / ${QUESTIONS.length}`}
            </div>
          </div>
          <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: C.surfHigh, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: C.grad, transition: "width .35s ease" }} />
          </div>
        </header>

        {completed ? (
          <section style={{ padding: "34px 24px", borderRadius: 28, background: C.glass, border: `1px solid ${C.border}`, boxShadow: C.shadowStrong, textAlign: "center", backdropFilter: "blur(24px) saturate(140%)" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 20px", borderRadius: 28, background: C.gradRose, display: "grid", placeItems: "center", color: C.white, fontSize: 34, boxShadow: `0 18px 38px ${C.roseGlow}` }}>♥</div>
            <div style={{ color: C.gold, fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>Round complete</div>
            <h2 style={{ margin: "8px 0", color: C.text, fontSize: 27 }}>默契正在升溫</h2>
            <p style={{ margin: "0 0 26px", color: C.textMuted, fontSize: 14, lineHeight: 1.65 }}>你已完成 Heart Rush，獲得 10 點互動分。</p>
            <button type="button" onClick={restart} style={{ width: "100%", minHeight: 52, border: "none", borderRadius: 18, background: C.grad, color: C.white, fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: `0 12px 28px ${C.goldGlow}` }}>
              再玩一次
            </button>
          </section>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ padding: "28px 22px", borderRadius: 28, background: C.glass, border: `1px solid ${C.border}`, boxShadow: C.shadowStrong, textAlign: "center", backdropFilter: "blur(24px) saturate(140%)" }}>
              <div
                aria-label={`剩餘 ${timeLeft} 秒`}
                aria-live="polite"
                style={{
                  width: 112,
                  height: 112,
                  margin: "0 auto 24px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: `radial-gradient(circle closest-side, ${C.bgElevated} 84%, transparent 85% 100%), conic-gradient(${timeLeft <= 5 ? C.rose : C.gold} ${(timeLeft / ROUND_SECONDS) * 100}%, ${C.surfHigh} 0)`,
                  color: timeLeft <= 5 ? C.rose : C.gold,
                  fontSize: 44,
                  fontWeight: 900,
                  fontVariantNumeric: "tabular-nums",
                  boxShadow: C.shadow,
                  transition: "color .2s",
                }}
              >
                {timeLeft}
              </div>
              <div style={{ color: C.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>選出更像你的答案</div>
              <h2 style={{ margin: 0, color: C.text, fontSize: "clamp(23px, 7vw, 30px)", lineHeight: 1.3 }}>{q.question}</h2>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {q.options.map((option, index) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={selected !== null}
                    onClick={() => setSelected(option)}
                    style={{
                      width: "100%",
                      minHeight: 62,
                      padding: "16px 18px",
                      borderRadius: 20,
                      border: `1px solid ${isSelected ? C.gold : C.border}`,
                      background: isSelected ? C.grad : C.bgCard,
                      color: isSelected ? C.white : C.text,
                      boxShadow: isSelected ? `0 14px 30px ${C.goldGlow}` : C.shadow,
                      fontFamily: "inherit",
                      fontSize: 16,
                      fontWeight: 750,
                      cursor: selected ? "default" : "pointer",
                      opacity: selected && !isSelected ? .55 : 1,
                      transition: "transform .2s, opacity .2s, box-shadow .2s",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", width: 28, height: 28, marginRight: 12, alignItems: "center", justifyContent: "center", borderRadius: 10, background: isSelected ? "rgba(255,255,255,.18)" : C.surfGold, color: isSelected ? C.white : C.gold, fontSize: 12, fontWeight: 900 }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
