import { createClient } from "@supabase/supabase-js";
import type { GMsg, UserProfile, ExploreProfile, FavoriteProfile, MatchItem, Msg, ChatMsg, WhoLikedItem, ProfileViewerItem, NyxAnalysis, DailyLikeStatus, PremiumPlan } from "./types";
import { resolveAvatar } from "./avatar";
import { getActivePremiumPlan } from "./subscription";

/* ─── Config ─────────────────────────────────────────── */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL;

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Keep provider credentials and API calls inside the authenticated Edge Function.
// Qwen 3.6 replaces the retired Llama models and supports both text and vision.
export const TEXT_MODEL   = "qwen/qwen3.6-27b";
export const VISION_MODEL = "qwen/qwen3.6-27b";
type GroqVisionPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

type MatchRelationRow = { id: string; created_at: string; user1_id: string; user2_id: string };
type SwipeTargetRow = { swiped_id: string };
type BlockedTargetRow = { blocked_id: string };
type SwipeSourceRow = { swiper_id: string; direction: "like" | "superlike"; created_at: string };
type FavoriteRow = { favorite_user_id: string; created_at: string };
type ExploreProfileRow = Partial<UserProfile> & {
  id: string;
  display_name?: string | null;
  username?: string | null;
  created_at?: string | null;
};
type NyxMessageRow = { id: string; role: "user" | "nyx"; content: string | null; created_at: string };
type ChatMessageRow = {
  id: string; sender_id: string; content: string; created_at: string;
  read_at: string | null; is_image: boolean | null;
};
type AnalysisRow = {
  id: string; msg_id: string; msg_text: string; is_user_msg: boolean;
  result: string; created_at: string;
};
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Turn provider/network auth failures into short, actionable UI copy. */
export function authErrorMessage(error: unknown, fallback = "操作失敗，請稍後再試"): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) return "請先確認信箱中的驗證郵件";
  if (normalized.includes("invalid login")) return "帳號或密碼錯誤";
  if (normalized.includes("user already registered")) return "這個電子郵件已經註冊";
  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) return "這個登入方式尚未在服務端啟用";
  if (normalized.includes("sms") && (normalized.includes("provider") || normalized.includes("send"))) return "驗證短訊暫時無法送出，請稍後再試";
  if (normalized.includes("token has expired") || normalized.includes("otp expired")) return "驗證碼已過期，請重新取得";
  if (normalized.includes("invalid token") || normalized.includes("invalid otp")) return "驗證碼不正確，請重新輸入";
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed")
  ) {
    return "暫時無法連接服務，請檢查網路後再試";
  }

  return message || fallback;
}

/* ═══ DESIGN TOKENS — Porcelain Violet (2026) ═════════════
   Keep the legacy gold/rose property names for compatibility with the
   existing screens. `gold` is now NYX violet and `rose` is the emotional
   coral accent, so every screen can migrate without a risky big-bang rename. */
