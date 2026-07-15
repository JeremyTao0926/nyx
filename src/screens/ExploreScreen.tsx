import { useState, useEffect, useRef } from "react";
import { C, sound, sb, getExploreProfiles, recordSwipe, updateProfile, getDailyLikeStatus, getWhoLikedMe, generateIcebreaker, mbtiCompatibility } from "../utils";
import { Av, MatchAnimation } from "../components/Atoms";
import { FilterSheet } from "../components/Modals";
import type { UserProfile, ExploreProfile, MatchItem, WhoLikedItem, DailyLikeStatus } from "../types";
import { PremiumScreen } from "./PremiumScreen";
import { PremiumGateSheet } from "../components/PremiumGateSheet";
import { PremiumBadge } from "../components/PremiumBadge";

type ExploreTab = "recommend" | "nearby" | "new";

/* ─── Who Liked Panel ────────────────────────────────── */
function WhoLikedPanel({ items, onClose, onLike }: { items: WhoLikedItem[]; onClose: () => void; onLike: (item: WhoLikedItem) => void }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(20px)",display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:480,width:"100%",margin:"0 auto",background:C.bgElevated,borderRadius:"24px 24px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ padding:"18px 20px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontSize:17,fontWeight:700,color:C.text }}>喜歡你的人 <span style={{ fontSize:13,color:C.textMuted,fontWeight:400 }}>({items.length})</span></div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.textMuted,fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px 32px" }}>
          {items.length===0 && <div style={{ textAlign:"center",padding:"40px 20px",color:C.textMuted }}>
            <div style={{ fontSize:36,marginBottom:12,opacity:.3,color:C.gold }}>◈</div>
            <div style={{ fontSize:14 }}>還沒有人喜歡你，去探索一下吧</div>
          </div>}
          {items.map(item => (
            <div key={item.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 8px",borderBottom:`1px solid ${C.border}` }}>
              <Av url={item.avatar} name={item.name} size={52}/>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:15,fontWeight:600,color:C.text }}>{item.name}{item.age?`, ${item.age}`:""}</div>
                <div style={{ fontSize:12.5,color:item.direction==="superlike"?C.gold:C.textMuted,marginTop:2 }}>{item.direction==="superlike"?"⭐ 超級喜歡":"♥ 喜歡你"} · {item.mbti}</div>
              </div>
              <button onClick={()=>onLike(item)} style={{ padding:"8px 18px",borderRadius:20,background:C.gradRose,border:"none",color:"#fff",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0 }}>喜歡</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Icebreaker Sheet ───────────────────────────────── */
function IcebreakerSheet({ them, myMbti, onClose, onUse }: { them: ExploreProfile; myMbti: string; onClose: () => void; onUse: (text: string) => void }) {
  const [lines,setLines]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const compat=mbtiCompatibility(myMbti,them.mbti);
  useEffect(()=>{ generateIcebreaker(myMbti,{name:them.name,mbti:them.mbti,hobbies:them.hobbies,bio:them.bio}).then(r=>{setLines(r.split("\n").filter(l=>l.trim()));setLoading(false);}); },[]);
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(20px)",display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:480,width:"100%",margin:"0 auto",background:C.bgElevated,borderRadius:"24px 24px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",padding:"24px 20px 48px",animation:"slideUp .32s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px" }}/>
        <div style={{ background:C.bgGold,borderRadius:14,padding:"14px 16px",marginBottom:20,border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
            <span style={{ fontSize:13.5,color:C.text,fontWeight:600 }}>{myMbti} × {them.mbti} 相容度</span>
            <span style={{ fontSize:14,color:compat.score>=85?C.mint:C.gold,fontWeight:700 }}>{compat.score}%</span>
          </div>
          <div style={{ height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,marginBottom:8 }}>
            <div style={{ height:"100%",width:`${compat.score}%`,background:compat.score>=85?C.gradMint:C.grad,borderRadius:2 }}/>
          </div>
          <div style={{ fontSize:12,color:C.gold,fontWeight:600 }}>{compat.label}</div>
        </div>
        <div style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:14 }}>✦ 破冰開場白</div>
        {loading ? <div style={{ display:"flex",gap:6,padding:"16px 0",justifyContent:"center" }}>{[0,1,2].map(i=><span key={i} style={{ width:8,height:8,borderRadius:"50%",background:C.gold,display:"inline-block",animation:`dot 1.2s ${i*.18}s ease-in-out infinite` }}/>)}</div>
        : <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {lines.map((line,i)=><button key={i} onClick={()=>onUse(line)} style={{ width:"100%",padding:"14px 16px",borderRadius:14,background:C.bgCard,border:`1px solid ${C.border}`,color:C.text,fontFamily:"inherit",fontSize:14,textAlign:"left" as const,cursor:"pointer",lineHeight:1.5,transition:"all .15s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.background=C.bgGold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.bgCard;}}>{line}</button>)}
          </div>}
      </div>
    </div>
  );
}

/* ─── Profile Detail Sheet (Image 2 style — full screen) ─ */
export function ProfileSheet({ p, myMbti, myProfile, onClose, onLike, onSuperlike, onChat, mode }: {
  p: ExploreProfile; myMbti: string; myProfile: any;
  onClose: () => void; onLike: () => void; onSuperlike: () => void; onChat: () => void;
  mode?: "discover" | "matched";
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lbIdx, setLbIdx] = useState<number|null>(null);
  const compat = mbtiCompatibility(myMbti, p.mbti);
  const allPhotos = [p.avatar, ...p.photos.filter(x => x !== p.avatar)].filter(Boolean);

  // swipe-right to close
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const isSwiping = useRef(false);
  // Photo swipe
  const photoSwipeX = useRef(0);
  const [photoDx, setPhotoDx] = useState(0);
  const photoSwiping = useRef(false);
  function onSwipeStart(e: React.TouchEvent) { swipeStartX.current=e.touches[0].clientX; swipeStartY.current=e.touches[0].clientY; isSwiping.current=false; }
  function onSwipeMove(e: React.TouchEvent) {
    const dx=e.touches[0].clientX-swipeStartX.current, dy=Math.abs(e.touches[0].clientY-swipeStartY.current);
    if (swipeStartX.current<40&&dx>0&&dy<60) { isSwiping.current=true; setSwipeDx(Math.min(dx,260)); }
  }
  function onSwipeEnd() {
    if (isSwiping.current&&swipeDx>100) onClose();
    setSwipeDx(0); isSwiping.current=false;
  }

  const edu: Record<string,string> = { high_school:"高中",college:"大專",bachelor:"本科",master:"碩士",phd:"博士" };
  const goalShort: Record<string,string> = { serious:"認真交往",friends_first:"先朋友再說",casual:"隨緣",open:"開放態度" };
  const goalFull: Record<string,string> = { serious:"認真交往，想要長期穩定的關係",friends_first:"先成為朋友，再慢慢發展",casual:"隨緣，順其自然",open:"開放態度" };
  const hobbyIcon: Record<string,string> = { "旅行":"✈️","音樂":"🎵","電影":"🎬","閱讀":"📖","運動":"🏃","美食":"🍜","遊戲":"🎮","攝影":"📷","藝術":"🎨","健身":"💪","瑜伽":"🧘","舞蹈":"💃","寵物":"🐾","烹飪":"🍳","戶外":"⛰️","咖啡":"☕","科技":"💻","時尚":"👗","語言":"🗣️","電競":"🎯" };

  // Real common points
  const sharedHobbies = (myProfile?.hobbies||[]).filter((h:string)=>(p.hobbies||[]).includes(h));
  const commonPoints: {icon:string;label:string}[] = [];
  sharedHobbies.slice(0,2).forEach((h:string)=>commonPoints.push({ icon:hobbyIcon[h]||"⭐", label:`都喜歡${h}` }));
  if (myProfile?.has_pets&&myProfile.has_pets!=="none"&&p.has_pets&&p.has_pets!=="none") commonPoints.push({ icon:"🐾", label:"都養寵物" });
  if (myProfile?.relationship_goal&&p.relationship_goal&&myProfile.relationship_goal===p.relationship_goal) commonPoints.push({ icon:"💑", label:"關係目標一致" });
  if (myProfile?.exercise&&myProfile.exercise!=="never"&&p.exercise&&p.exercise!=="never") commonPoints.push({ icon:"🏃", label:"生活習慣相近" });
  const finalCommon = commonPoints.slice(0,4);

  const lifeItems = [
    p.drinking&&p.drinking!=="never"?{ icon:"🍷", label:p.drinking==="sometimes"?"偶爾喝酒":"常喝酒" }:null,
    p.smoking==="never"?{ icon:"🚭", label:"不抽菸" }:(p.smoking&&p.smoking!=="never"?{ icon:"🚬", label:"偶爾抽菸" }:null),
    p.exercise&&p.exercise!=="never"?{ icon:"🏋️", label:p.exercise==="weekly"?"每週運動":"每天運動" }:null,
    p.has_pets&&p.has_pets!=="none"?{ icon:"🐾", label:p.has_pets==="cat"?"有養貓":"有養狗" }:null,
  ].filter(Boolean) as {icon:string;label:string}[];

  const basicItems = [
    p.height_cm?{ icon:"📐", label:`${p.height_cm} cm`, sub:"身高" }:null,
    p.occupation?{ icon:"💼", label:p.occupation, sub:"職業" }:null,
    p.education&&edu[p.education]?{ icon:"🎓", label:edu[p.education], sub:"學歷" }:null,
    p.income?{ icon:"💰", label:p.income==="<20"?"20萬以下":p.income===">100"?"100萬+":"年收"+p.income+"萬", sub:"收入" }:null,
  ].filter(Boolean) as {icon:string;label:string;sub:string}[];

  if (lbIdx!==null) return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <button onClick={()=>setLbIdx(null)} style={{ position:"absolute",top:16,left:16,width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        {allPhotos.length>1&&<button onClick={()=>setLbIdx(i=>Math.max(0,i!-1))} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>}
        <img src={allPhotos[lbIdx]} alt="" style={{ maxWidth:"84vw",maxHeight:"84vh",objectFit:"contain" as const,borderRadius:12 }}/>
        {allPhotos.length>1&&<button onClick={()=>setLbIdx(i=>Math.min(allPhotos.length-1,i!+1))} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>›</button>}
      </div>
    </div>
  );

  const [likeAnim, setLikeAnim] = useState(false);
  const [priorityAnim, setPriorityAnim] = useState(false);
  function handleLike() { setLikeAnim(true); setTimeout(()=>setLikeAnim(false),400); onLike(); }
  function handlePriority() { setPriorityAnim(true); setTimeout(()=>{ setPriorityAnim(false); onSuperlike(); },480); }

  const ActionBar = () => (
    <div style={{ position:"absolute",bottom:0,left:0,right:0,zIndex:20 }}>
      <div style={{ height:52,background:`linear-gradient(transparent,${C.bg})`,pointerEvents:"none" as const }}/>
      <div style={{ background:C.bg,padding:"2px 32px 30px",display:"flex",alignItems:"flex-end",justifyContent:"space-between" }}>

        {/* PASS */}
        <div style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:5 }}>
          <button onClick={onClose}
            style={{ width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.42)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .18s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.cssText+="background:rgba(232,54,93,0.08);border-color:rgba(232,54,93,0.28);color:#E8365D"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.cssText+="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.09);color:rgba(255,255,255,0.42)"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span style={{ fontSize:11,color:"rgba(255,255,255,0.26)",letterSpacing:".3px" }}>略過</span>
        </div>

        {/* LIKE — primary */}
        <div style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:6 }}>
          <button onClick={handleLike}
            style={{ width:66,height:66,borderRadius:"50%",background:"linear-gradient(135deg,#C9A84C 0%,#E2C068 100%)",border:"none",color:"#12100C",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 6px 24px rgba(201,168,76,0.38)",
              transform:likeAnim?"scale(0.86)":"scale(1)",transition:"transform .2s cubic-bezier(.34,1.56,.64,1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <span style={{ fontSize:11,color:"#E2C068",fontWeight:600,letterSpacing:".3px" }}>喜歡</span>
        </div>

        {/* PRIORITY — premium */}
        <div style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:6 }}>
          <button onClick={handlePriority}
            style={{ position:"relative" as const,width:72,height:72,borderRadius:"50%",
              background:"linear-gradient(145deg,#1A1608 0%,#231E0A 100%)",
              border:"1.5px solid rgba(201,168,76,0.5)",
              color:C.gold,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:priorityAnim
                ?"0 0 0 10px rgba(201,168,76,0.1),0 0 0 4px rgba(201,168,76,0.2),0 8px 32px rgba(201,168,76,0.4)"
                :"0 4px 20px rgba(201,168,76,0.2)",
              transform:priorityAnim?"scale(0.88)":"scale(1)",
              transition:"all .22s cubic-bezier(.34,1.56,.64,1)" }}>
            {/* Gold shimmer overlay */}
            <div style={{ position:"absolute" as const,inset:0,borderRadius:"50%",
              background:"linear-gradient(135deg,rgba(201,168,76,0.14) 0%,transparent 55%,rgba(201,168,76,0.06) 100%)",
              pointerEvents:"none" as const }}/>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <span style={{ fontSize:11,color:C.gold,fontWeight:700,letterSpacing:".5px" }}>優先認識</span>
        </div>

      </div>
    </div>
  );


  return (
    <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",justifyContent:"center",background:"rgba(0,0,0,0.55)" }}
      onTouchStart={e=>e.stopPropagation()}
      onTouchMove={e=>e.stopPropagation()}
      onTouchEnd={e=>e.stopPropagation()}>
      <div onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}
        style={{ width:"100%",maxWidth:480,height:"100%",background:C.bg,display:"flex",flexDirection:"column" as const,position:"relative",
          transform:`translateX(${swipeDx}px)`,transition:swipeDx===0?"transform .3s cubic-bezier(.32,.72,0,1)":"none",
          boxShadow:swipeDx>10?"-10px 0 30px rgba(0,0,0,0.6)":"none",animation:"profileZoomIn .3s cubic-bezier(.32,.72,0,1)" }}>

        {/* ONE scrollable area — photo sticky on top, content below */}
        <div style={{ flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch" as any }}>

          {/* ── PHOTO hero ── */}
          <div style={{ position:"relative",height:"58vh",minHeight:340,flexShrink:0,overflow:"hidden" }}
            onTouchStart={e=>{ photoSwipeX.current=e.touches[0].clientX; photoSwiping.current=false; }}
            onTouchMove={e=>{ const dx=e.touches[0].clientX-photoSwipeX.current; if(Math.abs(dx)>8){photoSwiping.current=true; setPhotoDx(dx);} }}
            onTouchEnd={()=>{
              if(photoSwiping.current){
                if(photoDx < -60 && photoIdx<allPhotos.length-1) setPhotoIdx(i=>i+1);
                else if(photoDx > 60 && photoIdx>0) setPhotoIdx(i=>i-1);
              }
              setPhotoDx(0); photoSwiping.current=false;
            }}>
            {/* CSS-% photo strip — no pixel width dependency */}
            <div style={{ position:"absolute",inset:0,overflow:"hidden" }}>
              <div style={{
                display:"flex", height:"100%", willChange:"transform",
                width:`${Math.max(allPhotos.length,1) * 100}%`,
                transform:`translateX(calc(${-photoIdx * (100/Math.max(allPhotos.length,1))}% + ${photoDx / Math.max(allPhotos.length,1)}%))`,
                transition:photoDx===0?"transform .35s cubic-bezier(.32,.72,0,1)":"none"
              }}>
                {(allPhotos.length>0?allPhotos:['']).map((ph,i)=>(
                  <div key={i} style={{ flex:`0 0 ${100/Math.max(allPhotos.length,1)}%`,height:"100%",backgroundImage:ph?`url(${ph})`:"linear-gradient(145deg,#2A2218,#1C1610)",backgroundSize:"cover",backgroundPosition:"center center",backgroundRepeat:"no-repeat" }}/>
                ))}
              </div>
            </div>
            {/* Back button */}
            <button onClick={onClose} style={{ position:"absolute",top:14,left:14,zIndex:10,width:36,height:36,borderRadius:"50%",background:"rgba(12,10,8,0.55)",backdropFilter:"blur(12px)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>‹</button>
          {/* dot indicators */}
            {allPhotos.length>1&&<div style={{ position:"absolute",top:14,left:58,right:14,display:"flex",gap:4,zIndex:5 }}>
              {allPhotos.map((_,i)=><div key={i} style={{ flex:1,height:3,borderRadius:2,background:i===photoIdx?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.28)",transition:"all .22s" }}/>)}
            </div>}


            {/* gradient */}
            <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"70%",background:"linear-gradient(transparent,rgba(12,10,8,0.9) 60%,rgba(12,10,8,1) 100%)",zIndex:4 }}/>
            {/* NAME OVERLAY — bottom-left inside photo */}
            <div style={{ position:"absolute",bottom:18,left:20,right:20,zIndex:5,display:"flex",alignItems:"flex-end",justifyContent:"space-between" }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                  <span style={{ fontSize:28,fontWeight:800,color:"#fff",letterSpacing:"-0.02em" }}>{p.name}</span>
                  <PremiumBadge plan={(p as any).is_premium ? ((p as any).premium_plan || "premium") : null} />
                  {p.verified&&<svg width="20" height="20" viewBox="0 0 24 24" fill={C.gold}><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z"/></svg>}
                </div>
                <div style={{ fontSize:14.5,color:"rgba(255,255,255,0.68)",marginBottom:2 }}>{[p.age?`${p.age} 歲`:null,p.location||null].filter(Boolean).join(" · ")}</div>
                {(p.occupation||p.education)&&<div style={{ fontSize:13.5,color:"rgba(255,255,255,0.5)",marginBottom:10 }}>{[p.occupation||null,p.education&&edu[p.education]||null].filter(Boolean).join(" · ")}</div>}
                {p.relationship_goal&&goalShort[p.relationship_goal]&&<div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"5px 13px",borderRadius:20,background:"rgba(201,168,76,0.18)",border:"1px solid rgba(201,168,76,0.32)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={C.gold}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  <span style={{ fontSize:12.5,color:C.gold,fontWeight:600 }}>{goalShort[p.relationship_goal]}</span>
                </div>}
              </div>
              <div style={{ width:74,height:74,borderRadius:"50%",background:"rgba(12,10,8,0.75)",backdropFilter:"blur(12px)",border:`2.5px solid ${C.gold}`,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12 }}>
                <span style={{ fontSize:18,fontWeight:800,color:C.gold,lineHeight:1 }}>{compat.score}%</span>
                <span style={{ fontSize:8,color:"rgba(255,255,255,0.45)",marginTop:2,textAlign:"center" as const }}>相配度很高✨</span>
              </div>
            </div>
          </div>

          {/* ── ALL CONTENT below photo, single scroll ── */}
          <div style={{ padding:"14px 16px 120px",background:C.bg }}>

            {/* Common points */}
            {finalCommon.length>0&&<div style={{ background:"#141210",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"14px 16px",marginBottom:16 }}>
              <div style={{ fontSize:13.5,fontWeight:700,color:C.text,marginBottom:14 }}>你們有 {finalCommon.length} 個共同點</div>
              <div style={{ display:"flex",justifyContent:"space-around" }}>
                {finalCommon.map((pt,i)=>(
                  <div key={i} style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:7,flex:1 }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{pt.icon}</div>
                    <span style={{ fontSize:10.5,color:"rgba(255,255,255,0.42)",textAlign:"center" as const,lineHeight:1.3,maxWidth:58 }}>{pt.label}</span>
                  </div>
                ))}
              </div>
            </div>}

            {/* About me */}
            {p.bio&&<div style={{ marginBottom:20 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                <span style={{ fontSize:28,color:"#E8365D",fontFamily:"Georgia,serif",fontWeight:700,lineHeight:0.75 }}>"</span>
                <span style={{ fontSize:14,fontWeight:700,color:C.text }}>關於我</span>
              </div>
              <div style={{ fontSize:14,color:"rgba(245,237,214,0.6)",lineHeight:1.85 }}>{p.bio}</div>
            </div>}

            {/* Photo strip */}
            {allPhotos.length>0&&<div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13,color:"rgba(245,237,214,0.36)",marginBottom:8 }}>照片 {photoIdx+1}/{allPhotos.length}</div>
              <div style={{ display:"flex",gap:7,overflowX:"auto" as const }}>
                {allPhotos.map((ph,i)=>(
                  <div key={i} onClick={()=>setPhotoIdx(i)} style={{ width:80,height:96,borderRadius:10,overflow:"hidden",flexShrink:0,cursor:"pointer",border:i===photoIdx?`2.5px solid ${C.gold}`:"2.5px solid transparent",transition:"border-color .2s" }}>
                    <img src={ph} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" as const }}/>
                  </div>
                ))}
              </div>
            </div>}

            {/* Hobbies */}
            {p.hobbies.length>0&&<div style={{ marginBottom:22 }}>
              <div style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:12 }}>興趣愛好</div>
              <div style={{ display:"flex",flexWrap:"wrap" as const,gap:8 }}>
                {p.hobbies.slice(0,6).map(h=>(
                  <div key={h} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,background:"#141210",border:"1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize:14 }}>{hobbyIcon[h]||"⭐"}</span>
                    <span style={{ fontSize:13.5,color:C.textSub }}>{h}</span>
                  </div>
                ))}
                {p.hobbies.length>6&&<div style={{ display:"flex",alignItems:"center",padding:"7px 14px",borderRadius:20,background:"#141210",border:"1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontSize:13.5,color:C.textMuted }}>···</span>
                </div>}
              </div>
            </div>}

            {/* Life style */}
            {lifeItems.length>0&&<div style={{ marginBottom:22 }}>
              <div style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:18 }}>生活方式</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                {lifeItems.map((item,i)=>(
                  <div key={i} style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:7 }}>
                    <span style={{ fontSize:28 }}>{item.icon}</span>
                    <span style={{ fontSize:12,color:C.textSub,textAlign:"center" as const }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>}

            {/* Basic info */}
            {basicItems.length>0&&<div style={{ marginBottom:22 }}>
              <div style={{ fontSize:15,fontWeight:700,color:C.text,marginBottom:18 }}>基本資料</div>
              <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(4,basicItems.length)},1fr)`,gap:8 }}>
                {basicItems.map((item,i)=>(
                  <div key={i} style={{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:7 }}>
                    <span style={{ fontSize:28 }}>{item.icon}</span>
                    <div style={{ textAlign:"center" as const }}>
                      <div style={{ fontSize:13,color:C.text,fontWeight:600 }}>{item.label}</div>
                      <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Relationship goal */}
            {p.relationship_goal&&goalFull[p.relationship_goal]&&<div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#E8365D"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span style={{ fontSize:15,fontWeight:700,color:C.text }}>關係目標</span>
              </div>
              <div style={{ fontSize:14,color:C.textSub,lineHeight:1.75 }}>{goalFull[p.relationship_goal]}</div>
            </div>}

          </div>
        </div>

        {/* ── BOTTOM ACTION BAR — discover only ── */}
        {(mode ?? "discover") === "discover" && <ActionBar/>}
      </div>
    </div>
  );
}


function SwipeCard({ p, isTop, myMbti, onSwipe, onOpenProfile }: { p: ExploreProfile; isTop: boolean; myMbti: string; onSwipe: (d: "like"|"pass"|"superlike") => void; onOpenProfile: () => void }) {
  const [pos,setPos]=useState({x:0,y:0});
  const [drag,setDrag]=useState(false);
  const [photoIdx,setPhotoIdx]=useState(0);
  const start=useRef({x:0,y:0});
  const THRESH=80;
  const compat=mbtiCompatibility(myMbti,p.mbti);
  const allPhotos=[p.avatar,...p.photos.filter(ph=>ph!==p.avatar)].filter(Boolean);
  const onS=(x:number,y:number)=>{if(!isTop)return;start.current={x,y};setDrag(true);};
  const onM=(x:number,y:number)=>{if(!drag)return;setPos({x:x-start.current.x,y:y-start.current.y});};
  const onE=()=>{if(pos.x>THRESH){sound.like();onSwipe("like");}else if(pos.x<-THRESH){sound.pass();onSwipe("pass");}else setPos({x:0,y:0});setDrag(false);};
  const likeO=Math.min(1,Math.max(0,pos.x/60));
  const passO=Math.min(1,Math.max(0,-pos.x/60));

  return (
    <div onMouseDown={e=>{if(isTop)onS(e.clientX,e.clientY);}} onMouseMove={e=>{if(drag)onM(e.clientX,e.clientY);}} onMouseUp={e=>{if(!drag&&isTop&&Math.abs(pos.x)<5)onOpenProfile();else onE();}} onMouseLeave={onE}
      onTouchStart={e=>{onS(e.touches[0].clientX,e.touches[0].clientY);}}
      onTouchMove={e=>onM(e.touches[0].clientX,e.touches[0].clientY)}
      onTouchEnd={e=>{const moved=Math.abs(pos.x)>8||Math.abs(pos.y)>8;if(!moved&&isTop)onOpenProfile();else onE();}}
      style={{ position:"absolute",width:"100%",transform:`translate(${pos.x}px,${pos.y}px) rotate(${pos.x*.05}deg)`,transition:drag?"none":"transform .4s cubic-bezier(.34,1.56,.64,1)",cursor:isTop?"pointer":"default",userSelect:"none" as const }}>
      <div style={{ borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.6)",background:C.bgCard }}>
        {/* Photo */}
        <div style={{ height:440,position:"relative",background:allPhotos[photoIdx]?`url(${allPhotos[photoIdx]}) center/cover no-repeat`:`linear-gradient(145deg,#2A2218,#1C1610)` }}>
          {allPhotos.length>1 && <>
            <div style={{ position:"absolute",top:12,left:0,right:0,display:"flex",justifyContent:"center",gap:4,zIndex:2 }}>
              {allPhotos.map((_,i)=><div key={i} style={{ height:3,width:i===photoIdx?22:10,borderRadius:2,background:i===photoIdx?"#fff":"rgba(255,255,255,0.35)",transition:"all .25s" }}/>)}
            </div>
            <div style={{ position:"absolute",left:0,top:0,width:"38%",height:"100%",zIndex:3 }} onClick={()=>setPhotoIdx(i=>Math.max(0,i-1))}/>
            <div style={{ position:"absolute",right:0,top:0,width:"38%",height:"100%",zIndex:3 }} onClick={()=>setPhotoIdx(i=>Math.min(allPhotos.length-1,i+1))}/>
          </>}
          {/* LIKE/NOPE stamps */}
          <div style={{ position:"absolute",top:24,left:20,opacity:likeO,border:"3px solid #4AE06B",borderRadius:10,padding:"5px 16px",color:"#4AE06B",fontWeight:900,fontSize:20,transform:"rotate(-18deg)",letterSpacing:2,pointerEvents:"none" }}>LIKE</div>
          <div style={{ position:"absolute",top:24,right:20,opacity:passO,border:`3px solid ${C.rose}`,borderRadius:10,padding:"5px 16px",color:C.rose,fontWeight:900,fontSize:20,transform:"rotate(18deg)",letterSpacing:2,pointerEvents:"none" }}>NOPE</div>
          {/* Compat badge */}
          <div style={{ position:"absolute",top:14,right:14,background:"rgba(12,10,8,0.75)",backdropFilter:"blur(12px)",borderRadius:20,padding:"5px 10px",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center" }}>
            <div style={{ fontSize:14,fontWeight:800,color:C.gold }}>{compat.score}%</div>
            <div style={{ fontSize:8.5,color:C.textMuted }}>匹配</div>
          </div>
          {p.verified && <div style={{ position:"absolute",top:14,left:14,background:"rgba(0,201,167,0.85)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:700,zIndex:2 }}>✓</div>}
          <div style={{ position:"absolute",bottom:0,left:0,right:0,height:220,background:"linear-gradient(transparent,rgba(12,10,8,0.98))",pointerEvents:"none" }}/>
          {/* Info overlay */}
          <div style={{ position:"absolute",bottom:18,left:18,right:18,pointerEvents:"none" }}>
            <div style={{ display:"flex",alignItems:"baseline",gap:8,marginBottom:6 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}><div style={{ fontSize:25,fontWeight:800,color:"#fff" }}>{p.name}</div><PremiumBadge plan={(p as any).is_premium ? ((p as any).premium_plan || "premium") : null} /></div>
              {p.age && <div style={{ fontSize:18,color:"rgba(255,255,255,0.75)" }}>{p.age}</div>}
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.65)",marginBottom:6 }}>
              {p.location && `📍 ${p.location}`}
            </div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" as const }}>
              <span style={{ background:"rgba(201,168,76,0.2)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,padding:"3px 11px",fontSize:11.5,color:C.gold,fontWeight:600 }}>✦ {p.mbti}</span>
              {p.distance!=null && <span style={{ background:"rgba(255,255,255,0.1)",borderRadius:20,padding:"3px 11px",fontSize:11.5,color:"rgba(255,255,255,0.8)" }}>{p.distance}km</span>}
            </div>
          </div>
        </div>
        {/* Bio row — only show on top card */}
        {isTop && (p.bio||p.hobbies.length>0) && (
          <div style={{ padding:"14px 18px 16px",cursor:"pointer" }} onClick={onOpenProfile}>
            {p.bio && <div style={{ fontSize:13,color:C.textSub,lineHeight:1.55,marginBottom:8,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" } as any}>{p.bio}</div>}
            {p.hobbies.length>0 && <div style={{ display:"flex",gap:5,flexWrap:"wrap" as const }}>
              {p.hobbies.slice(0,3).map(h=><span key={h} style={{ background:C.bgGold,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 10px",fontSize:11,color:C.textMuted }}>{h}</span>)}
              {p.hobbies.length>3 && <span style={{ fontSize:11,color:C.textMuted,padding:"3px 4px" }}>+{p.hobbies.length-3}</span>}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Grid Card ──────────────────────────────────────── */
function GridCard({ p, myMbti, onClick }: { p: ExploreProfile; myMbti: string; onClick: () => void }) {
  const compat = mbtiCompatibility(myMbti, p.mbti);
  return (
    <div onClick={onClick} style={{ borderRadius:16,overflow:"hidden",cursor:"pointer",position:"relative",aspectRatio:"0.72",background:C.bgCard }}>
      <div style={{ position:"absolute",inset:0,background:p.avatar?`url(${p.avatar}) center/cover no-repeat`:`linear-gradient(145deg,#2A2218,#1C1610)` }}/>
      <div style={{ position:"absolute",top:8,right:8,background:"rgba(12,10,8,0.7)",backdropFilter:"blur(8px)",borderRadius:20,padding:"3px 8px",fontSize:11,color:C.gold,fontWeight:700 }}>{compat.score}%</div>
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"55%",background:"linear-gradient(transparent,rgba(12,10,8,0.97))" }}/>
      <div style={{ position:"absolute",bottom:10,left:10,right:10 }}>
        <div style={{ fontSize:14,fontWeight:700,color:"#fff" }}>{p.name}{p.age?`, ${p.age}`:""}</div>
        {p.location && <div style={{ fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:1 }}>{p.location}</div>}
      </div>
    </div>
  );
}

/* ─── ExploreScreen ──────────────────────────────────── */
export function ExploreScreen({ userId, profile, onUpdate, onOpenMatch }: { userId: string; profile: UserProfile; onUpdate: (p: Partial<UserProfile>) => void; onOpenMatch: (m: MatchItem) => void }) {
  const [profiles,setProfiles]   = useState<ExploreProfile[]>([]);
  const [idx,setIdx]             = useState(0);
  const [loading,setLoading]     = useState(true);
  const [exploreTab,setExploreTab] = useState<ExploreTab>("recommend");
  const viewMode: "swipe"|"grid" = exploreTab === "recommend" ? "swipe" : "grid";
  const FREE_GRID_LIMIT = 6;
  const isPremiumMe = (profile as any)?.is_premium === true;
  const [showFilter,setShowFilter] = useState(false);
  const [showWhoLiked,setShowWhoLiked] = useState(false);
  const [whoLiked,setWhoLiked]   = useState<WhoLikedItem[]>([]);
  const [dailyStatus,setDailyStatus] = useState<DailyLikeStatus|null>(null);
  const [showPremiumGate, setShowPremiumGate] = useState<"likes"|"superlike"|"wholiked"|"grid"|null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [matchInfo,setMatchInfo] = useState<{avatar:string;name:string;id:string;matchId?:string;profile?:ExploreProfile}|null>(null);
  const [showIcebreaker,setShowIcebreaker] = useState(false);
  const [showProfile,setShowProfile] = useState<ExploreProfile|null>(null);
  const [filters,setFilters]     = useState<Partial<UserProfile>>({ looking_for_gender:profile.looking_for_gender||"female", filter_min_age:profile.filter_min_age||18, filter_max_age:profile.filter_max_age||35, filter_max_distance:profile.filter_max_distance||100 });

  useEffect(()=>{ load(); loadSocial(); },[]);

  async function load() {
    setLoading(true);
    const [profs,status] = await Promise.all([getExploreProfiles(userId,{...profile,...filters}), getDailyLikeStatus(userId)]);
    setProfiles(profs); setIdx(0); setDailyStatus(status); setLoading(false);
  }
  async function loadSocial() { setWhoLiked(await getWhoLikedMe(userId)); }

  async function doSwipe(dir:"like"|"pass"|"superlike") {
    const p=profiles[idx]; if(!p) return;
    if(dir==="like"&&dailyStatus&&!dailyStatus.isPremium&&dailyStatus.remaining<=0){
      setShowPremiumGate("likes"); return;
    }
    if(dir==="superlike"&&dailyStatus&&dailyStatus.superlikeRemaining<=0){
      setShowPremiumGate("superlike"); return;
    }
    const matched=await recordSwipe(userId,p.id,dir);
    if(dir==="like") setDailyStatus(s=>s?{...s,used:s.used+1,remaining:Math.max(0,s.remaining-1)}:s);
    if(dir==="superlike") setDailyStatus(s=>s?{...s,superlikeUsed:(s.superlikeUsed||0)+1,superlikeRemaining:Math.max(0,(s.superlikeRemaining||0)-1)}:s);
    if(matched){
      const{data}=await sb.from("matches").select("id").or(`and(user1_id.eq.${userId},user2_id.eq.${p.id}),and(user1_id.eq.${p.id},user2_id.eq.${userId})`).maybeSingle();
      sound.match(); setMatchInfo({avatar:p.avatar,name:p.name,id:p.id,matchId:data?.id,profile:p});
    } else { setIdx(i=>i+1); }
  }

  async function likeFromWhoLiked(item:WhoLikedItem) {
    sound.like(); await recordSwipe(userId,item.id,"like");
    const{data}=await sb.from("matches").select("id").or(`and(user1_id.eq.${userId},user2_id.eq.${item.id}),and(user1_id.eq.${item.id},user2_id.eq.${userId})`).maybeSingle();
    setWhoLiked(w=>w.filter(x=>x.id!==item.id)); setShowWhoLiked(false);
    sound.match(); setMatchInfo({avatar:item.avatar,name:item.name,id:item.id,matchId:data?.id,profile:{id:item.id,name:item.name,age:item.age,mbti:item.mbti,bio:"",avatar:item.avatar,photos:[],location:"",country:"",ethnicity:[],hobbies:[],verified:false} as any});
  }

  const remaining = profiles.slice(idx,idx+3).reverse();
  const myMbti = profile.mbti||"INFP";

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",background:C.bg,animation:"tabSwitch .3s ease" }}>
      {/* Header */}
      <div style={{ padding:"52px 16px 0",background:"rgba(12,10,8,0.96)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
          <div style={{ display:"flex",gap:20 }}>
            {([["recommend","推薦"],["nearby","附近的人"],["new","新加入"]] as const).map(([id,label])=>(
              <button key={id} onClick={()=>{setExploreTab(id);load();}} style={{ background:"none",border:"none",color:exploreTab===id?C.text:C.textMuted,fontFamily:"inherit",fontSize:15,fontWeight:exploreTab===id?700:400,cursor:"pointer",paddingBottom:10,borderBottom:exploreTab===id?`2px solid ${C.gold}`:"2px solid transparent",transition:"all .2s" }}>{label}</button>
            ))}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {/* Premium crown */}
            <button style={{ width:34,height:34,borderRadius:"50%",background:C.goldSoft,border:`1px solid ${C.gold}33`,color:C.gold,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>👑</button>
            {/* Who liked me */}
            <button onClick={()=>{ if(!dailyStatus?.isPremium){ setShowPremiumGate("wholiked"); return; } setShowWhoLiked(true); }} style={{ position:"relative",width:34,height:34,borderRadius:"50%",background:C.roseSoft,border:`1px solid rgba(232,54,93,0.2)`,color:C.rose,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              ♥{whoLiked.length>0&&<div style={{ position:"absolute",top:-3,right:-3,width:15,height:15,borderRadius:"50%",background:C.gradRose,fontSize:8.5,color:"#fff",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.bg}` }}>{whoLiked.length}</div>}
            </button>
            {/* Grid toggle */}
            
            {/* Filter */}
            <button onClick={()=>setShowFilter(true)} style={{ width:34,height:34,borderRadius:"50%",background:C.surf,border:`1px solid ${C.border}`,color:C.textMuted,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            </button>
          </div>
        </div>
        {/* Daily bar */}
        {dailyStatus&&<div style={{ display:"flex",alignItems:"center",gap:8,paddingBottom:10 }}>
          <div style={{ flex:1,height:2,background:"rgba(255,255,255,0.06)",borderRadius:2 }}>
            <div style={{ height:"100%",width:`${(dailyStatus.used/dailyStatus.limit)*100}%`,background:dailyStatus.remaining<=5?C.gradRose:C.grad,borderRadius:2,transition:"width .4s" }}/>
          </div>
          <div style={{ fontSize:11,color:dailyStatus.remaining<=5?C.rose:C.textMuted,flexShrink:0 }}>{dailyStatus.remaining>0?`剩 ${dailyStatus.remaining}`:"已用完"}</div>
        </div>}
      </div>

      {/* Content */}
      <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
        {loading ? (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
            <div style={{ width:36,height:36,border:`2px solid ${C.border}`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
            <div style={{ fontSize:13,color:C.textMuted }}>探索中...</div>
          </div>
        ) : viewMode==="grid" ? (
          <div style={{ overflowY:"auto",height:"100%",padding:"14px 12px 80px" }}>
            {profiles.length===0 ? (
              <div style={{ textAlign:"center",padding:"60px 32px",color:C.textMuted }}>
                <div style={{ fontSize:36,opacity:.3,color:C.gold,marginBottom:12 }}>◈</div>
                <div style={{ fontSize:16,fontWeight:700,color:C.text,marginBottom:8 }}>附近暫無用戶</div>
                <div style={{ fontSize:14 }}>試試放寬篩選條件</div>
              </div>
            ) : (
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {profiles.map((p,gi)=>{
                  const locked = !isPremiumMe && gi >= FREE_GRID_LIMIT;
                  return (
                    <div key={p.id} style={{ position:"relative" }}>
                      <div style={{ filter:locked?"blur(13px)":"none",pointerEvents:locked?"none":"auto",transition:"filter .2s" }}>
                        <GridCard p={p} myMbti={myMbti} onClick={()=>setShowProfile(p)}/>
                      </div>
                      {locked && (
                        <div onClick={()=>setShowPremiumGate("grid")} style={{ position:"absolute",inset:0,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",borderRadius:16 }}>
                          <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#C9A84C,#E2C068)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,boxShadow:"0 4px 20px rgba(201,168,76,0.45)" }}>🔒</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 16px 0" }}>
            {idx>=profiles.length ? (
              <div style={{ textAlign:"center",padding:"0 32px",animation:"springIn .5s ease" }}>
                <div style={{ fontSize:44,opacity:.3,color:C.gold,marginBottom:16 }}>◈</div>
                <div style={{ fontSize:20,fontWeight:700,color:C.text,marginBottom:8 }}>今天都看完了</div>
                <div style={{ fontSize:14,color:C.textMuted,marginBottom:32,lineHeight:1.7 }}>新用戶每天都在加入<br/>明天再來看看</div>
                <button onClick={load} style={{ padding:"13px 36px",borderRadius:50,background:C.grad,border:"none",color:C.bg,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer" }}>重新載入</button>
              </div>
            ) : (
              <div style={{ position:"relative",width:"100%",maxWidth:360,height:540,overflow:"hidden" }}>
                {remaining.map((p,i)=><SwipeCard key={p.id} p={p} isTop={i===remaining.length-1} myMbti={myMbti} onSwipe={doSwipe} onOpenProfile={()=>setShowProfile(p)}/>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {viewMode==="swipe" && idx<profiles.length && !loading && (
        <div style={{ display:"flex",gap:20,padding:"14px 0 28px",justifyContent:"center",alignItems:"center",background:C.bg }}>
          {/* Pass */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5 }}>
            <button onClick={()=>doSwipe("pass")} style={{ width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:"rgba(255,255,255,0.42)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .18s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,54,93,0.08)";e.currentTarget.style.color=C.rose;}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.42)";}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <span style={{ fontSize:10.5,color:"rgba(255,255,255,0.26)",letterSpacing:".3px" }}>略過</span>
          </div>
          {/* Like */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5 }}>
            <button onClick={()=>doSwipe("like")} style={{ width:66,height:66,borderRadius:"50%",background:"linear-gradient(135deg,#C9A84C,#E2C068)",border:"none",color:"#12100C",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px rgba(201,168,76,0.38)",transition:"transform .15s" }} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.07)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <span style={{ fontSize:10.5,color:"#E2C068",fontWeight:600,letterSpacing:".3px" }}>喜歡</span>
          </div>
          {/* Priority */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5 }}>
            <button onClick={()=>doSwipe("superlike")} style={{ width:52,height:52,borderRadius:"50%",background:"linear-gradient(145deg,#1A1608,#231E0A)",border:"1.5px solid rgba(201,168,76,0.5)",color:C.gold,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(201,168,76,0.2)",transition:"all .18s" }} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 0 0 6px rgba(201,168,76,0.1),0 6px 20px rgba(201,168,76,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(201,168,76,0.2)";}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <span style={{ fontSize:10.5,color:C.gold,fontWeight:700,letterSpacing:".4px" }}>優先認識</span>
          </div>
        </div>
      )}

      {/* Profile detail sheet */}
      {showProfile && <ProfileSheet p={showProfile} myMbti={myMbti} myProfile={profile} onClose={()=>setShowProfile(null)}
        onLike={()=>{doSwipe("like");setShowProfile(null);}}
        onSuperlike={()=>{doSwipe("superlike");setShowProfile(null);}}
        onChat={()=>{ setShowProfile(null); }}
      />}

      {/* ── Premium Gate ── */}
      {showPremiumGate && (
        <PremiumGateSheet
          icon={showPremiumGate==="wholiked"?"♥":showPremiumGate==="superlike"?"★":showPremiumGate==="grid"?"🔒":"∞"}
          title={showPremiumGate==="likes"?"今日喜歡已用完":showPremiumGate==="superlike"?"今日優先認識已用完":showPremiumGate==="grid"?"解鎖更多附近的人":"查看所有喜歡你的人"}
          desc={showPremiumGate==="likes"?<span>免費版每天可喜歡 30 人<br/>升級 Premium 享無限喜歡</span>:showPremiumGate==="superlike"?<span>免費版每天 1 次優先認識<br/>Premium 每天 5 次</span>:showPremiumGate==="grid"?<span>免費版可瀏覽 6 位用戶<br/>升級 Premium 無限瀏覽附近與新加入的人</span>:<span>升級 Premium<br/>查看所有喜歡你的人</span>}
          onUpgrade={()=>{ setShowPremiumGate(null); setShowPremium(true); }}
          onClose={()=>setShowPremiumGate(null)}
        />
      )}
      {showPremium && <div style={{ position:"fixed",inset:0,zIndex:600,background:C.bg }}><PremiumScreen onBack={()=>setShowPremium(false)} profile={profile}/></div>}

      {matchInfo && <MatchAnimation myAvatar={profile.avatar_url||""} myName={profile.display_name||profile.username} theirAvatar={matchInfo.avatar} theirName={matchInfo.name}
        onChat={()=>{if(matchInfo.matchId)onOpenMatch({id:matchInfo.id,matchId:matchInfo.matchId,name:matchInfo.name,avatar:matchInfo.avatar,lastMsg:"",time:"",unread:0} as any);setMatchInfo(null);}}
        onIcebreaker={()=>setShowIcebreaker(true)}
        onContinue={()=>{setMatchInfo(null);setIdx(i=>i+1);}}/>}
      {showIcebreaker&&matchInfo?.profile&&<IcebreakerSheet them={matchInfo.profile} myMbti={myMbti} onClose={()=>setShowIcebreaker(false)} onUse={text=>{if(matchInfo.matchId)onOpenMatch({id:matchInfo.id,matchId:matchInfo.matchId,name:matchInfo.name,avatar:matchInfo.avatar,lastMsg:text,time:"",unread:0,prefillMsg:text} as any);setShowIcebreaker(false);setMatchInfo(null);}}/>}
      {showWhoLiked && <WhoLikedPanel items={whoLiked} onClose={()=>setShowWhoLiked(false)} onLike={likeFromWhoLiked}/>}
      {showFilter && <FilterSheet filters={filters} onSave={f=>{setFilters(f);updateProfile(userId,f);onUpdate(f);setShowFilter(false);load();}} onClose={()=>setShowFilter(false)}/>}
    </div>
  );
}
