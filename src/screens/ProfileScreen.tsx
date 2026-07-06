import { useState, useRef, useEffect } from "react";
import { C, sound, sb, updateProfile, uploadAvatar, uploadCover, uploadPhoto, deleteAccount, calcAge, calcCompletion, ETHNICITY, HOBBIES, reverseGeocode, searchCities, exportUserData } from "../utils";
import { Av } from "../components/Atoms";
import { ImageCropper } from "../components/ImageCropper";
import { MbtiSheet, MultiSelect, BottomSheet } from "../components/Modals";
import type { UserProfile, Lang, WhoLikedItem } from "../types";
import { getWhoLikedMe } from "../utils";
import { PremiumScreen } from "./PremiumScreen";
import { TermsScreen } from "./TermsScreen";

/* ── SVG Icons (Lucide outline, 20×20) ── */
const IC: Record<string,string> = {
  heart:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  star:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  users:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  calendar:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  ruler:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  graduation:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  wallet:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
  nosmoking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M9 9H3v6h6"/><path d="M12 12h9v3"/><path d="M16.5 9c0 0 1.5-2 1.5-3.5a2 2 0 0 0-4 0"/></svg>`,
  smoking:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h9v3H3z"/><path d="M15 12h3v3h-3z"/><path d="M18 15v-2"/><path d="M17 7c0 0 1-1 1-2a2 2 0 0 0-4 0"/></svg>`,
  paw:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10l-1 7 4 2 4-2-1-7"/><path d="M2 19c0-3 1.5-5 5-5"/></svg>`,
  dumbbell:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 10l3.5-3.5M3 14l3.5 3.5M21 10l-3.5-3.5M21 14l-3.5 3.5"/></svg>`,
  wine:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M17 2H7l-2 8a5 5 0 0 0 10 0l-2-8"/></svg>`,
  volume:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  globe:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  eye:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  bell:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  moon:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  crown:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>`,
  shield:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  scroll:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  box:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  info:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  user:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  image:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  pencil:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  gear:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  camera:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  chevron:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  question:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  chat:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};
function Si({ n, s=18, c="currentColor" }: { n: string; s?: number; c?: string }) {
  const raw = IC[n] || IC.info;
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:s,height:s,color:c,flexShrink:0 }}
    dangerouslySetInnerHTML={{ __html: raw.replace(/viewBox/g,`width="${s}" height="${s}" viewBox`).replace(/stroke="currentColor"/g,`stroke="${c}"`) }}/>;
}

/* ── Reusable components ── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return <div onClick={onChange} style={{ width:46,height:26,borderRadius:13,background:on?"#e8365d":"rgba(255,255,255,0.08)",position:"relative",transition:"background .25s",cursor:"pointer",flexShrink:0 }}>
    <div style={{ width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?23:3,transition:"left .25s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}/>
  </div>;
}

/* Edit page row */
function EditRow({ icon, label, value, right, onClick, last }: { icon: string; label: string; value?: string; right?: React.ReactNode; onClick?: () => void; last?: boolean }) {
  return (
    <div onClick={onClick} style={{ display:"flex",alignItems:"center",padding:"14px 0",borderBottom:`1px solid ${C.border}`,cursor:onClick?"pointer":"default" }}>
      <Si n={icon} s={18} c={C.textMuted}/>
      <span style={{ flex:1,fontSize:14,color:C.text,marginLeft:14,fontWeight:500 }}>{label}</span>
      {value && <span style={{ fontSize:14,color:C.textMuted,marginRight:8 }}>{value}</span>}
      {right}
      {onClick && <Si n="chevron" s={16} c={C.textMuted}/>}
    </div>
  );
}

function SettingRow({ icon, label, sub, right, onClick, last }: { icon: string; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; last?: boolean }) {
  return <div onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 18px",cursor:onClick?"pointer":"default",borderBottom:last?"none":`1px solid ${C.border}`,transition:"background .15s",minHeight:52 }}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.background="rgba(255,255,255,0.025)")}
    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
    <div style={{ display:"flex",alignItems:"center",gap:13,flex:1,minWidth:0 }}>
      <Si n={icon} s={18} c={C.textMuted}/>
      <div>
        <div style={{ fontSize:14,color:C.text,fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>{sub}</div>}
      </div>
    </div>
    {right}
  </div>;
}

const INP = { width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box" as const,transition:"border-color .2s" };

function CityInput({ value, onChange, onSelect }: { value: string; onChange: (v: string) => void; onSelect: (city: string, lat: number, lon: number) => void }) {
  const [res, setRes] = useState<{ name: string; country: string; lat: number; lon: number }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<any>(null);
  function handle(v: string) { onChange(v); clearTimeout(timer.current); if (v.length < 2) { setRes([]); setOpen(false); return; } timer.current = setTimeout(async () => { const r = await searchCities(v); setRes(r); setOpen(r.length > 0); }, 380); }
  return <div style={{ position: "relative" }}>
    <input value={value} onChange={e => handle(e.target.value)} placeholder="輸入城市名稱..." style={INP} onFocus={e => (e.target.style.borderColor = C.rose)} onBlur={e => { e.target.style.borderColor = C.border; setTimeout(() => setOpen(false), 200); }} />
    {open && <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "rgba(20,18,14,0.99)", backdropFilter: "blur(24px)", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", zIndex: 100, boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
      {res.map((r, i) => <div key={i} onMouseDown={() => { onSelect(r.name, r.lat, r.lon); onChange(r.name); setOpen(false); }} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: i < res.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }} onMouseEnter={e => (e.currentTarget.style.background = C.surf)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        <span style={{ fontSize: 14, color: C.text }}>📍 {r.name}</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>{r.country}</span>
      </div>)}
    </div>}
  </div>;
}

function PhotoGrid({ photos, onAdd, onRemove, uploading }: { photos: string[]; onAdd: (f: File) => void; onRemove: (i: number) => void; uploading: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return <div>
    <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) onAdd(e.target.files[0]); e.target.value = ""; }} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      {photos.map((p, i) => <div key={i} style={{ position: "relative", aspectRatio: "1" }}>
        <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" as const, borderRadius: 12, border: `1px solid ${C.border}`, display: "block" }} />
        <button onClick={() => onRemove(i)} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.72)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>)}
      {photos.length < 6 && <div onClick={() => ref.current?.click()} style={{ aspectRatio: "1", borderRadius: 12, border: `2px dashed ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.rose; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
        {uploading ? <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.rose, borderRadius: "50%", animation: "spin .7s linear infinite" }} /> : <><span style={{ fontSize: 22, color: C.textMuted }}>+</span><span style={{ fontSize: 10, color: C.textDim }}>新增</span></>}
      </div>}
    </div>
  </div>;
}