export const C = {
  bg:           "#F7F7FC",
  bgCard:       "rgba(255,255,255,0.94)",
  bgElevated:   "#FFFFFF",
  bgGold:       "#F0EEFF",
  surf:         "rgba(92,72,172,0.06)",
  surfHigh:     "rgba(92,72,172,0.105)",
  surfGold:     "rgba(103,87,217,0.09)",
  gold:         "#6757D9",
  goldLight:    "#8B7FF0",
  goldSoft:     "rgba(103,87,217,0.12)",
  goldGlow:     "rgba(103,87,217,0.24)",
  rose:         "#EF5F7A",
  roseSoft:     "rgba(239,95,122,0.12)",
  roseGlow:     "rgba(239,95,122,0.24)",
  mint:         "#16A589",
  mintSoft:     "rgba(22,165,137,0.11)",
  superlike:    "#4F7FEA",
  superlikeSoft:"rgba(79,127,234,0.11)",
  danger:       "#D94B63",
  dangerSoft:   "rgba(217,75,99,0.10)",
  warning:      "#E89032",
  white:        "#FFFFFF",
  overlay:      "rgba(36,30,53,0.46)",
  overlayStrong:"rgba(25,18,43,0.92)",
  get pink()      { return this.rose; },
  get violet()    { return this.gold; },
  get pinkSoft()  { return this.roseSoft; },
  get pinkGlow()  { return this.roseGlow; },
  get teal()      { return this.mint; },
  get tealSoft()  { return this.mintSoft; },
  text:         "#241E35",
  textSub:      "rgba(36,30,53,0.70)",
  textMuted:    "rgba(36,30,53,0.48)",
  textDim:      "rgba(36,30,53,0.30)",
  border:       "rgba(68,52,112,0.13)",
  borderHigh:   "rgba(68,52,112,0.23)",
  borderFocus:  "rgba(103,87,217,0.48)",
  nav:          "rgba(255,255,255,0.90)",
  glass:        "rgba(255,255,255,0.82)",
  shadow:       "0 14px 38px rgba(57,42,101,0.10)",
  shadowStrong: "0 24px 70px rgba(57,42,101,0.17)",
  grad:         "linear-gradient(135deg,#6757D9,#8B7FF0)",
  gradRose:     "linear-gradient(135deg,#EF5F7A,#FF8A82)",
  gradMint:     "linear-gradient(135deg,#16A589,#45CBB1)",
  gradGold:     "linear-gradient(135deg,#6757D9,#8B7FF0)",
  gradSuper:    "linear-gradient(135deg,#4F7FEA,#7EA7FF)",
  gradAmbient:  "radial-gradient(circle at 18% 8%,rgba(103,87,217,.17),transparent 34%),radial-gradient(circle at 90% 24%,rgba(239,95,122,.13),transparent 30%),linear-gradient(180deg,#FCFBFF,#F7F7FC)",
  gradDark:     "linear-gradient(180deg,transparent,rgba(25,18,43,0.92))",
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

export function mbtiCompatibility(a: string, b: string, hobbiesA: string[] = [], hobbiesB: string[] = []): { score: number; label: string; desc: string } {
  const topMatches = MBTI_COMPAT[a] || [];
  const rank = topMatches.indexOf(b);
  // rank is -1 when b isn't in a's top-4 list — that must NOT fall through
  // to the "rank <= 3" branch below (a bug that made almost every pairing
  // that wasn't an exact top-match land on the same 75%, since -1 <= 3).
  let base: number;
  if (rank === 0) base = 96;
  else if (rank === 1) base = 88;
  else if (rank === 2 || rank === 3) base = 76;
  else {
    const reverse = MBTI_COMPAT[b] || [];
    base = reverse.includes(a) ? 68 : 55;
  }
  // Real shared interests nudge two specific people's score up or down from
  // the generic MBTI-pair baseline, instead of everyone with the same MBTI
  // pairing always landing on an identical number.
  const shared = hobbiesA.filter(h => hobbiesB.includes(h)).length;
  const score = Math.max(40, Math.min(99, base + shared * 3));
  const label = score >= 90 ? "天作之合" : score >= 80 ? "高度相容" : score >= 65 ? "相當不錯" : score >= 55 ? "有潛力" : "需要磨合";
  const desc = score >= 90 ? `${a} 與 ${b} 是最理想的搭配，互補且深度共鳴。`
    : score >= 80 ? `${a} 與 ${b} 在價值觀和溝通上高度契合。`
    : score >= 65 ? `${a} 與 ${b} 有不少共同點，需要一些磨合。`
    : score >= 55 ? `${a} 與 ${b} 可以互相學習成長。`
    : `${a} 與 ${b} 性格差異較大，但差異也可以是吸引力。`;
  return { score, label, desc };
}

/* ─── Sound Engine ───────────────────────────────────── */
class SoundEngine {
  private ctx: AudioContext | null = null;
  enabled = true;
  private get(): AudioContext {
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Web Audio is not supported");
      this.ctx = new AudioContextCtor();
    }
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
    } catch {
      // Audio feedback is optional; browsers may block it before a user gesture.
    }
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
async function invokeGroq(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await sb.functions.invoke("groq-proxy", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    let status: number | undefined;
    let providerDetail = "";
    if (context instanceof Response) {
      status = context.status;
      try {
        providerDetail = await context.clone().text();
      } catch {
        // The response body may already have been consumed by the SDK.
      }
    }
    console.error("AI Edge Function request failed", {
      status,
      message: error.message,
      detail: providerDetail.slice(0, 300),
    });
    if (status === 401) throw new Error("登入狀態已過期，請重新登入後再試");
    if (status === 404) throw new Error("AI 服務尚未完成部署，請稍後再試");
    if (status === 429) throw new Error("AI 使用量暫時達到上限，請稍後再試");
    if (status && status >= 500) throw new Error("AI 服務暫時無法使用，請稍後再試");
    throw new Error(error.message || "AI 服務連線失敗");
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("AI returned an empty response");
  return content;
}

export async function groqChat(messages: GMsg[], systemPrompt?: string, fullHistory?: GMsg[], maxTokens = 400, temperature = 0.9): Promise<string> {
  const payload = fullHistory && systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...fullHistory]
    : systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...messages]
      : messages;
  return invokeGroq({ model: TEXT_MODEL, messages: payload, temperature, max_tokens: maxTokens });
}

export async function groqJson<T>(messages: GMsg[], systemPrompt: string, maxTokens = 2048): Promise<T> {
  const raw = await invokeGroq({
    model: TEXT_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.15,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as T;
}

export async function groqVision(imgs: string[], prompt: string, sys: string, maxTokens = 2048, temperature = 0.25): Promise<string> {
  if (imgs.length === 0 || imgs.length > 3) throw new Error("每個圖片分析批次必須包含 1 至 3 張圖片");
  const content: GroqVisionPart[] = [...imgs.map(b => ({ type: "image_url" as const, image_url: { url: b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}` } })), { type: "text", text: prompt }];
  return invokeGroq({ model: VISION_MODEL, messages: [{ role: "system", content: sys }, { role: "user", content }], temperature, max_tokens: maxTokens });
}

export async function groqVisionJson<T>(imgs: string[], prompt: string, sys: string, maxTokens = 3072): Promise<T> {
  if (imgs.length === 0 || imgs.length > 3) throw new Error("每個圖片分析批次必須包含 1 至 3 張圖片");
  const content: GroqVisionPart[] = [...imgs.map(b => ({ type: "image_url" as const, image_url: { url: b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}` } })), { type: "text", text: prompt }];
  const raw = await invokeGroq({
    model: VISION_MODEL,
    messages: [{ role: "system", content: sys }, { role: "user", content }],
    temperature: 0.1,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as T;
}
export async function toB64(f: File): Promise<string> {
  const source = f.type.startsWith("image/") ? await compressImage(f, 1280, 0.72) : f;
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onloadend = () => resolve(rd.result as string);
    rd.onerror = () => reject(rd.error || new Error("圖片讀取失敗"));
    rd.readAsDataURL(source);
  });
}

/* ─── Supabase helpers ───────────────────────────────── */
export async function lookupEmailByUsername(username: string): Promise<string | null> {
  // Try exact match first
  const { data } = await sb.from("profiles").select("email").eq("username", username.toLowerCase().trim()).maybeSingle();
  return data?.email || null;
}

export async function checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const clean = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) return false;
  const { data, error } = await sb.from("profiles").select("id").eq("username", clean).maybeSingle();
  if (error) throw error;
  return !data || data.id === currentUserId;
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
  return (data as unknown as NyxMessageRow[]).map(r => ({ id: r.id, from: r.role, text: r.content || undefined, timestamp: new Date(r.created_at) }));
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
  const { data, error } = await sb.from("profiles").select(
    "id,username,display_name,birthday,location_text,latitude,longitude,country,ethnicity,hobbies,avatar_url,photos,gender,mbti,bio,looking_for_gender,filter_min_age,filter_max_age,filter_max_distance,filter_country,filter_ethnicity,is_verified,onboarding_done,is_premium,premium_plan,premium_expires_at,is_banned,ban_reason,is_active,is_paused,deleted_at,language,hide_online_status,last_active,occupation,education,income,height_cm,drinking,smoking,exercise,has_pets,want_children,relationship_goal,love_language",
  ).eq("id", uid).maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}
