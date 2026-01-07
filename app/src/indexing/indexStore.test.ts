import { describe, expect, it } from "vitest";
import { createIndexStore } from "./indexStore";

describe("IndexStore", () => {
  it("enqueues changed files and pops batches", async () => {
    const store = await createIndexStore({ persist: false, maxResults: 10 });
    await store.enqueueFiles([
      { id: "a", path: "/Notes/A.md", lastModified: 1 },
      { id: "b", path: "/Notes/B.md", lastModified: 2 },
    ]);
    const batch = await store.nextBatch(10);
    expect(batch.sort()).toEqual(["a", "b"]);
  });

  it("removes items after indexing and supports search", async () => {
    const store = await createIndexStore({ persist: false, maxResults: 10 });
    await store.enqueueFiles([{ id: "a", path: "/Notes/A.md", lastModified: 1 }]);
    await store.saveIndex({
      fileId: "a",
      path: "/Notes/A.md",
      lastModified: 1,
      summary: "hello world summary",
      keywords: ["hello", "world"],
      entities: ["World"],
    });
    const batch = await store.nextBatch(10);
    expect(batch).toEqual([]);
    const results = await store.search("world");
    expect(results[0]?.fileId).toBe("a");
  });
});
