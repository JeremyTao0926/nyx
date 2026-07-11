import { createClient } from "@supabase/supabase-js";

// Use env vars — never hardcode
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export { sb };

export type AdminRole = "super_admin" | "moderator" | "analyst" | "tester";

export async function grantPremium(userId: string, plan: "premium" | "premium_plus" | null) {
  const expiresAt = plan ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const { error } = await sb.from("profiles").update({
    is_premium: plan !== null,
    premium_plan: plan,
    premium_expires_at: expiresAt,
  }).eq("id", userId);
  if (error) throw error;
}

export interface AdminUser {
  userId: string;
  role: AdminRole;
  isActive: boolean;
}

export interface UserStats {
  matches: number;
  messages: number;
  reports: number;
}

export interface PlatformStats {
  total_users: number;
  test_users: number;
  banned_users: number;
  active_24h: number;
  active_7d: number;
  total_matches: number;
  matches_today: number;
  messages_today: number;
  pending_reports: number;
  total_sparks: number;
  sparks_today: number;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  category: string;
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
  reviewed: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  gender: string;
  is_test_account: boolean;
  test_label: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  last_active: string;
  created_at: string;
  avatar_url: string | null;
}

// ─── Admin auth check ─────────────────────────────────
export async function getMyAdminRole(): Promise<AdminRole | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();

  console.log("USER =", user);

  if (!user) return null;

  const result = await sb
    .from("admin_users")
    .select("*")
    .eq("user_id", user.id);

  console.log("ADMIN QUERY =", result);

  const { data } = result;

  if (!data || data.length === 0) return null;

  return data[0].role as AdminRole;
}

export function canDo(role: AdminRole | null, required: AdminRole): boolean {
  if (!role) return false;
  const levels: AdminRole[] = ["tester", "analyst", "moderator", "super_admin"];
  return levels.indexOf(role) >= levels.indexOf(required);
}

// ─── Stats ────────────────────────────────────────────
export async function getPlatformStats(): Promise<PlatformStats | null> {
  const { data, error } = await sb.rpc("get_platform_stats");
  if (error) { console.error(error); return null; }
  return data as PlatformStats;
}

// ─── Users ────────────────────────────────────────────
export async function getUsers(opts: {
  isTest?: boolean; isBanned?: boolean; search?: string; limit?: number;
}): Promise<UserRow[]> {
  let q = sb.from("profiles")
    .select("id,username,display_name,email,gender,is_test_account,test_label,is_banned,ban_reason,last_active,created_at,avatar_url,is_premium,premium_plan,premium_expires_at")
    .order("created_at", { ascending: false })
    .limit(opts.limit || 50);
  if (opts.isTest !== undefined) q = q.eq("is_test_account", opts.isTest);
  if (opts.isBanned !== undefined) q = q.eq("is_banned", opts.isBanned);
  if (opts.search) q = q.or(`username.ilike.%${opts.search}%,display_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
  const { data } = await q;
  return (data || []) as UserRow[];
}

export async function markTestAccount(userId: string, isTest: boolean, label?: string) {
  await sb.from("profiles").update({ is_test_account: isTest, test_label: label || null }).eq("id", userId);
  await logAction("mark_test_account", "user", userId, { isTest, label });
}

export async function banUser(userId: string, reason: string) {
  const { error } = await sb.rpc("ban_user", { p_user_id: userId, p_reason: reason });
  if (error) throw error;
}

export async function unbanUser(userId: string) {
  const { error } = await sb.rpc("unban_user", { p_user_id: userId });
  if (error) throw error;
}

export async function deleteTestData(userId: string) {
  const { error } = await sb.rpc("delete_test_data", { p_user_id: userId });
  if (error) throw error;
}

// ─── Reports ──────────────────────────────────────────
export async function getReports(pending = true): Promise<Report[]> {
  const { data } = await sb.from("reports")
    .select(`id, reporter_id, reported_id, reason, category, created_at,
      reporter:profiles!reporter_id(display_name,username),
      reported:profiles!reported_id(display_name,username),
      review:report_review_log(id)`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data) return [];
  return data.map((r: any) => ({
    id: r.id, reporter_id: r.reporter_id, reported_id: r.reported_id,
    reason: r.reason, category: r.category, created_at: r.created_at,
    reporter_name: r.reporter?.display_name || r.reporter?.username,
    reported_name: r.reported?.display_name || r.reported?.username,
    reviewed: (r.review?.length || 0) > 0,
  })).filter((r: any) => pending ? !r.reviewed : r.reviewed);
}

export async function authorizeReview(reportId: string, notes: string) {
  const { data: { user } } = await sb.auth.getUser();
  await sb.from("report_review_log").insert({
    report_id: reportId, reviewer_id: user!.id, notes, action_taken: "pending"
  });
}

export async function resolveReport(reportId: string, action: "warning" | "ban" | "dismissed", notes: string) {
  const { data: { user } } = await sb.auth.getUser();
  await sb.from("report_review_log")
    .update({ action_taken: action, notes })
    .eq("report_id", reportId)
    .eq("reviewer_id", user!.id);
  await logAction("resolve_report", "report", reportId, { action, notes });
}

// ─── Audit log ────────────────────────────────────────
export async function logAction(action: string, targetType: string, targetId: string, meta?: any) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("admin_audit_log").insert({
    admin_id: user.id, action, target_type: targetType, target_id: targetId, metadata: meta || {}
  });
}

export async function getAuditLog(limit = 50) {
  const { data } = await sb.from("admin_audit_log")
    .select("*, admin:profiles!admin_id(display_name,username)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [matches, messages, reports] = await Promise.all([
    sb.from("matches").select("id", { count: "exact", head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),

    sb.from("chat_messages").select("id", { count: "exact", head: true })
      .eq("sender_id", userId),

    sb.from("reports").select("id", { count: "exact", head: true })
      .eq("reported_id", userId),
  ]);

  return {
    matches: matches.count || 0,
    messages: messages.count || 0,
    reports: reports.count || 0,
  };
}

export async function disableUser(userId: string) {
  const { error } = await sb.rpc("disable_user", {
    p_user_id: userId,
  });

  if (error) throw error;

  await logAction("disable_user", "user", userId);
}

export async function restoreUser(userId: string) {
  const { error } = await sb.rpc("restore_user", {
    p_user_id: userId,
  });

  if (error) throw error;

  await logAction("restore_user", "user", userId);
}

export async function softDeleteUser(userId: string) {
  const { error } = await sb.rpc("soft_delete_user", {
    p_user_id: userId,
  });

  if (error) throw error;

  await logAction("soft_delete_user", "user", userId);
}