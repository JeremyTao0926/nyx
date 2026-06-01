import { useState, useEffect, useRef } from "react";
import { sb, C, sound, calcAge, MBTI_LIST, HOBBIES, lookupEmailByUsername, checkUsernameAvailable, reverseGeocode, uploadAvatar, compressImage } from "../utils";
import { CherryBlossoms } from "../components/Atoms";
import { ImageCropper } from "../components/ImageCropper";

/* ─── Shared input style ─────────────────────────────── */
const INP = {
  width: "100%", padding: "14px 16px",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${C.border}`,
  borderRadius: 14, color: C.text, fontSize: 15,
  outline: "none", fontFamily: "inherit",
  transition: "border-color .2s",
  boxSizing: "border-box" as const,
};

/* ─── Step Progress Bar ──────────────────────────────── */
function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? C.rose : "rgba(255,255,255,0.12)", transition: "background .3s" }} />
      ))}
    </div>
  );
}

/* ─── Login Screen ───────────────────────────────────── */
function LoginForm({ onSwitch, onLogin }: { onSwitch: () => void; onLogin: () => void }) {
  const [identifier, setIdentifier] = useState(""); // email or username
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(""); if (!identifier || !pass) { setErr("請填寫所有欄位"); return; }
    setLoading(true);
    try {
      let email = identifier.trim();
      // If no @, treat as username → look up email
      if (!email.includes("@")) {
        const found = await lookupEmailByUsername(email);
        if (!found) { setErr("找不到此用戶名，請檢查拼寫"); setLoading(false); return; }
        email = found;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) {
        if (error.message.includes("Email not confirmed")) throw new Error("請先確認信箱中的驗證郵件");
        if (error.message.includes("Invalid login")) throw new Error("帳號或密碼錯誤");
        throw error;
      }
      onLogin();
    } catch (e: any) { setErr(e.message ?? "登入失敗"); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input value={identifier} onChange={e => setIdentifier(e.target.value)}
        placeholder="電子郵件 或 用戶名" style={INP}
        onFocus={e => (e.target.style.borderColor = C.borderFocus)}
        onBlur={e => (e.target.style.borderColor = C.border)} />
      <input type="password" value={pass} onChange={e => setPass(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="密碼" style={INP}
        onFocus={e => (e.target.style.borderColor = C.borderFocus)}
        onBlur={e => (e.target.style.borderColor = C.border)} />
      {err && <div style={{ fontSize: 13, color: err.includes("確認") ? C.mint : C.rose, textAlign: "center" }}>{err}</div>}
      <button onClick={() => { sound.pop(); submit(); }} disabled={loading}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? .65 : 1, marginTop: 4, animation: "btnPulse 3s ease-in-out infinite" }}>
        {loading ? "登入中..." : "登入"}
      </button>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button onClick={async () => { const em = prompt("請輸入電子郵件"); if (em) { await sb.auth.resetPasswordForEmail(em); alert("重設密碼郵件已發出 ✦"); } }}
          style={{ background: "none", border: "none", color: C.textDim, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>忘記密碼？</button>
      </div>
    </div>
  );
}

/* ═══ REGISTRATION — Multi-step ══════════════════════ */

// Step 1: Email + Password
function Step1({ onNext }: { onNext: (email: string, pass: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");

  function next() {
    setErr("");
    if (!email || !pass) { setErr("請填寫所有欄位"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("請輸入有效的電子郵件"); return; }
    if (pass.length < 6) { setErr("密碼至少6位"); return; }
    if (pass !== pass2) { setErr("兩次密碼不一致"); return; }
    onNext(email, pass);
  }

  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>建立帳號</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>請輸入你的電子郵件和密碼</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="電子郵件" type="email" style={INP} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="密碼（至少6位）" style={INP} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      <input type="password" value={pass2} onChange={e => setPass2(e.target.value)} onKeyDown={e => e.key === "Enter" && next()} placeholder="確認密碼" style={INP} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      {err && <div style={{ fontSize: 13, color: C.rose, textAlign: "center" }}>{err}</div>}
      <button onClick={next} style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>繼續 →</button>
    </div>
  </>;
}

// Step 2: Name + Username + Birthday
function Step2({ onNext }: { onNext: (name: string, username: string, birthday: string) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const timer = useRef<any>(null);

  async function handleUsername(v: string) {
    setUsername(v); setUsernameOk(null);
    if (v.length < 3) return;
    if (!/^[a-zA-Z0-9_]+$/.test(v)) { setUsernameOk(false); return; }
    clearTimeout(timer.current);
    setChecking(true);
    timer.current = setTimeout(async () => {
      const ok = await checkUsernameAvailable(v);
      setUsernameOk(ok); setChecking(false);
    }, 500);
  }

  async function next() {
    setErr("");
    if (!name.trim()) { setErr("請輸入名字"); return; }
    if (!username || username.length < 3) { setErr("用戶名至少3個字符"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setErr("用戶名只能包含英文、數字和底線"); return; }
    if (usernameOk === false) { setErr("此用戶名已被使用"); return; }
    if (!birthday) { setErr("請填寫生日"); return; }
    const age = calcAge(birthday); if (!age || age < 18) { setErr("必須年滿18歲才可使用"); return; }
    onNext(name.trim(), username.toLowerCase().trim(), birthday);
  }

  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你叫什麼名字？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>這是其他用戶看到的名稱</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="顯示名稱" style={INP} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      <div style={{ position: "relative" }}>
        <input value={username} onChange={e => handleUsername(e.target.value)} placeholder="用戶名（英文/數字/底線）" style={{ ...INP, paddingRight: 44 }} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>
          {checking ? "⏳" : usernameOk === true ? "✅" : usernameOk === false ? "❌" : ""}
        </div>
      </div>
      {username && !/^[a-zA-Z0-9_]+$/.test(username) && <div style={{ fontSize: 12, color: C.rose }}>只能包含英文、數字和底線</div>}
      {usernameOk === false && /^[a-zA-Z0-9_]+$/.test(username) && <div style={{ fontSize: 12, color: C.rose }}>此用戶名已被使用</div>}
      {usernameOk === true && <div style={{ fontSize: 12, color: C.mint }}>✓ 用戶名可用</div>}
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 7 }}>生日（必須年滿18歲）</div>
        <input value={birthday} onChange={e => setBirthday(e.target.value)} type="date" style={{ ...INP, colorScheme: "dark" } as any} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      </div>
      {err && <div style={{ fontSize: 13, color: C.rose, textAlign: "center" }}>{err}</div>}
      <button onClick={next} style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>繼續 →</button>
    </div>
  </>;
}

// Step 3: Gender
function Step3({ onNext }: { onNext: (gender: "male" | "female") => void }) {
  const [selected, setSelected] = useState<"male" | "female" | null>(null);
  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你的性別？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 32 }}>幫助我們為你找到合適的人</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {([["male", "♂", "男性"], ["female", "♀", "女性"]] as const).map(([g, sym, label]) => (
        <button key={g} onClick={() => setSelected(g)}
          style={{ padding: "20px", borderRadius: 18, background: selected === g ? C.roseSoft : C.surf, border: `2px solid ${selected === g ? C.rose : C.border}`, color: C.text, fontFamily: "inherit", fontSize: 18, fontWeight: selected === g ? 700 : 400, cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28, width: 36, textAlign: "center" as const }}>{sym}</span>
          <span>{label}</span>
          {selected === g && <span style={{ marginLeft: "auto", color: C.rose }}>✓</span>}
        </button>
      ))}
      <button onClick={() => selected && onNext(selected)} disabled={!selected}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: selected ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: selected ? "#fff" : C.textDim, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: selected ? "pointer" : "default", marginTop: 8, transition: "all .25s" }}>
        繼續 →
      </button>
    </div>
  </>;
}

// Step 4: Looking for
function Step4({ onNext }: { onNext: (lookingFor: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = [["female", "♀", "女性"], ["male", "♂", "男性"], ["both", "⚡", "全部"]];
  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你在找誰？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 32 }}>可以之後在設定中修改</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {options.map(([val, sym, label]) => (
        <button key={val} onClick={() => setSelected(val)}
          style={{ padding: "20px", borderRadius: 18, background: selected === val ? C.roseSoft : C.surf, border: `2px solid ${selected === val ? C.rose : C.border}`, color: C.text, fontFamily: "inherit", fontSize: 18, fontWeight: selected === val ? 700 : 400, cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28, width: 36, textAlign: "center" as const }}>{sym}</span>
          <span>{label}</span>
          {selected === val && <span style={{ marginLeft: "auto", color: C.rose }}>✓</span>}
        </button>
      ))}
      <button onClick={() => selected && onNext(selected)} disabled={!selected}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: selected ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: selected ? "#fff" : C.textDim, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: selected ? "pointer" : "default", marginTop: 8, transition: "all .25s" }}>
        繼續 →
      </button>
    </div>
  </>;
}

// Step 5: Photo upload (required)
function Step5({ onNext, userId }: { onNext: (avatarUrl: string) => void; userId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) { setCropFile(file); }

  async function handleCropped(blob: Blob) {
    setCropFile(null);
    setUploading(true);
    try {
      const f = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(f, userId);
      setPreview(url);
    } catch { setErr("上傳失敗，請重試"); }
    setUploading(false);
  }

  return <>
    {cropFile && <ImageCropper file={cropFile} aspectRatio={1} shape="circle" onConfirm={handleCropped} onCancel={() => setCropFile(null)} />}
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>上傳你的第一張照片</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 32 }}>真實照片讓配對率提升 3 倍 ✦</div>
    <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
    {/* Upload area */}
    <div onClick={() => !uploading && fileRef.current?.click()}
      style={{ width: 180, height: 180, borderRadius: "50%", margin: "0 auto 28px", background: preview ? `url(${preview}) center/cover` : C.surf, border: `2px dashed ${preview ? C.rose : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, transition: "all .2s", position: "relative" }}
      onMouseEnter={e => !preview && ((e.currentTarget as HTMLElement).style.borderColor = C.rose)}
      onMouseLeave={e => !preview && ((e.currentTarget as HTMLElement).style.borderColor = C.border)}>
      {uploading ? (
        <div style={{ width: 32, height: 32, border: `3px solid rgba(255,255,255,0.2)`, borderTopColor: C.rose, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      ) : preview ? (
        <div style={{ position: "absolute", bottom: 8, right: 8, width: 32, height: 32, borderRadius: "50%", background: C.rose, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✎</div>
      ) : (
        <>
          <span style={{ fontSize: 36, color: C.textMuted }}>📷</span>
          <span style={{ fontSize: 13, color: C.textMuted }}>點擊上傳</span>
        </>
      )}
    </div>
    {err && <div style={{ fontSize: 13, color: C.rose, textAlign: "center", marginBottom: 12 }}>{err}</div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button onClick={() => preview && onNext(preview)} disabled={!preview || uploading}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: preview ? C.grad : "rgba(255,255,255,0.07)", border: "none", color: preview ? "#fff" : C.textDim, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: preview ? "pointer" : "default", transition: "all .25s" }}>
        {uploading ? "上傳中..." : "繼續 →"}
      </button>
    </div>
  </>;
}

// Step 6: City (optional but recommended)
function Step6({ onNext, userId }: { onNext: (city: string) => void; userId: string }) {
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState(false);

  async function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
      const { city: c } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (c) setCity(c);
    } catch { }
    setLocating(false);
  }

  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你在哪裡？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 32 }}>幫你找到附近的人</div>
    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <input value={city} onChange={e => setCity(e.target.value)} placeholder="輸入城市名稱" style={{ ...INP, flex: 1 }} onFocus={e => (e.target.style.borderColor = C.borderFocus)} onBlur={e => (e.target.style.borderColor = C.border)} />
      <button onClick={locate} disabled={locating} style={{ padding: "14px 16px", borderRadius: 14, background: C.roseSoft, border: `1px solid rgba(232,54,93,0.25)`, color: C.rose, cursor: "pointer", fontFamily: "inherit", fontSize: 18, flexShrink: 0, opacity: locating ? .6 : 1 }}>{locating ? "⏳" : "📍"}</button>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button onClick={() => onNext(city)}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        {city ? "繼續 →" : "跳過"}
      </button>
    </div>
  </>;
}

