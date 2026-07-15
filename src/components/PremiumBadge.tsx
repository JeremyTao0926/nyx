/** Premium 身份徽章。plan 為 null/undefined 時不渲染。mini=true 用於聊天列表/聊天頂欄等窄位置。 */
export function PremiumBadge({ plan, mini }: { plan?: string | null; mini?: boolean }) {
  if (!plan) return null;
  const plus = plan === "premium_plus";
  const color = plus ? "#A78BFA" : "#C9A84C";
  if (mini) {
    return <span title={plus ? "Premium+" : "Premium"} style={{ fontSize: 12, fontWeight: 800, color, flexShrink: 0, lineHeight: 1 }}>{plus ? "✦+" : "✦"}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 11px", borderRadius: 20, background: plus ? "rgba(139,92,246,0.16)" : "rgba(201,168,76,0.16)", border: `1px solid ${plus ? "rgba(139,92,246,0.45)" : "rgba(201,168,76,0.45)"}`, color, fontSize: 12, fontWeight: 700, flexShrink: 0, verticalAlign: "middle" }}>
      ✦ {plus ? "Premium+" : "Premium"}
    </span>
  );
}
