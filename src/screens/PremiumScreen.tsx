import { useState } from "react";
import { C, sb } from "../utils";
import type { UserProfile } from "../types";

const PLANS = [
  {
    id: "premium",
    name: "NYX Premium",
    price: "$9.99",
    period: "/月",
    priceId: "price_1TqL4EFGW7LQlHklKIg92RYJ",
    color: C.gold,
    gradient: "linear-gradient(135deg,#C9A84C,#E2C068)",
    features: [
      "無限喜歡",
      "查看所有喜歡你的人",
      "優先認識 × 5/天",
      "Clone 模擬 × 20次/天",
      "進階篩選條件",
      "已讀回執",
    ],
  },
  {
    id: "premium_plus",
    name: "NYX Premium+",
    price: "$19.99",
    period: "/月",
    priceId: "price_1TqL4jFGW7LQlHklwP3jaMK9",
    color: "#A78BFA",
    gradient: "linear-gradient(135deg,#7C3AED,#A78BFA)",
    badge: "最受歡迎",
    features: [
      "以上 Premium 全部功能",
      "Clone 進階 AI × 50次/天",
      "Boost × 1/週（曝光提升）",
      "VIP 金色徽章",
      "優先客服支援",
    ],
  },
];

export function PremiumScreen({ onBack, profile }: { onBack: () => void; profile?: UserProfile }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(plan: typeof PLANS[0]) {
    setLoading(plan.id);
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { alert("請先登入"); setLoading(null); return; }

      const { data, error } = await sb.functions.invoke("create-checkout", {
        body: {
          priceId: plan.priceId,
          userId: user.id,
          userEmail: user.email,
          plan: plan.id,
        },
      });

      if (error || !data?.url) {
        console.error("Checkout error:", error);
        alert("付款系統錯誤，請稍後再試");
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert("發生錯誤，請稍後再試");
      setLoading(null);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div style={{ width: "100%", maxWidth: 480, background: C.bg, height: "100%", display: "flex", flexDirection: "column" as const, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 8px", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>‹</button>
      </div>

      <div style={{ padding: "0 20px 48px" }}>
        {/* Already subscribed banner */}
        {(profile as any)?.is_premium && (
          <div style={{ background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:16, padding:"16px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:24 }}>✦</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.gold }}>
                你已訂閱 {(profile as any)?.premium_plan === "premium_plus" ? "NYX Premium+" : "NYX Premium"}
              </div>
              <div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>
                {(profile as any)?.premium_expires_at
                  ? `到期時間：${new Date((profile as any).premium_expires_at).toLocaleDateString("zh-TW")}`
                  : "訂閱中"}
              </div>
            </div>
          </div>
        )}

        {/* Hero */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            {(profile as any)?.is_premium ? "管理訂閱" : "升級 NYX Premium"}
          </div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
            {(profile as any)?.is_premium ? "升級方案或管理你的訂閱" : "解鎖全部功能，找到真正的緣分"}
          </div>
        </div>

        {/* Plan cards */}
        {PLANS.map(plan => (
          <div key={plan.id} style={{ background: C.bgCard, borderRadius: 20, border: `1.5px solid ${plan.id === "premium_plus" ? plan.color + "55" : C.border}`, padding: "22px 20px", marginBottom: 16, position: "relative" as const }}>
            {plan.badge && (
              <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)", background: plan.gradient, color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" as const }}>
                {plan.badge}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{plan.name}</div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>每月自動續費，可隨時取消</div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{plan.period}</span>
              </div>
            </div>

            {plan.features.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ color: plan.color, fontSize: 14, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13.5, color: C.textSub }}>{f}</span>
              </div>
            ))}

            <button
              onClick={() => handleUpgrade(plan)}
              disabled={loading === plan.id || (profile as any)?.premium_plan === plan.id}
              style={{ width: "100%", padding: "14px", borderRadius: 50, background: loading === plan.id ? "rgba(255,255,255,0.06)" : plan.gradient, border: "none", color: loading === plan.id ? C.textMuted : (plan.id === "premium" ? "#12100C" : "#fff"), fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: loading === plan.id ? "default" : "pointer", marginTop: 16, transition: "all .2s", boxShadow: loading === plan.id ? "none" : `0 4px 20px ${plan.color}44` }}>
              {loading === plan.id ? "處理中..."
                : (profile as any)?.premium_plan === plan.id ? "目前方案 ✓"
                : (profile as any)?.is_premium ? `升級至 ${plan.name}`
                : `升級 ${plan.name}`}
            </button>
          </div>
        ))}

        {/* Note */}
        <div style={{ fontSize: 11.5, color: C.textDim, textAlign: "center" as const, lineHeight: 1.7, marginTop: 8 }}>
          訂閱將從你的帳戶中扣除費用。<br />
          可在訂閱期結束前 24 小時取消自動續費。<br />
          付款由 Stripe 安全處理。
        </div>
      </div>
    </div>
    </div>
  );
}
