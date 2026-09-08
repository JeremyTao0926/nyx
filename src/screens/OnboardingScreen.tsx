import { useState } from "react";
import { C, sound, updateProfile } from "../utils";

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
    await updateProfile(userId, { onboarding_done: true });
    onDone();
  }

  const s = STEPS[step];
  // Age gate
  if (ageDenied) return (
    <div style={{ position:"fixed",inset:0,background:C.gradAmbient,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:32,textAlign:"center" as const }}>
      <div style={{ width:86,height:86,borderRadius:28,background:C.roseSoft,border:`1px solid ${C.rose}33`,display:"grid",placeItems:"center",fontSize:42,marginBottom:22,boxShadow:C.shadow }}>🔞</div>
      <div style={{ fontSize:22,fontWeight:800,color:C.text,marginBottom:12 }}>未滿 18 歲無法使用</div>
      <div style={{ maxWidth:330,fontSize:14,color:C.textMuted,lineHeight:1.65,background:C.glass,border:`1px solid ${C.border}`,borderRadius:20,padding:"18px 20px",boxShadow:C.shadow }}>NYX 僅供 18 歲以上成年人使用。<br/>很遺憾，你目前無法使用本服務。</div>
    </div>
  );

  if (!ageVerified) return (
    <div style={{ position:"fixed",inset:0,background:C.gradAmbient,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"max(28px, env(safe-area-inset-top)) 22px max(28px, env(safe-area-inset-bottom))",textAlign:"center" as const }}>
      <div style={{ width:"100%",maxWidth:390,background:C.glass,border:`1px solid ${C.border}`,borderRadius:28,padding:"32px 24px 24px",boxShadow:C.shadowStrong,backdropFilter:"blur(24px) saturate(140%)" }}>
        <div style={{ width:82,height:82,borderRadius:27,background:C.grad,display:"grid",placeItems:"center",fontSize:38,color:C.white,margin:"0 auto 24px",boxShadow:`0 16px 34px ${C.goldGlow}` }}>✦</div>
        <div style={{ fontSize:26,fontWeight:800,color:C.text,marginBottom:12 }}>年齡確認</div>
        <div style={{ fontSize:15,color:C.textMuted,lineHeight:1.7,marginBottom:30 }}>
          NYX 包含成人約會內容，<br/>僅供 <span style={{ color:C.gold,fontWeight:700 }}>18 歲以上</span>成年人使用。<br/>請確認你的年齡。
        </div>
        <button type="button" onClick={()=>setAgeVerified(true)}
          style={{ width:"100%",minHeight:52,padding:"14px",borderRadius:18,background:C.grad,border:"none",color:C.white,fontFamily:"inherit",fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:12,boxShadow:`0 12px 28px ${C.goldGlow}` }}>
          我已年滿 18 歲，繼續使用
        </button>
        <button type="button" onClick={()=>setAgeDenied(true)}
          style={{ width:"100%",minHeight:44,background:"transparent",border:`1px solid ${C.border}`,borderRadius:16,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>
          我未滿 18 歲
        </button>
        <div style={{ fontSize:11.5,color:C.textDim,margin:"20px auto 0",lineHeight:1.6,maxWidth:300 }}>
          繼續即代表你同意我們的服務條款與隱私政策，並確認你已年滿 18 歲。
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: C.gradAmbient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "max(48px, env(safe-area-inset-top)) 28px max(36px, env(safe-area-inset-bottom))", zIndex: 400, animation: "fadeIn .3s ease" }}>
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
        <div style={{ width:112,height:112,borderRadius:36,background:C.glass,border:`1px solid ${COLORS[step]}33`,boxShadow:C.shadowStrong,display:"grid",placeItems:"center",fontSize: 58, marginBottom: 32, color: COLORS[step], animation: "float 3s ease-in-out infinite", lineHeight: 1,backdropFilter:"blur(20px)" }}>{ICONS[step]}</div>
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
        <button type="button" onClick={next} style={{ width: "100%", maxWidth: 320, minHeight:52, margin: "0 auto", display: "block", padding: "14px", borderRadius: 18, background: C.grad, border: "none", color: C.white, fontFamily: "inherit", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: `0 12px 28px ${C.goldGlow}` }}>
          {step === STEPS.length - 1 ? "開始使用 →" : "繼續"}
        </button>
      </div>
    </div>
  );
}
