import { C, WRAP } from "../utils";

export function TermsScreen({ onBack, type = "terms" }: { onBack: () => void; type?: "terms" | "privacy" }) {
  const isTerms = type === "terms";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, animation: "tabSwitch .3s ease", ...WRAP }}>
      <div style={{ padding: "52px 20px 14px", background: "rgba(12,10,8,0.96)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", fontFamily: "inherit" }}>‹</button>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{isTerms ? "服務條款" : "隱私政策"}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 48px" }}>
        {isTerms ? <TermsContent /> : <PrivacyContent />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: C.textSub, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

function TermsContent() {
  return <>
    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 24 }}>最後更新：2026年1月1日</div>
    <Section title="1. 服務使用條款">
      使用 NYX 即表示你同意遵守本條款。NYX 是一個面向18歲以上成人的交友平台。你必須如實填寫個人資料，不得使用虛假身份。
    </Section>
    <Section title="2. 用戶行為準則">
      禁止騷擾、威脅或恐嚇其他用戶。禁止發送不雅圖片或色情內容。禁止冒充他人或使用虛假照片。違反準則的帳號將被永久封禁。
    </Section>
    <Section title="3. 年齡要求">
      你必須年滿18歲才可使用本服務。如發現未成年用戶，我們將立即終止其帳號並刪除所有相關數據。
    </Section>
    <Section title="4. 付費訂閱">
      Premium 訂閱按月或按年計費。試用期結束後自動續費，你可以隨時在設定中取消訂閱。退款政策依當地法律及平台規定處理。
    </Section>
    <Section title="5. 隱私與數據">
      我們承諾保護你的個人數據。詳情請參閱隱私政策。我們不會出售你的個人資料給第三方廣告商。
    </Section>
    <Section title="6. 免責聲明">
      NYX 不對用戶之間的線下互動承擔責任。請在現實生活中謹慎與陌生人會面，並在公共場所進行初次見面。
    </Section>
    <Section title="7. 條款修改">
      我們保留修改本條款的權利。重大修改將通過應用內通知告知用戶。繼續使用服務即表示接受修改後的條款。
    </Section>
    <Section title="8. 聯繫我們">
      如有任何問題，請聯繫 support@nyx.app
    </Section>
  </>;
}

function PrivacyContent() {
  return <>
    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 24 }}>最後更新：2026年1月1日</div>
    <Section title="1. 我們收集的資料">
      我們收集你提供的個人資料（姓名、生日、照片），以及使用服務時產生的數據（位置、使用記錄、聊天內容）。
    </Section>
    <Section title="2. 資料使用方式">
      收集的資料用於提供配對服務、改善用戶體驗、保障平台安全，以及處理付費訂閱。我們不會將你的個人資料出售給第三方。
    </Section>
    <Section title="3. 位置資料">
      位置資料僅用於計算與其他用戶的距離，提供更準確的配對。我們不會實時追蹤你的位置。
    </Section>
    <Section title="4. 聊天內容">
      聊天訊息存儲在我們的安全服務器上。我們可能在處理投訴或審查違規行為時查看訊息內容。
    </Section>
    <Section title="5. 數據保留">
      刪除帳號後，你的個人資料和聊天記錄將在30天內從我們的服務器中刪除。
    </Section>
    <Section title="6. 你的權利">
      你有權查看、修改或刪除你的個人資料。你可以在設定頁面導出你的所有數據。如需協助，請聯繫 privacy@nyx.app。
    </Section>
    <Section title="7. 資料安全">
      我們採用業界標準的加密技術保護你的數據。所有數據傳輸均通過 HTTPS 加密。
    </Section>
    <Section title="8. 未成年人保護">
      本服務不面向18歲以下人士。如發現未成年用戶，我們將立即刪除其所有數據。
    </Section>
  </>;
}
