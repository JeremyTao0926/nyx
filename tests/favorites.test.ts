import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

import { toggleFavorite } from "../src/utils";

describe("private favorites", () => {
  afterEach(() => rpc.mockReset());

  it("uses the server-authorized toggle instead of writing the table directly", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(toggleFavorite("target-user", true)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("toggle_private_favorite", {
      p_target_id: "target-user",
      p_should_favorite: true,
    });
  });

  it("keeps favorites silent and removes them when either person blocks", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/20260908010000_private_premium_favorites.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("FAVORITE_LIMIT_REACHED");
    expect(sql).toContain("remove_pair_favorites_on_block");
    expect(sql).toContain("revoke all on function public.remove_pair_favorites_after_block() from public");
    expect(sql).toContain("blocker_id = p_target_id and blocked_id = p_owner_id");
    expect(sql).not.toMatch(/insert\s+into\s+public\.notifications/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.matches/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.chat_messages/i);
  });
});
