import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const loc = msg.location();
        const location = loc?.url ? `${loc.url}:${loc.lineNumber ?? 0}:${loc.columnNumber ?? 0}` : "";
        errors.push(location ? `${msg.text()} @ ${location}` : msg.text());
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400) {
        errors.push(`HTTP ${resp.status()} ${resp.url()}`);
      }
    });
    await use(page);
    expect(errors, errors.join("\n")).toEqual([]);
  },
});

export { expect } from "@playwright/test";
