import { useState, useEffect, useRef } from "react";
import { C, getMemories, getBondInfo, fmtDate } from "../utils";
import type { Memory, BondInfo } from "../utils";

const BOND_COLORS = ["rgba(201,168,76,0.3)","rgba(201,168,76,0.5)","rgba(232,54,93,0.4)","rgba(232,54,93,0.6)","rgba(201,168,76,0.8)"];
const MEMORY_ICONS: Record<string, string> = { encounter:"✦", spark:"♥", milestone:"★", first_message:"💬" };
const MEMORY_COLORS: Record<string, string> = { encounter:C.gold, spark:C.rose, milestone:C.mint, first_message:C.textSub };

function BondRing({ level, chemistry }: { level: number; chemistry: number }) {
  const circumference = 2 * Math.PI * 28;
  const dash = (chemistry / 100) * circumference;
  return (
    <div style={{ position:"relative", width:80, height:80, flexShrink:0 }}>
      <svg width="80" height="80" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="40" cy="40" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
        <circle cx="40" cy="40" r="28" fill="none" stroke={C.gold} strokeWidth="4"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray .8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.gold, lineHeight:1 }}>{chemistry}</div>
        <div style={{ fontSize:8.5, color:C.textMuted, marginTop:1 }}>化學值</div>
      </div>
    </div>
  );
}

