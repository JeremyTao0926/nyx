import { useState } from "react";
import { C } from "../utils";

const SPARKS = [
  "如果明天是世界末日，你最想做什麼？",
  "你最近一次真心笑是因為什麼？",
  "有什麼事你想做但一直沒有開始？",
  "什麼樣的人讓你覺得很安心？",
  "你覺得一段好的關係最重要的是什麼？",
  "你喜歡一個人的旅行還是一群人？",
  "最近讓你印象最深的一部電影或書？",
  "你有什麼「只有親近的人才知道」的一面？",
  "你覺得自己最吸引人的地方是什麼？",
  "如果可以馬上學會一件事，你想學什麼？",
  "你的朋友會怎樣用三個字形容你？",
  "哪個瞬間讓你覺得最近的自己很快樂？",
];

export function SparkScreen() {
  const [showing, setShowing] = useState([0, 1, 2]);
  const [fade, setFade] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  function refresh() {
    setFade(false);
    window.setTimeout(() => {
      const pool = Array.from({ length: SPARKS.length }, (_, i) => i).filter(i => !showing.includes(i));
      const next: number[] = [];
      for (let i = 0; i < 3 && pool.length > 0; i += 1) {
        const pick = Math.floor(Math.random() * pool.length);
        next.push(pool.splice(pick, 1)[0]);
      }
      setShowing(next.length === 3 ? next : [0, 1, 2]);
      setCopied(null);
      setFade(true);
    }, 200);
  }

  async function copySpark(index: number) {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(SPARKS[index]);
    setCopied(index);
    window.setTimeout(() => setCopied(current => current === index ? null : current), 1500);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: C.gradAmbient, animation: "tabSwitch .3s ease", overflow: "hidden" }}>
      <header style={{ padding: "max(48px, env(safe-area-inset-top)) 20px 26px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 999, background: C.glass, border: `1px solid ${C.border}`, color: C.gold, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", boxShadow: C.shadow }}>
          <span aria-hidden="true">✦</span> Conversation starter
        </div>
        <h1 style={{ margin: "14px 0 7px", fontSize: 35, letterSpacing: "-.04em", color: C.text }}>Spark</h1>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>一個好問題，讓聊天自然進入更深的地方。</p>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
        <div style={{ opacity: fade ? 1 : 0, transform: fade ? "translateY(0)" : "translateY(5px)", transition: "opacity .2s, transform .2s", display: "flex", flexDirection: "column", gap: 13 }}>
          {showing.map((index, position) => {
            const isCopied = copied === index;
            return (
              <button
                key={`${index}-${position}`}
                type="button"
                onClick={() => copySpark(index)}
                aria-label={`複製問題：${SPARKS[index]}`}
                style={{
                  width: "100%",
                  minHeight: 106,
                  background: C.bgCard,
                  border: `1px solid ${isCopied ? C.gold : C.border}`,
                  borderRadius: 22,
                  padding: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  cursor: "pointer",
                  transition: "border-color .2s, box-shadow .2s, transform .2s",
                  boxShadow: isCopied ? `0 14px 34px ${C.goldGlow}` : C.shadow,
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 12, background: position === 1 ? C.roseSoft : position === 2 ? C.mintSoft : C.goldSoft, color: position === 1 ? C.rose : position === 2 ? C.mint : C.gold, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 900 }}>
                  {String(position + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, color: C.text, lineHeight: 1.6, fontWeight: 650 }}>{SPARKS[index]}</span>
                  <span style={{ display: "block", marginTop: 8, fontSize: 11, color: isCopied ? C.gold : C.textMuted, fontWeight: 700 }}>{isCopied ? "已複製到剪貼簿" : "點按即可複製"}</span>
                </span>
                <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", background: isCopied ? C.grad : C.surfGold, border: `1px solid ${isCopied ? "transparent" : `${C.gold}33`}`, display: "grid", placeItems: "center", flexShrink: 0, color: isCopied ? C.white : C.gold, fontSize: 16 }}>
                  {isCopied ? "✓" : "↗"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <footer style={{ padding: "20px 20px max(28px, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={refresh} style={{ width: "100%", minHeight: 52, borderRadius: 18, background: C.grad, border: "none", color: C.white, fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: `0 12px 30px ${C.goldGlow}` }}>
          換一組問題
        </button>
      </footer>
    </main>
  );
}