export async function updateProfile(uid: string, patch: Partial<UserProfile>) {
  if (typeof patch.bio === "string" && patch.bio.trim()) await moderateContent({ text: patch.bio });
  const { error } = await sb.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", uid);
  if (error) throw error;
}
export async function moderateContent(input: { text?: string; image?: string }) {
  const { data, error } = await sb.functions.invoke("moderate-content", { body: input });
  if (error) throw new Error("安全檢查暫時無法使用，請稍後再試");
  if (!data?.allowed) throw new Error(data?.reason || "內容不符合社群規範");
}
export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const compressed = await compressImage(file, 400, 0.85);
  await moderateContent({ image: await toB64(compressed) });
  const ext = "jpg"; const path = `${uid}/avatar_${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function uploadCover(file: File, uid: string): Promise<string> {
  const compressed = await compressImage(file, 1200, 0.82);
  await moderateContent({ image: await toB64(compressed) });
  const path = `${uid}/cover_${Date.now()}.jpg`;
  const { error } = await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function uploadPhoto(file: File, uid: string, idx: number): Promise<string> {
  const compressed = await compressImage(file, 900, 0.82);
  await moderateContent({ image: await toB64(compressed) });
  const path = `${uid}/photo_${idx}_${Date.now()}.jpg`;
  const { error } = await sb.storage.from("photos").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
export async function recordSwipe(swiperId: string, swipedId: string, dir: "like" | "pass" | "superlike"): Promise<boolean> {
  const { data, error } = await sb.rpc("record_swipe_action", { p_swiped: swipedId, p_direction: dir });
  if (!error) return data === true;

  // Temporary compatibility for environments where schema_v3.sql has not
  // been deployed yet. Never bypass a real server-side limit or validation.
  if (error.code !== "PGRST202") throw error;
  const { error: resetError } = await sb.rpc("reset_daily_likes_if_needed", { uid: swiperId });
  if (resetError) throw resetError;
  const { data: existingSwipe, error: existingError } = await sb.from("swipes")
    .select("direction")
    .eq("swiper_id", swiperId)
    .eq("swiped_id", swipedId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingSwipe?.direction === dir) {
    if (dir === "pass") return false;
    const { data: matched, error: matchError } = await sb.rpc("check_match", { p_swiper: swiperId, p_swiped: swipedId });
    if (matchError) throw matchError;
    return matched === true;
  }
  if (dir !== "pass") {
    const field = dir === "superlike" ? "superlike_used_today" : "daily_likes_used";
    const { data: usage, error: readError } = await sb.from("profiles").select(`${field},is_premium`).eq("id", swiperId).single();
    if (readError) throw readError;
    const usageRow = usage as Record<string, number | boolean | null> | null;
    const current = Number(usageRow?.[field] || 0);
    const premium = usageRow?.is_premium === true;
    if (dir === "like" && !premium && current >= DAILY_LIKE_LIMIT) throw new Error("今日喜歡次數已用完");
    if (dir === "superlike" && current >= (premium ? 5 : 1)) throw new Error("今日優先認識次數已用完");
    const { error: usageError } = await sb.from("profiles").update({ [field]: current + 1 }).eq("id", swiperId);
    if (usageError) throw usageError;
  }
  const { error: swipeError } = await sb.from("swipes").upsert({ swiper_id: swiperId, swiped_id: swipedId, direction: dir });
  if (swipeError) throw swipeError;
  if (dir === "pass") return false;
  const { data: matched, error: matchError } = await sb.rpc("check_match", { p_swiper: swiperId, p_swiped: swipedId });
  if (matchError) throw matchError;
  return matched === true;
}
export async function getDailyLikeStatus(uid: string): Promise<DailyLikeStatus> {
  await sb.rpc("reset_daily_likes_if_needed", { uid });
  const { data } = await sb.from("profiles")
    .select("daily_likes_used,daily_likes_reset_at,is_premium,premium_plan,premium_expires_at,superlike_used_today,clone_used_today")
    .eq("id", uid).single();
  const activePlan = getActivePremiumPlan(data);
  const isPremium = activePlan !== null;
  const plan = activePlan || "free"; // "free" | "premium" | "premium_plus"
  const used = data?.daily_likes_used || 0;
  const limit = isPremium ? 99999 : DAILY_LIKE_LIMIT;
  const superlikeUsed = data?.superlike_used_today || 0;
  const superlikeLimit = isPremium ? 5 : 1;
  const cloneUsed = data?.clone_used_today || 0;
  const cloneLimit = plan === "premium_plus" ? 50 : isPremium ? 20 : 3;
  return {
    used, limit, remaining: Math.max(0, limit - used),
    resetAt: new Date(data?.daily_likes_reset_at || Date.now()),
    isPremium, plan,
    superlikeUsed, superlikeLimit,
    superlikeRemaining: Math.max(0, superlikeLimit - superlikeUsed),
    cloneUsed, cloneLimit,
    cloneRemaining: Math.max(0, cloneLimit - cloneUsed),
  };
}

/* ─── Smart recommendation scoring ──────────────────── */
function scoreProfile(p: ExploreProfileRow, myProfile: UserProfile): number {
  let score = 0;
  // Recency: active in last 24h = +40, last week = +20
  if (p.last_active) {
    const hrs = (Date.now() - new Date(p.last_active).getTime()) / 3600000;
    if (hrs < 24) score += 40;
    else if (hrs < 168) score += 20;
    else if (hrs < 720) score += 5;
  }
  // Distance: closer = higher score
  if (myProfile.latitude != null && myProfile.longitude != null && p.latitude != null && p.longitude != null) {
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
  if ((p.photos?.length || 0) > 0) score += 8;
  if ((p.hobbies?.length || 0) > 0) score += 4;
  if (p.is_verified) score += 10;
  // Shared hobbies
  const myHobbies = myProfile.hobbies || [];
  const theirHobbies = p.hobbies || [];
  const shared = myHobbies.filter((h: string) => theirHobbies.includes(h)).length;
  score += shared * 3;
  return score;
}

export type ExploreSortMode = "recommend" | "nearby" | "new";

export function sortExploreCandidates<T extends { score: number; distance?: number; createdAt?: string | null }>(items: T[], mode: ExploreSortMode): T[] {
  return [...items].sort((a, b) => {
    if (mode === "nearby") {
      const distanceA = a.distance ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distance ?? Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) return distanceA - distanceB;
    }
    if (mode === "new") {
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdA !== createdB) return createdB - createdA;
    }
    return b.score - a.score;
  });
}

export async function getExploreProfiles(uid: string, p: UserProfile, mode: ExploreSortMode = "recommend"): Promise<ExploreProfile[]> {
  const { data: swiped }  = await sb.from("swipes").select("swiped_id").eq("swiper_id", uid);
  const { data: blocked } = await sb.from("blocked_users").select("blocked_id").eq("blocker_id", uid);
  const { data: matched } = await sb.from("matches").select("user1_id,user2_id").or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
  const matchedIds = ((matched || []) as unknown as MatchRelationRow[]).map(m => m.user1_id === uid ? m.user2_id : m.user1_id);
  const excl = [...new Set([
    uid,
    ...((swiped || []) as unknown as SwipeTargetRow[]).map(s => s.swiped_id),
    ...((blocked || []) as unknown as BlockedTargetRow[]).map(b => b.blocked_id),
    ...matchedIds,
  ])];
  let q = sb.from("profiles").select("id,display_name,username,birthday,gender,mbti,bio,avatar_url,photos,location_text,country,ethnicity,hobbies,is_verified,is_premium,premium_plan,premium_expires_at,latitude,longitude,occupation,education,income,height_cm,drinking,smoking,exercise,has_pets,want_children,relationship_goal,love_language,last_active,created_at,is_paused,is_banned").neq("id", uid).eq("is_paused", false);
  if (excl.length > 0) q = q.not("id", "in", `(${excl.join(",")})`);
  if (p.looking_for_gender && p.looking_for_gender !== "both") q = q.eq("gender", p.looking_for_gender);
  if (p.filter_country) q = q.eq("country", p.filter_country);
  const localDate = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  // Age filter — always include users with no birthday (NULL)
  if (p.filter_min_age && p.filter_min_age > 0) {
    const maxBirthday = new Date();
    maxBirthday.setFullYear(maxBirthday.getFullYear() - p.filter_min_age);
    const maxDate = localDate(maxBirthday);
    q = q.or(`birthday.is.null,birthday.lte.${maxDate}`);
  }
  if (p.filter_max_age && p.filter_max_age < 99) {
    const minBirthday = new Date();
    minBirthday.setFullYear(minBirthday.getFullYear() - p.filter_max_age - 1);
    minBirthday.setDate(minBirthday.getDate() + 1);
    const minDate = localDate(minBirthday);
    q = q.or(`birthday.is.null,birthday.gte.${minDate}`);
  }
  // Exclude banned users
  q = q.eq("is_banned", false);
  q = q.order(mode === "new" ? "created_at" : "last_active", { ascending: false }).limit(100);
  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];
  // Distance filter: only enforced when both sides have coordinates and the
  // user hasn't dragged the slider to "unlimited" (>=500km)
  const maxDist = p.filter_max_distance || 100;
  const rows = data as unknown as ExploreProfileRow[];
  const withinRange = (r: ExploreProfileRow) => {
    if (maxDist >= 500) return true;
    if (p.latitude == null || p.longitude == null || r.latitude == null || r.longitude == null) return true;
    return haversine(p.latitude, p.longitude, r.latitude, r.longitude) <= maxDist;
  };
  // Each Explore tab has its own primary order: recommendation score,
  // physical distance, or account creation time.
  const candidates = rows
    .filter(withinRange)
    .map(r => ({
      r,
      score: scoreProfile(r, p),
      distance: p.latitude != null && p.longitude != null && r.latitude != null && r.longitude != null
        ? haversine(p.latitude, p.longitude, r.latitude, r.longitude)
        : undefined,
      createdAt: r.created_at || null,
    }));
  const scored = sortExploreCandidates(candidates, mode)
    .slice(0, 30)
    .map(({ r, distance }) => profileRowToExplore(r, distance));
  return scored;
}

function profileRowToExplore(r: ExploreProfileRow, distance?: number): ExploreProfile {
  const gender = r.gender === "female" ? "female" : "male";
  const activePlan = getActivePremiumPlan(r);
  return {
    id: r.id,
    name: r.display_name || r.username || "NYX Member",
    age: r.birthday ? calcAge(r.birthday) : null,
    mbti: r.mbti || "INFP",
    bio: r.bio || "",
    avatar: resolveAvatar(r.avatar_url, gender),
    gender,
    is_premium: activePlan !== null,
    premium_plan: activePlan,
    premium_expires_at: r.premium_expires_at || null,
    photos: r.photos || [],
    location: r.location_text || "",
    country: r.country || "",
    ethnicity: r.ethnicity || [],
    hobbies: r.hobbies || [],
    verified: r.is_verified || false,
    distance,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    occupation: r.occupation || null,
    education: r.education || null,
    income: r.income || null,
    height_cm: r.height_cm || null,
    drinking: r.drinking || null,
    smoking: r.smoking || null,
    exercise: r.exercise || null,
    has_pets: r.has_pets || null,
    want_children: r.want_children || null,
    relationship_goal: r.relationship_goal || null,
    love_language: r.love_language || null,
  };
}

/** IDs are private to their owner. The table policy also requires active Premium. */
export async function getFavoriteIds(uid: string): Promise<Set<string>> {
  const { data, error } = await sb.from("favorites")
    .select("favorite_user_id")
    .eq("user_id", uid);
  if (error) throw error;
  return new Set(((data || []) as unknown as FavoriteRow[]).map(row => row.favorite_user_id));
}

export async function getFavoriteProfiles(uid: string): Promise<FavoriteProfile[]> {
  const { data: favoriteRows, error: favoriteError } = await sb.from("favorites")
    .select("favorite_user_id,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (favoriteError) throw favoriteError;
  if (!favoriteRows?.length) return [];

  const favorites = favoriteRows as unknown as FavoriteRow[];
  const ids = favorites.map(row => row.favorite_user_id);
  const { data: profileRows, error: profileError } = await sb.from("profiles")
    .select("id,display_name,username,birthday,gender,mbti,bio,avatar_url,photos,location_text,country,ethnicity,hobbies,is_verified,is_premium,premium_plan,premium_expires_at,latitude,longitude,occupation,education,income,height_cm,drinking,smoking,exercise,has_pets,want_children,relationship_goal,love_language,is_banned,deleted_at")
    .in("id", ids)
    .eq("is_banned", false)
    .is("deleted_at", null);
  if (profileError) throw profileError;
  const profilesById = new Map<string, ExploreProfileRow>(
    ((profileRows || []) as unknown as ExploreProfileRow[]).map(row => [row.id, row]),
  );

  return favorites.flatMap(favorite => {
    const row = profilesById.get(favorite.favorite_user_id);
    if (!row) return [];
    return [{ ...profileRowToExplore(row), favoritedAt: new Date(favorite.created_at) }];
  });
}

export async function toggleFavorite(targetId: string, shouldFavorite: boolean): Promise<boolean> {
  const { data, error } = await sb.rpc("toggle_private_favorite", {
    p_target_id: targetId,
    p_should_favorite: shouldFavorite,
  });
  if (error) throw error;
  return data === true;
}

export async function getMatches(uid: string): Promise<MatchItem[]> {
  const { data } = await sb.from("matches").select("id,created_at,user1_id,user2_id").or(`user1_id.eq.${uid},user2_id.eq.${uid}`).order("created_at", { ascending: false });
  if (!data) return [];
  return Promise.all((data as unknown as MatchRelationRow[]).map(async m => {
    const otherId = m.user1_id === uid ? m.user2_id : m.user1_id;
    const { data: prof } = await sb.from("profiles").select("id,display_name,username,avatar_url,gender,last_active,hide_online_status,is_premium,premium_plan,premium_expires_at").eq("id", otherId).maybeSingle();
    const { data: last } = await sb.from("chat_messages").select("content,created_at,sender_id").eq("match_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const isMyMsg = last?.sender_id === uid;
    const lastMsg = last?.content
      ? ((last.content.startsWith("https://") || last.content.startsWith("http://")) ? (isMyMsg ? "你：📷 相片" : "📷 相片") : (isMyMsg ? `你：${last.content}` : last.content))
      : "配對成功！打個招呼吧 💕";
    const activePlan = getActivePremiumPlan(prof) as PremiumPlan | null;
    return {
      id: otherId, matchId: m.id, name: prof?.display_name || prof?.username || "?",
      avatar: resolveAvatar(prof?.avatar_url, prof?.gender), gender: prof?.gender, lastMsg, unread: 0,
      time: new Date(last?.created_at || m.created_at).getTime(),
      lastActive: prof?.last_active || null,
      hideOnline: prof?.hide_online_status || false,
      isPremium: activePlan !== null,
      premiumPlan: activePlan,
    };
  }));
}

export async function loadChatMsgs(matchId: string): Promise<ChatMsg[]> {
  const { data } = await sb.from("chat_messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
  if (!data) return [];
  return (data as unknown as ChatMessageRow[]).map(r => ({
    id: r.id, senderId: r.sender_id, content: r.content, timestamp: new Date(r.created_at),
    readAt: r.read_at ? new Date(r.read_at) : null,
    isImage: r.is_image === true || (typeof r.content === "string" && (r.content.startsWith("https://") || r.content.startsWith("http://")) && !r.content.includes(" ") && !r.content.includes("\n")),
  }));
}
export async function sendChatMsg(matchId: string, senderId: string, content: string, isImage = false): Promise<string> {
  if (!isImage) await moderateContent({ text: content });
  const { data, error } = await sb.from("chat_messages")
    .insert({ match_id: matchId, sender_id: senderId, content, is_image: isImage })
    .select("id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("訊息未能儲存，請稍後再試");
  return String(data.id);
}
export async function blockUser(a: string, b: string) {
  const { error } = await sb.from("blocked_users").upsert({ blocker_id: a, blocked_id: b });
  if (error) throw error;
}
export async function reportUser(a: string, b: string, reason: string, category = "other") {
  const { error } = await sb.from("reports").insert({ reporter_id: a, reported_id: b, reason, category });
  if (error) throw error;
}
export async function deleteAccount(uid: string) {
  // Actually deletes the auth.users record (via a service-role edge
  // function), not just the profiles row — Apple 5.1.1(v) requires account
  // deletion to really delete the account, not just its data.
  const { error } = await sb.functions.invoke("delete-account", {});
  if (error) throw new Error(error.message || `Unable to delete account ${uid}`);
  await sb.auth.signOut();
}
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
    const matchedIds = new Set(((matched || []) as unknown as MatchRelationRow[]).map(m => m.user1_id === uid ? m.user2_id : m.user1_id));
    const unmatched = (data as unknown as SwipeSourceRow[]).filter(s => !matchedIds.has(s.swiper_id));
    const items = await Promise.all(unmatched.map(async s => {
      const { data: prof } = await sb.from("profiles").select("id,display_name,username,avatar_url,gender,birthday,mbti").eq("id", s.swiper_id).maybeSingle();
      return {
        id: s.swiper_id,
        name: prof?.display_name || prof?.username || "?",
        age: prof?.birthday ? calcAge(prof.birthday) : null,
        avatar: resolveAvatar(prof?.avatar_url, prof?.gender),
        gender: prof?.gender,
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

/* ─── Profile views ("誰看過我") ─────────────────────── */
export async function recordProfileView(viewerId: string, viewedId: string) {
  if (viewerId === viewedId) return;
  try { await sb.from("profile_views").insert({ viewer_id: viewerId, viewed_id: viewedId }); } catch { /* best-effort */ }
}
export async function getProfileViewCount(uid: string): Promise<number> {
  void uid;
  const { data, error } = await sb.rpc("get_my_profile_view_count");
  if (error) return 0;
  return Number(data) || 0;
}

export async function getProfileViewers(): Promise<ProfileViewerItem[]> {
  const { data, error } = await sb.rpc("get_my_profile_viewers");
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => {
    const gender = row.gender === "female" ? "female" : "male";
    const activePlan = getActivePremiumPlan({
      is_premium: row.is_premium === true,
      premium_plan: typeof row.premium_plan === "string" ? row.premium_plan : null,
      premium_expires_at: typeof row.premium_expires_at === "string" ? row.premium_expires_at : null,
    });
    return {
      id: String(row.viewer_id),
      name: String(row.display_name || row.username || "NYX Member"),
      age: row.birthday ? calcAge(String(row.birthday)) : null,
      avatar: resolveAvatar(typeof row.avatar_url === "string" ? row.avatar_url : null, gender),
      gender,
      mbti: typeof row.mbti === "string" ? row.mbti : "INFP",
      viewedAt: new Date(String(row.viewed_at)),
      premiumPlan: activePlan,
    };
  });
}

/* ─── Nyx analysis history ───────────────────────────── */
export async function saveAnalysis(uid: string, msgId: string, msgText: string, isUserMsg: boolean, result: string) {
  await sb.from("nyx_analyses").insert({ user_id: uid, msg_id: msgId, msg_text: msgText.slice(0, 500), is_user_msg: isUserMsg, result });
}
export async function loadAnalysisHistory(uid: string): Promise<NyxAnalysis[]> {
  const { data } = await sb.from("nyx_analyses").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20);
  if (!data) return [];
  return (data as unknown as AnalysisRow[]).map(r => ({ id: r.id, msgId: r.msg_id, msgText: r.msg_text, isUserMsg: r.is_user_msg, result: r.result, createdAt: new Date(r.created_at) }));
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
  if (!b) return null;
  const born = parseBirthday(b);
  if (!born) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age--;
  return age;
}
export function zodiacSign(b: string | null): string | null {
  if (!b) return null;
  const d = parseBirthday(b);
  if (!d) return null;
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "魔羯座";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "水瓶座";
  if ((m === 2 && day >= 19) || (m === 3 && day <= 20)) return "雙魚座";
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "牡羊座";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "金牛座";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 21)) return "雙子座";
  if ((m === 6 && day >= 22) || (m === 7 && day <= 22)) return "巨蟹座";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "獅子座";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "處女座";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "天秤座";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "天蠍座";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "射手座";
  return null;
}

function parseBirthday(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
export function onlineStatus(lastActive: string | null, hidden: boolean, nowMs = Date.now()): { label: string; color: string; dot: boolean } {
  if (hidden || !lastActive) return { label: "", color: "transparent", dot: false };
  const activeAt = new Date(lastActive);
  if (Number.isNaN(activeAt.getTime())) return { label: "", color: "transparent", dot: false };
  const now = new Date(nowMs);
  const diff = Math.max(0, now.getTime() - activeAt.getTime());
  if (diff < 5 * 60 * 1000) return { label: "在線", color: "#06d6a0", dot: true };
  if (diff < 60 * 60 * 1000) return { label: `${Math.floor(diff / 60000)}分鐘前`, color: "rgba(200,185,230,0.45)", dot: false };
  if (activeAt.toDateString() === now.toDateString()) return { label: `今天 ${fmtTime(activeAt)}`, color: "rgba(200,185,230,0.45)", dot: false };
  const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.max(1, Math.round((calendarDay(now) - calendarDay(activeAt)) / 86400000));
  if (days === 1) return { label: `昨天 ${fmtTime(activeAt)}`, color: "rgba(200,185,230,0.4)", dot: false };
  return { label: `${days}天前`, color: "rgba(200,185,230,0.35)", dot: false };
}
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
export function formatLocation(city: string, state = "", country = "") {
  return [city, state && state !== city && state !== country ? state : "", country && country !== city ? country : ""]
    .filter(Boolean)
    .join(", ");
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; state: string; country: string }> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-TW`, { headers: { "User-Agent": "NYX-App/1.0" } });
    const d = await r.json(); const a = d.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state || "";
    const cm: Record<string, string> = { "Taiwan": "台灣", "Hong Kong": "香港", "Japan": "日本", "South Korea": "韓國", "Singapore": "新加坡", "Malaysia": "馬來西亞", "United States": "美國", "Canada": "加拿大", "United Kingdom": "英國", "Australia": "澳洲", "China": "中國大陸" };
    const country = cm[a.country] || a.country || "";
    const state = a.state && a.state !== city && a.state !== country ? a.state : "";
    return { city, state, country };
  } catch { return { city: "", state: "", country: "" }; }
}
type CitySearchResult = { name: string; state: string; country: string; lat: number; lon: number };
type RankedCitySearchResult = CitySearchResult & { rank: number };
type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string; town?: string; village?: string; municipality?: string;
    county?: string; state?: string; province?: string; country?: string;
  };
};

