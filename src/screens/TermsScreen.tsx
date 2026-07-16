import { useRef, useState } from "react";
import { C } from "../utils";

export function TermsScreen({ onBack, type = "terms" }: { onBack: () => void; type?: "terms" | "privacy" }) {
  const isTerms = type === "terms";

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
    if (isSwiping.current && swipeDx > 100) onBack(); else setSwipeDx(0);
    isSwiping.current = false;
  }

  return (
    <div onTouchStart={onSwipeTouchStart} onTouchMove={onSwipeTouchMove} onTouchEnd={onSwipeTouchEnd}
      style={{ position:"fixed",inset:0,zIndex:300,background:C.bg,display:"flex",flexDirection:"column" as const,
        touchAction:"pan-y",transform:`translateX(${swipeDx}px)`,transition:swipeDx===0?"transform .3s cubic-bezier(.32,.72,0,1)":"none",
        boxShadow:swipeDx>10?"-10px 0 30px rgba(0,0,0,0.6)":"none" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",color:C.textMuted,fontSize:22,cursor:"pointer",lineHeight:1 }}>‹</button>
        <span style={{ fontSize:16,fontWeight:700,color:C.text }}>{isTerms ? "服務條款" : "隱私政策"}</span>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"20px 20px 48px",fontSize:13.5,color:C.textSub,lineHeight:1.75 }}>
        {isTerms ? (
          <>
            <p style={{ color:C.textMuted,marginBottom:20 }}>最後更新：2025年1月1日</p>
            <h3 style={{ color:C.text,marginBottom:8 }}>1. 接受條款</h3>
            <p>使用 NYX 即表示你同意以下服務條款。若不同意，請勿使用本服務。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>2. 年齡限制</h3>
            <p>NYX 僅供 18 歲以上成年人使用。使用本服務即代表你確認已年滿 18 歲。若發現未成年人使用，我們將立即終止其帳號。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>3. 帳號責任</h3>
            <p>你需對帳號內的所有活動負責。請勿分享帳號密碼。如發現未經授權的使用，請立即聯繫我們。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>4. 用戶行為</h3>
            <p>嚴禁以下行為：騷擾、霸凌、發送不雅內容、冒充他人、傳播虛假資訊、詐欺或任何違法活動。違反者將被永久封禁。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>5. 內容規範</h3>
            <p>禁止上傳裸露、色情、暴力或侵犯他人版權的內容。NYX 有權隨時移除違規內容並終止相關帳號。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>6. Premium 訂閱</h3>
            <p>Premium 訂閱為自動續費服務。可在訂閱期結束前 24 小時於 App Store / Google Play 設定中取消。已付費期間不提供退款。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>7. 免責聲明</h3>
            <p>NYX 不對用戶之間的互動承擔責任。請謹慎保護個人安全，與陌生人線下見面前請務必告知信任的朋友。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>8. 終止服務</h3>
            <p>我們保留因違反條款而終止任何帳號的權利，無需事先通知。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>9. 聯絡我們</h3>
            <p>如有疑問，請聯繫：support@nyx.app</p>
          </>
        ) : (
          <>
            <p style={{ color:C.textMuted,marginBottom:20 }}>最後更新：2025年1月1日</p>
            <h3 style={{ color:C.text,marginBottom:8 }}>1. 我們收集的資料</h3>
            <p>我們收集你主動提供的資料（姓名、生日、照片、個人簡介）以及使用資料（登入時間、滑動記錄、訊息互動）。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>2. 資料使用方式</h3>
            <p>你的資料僅用於：提供配對服務、改善 AI 推薦算法、防止詐欺與濫用。我們絕不出售你的個人資料給第三方。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>3. 資料安全</h3>
            <p>所有資料以加密方式儲存於 Supabase 安全伺服器。我們採用業界標準的安全措施保護你的資料。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>4. 照片與內容</h3>
            <p>你上傳的照片儲存於安全的雲端存儲。刪除帳號後，你的所有照片將在 30 天內從伺服器永久刪除。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>5. 位置資料</h3>
            <p>如你允許，我們會使用你的位置資料提供附近用戶推薦。你可隨時在設定中關閉此功能。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>6. 推播通知</h3>
            <p>我們發送的推播通知僅與你的配對和訊息相關。你可隨時在手機設定中關閉通知。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>7. 帳號刪除</h3>
            <p>你可在「我的」→「設定」→「刪除帳號」永久刪除帳號。刪除後所有個人資料將在 30 天內清除。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>8. Cookie 與追蹤</h3>
            <p>我們不使用第三方廣告追蹤器。僅使用必要的 session cookie 維持登入狀態。</p>
            <h3 style={{ color:C.text,margin:"16px 0 8px" }}>9. 聯絡我們</h3>
            <p>隱私相關問題請聯繫：privacy@nyx.app</p>
          </>
        )}
      </div>
    </div>
  );
}
