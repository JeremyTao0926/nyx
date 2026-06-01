import { useState, useRef } from "react";
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
  const nextIdx = useRef(3);
  const [showing, setShowing] = useState([0, 1, 2]);
  const [fade, setFade] = useState(true);

  function refresh() {
    setFade(false);
    setTimeout(() => {
      const pool = Array.from({ length: SPARKS.length }, (_, i) => i).filter(i => !showing.includes(i));
      const next: number[] = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const pick = Math.floor(Math.random() * pool.length);
        next.push(pool.splice(pick, 1)[0]);
      }
      setShowing(next.length === 3 ? next : [0, 1, 2]);
      setFade(true);
    }, 200);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg, animation:"tabSwitch .3s ease" }}>
      <div style={{ padding:"52px 20px 24px", textAlign:"center" }}>
        <div style={{ fontSize:32, fontFamily:"Georgia,serif", fontStyle:"italic", color:C.gold, marginBottom:8, letterSpacing:"0.03em" }}>Spark</div>
        <div style={{ fontSize:14, color:C.textMuted, lineHeight:1.6 }}>用一個真心話<br/>開啟一段真誠的對話</div>
      </div>
      <div style={{ flex:1, overflow:"auto", padding:"0 20px" }}>
        <div style={{ opacity:fade?1:0, transition:"opacity .2s", display:"flex", flexDirection:"column", gap:12 }}>
          {showing.map((idx, i) => (
            <div key={`${idx}-${i}`}
              style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:18, padding:"22px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, cursor:"pointer", transition:"all .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=C.gold; (e.currentTarget as HTMLElement).style.background=C.bgGold; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=C.border; (e.currentTarget as HTMLElement).style.background=C.bgCard; }}>
              <div style={{ fontSize:15, color:C.text, lineHeight:1.55, fontWeight:500 }}>{SPARKS[idx]}</div>
              <div style={{ width:32, height:32, borderRadius:"50%", background:C.surfGold, border:`1px solid ${C.gold}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:C.gold, fontSize:15 }}>→</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding:"20px 20px 32px" }}>
        <button onClick={refresh} style={{ width:"100%", padding:"14px", borderRadius:50, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:15, fontWeight:700, cursor:"pointer" }}>換一個問題</button>
      </div>
    </div>
  );
}
