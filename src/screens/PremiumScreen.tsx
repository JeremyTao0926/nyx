import { useState } from "react";
import { C, WRAP } from "../utils";

const PLANS = [
  { id:"monthly", label:"1 個月", price:"HK$68", per:"/月", popular:false, save:"" },
  { id:"quarterly",label:"3 個月", price:"HK$98", per:"/月", popular:true, save:"省 HK$90" },
  { id:"yearly",  label:"12 個月",price:"HK$68", per:"/月", popular:false, save:"省 HK$720" },
];

const FEATURES = [
  { icon:"∞",  label:"無限喜歡",       free:"30個/天",   vip:"無限" },
  { icon:"◈",  label:"查看誰喜歡你",   free:"模糊顯示",  vip:"清晰查看" },
  { icon:"★",  label:"超級喜歡",       free:"1個/天",    vip:"5個/天" },
  { icon:"↑",  label:"Boost 優先曝光", free:"不可用",    vip:"每週1次" },
  { icon:"✦",  label:"Nyx AI 深度分析",free:"基礎版",    vip:"完整版" },
  { icon:"⊞",  label:"進階篩選",       free:"有限制",    vip:"完全開放" },
  { icon:"✓",  label:"已讀回執",       free:"配對後",    vip:"所有訊息" },
  { icon:"◆",  label:"VIP Gold 徽章",  free:"—",         vip:"✓" },
];

export function PremiumScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState("quarterly");
  const plan = PLANS.find(p => p.id === selected)!;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg, overflowY:"auto", ...WRAP, animation:"tabSwitch .3s ease" }}>
      {/* Gold header */}
      <div style={{ padding:"52px 20px 28px", background:`linear-gradient(180deg, rgba(201,168,76,0.08) 0%, transparent 100%)`, position:"relative", textAlign:"center" }}>
        <button onClick={onBack} style={{ position:"absolute", top:52, left:16, background:"none", border:"none", color:C.textMuted, fontSize:22, cursor:"pointer", fontFamily:"inherit", lineHeight:1 }}>‹</button>
        {/* VIP card */}
        <div style={{ background:`linear-gradient(135deg,#2A2218,#3D3020)`, border:`1px solid ${C.gold}44`, borderRadius:20, padding:"24px 24px 20px", marginBottom:24, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", background:`radial-gradient(circle,rgba(201,168,76,0.15),transparent)`, pointerEvents:"none" }}/>
          <div style={{ fontSize:11, letterSpacing:"0.25em", color:C.gold, textTransform:"uppercase" as const, marginBottom:8, fontWeight:600 }}>VIP Gold Member</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.text, marginBottom:4 }}>升級會員</div>
          <div style={{ fontSize:14, color:C.textMuted }}>解鎖更多特權</div>
          <div style={{ position:"absolute", bottom:16, right:20, fontSize:32, opacity:.15, color:C.gold }}>◆</div>
        </div>

        {/* Plan selector */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {PLANS.map(p => (
            <div key={p.id} onClick={() => setSelected(p.id)}
              style={{ padding:"16px 18px", borderRadius:16, border:`1.5px solid ${selected===p.id ? C.gold : C.border}`, background:selected===p.id ? C.bgGold : "transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all .2s", position:"relative" }}>
              {p.popular && <div style={{ position:"absolute", top:-10, right:16, background:C.grad, borderRadius:20, padding:"2px 12px", fontSize:11, color:C.bg, fontWeight:700 }}>推薦</div>}
              <div style={{ textAlign:"left" as const }}>
                <div style={{ fontSize:14, color:C.text, fontWeight:600 }}>{p.label}</div>
                {p.save && <div style={{ fontSize:12, color:C.mint, marginTop:2, fontWeight:600 }}>{p.save}</div>}
              </div>
              <div style={{ textAlign:"right" as const }}>
                <div style={{ fontSize:22, fontWeight:800, color:selected===p.id?C.gold:C.text }}>{p.price}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{p.per}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button style={{ width:"100%", padding:"16px", borderRadius:50, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:16, fontWeight:800, cursor:"pointer", boxShadow:`0 4px 24px ${C.goldGlow}`, marginBottom:10, letterSpacing:".02em" }}>
          立即升級
        </button>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:32 }}>隨時可取消 · 無隱藏費用</div>
      </div>

      {/* Features */}
      <div style={{ padding:"0 20px 48px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:14 }}>功能對比</div>
        <div style={{ background:C.bgCard, borderRadius:18, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 72px 72px", padding:"12px 16px", background:C.bgElevated, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>功能</div>
            <div style={{ fontSize:11, color:C.textMuted, textAlign:"center" as const }}>免費</div>
            <div style={{ fontSize:11, color:C.gold, fontWeight:700, textAlign:"center" as const }}>VIP</div>
          </div>
          {FEATURES.map((f,i) => (
            <div key={f.label} style={{ display:"grid", gridTemplateColumns:"1fr 72px 72px", padding:"13px 16px", borderBottom:i<FEATURES.length-1?`1px solid ${C.border}`:"none", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:15, color:C.gold, width:20, textAlign:"center" as const, fontWeight:700 }}>{f.icon}</span>
                <span style={{ fontSize:13.5, color:C.textSub }}>{f.label}</span>
              </div>
              <div style={{ fontSize:12, color:C.textMuted, textAlign:"center" as const }}>{f.free}</div>
              <div style={{ fontSize:12, color:C.mint, fontWeight:600, textAlign:"center" as const }}>{f.vip}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:20, textAlign:"center", fontSize:11.5, color:C.textDim, lineHeight:1.7 }}>
          訂閱費用由帳戶扣除，可隨時取消。<br/>
          <span style={{ color:C.textMuted, cursor:"pointer" }} onClick={() => window.open("https://nyx.app/terms","_blank")}>服務條款</span>
          {" · "}
          <span style={{ color:C.textMuted, cursor:"pointer" }} onClick={() => window.open("https://nyx.app/privacy","_blank")}>隱私政策</span>
        </div>
      </div>
    </div>
  );
}
