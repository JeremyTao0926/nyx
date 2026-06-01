import { useState, useRef, useEffect } from "react";
import { C, WRAP, MBTI_LIST, EMOJIS, HOBBIES, ETHNICITY, COUNTRIES, sound, groqVision, toB64, buildSys } from "../utils";
import type { UserProfile, ImgItem, ExtractedConvo } from "../types";

/* ─── Shared input style ─────────────────────────────── */
const INP = { width:"100%", padding:"12px 14px", background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const, transition:"border-color .2s" };

/* ─── Bottom Sheet base (drag to close) ─────────────── */
export function BottomSheet({ children, onClose, title, maxH="86vh" }:
  { children:React.ReactNode; onClose:()=>void; title?:string; maxH?:string }) {
  const [ty, setTy]  = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef(0);
  function close(){ setClosing(true); setTimeout(onClose,260); }
  return <div style={{ position:"fixed",inset:0,zIndex:100,background:closing?"rgba(0,0,0,0)":"rgba(0,0,0,0.6)",backdropFilter:closing?"none":"blur(18px)",display:"flex",alignItems:"flex-end",justifyContent:"center",transition:"background .26s" }} onClick={close}>
    <div onClick={e=>e.stopPropagation()}
      onTouchStart={e=>{startY.current=e.touches[0].clientY;}}
      onTouchMove={e=>{const dy=e.touches[0].clientY-startY.current;if(dy>0)setTy(dy);}}
      onTouchEnd={()=>{if(ty>90)close();else setTy(0);}}
      style={{ maxWidth:480,margin:"0 auto",width:"100%",background:C.bgElevated,borderRadius:"22px 22px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:maxH,overflowY:"auto",transform:closing?`translateY(100%)`:`translateY(${ty}px)`,transition:ty===0?"transform .3s cubic-bezier(.32,.72,0,1)":"none",animation:closing?undefined:"slideUp .32s cubic-bezier(.32,.72,0,1)" }}>
      <div style={{ padding:"14px 0 0",display:"flex",flexDirection:"column",alignItems:"center" }}>
        <div style={{ width:40,height:4,borderRadius:3,background:C.border,cursor:"grab" }} />
      </div>
      {title&&<div style={{ padding:"16px 20px 0",fontSize:17,fontWeight:700,color:C.text }}>{title}</div>}
      {children}
    </div>
  </div>;
}

/* ─── Custom Select ──────────────────────────────────── */
export function Select({ value, options, onChange, label }:{ value:string; options:string[]; onChange:(v:string)=>void; label?:string }) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  return <div ref={ref} style={{ position:"relative" }}>
    {label&&<div style={{ fontSize:11,color:C.textMuted,marginBottom:8,letterSpacing:1,textTransform:"uppercase" as const,fontWeight:600 }}>{label}</div>}
    <button onClick={()=>{setOpen(p=>!p);sound.tap();}} style={{ width:"100%",padding:"12px 14px",background:C.surf,border:`1px solid ${open?C.borderFocus:C.border}`,borderRadius:12,color:value?C.text:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"border-color .2s" }}>
      <span>{value||"請選擇"}</span>
      <span style={{ transform:open?"rotate(180deg)":"none",transition:"transform .2s",fontSize:10,opacity:.5 }}>▼</span>
    </button>
    {open&&<div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(20,20,32,0.99)",backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",zIndex:200,maxHeight:220,overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,0.5)",animation:"dropDown .18s ease" }}>
      {options.map(o=><button key={o} onClick={()=>{onChange(o);setOpen(false);sound.tap();}} style={{ width:"100%",padding:"11px 16px",background:value===o?C.roseSoft:"transparent",border:"none",color:value===o?C.rose:C.text,fontFamily:"inherit",fontSize:13.5,cursor:"pointer",textAlign:"left" as const,display:"block",fontWeight:value===o?600:400,transition:"background .12s" }} onMouseEnter={e=>(e.currentTarget.style.background=C.surf)} onMouseLeave={e=>(e.currentTarget.style.background=value===o?C.roseSoft:"transparent")}>{o}</button>)}
    </div>}
  </div>;
}