// Step 7: MBTI (optional)
function Step7({ onNext }: { onNext: (mbti: string) => void }) {
  const [selected, setSelected] = useState("");
  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你的 MBTI？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>選填，幫助更好的配對</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
      {MBTI_LIST.map(m => (
        <button key={m} onClick={() => setSelected(m)}
          style={{ padding: "12px 4px", borderRadius: 12, background: selected === m ? C.roseSoft : "transparent", border: `1px solid ${selected === m ? C.rose : C.border}`, color: selected === m ? C.rose : C.textSub, fontFamily: "inherit", fontSize: 13, fontWeight: selected === m ? 700 : 400, cursor: "pointer", transition: "all .15s" }}>
          {m}
        </button>
      ))}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button onClick={() => onNext(selected || "INFP")}
        style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        {selected ? "繼續 →" : "跳過"}
      </button>
    </div>
  </>;
}

// Step 8: Hobbies (optional)
function Step8({ onNext }: { onNext: (hobbies: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(h: string) { setSelected(s => s.includes(h) ? s.filter(x => x !== h) : s.length < 5 ? [...s, h] : s); }
  return <>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 6 }}>你的興趣愛好？</div>
    <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>最多選5個，幫助找到共同話題</div>
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, marginBottom: 24 }}>
      {HOBBIES.map(h => {
        const sel = selected.includes(h);
        return <button key={h} onClick={() => toggle(h)}
          style={{ padding: "8px 16px", borderRadius: 20, background: sel ? C.roseSoft : "transparent", border: `1px solid ${sel ? C.rose : C.border}`, color: sel ? C.rose : C.textSub, fontFamily: "inherit", fontSize: 14, fontWeight: sel ? 600 : 400, cursor: selected.length >= 5 && !sel ? "default" : "pointer", transition: "all .15s", opacity: selected.length >= 5 && !sel ? .4 : 1 }}>
          {h}
        </button>;
      })}
    </div>
    {selected.length > 0 && <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginBottom: 12 }}>已選 {selected.length}/5</div>}
    <button onClick={() => onNext(selected)}
      style={{ width: "100%", padding: "15px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
      {selected.length > 0 ? "完成註冊 ✦" : "跳過"}
    </button>
  </>;
}

/* ─── Registration flow controller ───────────────────── */
function RegisterFlow({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Collected data
  const data = useRef({ email: "", pass: "", name: "", username: "", birthday: "", gender: "male" as "male" | "female", lookingFor: "female", avatarUrl: "", city: "", mbti: "INFP", hobbies: [] as string[] });

  const TOTAL_REQUIRED = 5; // steps 1-5 have progress bar
  const TOTAL = 8;

  async function finalize(hobbies: string[]) {
    data.current.hobbies = hobbies;
    const d = data.current;
    // Register with Supabase Auth
    try {
      const { data: authData, error } = await sb.auth.signUp({
        email: d.email, password: d.pass,
        options: { data: { username: d.username, display_name: d.name, birthday: d.birthday } }
      });
      if (error) throw error;
      const uid = authData.user?.id;
      if (uid) {
        // Upsert profile with all collected data
        await sb.from("profiles").upsert({
          id: uid, username: d.username, display_name: d.name, email: d.email,
          birthday: d.birthday, gender: d.gender, looking_for_gender: d.lookingFor,
          avatar_url: d.avatarUrl || null, location_text: d.city || null,
          mbti: d.mbti, hobbies: d.hobbies, onboarding_done: true,
        }, { onConflict: "id" });
      }
      setSent(true);
    } catch (e: any) { alert(e.message || "註冊失敗，請重試"); }
  }

  if (sent) return (
    <div style={{ textAlign: "center", animation: "fadeUp .4s ease" }}>
      <div style={{ fontSize: 60, marginBottom: 20 }}>📧</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12 }}>確認信已發出！</div>
      <div style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 28 }}>
        請查看 <span style={{ color: C.rose }}>{data.current.email}</span> 的收件箱，<br />點擊確認連結後即可開始使用。
      </div>
      <button onClick={onBack} style={{ padding: "13px 36px", borderRadius: 50, background: C.grad, border: "none", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>返回登入</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit", marginRight: 12, lineHeight: 1 }}>‹</button>
        <div style={{ flex: 1 }}><StepBar step={step} total={TOTAL} /></div>
      </div>
      {step === 1 && <Step1 onNext={(email, pass) => { data.current.email = email; data.current.pass = pass; setStep(2); }} />}
      {step === 2 && <Step2 onNext={(name, username, birthday) => { data.current.name = name; data.current.username = username; data.current.birthday = birthday; setStep(3); }} />}
      {step === 3 && <Step3 onNext={g => { data.current.gender = g; setStep(4); }} />}
      {step === 4 && <Step4 onNext={lf => { data.current.lookingFor = lf; setStep(5); }} />}
      {step === 5 && <Step5 userId="temp" onNext={url => { data.current.avatarUrl = url; setStep(6); }} />}
      {step === 6 && <Step6 userId="temp" onNext={city => { data.current.city = city; setStep(7); }} />}
      {step === 7 && <Step7 onNext={mbti => { data.current.mbti = mbti; setStep(8); }} />}
      {step === 8 && <Step8 onNext={finalize} />}
    </div>
  );
}

