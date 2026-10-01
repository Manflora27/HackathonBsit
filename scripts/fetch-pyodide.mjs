// Copies the Pyodide runtime plus the SymPy/mpmath wheels into public/pyodide
// so the math engine works offline and inside the Capacitor app.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = dirname(require.resolve("pyodide/package.json"));
const { version } = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));
const out = "public/pyodide";
mkdirSync(out, { recursive: true });

for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  cpSync(join(src, f), join(out, f));
}

const lock = JSON.parse(readFileSync(join(src, "pyodide-lock.json"), "utf8"));
for (const name of ["sympy", "mpmath"]) {
  const file = lock.packages[name].file_name;
  const dest = join(out, file);
  if (existsSync(dest)) continue;
  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${url} (${res.status})`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log("fetched", file);
}
console.log(`pyodide ${version} ready in ${out}`);