/* ─── Multi Select ───────────────────────────────────── */
export function MultiSelect({ label, options, value, onChange, color=C.rose }:{ label:string; options:string[]; value:string[]; onChange:(v:string[])=>void; color?:string }) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  return <div ref={ref} style={{ position:"relative" }}>
    {label&&<div style={{ fontSize:11,color:C.textMuted,marginBottom:8,letterSpacing:1,textTransform:"uppercase" as const,fontWeight:600 }}>{label}</div>}
    <button onClick={()=>{setOpen(p=>!p);sound.tap();}} style={{ width:"100%",padding:"12px 14px",background:C.surf,border:`1px solid ${open?color:C.border}`,borderRadius:12,color:value.length?C.text:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,transition:"border-color .2s" }}>
      <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,flex:1,textAlign:"left" as const }}>{value.length?value.join("、"):"請選擇（可多選）"}</span>
      <span style={{ transform:open?"rotate(180deg)":"none",transition:"transform .2s",fontSize:10,opacity:.5,flexShrink:0 }}>▼</span>
    </button>
    {open&&<div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(20,20,32,0.99)",backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",zIndex:200,maxHeight:260,overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,0.5)",animation:"dropDown .18s ease" }}>
      {options.map(o=>{const sel=value.includes(o);return<button key={o} onClick={()=>{onChange(sel?value.filter(x=>x!==o):[...value,o]);sound.tap();}} style={{ width:"100%",padding:"11px 16px",background:sel?"rgba(232,54,93,0.08)":"transparent",border:"none",color:sel?color:C.text,fontFamily:"inherit",fontSize:13.5,cursor:"pointer",textAlign:"left" as const,display:"flex",alignItems:"center",gap:12,fontWeight:sel?600:400,transition:"background .12s" }} onMouseEnter={e=>(e.currentTarget.style.background=C.surf)} onMouseLeave={e=>(e.currentTarget.style.background=sel?"rgba(232,54,93,0.08)":"transparent")}>
        <span style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${sel?color:C.border}`,background:sel?color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",flexShrink:0,transition:"all .15s" }}>{sel?"✓":""}</span>{o}
      </button>;})}
    </div>}
  </div>;
}

/* ─── MbtiSheet ──────────────────────────────────────── */
export function MbtiSheet({ mbti, onSelect, onClose }:{ mbti:string; onSelect:(m:string)=>void; onClose:()=>void }) {
  return <BottomSheet onClose={onClose} title="選擇 MBTI">
    <div style={{ padding:"20px 20px 44px" }}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
        {MBTI_LIST.map(m=><button key={m} onClick={()=>{onSelect(m);onClose();sound.tap();}} style={{ background:mbti===m?C.roseSoft:"transparent",border:`1px solid ${mbti===m?C.rose:C.border}`,borderRadius:12,padding:"11px 4px",color:mbti===m?C.rose:C.textSub,fontFamily:"inherit",fontSize:12.5,fontWeight:mbti===m?700:400,cursor:"pointer",transition:"all .15s" }}>{m}</button>)}
      </div>
    </div>
  </BottomSheet>;
}

/* ─── EmojiPanel ─────────────────────────────────────── */
export function EmojiPanel({ onPick, onClose }:{ onPick:(e:string)=>void; onClose:()=>void }) {
  return <div style={{ position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,zIndex:50,background:"rgba(20,20,32,0.99)",backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:18,padding:"14px 12px 10px",animation:"emojiUp .2s ease",boxShadow:"0 -4px 32px rgba(0,0,0,0.45)" }}>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
      <span style={{ fontSize:11,color:C.textMuted,letterSpacing:.5 }}>表情</span>
      <button onClick={onClose} style={{ background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,lineHeight:1 }}>✕</button>
    </div>
    <div style={{ display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:2 }}>
      {EMOJIS.map((e,i)=><button key={i} onClick={()=>{onPick(e);sound.tap();}} style={{ background:"transparent",border:"none",fontSize:22,cursor:"pointer",padding:"7px 4px",borderRadius:8,lineHeight:1,transition:"transform .1s" }} onMouseEnter={ev=>(ev.currentTarget.style.transform="scale(1.22)")} onMouseLeave={ev=>(ev.currentTarget.style.transform="scale(1)")}>{e}</button>)}
    </div>
  </div>;
}

/* ─── FilterSheet ── drag-to-close, unlimited distance ── */
export function FilterSheet({ filters, onSave, onClose }:{ filters:Partial<UserProfile>; onSave:(f:Partial<UserProfile>)=>void; onClose:()=>void }) {
  const [f,setF]=useState({...filters});
  const dist=f.filter_max_distance??100;
  const unlimited=dist>=500;
  return <BottomSheet onClose={onClose} title="篩選條件" maxH="90vh">
    <div style={{ padding:"20px 20px 48px",display:"flex",flexDirection:"column",gap:24 }}>
      {/* Gender */}
      <div>
        <div style={{ fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:12 }}>尋找對象</div>
        <div style={{ display:"flex",gap:8 }}>
          {["female","male","both"].map(g=><button key={g} onClick={()=>setF(p=>({...p,looking_for_gender:g}))} style={{ flex:1,padding:"11px",borderRadius:12,background:f.looking_for_gender===g?C.roseSoft:"transparent",border:`1px solid ${f.looking_for_gender===g?C.rose:C.border}`,color:f.looking_for_gender===g?C.rose:C.textSub,fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:f.looking_for_gender===g?600:400,transition:"all .15s" }}>{g==="female"?"女性":g==="male"?"男性":"全部"}</button>)}
        </div>
      </div>
      {/* Age */}
      <div>
        <div style={{ fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:10 }}>年齡：{f.filter_min_age??18} – {f.filter_max_age??35} 歲</div>
        <input type="range" min={18} max={50} value={f.filter_min_age??18} onChange={e=>setF(p=>({...p,filter_min_age:+e.target.value}))} style={{ width:"100%",marginBottom:10 }} />
        <input type="range" min={18} max={60} value={f.filter_max_age??35} onChange={e=>setF(p=>({...p,filter_max_age:+e.target.value}))} style={{ width:"100%" }} />
      </div>
      {/* Distance */}
      <div>
        <div style={{ fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span>距離</span>
          <span style={{ color:unlimited?C.mint:C.text,fontWeight:700,fontSize:13 }}>{unlimited?"無限制 ∞":`${dist} km`}</span>
        </div>
        <input type="range" min={10} max={500} step={10} value={dist} onChange={e=>setF(p=>({...p,filter_max_distance:+e.target.value}))} style={{ width:"100%",accentColor:unlimited?C.mint:C.rose } as any} />
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:5 }}>
          <span style={{ fontSize:11,color:C.textDim }}>10 km</span>
          <span style={{ fontSize:11,color:C.mint }}>∞ 無限</span>
        </div>
      </div>
      {/* Country */}
      <Select label="所在地區" value={f.filter_country||""} options={["不限",...COUNTRIES]} onChange={v=>setF(p=>({...p,filter_country:v==="不限"?null:v}))} />
      {/* Ethnicity */}
      <MultiSelect label="族裔背景" options={ETHNICITY} value={f.filter_ethnicity||[]} onChange={v=>setF(p=>({...p,filter_ethnicity:v}))} color={C.rose} />
      <button onClick={()=>{onSave(f);onClose();sound.pop();}} style={{ width:"100%",padding:"15px",borderRadius:14,background:C.grad,border:"none",color:"#fff",fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${C.roseGlow}` }}>套用篩選</button>
    </div>
  </BottomSheet>;
}

