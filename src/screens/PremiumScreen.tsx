import { useEffect, useRef, useState } from "react";
import { C, sb } from "../utils";
import type { UserProfile } from "../types";
import { isIOSNative } from "../platform";
import { getIOSPlanPrices, purchaseIOSPlan, restoreIOSPurchases, syncIOSSubscriptionProfile } from "../purchases";
import { getActivePremiumPlan, isPurchaseCancellation } from "../subscription";

const PLANS = [
  {
    id: "premium",
    name: "NYX Premium",
    price: "$9.99",
    period: "/月",
    color: C.gold,
    gradient: C.grad,
    features: [
      "無限喜歡",
      "查看所有喜歡你的人",
      "私人收藏（最多 100 人）",
      "優先認識 × 5/天",
      "高擬真模擬 × 20次/天（素材不限）",
      "完整互動與配對統計",
    ],
  },
  {
    id: "premium_plus",
    name: "NYX Premium+",
    price: "$19.99",
    period: "/月",
    color: C.rose,
    gradient: "linear-gradient(135deg,#7C67EA,#EF5F7A)",
    badge: "最受歡迎",
    features: [
      "以上 Premium 全部功能",
      "私人收藏升級至 250 人",
      "高擬真模擬 × 50次/天（素材不限）",
      "VIP 紫晶徽章",
    ],
  },
];

