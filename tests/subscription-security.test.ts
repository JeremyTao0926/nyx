import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("subscription security contracts", () => {
  it("derives checkout identity and price on the server", () => {
    const checkout = source("supabase/functions/create-checkout/index.ts");
    expect(checkout).toContain("admin.auth.getUser(token)");
    expect(checkout).toContain("priceForPlan(plan)");
    expect(checkout).toContain("userId: authData.user.id");
    expect(checkout).toContain("Use the existing subscription to change plans");
    expect(checkout).not.toMatch(/price_\w+/);
    expect(checkout).not.toMatch(/const\s*\{[^}]*priceId[^}]*userId[^}]*\}\s*=\s*await req\.json/);
    expect(checkout).toContain('from("billing_accounts")');
  });

  it("upgrades the existing Stripe item without creating a second subscription", () => {
    const upgrade = source("supabase/functions/upgrade-subscription/index.ts");
    expect(upgrade).toContain("items: [{ id: item.id, price: premiumPlusPrice");
    expect(upgrade).toContain('proration_behavior: "none"');
    expect(upgrade).toContain("authData.user.id");
    expect(upgrade).not.toContain("checkout.sessions.create");
  });

  it("protects paid fields and viewer data at the database boundary", () => {
    const migration = source("supabase/migrations/20260908030000_subscription_security_profile_views_sparks.sql");
    expect(migration).toContain("SUBSCRIPTION_FIELDS_ARE_SERVER_MANAGED");
    expect(migration).toContain("has_active_nyx_premium(caller)");
    expect(migration).toContain("count(distinct viewer_id)");
    expect(migration).toContain("submit_daily_spark_answer");
    expect(migration).toContain("get_or_create_daily_spark");
    expect(migration).toContain("submit_encounter_choice");
    expect(migration).toContain("create_daily_encounter");
    expect(migration).toContain("set encounter_count = coalesce(encounter_count, 0) + 1");
    expect(migration).toContain("public.has_active_nyx_premium(caller)");
    expect(migration).toContain("revoke insert, update, delete on public.swipes");
    expect(migration).toContain('raise exception \'USER_BLOCKED\'');
    expect(migration).toContain("NOT_AUTHORIZED_TO_RESET_USAGE");
    expect(migration).toContain("create or replace function public.reset_daily_likes_if_needed");
    expect(migration).toContain("nyx_private.can_view_profile(id)");
    expect(migration).toContain("create table if not exists public.billing_accounts");
    expect(migration).toContain("revoke all on table public.billing_accounts from public, anon, authenticated");
    expect(migration).toContain("set stripe_customer_id = null");
  });

  it("uses atomic server functions for both shared-answer features", () => {
    const sparkCard = source("src/components/SparkCard.tsx");
    const utils = source("src/utils.ts");
    expect(sparkCard).toContain("submitSparkAnswer(");
    expect(sparkCard).not.toMatch(/from\(["']daily_sparks["']\)\.update/);
    expect(utils).not.toContain('from("daily_sparks")');
    expect(utils).toContain('sb.rpc("get_or_create_daily_spark"');
    expect(utils).toContain('sb.rpc("submit_daily_spark_answer"');
    expect(utils).toContain('sb.rpc("submit_encounter_choice"');
    expect(utils).toContain('sb.rpc("create_daily_encounter"');
  });

  it("allows external webhooks only because they verify their own secrets", () => {
    const config = source("supabase/config.toml");
    const stripe = source("supabase/functions/stripe-webhook/index.ts");
    const revenueCat = source("supabase/functions/revenuecat-webhook/index.ts");
    expect(config).toMatch(/\[functions\.stripe-webhook\][\s\S]*verify_jwt\s*=\s*false/);
    expect(config).toMatch(/\[functions\.revenuecat-webhook\][\s\S]*verify_jwt\s*=\s*false/);
    expect(stripe).toContain("stripe.webhooks.constructEvent");
    expect(revenueCat).toContain("REVENUECAT_WEBHOOK_SECRET");
  });

  it("derives push content from a real message and deduplicates delivery", () => {
    const sendPush = source("supabase/functions/send-push/index.ts");
    const migration = source("supabase/migrations/20260908030000_subscription_security_profile_views_sparks.sql");
    expect(sendPush).toContain("message_id");
    expect(sendPush).toContain('from("chat_messages")');
    expect(sendPush).toContain('from("push_delivery_log").insert');
    expect(sendPush).toContain('reason: "duplicate"');
    expect(sendPush).not.toMatch(/const\s*\{[^}]*title[^}]*body[^}]*\}\s*=\s*await req\.json/);
    expect(migration).toContain("create table if not exists public.push_delivery_log");
  });
});
