import { useState, useRef, useEffect } from "react";
import { C, sound, sb, updateProfile, uploadAvatar, uploadCover, uploadPhoto, deleteAccount, calcAge, calcCompletion, ETHNICITY, HOBBIES, reverseGeocode, searchCities, exportUserData } from "../utils";
import { Av } from "../components/Atoms";
import { ImageCropper } from "../components/ImageCropper";
import { MbtiSheet, MultiSelect, BottomSheet } from "../components/Modals";
import type { UserProfile, Lang } from "../types";
import { PremiumScreen } from "./PremiumScreen";
import { TermsScreen } from "./TermsScreen";

/* ─── Small reusable pieces ──────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return <div onClick={onChange} style={{ width:46,height:26,borderRadius:13,background:on?C.rose:"rgba(201,168,76,0.15)",position:"relative",transition:"background .25s",cursor:"pointer",flexShrink:0 }}>
    <div style={{ width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?23:3,transition:"left .25s",boxShadow:"0 1px 4px rgba(0,0,0,0.25)" }}/>
  </div>;
}
function SettingRow({ icon,label,sub,right,onClick,last }:{ icon:string;label:string;sub?:string;right?:React.ReactNode;onClick?:()=>void;last?:boolean }) {
  return <div onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",cursor:onClick?"pointer":"default",borderBottom:last?"none":`1px solid ${C.border}`,transition:"background .15s",minHeight:54 }} onMouseEnter={e=>onClick&&(e.currentTarget.style.background="rgba(255,255,255,0.03)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
    <div style={{ display:"flex",alignItems:"center",gap:13,flex:1,minWidth:0 }}>
      <span style={{ fontSize:18,width:22,textAlign:"center" as const,lineHeight:1 }}>{icon}</span>
      <div>
        <div style={{ fontSize:14,color:C.text,fontWeight:500,lineHeight:1.3 }}>{label}</div>
        {sub&&<div style={{ fontSize:11.5,color:C.textMuted,marginTop:2,lineHeight:1.4 }}>{sub}</div>}
      </div>
    </div>
    {right}
  </div>;
}
function SLabel({ children }:{ children:React.ReactNode }) {
  return <div style={{ fontSize:11,fontWeight:600,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10,marginTop:4 }}>{children}</div>;
}
const INP = { width:"100%",padding:"12px 14px",background:C.surf,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box" as const,transition:"border-color .2s" };

/* ─── City autocomplete ──────────────────────────────── */
function CityInput({ value,onChange,onSelect }:{ value:string;onChange:(v:string)=>void;onSelect:(city:string,lat:number,lon:number)=>void }) {
  const [res,setRes]=useState<{name:string;country:string;lat:number;lon:number}[]>([]);
  const [open,setOpen]=useState(false);
  const timer=useRef<any>(null);
  function handle(v:string){ onChange(v); clearTimeout(timer.current); if(v.length<2){setRes([]);setOpen(false);return;} timer.current=setTimeout(async()=>{const r=await searchCities(v);setRes(r);setOpen(r.length>0);},380); }
  return <div style={{ position:"relative" }}>
    <input value={value} onChange={e=>handle(e.target.value)} placeholder="輸入城市名稱..." style={INP} onFocus={e=>(e.target.style.borderColor=C.rose)} onBlur={e=>{e.target.style.borderColor=C.border;setTimeout(()=>setOpen(false),200);}}/>
    {open&&<div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(20,20,32,0.99)",backdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",zIndex:100,boxShadow:"0 16px 48px rgba(0,0,0,0.5)",animation:"dropDown .18s ease" }}>
      {res.map((r,i)=><div key={i} onMouseDown={()=>{onSelect(r.name,r.lat,r.lon);onChange(r.name);setOpen(false);}} style={{ padding:"12px 16px",cursor:"pointer",borderBottom:i<res.length-1?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background .12s" }} onMouseEnter={e=>(e.currentTarget.style.background=C.surf)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
        <span style={{ fontSize:14,color:C.text }}>📍 {r.name}</span>
        <span style={{ fontSize:12,color:C.textMuted }}>{r.country}</span>
      </div>)}
    </div>}
  </div>;
}

/* ─── Tag Chips ──────────────────────────────────────── */
function TagChips({ options,value,onChange,color=C.rose }:{ options:string[];value:string[];onChange:(v:string[])=>void;color?:string }) {
  return <div style={{ display:"flex",flexWrap:"wrap" as const,gap:8 }}>
    {options.map(o=>{const sel=value.includes(o);return<button key={o} onClick={()=>onChange(sel?value.filter(x=>x!==o):[...value,o])} style={{ padding:"6px 14px",borderRadius:20,background:sel?`${color}18`:"transparent",border:`1px solid ${sel?color:C.border}`,color:sel?color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?600:400,transition:"all .15s" }}>{o}</button>;})}
  </div>;
}

