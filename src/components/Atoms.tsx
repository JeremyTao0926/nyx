import { useState, useEffect } from "react";
import { C } from "../utils";
import type { LB, Msg } from "../types";
import { groqChat, buildSys } from "../utils";

/* ─── Avatar ─────────────────────────────────────────── */
export function Av({ url, name, size=38, grad=C.grad, online, onClick }:
  { url?:string|null; name?:string; size?:number; grad?:string; online?:boolean; onClick?:()=>void }) {
  return (
    <div style={{ position:"relative", flexShrink:0, display:"inline-block" }} onClick={onClick}>
      {url
        ? <img src={url} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", display:"block", border:`1px solid ${C.border}`, cursor:onClick?"pointer":"default" }} />
        : <div style={{ width:size, height:size, borderRadius:"50%", background:`linear-gradient(135deg,#2A2218,#3D3220)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.38, fontWeight:700, color:C.gold, border:`1px solid ${C.border}`, cursor:onClick?"pointer":"default" }}>
            {name?name.charAt(0).toUpperCase():"✦"}
          </div>}
      {online && <span style={{ position:"absolute", bottom:1, right:1, width:size>36?10:8, height:size>36?10:8, borderRadius:"50%", background:C.mint, border:`2px solid ${C.bg}` }} />}
    </div>
  );
}

/* ─── Icon Button ────────────────────────────────────── */
export function IconBtn({ icon, label, active, color, size=52, onClick }:
  { icon:string; label?:string; active?:boolean; color?:string; size?:number; onClick?:()=>void }) {
  const bg = active ? (color||C.rose) : "rgba(255,255,255,0.05)";
  const border = active ? `1.5px solid ${color||C.rose}` : `1px solid ${C.border}`;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer" }} onClick={onClick}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:bg, border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.42, transition:"all .2s", boxShadow:active?`0 4px 20px ${color||C.rose}44`:"none" }}>
        {icon}
      </div>
      {label && <div style={{ fontSize:11, color:C.textMuted, fontWeight:500 }}>{label}</div>}
    </div>
  );
}

/* ─── Typing Bubble ──────────────────────────────────── */
export function TypingBubble({ url="", name="", sim=false }:{ url?:string; name?:string; sim?:boolean }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
      {sim ? <Av url={url} name={name} size={28} /> : <Av size={28} />}
      <div style={{ padding:"12px 16px", background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:"4px 18px 18px 18px", display:"flex", gap:5, alignItems:"center" }}>
        {[0,1,2].map(i=><span key={i} style={{ width:5, height:5, borderRadius:"50%", background:sim?"#FF9A3C":C.gold, display:"inline-block", animation:`dot 1.2s ${i*.18}s ease-in-out infinite` }}/>)}
      </div>
    </div>
  );
}

/* ─── NyxText ────────────────────────────────────────── */
export function NyxText({ text }:{ text:string }) {
  return (
    <div style={{ fontSize:14.5, lineHeight:1.8, color:C.text, wordBreak:"break-word" }}>
      {text.split("\n").map((line,i) => {
        const s = line.replace(/\*\*(.*?)\*\*/g,"$1");
        if (!s.trim()) return <div key={i} style={{ height:5 }}/>;
        if (/^#{1,3}\s/.test(s)) return <div key={i} style={{ fontSize:12, fontWeight:700, color:C.gold, marginTop:16, marginBottom:5, letterSpacing:".8px", textTransform:"uppercase" as const }}>{s.replace(/^#{1,3}\s/,"")}</div>;
        if (/^【.+】/.test(s)) return <div key={i} style={{ color:C.rose, fontWeight:700, fontSize:13, marginTop:14, marginBottom:4 }}>{s}</div>;
        if (/^(對方感受|投入度|興趣度)/.test(s)) return <div key={i} style={{ color:C.rose, fontWeight:600, marginTop:12 }}>{s}</div>;
        if (/^(Frame|關鍵訊號|回覆策略|後續預判)/.test(s)) return <div key={i} style={{ color:C.mint, fontWeight:600, marginTop:12, marginBottom:4, paddingBottom:6, borderBottom:`1px solid ${C.mintSoft}` }}>{s}</div>;
        if (/^優點/.test(s)) return <div key={i} style={{ color:C.mint, marginTop:3 }}>{s}</div>;
        if (/^缺點/.test(s)) return <div key={i} style={{ color:"#FF9A3C", marginTop:3 }}>{s}</div>;
        if (/^可信度/.test(s)) return <div key={i} style={{ color:C.gold, fontSize:12.5, marginTop:8, opacity:.9 }}>{s}</div>;
        if (/^「/.test(s)) return <div key={i} style={{ background:C.surfGold, borderLeft:`3px solid ${C.gold}44`, padding:"8px 12px", borderRadius:"0 10px 10px 0", margin:"6px 0", fontStyle:"italic", color:C.textSub }}>{s}</div>;
        if (/^[-•]\s/.test(s)) return <div key={i} style={{ paddingLeft:14, color:C.textSub, marginTop:4, display:"flex", gap:8 }}><span style={{ color:C.gold, flexShrink:0, marginTop:2 }}>·</span>{s.slice(2)}</div>;
        if (/^(建議|推薦回覆)/.test(s)) return <div key={i} style={{ color:C.goldLight, fontWeight:600, marginTop:5 }}>{s}</div>;
        return <div key={i}>{s}</div>;
      })}
    </div>
  );
}

/* ─── Lightbox ───────────────────────────────────────── */
export function Lightbox({ lb, onClose }:{ lb:LB; onClose:()=>void }) {
  const [idx,setIdx]=useState(lb!.index);
  if (!lb) return null;
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();if(e.key==="ArrowRight")setIdx(i=>(i+1)%lb.images.length);if(e.key==="ArrowLeft")setIdx(i=>(i-1+lb.images.length)%lb.images.length);};
    document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);
  },[lb]);
  const src=lb.images[idx];
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.96)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",animation:"fadeIn .15s ease" }}>
      <div style={{ position:"absolute",top:16,right:16,display:"flex",gap:8 }}>
        <button onClick={e=>{e.stopPropagation();const a=document.createElement("a");a.href=src;a.download=`nyx_${Date.now()}.jpg`;document.body.appendChild(a);a.click();document.body.removeChild(a);}} style={{ width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>↓</button>
        <button onClick={onClose} style={{ width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:C.text,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
      </div>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:"90vw",maxHeight:"85vh",display:"flex",alignItems:"center",gap:12 }}>
        {lb.images.length>1&&<button onClick={()=>setIdx(i=>(i-1+lb.images.length)%lb.images.length)} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer" }}>‹</button>}
        <img src={src} alt="" style={{ maxWidth:lb.images.length>1?"72vw":"86vw",maxHeight:"82vh",objectFit:"contain",borderRadius:16 }}/>
        {lb.images.length>1&&<button onClick={()=>setIdx(i=>(i+1)%lb.images.length)} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer" }}>›</button>}
      </div>
      {lb.images.length>1&&<div style={{ display:"flex",gap:6,marginTop:16 }}>
        {lb.images.map((_,i)=><div key={i} style={{ width:i===idx?20:6,height:4,borderRadius:3,background:i===idx?C.gold:"rgba(255,255,255,0.25)",transition:"all .25s" }}/>)}
      </div>}
    </div>
  );
}

/* ─── Match Animation ────────────────────────────────── */
export function MatchAnimation({ myAvatar,myName,theirAvatar,theirName,onChat,onIcebreaker,onContinue }:
  { myAvatar:string;myName:string;theirAvatar:string;theirName:string;onChat:()=>void;onIcebreaker?:()=>void;onContinue:()=>void }) {
  const [ph,setPh]=useState(0);
  useEffect(()=>{
    const t=[setTimeout(()=>setPh(1),150),setTimeout(()=>setPh(2),600),setTimeout(()=>setPh(3),1050),setTimeout(()=>setPh(4),1500)];
    return()=>t.forEach(clearTimeout);
  },[]);
  const particles=Array.from({length:12},(_,i)=>({id:i,e:["♥","✦","★","◆","❋","✿"][i%6],x:(Math.random()-.5)*260,y:(Math.random()-.5)*200}));
  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeIn .3s ease" }}>
      {/* Warm glow */}
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 45%,rgba(201,168,76,0.06) 0%,transparent 70%)",pointerEvents:"none" }}/>
      {/* Avatars */}
      <div style={{ display:"flex",alignItems:"center",gap:ph>=2?-20:60,marginBottom:44,transition:"gap .75s cubic-bezier(.34,1.56,.64,1)",position:"relative",zIndex:1 }}>
        <div style={{ opacity:ph>=1?1:0,transform:ph>=1?"translateX(0)":"translateX(-50px)",transition:"all .55s cubic-bezier(.34,1.56,.64,1)",borderRadius:"50%",boxShadow:`0 0 0 3px ${C.bg},0 0 0 5px ${C.gold}66,0 0 30px ${C.goldGlow}` }}>
          <Av url={myAvatar} name={myName} size={92}/>
        </div>
        <div style={{ fontSize:22,opacity:ph>=2?1:0,transition:"all .4s",animation:ph>=2?"heartBeat 1.4s ease-in-out infinite":undefined,zIndex:2,flexShrink:0,color:C.rose }}>♥</div>
        <div style={{ opacity:ph>=1?1:0,transform:ph>=1?"translateX(0)":"translateX(50px)",transition:"all .55s .1s cubic-bezier(.34,1.56,.64,1)",borderRadius:"50%",boxShadow:`0 0 0 3px ${C.bg},0 0 0 5px ${C.rose}66,0 0 30px ${C.roseGlow}` }}>
          <Av url={theirAvatar} name={theirName} size={92}/>
        </div>
      </div>
      {ph>=2&&<div style={{ position:"absolute",top:"44%",left:"50%",zIndex:0 }}>
        {particles.map(h=><div key={h.id} style={{ position:"absolute",fontSize:14,opacity:0,color:h.id%2===0?C.gold:C.rose,animation:`heartBurst .85s ${h.id*.055}s ease-out forwards`,"--x":`${h.x}px`,"--y":`${h.y}px`} as any}>{h.e}</div>)}
      </div>}
      {/* Text */}
      <div style={{ opacity:ph>=3?1:0,transform:ph>=3?"translateY(0)":"translateY(16px)",transition:"all .5s ease",textAlign:"center",marginBottom:8,zIndex:1,padding:"0 32px",animation:ph>=3?"matchPop .5s ease":undefined }}>
        <div style={{ fontSize:14,letterSpacing:"0.25em",color:C.gold,textTransform:"uppercase" as const,marginBottom:6,fontWeight:600 }}>It's a Match</div>
        <div style={{ fontSize:28,fontWeight:800,color:C.text }}>你和 <span style={{ color:C.gold }}>{theirName}</span> 互相喜歡了</div>
      </div>
      <div style={{ opacity:ph>=3?1:0,transition:"opacity .4s .1s",fontSize:14,color:C.textMuted,marginBottom:48,zIndex:1 }}>開始你們的故事吧</div>
      {/* Buttons */}
      <div style={{ opacity:ph>=4?1:0,transform:ph>=4?"translateY(0)":"translateY(18px)",transition:"all .5s ease",display:"flex",gap:10,flexDirection:"column",width:"80%",maxWidth:300,zIndex:1 }}>
        <button onClick={onChat} style={{ padding:"16px",borderRadius:50,background:C.grad,border:"none",color:C.bg,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",animation:"btnPulse 3s ease-in-out infinite" }}>開始聊天</button>
        {onIcebreaker&&<button onClick={onIcebreaker} style={{ padding:"13px",borderRadius:50,background:C.surfGold,border:`1px solid ${C.gold}44`,color:C.gold,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer" }}>✦ 破冰建議</button>}
        <button onClick={onContinue} style={{ padding:"12px",borderRadius:50,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer" }}>繼續探索</button>
      </div>
    </div>
  );
}

/* ─── Nyx Analysis Sheet ─────────────────────────────── */
export function NyxAnalysisSheet({ msg,isUser,ctx,gender,mbti,cache,onCache,onClose }:
  { msg:any;isUser:boolean;ctx:any[];gender:"male"|"female";mbti:string;cache:Map<string,string>;onCache:(id:string,r:string)=>void;onClose:()=>void }) {
  const [result,setResult]=useState(cache.get(msg.id)||"");
  const [loading,setLoading]=useState(!cache.has(msg.id));
  useEffect(()=>{if(!cache.has(msg.id))analyze();},[]);
  async function analyze(){
    const ctxStr=ctx.slice(-6).map((m:any)=>`${m.from==="user"||m.senderId==="me"?"我":"對方"}：${m.text||m.content||"[圖片]"}`).join("\n");
    const rp=gender==="male"?"\n（Frame/IOI/IOD角度）":"";
    const msgText=msg.text||msg.content||"";
    const prompt=isUser
      ?`分析這句話的效果：「${msgText}」\n近期：\n${ctxStr}\n\n1.傳遞的信號${rp} 2.對方可能的解讀 3.效果評分1-10 4.保守改法vs進攻改法\n精準簡短。`
      :`解讀這條訊息：「${msgText}」\n近期：\n${ctxStr}\n\n1.背後心理${rp} 2.測試還是真實 3.投入度變化 4.建議回法\n精準簡短。`;
    try{const r=await groqChat([{role:"system",content:buildSys(mbti,gender)},{role:"user",content:prompt}]);setResult(r);onCache(msg.id,r);}
    catch{setResult("分析失敗，請重試");}
    setLoading(false);
  }
  const msgText=msg.text||msg.content||"";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(20px)",display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:480,margin:"0 auto",width:"100%",background:C.bgElevated,borderRadius:"24px 24px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",padding:"24px 22px 48px",maxHeight:"72vh",overflowY:"auto",animation:"slideUp .32s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ width:40,height:4,borderRadius:2,background:C.border,margin:"0 auto 20px" }}/>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
          <span style={{ fontSize:16,color:C.gold }}>◈</span>
          <div style={{ fontSize:15,fontWeight:700,color:C.text }}>{isUser?"這句話效果如何？":"解讀對方訊息"}</div>
          {cache.has(msg.id)&&<span style={{ fontSize:10,color:C.mint,background:C.mintSoft,padding:"2px 8px",borderRadius:8,fontWeight:600 }}>已緩存</span>}
        </div>
        <div style={{ background:C.surfGold,borderRadius:12,padding:"11px 14px",marginBottom:18,fontSize:13.5,color:C.textSub,fontStyle:"italic",borderLeft:`3px solid ${isUser?C.rose:C.gold}` }}>{msgText}</div>
        {loading
          ?<div style={{ display:"flex",gap:5,padding:"14px 0" }}>{[0,1,2].map(i=><span key={i} style={{ width:7,height:7,borderRadius:"50%",background:C.gold,display:"inline-block",animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}</div>
          :<NyxText text={result}/>}
      </div>
    </div>
  );
}

/* ─── Cherry Blossoms ────────────────────────────────── */
export function CherryBlossoms() {
  const petals=Array.from({length:6},(_,i)=>({id:i,left:10+Math.random()*80,delay:Math.random()*14,dur:9+Math.random()*7,size:4+Math.random()*4}));
  return (
    <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden" }}>
      {petals.map(p=><div key={p.id} style={{ position:"absolute",top:-20,left:`${p.left}%`,width:p.size,height:p.size,background:`radial-gradient(circle,${C.goldLight},${C.gold})`,borderRadius:"50% 0 50% 0",animation:`cherryFall ${p.dur}s ${p.delay}s linear infinite`,opacity:.25 }}/>)}
    </div>
  );
}
