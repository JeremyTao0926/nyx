import { useState, useEffect, useRef } from "react";
import { C, sound, sb, getExploreProfiles, recordSwipe, updateProfile, getDailyLikeStatus, getWhoLikedMe, generateIcebreaker, mbtiCompatibility } from "../utils";
import { Av, MatchAnimation } from "../components/Atoms";
import { FilterSheet } from "../components/Modals";
import type { UserProfile, ExploreProfile, MatchItem, WhoLikedItem, DailyLikeStatus } from "../types";

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
function ProfileSheet({ p, myMbti, onClose, onLike, onSuperlike, onChat }: {
  p: ExploreProfile; myMbti: string;
  onClose: () => void; onLike: () => void; onSuperlike: () => void; onChat: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lbIdx, setLbIdx] = useState<number|null>(null);
  const compat = mbtiCompatibility(myMbti, p.mbti);
  const allPhotos = [p.avatar, ...p.photos.filter(x => x !== p.avatar)].filter(Boolean);

  // Lightbox
  if (lbIdx !== null) return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.96)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
      <button onClick={()=>setLbIdx(null)} style={{ position:"absolute",top:16,left:16,width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:`1px solid ${C.border}`,color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
      <div style={{ display:"flex",alignItems:"center",gap:12,maxWidth:"90vw" }}>
        {allPhotos.length>1&&<button onClick={()=>setLbIdx(i=>Math.max(0,i!-1))} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:"#fff",fontSize:20,cursor:"pointer" }}>‹</button>}
        <img src={allPhotos[lbIdx]} alt="" style={{ maxWidth:"72vw",maxHeight:"80vh",objectFit:"contain",borderRadius:14 }}/>
        {allPhotos.length>1&&<button onClick={()=>setLbIdx(i=>Math.min(allPhotos.length-1,i!+1))} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,color:"#fff",fontSize:20,cursor:"pointer" }}>›</button>}
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",justifyContent:"center",background:"rgba(0,0,0,0.5)" }}>
      <div style={{ width:"100%",maxWidth:480,background:C.bg,display:"flex",flexDirection:"column",height:"100%",position:"relative",animation:"slideUp .28s cubic-bezier(.32,.72,0,1)" }}>

        {/* Floating back + more */}
        <div style={{ position:"absolute",top:16,left:12,zIndex:10 }}>
          <button onClick={onClose} style={{ width:36,height:36,borderRadius:"50%",background:"rgba(12,10,8,0.65)",backdropFilter:"blur(12px)",border:`1px solid rgba(255,255,255,0.12)`,color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
        </div>
        <div style={{ position:"absolute",top:16,right:12,zIndex:10 }}>
          <button style={{ width:36,height:36,borderRadius:"50%",background:"rgba(12,10,8,0.65)",backdropFilter:"blur(12px)",border:`1px solid rgba(255,255,255,0.12)`,color:"rgba(255,255,255,0.7)",fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>⋯</button>
        </div>

        {/* Compat badge — top right like image 2 */}
        <div style={{ position:"absolute",top:16,right:60,zIndex:10,background:"rgba(12,10,8,0.72)",backdropFilter:"blur(12px)",borderRadius:20,padding:"6px 12px",display:"flex",flexDirection:"column",alignItems:"center" }}>
          <div style={{ fontSize:15,fontWeight:800,color:C.gold,lineHeight:1 }}>{compat.score}%</div>
          <div style={{ fontSize:9,color:C.textMuted,letterSpacing:.3 }}>匹配度</div>
        </div>

        <div style={{ flex:1,overflowY:"auto" }}>
          {/* Hero photo — taller, like image 2 */}
          <div style={{ height:"58vh",minHeight:340,position:"relative",background:allPhotos[photoIdx]?`url(${allPhotos[photoIdx]}) center/cover no-repeat`:`linear-gradient(145deg,#2A2218,#1C1610)`,cursor:"pointer" }}
            onClick={()=>setLbIdx(photoIdx)}>
            {allPhotos.length>1&&<>
              <div style={{ position:"absolute",top:12,left:0,right:0,display:"flex",justifyContent:"center",gap:4,zIndex:2 }}>
                {allPhotos.map((_,i)=><div key={i} style={{ height:3,width:i===photoIdx?22:10,borderRadius:2,background:i===photoIdx?"#fff":"rgba(255,255,255,0.35)",transition:"all .25s" }}/>)}
              </div>
              <div style={{ position:"absolute",left:0,top:0,width:"40%",height:"100%",zIndex:3 }} onClick={e=>{e.stopPropagation();setPhotoIdx(i=>Math.max(0,i-1));}}/>
              <div style={{ position:"absolute",right:0,top:0,width:"40%",height:"100%",zIndex:3 }} onClick={e=>{e.stopPropagation();setPhotoIdx(i=>Math.min(allPhotos.length-1,i+1));}}/>
            </>}
            {/* Strong gradient like image 2 */}
            <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"60%",background:"linear-gradient(transparent,rgba(12,10,8,1))",pointerEvents:"none" }}/>
            {/* Name / profession overlay at bottom — image 2 style */}
            <div style={{ position:"absolute",bottom:20,left:20,right:20,pointerEvents:"none" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                <div style={{ fontSize:28,fontWeight:800,color:"#fff",letterSpacing:"-0.01em" }}>{p.name}</div>
                {p.age&&<div style={{ fontSize:20,color:"rgba(255,255,255,0.75)",fontWeight:400 }}>{p.age}</div>}
                {p.verified&&<span style={{ fontSize:15,color:C.mint }}>✓</span>}
              </div>
              {/* Profession + location — like image 2 */}
              {p.location&&<div style={{ fontSize:13.5,color:"rgba(255,255,255,0.6)",marginBottom:2 }}>{p.location}</div>}
            </div>
          </div>

          {/* Info */}
          <div style={{ padding:"20px 20px 140px" }}>
            {/* MBTI + compat row */}
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:20 }}>
              <span style={{ background:C.goldSoft,border:`1px solid ${C.gold}33`,borderRadius:20,padding:"5px 14px",fontSize:13,color:C.gold,fontWeight:600 }}>✦ {p.mbti}</span>
              <span style={{ background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 14px",fontSize:13,color:C.textSub }}>{compat.label}</span>
            </div>

            {/* Bio */}
            {p.bio&&<div style={{ marginBottom:22 }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10 }}>關於我</div>
              <div style={{ fontSize:14.5,color:C.textSub,lineHeight:1.75 }}>{p.bio}</div>
            </div>}

            {/* Hobbies — pill style like image 2 */}
            {p.hobbies.length>0&&<div style={{ marginBottom:22 }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10 }}>興趣愛好</div>
              <div style={{ display:"flex",flexWrap:"wrap" as const,gap:8 }}>
                {p.hobbies.map(h=><span key={h} style={{ background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:20,padding:"6px 14px",fontSize:13,color:C.textSub }}>{h}</span>)}
              </div>
            </div>}

            {/* Photos */}
            {allPhotos.length>1&&<div>
              <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10 }}>生活照片</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6 }}>
                {allPhotos.slice(1).map((ph,i)=>
                  <div key={i} style={{ aspectRatio:"1",borderRadius:12,overflow:"hidden",cursor:"zoom-in" }} onClick={()=>setLbIdx(i+1)}>
                    <img src={ph} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" as const }}/>
                  </div>
                )}
              </div>
            </div>}
          </div>
        </div>

        {/* Fixed action bar — image 2: ✕ ♥ 💬 */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"14px 24px 36px",background:`linear-gradient(transparent,${C.bg} 28%)`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <button onClick={onClose} style={{ width:52,height:52,borderRadius:"50%",background:C.bgCard,border:`1px solid ${C.border}`,color:C.rose,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s" }} onMouseEnter={e=>(e.currentTarget.style.background="rgba(232,54,93,0.1)")} onMouseLeave={e=>(e.currentTarget.style.background=C.bgCard)}>✕</button>
          <button onClick={onLike} style={{ width:68,height:68,borderRadius:"50%",background:C.gradRose,border:"none",color:"#fff",fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 24px ${C.roseGlow}` }}>♥</button>
          <button onClick={onChat} style={{ width:52,height:52,borderRadius:"50%",background:C.bgGold,border:`1px solid ${C.gold}44`,color:C.gold,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Swipe Card ─────────────────────────────────────── */
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
    <div onMouseDown={e=>onS(e.clientX,e.clientY)} onMouseMove={e=>{if(drag)onM(e.clientX,e.clientY);}} onMouseUp={onE} onMouseLeave={onE}
      onTouchStart={e=>onS(e.touches[0].clientX,e.touches[0].clientY)} onTouchMove={e=>onM(e.touches[0].clientX,e.touches[0].clientY)} onTouchEnd={onE}
      style={{ position:"absolute",width:"100%",transform:`translate(${pos.x}px,${pos.y}px) rotate(${pos.x*.05}deg)`,transition:drag?"none":"transform .4s cubic-bezier(.34,1.56,.64,1)",cursor:isTop?"grab":"default",userSelect:"none" as const }}>
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
              <div style={{ fontSize:25,fontWeight:800,color:"#fff" }}>{p.name}</div>
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
        {/* Bio row */}
        {(p.bio||p.hobbies.length>0) && (
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
  const [viewMode,setViewMode]   = useState<"swipe"|"grid">("swipe");
  const [exploreTab,setExploreTab] = useState<ExploreTab>("recommend");
  const [showFilter,setShowFilter] = useState(false);
  const [showWhoLiked,setShowWhoLiked] = useState(false);
  const [whoLiked,setWhoLiked]   = useState<WhoLikedItem[]>([]);
  const [dailyStatus,setDailyStatus] = useState<DailyLikeStatus|null>(null);
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
    if(dir!=="pass"&&dailyStatus&&dailyStatus.remaining<=0){alert("今日喜歡額度已用完");return;}
    const matched=await recordSwipe(userId,p.id,dir);
    if(dir!=="pass") setDailyStatus(s=>s?{...s,used:s.used+1,remaining:Math.max(0,s.remaining-1)}:s);
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
            <button onClick={()=>setShowWhoLiked(true)} style={{ position:"relative",width:34,height:34,borderRadius:"50%",background:C.roseSoft,border:`1px solid rgba(232,54,93,0.2)`,color:C.rose,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              ♥{whoLiked.length>0&&<div style={{ position:"absolute",top:-3,right:-3,width:15,height:15,borderRadius:"50%",background:C.gradRose,fontSize:8.5,color:"#fff",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${C.bg}` }}>{whoLiked.length}</div>}
            </button>
            {/* Grid toggle */}
            <button onClick={()=>setViewMode(m=>m==="swipe"?"grid":"swipe")} style={{ width:34,height:34,borderRadius:"50%",background:C.surf,border:`1px solid ${C.border}`,color:C.textMuted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {viewMode==="swipe"?"⊞":"⊟"}
            </button>
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
                {profiles.map(p=><GridCard key={p.id} p={p} myMbti={myMbti} onClick={()=>setShowProfile(p)}/>)}
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
              <div style={{ position:"relative",width:"100%",maxWidth:360,height:520 }}>
                {remaining.map((p,i)=><SwipeCard key={p.id} p={p} isTop={i===remaining.length-1} myMbti={myMbti} onSwipe={doSwipe} onOpenProfile={()=>setShowProfile(p)}/>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {viewMode==="swipe" && idx<profiles.length && !loading && (
        <div style={{ display:"flex",gap:20,padding:"14px 0 28px",justifyContent:"center",alignItems:"center",background:C.bg }}>
          <button onClick={()=>doSwipe("pass")} style={{ width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.rose,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s" }} onMouseEnter={e=>(e.currentTarget.style.background="rgba(232,54,93,0.08)")} onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}>✕</button>
          <button onClick={()=>doSwipe("like")} style={{ width:64,height:64,borderRadius:"50%",background:C.gradRose,border:"none",color:"#fff",fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 24px ${C.roseGlow}`,transition:"transform .15s" }} onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.08)")} onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}>♥</button>
          <button onClick={()=>showProfile!==null?undefined:setShowProfile(profiles[idx])} style={{ width:52,height:52,borderRadius:"50%",background:C.bgCard,border:`1px solid ${C.border}`,color:C.gold,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      )}

      {/* Profile detail sheet */}
      {showProfile && <ProfileSheet p={showProfile} myMbti={myMbti} onClose={()=>setShowProfile(null)}
        onLike={()=>{doSwipe("like");setShowProfile(null);}}
        onSuperlike={()=>{doSwipe("superlike");setShowProfile(null);}}
        onChat={()=>{ setShowProfile(null); }}
      />}

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
