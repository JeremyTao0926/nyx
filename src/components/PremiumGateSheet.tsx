import type { ReactNode } from "react";
import { C } from "../utils";

/** 統一的 Premium 升級引導彈窗（底部彈出式）。所有需要 Premium 權限的入口都用這一個。 */
export function PremiumGateSheet({ icon, title, desc, onUpgrade, onClose }: {
  icon: string;
  title: string;
  desc: ReactNode;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(20px)",display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%",maxWidth:480,background:C.bgElevated,borderRadius:"22px 22px 0 0",border:`1px solid ${C.border}`,padding:"32px 24px 52px",textAlign:"center" as const,boxShadow:C.shadowStrong,animation:"slideUp .3s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ width:60,height:60,borderRadius:"50%",background:C.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 18px",color:"#fff",fontWeight:800,boxShadow:`0 8px 24px ${C.goldGlow}` }}>{icon}</div>
        <div style={{ fontSize:20,fontWeight:800,color:C.text,marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:14,color:C.textMuted,lineHeight:1.65,marginBottom:28 }}>{desc}</div>
        <button onClick={onUpgrade}
          style={{ width:"100%",padding:"15px",borderRadius:50,background:C.grad,border:"none",color:"#fff",fontFamily:"inherit",fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 24px ${C.goldGlow}`,marginBottom:14 }}>
          升級 Premium
        </button>
        <button onClick={onClose} style={{ background:"none",border:"none",color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>稍後再說</button>
      </div>
    </div>
  );
}
