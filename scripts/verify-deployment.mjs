// Proves that the addresses in src/config/contracts.ts run this repository's ONIXS contracts on Robinhood Chain.
//   node scripts/verify-deployment.mjs [--owner 0x…] [--rpc https://…] [--config path/to/contracts.ts]
// RPC: --rpc, else VERIFY_RPC_URL, else a public Robinhood Chain endpoint. Exit code 0 only when every check passes.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { verifyDeployment } from "./verify-lib.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const RPC = arg("rpc") || process.env.VERIFY_RPC_URL || "https://robinhood.drpc.org";

/** Reads CHARTER, CHARTER_BLOCK and LISTINGS from the TypeScript config without executing it. */
export function readConfig(text) {
  const str = (name) => (new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*"([^"]*)"`).exec(text) || [])[1] ?? "";
  const num = (name) => Number((new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*(\\d+)`).exec(text) || [])[1] ?? 0);
  const body = (/export const LISTINGS[^=]*=\s*\[([\s\S]*?)\];/.exec(text) || [])[1] ?? "";
  const LISTINGS = [...body.matchAll(/\{([^}]*)\}/g)].map((m) => {
    const f = (k) => (new RegExp(`${k}\\s*:\\s*"([^"]*)"`).exec(m[1]) || [])[1] ?? "";
    return { symbol: f("symbol"), shortMark: f("shortMark"), leasehold: f("leasehold"), creditMark: f("creditMark"), block: Number((/block\s*:\s*(\d+)/.exec(m[1]) || [])[1] ?? 0) };
  });
  return { CHARTER: str("CHARTER"), CHARTER_BLOCK: num("CHARTER_BLOCK"), LISTINGS };
}

let id = 0;
async function rpc(method, params) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
      const j = await res.json();
      if (j.error) {
        // public nodes sometimes answer "Unknown state" for a moment; retry those, fail on anything else
        if (/unknown state|header not found|timeout/i.test(String(j.error.message)) && attempt < 4) continue;
        throw new Error(j.error.message);
      }
      return j.result;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig(readFileSync(arg("config") || new URL("../src/config/contracts.ts", import.meta.url), "utf8"));
  const ART = JSON.parse(readFileSync(new URL("../src/lib/onchain/artifacts.json", import.meta.url), "utf8")).contracts;
  const { ok, lines } = await verifyDeployment({ config, rpc, ART, expect: { owner: arg("owner") } });
  for (const l of lines) console.log(l);
  console.log(ok ? "MATCH: every configured address runs this build, wired as configured" : "NO MATCH");
  process.exit(ok ? 0 : 1);
}
