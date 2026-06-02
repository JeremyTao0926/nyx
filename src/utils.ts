import { createClient } from "@supabase/supabase-js";
import type { GMsg, UserProfile, ExploreProfile, MatchItem, Msg, ChatMsg, WhoLikedItem, NyxAnalysis, DailyLikeStatus } from "./types";

/* ─── Config ─────────────────────────────────────────── */
export const GROQ_KEY =
  import.meta.env.VITE_GROQ_API_KEY;

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL;

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";
export const TEXT_MODEL   = "llama-3.3-70b-versatile";
export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ═══ DESIGN TOKENS — Premium Dark Gold (v10) ════════════ */
export const C = {
  bg:           "#0C0A08",
  bgCard:       "#141210",
  bgElevated:   "#1C1916",
  bgGold:       "#1E1A0E",
  surf:         "rgba(255,255,255,0.04)",
  surfHigh:     "rgba(255,255,255,0.07)",
  surfGold:     "rgba(201,168,76,0.07)",
  gold:         "#C9A84C",
  goldLight:    "#E2C068",
  goldSoft:     "rgba(201,168,76,0.12)",
  goldGlow:     "rgba(201,168,76,0.25)",
  rose:         "#E8365D",
  roseSoft:     "rgba(232,54,93,0.12)",
  roseGlow:     "rgba(232,54,93,0.25)",
  mint:         "#00C9A7",
  mintSoft:     "rgba(0,201,167,0.10)",
  superlike:    "#4A90D9",
  superlikeSoft:"rgba(74,144,217,0.10)",
  get pink()      { return this.rose; },
  get violet()    { return this.gold; },
  get pinkSoft()  { return this.roseSoft; },
  get pinkGlow()  { return this.roseGlow; },
  get teal()      { return this.mint; },
  get tealSoft()  { return this.mintSoft; },
  text:         "#F5EDD6",
  textSub:      "rgba(245,237,214,0.65)",
  textMuted:    "rgba(245,237,214,0.38)",
  textDim:      "rgba(245,237,214,0.18)",
  border:       "rgba(201,168,76,0.12)",
  borderHigh:   "rgba(201,168,76,0.22)",
  borderFocus:  "rgba(201,168,76,0.45)",
  grad:         "linear-gradient(135deg,#C9A84C,#E2C068)",
  gradRose:     "linear-gradient(135deg,#E8365D,#FF6B6B)",
  gradMint:     "linear-gradient(135deg,#00C9A7,#00E5C0)",
  gradGold:     "linear-gradient(135deg,#C9A84C,#E2C068)",
  gradSuper:    "linear-gradient(135deg,#4A90D9,#7BB8F5)",
  gradDark:     "linear-gradient(180deg,transparent,rgba(12,10,8,0.96))",
};

export const WRAP = { maxWidth: 480, margin: "0 auto", width: "100%" };
export const DAILY_LIKE_LIMIT = 30; // free tier

/* ─── Constants ──────────────────────────────────────── */
export const MBTI_LIST  = ["INFP","INFJ","INTP","INTJ","ENFP","ENFJ","ENTP","ENTJ","ISFP","ISFJ","ISTP","ISTJ","ESFP","ESFJ","ESTP","ESTJ"];
export const EMOJIS     = ["😊","😂","🥰","😍","😘","😏","😅","🤭","😌","😋","😒","🙄","🥺","😭","😤","😳","🤔","👀","💀","✨","🔥","💯","⭐","🌸","❤️","🧡","💛","💜","🩷","🖤","💔","❤️‍🔥","💕","💗","💖","💞","👋","🤝","🫶","👍","👏","🙏","🫂","💪","🤞","🫠","🤣","😬","🐱","🐶","🦊","🐰","🐼","🍓","🌹","💐","🎉","🎊","🍷","☕","👑","💎","🌙","🌟","🎭","💭","🗯️","📱","✈️","🏖️","🎵","🎶"];
export const HOBBIES    = ["旅行","音樂","電影","閱讀","運動","美食","遊戲","攝影","藝術","健身","瑜伽","舞蹈","寵物","烹飪","戶外","咖啡","科技","時尚","語言","電競"];
export const ETHNICITY  = ["華人","台灣人","香港人","日本人","韓國人","東南亞","南亞","歐美","拉丁","非裔","中東","混血","其他"];
export const COUNTRIES  = ["香港","台灣","中國大陸","日本","韓國","新加坡","馬來西亞","美國","加拿大","英國","澳洲","其他"];

/* MBTI compatibility matrix */
const MBTI_COMPAT: Record<string, string[]> = {
  INFP: ["ENFJ","ENTJ","INFJ","ENFP"], INFJ: ["ENFP","ENTP","INFP","INTJ"],
  INTP: ["ENTJ","ENFJ","INTJ","ENTP"], INTJ: ["ENFP","ENTP","INFJ","INTP"],
  ENFP: ["INFJ","INTJ","ENFJ","INFP"], ENFJ: ["INFP","ISFP","ENFP","INFJ"],
  ENTP: ["INFJ","INTJ","INFP","INTP"], ENTJ: ["INFP","INTP","INTJ","ENFP"],
  ISFP: ["ENFJ","ESFJ","ESTJ","ISFJ"], ISFJ: ["ESFP","ESTP","ISFP","ISTJ"],
  ISTP: ["ESTJ","ESFJ","ESTP","ISTJ"], ISTJ: ["ESTJ","ESFJ","ISTP","ISFJ"],
  ESFP: ["ISFJ","ISTJ","ESFJ","ESTP"], ESFJ: ["ISFP","ISTP","ESFP","ISFJ"],
  ESTP: ["ISFJ","ISTJ","ESFP","ISTP"], ESTJ: ["ISTP","ISTJ","ESFJ","ESFP"],
};