export async function searchCities(q: string, near?: { lat: number; lon: number } | null): Promise<CitySearchResult[]> {
  if (q.length < 2) return [];
  try {
    // No featuretype filter — otherwise country names and many towns/regions
    // never match, since Nominatim only tags a subset of places as "city".
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&accept-language=zh-TW`, { headers: { "User-Agent": "NYX-App/1.0" } });
    const d = await r.json() as NominatimItem[];
    // zh-TW replies sometimes join simplified/traditional variants with ";"
    // (e.g. "美国;美國") — keep only the first.
    const clean = (s: string) => s.split(";")[0].trim();
    const results: RankedCitySearchResult[] = d.map((item, i) => {
      const a = item.address || {};
      // Nominatim's display_name always leads with the actually-matched
      // place's own name — trust that over the address hierarchy, which can
      // otherwise surface an unrelated containing county/village name
      // instead (e.g. searching "chino" wrongly showing "Santa Bárbara",
      // the Mexican *county* that happens to contain a peak called Chino).
      const primaryName = clean(item.display_name.split(",")[0]);
      const name = primaryName || clean(a.city || a.town || a.village || a.municipality || a.county || a.state || a.country || "");
      const country = clean(a.country || item.display_name.split(",").slice(-1)[0]);
      // Province/state, when the country actually uses that admin level —
      // skip it if it duplicates the city name or the country itself
      // (e.g. Taiwan's special municipalities, city-states like Singapore).
      const stateRaw = clean(a.state || a.province || "");
      const state = stateRaw && stateRaw !== name && stateRaw !== country ? stateRaw : "";
      return { name, state, country, lat: parseFloat(item.lat), lon: parseFloat(item.lon), rank: i };
    });
    // Same name can exist worldwide (e.g. "Chino" in California vs. Nagano,
    // Japan) — text match always wins first: among results whose name
    // actually matches what was typed, nearer ones rank first. Looser/fuzzy
    // matches (Nominatim's own alternate-name matching, e.g. a differently
    // scripted city name) keep Nominatim's original relevance order rather
    // than being reshuffled by raw distance alone.
    const qLower = q.trim().toLowerCase();
    const isTextMatch = (result: RankedCitySearchResult) => result.name.toLowerCase().startsWith(qLower);
    results.sort((x, y) => {
      const xm = isTextMatch(x), ym = isTextMatch(y);
      if (xm !== ym) return xm ? -1 : 1;
      if (near && xm && ym) return haversine(near.lat, near.lon, x.lat, x.lon) - haversine(near.lat, near.lon, y.lat, y.lon);
      return x.rank - y.rank;
    });
    return results.map(result => ({
      name: result.name,
      state: result.state,
      country: result.country,
      lat: result.lat,
      lon: result.lon,
    }));
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
export interface MemoryContent {
  scene?: string;
  choiceA?: string;
  choiceB?: string;
  question?: string;
  answerA?: string;
  answerB?: string;
}
export interface Memory {
  id: string; matchId: string;
  type: "encounter"|"spark"|"milestone"|"first_message";
  title: string; content: MemoryContent; createdAt: Date;
}
export interface BondInfo {
  level: number; label: string; chemistryScore: number;
  encounterCount: number; sparkCount: number;
}

type EncounterRow = {
  id: string; match_id: string; scene_text: string;
  option_a: string; option_b: string; option_c?: string | null;
  choice_user1?: string | null; choice_user2?: string | null;
  user1_id: string; user2_id: string;
  revealed_at?: string | null; created_at: string;
};
type SparkRow = {
  id: string; match_id: string; user1_id: string; user2_id: string;
  question: string; answer_user1?: string | null; answer_user2?: string | null;
  spark_date: string; revealed_at?: string | null;
};
type MemoryRow = {
  id: string; match_id: string; type: Memory["type"];
  title: string; content: MemoryContent | null; created_at: string;
};

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
    void user1Id;
    void user2Id;
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
    const parsed = JSON.parse(cleaned) as { scene?: unknown };
    const scene = typeof parsed.scene === "string" ? parsed.scene.trim() : "";
    if (!scene || scene.length > 200) throw new Error("AI 場景格式不正確");
    const { data, error } = await sb.rpc("create_daily_encounter", {
      p_match_id: matchId,
      p_scene: scene,
    });
    if (error) throw error;
    return mapEncounter(data as unknown as EncounterRow);
  } catch(e) { console.error("generateEncounter error",e); return null; }
}

export async function submitEncounterChoice(encounterId: string, userId: string, user1Id: string, choice: string): Promise<{revealed: boolean; encounter: Encounter}> {
  void userId;
  void user1Id;
  const { data, error } = await sb.rpc("submit_encounter_choice", {
    p_encounter_id: encounterId,
    p_choice: choice,
  });
  if (error) throw error;
  const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
    revealed?: boolean;
    encounter?: EncounterRow;
  } | null;
  if (!payload?.encounter) throw new Error("場景回答未能儲存，請稍後再試");
  return { revealed: Boolean(payload.revealed), encounter: mapEncounter(payload.encounter) };
}

function mapEncounter(d: EncounterRow): Encounter {
  return { id:d.id, matchId:d.match_id, sceneText:d.scene_text, optionA:d.option_a, optionB:d.option_b, optionC:d.option_c || undefined,
    choiceUser1:d.choice_user1 || undefined, choiceUser2:d.choice_user2 || undefined, user1Id:d.user1_id, user2Id:d.user2_id,
    revealedAt:d.revealed_at?new Date(d.revealed_at):undefined, createdAt:new Date(d.created_at) };
}

/* ─── Daily Spark ────────────────────────────────────── */
export async function getTodaySpark(matchId: string, user1Id: string, user2Id: string): Promise<DailySpark|null> {
  void user1Id;
  void user2Id;
  try {
    const { data, error } = await sb.rpc("get_or_create_daily_spark", { p_match_id: matchId });
    if (error) throw error;
    return data ? mapSpark(data as unknown as SparkRow) : null;
  } catch (error) {
    console.error("getTodaySpark error", error);
    return null;
  }
}

export async function submitSparkAnswer(sparkId: string, userId: string, user1Id: string, answer: string): Promise<{revealed:boolean; spark:DailySpark}> {
  void userId;
  void user1Id;
  const { data, error } = await sb.rpc("submit_daily_spark_answer", {
    p_spark_id: sparkId,
    p_answer: answer,
  });
  if (error) throw error;
  const row = typeof data === "string" ? JSON.parse(data) : data;
  const spark = mapSpark(row);
  return { revealed: Boolean(spark.revealedAt), spark };
}

function mapSpark(d: SparkRow): DailySpark {
  return { id:d.id, matchId:d.match_id, user1Id:d.user1_id, user2Id:d.user2_id,
    question:d.question, answerUser1:d.answer_user1 || undefined, answerUser2:d.answer_user2 || undefined,
    sparkDate:d.spark_date, revealedAt:d.revealed_at?new Date(d.revealed_at):undefined };
}

/* ─── Memory Wall ────────────────────────────────────── */
export async function getMemories(matchId: string): Promise<Memory[]> {
  const { data } = await sb.from("memories").select("*")
    .eq("match_id", matchId).order("created_at",{ascending:true});
  return ((data||[]) as unknown as MemoryRow[]).map(d => ({
    id:d.id, matchId:d.match_id, type:d.type, title:d.title,
    content:d.content || {}, createdAt:new Date(d.created_at),
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
  /* ── Safe Area (notch/Dynamic Island/home bar) ── */
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }

  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body{height:100%;background:#F7F7FC;overscroll-behavior:none;}
  *{font-family:'Inter','Noto Sans TC',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  ::placeholder{color:rgba(36,30,53,0.32);font-weight:400;}
  ::-webkit-scrollbar{width:2px;} ::-webkit-scrollbar-thumb{background:rgba(103,87,217,0.22);border-radius:2px;}
  ::-webkit-calendar-picker-indicator{filter:opacity(.52);}
  input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:3px;background:rgba(103,87,217,0.14);outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#6757D9;cursor:pointer;box-shadow:0 0 0 4px rgba(103,87,217,0.14);}

  @keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.35;}30%{transform:translateY(-5px);opacity:1;}}
  @keyframes slideUp{from{transform:translateY(60px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  @keyframes typingDot{0%,60%,100%{transform:translateY(0);opacity:.3;}30%{transform:translateY(-4px);opacity:1;}}
  @keyframes profileZoomIn{from{transform:scale(0.9) translateY(20px);opacity:0;}to{transform:scale(1) translateY(0);opacity:1;}}
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
  @keyframes btnPulse{0%,100%{box-shadow:0 6px 20px rgba(103,87,217,0.20);}50%{box-shadow:0 8px 30px rgba(103,87,217,0.34);}}
  @keyframes heartBeat{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}
  @keyframes heartBurst{0%{opacity:1;transform:translate(-50%,-50%) scale(0);}80%{opacity:.7;}100%{opacity:0;transform:translate(calc(-50% + var(--x,0px)),calc(-50% + var(--y,0px))) scale(1.6);}}
  @keyframes cherryFall{0%{transform:translateY(-20px) rotate(0deg);opacity:.6;}100%{transform:translateY(110vh) rotate(720deg);opacity:0;}}
  @keyframes matchPop{0%{transform:scale(0.75);opacity:0;}60%{transform:scale(1.04);}100%{transform:scale(1);opacity:1;}}
  @keyframes cardReveal{0%{transform:scale(.95) translateY(8px);opacity:0;}100%{transform:scale(1) translateY(0);opacity:1;}}
  @keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(103,87,217,0);}50%{box-shadow:0 0 16px 4px rgba(103,87,217,0.18);}}
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