/* ─── Photo Grid ─────────────────────────────────────── */
function PhotoGrid({ photos,onAdd,onRemove,uploading }:{ photos:string[];onAdd:(f:File)=>void;onRemove:(i:number)=>void;uploading:boolean }) {
  const ref=useRef<HTMLInputElement>(null);
  return <div>
    <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{if(e.target.files?.[0])onAdd(e.target.files[0]);e.target.value="";}}/>
    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
      {photos.map((p,i)=><div key={i} style={{ position:"relative",aspectRatio:"1" }}>
        <img src={p} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" as const,borderRadius:12,border:`1px solid ${C.border}`,display:"block" }}/>
        <button onClick={()=>onRemove(i)} style={{ position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.72)",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
      </div>)}
      {photos.length<6&&<div onClick={()=>ref.current?.click()} style={{ aspectRatio:"1",borderRadius:12,border:`2px dashed ${C.border}`,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,transition:"all .2s" }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.rose;(e.currentTarget as HTMLElement).style.background=C.roseSoft;}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;(e.currentTarget as HTMLElement).style.background="transparent";}}>
        {uploading?<div style={{ width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.rose,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>:<><span style={{ fontSize:22,color:C.textMuted }}>+</span><span style={{ fontSize:10,color:C.textDim }}>新增</span></>}
      </div>}
    </div>
  </div>;
}