export function mbtiCompatibility(a: string, b: string): { score: number; label: string; desc: string } {
  const topMatches = MBTI_COMPAT[a] || [];
  const score = topMatches.indexOf(b);
  if (score === 0) return { score: 98, label: "天作之合", desc: `${a} 與 ${b} 是最理想的搭配，互補且深度共鳴。` };
  if (score === 1) return { score: 88, label: "高度相容", desc: `${a} 與 ${b} 在價值觀和溝通上高度契合。` };
  if (score <= 3) return { score: 75, label: "相當不錯", desc: `${a} 與 ${b} 有不少共同點，需要一些磨合。` };
  // Check reverse
  const reverse = MBTI_COMPAT[b] || [];
  if (reverse.includes(a)) return { score: 70, label: "有潛力", desc: `${a} 與 ${b} 可以互相學習成長。` };
  return { score: 55, label: "需要磨合", desc: `${a} 與 ${b} 性格差異較大，但差異也可以是吸引力。` };
}

/* ─── Sound Engine ───────────────────────────────────── */
class SoundEngine {
  private ctx: AudioContext | null = null;
  enabled = true;
  private get(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }
  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.07) {
    if (!this.enabled) return;
    try {
      const ctx = this.get(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  send()      { this.tone(880, 0.08, "sine", 0.04); }
  like()      { this.tone(523, 0.1); setTimeout(() => this.tone(659, 0.15, "sine", 0.06), 80); }
  superlike() { [659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, "sine", 0.08), i * 80)); }
  pass()      { this.tone(260, 0.12, "triangle", 0.04); }
  match()     { [523,659,784,1047].forEach((f,i) => setTimeout(() => this.tone(f, 0.4, "sine", 0.08), i*100)); }
  tap()       { this.tone(700, 0.05, "sine", 0.03); }
  pop()       { this.tone(440, 0.08, "triangle", 0.04); }
}
export const sound = new SoundEngine();

