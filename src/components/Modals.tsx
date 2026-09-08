import { useState, useRef, useEffect } from "react";
import { C, MBTI_LIST, EMOJIS, ETHNICITY, COUNTRIES, sound, toB64, getDailyLikeStatus, sb } from "../utils";
import type { UserProfile, ImgItem, ExtractedConvo, SimulationMessage } from "../types";
import { analyzeSimulationPersona, batchImagePayloads, extractConversationFromImageBatch, extractConversationFromText, mergeSimulationMessageSequences, simulationConfidenceLabel } from "../simulation";

/* ─── Shared input style ─────────────────────────────── */
const INP = { width:"100%", padding:"12px 14px", background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, color:C.text, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const, transition:"border-color .2s" };

/* ─── Bottom Sheet base (drag to close) ─────────────── */
export function BottomSheet({ children, onClose, title, maxH="86vh" }:
  { children:React.ReactNode; onClose:()=>void; title?:string; maxH?:string }) {
  const [ty, setTy] = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  function close() { setClosing(true); setTimeout(onClose, 280); }

  // Handle drag on the pill handle specifically
  function onHandleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setTy(dy);
  }
  function onHandleTouchEnd() {
    isDragging.current = false;
    if (ty > 80) close(); else setTy(0);
  }

  return (
    <div
      style={{ position:"fixed",inset:0,zIndex:200,background:closing?"rgba(36,30,53,0)":C.overlay,backdropFilter:closing?"none":"blur(16px)",display:"flex",alignItems:"flex-end",justifyContent:"center",transition:"background .28s" }}
      onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth:480,margin:"0 auto",width:"100%",background:C.bgElevated,borderRadius:"22px 22px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:maxH,overflowY:"auto",
          transform:closing?`translateY(100%)`:`translateY(${ty}px)`,
          transition:ty===0?"transform .3s cubic-bezier(.32,.72,0,1)":"none",
          animation:closing?undefined:"slideUp .32s cubic-bezier(.32,.72,0,1)",
          willChange:"transform" }}>
        {/* ── Drag handle pill — only this area responds to drag ── */}
        <div
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          style={{ padding:"14px 0 8px",display:"flex",flexDirection:"column" as const,alignItems:"center",cursor:"grab",userSelect:"none" as const,touchAction:"none" }}>
          <div style={{ width:44,height:5,borderRadius:3,background:C.borderHigh,transition:"background .15s" }}
            onMouseEnter={e=>(e.currentTarget.style.background=C.textDim)}
            onMouseLeave={e=>(e.currentTarget.style.background=C.borderHigh)}/>
        </div>
        {title && <div style={{ padding:"4px 20px 0",fontSize:17,fontWeight:700,color:C.text }}>{title}</div>}
        {children}
      </div>
    </div>
  );
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
    {open&&<div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:C.bgElevated,backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",zIndex:200,maxHeight:220,overflowY:"auto",boxShadow:C.shadowStrong,animation:"dropDown .18s ease" }}>
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
    {open&&<div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:C.bgElevated,backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",zIndex:200,maxHeight:260,overflowY:"auto",boxShadow:C.shadowStrong,animation:"dropDown .18s ease" }}>
      {options.map(o=>{const sel=value.includes(o);return<button key={o} onClick={()=>{onChange(sel?value.filter(x=>x!==o):[...value,o]);sound.tap();}} style={{ width:"100%",padding:"11px 16px",background:sel?C.roseSoft:"transparent",border:"none",color:sel?color:C.text,fontFamily:"inherit",fontSize:13.5,cursor:"pointer",textAlign:"left" as const,display:"flex",alignItems:"center",gap:12,fontWeight:sel?600:400,transition:"background .12s" }} onMouseEnter={e=>(e.currentTarget.style.background=C.surf)} onMouseLeave={e=>(e.currentTarget.style.background=sel?C.roseSoft:"transparent")}>
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
  return <div style={{ position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,zIndex:50,background:C.bgElevated,backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:18,padding:"14px 12px 10px",animation:"emojiUp .2s ease",boxShadow:C.shadowStrong }}>
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
        <input type="range" min={10} max={500} step={10} value={dist} onChange={e=>setF(p=>({...p,filter_max_distance:+e.target.value}))} style={{ width:"100%",accentColor:unlimited?C.mint:C.rose }} />
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
export function SimulateModal({ userId, onEnter, onClose }:{ userId:string; onEnter:(mode:"new"|"continue",ex:ExtractedConvo)=>void; onClose:()=>void }) {
  const [step,setStep]=useState<"upload"|"choose"|"extracting"|"preview">("upload");
  const [imgs,setImgs]=useState<ImgItem[]>([]);
  const [rawText,setRawText]=useState("");
  const [textFiles,setTextFiles]=useState<File[]>([]);
  const [targetHint,setTargetHint]=useState("");
  const [consent,setConsent]=useState(false);
  const [selectedMode,setSelectedMode]=useState<"new"|"continue">("continue");
  const [progress,setProgress]=useState("準備分析…");
  const [error,setError]=useState("");
  const [ex,setEx]=useState<ExtractedConvo|null>(null);
  const imageRef=useRef<HTMLInputElement>(null);
  const textFileRef=useRef<HTMLInputElement>(null);
  const previewUrls=useRef(new Set<string>());
  const cancelledRef=useRef(false);

  useEffect(()=>{
    const urls=previewUrls.current;
    cancelledRef.current=false;
    return ()=>{cancelledRef.current=true;urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();};
  },[]);

  function addImgs(files:FileList){
    const additions=Array.from(files).filter(file=>file.type.startsWith("image/")).map(file=>{
      const preview=URL.createObjectURL(file); previewUrls.current.add(preview); return {file,preview};
    });
    setImgs(current=>[...current,...additions]);
  }
  function removeImg(index:number){
    setImgs(current=>{
      const removed=current[index]; if(removed){URL.revokeObjectURL(removed.preview);previewUrls.current.delete(removed.preview);}
      return current.filter((_,itemIndex)=>itemIndex!==index);
    });
  }
  function addTextFiles(files:FileList){
    setTextFiles(current=>[...current,...Array.from(files)]);
  }
  async function extract(mode:"new"|"continue"){
    setSelectedMode(mode); setError("");
    try{
      const status=await getDailyLikeStatus(userId);
      if(cancelledRef.current)return;
      if(status.cloneRemaining<=0)throw new Error(`今日模擬次數已用完（${status.cloneUsed}/${status.cloneLimit}）`);
      setStep("extracting"); setProgress("壓縮並整理素材…");
      const materials:{name:string|null;messages:SimulationMessage[]}[]=[];
      if(imgs.length){
        let pendingBatch:string[]=[];
        let processedImages=0;
        let batchNumber=0;
        let continuityTail:SimulationMessage[]=[];
        const flushImageBatch=async()=>{
          if(!pendingBatch.length)return;
          batchNumber+=1;
          setProgress(`讀取截圖 ${processedImages+1}–${processedImages+pendingBatch.length}/${imgs.length}`);
          const material=await extractConversationFromImageBatch(pendingBatch,targetHint,batchNumber,continuityTail.slice(-6));
          if(cancelledRef.current)throw new Error("SIMULATION_CANCELLED");
          materials.push(material);
          continuityTail=mergeSimulationMessageSequences([continuityTail,material.messages]).slice(-24);
          processedImages+=pendingBatch.length;
          pendingBatch=[];
        };
        for(let index=0;index<imgs.length;index+=1){
          setProgress(`準備截圖 ${index+1}/${imgs.length}`);
          const encoded=await toB64(imgs[index].file);
          if(cancelledRef.current)throw new Error("SIMULATION_CANCELLED");
          const projected=batchImagePayloads([...pendingBatch,encoded]);
          if(projected.length>1){
            await flushImageBatch();
            pendingBatch=[encoded];
          }else{
            pendingBatch=projected[0]||[];
          }
          if(pendingBatch.length===5)await flushImageBatch();
        }
        await flushImageBatch();
      }
      if(rawText.trim()){
        materials.push(await extractConversationFromText(rawText,targetHint,item=>{if(!cancelledRef.current)setProgress(item.label);},()=>cancelledRef.current));
      }
      for(let index=0;index<textFiles.length;index+=1){
        if(cancelledRef.current)throw new Error("SIMULATION_CANCELLED");
        setProgress(`開啟文字檔 ${index+1}/${textFiles.length} · ${textFiles[index].name}`);
        const fileText=await textFiles[index].text();
        materials.push(await extractConversationFromText(fileText,targetHint,item=>{if(!cancelledRef.current)setProgress(`檔案 ${index+1}/${textFiles.length} · ${item.label}`);},()=>cancelledRef.current));
      }
      const messages=mergeSimulationMessageSequences(materials.map(material=>material.messages));
      if(!messages.some(message=>message.from==="target")) throw new Error("未能辨識對方訊息，請確認截圖方向或貼上包含雙方名稱的紀錄");
      const detectedName=targetHint.trim()||materials.map(material=>material.name).find(Boolean)||null;
      const persona=await analyzeSimulationPersona(detectedName||"對方",messages,item=>{if(!cancelledRef.current)setProgress(item.label);},()=>cancelledRef.current);
      setProgress("建立私人模擬工作階段…");
      const {data:sessionId,error:sessionError}=await sb.rpc("create_private_simulation_session",{
        p_match_id:null,
        p_clone_user_id:null,
        p_clone_name:detectedName||"對方",
        p_clone_avatar:null,
        p_persona_profile:{...persona,mode,sourceKind:"imported_chat"},
        p_messages_used:messages.length,
        p_source_batch_count:persona.sourceBatchCount,
        p_mode:mode==="continue"?"continue":"fresh",
      });
      if(sessionError)throw sessionError;
      if(cancelledRef.current)return;
      if(typeof sessionId!=="string")throw new Error("無法建立模擬工作階段");
      setEx({
        name:detectedName,
        messages:messages.map(message=>({from:message.from==="target"?"her":"me",text:message.text})),
        styleDesc:persona.styleDescription,
        sessionId,
        persona,
        sourceCount:persona.sourceMessageCount,
        sourceBatchCount:persona.sourceBatchCount,
      });
      setStep("preview");
    }catch(cause){
      if(cancelledRef.current||(cause instanceof Error&&cause.message==="SIMULATION_CANCELLED"))return;
      console.error("Simulation material analysis failed",cause);
      const rawMessage=cause instanceof Error?cause.message:"素材分析失敗，請稍後再試";
      setError(rawMessage.includes("CLONE_DAILY_LIMIT_REACHED")?"今日模擬次數已用完，請明天再試或升級方案。":rawMessage);
      setStep("choose");
    }
  }

  const hasSources=imgs.length>0||rawText.trim().length>0||textFiles.length>0;
  const canContinue=hasSources&&consent;
  return <BottomSheet onClose={onClose} title="💭 高擬真模擬">
    <div style={{ padding:"20px 20px 48px" }}>
      {step==="upload"&&<>
        <div style={{ padding:"12px 14px",borderRadius:14,background:C.goldSoft,border:`1px solid ${C.borderHigh}`,fontSize:12.5,color:C.textSub,lineHeight:1.6,marginBottom:16 }}>
          素材總數不設上限；系統會自動分批讀取，再濃縮成人格模型。素材愈完整通常愈穩定，但結果仍是 AI 推測，不代表對方真實想法。
        </div>
        <label style={{ display:"block",fontSize:12,color:C.textMuted,marginBottom:6 }}>對象名稱（可選，可幫助辨識雙方）</label>
        <input value={targetHint} onChange={event=>setTargetHint(event.target.value)} placeholder="例如：Alex" style={{...INP,marginBottom:14}}/>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5 }}><span style={{fontSize:13,fontWeight:700,color:C.text}}>聊天截圖</span><span style={{fontSize:11.5,color:C.gold}}>已加入 {imgs.length} 張 · 可繼續加入</span></div>
        <div style={{fontSize:11,color:C.textDim,marginBottom:9}}>請按由舊到新的時間順序加入，重疊的聊天氣泡會自動去除。</div>
        <div style={{ display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:12,maxHeight:152,overflowY:"auto" }}>
          {imgs.map((img,i)=><div key={img.preview} style={{ position:"relative" }}>
            <img src={img.preview} alt={`聊天截圖 ${i+1}`} style={{ width:64,height:64,objectFit:"cover" as const,borderRadius:10,border:`1px solid ${C.border}`,display:"block" }}/>
            <button type="button" aria-label={`移除第 ${i+1} 張截圖`} onClick={()=>removeImg(i)} style={{ position:"absolute",top:-5,right:-5,width:20,height:20,borderRadius:"50%",background:C.rose,border:"none",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
          </div>)}
          <button type="button" onClick={()=>imageRef.current?.click()} style={{ width:64,height:64,borderRadius:10,border:`2px dashed ${C.border}`,background:"transparent",color:C.textMuted,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
        </div>
        <input ref={imageRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={event=>{if(event.target.files)addImgs(event.target.files);event.target.value="";}}/>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",margin:"16px 0 7px" }}><span style={{fontSize:13,fontWeight:700,color:C.text}}>文字聊天紀錄</span><button type="button" onClick={()=>textFileRef.current?.click()} style={{border:"none",background:"none",color:C.gold,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>匯入 TXT / JSON / CSV</button></div>
        <input ref={textFileRef} type="file" accept=".txt,.json,.csv,.log,.md,text/plain,application/json,text/csv" multiple style={{display:"none"}} onChange={event=>{if(event.target.files)addTextFiles(event.target.files);event.target.value="";}}/>
        {textFiles.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8,maxHeight:92,overflowY:"auto"}}>{textFiles.map((file,index)=><div key={`${file.name}-${file.lastModified}-${index}`} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:10,background:C.surf,border:`1px solid ${C.border}`,fontSize:11.5,color:C.textMuted}}><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span><span style={{color:C.textDim}}>{Math.max(1,Math.round(file.size/1024))} KB</span><button type="button" aria-label={`移除 ${file.name}`} onClick={()=>setTextFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))} style={{border:"none",background:"transparent",color:C.rose,cursor:"pointer",fontSize:12}}>✕</button></div>)}</div>}
        <textarea value={rawText} onChange={event=>setRawText(event.target.value)} placeholder="也可以直接貼上完整聊天紀錄；不用手動刪時間或名字。" rows={5} style={{...INP,resize:"vertical",lineHeight:1.55}}/>

        <label style={{ display:"flex",alignItems:"flex-start",gap:10,margin:"15px 0",fontSize:12,color:C.textMuted,lineHeight:1.55,cursor:"pointer" }}>
          <input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} style={{marginTop:3,accentColor:C.gold}}/>
          <span>我確認有權使用這些私人內容；只作個人練習，不冒充、公開或用來騷擾對方。</span>
        </label>
        <button type="button" disabled={!canContinue} onClick={()=>setStep("choose")} style={{ width:"100%",padding:"14px",borderRadius:14,background:canContinue?C.grad:C.surf,border:`1px solid ${canContinue?"transparent":C.border}`,color:canContinue?"#fff":C.textDim,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:canContinue?"pointer":"default" }}>{!hasSources?"請先加入素材":!consent?"請先確認使用權":"下一步 →"}</button>
        <button type="button" onClick={onClose} style={{ width:"100%",marginTop:10,padding:"12px",borderRadius:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>取消</button>
      </>}
      {step==="choose"&&<>
        <button type="button" onClick={()=>setStep("upload")} style={{ background:"none",border:"none",color:C.textMuted,fontSize:14,cursor:"pointer",marginBottom:18,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>← 返回素材</button>
        {error&&<div role="alert" style={{padding:"11px 13px",borderRadius:12,background:C.dangerSoft,color:C.danger,fontSize:12.5,lineHeight:1.5,marginBottom:14}}>{error}</div>}
        {[{icon:"🆕",t:"全新情境",d:"先學完整素材，再從空白情境模擬對方的反應",mode:"new" as const},
          {icon:"📜",t:"延續原對話",d:"學習全部素材，並以最後一段真實對話作為當下脈絡",mode:"continue" as const}].map(option=>
          <button key={option.mode} type="button" onClick={()=>{void extract(option.mode);}} style={{ width:"100%",padding:"18px 16px",borderRadius:16,background:C.surf,border:`1px solid ${C.border}`,textAlign:"left" as const,cursor:"pointer",marginBottom:12,display:"block",transition:"all .2s" }} onMouseEnter={event=>(event.currentTarget.style.borderColor=C.borderHigh)} onMouseLeave={event=>(event.currentTarget.style.borderColor=C.border)}>
            <div style={{ fontSize:22,marginBottom:6 }}>{option.icon}</div>
            <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:4 }}>{option.t}</div>
            <div style={{ fontSize:12.5,color:C.textMuted,lineHeight:1.55 }}>{option.d}</div>
          </button>)}
      </>}
      {step==="extracting"&&<div style={{ textAlign:"center",padding:"44px 0" }}>
        <div style={{ display:"flex",gap:7,justifyContent:"center",marginBottom:18 }}>{[0,1,2].map(i=><span key={i} style={{ width:10,height:10,borderRadius:"50%",background:C.warning,display:"inline-block",animation:`dot 1.2s ${i*.2}s ease-in-out infinite` }}/>)}</div>
        <div style={{ fontSize:14,color:C.text,marginBottom:7 }}>正在建立高擬真人格模型</div>
        <div aria-live="polite" style={{ fontSize:12.5,color:C.textMuted }}>{progress}</div>
        <div style={{fontSize:11,color:C.textDim,lineHeight:1.5,marginTop:14}}>素材會分批處理，請暫時不要關閉此頁</div>
      </div>}
      {step==="preview"&&ex&&<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10}}><div style={{fontSize:15,fontWeight:800,color:C.text}}>{ex.name?`${ex.name} 的模擬模型`:"對方的模擬模型"}</div>{ex.persona&&<span style={{padding:"5px 9px",borderRadius:20,background:C.goldSoft,color:C.gold,fontSize:11,fontWeight:800}}>{simulationConfidenceLabel(ex.persona)}</span>}</div>
        <div style={{fontSize:12,color:C.textMuted,lineHeight:1.55,marginBottom:12}}>已讀取 {ex.messages.length} 條對話，其中 {ex.sourceCount||0} 條來自對方。{ex.styleDesc}</div>
        <div style={{padding:"10px 12px",borderRadius:12,background:C.surf,border:`1px solid ${C.border}`,fontSize:11.5,color:C.textMuted,lineHeight:1.55,marginBottom:14}}>AI 只會預測一個可能反應，不代表本人真實想法；沒有素材證據時會保持保守，不會自行升高親密度。</div>
        <div style={{ maxHeight:180,overflowY:"auto",marginBottom:18,display:"flex",flexDirection:"column",gap:7 }}>{ex.messages.slice(-10).map((m,i)=><div key={`${m.from}-${i}`} style={{ display:"flex",justifyContent:m.from==="me"?"flex-end":"flex-start" }}><div style={{ maxWidth:"75%",padding:"8px 12px",borderRadius:10,background:m.from==="me"?C.roseSoft:C.surf,fontSize:12.5,color:C.text,border:`1px solid ${C.border}` }}>{m.text}</div></div>)}</div>
        <button type="button" onClick={()=>onEnter(selectedMode,ex)} style={{ width:"100%",padding:"14px",borderRadius:14,background:C.grad,border:"none",color:"#fff",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer" }}>確認進入模擬</button>
        <button type="button" onClick={()=>setStep("choose")} style={{ width:"100%",marginTop:10,padding:"12px",borderRadius:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>返回</button>
      </>}
    </div>
  </BottomSheet>;
}