export function ProfileScreen({ profile,userId,onLogout,onUpdate }:{ profile:UserProfile;userId:string;onLogout:()=>void;onUpdate:(p:Partial<UserProfile>)=>void }) {
  const [activeTab,setActiveTab]=useState<"view"|"edit"|"settings">("view");
  const [name,setName]=useState(profile.display_name||profile.username);
  const [bio,setBio]=useState(profile.bio||"");
  const [birthday,setBirthday]=useState(profile.birthday||"");
  const [loc,setLoc]=useState(profile.location_text||"");
  const [ethnicity,setEthnicity]=useState<string[]>(profile.ethnicity||[]);
  const [hobbies,setHobbies]=useState<string[]>(profile.hobbies||[]);
  const [mbti,setMbti]=useState(profile.mbti||"INFP");
  const [gender,setGender]=useState<"male"|"female">(profile.gender||"male");
  const [lookingFor,setLookingFor]=useState(profile.looking_for_gender||"female");
  const [avatarUrl,setAvatarUrl]=useState(profile.avatar_url||"");
  const [coverUrl,setCoverUrl]=useState((profile as any).cover_url||"");
  const [photos,setPhotos]=useState<string[]>(profile.photos||[]);
  const [uploading,setUploading]=useState(false);
  const [showMbti,setShowMbti]=useState(false);
  const [showDelete,setShowDelete]=useState(false);
  const [soundOn,setSoundOn]=useState(sound.enabled);
  const [lang,setLang]=useState<Lang>((profile as any).language||"zh");
  const [hideOnline,setHideOnline]=useState((profile as any).hide_online_status||false);
  // Extended profile fields
  const [occupation,setOccupation]=useState((profile as any).occupation||"");
  const [education,setEducation]=useState((profile as any).education||"");
  const [income,setIncome]=useState((profile as any).income||"");
  const [heightCm,setHeightCm]=useState((profile as any).height_cm||"");
  const [drinking,setDrinking]=useState((profile as any).drinking||"");
  const [smoking,setSmoking]=useState((profile as any).smoking||"");
  const [exercise,setExercise]=useState((profile as any).exercise||"");
  const [hasPets,setHasPets]=useState((profile as any).has_pets||"");
  const [wantChildren,setWantChildren]=useState((profile as any).want_children||"");
  const [relGoal,setRelGoal]=useState((profile as any).relationship_goal||"");
  const [loveLanguage,setLoveLanguage]=useState((profile as any).love_language||"");
  const [saving,setSaving]=useState(false);
  const [stats,setStats]=useState({likesReceived:0,likesGiven:0,matches:0});
  useEffect(()=>{
    Promise.all([
      sb.from("swipes").select("id",{count:"exact",head:true}).eq("swiped_id",userId).in("direction",["like","superlike"]),
      sb.from("swipes").select("id",{count:"exact",head:true}).eq("swiper_id",userId).in("direction",["like","superlike"]),
      sb.from("matches").select("id",{count:"exact",head:true}).or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
    ]).then(([r,g,m])=>setStats({likesReceived:r.count||0,likesGiven:g.count||0,matches:m.count||0}));
  },[userId]);
  const [cropFile,setCropFile]=useState<{file:File;type:"avatar"|"cover"|"photo"}|null>(null);
  const [showPremium,setShowPremium]=useState(false);
  const [showTerms,setShowTerms]=useState<"terms"|"privacy"|null>(null);
  const [locating,setLocating]=useState(false);
  const avatarRef=useRef<HTMLInputElement>(null);
  const coverRef=useRef<HTMLInputElement>(null);
  const age=calcAge(birthday);
  const comp=calcCompletion({...profile,display_name:name,bio,birthday:birthday||null,location_text:loc||null,avatar_url:avatarUrl||null,hobbies,photos});

  function handleAvatar(file:File){setCropFile({file,type:"avatar"});}  async function doUploadAvatar(blob:Blob){setUploading(true);setCropFile(null);try{const f=new File([blob],"avatar.jpg",{type:"image/jpeg"});const url=await uploadAvatar(f,userId);setAvatarUrl(url);await updateProfile(userId,{avatar_url:url});onUpdate({avatar_url:url});}catch(e){console.error(e);}setUploading(false);}
  function handleCover(file:File){setCropFile({file,type:"cover"});}  async function doUploadCover(blob:Blob){setUploading(true);setCropFile(null);try{const f=new File([blob],"cover.jpg",{type:"image/jpeg"});const url=await uploadCover(f,userId);setCoverUrl(url);await updateProfile(userId,{cover_url:url} as any);onUpdate({cover_url:url} as any);}catch(e){console.error(e);}setUploading(false);}
  async function handlePhoto(file:File){if(photos.length>=6)return;setUploading(true);try{const url=await uploadPhoto(file,userId,photos.length);setPhotos(p=>[...p,url]);}catch(e){console.error(e);}setUploading(false);}
  async function save(){
    setSaving(true);
    const patch:Partial<UserProfile>={display_name:name,bio:bio||null,birthday:birthday||null,location_text:loc||null,ethnicity,hobbies,mbti,gender,looking_for_gender:lookingFor,avatar_url:avatarUrl||null,photos,...({occupation:occupation||null,education:education||null,income:income||null,height_cm:heightCm||null,drinking:drinking||null,smoking:smoking||null,exercise:exercise||null,has_pets:hasPets||null,want_children:wantChildren||null,relationship_goal:relGoal||null,love_language:loveLanguage||null} as any)};
    await updateProfile(userId,patch);
    // Reload full profile from DB so extended fields populate correctly
    const { data: refreshed } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (refreshed) onUpdate(refreshed as any);
    setActiveTab("view");setSaving(false);sound.pop();
  }
  async function handleLocate(){
    if(!navigator.geolocation){alert("你的瀏覽器不支援定位");return;}
    setLocating(true);
    try{
      const pos=await new Promise<GeolocationPosition>((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:10000,enableHighAccuracy:true}));
      const{city,country:detectedCountry}=await reverseGeocode(pos.coords.latitude,pos.coords.longitude);
      if(city)setLoc(city);
      await updateProfile(userId,{latitude:pos.coords.latitude,longitude:pos.coords.longitude,location_text:city||loc} as any);
    }catch(e:any){
      if(e.code===1)alert("請允許瀏覽器使用定位權限");
      else alert("定位失敗，請手動輸入城市");
    }
    setLocating(false);
  }

  return <div style={{ display:"flex",flexDirection:"column",height:"100%",background:C.bg,overflowY:"auto",animation:"tabSwitch .3s ease" }}>

    {/* ── COVER + AVATAR HEADER ── */}
    <div style={{ position:"relative",flexShrink:0 }}>
      {/* Cover */}
      <input ref={coverRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{if(e.target.files?.[0])handleCover(e.target.files[0]);}}/>
      <div style={{ height:220,background:coverUrl?`url(${coverUrl}) center/cover`:`linear-gradient(135deg,rgba(201,168,76,0.18) 0%,rgba(12,10,8,1) 100%)`,position:"relative",cursor:"pointer" }} onClick={()=>activeTab==="edit"&&coverRef.current?.click()}>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(12,10,8,0) 0%, rgba(12,10,8,0) 40%, rgba(12,10,8,0.6) 70%, rgba(12,10,8,1) 100%)" }}/>
        {/* Top-right buttons */}
        {activeTab==="view"&&<div style={{ position:"absolute",top:14,right:14,display:"flex",gap:8,zIndex:5 }}>
          <button onClick={()=>setActiveTab("edit")} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(12,10,8,0.65)",backdropFilter:"blur(12px)",border:`1px solid rgba(255,255,255,0.12)`,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button onClick={()=>setActiveTab("settings")} style={{ width:40,height:40,borderRadius:"50%",background:"rgba(12,10,8,0.65)",backdropFilter:"blur(12px)",border:`1px solid rgba(255,255,255,0.12)`,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>}
      </div>

      {/* Avatar — overlapping cover bottom */}
      <div style={{ position:"absolute",bottom:-38,left:18 }}>
        <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{if(e.target.files?.[0])handleAvatar(e.target.files[0]);}}/>
        <div style={{ position:"relative",cursor:"pointer" }} onClick={()=>avatarRef.current?.click()}>
          <div style={{ width:88,height:88,borderRadius:"50%",border:`3px solid ${C.gold}`,overflow:"hidden",background:C.bgCard }}>
            {avatarUrl?<img src={avatarUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" as const }}/>:<div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:C.textMuted }}>👤</div>}
          </div>
          <div style={{ position:"absolute",bottom:2,right:2,width:26,height:26,borderRadius:"50%",background:C.bgCard,border:`2px solid ${C.bg}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          {uploading&&<div style={{ position:"absolute",inset:0,borderRadius:"50%",background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ width:18,height:18,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite" }}/></div>}
        </div>
      </div>
    </div>

    {/* ── NAME + INFO ── */}
    <div style={{ marginTop:54,padding:"0 18px 0" }}>
      <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:3 }}>
        <span style={{ fontSize:22,fontWeight:800,color:C.text }}>{name}</span>
        {profile.is_verified&&<svg width="18" height="18" viewBox="0 0 24 24" fill={C.gold}><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z"/></svg>}
      </div>
      {/* Age · occupation · city */}
      {(age||occupation||loc)&&<div style={{ fontSize:13.5,color:C.textMuted,marginBottom:4 }}>
        {[age?`${age} 歲`:null, occupation||null, loc||null].filter(Boolean).join(" · ")}
      </div>}
      {loc&&<div style={{ fontSize:13,color:C.textMuted,marginBottom:12,display:"flex",alignItems:"center",gap:4 }}>
        <span>📍</span><span>{loc}</span>
      </div>}
      {/* MBTI / gender / premium chips */}
      <div style={{ display:"flex",gap:7,marginBottom:18,flexWrap:"wrap" as const }}>
        <span style={{ padding:"5px 13px",borderRadius:20,background:"rgba(232,54,93,0.13)",border:"1px solid rgba(232,54,93,0.3)",fontSize:12.5,color:C.rose,fontWeight:600 }}>✦ {mbti}</span>
        <span style={{ padding:"5px 13px",borderRadius:20,background:C.surf,border:`1px solid ${C.border}`,fontSize:12.5,color:C.textSub }}>{gender==="male"?"♂ 男性":"♀ 女性"}</span>
        <span style={{ padding:"5px 13px",borderRadius:20,background:C.goldSoft,border:`1px solid ${C.borderHigh}`,fontSize:12.5,color:C.gold,fontWeight:600 }}>👑 Premium</span>
      </div>
    </div>
    <div style={{ padding:"0 18px 48px" }}>
      {/* ── VIEW ── */}
      {activeTab==="view"&&<>
        {/* ─ About Me card ─ */}
        {(() => {
          const edu: Record<string,string> = { high_school:"高中",college:"大專",bachelor:"本科",master:"碩士",phd:"博士" };
          const incomeLabel = income==="<20"?"20萬以下":income===">100"?"100萬+":income?`${income}萬`:"不透露";
          const aboutItems = [
            birthday && { icon:"🎂", label: birthday },
            heightCm && { icon:"📐", label: `${heightCm} cm` },
            occupation && { icon:"💼", label: occupation },
            education && { icon:"🎓", label: edu[education]||education },
            income && { icon:"💵", label: incomeLabel },
          ].filter(Boolean) as {icon:string;label:string}[];
          const lifeItems = [
            drinking && drinking!=="never" && { icon:"🍷", label: drinking==="sometimes"?"偶爾喝酒":"常喝酒" },
            smoking && smoking!=="never" && { icon:"🚭", label: smoking==="sometimes"?"偶爾抽菸":"常抽菸" },
            smoking && smoking==="never" && { icon:"🚭", label: "不抽菸" },
            exercise && exercise!=="never" && { icon:"🏃", label: exercise==="sometimes"?"偶爾運動":exercise==="weekly"?"每週運動":"每天運動" },
            hasPets && hasPets!=="none" && { icon:"🐾", label: hasPets==="cat"?"有養貓":hasPets==="dog"?"有養狗":"有寵物" },
          ].filter(Boolean) as {icon:string;label:string}[];
          const hobbyBg: Record<string,string> = {
            "旅行":"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=60",
            "音樂":"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=60",
            "電影":"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&q=60",
            "閱讀":"https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&q=60",
            "運動":"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&q=60",
            "美食":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=60",
            "遊戲":"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&q=60",
            "攝影":"https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&q=60",
            "藝術":"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&q=60",
            "健身":"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&q=60",
            "瑜伽":"https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&q=60",
            "舞蹈":"https://images.unsplash.com/photo-1547153760-18fc86324498?w=200&q=60",
            "寵物":"https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&q=60",
            "烹飪":"https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200&q=60",
            "戶外":"https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=200&q=60",
            "咖啡":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=60",
            "科技":"https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=60",
            "時尚":"https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=60",
            "語言":"https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=200&q=60",
            "電競":"https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=200&q=60",
          };
          return <>
            {/* Stats card */}
            <div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,display:"flex",marginBottom:14,overflow:"hidden" }}>
              {[
                {icon:"❤️",val:stats.likesReceived,label:"喜歡我"},
                {icon:"💬",val:stats.likesGiven,label:"我喜歡"},
                {icon:"👥",val:stats.matches,label:"我的配對"},
              ].map((s,i)=>(
                <div key={s.label} style={{ flex:1,textAlign:"center" as const,padding:"18px 0",borderRight:i<2?`1px solid ${C.border}`:"none" }}>
                  <div style={{ fontSize:22,fontWeight:800,color:C.text,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                    <span style={{ fontSize:16 }}>{s.icon}</span>{s.val}
                  </div>
                  <div style={{ fontSize:11.5,color:C.textMuted,marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Completion card */}
            <div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,padding:"16px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:14,cursor:"pointer" }} onClick={()=>setActiveTab("edit")}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                  <span style={{ fontSize:14,color:C.text,fontWeight:600 }}>資料完整度</span>
                  <span style={{ fontSize:14,color:comp>=80?C.mint:C.gold,fontWeight:700 }}>{comp}%</span>
                </div>
                <div style={{ height:5,background:"rgba(255,255,255,0.06)",borderRadius:3 }}>
                  <div style={{ height:"100%",width:`${comp}%`,background:comp>=80?C.gradMint:C.grad,borderRadius:3,transition:"width .8s" }}/>
                </div>
                {comp<80&&<div style={{ fontSize:12,color:C.textMuted,marginTop:8 }}>補充更多資料，讓你更容易被喜歡！</div>}
              </div>
              <span style={{ fontSize:18,color:C.textMuted }}>›</span>
            </div>

            {/* About me card */}
            {aboutItems.length>0&&<div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,padding:"16px 18px",marginBottom:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:15,fontWeight:700,color:C.text }}>關於我</span>
                <button onClick={()=>setActiveTab("edit")} style={{ background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>編輯</button>
              </div>
              <div style={{ display:"flex",gap:0,overflowX:"auto" as const }}>
                {aboutItems.map((item,i)=>(
                  <div key={i} style={{ flex:"0 0 auto",textAlign:"center" as const,padding:"0 14px",borderRight:i<aboutItems.length-1?`1px solid ${C.border}`:"none",minWidth:0 }}>
                    <div style={{ fontSize:22,marginBottom:6 }}>{item.icon}</div>
                    <div style={{ fontSize:12,color:C.textSub,whiteSpace:"nowrap" as const,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Life style card */}
            {lifeItems.length>0&&<div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,padding:"16px 18px",marginBottom:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:15,fontWeight:700,color:C.text }}>我的生活方式</span>
                <button onClick={()=>setActiveTab("edit")} style={{ background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>編輯</button>
              </div>
              <div style={{ display:"flex",flexWrap:"wrap" as const,gap:14 }}>
                {lifeItems.map((item,i)=>(
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ fontSize:16 }}>{item.icon}</span>
                    <span style={{ fontSize:13,color:C.textSub }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>}

            {/* Hobbies card */}
            {hobbies.length>0&&<div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,padding:"16px 18px",marginBottom:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:15,fontWeight:700,color:C.text }}>興趣愛好</span>
                <button onClick={()=>setActiveTab("edit")} style={{ background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>編輯</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6 }}>
                {hobbies.slice(0,5).map(h=>(
                  <div key={h} style={{ position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden",background:`url(${hobbyBg[h]||""}) center/cover`,backgroundColor:"#2A2218" }}>
                    <div style={{ position:"absolute",inset:0,background:"linear-gradient(transparent 40%,rgba(0,0,0,0.72))" }}/>
                    <div style={{ position:"absolute",bottom:5,left:0,right:0,textAlign:"center" as const,fontSize:11,color:"#fff",fontWeight:600,letterSpacing:".2px" }}>{h}</div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Logout + Delete */}
            <button onClick={onLogout} style={{ width:"100%",padding:"15px",borderRadius:14,background:"transparent",border:`1px solid rgba(232,54,93,0.35)`,color:C.rose,fontFamily:"inherit",fontSize:15,fontWeight:600,cursor:"pointer",marginTop:8,transition:"all .2s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,54,93,0.07)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>登出帳號</button>
            <button onClick={()=>setShowDelete(true)} style={{ width:"100%",padding:"11px",borderRadius:14,background:"transparent",border:"none",color:C.textDim,fontFamily:"inherit",fontSize:13,cursor:"pointer",marginTop:4 }}>刪除帳號</button>
          </>;
        })()}
      </>}
      {/* ── EDIT ── */}
      {activeTab==="edit"&&<>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:28 }}>
          <button onClick={()=>setActiveTab("view")} style={{ background:"none",border:"none",color:C.textMuted,fontSize:22,cursor:"pointer",fontFamily:"inherit",lineHeight:1 }}>‹</button>
          <div style={{ fontSize:18,fontWeight:700,color:C.text }}>編輯資料</div>
        </div>
        <SLabel>基本資料</SLabel>
        <div style={{ display:"flex",flexDirection:"column",gap:12,marginBottom:28 }}>
          <div><div style={{ fontSize:11,color:C.textMuted,marginBottom:7,letterSpacing:.5,textTransform:"uppercase" as const }}>顯示名稱</div><input value={name} onChange={e=>setName(e.target.value)} style={INP} onFocus={e=>(e.target.style.borderColor=C.rose)} onBlur={e=>(e.target.style.borderColor=C.border)}/></div>
          <div><div style={{ fontSize:11,color:C.textMuted,marginBottom:7,letterSpacing:.5,textTransform:"uppercase" as const }}>生日</div><input value={birthday} onChange={e=>setBirthday(e.target.value)} type="date" style={{ ...INP,colorScheme:"dark" } as any} onFocus={e=>(e.target.style.borderColor=C.rose)} onBlur={e=>(e.target.style.borderColor=C.border)}/></div>
          <div><div style={{ fontSize:11,color:C.textMuted,marginBottom:7,letterSpacing:.5,textTransform:"uppercase" as const }}>所在城市</div>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ flex:1 }}><CityInput value={loc} onChange={setLoc} onSelect={(city,lat,lon)=>{setLoc(city);updateProfile(userId,{latitude:lat,longitude:lon});}}/></div>
              <button onClick={handleLocate} disabled={locating} style={{ padding:"12px 14px",borderRadius:12,background:C.roseSoft,border:`1px solid rgba(232,54,93,0.22)`,color:C.rose,cursor:"pointer",fontFamily:"inherit",fontSize:14,flexShrink:0,opacity:locating?.6:1 }} title="GPS定位">{locating?"⏳":"📍"}</button>
            </div>
          </div>
          <div><div style={{ fontSize:11,color:C.textMuted,marginBottom:7,letterSpacing:.5,textTransform:"uppercase" as const }}>個人簡介</div><textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="介紹一下自己，讓更多人認識你..." rows={3} style={{ ...INP,resize:"none" }} onFocus={e=>(e.target.style.borderColor=C.rose)} onBlur={e=>(e.target.style.borderColor=C.border)}/></div>
        </div>
        <SLabel>MBTI</SLabel>
        <button onClick={()=>setShowMbti(true)} style={{ width:"100%",padding:"12px 14px",borderRadius:12,background:C.surf,border:`1px solid ${C.border}`,color:C.text,fontFamily:"inherit",fontSize:14,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28,transition:"border-color .2s" }} onMouseEnter={e=>(e.currentTarget.style.borderColor=C.borderFocus)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
          <span>✦ {mbti}</span><span style={{ color:C.textMuted,fontSize:10 }}>▼</span>
        </button>
        <SLabel>我的性別</SLabel>
        <div style={{ display:"flex",gap:10,marginBottom:28 }}>
          {(["male","female"] as const).map(g=><button key={g} onClick={()=>setGender(g)} style={{ flex:1,padding:"11px",borderRadius:12,background:gender===g?C.roseSoft:"transparent",border:`1px solid ${gender===g?C.rose:C.border}`,color:gender===g?C.rose:C.textSub,fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:gender===g?600:400,transition:"all .15s" }}>{g==="male"?"♂ 男性":"♀ 女性"}</button>)}
        </div>
        <SLabel>尋找對象</SLabel>
        <div style={{ display:"flex",gap:10,marginBottom:28 }}>
          {["female","male","both"].map(g=><button key={g} onClick={()=>setLookingFor(g)} style={{ flex:1,padding:"11px",borderRadius:12,background:lookingFor===g?C.roseSoft:"transparent",border:`1px solid ${lookingFor===g?C.rose:C.border}`,color:lookingFor===g?C.rose:C.textSub,fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:lookingFor===g?600:400,transition:"all .15s" }}>{g==="female"?"女性":g==="male"?"男性":"全部"}</button>)}
        </div>
        <SLabel>族裔背景</SLabel>
        <div style={{ marginBottom:28 }}><TagChips options={ETHNICITY} value={ethnicity} onChange={setEthnicity} color={C.rose}/></div>
        <SLabel>興趣愛好</SLabel>
        <div style={{ marginBottom:28 }}><TagChips options={HOBBIES} value={hobbies} onChange={setHobbies} color={C.mint}/></div>
        <SLabel>相片（最多6張）</SLabel>
        <div style={{ marginBottom:32 }}><PhotoGrid photos={photos} onAdd={handlePhoto} onRemove={i=>setPhotos(ps=>ps.filter((_,j)=>j!==i))} uploading={uploading}/></div>

        {/* ── Extended profile ── */}
        <div style={{ borderTop:`1px solid ${C.border}`,paddingTop:24,marginBottom:8 }}>
          <SLabel>基本資訊</SLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:12,marginBottom:24 }}>
            <div>
              <div style={{ fontSize:12,color:C.textMuted,marginBottom:5 }}>職業</div>
              <input value={occupation} onChange={e=>setOccupation(e.target.value)} placeholder="設計師、工程師、學生..." style={{ ...INP,width:"100%",boxSizing:"border-box" as const }}/>
            </div>
            <div>
              <div style={{ fontSize:12,color:C.textMuted,marginBottom:5 }}>學歷</div>
              <select value={education} onChange={e=>setEducation(e.target.value)} style={{ ...INP,width:"100%",boxSizing:"border-box" as const,appearance:"none" as const }}>
                <option value="">選擇學歷</option>
                <option value="high_school">高中 / 中專</option>
                <option value="college">大專</option>
                <option value="bachelor">本科</option>
                <option value="master">碩士</option>
                <option value="phd">博士</option>
              </select>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,color:C.textMuted,marginBottom:5 }}>身高 (cm)</div>
                <input type="number" value={heightCm} onChange={e=>setHeightCm(e.target.value)} placeholder="170" style={{ ...INP,width:"100%",boxSizing:"border-box" as const }}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,color:C.textMuted,marginBottom:5 }}>年收入（選填）</div>
                <select value={income} onChange={e=>setIncome(e.target.value)} style={{ ...INP,width:"100%",boxSizing:"border-box" as const,appearance:"none" as const }}>
                  <option value="">不透露</option>
                  <option value="<20">20萬以下</option>
                  <option value="20-50">20–50萬</option>
                  <option value="50-100">50–100萬</option>
                  <option value=">100">100萬以上</option>
                </select>
              </div>
            </div>
          </div>

          <SLabel>生活方式</SLabel>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24 }}>
            {([
              {label:"飲酒",val:drinking,set:setDrinking,opts:[["never","不喝"],["sometimes","偶爾"],["often","常喝"]]},
              {label:"抽煙",val:smoking,set:setSmoking,opts:[["never","不抽"],["sometimes","偶爾"],["often","常抽"]]},
              {label:"運動",val:exercise,set:setExercise,opts:[["never","從不"],["sometimes","偶爾"],["weekly","每週"],["daily","每天"]]},
              {label:"寵物",val:hasPets,set:setHasPets,opts:[["none","無"],["cat","貓"],["dog","狗"],["other","其他"]]},
            ] as any[]).map(({label,val,set,opts})=>(
              <div key={label}>
                <div style={{ fontSize:12,color:C.textMuted,marginBottom:5 }}>{label}</div>
                <select value={val} onChange={(e:any)=>set(e.target.value)} style={{ ...INP,width:"100%",boxSizing:"border-box" as const,appearance:"none" as const,fontSize:13 }}>
                  <option value="">未填</option>
                  {opts.map(([v,l]:string[])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>

          <SLabel>感情觀</SLabel>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12,color:C.textMuted,marginBottom:8 }}>尋找關係</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" as const }}>
              {[["serious","認真交往"],["friends_first","先朋友再說"],["casual","隨緣"],["open","開放"]].map(([v,l])=>(
                <button key={v} onClick={()=>setRelGoal(relGoal===v?"":v)}
                  style={{ padding:"7px 14px",borderRadius:20,border:`1px solid ${relGoal===v?C.gold:C.border}`,background:relGoal===v?C.goldSoft:"transparent",color:relGoal===v?C.gold:C.textSub,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12,color:C.textMuted,marginBottom:8 }}>想要孩子？</div>
            <div style={{ display:"flex",gap:8 }}>
              {[["yes","想要"],["no","不想"],["undecided","未決定"]].map(([v,l])=>(
                <button key={v} onClick={()=>setWantChildren(wantChildren===v?"":v)}
                  style={{ padding:"7px 14px",borderRadius:20,border:`1px solid ${wantChildren===v?C.gold:C.border}`,background:wantChildren===v?C.goldSoft:"transparent",color:wantChildren===v?C.gold:C.textSub,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12,color:C.textMuted,marginBottom:8 }}>戀愛語言</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" as const }}>
              {[["words","肯定言語"],["time","精心時刻"],["acts","服務行為"],["touch","肢體接觸"],["gifts","送禮"]].map(([v,l])=>(
                <button key={v} onClick={()=>setLoveLanguage(loveLanguage===v?"":v)}
                  style={{ padding:"7px 14px",borderRadius:20,border:`1px solid ${loveLanguage===v?C.rose:C.border}`,background:loveLanguage===v?C.roseSoft:"transparent",color:loveLanguage===v?C.rose:C.textSub,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={()=>setActiveTab("view")} style={{ flex:1,padding:"13px",borderRadius:14,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>取消</button>
          <button onClick={save} disabled={saving} style={{ flex:2,padding:"13px",borderRadius:14,background:C.grad,border:"none",color:"#fff",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",opacity:saving?.7:1,boxShadow:`0 4px 16px ${C.roseGlow}` }}>{saving?"儲存中...":"儲存"}</button>
        </div>
      </>}

      {/* ── SETTINGS ── */}
      {activeTab==="settings"&&<>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:28 }}>
          <button onClick={()=>setActiveTab("view")} style={{ background:"none",border:"none",color:C.textMuted,fontSize:22,cursor:"pointer",fontFamily:"inherit",lineHeight:1 }}>‹</button>
          <div style={{ fontSize:18,fontWeight:700,color:C.text }}>設定</div>
        </div>
        <div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:20 }}>
          <SettingRow icon="🔊" label="音效" right={<Toggle on={soundOn} onChange={()=>{sound.enabled=!sound.enabled;setSoundOn(s=>!s);}}/>}/>
          <SettingRow icon="🌐" label="語言" right={<div style={{ display:"flex",gap:6 }}>
            {(["zh","en"] as Lang[]).map(l=><button key={l} onClick={()=>{setLang(l);updateProfile(userId,{language:l} as any);sound.tap();}} style={{ padding:"5px 13px",borderRadius:20,background:lang===l?C.grad:"transparent",border:`1px solid ${lang===l?"transparent":C.border}`,color:lang===l?"#fff":C.textMuted,fontFamily:"inherit",fontSize:12,fontWeight:lang===l?600:400,cursor:"pointer" }}>{l==="zh"?"中文":"EN"}</button>)}
          </div>}/>
          <SettingRow icon="👁️" label="隱藏在線狀態" sub="開啟後你也看不到其他人的在線狀態" right={<Toggle on={hideOnline} onChange={()=>{const v=!hideOnline;setHideOnline(v);updateProfile(userId,{hide_online_status:v} as any);onUpdate({hide_online_status:v} as any);}}/>}/>
          <SettingRow icon="🔔" label="推播通知" sub="打包 iOS 後開放" right={<span style={{ fontSize:11.5,color:C.textDim }}>即將推出</span>}/>
          <SettingRow icon="😴" label="暫停帳號" sub="暫停後你不會出現在探索頁" right={<Toggle on={(profile as any).is_paused||false} onChange={()=>{const v=!((profile as any).is_paused||false);updateProfile(userId,{is_paused:v} as any);onUpdate({is_paused:v} as any);sound.tap();}}/>}/>
          <SettingRow icon="👑" label="升級 Premium" right={<span style={{ fontSize:12,color:C.rose,fontWeight:700 }}>解鎖全部功能</span>} onClick={()=>setShowPremium(true)}/>
          <SettingRow icon="📜" label="隱私政策" right={<span style={{ fontSize:16,color:C.textMuted }}>›</span>} onClick={()=>setShowTerms("privacy")}/>
          <SettingRow icon="📋" label="服務條款" right={<span style={{ fontSize:16,color:C.textMuted }}>›</span>} onClick={()=>setShowTerms("terms")} last/>
        </div>
        <div style={{ background:C.bgCard,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:28 }}>
          <SettingRow icon="📦" label="導出我的數據" sub="下載你的所有資料（JSON）" right={<span style={{ fontSize:14,color:C.textMuted }}>›</span>} onClick={async()=>{await exportUserData(userId);}}/>
          <SettingRow icon="✦" label="關於 NYX" right={<span style={{ fontSize:12,color:C.textMuted }}>v1.0.0</span>} last/>
        </div>
        <button onClick={onLogout} style={{ width:"100%",padding:"15px",borderRadius:14,background:"transparent",border:`1px solid rgba(232,54,93,0.35)`,color:C.rose,fontFamily:"inherit",fontSize:15,fontWeight:600,cursor:"pointer",marginBottom:8,transition:"all .2s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,54,93,0.07)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>登出帳號</button>
        <button onClick={()=>setShowDelete(true)} style={{ width:"100%",padding:"11px",borderRadius:14,background:"transparent",border:"none",color:C.textDim,fontFamily:"inherit",fontSize:13,cursor:"pointer" }}>刪除帳號</button>
      </>}
    </div>

    {cropFile&&<ImageCropper
    file={cropFile.file}
    aspectRatio={cropFile.type==="cover"?2.5:1}
    shape={cropFile.type==="avatar"?"circle":"rect"}
    onConfirm={blob=>{if(cropFile.type==="avatar")doUploadAvatar(blob);else if(cropFile.type==="cover")doUploadCover(blob);}}
    onCancel={()=>setCropFile(null)}
  />}
  {showPremium&&<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg}}><PremiumScreen onBack={()=>setShowPremium(false)}/></div>}
  {showTerms&&<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg}}><TermsScreen onBack={()=>setShowTerms(null)} type={showTerms}/></div>}
  {showMbti&&<MbtiSheet mbti={mbti} onSelect={m=>setMbti(m)} onClose={()=>setShowMbti(false)}/>}
    {showDelete&&<BottomSheet onClose={()=>setShowDelete(false)}>
      <div style={{ padding:"20px 24px 52px",textAlign:"center" }}>
        <div style={{ fontSize:38,marginBottom:16 }}>⚠️</div>
        <div style={{ fontSize:18,fontWeight:700,color:C.text,marginBottom:10 }}>確定刪除帳號？</div>
        <div style={{ fontSize:14,color:C.textMuted,lineHeight:1.65,marginBottom:28 }}>所有資料、配對、對話將永久刪除，無法復原。</div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={()=>setShowDelete(false)} style={{ flex:1,padding:"13px",borderRadius:14,background:C.surf,border:`1px solid ${C.border}`,color:C.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer" }}>取消</button>
          <button onClick={()=>deleteAccount(userId)} style={{ flex:1,padding:"13px",borderRadius:14,background:"rgba(255,60,60,0.12)",border:"1px solid rgba(255,60,60,0.28)",color:"#FF6B6B",fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer" }}>確定刪除</button>
        </div>
      </div>
    </BottomSheet>}
  </div>;
}