/* ─── Image compression ──────────────────────────────── */
export async function compressImage(file: File, maxW = 1080, quality = 0.82): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/* ─── Groq ───────────────────────────────────────────── */
export async function groqChat(messages: GMsg[], systemPrompt?: string, fullHistory?: GMsg[], maxTokens = 400): Promise<string> {
  const payload = fullHistory && systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...fullHistory]
    : systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...messages]
      : messages;
  const r = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: TEXT_MODEL, messages: payload, temperature: 0.9, max_tokens: maxTokens }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? "Groq error");
  return d.choices[0].message.content as string;
}
export async function groqVision(imgs: string[], prompt: string, sys: string): Promise<string> {
  const content: any[] = [...imgs.map(b => ({ type: "image_url", image_url: { url: b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}` } })), { type: "text", text: prompt }];
  const r = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: VISION_MODEL, messages: [{ role: "system", content: sys }, { role: "user", content }], temperature: 0.7, max_tokens: 2048 }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? "Vision error");
  return d.choices[0].message.content as string;
}
export async function toB64(f: File): Promise<string> {
  return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result as string); rd.readAsDataURL(f); });
}

/* ─── Supabase helpers ───────────────────────────────── */
export async function lookupEmailByUsername(username: string): Promise<string | null> {
  // Try exact match first
  const { data } = await sb.from("profiles").select("email").eq("username", username.toLowerCase().trim()).maybeSingle();
  return data?.email || null;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const clean = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) return false;
  const { data } = await sb.from("profiles").select("id").eq("username", clean).maybeSingle();
  return !data;
}

export async function getOrCreateConv(uid: string): Promise<string> {
  const { data } = await sb.from("conversations").select("id").eq("user_id", uid).maybeSingle();
  if (data) return data.id;
  const { data: n } = await sb.from("conversations").insert({ user_id: uid }).select("id").single();
  return n!.id;
}
export async function loadNyxMsgs(cid: string): Promise<Msg[]> {
  const { data } = await sb.from("messages").select("*").eq("conversation_id", cid).order("created_at", { ascending: true });
  if (!data) return [];
  return data.map((r: any) => ({ id: r.id, from: r.role as "user" | "nyx", text: r.content || undefined, timestamp: new Date(r.created_at) }));
}
export async function saveNyxMsg(cid: string, role: "user" | "nyx", content: string) {
  await sb.from("messages").insert({ conversation_id: cid, role, content });
}
export async function saveHistory(cid: string, hist: GMsg[]) {
  await sb.from("conversations").update({ nyx_history: JSON.stringify(hist.slice(-20)), updated_at: new Date().toISOString() }).eq("id", cid);
}
export async function loadHistory(cid: string): Promise<GMsg[]> {
  const { data } = await sb.from("conversations").select("nyx_history").eq("id", cid).maybeSingle();
  if (!data?.nyx_history) return []; try { return JSON.parse(data.nyx_history); } catch { return []; }
}
export async function getProfile(uid: string): Promise<UserProfile | null> {
  const { data } = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
  return data as UserProfile | null;
}
export async function updateProfile(uid: string, patch: Partial<UserProfile>) {
  await sb.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", uid);
}
export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const compressed = await compressImage(file, 400, 0.85);
  const ext = "jpg"; const path = `${uid}/avatar_${Date.now()}.${ext}`;
  await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function uploadCover(file: File, uid: string): Promise<string> {
  const compressed = await compressImage(file, 1200, 0.82);
  const path = `${uid}/cover_${Date.now()}.jpg`;
  await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function uploadPhoto(file: File, uid: string, idx: number): Promise<string> {
  const compressed = await compressImage(file, 900, 0.82);
  const path = `${uid}/photo_${idx}_${Date.now()}.jpg`;
  await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function recordSwipe(swiperId: string, swipedId: string, dir: "like" | "pass" | "superlike"): Promise<boolean> {
  // Reset daily count if needed
  await sb.rpc("reset_daily_likes_if_needed", { uid: swiperId });
  if (dir !== "pass") {
    // Increment daily likes
    await sb.from("profiles").update({ daily_likes_used: sb.rpc("increment", {}) } as any).eq("id", swiperId);
    // Simpler approach:
    const { data: p } = await sb.from("profiles").select("daily_likes_used").eq("id", swiperId).single();
    await sb.from("profiles").update({ daily_likes_used: (p?.daily_likes_used || 0) + 1 }).eq("id", swiperId);
  }
  await sb.from("swipes").upsert({ swiper_id: swiperId, swiped_id: swipedId, direction: dir });
  if (dir !== "pass") {
    const { data } = await sb.rpc("check_match", { p_swiper: swiperId, p_swiped: swipedId });
    return data === true;
  }
  return false;
}
export async function getDailyLikeStatus(uid: string): Promise<DailyLikeStatus> {
  await sb.rpc("reset_daily_likes_if_needed", { uid });
  const { data } = await sb.from("profiles").select("daily_likes_used,daily_likes_reset_at").eq("id", uid).single();
  const used = data?.daily_likes_used || 0;
  const limit = DAILY_LIKE_LIMIT;
  return { used, limit, remaining: Math.max(0, limit - used), resetAt: new Date(data?.daily_likes_reset_at || Date.now()), isPremium: false };
}

/* ─── Smart recommendation scoring ──────────────────── */
function scoreProfile(p: any, myProfile: UserProfile): number {
  let score = 0;
  // Recency: active in last 24h = +40, last week = +20
  if (p.last_active) {
    const hrs = (Date.now() - new Date(p.last_active).getTime()) / 3600000;
    if (hrs < 24) score += 40;
    else if (hrs < 168) score += 20;
    else if (hrs < 720) score += 5;
  }
  // Distance: closer = higher score
  if (myProfile.latitude && myProfile.longitude && p.latitude && p.longitude) {
    const dist = haversine(myProfile.latitude, myProfile.longitude, p.latitude, p.longitude);
    if (dist < 10) score += 30;
    else if (dist < 50) score += 20;
    else if (dist < 100) score += 10;
    else if (dist < 300) score += 5;
  }
  // MBTI compatibility
  if (myProfile.mbti && p.mbti) {
    const compat = mbtiCompatibility(myProfile.mbti, p.mbti);
    score += Math.round(compat.score * 0.15);
  }
  // Profile completeness
  if (p.bio) score += 5;
  if (p.photos?.length > 0) score += 8;
  if (p.hobbies?.length > 0) score += 4;
  if (p.is_verified) score += 10;
  // Shared hobbies
  const myHobbies = myProfile.hobbies || [];
  const theirHobbies = p.hobbies || [];
  const shared = myHobbies.filter((h: string) => theirHobbies.includes(h)).length;
  score += shared * 3;
  return score;
}

export async function getExploreProfiles(uid: string, p: UserProfile): Promise<ExploreProfile[]> {
  const { data: swiped }  = await sb.from("swipes").select("swiped_id").eq("swiper_id", uid);
  const { data: blocked } = await sb.from("blocked_users").select("blocked_id").eq("blocker_id", uid);
  const { data: matched } = await sb.from("matches").select("user1_id,user2_id").or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
  const matchedIds = (matched || []).map((m: any) => m.user1_id === uid ? m.user2_id : m.user1_id);
  const excl = [...new Set([uid, ...(swiped || []).map((s: any) => s.swiped_id), ...(blocked || []).map((b: any) => b.blocked_id), ...matchedIds])];
  let q = sb.from("profiles").select("*").neq("id", uid).eq("is_paused", false);
  if (excl.length > 0) q = q.not("id", "in", `(${excl.join(",")})`);
  if (p.looking_for_gender && p.looking_for_gender !== "both") q = q.eq("gender", p.looking_for_gender);
  if (p.filter_country) q = q.eq("country", p.filter_country);
  // Age filter — always include users with no birthday (NULL)
  if (p.filter_min_age && p.filter_min_age > 0) {
    const maxBirthday = new Date();
    maxBirthday.setFullYear(maxBirthday.getFullYear() - p.filter_min_age);
    const maxDate = maxBirthday.toISOString().slice(0,10);
    q = q.or(`birthday.is.null,birthday.lte.${maxDate}`);
  }
  if (p.filter_max_age && p.filter_max_age < 99) {
    const minBirthday = new Date();
    minBirthday.setFullYear(minBirthday.getFullYear() - p.filter_max_age - 1);
    const minDate = minBirthday.toISOString().slice(0,10);
    q = q.or(`birthday.is.null,birthday.gte.${minDate}`);
  }
  // Exclude banned users
  q = q.eq("is_banned", false);
  q = q.order("last_active", { ascending: false }).limit(50);
  const { data } = await q;
  if (!data) return [];
  // Score and sort
  const scored = data
    .map((r: any) => ({ r, score: scoreProfile(r, p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ r }: any) => ({
      id: r.id, name: r.display_name || r.username, age: r.birthday ? calcAge(r.birthday) : null,
      mbti: r.mbti || "INFP", bio: r.bio || "", avatar: r.avatar_url || "",
      photos: r.photos || [], location: r.location_text || "", country: r.country || "",
      ethnicity: r.ethnicity || [], hobbies: r.hobbies || [], verified: r.is_verified || false,
      distance: p.latitude && p.longitude && r.latitude && r.longitude
        ? haversine(p.latitude, p.longitude, r.latitude, r.longitude) : undefined,
    }));
  return scored;
}

export async function getMatches(uid: string): Promise<MatchItem[]> {
  const { data } = await sb.from("matches").select("id,created_at,user1_id,user2_id").or(`user1_id.eq.${uid},user2_id.eq.${uid}`).order("created_at", { ascending: false });
  if (!data) return [];
  return Promise.all(data.map(async (m: any) => {
    const otherId = m.user1_id === uid ? m.user2_id : m.user1_id;
    const { data: prof } = await sb.from("profiles").select("id,display_name,username,avatar_url,last_active,hide_online_status").eq("id", otherId).maybeSingle();
    const { data: last } = await sb.from("chat_messages").select("content,created_at,sender_id").eq("match_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const isMyMsg = last?.sender_id === uid;
    const lastMsg = last?.content
      ? ((last.content.startsWith("https://") || last.content.startsWith("http://")) ? (isMyMsg ? "你：📷 相片" : "📷 相片") : (isMyMsg ? `你：${last.content}` : last.content))
      : "配對成功！打個招呼吧 💕";
    return {
      id: otherId, matchId: m.id, name: prof?.display_name || prof?.username || "?",
      avatar: prof?.avatar_url || "", lastMsg, unread: 0,
      time: new Date(last?.created_at || m.created_at).getTime(),
      lastActive: (prof as any)?.last_active || null,
      hideOnline: (prof as any)?.hide_online_status || false,
    } as any;
  }));
}

export async function loadChatMsgs(matchId: string): Promise<ChatMsg[]> {
  const { data } = await sb.from("chat_messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
  if (!data) return [];
  return data.map((r: any) => ({
    id: r.id, senderId: r.sender_id, content: r.content, timestamp: new Date(r.created_at),
    readAt: r.read_at ? new Date(r.read_at) : null,
    isImage: r.is_image === true || (typeof r.content === "string" && (r.content.startsWith("https://") || r.content.startsWith("http://")) && !r.content.includes(" ") && !r.content.includes("\n")),
  }));
}
export async function sendChatMsg(matchId: string, senderId: string, content: string, isImage = false) {
  await sb.from("chat_messages").insert({ match_id: matchId, sender_id: senderId, content, is_image: isImage });
}
export async function blockUser(a: string, b: string) { await sb.from("blocked_users").upsert({ blocker_id: a, blocked_id: b }); }
export async function reportUser(a: string, b: string, reason: string, category = "other") { await sb.from("reports").insert({ reporter_id: a, reported_id: b, reason, category }); }
export async function deleteAccount(uid: string) { await sb.from("profiles").delete().eq("id", uid); await sb.auth.signOut(); }
export async function getUnreadCount(uid: string): Promise<number> {
  const { count } = await sb.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("read", false);
  return count || 0;
}
export async function markMsgsRead(matchId: string, myUserId: string) {
  await sb.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("match_id", matchId).neq("sender_id", myUserId).is("read_at", null);
}

/* ─── Who liked me ───────────────────────────────────── */
export async function getWhoLikedMe(uid: string): Promise<WhoLikedItem[]> {
  try {
    // Get all swipes where someone liked me
    const { data, error } = await sb.from("swipes")
      .select("swiper_id,direction,created_at")
      .eq("swiped_id", uid)
      .in("direction", ["like", "superlike"])
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    // Get matched IDs to exclude
    const { data: matched } = await sb.from("matches").select("user1_id,user2_id").or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
    const matchedIds = new Set((matched || []).map((m: any) => m.user1_id === uid ? m.user2_id : m.user1_id));
    const unmatched = data.filter((s: any) => !matchedIds.has(s.swiper_id));
    const items = await Promise.all(unmatched.map(async (s: any) => {
      const { data: prof } = await sb.from("profiles").select("id,display_name,username,avatar_url,birthday,mbti").eq("id", s.swiper_id).maybeSingle();
      return {
        id: s.swiper_id,
        name: prof?.display_name || prof?.username || "?",
        age: prof?.birthday ? calcAge(prof.birthday) : null,
        avatar: prof?.avatar_url || "",
        mbti: prof?.mbti || "INFP",
        direction: s.direction as "like" | "superlike",
        timestamp: new Date(s.created_at),
      } as WhoLikedItem;
    }));
    return items;
  } catch (e) {
    console.error("getWhoLikedMe error:", e);
    return [];
  }
}

/* ─── Nyx analysis history ───────────────────────────── */
export async function saveAnalysis(uid: string, msgId: string, msgText: string, isUserMsg: boolean, result: string) {
  await sb.from("nyx_analyses").insert({ user_id: uid, msg_id: msgId, msg_text: msgText.slice(0, 500), is_user_msg: isUserMsg, result });
}
export async function loadAnalysisHistory(uid: string): Promise<NyxAnalysis[]> {
  const { data } = await sb.from("nyx_analyses").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20);
  if (!data) return [];
  return data.map((r: any) => ({ id: r.id, msgId: r.msg_id, msgText: r.msg_text, isUserMsg: r.is_user_msg, result: r.result, createdAt: new Date(r.created_at) }));
}

/* ─── Ice-breaker suggestion ─────────────────────────── */
export async function generateIcebreaker(myMbti: string, theirProfile: { name: string; mbti: string; hobbies: string[]; bio: string }): Promise<string> {
  const prompt = `你剛和${theirProfile.name}配對成功。
他/她的資料：MBTI ${theirProfile.mbti}，興趣：${theirProfile.hobbies.slice(0, 3).join("、")}，簡介：${theirProfile.bio?.slice(0, 60) || "暫無"}
你的MBTI：${myMbti}

給我3個有吸引力的開場白（不要「你好」「嗨」這類無聊開頭），每個換行，簡短有趣，符合兩人性格。只回覆3個句子，不要編號和解釋。`;
  try {
    const r = await groqChat([{ role: "system", content: "你是戀愛教練，擅長寫吸引人的開場白。精簡，不廢話。" }, { role: "user", content: prompt }]);
    return r;
  } catch { return "嗨！看到你的資料很感興趣，想多了解你一些 😊"; }
}

/* ─── AI helpers ─────────────────────────────────────── */
export function buildSys(mbti: string, gender: "male" | "female"): string {
  const sty: Record<string, string> = { INFP:"溫柔引導",INFJ:"深度共鳴",INTP:"邏輯框架",INTJ:"高效精準",ENFP:"playful",ENFJ:"關懷型",ENTP:"幽默拉扯",ENTJ:"主導框架",ISFP:"低調個性",ISFJ:"穩定溫暖",ISTP:"酷感距離",ISTJ:"可靠穩重",ESFP:"活潑有趣",ESFJ:"熱情關懷",ESTP:"直接大膽",ESTJ:"強勢主導" };
  const rp = gender === "male" ? "\n紅藥丸：Frame/IOI-IOD/Hypergamy/Push-Pull/避免Beta行為/稀缺性" : "";
  return `你是「Nyx」高情商AI戀愛分析師，服務${mbti}${gender === "male" ? "男" : "女"}性用戶。${rp}\nMBTI(${mbti})：${sty[mbti] ?? "自然真誠"}\n聊天模式：真實朋友短句最多2-3句不用格式，永不說「收到」等開場白\n分析模式：對方感受+投入度/Frame/訊號/【保守型】&【進攻型】/後續預判/可信度 每段獨立`;
}
export function splitA(t: string): string[] {
  const B = ["【保守型】","【進攻型】","對方感受","Frame","關鍵訊號","回覆策略","後續預判","可信度"];
  const lines = t.split("\n"); const segs: string[] = []; let buf: string[] = [];
  for (const l of lines) { if (B.some(b => l.trimStart().startsWith(b)) && buf.some(x => x.trim())) { const s = buf.join("\n").trim(); if (s) segs.push(s); buf = [l]; } else buf.push(l); }
  const last = buf.join("\n").trim(); if (last) segs.push(last);
  return segs.filter(s => s.trim()).length > 1 ? segs.filter(s => s.trim()) : splitC(t);
}
export function splitC(t: string): string[] {
  const p = t.split(/\n\n+/).map(x => x.trim()).filter(Boolean); if (p.length > 1) return p;
  const l = t.split(/\n/).map(x => x.trim()).filter(Boolean); if (l.length > 1) return l;
  if (t.length > 60) { const pts = t.split(/(?<=[！？。～])\s*/).filter(Boolean); const chunks: string[] = []; let buf = ""; for (const p2 of pts) { buf += p2; if (buf.length >= 25) { chunks.push(buf.trim()); buf = ""; } } if (buf.trim()) chunks.push(buf.trim()); if (chunks.length > 1) return chunks; }
  return [t];
}
export function detectMode(t: string, img: boolean): "analysis" | "chat" {
  if (img) return "analysis";
  return /她說|他說|對方|截圖|聊天記錄|怎麼回|幫我分析|應該怎|這句|她的意思|有沒有喜歡|完整分析|詳細分析|興趣度|回法/.test(t) ? "analysis" : "chat";
}
export function calcAge(b: string | null): number | null {
  if (!b) return null; const born = new Date(b), today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age--;
  return age;
}
export function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
export function calcCompletion(p: UserProfile): number {
  const f = [p.display_name, p.birthday, p.location_text, p.bio, p.avatar_url, (p.hobbies || []).length > 0, (p.photos || []).length > 0];
  return Math.round(f.filter(Boolean).length / f.length * 100);
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const detMs = (t: string) => Math.min(800 + t.length * 10, 2800);
export const casMs = (t: string) => Math.min(280 + t.length * 5, 1300);
export const fmtTime = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
export function fmtDate(d: Date): string {
  const today = new Date(); const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "今天";
  if (d.toDateString() === yest.toDateString()) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
export function fmtMsgTime(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "剛剛";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分鐘前`;
  if (d.toDateString() === now.toDateString()) return fmtTime(d);
  if (diff < 86400000 * 2) return "昨天";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ─── Reverse geocoding ──────────────────────────────── */
export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; country: string }> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-TW`, { headers: { "User-Agent": "NYX-App/1.0" } });
    const d = await r.json(); const a = d.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state || "";
    const cm: Record<string, string> = { "Taiwan": "台灣", "Hong Kong": "香港", "Japan": "日本", "South Korea": "韓國", "Singapore": "新加坡", "Malaysia": "馬來西亞", "United States": "美國", "Canada": "加拿大", "United Kingdom": "英國", "Australia": "澳洲", "China": "中國大陸" };
    return { city, country: cm[a.country] || a.country || "" };
  } catch { return { city: "", country: "" }; }
}
export async function searchCities(q: string): Promise<{ name: string; country: string; lat: number; lon: number }[]> {
  if (q.length < 2) return [];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&featuretype=city&accept-language=zh-TW`, { headers: { "User-Agent": "NYX-App/1.0" } });
    const d = await r.json();
    return d.map((item: any) => ({ name: item.display_name.split(",")[0], country: item.display_name.split(",").slice(-1)[0].trim(), lat: parseFloat(item.lat), lon: parseFloat(item.lon) }));
  } catch { return []; }
}

export type Lang = "zh" | "en";

/* ═══ GLOBAL CSS ══════════════════════════════════════════ */

/* ─── Encounter Engine ───────────────────────────────── */
export interface Encounter {
  id: string; matchId: string;
  sceneText: string; optionA: string; optionB: string; optionC?: string;
  choiceUser1?: string; choiceUser2?: string;
  user1Id: string; user2Id: string;
  revealedAt?: Date; createdAt: Date;
}
export interface DailySpark {
  id: string; matchId: string;
  user1Id: string; user2Id: string;
  question: string;
  answerUser1?: string; answerUser2?: string;
  sparkDate: string; revealedAt?: Date;
}
export interface Memory {
  id: string; matchId: string;
  type: "encounter"|"spark"|"milestone"|"first_message";
  title: string; content: any; createdAt: Date;
}
export interface BondInfo {
  level: number; label: string; chemistryScore: number;
  encounterCount: number; sparkCount: number;
}

const BOND_LABELS = ["初識","熟悉","心動","羈絆","靈魂伴侶"];

export async function getOrCreateEncounter(matchId: string, user1Id: string, user2Id: string, user1: Partial<UserProfile>, user2: Partial<UserProfile>): Promise<Encounter|null> {
  // Check today's pending encounter
  const { data: existing } = await sb.from("encounters")
    .select("*").eq("match_id", matchId)
    .is("revealed_at", null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (existing) return mapEncounter(existing);
  // Check if one was already completed today
  const today = new Date().toISOString().slice(0,10);
  const { data: todayDone } = await sb.from("encounters")
    .select("id").eq("match_id", matchId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`)
    .not("revealed_at","is",null).maybeSingle();
  if (todayDone) return null; // Already completed one today
  // Also check for ANY encounter (revealed or not) created today — prevent duplicate generation
  const { data: todayAny } = await sb.from("encounters")
    .select("id").eq("match_id", matchId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`)
    .maybeSingle();
  // If unrevealed today encounter exists, return it (already handled above via existing check)
  if (todayAny && !todayDone) {
    // There's a pending one — already returned above via `existing` check
    return null;
  }
  // Generate new
  return await generateEncounter(matchId, user1Id, user2Id, user1, user2);
}

export async function generateEncounter(matchId: string, user1Id: string, user2Id: string, u1: Partial<UserProfile>, u2: Partial<UserProfile>): Promise<Encounter|null> {
  try {
    const interests = [...(u1.hobbies||[]), ...(u2.hobbies||[])].slice(0,4).join("、");
    const m1 = u1.mbti||"INFP", m2 = u2.mbti||"INFJ";
    const prompt = `為 ${m1} 和 ${m2} 類型的人設計一個有趣的共同場景，讓兩人用自由文字回答「你會怎麼做？」。
要求：
- 場景25字以內，日常但有趣，略帶幽默或意外感
- 場景要開放性，沒有標準答案，讓人想說故事
- 興趣參考：${interests||"旅行、美食"}
- 例子：「深夜便利店只剩最後一個飯糰，你們同時伸手拿到了」
只返回JSON：{"scene":"場景描述"}`;
    const raw = await groqChat([{role:"system",content:"你是創意故事設計師，只返回合法JSON，不加任何解釋。"},{role:"user",content:prompt}]);
    const cleaned = raw.replace(/```json|```/g,"").trim();
    const parsed = JSON.parse(cleaned);
    const { data, error } = await sb.from("encounters").insert({
      match_id: matchId, user1_id: user1Id, user2_id: user2Id,
      scene_text: parsed.scene,
      option_a: "", option_b: "", // kept for DB compatibility, not used
    }).select().single();
    if (error) throw error;
    return mapEncounter(data);
  } catch(e) { console.error("generateEncounter error",e); return null; }
}

export async function submitEncounterChoice(encounterId: string, userId: string, user1Id: string, choice: string): Promise<{revealed: boolean; encounter: Encounter}> {
  const field = userId === user1Id ? "choice_user1" : "choice_user2";
  await sb.from("encounters").update({ [field]: choice }).eq("id", encounterId);
  // Check if both answered
  const { data } = await sb.from("encounters").select("*").eq("id", encounterId).single();
  const enc = mapEncounter(data);
  if (enc.choiceUser1 && enc.choiceUser2 && !enc.revealedAt) {
    await sb.from("encounters").update({ revealed_at: new Date().toISOString() }).eq("id", encounterId);
    enc.revealedAt = new Date();
    // Save to memories
    await sb.from("memories").insert({
      match_id: enc.matchId, user1_id: enc.user1Id, user2_id: enc.user2Id,
      type: "encounter", title: enc.sceneText.slice(0,20)+"...",
      content: { scene: enc.sceneText, choiceA: enc.choiceUser1, choiceB: enc.choiceUser2 },
    });
    await sb.from("matches").update({
      encounter_count: sb.rpc("increment",{}) as any,
      last_encounter_at: new Date().toISOString(),
    }).eq("id", enc.matchId);
    await sb.rpc("update_chemistry", { p_match_id: enc.matchId });
    return { revealed: true, encounter: enc };
  }
  return { revealed: false, encounter: enc };
}

function mapEncounter(d: any): Encounter {
  return { id:d.id, matchId:d.match_id, sceneText:d.scene_text, optionA:d.option_a, optionB:d.option_b, optionC:d.option_c,
    choiceUser1:d.choice_user1, choiceUser2:d.choice_user2, user1Id:d.user1_id, user2Id:d.user2_id,
    revealedAt:d.revealed_at?new Date(d.revealed_at):undefined, createdAt:new Date(d.created_at) };
}

/* ─── Daily Spark ────────────────────────────────────── */
// Question bank — tiered by depth, used in sequence
const SPARK_QUESTIONS_L1 = [
  // Light — builds safety, fun, specific
  "你手機裡最常聽的一首歌是什麼？它讓你想到什麼？",
  "最近一件讓你意外開心的小事是什麼？",
  "你有沒有一個只有你自己知道的小習慣？",
  "最近讓你笑得最開心的一件事是什麼？",
  "如果今晚可以去任何地方吃晚飯，你想去哪裡？",
  "你現在手機桌面是什麼？為什麼是它？",
  "你覺得自己有什麼別人不知道的才能？",
  "最近有沒有一首歌或一部劇讓你停不下來？",
];
const SPARK_QUESTIONS_L2 = [
  // Medium — personality, values, memories
  "你最近一次說謊是什麼？說的什麼？",
  "你覺得自己最被低估的地方是什麼？",
  "什麼時候你覺得自己最像自己？",
  "你有沒有一件事做了之後覺得自己很勇敢？",
  "你最捨不得的一段記憶是什麼？",
  "什麼樣的人讓你第一眼就有好感？具體說說。",
  "你現在生活裡最享受的一個時刻是什麼？",
  "你有沒有一個地方，去了就會很安靜下來？",
  "最近有沒有一件你意外發現自己很在乎的事？",
  "你覺得自己和大多數人最不一樣的地方是什麼？",
];
const SPARK_QUESTIONS_L3 = [
  // Deep — vulnerability, real connection
  "你什麼時候覺得最孤獨？",
  "有沒有一個夢想，從來沒跟任何人說過？",
  "你覺得自己值得被好好愛嗎？為什麼這樣覺得？",
  "如果要對五年前的自己說一句話，你說什麼？",
  "你現在最缺少的是什麼？",
  "你有沒有一段關係，讓你學到了一些東西，但說出來很難？",
  "你什麼時候覺得最接近自己想成為的那個人？",
  "有沒有一件事，你一直覺得自己應該更勇敢去做？",
  "你覺得現在的自己，和你想象中的自己差多遠？",
  "如果你可以讓某個人真正了解你，你最想讓他們知道什麼？",
];

export async function getTodaySpark(matchId: string, user1Id: string, user2Id: string): Promise<DailySpark|null> {
  const today = new Date().toISOString().slice(0,10);
  const { data: existing } = await sb.from("daily_sparks")
    .select("*").eq("match_id", matchId).eq("spark_date", today).maybeSingle();
  if (existing) return mapSpark(existing);
  // Pick question tier based on how many sparks completed
  const { count } = await sb.from("daily_sparks")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId).not("revealed_at","is",null);
  const done = count || 0;
  let pool = done < 5 ? SPARK_QUESTIONS_L1 : done < 15 ? SPARK_QUESTIONS_L2 : SPARK_QUESTIONS_L3;
  // Don't repeat questions
  const { data: used } = await sb.from("daily_sparks").select("question").eq("match_id", matchId);
  const usedSet = new Set((used||[]).map((r:any) => r.question));
  const available = pool.filter(q => !usedSet.has(q));
  // If all used, reset from next tier
  const finalPool = available.length > 0 ? available : pool;
  const q = finalPool[Math.floor(Math.random() * finalPool.length)];
  const { data, error } = await sb.from("daily_sparks")
    .insert({ match_id:matchId, user1_id:user1Id, user2_id:user2Id, question:q, spark_date:today })
    .select().single();
  if (error) return null;
  return mapSpark(data);
}

export async function submitSparkAnswer(sparkId: string, userId: string, user1Id: string, answer: string): Promise<{revealed:boolean; spark:DailySpark}> {
  const field = userId === user1Id ? "answer_user1" : "answer_user2";
  await sb.from("daily_sparks").update({ [field]: answer }).eq("id", sparkId);
  const { data } = await sb.from("daily_sparks").select("*").eq("id", sparkId).single();
  const spark = mapSpark(data);
  if (spark.answerUser1 && spark.answerUser2 && !spark.revealedAt) {
    await sb.from("daily_sparks").update({ revealed_at: new Date().toISOString() }).eq("id", sparkId);
    spark.revealedAt = new Date();
    await sb.from("memories").insert({
      match_id:spark.matchId, user1_id:spark.user1Id, user2_id:spark.user2Id,
      type:"spark", title:spark.question.slice(0,25)+"...",
      content:{ question:spark.question, answerA:spark.answerUser1, answerB:spark.answerUser2 },
    });
    await sb.from("matches").update({ spark_count: sb.rpc("increment",{}) as any }).eq("id", spark.matchId);
    await sb.rpc("update_chemistry",{ p_match_id: spark.matchId });
    return { revealed:true, spark };
  }
  return { revealed:false, spark };
}

function mapSpark(d: any): DailySpark {
  return { id:d.id, matchId:d.match_id, user1Id:d.user1_id, user2Id:d.user2_id,
    question:d.question, answerUser1:d.answer_user1, answerUser2:d.answer_user2,
    sparkDate:d.spark_date, revealedAt:d.revealed_at?new Date(d.revealed_at):undefined };
}

/* ─── Memory Wall ────────────────────────────────────── */
export async function getMemories(matchId: string): Promise<Memory[]> {
  const { data } = await sb.from("memories").select("*")
    .eq("match_id", matchId).order("created_at",{ascending:true});
  return (data||[]).map((d:any) => ({
    id:d.id, matchId:d.match_id, type:d.type, title:d.title,
    content:d.content, createdAt:new Date(d.created_at),
  }));
}
export async function getBondInfo(matchId: string): Promise<BondInfo> {
  const { data } = await sb.from("matches")
    .select("bond_level,chemistry_score,encounter_count,spark_count")
    .eq("id", matchId).maybeSingle();
  const lvl = Math.min(4, Math.floor(((data?.encounter_count||0)+(data?.spark_count||0))/3));
  return {
    level: lvl, label: BOND_LABELS[lvl],
    chemistryScore: data?.chemistry_score||50,
    encounterCount: data?.encounter_count||0, sparkCount: data?.spark_count||0,
  };
}

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body{height:100%;background:#0C0A08;overscroll-behavior:none;}
  *{font-family:'Inter','Noto Sans TC',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  ::placeholder{color:rgba(245,237,214,0.20);font-weight:400;}
  ::-webkit-scrollbar{width:2px;} ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.18);border-radius:2px;}
  ::-webkit-calendar-picker-indicator{filter:invert(1) opacity(.35);}
  input[type=range]{-webkit-appearance:none;appearance:none;height:2px;border-radius:2px;background:rgba(201,168,76,0.12);outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#C9A84C;cursor:pointer;box-shadow:0 0 0 3px rgba(201,168,76,0.18);}

  @keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.35;}30%{transform:translateY(-5px);opacity:1;}}
  @keyframes slideUp{from{transform:translateY(60px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  @keyframes emojiUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes dropDown{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
  @keyframes userIn{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}
  @keyframes nyxIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
  @keyframes springIn{0%{transform:scale(.9);opacity:0;}60%{transform:scale(1.02);}100%{transform:scale(1);opacity:1;}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes tabSwitch{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
  @keyframes btnPulse{0%,100%{box-shadow:0 4px 20px rgba(201,168,76,0.22);}50%{box-shadow:0 4px 32px rgba(201,168,76,0.42);}}
  @keyframes heartBeat{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}
  @keyframes heartBurst{0%{opacity:1;transform:translate(-50%,-50%) scale(0);}80%{opacity:.7;}100%{opacity:0;transform:translate(calc(-50% + var(--x,0px)),calc(-50% + var(--y,0px))) scale(1.6);}}
  @keyframes cherryFall{0%{transform:translateY(-20px) rotate(0deg);opacity:.6;}100%{transform:translateY(110vh) rotate(720deg);opacity:0;}}
  @keyframes matchPop{0%{transform:scale(0.75);opacity:0;}60%{transform:scale(1.04);}100%{transform:scale(1);opacity:1;}}
  @keyframes cardReveal{0%{transform:scale(.95) translateY(8px);opacity:0;}100%{transform:scale(1) translateY(0);opacity:1;}}
  @keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0);}50%{box-shadow:0 0 16px 4px rgba(201,168,76,0.2);}}
`;

/* ─── Data Export ────────────────────────────────────── */
export async function exportUserData(uid: string): Promise<void> {
  const [profile, matches, messages] = await Promise.all([
    sb.from("profiles").select("*").eq("id", uid).single(),
    sb.from("matches").select("*").or(`user1_id.eq.${uid},user2_id.eq.${uid}`),
    sb.from("messages").select("*").eq("conversation_id", uid).limit(500),
  ]);
  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    matches: matches.data,
    nyxMessages: messages.data,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `nyx_data_${Date.now()}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
