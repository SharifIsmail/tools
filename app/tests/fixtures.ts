import { test as base, expect, type Page } from "@playwright/test";

type AllowList = {
  allowedHttpErrors?: RegExp[];
  allowedConsoleErrors?: RegExp[];
};

function normalize(list: RegExp[] | undefined): RegExp[] {
  if (!list) return [];
  return Array.isArray(list) ? list : [list];
}

function isAllowed(list: RegExp[] | undefined, value: string) {
  const arr = normalize(list);
  if (arr.length === 0) return false;
  return arr.some((re) => re.test(value));
}

export const test = base.extend<AllowList>({
  allowedHttpErrors: undefined,
  allowedConsoleErrors: undefined,
  page: async ({ page, allowedHttpErrors, allowedConsoleErrors }, runWithPage) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const loc = msg.location();
        const location = loc?.url ? `${loc.url}:${loc.lineNumber ?? 0}:${loc.columnNumber ?? 0}` : "";
        const text = location ? `${msg.text()} @ ${location}` : msg.text();
        const urlInText = text.match(/https?:\/\/\S+/)?.[0];
        if (isAllowed(allowedConsoleErrors, text)) return;
        if (urlInText && isAllowed(allowedHttpErrors, urlInText)) return;
        errors.push(text);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400) {
        const text = `HTTP ${resp.status()} ${resp.url()}`;
        if (!isAllowed(allowedHttpErrors, text)) {
          errors.push(text);
        }
      }
    });
    await runWithPage(page as Page);
    expect(errors, errors.join("\n")).toEqual([]);
  },
});

export { expect } from "@playwright/test";