export function MemoryWall({ matchId, otherName, onClose }: { matchId: string; otherName: string; onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [bond, setBond]         = useState<BondInfo|null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getMemories(matchId), getBondInfo(matchId)]).then(([m, b]) => {
      setMemories(m); setBond(b); setLoading(false);
    });
  }, [matchId]);

  // Hinge-style swipe right to go back
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const isSwiping = useRef(false);
  function onSwipeTouchStart(e: React.TouchEvent) { swipeStartX.current = e.touches[0].clientX; swipeStartY.current = e.touches[0].clientY; isSwiping.current = false; }
  function onSwipeTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (swipeStartX.current < 40 && dx > 0 && dy < 60) { isSwiping.current = true; setSwipeDx(dx); }
  }
  function onSwipeTouchEnd() {
    if (isSwiping.current && swipeDx > 100) onClose(); else setSwipeDx(0);
    isSwiping.current = false;
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:250, background:"rgba(0,0,0,0.6)", display:"flex", justifyContent:"center", animation:"fadeIn .2s ease" }}>
      <div onTouchStart={onSwipeTouchStart} onTouchMove={onSwipeTouchMove} onTouchEnd={onSwipeTouchEnd}
        style={{ width:"100%", maxWidth:480, background:C.bg, display:"flex", flexDirection:"column", height:"100%", position:"relative",
          touchAction:"pan-y", transform:`translateX(${swipeDx}px)`, transition:swipeDx===0?"transform .3s cubic-bezier(.32,.72,0,1)":"none",
          boxShadow:swipeDx>10?"-10px 0 30px rgba(0,0,0,0.6)":"none" }}>
      {/* Header */}
      <div style={{ padding:"52px 16px 16px", background:"rgba(12,10,8,0.97)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textMuted, fontSize:22, cursor:"pointer", fontFamily:"inherit", lineHeight:1 }}>‹</button>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.text }}>共同回憶</div>
            <div style={{ fontSize:12.5, color:C.textMuted, marginTop:1 }}>你與 {otherName} 的故事</div>
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px 40px" }}>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:"60px 0" }}>
            <div style={{ width:32, height:32, border:`2px solid ${C.border}`, borderTopColor:C.gold, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
          </div>
        ) : <>
          {/* Bond summary card */}
          {bond && (
            <div style={{ background:C.bgGold, border:`1px solid ${C.gold}33`, borderRadius:20, padding:"20px", marginBottom:24, display:"flex", alignItems:"center", gap:20 }}>
              <BondRing level={bond.level} chemistry={bond.chemistryScore}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, color:C.gold, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:4 }}>關係等級</div>
                <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:8 }}>{bond.label}</div>
                <div style={{ display:"flex", gap:16 }}>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:18, fontWeight:700, color:C.gold }}>{bond.encounterCount}</div>
                    <div style={{ fontSize:10.5, color:C.textMuted }}>共同遭遇</div>
                  </div>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:18, fontWeight:700, color:C.rose }}>{bond.sparkCount}</div>
                    <div style={{ fontSize:10.5, color:C.textMuted }}>真心話</div>
                  </div>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:18, fontWeight:700, color:C.mint }}>{memories.length}</div>
                    <div style={{ fontSize:10.5, color:C.textMuted }}>回憶</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {memories.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 24px" }}>
              <div style={{ fontSize:44, opacity:.2, color:C.gold, marginBottom:14 }}>✦</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>故事才剛開始</div>
              <div style={{ fontSize:14, color:C.textMuted, lineHeight:1.7 }}>完成「共同遭遇」和「真心話」<br/>就會在這裡留下記錄</div>
            </div>
          ) : <>
            <div style={{ fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:16 }}>時間軸</div>
            <div style={{ position:"relative" }}>
              {/* Timeline line */}
              <div style={{ position:"absolute", left:19, top:0, bottom:0, width:1, background:`linear-gradient(to bottom,${C.gold}44,transparent)` }}/>
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {memories.map((m, i) => (
                  <div key={m.id} style={{ display:"flex", gap:14, paddingBottom:20, animation:`fadeUp .4s ${i*.06}s ease both` }}>
                    {/* Icon dot */}
                    <div style={{ width:38, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:C.bgGold, border:`1.5px solid ${MEMORY_COLORS[m.type]||C.gold}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:MEMORY_COLORS[m.type]||C.gold, zIndex:1, position:"relative", marginTop:2 }}>
                        {MEMORY_ICONS[m.type]||"●"}
                      </div>
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10.5, color:C.textMuted, marginBottom:5 }}>
                        {fmtDate(m.createdAt)}
                      </div>
                      <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:MEMORY_COLORS[m.type]||C.gold, letterSpacing:".5px", textTransform:"uppercase" as const, marginBottom:6 }}>
                          {m.type==="encounter"?"共同遭遇":m.type==="spark"?"真心話":m.type==="milestone"?"里程碑":"對話開始"}
                        </div>
                        {m.type==="encounter" && m.content && <>
                          <div style={{ fontSize:13.5, color:C.text, lineHeight:1.55, marginBottom:8, fontWeight:500 }}>{m.content.scene}</div>
                          <div style={{ display:"flex", gap:8 }}>
                            <span style={{ padding:"3px 10px", borderRadius:20, background:C.goldSoft, border:`1px solid ${C.gold}33`, fontSize:12, color:C.gold }}>你：{m.content.choiceA}</span>
                            <span style={{ padding:"3px 10px", borderRadius:20, background:C.roseSoft, border:`1px solid ${C.rose}33`, fontSize:12, color:C.rose }}>TA：{m.content.choiceB}</span>
                          </div>
                        </>}
                        {m.type==="spark" && m.content && <>
                          <div style={{ fontSize:13.5, color:C.textSub, fontStyle:"italic", marginBottom:10, lineHeight:1.55 }}>「{m.content.question}」</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            {[{c:C.rose,l:"你",a:m.content.answerA},{c:C.gold,l:"TA",a:m.content.answerB}].map(p=>(
                              <div key={p.l} style={{ fontSize:12.5, color:C.text, lineHeight:1.5 }}>
                                <span style={{ color:p.c, fontWeight:700, marginRight:4 }}>{p.l}：</span>{p.a}
                              </div>
                            ))}
                          </div>
                        </>}
                        {(m.type==="milestone"||m.type==="first_message") && (
                          <div style={{ fontSize:13.5, color:C.textSub, lineHeight:1.55 }}>{m.title}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}
        </>}
      </div>
    </div>
    </div>
  );
}
