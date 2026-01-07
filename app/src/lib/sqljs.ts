import initSqlJs, { type SqlJsStatic } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

let cached: Promise<SqlJsStatic> | null = null;

async function loadWasmBinary(): Promise<ArrayBuffer> {
  const isVitest = typeof process !== "undefined" && Boolean(process.env?.VITEST);
  const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);
  if (isVitest || isNode) {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    const wasmPath = req.resolve("sql.js/dist/sql-wasm.wasm");
    const { readFile } = await import("fs/promises");
    const buf = await readFile(wasmPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const res = await fetch(sqlWasmUrl);
  return res.arrayBuffer();
}

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!cached) {
    cached = loadWasmBinary().then((wasmBinary) =>
      initSqlJs({
        wasmBinary,
      }),
    );
  }
  return cached;
}
