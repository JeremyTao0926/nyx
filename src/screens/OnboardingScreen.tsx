import { useState } from "react";
import { C, sound, updateProfile } from "../utils";
import type { UserProfile } from "../types";

const STEPS = [
  { id: "welcome",  title: "歡迎來到 NYX ✦",   sub: "AI 驅動的戀愛分析師，幫你找到真正的緣分。" },
  { id: "explore",  title: "探索，滑動喜歡的人", sub: "右滑喜歡，左滑略過，⭐ 超級喜歡讓對方知道你很在意。" },
  { id: "match",    title: "雙向喜歡才配對",     sub: "只有彼此都喜歡才會配對，更真實，更有品質。" },
  { id: "nyx",      title: "Nyx 幫你分析",       sub: "把聊天截圖給 Nyx，她會告訴你對方有沒有興趣，怎麼回更好。" },
  { id: "ready",    title: "準備好了嗎？",        sub: "完善你的資料，更多人會看到你。" },
];

const ICONS = ["✦", "🔥", "💗", "🔍", "🚀"];
const COLORS = [C.rose, C.rose, C.rose, C.mint, C.gold];

export function OnboardingScreen({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [ageVerified, setAgeVerified] = useState(false);
  const [ageDenied, setAgeDenied] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  function next() {
    sound.tap();
    if (step < STEPS.length - 1) {
      setExiting(true);
      setTimeout(() => { setStep(s => s + 1); setExiting(false); }, 200);
    } else {
      done();
    }
  }
  async function done() {
    await updateProfile(userId, { onboarding_done: true } as any);
    onDone();
  }

  const s = STEPS[step];
  // Age gate
  if (ageDenied) return (
    <div style={{ position:"fixed",inset:0,background:C.bg,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:32,textAlign:"center" as const }}>
      <div style={{ fontSize:48,marginBottom:20 }}>🔞</div>
      <div style={{ fontSize:22,fontWeight:800,color:C.text,marginBottom:12 }}>未滿 18 歲無法使用</div>
      <div style={{ fontSize:14,color:C.textMuted,lineHeight:1.65 }}>NYX 僅供 18 歲以上成年人使用。<br/>很遺憾，你目前無法使用本服務。</div>
    </div>
  );

  if (!ageVerified) return (
    <div style={{ position:"fixed",inset:0,background:C.bg,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:32,textAlign:"center" as const }}>
      <div style={{ fontSize:56,marginBottom:24 }}>✦</div>
      <div style={{ fontSize:26,fontWeight:800,color:C.text,marginBottom:12 }}>年齡確認</div>
      <div style={{ fontSize:15,color:C.textMuted,lineHeight:1.7,marginBottom:36 }}>
        NYX 包含成人約會內容，<br/>僅供 <span style={{ color:C.gold,fontWeight:700 }}>18 歲以上</span>成年人使用。<br/>請確認你的年齡。
      </div>
      <button onClick={()=>setAgeVerified(true)}
        style={{ width:"100%",maxWidth:360,padding:"16px",borderRadius:50,background:"linear-gradient(135deg,#C9A84C,#E2C068)",border:"none",color:"#12100C",fontFamily:"inherit",fontSize:16,fontWeight:800,cursor:"pointer",marginBottom:14,boxShadow:"0 4px 24px rgba(201,168,76,0.35)" }}>
        我已年滿 18 歲，繼續使用
      </button>
      <button onClick={()=>setAgeDenied(true)}
        style={{ background:"none",border:"none",color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>
        我未滿 18 歲
      </button>
      <div style={{ fontSize:11.5,color:C.textDim,marginTop:24,lineHeight:1.6,maxWidth:300 }}>
        繼續即代表你同意我們的服務條款與隱私政策，並確認你已年滿 18 歲。
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "60px 32px 56px", zIndex: 400, animation: "fadeIn .3s ease" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 30%, ${COLORS[step]}0A 0%, transparent 70%)`, transition: "background .5s", pointerEvents: "none" }} />

      {/* Skip */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
        {step < STEPS.length - 1 && (
          <button onClick={done} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>跳過</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: exiting ? 0 : 1, transform: exiting ? "translateY(10px)" : "translateY(0)", transition: "all .2s ease", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 80, marginBottom: 32, color: COLORS[step], animation: "float 3s ease-in-out infinite", lineHeight: 1 }}>{ICONS[step]}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 16, lineHeight: 1.25 }}>{s.title}</div>
        <div style={{ fontSize: 15.5, color: C.textSub, lineHeight: 1.7, maxWidth: 300 }}>{s.sub}</div>
      </div>

      {/* Bottom */}
      <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
        {/* Dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? COLORS[step] : C.border, transition: "all .3s" }} />
          ))}
        </div>
        <button onClick={next} style={{ width: "100%", maxWidth: 320, margin: "0 auto", display: "block", padding: "16px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 24px ${C.roseGlow}` }}>
          {step === STEPS.length - 1 ? "開始使用 →" : "繼續"}
        </button>
      </div>
    </div>
  );
}
