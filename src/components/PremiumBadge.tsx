import { C } from "../utils";

/** Premium 身份徽章。plan 為 null/undefined 時不渲染。mini=true 用於聊天列表/聊天頂欄等窄位置。 */
export function PremiumBadge({ plan, mini }: { plan?: string | null; mini?: boolean }) {
  if (!plan) return null;
  const plus = plan === "premium_plus";
  const color = plus ? C.rose : C.gold;
  if (mini) {
    return <span title={plus ? "Premium+" : "Premium"} style={{ fontSize: 12, fontWeight: 800, color, flexShrink: 0, lineHeight: 1 }}>{plus ? "✦+" : "✦"}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 11px", borderRadius: 20, background: plus ? C.roseSoft : C.goldSoft, border: `1px solid ${plus ? `${C.rose}55` : `${C.gold}55`}`, color, fontSize: 12, fontWeight: 700, flexShrink: 0, verticalAlign: "middle" }}>
      ✦ {plus ? "Premium+" : "Premium"}
    </span>
  );
}