/* ─── SimulateModal ──────────────────────────────────── */
export function SimulateModal({ onEnter, onClose }:{ onEnter:(imgs:ImgItem[],mode:"new"|"continue",ex:ExtractedConvo|null)=>void; onClose:()=>void }) {
  const [step,setStep]=useState<"upload"|"choose"|"extracting"|"preview">("upload");
  const [imgs,setImgs]=useState<ImgItem[]>([]); const [ex,setEx]=useState<ExtractedConvo|null>(null);
  const fRef=useRef<HTMLInputElement>(null);
  function addImgs(files:FileList){Array.from(files).slice(0,10-imgs.length).forEach(file=>{const r=new FileReader();r.onloadend=()=>setImgs(p=>[...p,{file,preview:r.result as string}]);r.readAsDataURL(file);});}
  async function extract(){
    setStep("extracting");
    try{const b64s=await Promise.all(imgs.map(i=>toB64(i.file)));const raw=await groqVision(b64s,`從截圖提取，只返回JSON：{"name":"名字或null","messages":[{"from":"me","text":"..."},{"from":"her","text":"..."}],"styleDesc":"她的風格100字"}\n時間順序，圖片用[圖片]`,buildSys("INFP","male"));setEx(JSON.parse(raw.replace(/```json|```/g,"").trim()));}
    catch{setEx({name:null,messages:[],styleDesc:""});}setStep("preview");
  }
  return <BottomSheet onClose={onClose} title="💭 模擬對話模式">
    <div style={{ padding:"20px 20px 48px" }}>
      {step==="upload"&&<>
        <div style={{ fontSize:13.5,color:C.textMuted,marginBottom:18,lineHeight:1.6 }}>上傳截圖，Nyx 學習她的回覆風格來模擬對話。</div>
        <div style={{ display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:14 }}>
          {imgs.map((img,i)=><div key={i} style={{ position:"relative" }}>
            <img src={img.preview} alt="" style={{ width:64,height:64,objectFit:"cover" as const,borderRadius:10,border:`1px solid ${C.border}`,display:"block" }}/>
            <button onClick={()=>setImgs(p=>p.filter((_,j)=>j!==i))} style={{ position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:C.rose,border:"none",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
          </div>)}
          {imgs.length<10&&<button onClick={()=>fRef.current?.click()} style={{ width:64,height:64,borderRadius:10,border:`2px dashed ${C.border}`,background:"transparent",color:C.textMuted,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>}
        </div>
        <input ref={fRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{if(e.target.files)addImgs(e.target.files);}}/>
        <div style={{ fontSize:12,color:C.textDim,marginBottom:18 }}>已選 {imgs.length}/10 張</div>
        <button onClick={()=>imgs.length>0&&setStep("choose")} style={{ width:"100%",padding:"14px",borderRadius:14,background:imgs.length>0?C.grad:"rgba(255,255,255,0.05)",border:`1px solid ${imgs.length>0?"transparent":C.border}`,color:imgs.length>0?"#fff":C.textDim,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:imgs.length>0?"pointer":"default" }}>{imgs.length===0?"請先上傳截圖":"下一步 →"}</button>
        <button onClick={onClose} style={{ width:"100%",marginTop:10,padding:"12px",borderRadius:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>取消</button>
      </>}
      {step==="choose"&&<>
        <button onClick={()=>setStep("upload")} style={{ background:"none",border:"none",color:C.textMuted,fontSize:14,cursor:"pointer",marginBottom:18,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>← 返回</button>
        {[{icon:"🆕",t:"新對話",d:"從空白開始，輸入你要說的第一句",fn:()=>onEnter(imgs,"new",null)},
          {icon:"📜",t:"續接截圖",d:"Nyx 讀取截圖歷史，你接著打下一句",fn:extract}].map((o,i)=>
          <button key={i} onClick={o.fn} style={{ width:"100%",padding:"18px 16px",borderRadius:16,background:C.surf,border:`1px solid ${C.border}`,textAlign:"left" as const,cursor:"pointer",marginBottom:12,display:"block",transition:"all .2s" }} onMouseEnter={e=>(e.currentTarget.style.borderColor=C.borderHigh)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
            <div style={{ fontSize:22,marginBottom:6 }}>{o.icon}</div>
            <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:4 }}>{o.t}</div>
            <div style={{ fontSize:12.5,color:C.textMuted }}>{o.d}</div>
          </button>)}
      </>}
      {step==="extracting"&&<div style={{ textAlign:"center",padding:"44px 0" }}>
        <div style={{ display:"flex",gap:7,justifyContent:"center",marginBottom:18 }}>{[0,1,2].map(i=><span key={i} style={{ width:10,height:10,borderRadius:"50%",background:"#FF9A3C",display:"inline-block",animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}</div>
        <div style={{ fontSize:14,color:C.textMuted }}>正在分析截圖...</div>
      </div>}
      {step==="preview"&&ex&&<>
        <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:14 }}>{ex.name?`讀到：${ex.name}`:"未識別到名字"} · {ex.messages.length} 條訊息</div>
        <div style={{ maxHeight:180,overflowY:"auto",marginBottom:18,display:"flex",flexDirection:"column",gap:7 }}>{ex.messages.slice(-8).map((m,i)=><div key={i} style={{ display:"flex",justifyContent:m.from==="me"?"flex-end":"flex-start" }}><div style={{ maxWidth:"75%",padding:"8px 12px",borderRadius:10,background:m.from==="me"?C.roseSoft:C.surf,fontSize:12.5,color:C.text,border:`1px solid ${C.border}` }}>{m.text}</div></div>)}</div>
        <button onClick={()=>onEnter(imgs,"continue",ex)} style={{ width:"100%",padding:"14px",borderRadius:14,background:C.grad,border:"none",color:"#fff",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer" }}>確認進入模擬</button>
        <button onClick={()=>setStep("choose")} style={{ width:"100%",marginTop:10,padding:"12px",borderRadius:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>返回</button>
      </>}
    </div>
  </BottomSheet>;
}

/* ─── Report Categories ──────────────────────────────── */
export const REPORT_CATEGORIES = [
  { id: "fake",       label: "假帳號 / 機器人",  icon: "🤖" },
  { id: "harassment", label: "騷擾 / 威脅",       icon: "⚠️" },
  { id: "nudity",     label: "不雅圖片 / 內容",   icon: "🔞" },
  { id: "scam",       label: "詐騙 / 欺騙",       icon: "💸" },
  { id: "other",      label: "其他問題",           icon: "⋯" },
];