export function ProfileScreen({ profile, userId, onLogout, onUpdate, onOpenChat }: { profile: UserProfile; userId: string; onLogout: () => void; onUpdate: (p: Partial<UserProfile>) => void; onOpenChat?: (matchId: string, otherId: string, name: string, avatar: string) => void }) {
  const [activeTab, setActiveTab] = useState<"view" | "edit" | "settings">("view");
  const [name, setName] = useState(profile.display_name || profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [birthday, setBirthday] = useState(profile.birthday || "");
  const [loc, setLoc] = useState(profile.location_text || "");
  const [ethnicity, setEthnicity] = useState<string[]>(profile.ethnicity || []);
  const [hobbies, setHobbies] = useState<string[]>(profile.hobbies || []);
  const [mbti, setMbti] = useState(profile.mbti || "INFP");
  const [gender, setGender] = useState<"male" | "female">(profile.gender || "male");
  const [lookingFor, setLookingFor] = useState(profile.looking_for_gender || "female");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState((profile as any).cover_url || "");
  const [photos, setPhotos] = useState<string[]>(profile.photos || []);
  const [uploading, setUploading] = useState(false);
  const [showMbti, setShowMbti] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [lang, setLang] = useState<Lang>((profile as any).language || "zh");
  const [hideOnline, setHideOnline] = useState((profile as any).hide_online_status || false);
  const [occupation, setOccupation] = useState((profile as any).occupation || "");
  const [education, setEducation] = useState((profile as any).education || "");
  const [income, setIncome] = useState((profile as any).income || "");
  const [heightCm, setHeightCm] = useState((profile as any).height_cm || "");
  const [drinking, setDrinking] = useState((profile as any).drinking || "");
  const [smoking, setSmoking] = useState((profile as any).smoking || "");
  const [exercise, setExercise] = useState((profile as any).exercise || "");
  const [hasPets, setHasPets] = useState((profile as any).has_pets || "");
  const [wantChildren, setWantChildren] = useState((profile as any).want_children || "");
  const [relGoal, setRelGoal] = useState((profile as any).relationship_goal || "");
  const [loveLanguage, setLoveLanguage] = useState((profile as any).love_language || "");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ likesReceived: 0, likesGiven: 0, matches: 0 });
  const [statsPanel, setStatsPanel] = useState<"liked_me"|"i_liked"|"matches"|null>(null);
  const [whoLikedMe, setWhoLikedMe] = useState<WhoLikedItem[]>([]);
  const [iLiked, setILiked] = useState<WhoLikedItem[]>([]);
  const [myMatches, setMyMatches] = useState<{matchId:string;userId:string;name:string;avatar:string;mbti:string;age:number|null;lastMsg:string}[]>([]);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cropFile, setCropFile] = useState<{ file: File; type: "avatar" | "cover" | "photo" } | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showTerms, setShowTerms] = useState<"terms" | "privacy" | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [editField, setEditField] = useState<string|null>(null);
  const [editText, setEditText] = useState("");
  const age = calcAge(birthday);
  const comp = calcCompletion({ ...profile, display_name: name, bio, birthday: birthday || null, location_text: loc || null, avatar_url: avatarUrl || null, hobbies, photos });

  useEffect(() => {
    Promise.all([
      sb.from("swipes").select("id", { count: "exact", head: true }).eq("swiped_id", userId).in("direction", ["like", "superlike"]),
      sb.from("swipes").select("id", { count: "exact", head: true }).eq("swiper_id", userId).in("direction", ["like", "superlike"]),
      sb.from("matches").select("id", { count: "exact", head: true }).or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
    ]).then(([r, g, m]) => setStats({ likesReceived: r.count || 0, likesGiven: g.count || 0, matches: m.count || 0 }));
  }, [userId]);

  async function openStatsPanel(panel: "liked_me"|"i_liked"|"matches") {
    setStatsPanel(panel);
    setLoadingPanel(true);

    // Get matched user IDs to exclude from both lists
    const { data: matchedRows } = await sb.from("matches")
      .select("user1_id,user2_id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    const matchedIds = new Set((matchedRows||[]).map((m: any) =>
      m.user1_id === userId ? m.user2_id : m.user1_id
    ));

    if (panel === "liked_me") {
      // 別人喜歡我，但排除已配對（他們已是配對，不應在這裡）
      const { data } = await sb.from("swipes")
        .select("swiper_id,direction,created_at")
        .eq("swiped_id", userId)
        .in("direction", ["like","superlike"])
        .order("created_at", { ascending: false });
      if (data) {
        const unmatched = data.filter((s: any) => !matchedIds.has(s.swiper_id));
        const items = await Promise.all(unmatched.map(async (s: any) => {
          const { data: p } = await sb.from("profiles")
            .select("id,display_name,username,avatar_url,birthday,mbti")
            .eq("id", s.swiper_id).maybeSingle();
          return { id: s.swiper_id, name: p?.display_name||p?.username||"?", age: p?.birthday?calcAge(p.birthday):null, avatar: p?.avatar_url||"", mbti: p?.mbti||"INFP", direction: s.direction, timestamp: new Date(s.created_at) } as WhoLikedItem;
        }));
        setWhoLikedMe(items);
      }
    }

    if (panel === "matches") {
      const { data: matchRows } = await sb.from("matches")
        .select("id,user1_id,user2_id,created_at")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (matchRows) {
        const items = await Promise.all(matchRows.map(async (m: any) => {
          const otherId = m.user1_id === userId ? m.user2_id : m.user1_id;
          const { data: p } = await sb.from("profiles")
            .select("id,display_name,username,avatar_url,birthday,mbti")
            .eq("id", otherId).maybeSingle();
          // Get last message
          const { data: msgs } = await sb.from("chat_messages")
            .select("content,is_image")
            .eq("match_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastMsg = msgs?.[0]?.is_image ? "📷 圖片" : msgs?.[0]?.content?.slice(0,30) || "開始聊天吧";
          return { matchId: m.id, userId: otherId, name: p?.display_name||p?.username||"?", avatar: p?.avatar_url||"", mbti: p?.mbti||"INFP", age: p?.birthday?calcAge(p.birthday):null, lastMsg };
        }));
        setMyMatches(items);
      }
    }

    if (panel === "i_liked") {
      // 我喜歡的人，排除已配對（配對的去「消息」找）
      const { data } = await sb.from("swipes")
        .select("swiped_id,direction,created_at")
        .eq("swiper_id", userId)
        .in("direction", ["like","superlike"])
        .order("created_at", { ascending: false });
      if (data) {
        const unmatched = data.filter((s: any) => !matchedIds.has(s.swiped_id));
        const items = await Promise.all(unmatched.map(async (s: any) => {
          const { data: p } = await sb.from("profiles")
            .select("id,display_name,username,avatar_url,birthday,mbti")
            .eq("id", s.swiped_id).maybeSingle();
          return { id: s.swiped_id, name: p?.display_name||p?.username||"?", age: p?.birthday?calcAge(p.birthday):null, avatar: p?.avatar_url||"", mbti: p?.mbti||"INFP", direction: s.direction, timestamp: new Date(s.created_at) } as WhoLikedItem;
        }));
        setILiked(items);
      }
    }

    setLoadingPanel(false);
  }

  function handleAvatar(file: File) { setCropFile({ file, type: "avatar" }); }
  async function doUploadAvatar(blob: Blob) { setUploading(true); setCropFile(null); try { const f = new File([blob], "avatar.jpg", { type: "image/jpeg" }); const url = await uploadAvatar(f, userId); setAvatarUrl(url); await updateProfile(userId, { avatar_url: url }); onUpdate({ avatar_url: url }); } catch (e) { console.error(e); } setUploading(false); }
  function handleCover(file: File) { setCropFile({ file, type: "cover" }); }
  async function doUploadCover(blob: Blob) { setUploading(true); setCropFile(null); try { const f = new File([blob], "cover.jpg", { type: "image/jpeg" }); const url = await uploadCover(f, userId); setCoverUrl(url); await updateProfile(userId, { cover_url: url } as any); onUpdate({ cover_url: url } as any); } catch (e) { console.error(e); } setUploading(false); }
  async function handlePhoto(file: File) { if (photos.length >= 6) return; setUploading(true); try { const url = await uploadPhoto(file, userId, photos.length); setPhotos(p => [...p, url]); } catch (e) { console.error(e); } setUploading(false); }
  async function save() {
    setSaving(true);
    const patch: Partial<UserProfile> = { display_name: name, bio: bio || null, birthday: birthday || null, location_text: loc || null, ethnicity, hobbies, mbti, gender, looking_for_gender: lookingFor, avatar_url: avatarUrl || null, photos, ...({ occupation: occupation || null, education: education || null, income: income || null, height_cm: heightCm || null, drinking: drinking || null, smoking: smoking || null, exercise: exercise || null, has_pets: hasPets || null, want_children: wantChildren || null, relationship_goal: relGoal || null, love_language: loveLanguage || null } as any) };
    await updateProfile(userId, patch);
    const { data: refreshed } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (refreshed) onUpdate(refreshed as any);
    setActiveTab("view"); setSaving(false); sound.pop();
  }
  async function handleLocate() {
    if (!navigator.geolocation) { alert("你的瀏覽器不支援定位"); return; }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true }));
      const { city } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (city) setLoc(city);
      await updateProfile(userId, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, location_text: city || loc } as any);
    } catch (e: any) {
      if (e.code === 1) alert("請允許瀏覽器使用定位權限"); else alert("定位失敗，請手動輸入城市");
    }
    setLocating(false);
  }

  const edu: Record<string, string> = { high_school: "高中", college: "大專", bachelor: "本科", master: "碩士", phd: "博士" };
  const incomeLabel = income === "<20" ? "20萬以下" : income === ">100" ? "100萬 +" : income ? `${income}萬` : "";

  /* ── Hobby background images ── */
  const hobbyBg: Record<string, string> = {
    "旅行": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=60",
    "音樂": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=60",
    "電影": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&q=60",
    "閱讀": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&q=60",
    "運動": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&q=60",
    "美食": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=60",
    "遊戲": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&q=60",
    "攝影": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&q=60",
    "藝術": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&q=60",
    "健身": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&q=60",
    "瑜伽": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&q=60",
    "舞蹈": "https://images.unsplash.com/photo-1547153760-18fc86324498?w=200&q=60",
    "寵物": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&q=60",
    "烹飪": "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200&q=60",
    "戶外": "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=200&q=60",
    "咖啡": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=60",
    "科技": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=60",
    "時尚": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=60",
    "語言": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=200&q=60",
    "電競": "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=200&q=60",
  };

  /* ── VIEW MODE ── */
  if (activeTab === "view") return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflowY: "auto", animation: "tabSwitch .3s ease" }}>

      {/* Cover + Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleCover(e.target.files[0]); }} />
        <div style={{ height: 200, background: coverUrl ? `url(${coverUrl}) center/cover` : "linear-gradient(135deg,rgba(201,168,76,0.22) 0%,rgba(12,10,8,1) 100%)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 40%,rgba(12,10,8,0.7) 75%,rgba(12,10,8,1) 100%)" }} />
          {/* Top-right buttons */}
          <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8, zIndex: 5 }}>
            <button onClick={() => setActiveTab("edit")} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(12,10,8,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Si n="pencil" s={16} c={C.text} />
            </button>
            <button onClick={() => setActiveTab("settings")} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(12,10,8,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Si n="gear" s={16} c={C.text} />
            </button>
          </div>
        </div>
        {/* Avatar */}
        <div style={{ position: "absolute", bottom: -40, left: 18 }}>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleAvatar(e.target.files[0]); }} />
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => avatarRef.current?.click()}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", border: `3px solid ${C.gold}`, overflow: "hidden", background: C.bgCard }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" as const }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Si n="user" s={36} c={C.textMuted} /></div>}
            </div>
            {/* Verified badge */}
            {profile.is_verified && <div style={{ position: "absolute", bottom: 2, right: 2, width: 24, height: 24, borderRadius: "50%", background: C.gold, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#12100C", fontSize: 11, fontWeight: 800 }}>V</span>
            </div>}
            {/* Camera icon (no verified) */}
            {!profile.is_verified && <div style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", background: C.bgCard, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Si n="camera" s={13} c={C.gold} />
            </div>}
            {uploading && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /></div>}
          </div>
        </div>
      </div>

      {/* Name row */}
      <div style={{ marginTop: 52, padding: "0 18px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{name}</span>
        </div>
        <div style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 10 }}>
          {[age ? `${age} 歲` : null, occupation || null, loc || null].filter(Boolean).join(" · ")}
        </div>
        {/* Chips */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" as const, marginBottom: 0 }}>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(232,54,93,0.13)", border: "1px solid rgba(232,54,93,0.3)", fontSize: 12, color: C.rose, fontWeight: 600 }}>✦ {mbti}</span>
          <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, fontSize: 12, color: C.textSub }}>{gender === "male" ? "♂ 男性" : "♀ 女性"}</span>
          {(profile as any).is_premium && <span style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", fontSize: 12, color: C.gold, fontWeight: 600 }}>👑 Premium</span>}
        </div>
      </div>

      <div style={{ padding: "0 16px 48px" }}>

        {/* Stats card — clickable */}
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, display: "flex", marginBottom: 14, overflow: "hidden" }}>
          {[
            { ico: "heart", val: stats.likesReceived, label: "喜歡我", color: "#e8365d", panel: "liked_me" as const },
            { ico: "star", val: stats.likesGiven, label: "我喜歡", color: C.gold, panel: "i_liked" as const },
            { ico: "users", val: stats.matches, label: "我的配對", color: "#6c88f5", panel: "matches" as const },
          ].map((s, i) => (
            <div key={s.label} onClick={() => openStatsPanel(s.panel)}
              style={{ flex: 1, textAlign: "center" as const, padding: "18px 0", borderRight: i < 2 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background .15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                <Si n={s.ico} s={18} c={s.color} />
                <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{s.val}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Completion card */}
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 14, cursor: "pointer" }} onClick={() => setActiveTab("edit")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>資料完整度</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, color: comp >= 80 ? "#00d4aa" : C.gold, fontWeight: 800 }}>{comp}%</span>
              <Si n="chevron" s={16} c={C.textMuted} />
            </div>
          </div>
          {/* Two-tone progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 10 }}>
            <div style={{ height: "100%", width: `${comp}%`, background: comp >= 80 ? "linear-gradient(90deg,#00d4aa,#00b892)" : "linear-gradient(90deg,#e8365d,#ff6b8a)", borderRadius: 3, transition: "width .8s" }} />
          </div>
          {comp < 100 && <div style={{ fontSize: 12, color: C.textMuted }}>
            再完成 <span style={{ color: "#00d4aa", fontWeight: 600 }}>{Math.ceil((100 - comp) / 10)}</span> 項資料可提升曝光率 <span style={{ color: "#00d4aa", fontWeight: 600 }}>25%</span>
            <button style={{ marginLeft: 8, width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: C.textMuted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>
              <Si n="question" s={11} c={C.textMuted} />
            </button>
          </div>}
        </div>

        {/* 基本資料 card */}
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>基本資料</span>
            <button onClick={() => setActiveTab("edit")} style={{ background: "none", border: "none", color: C.gold, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              <Si n="chevron" s={14} c={C.textMuted} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {[
              birthday && { ico: "calendar", label: birthday },
              heightCm && { ico: "ruler", label: `${heightCm} cm` },
              occupation && { ico: "briefcase", label: occupation },
              education && edu[education] && { ico: "graduation", label: edu[education] },
              income && { ico: "wallet", label: incomeLabel },
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Si n={item.ico} s={16} c={C.textMuted} />
                <span style={{ fontSize: 13.5, color: C.textSub }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 我的生活方式 card */}
        {[drinking, smoking, exercise, hasPets].some(Boolean) && <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>我的生活方式</span>
            <button onClick={() => setActiveTab("edit")} style={{ background: "none", border: "none", color: C.gold, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              <Si n="chevron" s={14} c={C.textMuted} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
            {[
              smoking === "never" && { ico: "nosmoking", label: "不抽菸" },
              smoking && smoking !== "never" && { ico: "smoking", label: smoking === "sometimes" ? "偶爾抽菸" : "常抽菸" },
              drinking && drinking !== "never" && { ico: "wine", label: drinking === "sometimes" ? "偶爾喝酒" : "常喝酒" },
              exercise && exercise !== "never" && { ico: "dumbbell", label: exercise === "weekly" ? "每週運動" : "每天運動" },
              hasPets && hasPets !== "none" && { ico: "paw", label: hasPets === "cat" ? "有養貓" : "有養狗" },
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Si n={item.ico} s={18} c={C.textSub} />
                <span style={{ fontSize: 13, color: C.textSub }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>}

        {/* 興趣愛好 card */}
        {hobbies.length > 0 && <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>興趣愛好</span>
            <button onClick={() => setActiveTab("edit")} style={{ background: "none", border: "none", color: C.gold, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              <Si n="chevron" s={14} c={C.textMuted} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
            {hobbies.slice(0, 5).map(h => (
              <div key={h} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: `url(${hobbyBg[h] || ""}) center/cover`, backgroundColor: "#2A2218" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 35%,rgba(0,0,0,0.75))" }} />
                <div style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center" as const, fontSize: 10.5, color: "#fff", fontWeight: 600 }}>{h}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* 照片與影音 card */}
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 20, cursor: "pointer" }} onClick={() => setActiveTab("edit")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>照片與影音</span>
            <Si n="chevron" s={16} c={C.textMuted} />
          </div>
        </div>

        {/* Logout */}
        <button onClick={onLogout} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "transparent", border: "1px solid rgba(232,54,93,0.35)", color: C.rose, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8, transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,54,93,0.07)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>登出帳號</button>
        <button onClick={() => setShowDelete(true)} style={{ width: "100%", padding: "11px", borderRadius: 14, background: "transparent", border: "none", color: C.textDim, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>刪除帳號</button>
      </div>

      {cropFile && <ImageCropper file={cropFile.file} aspectRatio={cropFile.type === "cover" ? 2.5 : 1} shape={cropFile.type === "avatar" ? "circle" : "rect"} onConfirm={blob => { if (cropFile.type === "avatar") doUploadAvatar(blob); else if (cropFile.type === "cover") doUploadCover(blob); }} onCancel={() => setCropFile(null)} />}

      {/* ── Stats Panel ── */}
      {statsPanel && (
        <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",justifyContent:"center",background:"rgba(0,0,0,0.65)",backdropFilter:"blur(16px)" }} onClick={()=>setStatsPanel(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"100%",maxWidth:480,margin:"0 auto",background:"#141210",borderRadius:"22px 22px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"82vh",display:"flex",flexDirection:"column" as const,position:"absolute",bottom:0,animation:"slideUp .3s cubic-bezier(.32,.72,0,1)" }}>
            {/* Handle */}
            <div style={{ padding:"14px 0 0",display:"flex",justifyContent:"center" }}><div style={{ width:40,height:5,borderRadius:3,background:"rgba(255,255,255,0.15)" }}/></div>
            {/* Header */}
            <div style={{ padding:"12px 20px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:17,fontWeight:700,color:C.text }}>
                  {statsPanel==="liked_me"?"喜歡你的人":statsPanel==="i_liked"?"你喜歡的人":"你的配對"}
                </div>
                <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>
                  {statsPanel==="liked_me"?`${stats.likesReceived} 人`:statsPanel==="i_liked"?`${stats.likesGiven} 人`:`${stats.matches} 個配對`}
                </div>
              </div>
              <button onClick={()=>{setStatsPanel(null);setShowAllMatches(false);}} style={{ width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"none",color:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>✕</button>
            </div>
            {/* Content */}
            <div style={{ flex:1,overflowY:"auto",padding:"8px 0 32px" }}>
              {loadingPanel ? (
                <div style={{ display:"flex",justifyContent:"center",padding:"48px 0" }}>
                  <div style={{ width:28,height:28,border:`2px solid ${C.border}`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                </div>
              ) : statsPanel === "matches" ? (
                myMatches.length === 0 ? (
                  <div style={{ textAlign:"center" as const,padding:"48px 20px",color:C.textMuted }}>
                    <div style={{ fontSize:40,marginBottom:14,opacity:.4 }}>💬</div>
                    <div style={{ fontSize:14 }}>還沒有配對，去探索一下吧</div>
                  </div>
                ) : (
                  <div>
                    {(showAllMatches ? myMatches : myMatches.slice(0,8)).map(m=>(
                      <div key={m.matchId}
                        onClick={()=>{ setStatsPanel(null); onOpenChat?.(m.matchId, m.userId, m.name, m.avatar); }}
                        style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 20px",cursor:"pointer",transition:"background .15s" }}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.025)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <Av url={m.avatar} name={m.name} size={54}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:15,fontWeight:600,color:C.text }}>{m.name}{m.age?`, ${m.age}`:""}</div>
                          <div style={{ fontSize:12.5,color:C.textMuted,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const }}>{m.lastMsg}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(245,237,214,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    ))}
                    {myMatches.length > 8 && !showAllMatches && (
                      <button onClick={()=>setShowAllMatches(true)}
                        style={{ width:"100%",padding:"14px",background:"none",border:"none",color:C.gold,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer",borderTop:`1px solid ${C.border}` }}>
                        查看全部 {myMatches.length} 個配對
                      </button>
                    )}
                  </div>
                )
              ) : (
                (() => {
                  const items = statsPanel==="liked_me" ? whoLikedMe : iLiked;
                  if (items.length === 0) return (
                    <div style={{ textAlign:"center" as const,padding:"48px 20px",color:C.textMuted }}>
                      <div style={{ fontSize:40,marginBottom:14,opacity:.3,color:C.gold }}>◈</div>
                      <div style={{ fontSize:14 }}>{statsPanel==="liked_me"?"還沒有人喜歡你，去探索一下吧":"你還沒有喜歡任何人"}</div>
                    </div>
                  );
                  // Group by date
                  const today = new Date(); today.setHours(0,0,0,0);
                  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
                  const groups: {label:string; items:WhoLikedItem[]}[] = [];
                  const todayItems = items.filter(i=>new Date(i.timestamp)>=today);
                  const yesterdayItems = items.filter(i=>new Date(i.timestamp)>=yesterday&&new Date(i.timestamp)<today);
                  const olderItems = items.filter(i=>new Date(i.timestamp)<yesterday);
                  if (todayItems.length) groups.push({label:"今天",items:todayItems});
                  if (yesterdayItems.length) groups.push({label:"昨天",items:yesterdayItems});
                  if (olderItems.length) groups.push({label:"更早",items:olderItems});
                  return (
                    <>
                      {groups.map(group=>(
                        <div key={group.label}>
                          <div style={{ fontSize:11.5,fontWeight:700,color:C.textMuted,letterSpacing:".5px",padding:"14px 20px 8px",textTransform:"uppercase" as const }}>{group.label}</div>
                          {group.items.map(item=>(
                            <div key={item.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 20px",transition:"background .15s" }}
                              onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                              <Av url={item.avatar} name={item.name} size={54}/>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ fontSize:15,fontWeight:600,color:C.text }}>{item.name}{item.age?`, ${item.age}`:""}</div>
                                <div style={{ fontSize:12.5,marginTop:2,display:"flex",alignItems:"center",gap:6 }}>
                                  {item.direction==="superlike"
                                    ? <span style={{ color:C.gold,fontWeight:600 }}>✦ 優先認識</span>
                                    : <span style={{ color:"#e8365d" }}>♥ 喜歡你</span>}
                                  <span style={{ color:C.textMuted }}>·</span>
                                  <span style={{ color:C.textMuted }}>{item.mbti}</span>
                                </div>
                              </div>
                              {statsPanel==="liked_me" && (
                                <button
                                  onClick={async ()=>{
                                    await sb.from("swipes").upsert({swiper_id:userId,swiped_id:item.id,direction:"like"},{onConflict:"swiper_id,swiped_id"});
                                    setWhoLikedMe(w=>w.filter(x=>x.id!==item.id));
                                    setStats(s=>({...s,likesReceived:s.likesReceived-1}));
                                    sound.match();
                                  }}
                                  style={{ padding:"8px 16px",borderRadius:20,background:"linear-gradient(135deg,#C9A84C,#E2C068)",border:"none",color:"#12100C",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0 }}>
                                  喜歡
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {showDelete && <BottomSheet onClose={() => setShowDelete(false)}>
        <div style={{ padding: "20px 24px 52px", textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10 }}>確定刪除帳號？</div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 28 }}>所有資料、配對、對話將永久刪除，無法復原。</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: C.surf, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>取消</button>
            <button onClick={() => deleteAccount(userId)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.28)", color: "#FF6B6B", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>確定刪除</button>
          </div>
        </div>
      </BottomSheet>}
    </div>
  );

  /* ── EDIT MODE ── */
  if (activeTab === "edit") return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, animation: "tabSwitch .3s ease" }}>
      {/* Edit header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.bg }}>
        <button onClick={() => setActiveTab("view")} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>取消</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>編輯資料</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={save} disabled={saving} style={{ background: "none", border: "none", color: C.rose, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, opacity: saving ? .6 : 1 }}>{saving ? "儲存中..." : "儲存"}</button>
          <button onClick={() => setActiveTab("settings")} style={{ width: 32, height: 32, borderRadius: "50%", background: C.bgCard, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Si n="gear" s={15} c={C.textMuted} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Completion bar at top of edit */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>完成度 {comp}%</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Si n="question" s={14} c={C.textMuted} />
            </div>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${comp}%`, background: "linear-gradient(90deg,#e8365d,#ff6b8a)", borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            再完成 <span style={{ color: "#00d4aa", fontWeight: 600 }}>{Math.ceil((100 - comp) / 10)}</span> 項可提升曝光率 <span style={{ color: "#00d4aa", fontWeight: 600 }}>25%</span>
          </div>
        </div>

        <div style={{ padding: "0 18px 48px" }}>

          {/* 基本資料 section */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "20px 0 4px" }}>基本資料</div>
          <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
            <EditRow icon="user" label="顯示名稱" value={name} onClick={() => { setEditText(name); setEditField("name"); }} />
            <EditRow icon="calendar" label="生日" value={birthday} onClick={() => { setEditText(birthday); setEditField("birthday"); }} />
            <EditRow icon="globe" label="所在地" value={loc} onClick={() => { setEditText(loc); setEditField("location"); }} />
            <EditRow icon="ruler" label="身高" value={heightCm ? `${heightCm} cm` : ""} onClick={() => { setEditText(heightCm); setEditField("height"); }} />
            <EditRow icon="briefcase" label="職業" value={occupation} onClick={() => { setEditText(occupation); setEditField("occupation"); }} />
            <EditRow icon="graduation" label="學歷" value={edu[education] || ""} onClick={() => setEditField("education")} />
            <EditRow icon="wallet" label="年收入" value={incomeLabel} onClick={() => setEditField("income")} last />
          </div>

          {/* 關於我 section */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>關於我</div>
          <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <Si n="chat" s={18} c={C.textMuted} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>個人簡介</div>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="介紹一下自己，讓更多人認識你..." rows={3} style={{ ...INP, resize: "none", padding: "8px 0", background: "transparent", border: "none", fontSize: 13, color: C.textMuted }} onFocus={e => (e.target.style.color = C.textSub)} onBlur={e => (e.target.style.color = C.textMuted)} />
                </div>
                <Si n="chevron" s={16} c={C.textMuted} />
              </div>
            </div>
          </div>

          {/* 我的生活方式 section */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>我的生活方式</div>
          <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
            <EditRow icon="nosmoking" label="抽菸習慣" value={smoking === "never" ? "不抽菸" : smoking === "sometimes" ? "偶爾抽菸" : smoking === "often" ? "常抽菸" : ""} onClick={() => setEditField("smoking")} />
            <EditRow icon="paw" label="寵物" value={hasPets === "none" ? "無寵物" : hasPets === "cat" ? "有養貓" : hasPets === "dog" ? "有養狗" : hasPets === "other" ? "有養其他" : ""} onClick={() => setEditField("pets")} />
            <EditRow icon="wine" label="飲酒習慣" value={drinking === "never" ? "不喝酒" : drinking === "sometimes" ? "偶爾喝酒" : drinking === "often" ? "常喝酒" : ""} onClick={() => setEditField("drinking")} />
            <EditRow icon="dumbbell" label="運動習慣" value={exercise === "never" ? "從不運動" : exercise === "sometimes" ? "偶爾運動" : exercise === "weekly" ? "每週運動" : exercise === "daily" ? "每天運動" : ""} onClick={() => setEditField("exercise")} />
          </div>

          {/* 興趣愛好 section */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>興趣愛好</div>
          <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {HOBBIES.map(h => {
                const sel = hobbies.includes(h);
                return <button key={h} onClick={() => setHobbies(sel ? hobbies.filter(x => x !== h) : [...hobbies, h])} style={{ padding: "7px 14px", borderRadius: 20, background: sel ? "rgba(232,54,93,0.15)" : "transparent", border: `1px solid ${sel ? C.rose : C.border}`, color: sel ? C.rose : C.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: sel ? 600 : 400, transition: "all .15s" }}>{h}</button>;
              })}
            </div>
          </div>

          {/* 照片與影音 section */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>照片與影音</div>
          <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <Si n="image" s={18} c={C.textMuted} />
              <div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>管理我的照片</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{photos.length}/6 張</div>
              </div>
            </div>
            <PhotoGrid photos={photos} onAdd={handlePhoto} onRemove={i => setPhotos(ps => ps.filter((_, j) => j !== i))} uploading={uploading} />
          </div>

          {/* MBTI */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>MBTI</div>
          <button onClick={() => setShowMbti(true)} style={{ width: "100%", padding: "14px 16px", borderRadius: 16, background: C.bgCard, border: `1px solid ${C.border}`, color: C.text, fontFamily: "inherit", fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span>✦ {mbti}</span><Si n="chevron" s={16} c={C.textMuted} />
          </button>

          {/* Gender + Looking for */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>我的性別</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {(["male", "female"] as const).map(g => <button key={g} onClick={() => setGender(g)} style={{ padding: "10px", borderRadius: 12, background: gender === g ? "rgba(232,54,93,0.1)" : "transparent", border: `1px solid ${gender === g ? C.rose : C.border}`, color: gender === g ? C.rose : C.textSub, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: gender === g ? 600 : 400 }}>{g === "male" ? "♂ 男性" : "♀ 女性"}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>尋找對象</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {["female", "male", "both"].map(g => <button key={g} onClick={() => setLookingFor(g)} style={{ padding: "10px", borderRadius: 12, background: lookingFor === g ? "rgba(232,54,93,0.1)" : "transparent", border: `1px solid ${lookingFor === g ? C.rose : C.border}`, color: lookingFor === g ? C.rose : C.textSub, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: lookingFor === g ? 600 : 400 }}>{g === "female" ? "女性" : g === "male" ? "男性" : "全部"}</button>)}
              </div>
            </div>
          </div>

          {/* Relationship goal */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>感情目標</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
            {[["serious", "認真交往"], ["friends_first", "先朋友再說"], ["casual", "隨緣"], ["open", "開放"]].map(([v, l]) => (
              <button key={v} onClick={() => setRelGoal(relGoal === v ? "" : v)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${relGoal === v ? C.gold : C.border}`, background: relGoal === v ? "rgba(201,168,76,0.12)" : "transparent", color: relGoal === v ? C.gold : C.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>

        </div>
      </div>

      {cropFile && <ImageCropper file={cropFile.file} aspectRatio={cropFile.type === "cover" ? 2.5 : 1} shape={cropFile.type === "avatar" ? "circle" : "rect"} onConfirm={blob => { if (cropFile.type === "avatar") doUploadAvatar(blob); else if (cropFile.type === "cover") doUploadCover(blob); }} onCancel={() => setCropFile(null)} />}
      {showMbti && <MbtiSheet mbti={mbti} onSelect={m => setMbti(m)} onClose={() => setShowMbti(false)} />}

      {/* ── Field pickers ── */}
      {(editField === "name" || editField === "occupation" || editField === "height") && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>
              {{ name: "顯示名稱", occupation: "職業", height: "身高 (cm)" }[editField]}
            </div>
            <input
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              type={editField === "height" ? "number" : "text"}
              placeholder={editField === "height" ? "例：170" : editField === "occupation" ? "設計師、工程師、學生..." : "輸入名稱"}
              style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 14, color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 16 }}
              onFocus={e => e.target.style.borderColor = C.gold}
              onBlur={e => e.target.style.borderColor = C.border}
              onKeyDown={e => { if (e.key === "Enter") { if (editField === "name") setName(editText); else if (editField === "occupation") setOccupation(editText); else if (editField === "height") setHeightCm(editText); setEditField(null); } }}
            />
            <button onClick={() => {
              if (editField === "name") setName(editText);
              else if (editField === "occupation") setOccupation(editText);
              else if (editField === "height") setHeightCm(editText);
              setEditField(null);
            }} style={{ width: "100%", padding: "15px", borderRadius: 14, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>確認</button>
          </div>
        </BottomSheet>
      )}

      {editField === "birthday" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>生日</div>
            <input
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              type="date"
              style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 14, color: C.text, fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 16, colorScheme: "dark" } as any}
              onFocus={e => e.target.style.borderColor = C.gold}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <button onClick={() => { setBirthday(editText); setEditField(null); }} style={{ width: "100%", padding: "15px", borderRadius: 14, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>確認</button>
          </div>
        </BottomSheet>
      )}

      {editField === "location" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>所在地</div>
            <CityInput value={editText} onChange={setEditText} onSelect={(city, lat, lon) => { setLoc(city); setEditText(city); updateProfile(userId, { latitude: lat, longitude: lon }); setEditField(null); }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={handleLocate} disabled={locating} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(232,54,93,0.08)", border: `1px solid rgba(232,54,93,0.25)`, color: C.rose, fontFamily: "inherit", fontSize: 14, cursor: "pointer", opacity: locating ? .6 : 1 }}>
                {locating ? "定位中..." : "📍 GPS 定位"}
              </button>
              <button onClick={() => { setLoc(editText); setEditField(null); }} style={{ flex: 1, padding: "13px", borderRadius: 14, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>確認</button>
            </div>
          </div>
        </BottomSheet>
      )}

      {editField === "education" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>學歷</div>
            {[["high_school","高中 / 中專"],["college","大專"],["bachelor","本科"],["master","碩士"],["phd","博士"]].map(([v,l]) => (
              <button key={v} onClick={() => { setEducation(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: education === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${education === v ? C.gold : C.border}`, color: education === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: education === v ? 600 : 400 }}>
                <span>{l}</span>
                {education === v && <span style={{ fontSize: 16 }}>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {editField === "income" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>年收入</div>
            {[["","不透露"],["<20","20萬以下"],["20-50","20–50萬"],["50-100","50–100萬"],[">100","100萬以上"]].map(([v,l]) => (
              <button key={v} onClick={() => { setIncome(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: income === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${income === v ? C.gold : C.border}`, color: income === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: income === v ? 600 : 400 }}>
                <span>{l}</span>
                {income === v && <span style={{ fontSize: 16 }}>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {editField === "smoking" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>抽菸習慣</div>
            {[["never","不抽菸"],["sometimes","偶爾抽菸"],["often","常抽菸"]].map(([v,l]) => (
              <button key={v} onClick={() => { setSmoking(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: smoking === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${smoking === v ? C.gold : C.border}`, color: smoking === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: smoking === v ? 600 : 400 }}>
                <span>{l}</span>{smoking === v && <span>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {editField === "drinking" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>飲酒習慣</div>
            {[["never","不喝酒"],["sometimes","偶爾喝酒"],["often","常喝酒"]].map(([v,l]) => (
              <button key={v} onClick={() => { setDrinking(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: drinking === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${drinking === v ? C.gold : C.border}`, color: drinking === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: drinking === v ? 600 : 400 }}>
                <span>{l}</span>{drinking === v && <span>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {editField === "exercise" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>運動習慣</div>
            {[["never","從不運動"],["sometimes","偶爾運動"],["weekly","每週運動"],["daily","每天運動"]].map(([v,l]) => (
              <button key={v} onClick={() => { setExercise(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: exercise === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${exercise === v ? C.gold : C.border}`, color: exercise === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: exercise === v ? 600 : 400 }}>
                <span>{l}</span>{exercise === v && <span>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {editField === "pets" && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ padding: "8px 20px 40px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20, textAlign: "center" as const }}>寵物</div>
            {[["none","無寵物"],["cat","有養貓"],["dog","有養狗"],["other","有養其他"]].map(([v,l]) => (
              <button key={v} onClick={() => { setHasPets(v); setEditField(null); }}
                style={{ width: "100%", padding: "16px 20px", marginBottom: 8, borderRadius: 14, background: hasPets === v ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${hasPets === v ? C.gold : C.border}`, color: hasPets === v ? C.gold : C.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: hasPets === v ? 600 : 400 }}>
                <span>{l}</span>{hasPets === v && <span>✓</span>}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );

  /* ── SETTINGS MODE ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, animation: "tabSwitch .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={() => setActiveTab("view")} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>設定</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 48px" }}>
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
          <SettingRow icon="volume" label="音效" right={<Toggle on={soundOn} onChange={() => { sound.enabled = !sound.enabled; setSoundOn(s => !s); }} />} />
          <SettingRow icon="globe" label="語言" right={<div style={{ display: "flex", gap: 6 }}>{(["zh", "en"] as Lang[]).map(l => <button key={l} onClick={() => { setLang(l); updateProfile(userId, { language: l } as any); sound.tap(); }} style={{ padding: "5px 13px", borderRadius: 20, background: lang === l ? C.grad : "transparent", border: `1px solid ${lang === l ? "transparent" : C.border}`, color: lang === l ? "#fff" : C.textMuted, fontFamily: "inherit", fontSize: 12, fontWeight: lang === l ? 600 : 400, cursor: "pointer" }}>{l === "zh" ? "中文" : "EN"}</button>)}</div>} />
          <SettingRow icon="eye" label="隱藏在線狀態" sub="開啟後你也看不到其他人的在線狀態" right={<Toggle on={hideOnline} onChange={() => { const v = !hideOnline; setHideOnline(v); updateProfile(userId, { hide_online_status: v } as any); onUpdate({ hide_online_status: v } as any); }} />} />
          <SettingRow icon="bell" label="推播通知" sub="打包 iOS 後開放" right={<span style={{ fontSize: 11.5, color: C.textDim }}>即將推出</span>} />
          <SettingRow icon="moon" label="暫停帳號" sub="暫停後你不會出現在探索頁" right={<Toggle on={(profile as any).is_paused || false} onChange={() => { const v = !((profile as any).is_paused || false); updateProfile(userId, { is_paused: v } as any); onUpdate({ is_paused: v } as any); sound.tap(); }} />} />
          <SettingRow icon="crown" label="升級 Premium" right={<span style={{ fontSize: 12, color: C.rose, fontWeight: 700 }}>解鎖全部功能</span>} onClick={() => setShowPremium(true)} />
          <SettingRow icon="shield" label="隱私政策" right={<Si n="chevron" s={16} c={C.textMuted} />} onClick={() => setShowTerms("privacy")} />
          <SettingRow icon="scroll" label="服務條款" right={<Si n="chevron" s={16} c={C.textMuted} />} onClick={() => setShowTerms("terms")} last />
        </div>
        <div style={{ background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 24 }}>
          <SettingRow icon="box" label="導出我的數據" sub="下載你的所有資料（JSON）" right={<Si n="chevron" s={16} c={C.textMuted} />} onClick={async () => { await exportUserData(userId); }} />
          <SettingRow icon="info" label="關於 NYX" right={<span style={{ fontSize: 12, color: C.textMuted }}>v1.0.0</span>} last />
        </div>
        <button onClick={onLogout} style={{ width: "100%", padding: "15px", borderRadius: 14, background: "transparent", border: "1px solid rgba(232,54,93,0.35)", color: C.rose, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8, transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,54,93,0.07)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>登出帳號</button>
        <button onClick={() => setShowDelete(true)} style={{ width: "100%", padding: "11px", borderRadius: 14, background: "transparent", border: "none", color: C.textDim, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>刪除帳號</button>
      </div>
      {showPremium && <div style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg }}><PremiumScreen onBack={() => setShowPremium(false)} profile={profile} /></div>}
      {showTerms && <div style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg }}><TermsScreen onBack={() => setShowTerms(null)} type={showTerms} /></div>}
      {showDelete && <BottomSheet onClose={() => setShowDelete(false)}>
        <div style={{ padding: "20px 24px 52px", textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 10 }}>確定刪除帳號？</div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 28 }}>所有資料、配對、對話將永久刪除，無法復原。</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: C.surf, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>取消</button>
            <button onClick={() => deleteAccount(userId)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.28)", color: "#FF6B6B", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>確定刪除</button>
          </div>
        </div>
      </BottomSheet>}
    </div>
  );
}
