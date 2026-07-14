// ============================================================
// NYX 測試帳號種子腳本
// 用法：
//   1. 在 Supabase Dashboard → Settings → API 複製 service_role key
//   2. 在專案根目錄執行（Windows CMD）：
//      set SUPABASE_SERVICE_ROLE_KEY=你的key
//      node seed-test-users.mjs
//   ⚠️ service_role key 絕對不要放進 .env / 前端代碼 / git
// ============================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xouzteiydlzrxnicudua.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error("❌ 請先 set SUPABASE_SERVICE_ROLE_KEY=..."); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── 可調參數 ──────────────────────────────────
const PASSWORD = "TestNyx2026!";   // 所有測試帳號統一密碼，方便你登入測試
const TEST_LABEL = "ai_seed";      // 方便之後在後台一鍵清除

const FAKES = [
  { u: "luna_chen",   n: "陳露娜", g: "female", b: "1999-03-14", mbti: "ENFP", bio: "咖啡因驅動的插畫師 ☕ 週末在山裡找靈感", hobbies: ["繪畫","登山","咖啡"], img: 47 },
  { u: "sophie_lin",  n: "林思菲", g: "female", b: "2001-07-22", mbti: "INFJ", bio: "心理系研究生，喜歡深夜聊哲學和貓", hobbies: ["閱讀","貓","電影"], img: 45 },
  { u: "yuki_wang",   n: "王雪",   g: "female", b: "1998-11-05", mbti: "ISFP", bio: "甜點師 🍰 正在學日文，夢想去京都開店", hobbies: ["烘焙","日文","旅行"], img: 44 },
  { u: "amber_liu",   n: "劉琥珀", g: "female", b: "2000-01-30", mbti: "ESTP", bio: "健身教練，能深蹲也能追劇，別惹我", hobbies: ["健身","拳擊","美食"], img: 32 },
  { u: "grace_ho",    n: "何雅婷", g: "female", b: "1997-05-18", mbti: "ENTJ", bio: "新創 PM，效率狂人但週末只想躺平", hobbies: ["投資","瑜伽","紅酒"], img: 26 },
  { u: "mia_zhang",   n: "張米亞", g: "female", b: "2002-09-09", mbti: "INFP", bio: "大四生，寫詩、拍底片、養多肉 🌵", hobbies: ["攝影","寫作","植物"], img: 24 },
  { u: "kevin_wu",    n: "吳凱文", g: "male",   b: "1996-04-02", mbti: "INTJ", bio: "後端工程師，貓派，週末在爬山或修 bug", hobbies: ["程式","登山","桌遊"], img: 12 },
  { u: "ryan_lee",    n: "李瑞恩", g: "male",   b: "1999-12-25", mbti: "ESFP", bio: "調酒師 🍸 會做一百種調酒和一種炒飯", hobbies: ["調酒","吉他","衝浪"], img: 13 },
  { u: "daniel_kao",  n: "高丹尼", g: "male",   b: "1997-08-11", mbti: "ISTP", bio: "機車改裝 + 攝影，話不多但可靠", hobbies: ["機車","攝影","露營"], img: 14 },
  { u: "jason_tsai",  n: "蔡杰森", g: "male",   b: "2000-06-06", mbti: "ENFJ", bio: "小學老師，會彈鋼琴，笑點很低", hobbies: ["鋼琴","羽球","烹飪"], img: 15 },
  { u: "marco_hsu",   n: "許馬可", g: "male",   b: "1995-10-19", mbti: "ENTP", bio: "自由接案設計師，辯論愛好者，慎入", hobbies: ["設計","辯論","滑板"], img: 11 },
  { u: "leo_chang",   n: "張立歐", g: "male",   b: "2001-02-14", mbti: "ISFJ", bio: "獸醫系學生，家裡有三隻狗和一隻鸚鵡", hobbies: ["動物","跑步","電玩"], img: 8 },
];

const avatar = (img) => `https://i.pravatar.cc/400?img=${img}`;

async function main() {
  // 先抓一行現有 profile，取得實際存在的欄位，避免 update 撞到不存在的 column
  const { data: sample } = await sb.from("profiles").select("*").limit(1);
  const cols = sample && sample[0] ? Object.keys(sample[0]) : [];
  console.log("profiles 欄位偵測:", cols.join(", ") || "(空表)");

  for (const f of FAKES) {
    const email = `${f.u}@nyxtest.local`;
    // 1) 建 auth 帳號（觸發器會自動建 profile）
    const { data: created, error: e1 } = await sb.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { username: f.u, birthday: f.b },
    });
    if (e1) {
      if (String(e1.message).includes("already")) { console.log(`↷ ${f.u} 已存在，跳過建立`); }
      else { console.error(`✗ ${f.u} 建立失敗:`, e1.message); continue; }
    }
    const uid = created?.user?.id ?? (await sb.from("profiles").select("id").eq("username", f.u).maybeSingle()).data?.id;
    if (!uid) { console.error(`✗ ${f.u} 找不到 uid`); continue; }

    // 2) 填入假資料（只更新實際存在的欄位）
    const full = {
      display_name: f.n, gender: f.g, birthday: f.b, mbti: f.mbti,
      bio: f.bio, hobbies: f.hobbies,
      avatar_url: avatar(f.img), photos: [avatar(f.img)],
      is_test_account: true, test_label: TEST_LABEL,
      is_paused: false, email,
      last_active: new Date().toISOString(),
    };
    const patch = cols.length ? Object.fromEntries(Object.entries(full).filter(([k]) => cols.includes(k))) : full;
    const { error: e2 } = await sb.from("profiles").update(patch).eq("id", uid);
    if (e2) console.error(`✗ ${f.u} profile 更新失敗:`, e2.message);
    else console.log(`✓ ${f.n} (@${f.u}) ${f.g === "female" ? "♀" : "♂"} ${f.mbti}`);
  }
  console.log("\n完成。所有測試帳號密碼: " + PASSWORD);
}

main();