export function PremiumScreen({ onBack, profile, onProfileUpdate }: { onBack: () => void; profile?: UserProfile; onProfileUpdate?: (patch: Partial<UserProfile>) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [iosPrices, setIOSPrices] = useState<Record<string, string>>({});
  const [iosPriceError, setIOSPriceError] = useState(false);
  const activePlan = getActivePremiumPlan(profile);

  useEffect(() => {
    if (!isIOSNative) return;
    let active = true;
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      getIOSPlanPrices(user.id)
        .then(prices => { if (active) setIOSPrices(prices); })
        .catch(error => {
          console.error("Unable to load App Store prices", error);
          if (active) setIOSPriceError(true);
        });
    });
    return () => { active = false; };
  }, []);

  async function retryIOSPrices() {
    setIOSPriceError(false);
    setIOSPrices({});
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("請先登入");
      setIOSPrices(await getIOSPlanPrices(user.id));
    } catch (error) {
      console.error("Unable to load App Store prices", error);
      setIOSPriceError(true);
    }
  }

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

  async function handleUpgrade(plan: typeof PLANS[0]) {
    setLoading(plan.id);
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { alert("請先登入"); return; }

      if (isIOSNative) {
        const active = await purchaseIOSPlan(user.id, plan.id);
        if (!active) throw new Error("App Store 尚未啟用這項訂閱");
        const patch = await syncIOSSubscriptionProfile();
        if (!patch.is_premium) throw new Error("購買完成，會員權限仍在同步，請稍後再試");
        onProfileUpdate?.(patch);
        alert("訂閱已啟用 ✓");
        return;
      }

      // Downgrade: Premium+ → Premium (schedule for next billing cycle)
      if (activePlan === "premium_plus" && plan.id === "premium") {
        const { data: downgrade, error: downgradeErr } = await sb.functions.invoke("schedule-downgrade", {
          body: { plan: plan.id },
        });
        if (!downgradeErr) {
          const date = downgrade?.effectiveAt ? new Date(downgrade.effectiveAt).toLocaleDateString("zh-TW") : "本期結束後";
          alert(`✓ 已安排降級至 Premium，將於 ${date} 生效。`);
        } else {
          alert("操作失敗，請稍後再試");
        }
        return;
      }

      // Change the existing Stripe item instead of opening a second Checkout
      // subscription and accidentally charging the member twice.
      if (activePlan === "premium" && plan.id === "premium_plus") {
        const { data: upgrade, error: upgradeError } = await sb.functions.invoke("upgrade-subscription", {
          body: { plan: plan.id },
        });
        if (upgradeError || upgrade?.profile?.premium_plan !== "premium_plus") {
          console.error("Subscription upgrade error", upgradeError);
          alert("升級失敗，請稍後再試");
          return;
        }
        const patch: Partial<UserProfile> = {
          is_premium: true,
          premium_plan: "premium_plus",
          premium_expires_at: typeof upgrade.profile.premium_expires_at === "string"
            ? upgrade.profile.premium_expires_at
            : profile?.premium_expires_at ?? null,
        };
        onProfileUpdate?.(patch);
        alert("已升級 Premium+，新價格將於下次續訂生效 ✓");
        return;
      }

      const { data, error } = await sb.functions.invoke("create-checkout", {
        body: { plan: plan.id },
      });

      if (error || !data?.url) {
        console.error("Checkout error:", error);
        alert("付款系統錯誤，請稍後再試");
        return;
      }

      // Redirect to Stripe Checkout
      window.location.assign(data.url);
    } catch (e) {
      if (isPurchaseCancellation(e)) return;
      console.error(e);
      alert(e instanceof Error ? e.message : "發生錯誤，請稍後再試");
    } finally {
      setLoading(null);
    }
  }

  async function handleRestore() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    setLoading("restore");
    try {
      const storeHasSubscription = await restoreIOSPurchases(user.id);
      const patch = await syncIOSSubscriptionProfile();
      onProfileUpdate?.(patch);
      alert(storeHasSubscription && patch.is_premium ? "已恢復購買 ✓" : "找不到可恢復的訂閱");
    } catch (error) {
      console.error("Restore purchase failed", error);
      alert("恢復購買失敗，請稍後再試");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: C.overlay, display: "flex", justifyContent: "center", alignItems: "flex-end", backdropFilter: "blur(10px)" }}>
      <div onTouchStart={onSwipeTouchStart} onTouchMove={onSwipeTouchMove} onTouchEnd={onSwipeTouchEnd}
        style={{ width: "100%", maxWidth: 480, background: C.bg, height: "100%", display: "flex", flexDirection: "column" as const, overflowY: "auto",
          touchAction: "pan-y", transform: `translateX(${swipeDx}px)`, transition: swipeDx === 0 ? "transform .3s cubic-bezier(.32,.72,0,1)" : "none",
          boxShadow: swipeDx > 10 ? "-12px 0 36px rgba(57,42,101,0.22)" : "none" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 8px", flexShrink: 0 }}>
        <button type="button" aria-label="返回" onClick={onBack} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background: "none", border: "none", color: C.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>‹</button>
      </div>

      <div style={{ padding: "0 20px 48px" }}>
        {/* Already subscribed banner */}
        {activePlan && (
          <div style={{ background:C.goldSoft, border:`1px solid ${C.borderHigh}`, borderRadius:16, padding:"16px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:24 }}>✦</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.gold }}>
                你已訂閱 {activePlan === "premium_plus" ? "NYX Premium+" : "NYX Premium"}
              </div>
              <div style={{ fontSize:12, color:C.textMuted, marginTop:3 }}>
                {profile?.premium_expires_at
                  ? `到期時間：${new Date(profile.premium_expires_at).toLocaleDateString("zh-TW")}`
                  : "訂閱中"}
              </div>
            </div>
          </div>
        )}

        {/* Hero */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            {activePlan ? "管理訂閱" : "升級 NYX Premium"}
          </div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
            {activePlan ? "升級方案或管理你的訂閱" : "解鎖全部功能，找到真正的緣分"}
          </div>
        </div>

        {/* Plan cards */}
        {PLANS.map(plan => (
          <div key={plan.id} style={{ background: C.bgCard, borderRadius: 20, border: `1.5px solid ${plan.id === "premium_plus" ? plan.color + "55" : C.border}`, padding: "22px 20px", marginBottom: 16, position: "relative" as const, boxShadow:C.shadow }}>
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
                <span style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{isIOSNative ? (iosPrices[plan.id] || "—") : plan.price}</span>
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
              disabled={loading !== null || activePlan === plan.id || (isIOSNative && !iosPrices[plan.id])}
              style={{ width: "100%", padding: "14px", borderRadius: 50, background: loading === plan.id ? C.surfHigh : plan.gradient, border: "none", color: loading === plan.id ? C.textMuted : "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: loading === plan.id ? "default" : "pointer", marginTop: 16, transition: "all .2s", boxShadow: loading === plan.id ? "none" : `0 6px 20px ${plan.color}44` }}>
              {loading === plan.id ? "處理中..."
                : isIOSNative && iosPriceError ? "App Store 暫時無法連線"
                : isIOSNative && !iosPrices[plan.id] ? "載入 App Store 價格…"
                : activePlan === plan.id ? "目前方案 ✓"
                : activePlan === "premium_plus" && plan.id === "premium" ? "降級至 Premium（下期生效）"
                : activePlan ? `升級至 ${plan.name}`
                : `升級 ${plan.name}`}
            </button>
          </div>
        ))}

        {isIOSNative && iosPriceError && (
          <button type="button" onClick={retryIOSPrices} style={{ width:"100%", minHeight:46, marginBottom:8, border:`1px solid ${C.border}`, borderRadius:23, background:"transparent", color:C.gold, fontFamily:"inherit", fontWeight:700, cursor:"pointer" }}>
            重新載入 App Store 方案
          </button>
        )}

        {isIOSNative && (
          <button type="button" disabled={loading !== null} onClick={() => { void handleRestore(); }} style={{ width:"100%", minHeight:46, border:"none", background:"transparent", color:C.gold, fontWeight:700, cursor:loading ? "default" : "pointer", opacity:loading && loading !== "restore" ? .5 : 1 }}>
            {loading === "restore" ? "恢復中…" : "恢復購買"}
          </button>
        )}

        {isIOSNative && activePlan && (
          <a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer" style={{ minHeight:44, display:"flex", alignItems:"center", justifyContent:"center", color:C.textMuted, fontSize:13, textDecoration:"none" }}>
            管理 Apple 訂閱
          </a>
        )}

        {/* Note */}
        <div style={{ fontSize: 11.5, color: C.textDim, textAlign: "center" as const, lineHeight: 1.7, marginTop: 8 }}>
          訂閱將從你的帳戶中扣除費用。<br />
          可在訂閱期結束前 24 小時取消自動續費。<br />
          {isIOSNative ? "付款由 Apple App Store 安全處理。" : "付款由 Stripe 安全處理。"}
          <br/><a href="/terms.html" target="_blank" rel="noreferrer" style={{ color:C.textMuted }}>服務條款</a>
          <span> · </span>
          <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color:C.textMuted }}>隱私政策</a>
        </div>
      </div>
    </div>
    </div>
  );
}