/* ─── LoginScreen (main entry) ───────────────────────── */
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"landing" | "login" | "register">("landing");

  // Landing page — image 1 style
  if (mode === "landing") return (
    <div style={{ position:"fixed", inset:0, display:"flex", justifyContent:"center", background:"#000" }}><div style={{ width:"100%", maxWidth:480, position:"relative", overflow:"hidden", height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      {/* Full-screen background photo */}
      <div style={{ position:"absolute", inset:0, background:"url(https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80) center/cover no-repeat", zIndex:0 }}/>
      {/* Dark gradient overlay — stronger at bottom */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(12,10,8,0.15) 0%, rgba(12,10,8,0.4) 40%, rgba(12,10,8,0.92) 75%, rgba(12,10,8,0.98) 100%)", zIndex:1 }}/>
      {/* Content */}
      <div style={{ position:"relative", zIndex:2, padding:"0 28px 52px" }}>
        {/* Headline */}
        <div style={{ marginBottom:36 }}>
          <div style={{ fontSize:38, fontWeight:800, color:"#fff", lineHeight:1.15, marginBottom:12, letterSpacing:"-0.01em" }}>
            Make<br/>Meaningful<br/>Connections
          </div>
          <div style={{ fontSize:14.5, color:"rgba(255,255,255,0.65)", lineHeight:1.6 }}>
            遇見懂你的人<br/>開啟高質量社交之旅
          </div>
        </div>
        {/* Buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button onClick={() => { sound.tap(); setMode("register"); }}
            style={{ width:"100%", padding:"16px", borderRadius:50, background:C.grad, border:"none", color:C.bg, fontFamily:"inherit", fontSize:16, fontWeight:800, cursor:"pointer", letterSpacing:"0.01em", boxShadow:`0 4px 24px ${C.goldGlow}` }}>
            開始探索
          </button>
          <button onClick={() => { sound.tap(); setMode("login"); }}
            style={{ width:"100%", padding:"15px", borderRadius:50, background:"rgba(255,255,255,0.10)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.20)", color:"#fff", fontFamily:"inherit", fontSize:15, fontWeight:600, cursor:"pointer" }}>
            登入
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:20, fontSize:11, color:"rgba(255,255,255,0.25)" }}>測試：guest@nyx.app / 123456</div>
      </div>
    </div></div>
  );

  // Login / Register flow — same photo bg, glass card
  return (
    <div style={{ position:"fixed", inset:0, display:"flex", justifyContent:"center", background:"#000" }}>
      <div style={{ width:"100%", maxWidth:480, position:"relative", overflow:"hidden", height:"100%" }}>
        {/* Same background photo */}
        <div style={{ position:"absolute", inset:0, background:"url(https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80) center/cover no-repeat", zIndex:0 }}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(12,10,8,0.45) 0%, rgba(12,10,8,0.75) 35%, rgba(12,10,8,0.97) 60%)", zIndex:1 }}/>
        {/* Content */}
        <div style={{ position:"relative", zIndex:2, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"0 24px 40px" }}>
          {/* Back button */}
          <button onClick={() => setMode("landing")} style={{ position:"absolute", top:52, left:20, background:"rgba(12,10,8,0.5)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"50%", width:38, height:38, color:"#fff", fontSize:20, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>

          {/* Glass card */}
          <div style={{ background:"rgba(20,18,14,0.82)", backdropFilter:"blur(24px)", borderRadius:24, border:"1px solid rgba(201,168,76,0.15)", padding:"28px 24px 24px", animation:"fadeUp .4s ease" }}>
            {mode === "login" ? (
              <>
                <div style={{ fontSize:24, fontWeight:800, color:C.text, marginBottom:4 }}>歡迎回來</div>
                <div style={{ fontSize:13.5, color:C.textMuted, marginBottom:24 }}>用電郵或用戶名登入</div>
                <LoginForm onSwitch={() => setMode("register")} onLogin={onLogin} />
                <div style={{ textAlign:"center", marginTop:16 }}>
                  <span style={{ fontSize:13.5, color:C.textMuted }}>還沒有帳號？</span>
                  <button onClick={() => { setMode("register"); sound.tap(); }} style={{ background:"none", border:"none", color:C.gold, fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginLeft:4 }}>立即註冊</button>
                </div>
              </>
            ) : (
              <RegisterFlow onDone={onLogin} onBack={() => setMode("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SplashScreen ───────────────────────────────────── */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [ph, setPh] = useState(0);
  const cvs = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 100), setTimeout(() => setPh(2), 500), setTimeout(() => setPh(3), 900), setTimeout(onDone, 2600)];
    return () => t.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const c = cvs.current!; if (!c) return;
    const ctx = c.getContext("2d")!; let raf: number;
    const rz = () => { c.width = window.innerWidth; c.height = window.innerHeight; }; rz();
    window.addEventListener("resize", rz);
    const pts = Array.from({ length: 40 }, () => ({ x: Math.random() * (c.width || 400), y: Math.random() * (c.height || 800), vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3, r: Math.random() * 1.5 + .3, o: Math.random() * .4 + .05 }));
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        ctx.save(); ctx.globalAlpha = p.o; ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(232,54,93,0.8)"; ctx.fill(); ctx.restore();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", rz); };
  }, []);
  const tr = (n: number) => ({ opacity: ph >= n ? 1 : 0, transform: ph >= n ? "translateY(0)" : "translateY(14px)", transition: "all .65s cubic-bezier(.22,1,.36,1)" });
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, overflow: "hidden", cursor: "pointer" }}>
      <canvas ref={cvs} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 20, background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", opacity: ph >= 1 ? 1 : 0, transform: ph >= 1 ? "scale(1)" : "scale(0.5)", transition: "all .8s cubic-bezier(.34,1.56,.64,1)" }}>✦</div>
        <div style={{ fontSize: "clamp(48px,12vw,80px)", fontWeight: 800, letterSpacing: "0.12em", color: C.text, ...tr(2) }}>NYX</div>
        <div style={{ marginTop: 14, fontSize: 13, letterSpacing: "0.22em", color: C.textMuted, textTransform: "uppercase" as const, ...tr(3) }}>你的 AI 戀愛分析師</div>
      </div>
    </div>
  );
}
