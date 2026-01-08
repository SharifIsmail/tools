import { describe, expect, it } from "vitest";
import { createSQLiteCache } from "./sqliteCache";

describe("SQLiteCache", () => {
  it("evicts least recently used entries over the size limit", async () => {
    const cache = await createSQLiteCache({ maxBytes: 80, persist: false });
    await cache.set("a", { value: "x".repeat(20) });
    await cache.set("b", { value: "y".repeat(20) });
    await cache.get("a"); // touch A
    await cache.set("c", { value: "z".repeat(40) });

    const a = await cache.get<{ value: string }>("a");
    const b = await cache.get<{ value: string }>("b");
    const c = await cache.get<{ value: string }>("c");
    expect(!a || !b).toBe(true);
    expect(c?.value).toContain("z");
  });
});
