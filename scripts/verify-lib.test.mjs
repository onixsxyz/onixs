// Fake-chain tests for scripts/verify-lib.mjs: a correct deployment matches, and each kind of tampering fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyDeployment, put, addrWord, word, sel, marketId, MORPHO, IRM, USDG, USDG_FEED, SWAP_FACTORY, STOCKS } from "./verify-lib.mjs";
import { readConfig } from "./verify-deployment.mjs";

const ART = JSON.parse(readFileSync(new URL("../src/lib/onchain/artifacts.json", import.meta.url), "utf8")).contracts;
const ZERO = "0x" + "0".repeat(40);
const a = (n) => "0x" + n.toString(16).padStart(40, "0");
const CHARTER = a(0xc0), IMPL = a(0xc1), OWNER = a(0x0e);
const S = STOCKS.NVDA;
const SHORT = a(0xa1), LEASE = a(0xa2), CREDIT = a(0xa3);
const LLTV_SHORT = 625000000000000000n, LLTV_CREDIT = 625000000000000000n;

const runtime = (kind, values) => put(ART[kind].runtime, ART[kind].immutables, (r) => values[r.name]);
const strWords = (s) => {
  const hex = Buffer.from(s, "utf8").toString("hex");
  return word(s.length) + hex.padEnd(Math.ceil(hex.length / 64) * 64 || 64, "0");
};

function chain(tamper = {}) {
  const shortP = { loanToken: S.stock, collateralToken: USDG, oracle: SHORT, irm: IRM, lltv: LLTV_SHORT };
  const creditP = { loanToken: USDG, collateralToken: LEASE, oracle: CREDIT, irm: IRM, lltv: LLTV_CREDIT };
  const markImm = (lh) => ({
    stockFeed: addrWord(tamper.feed || S.feed), stock: addrWord(S.stock), usdgFeed: addrWord(USDG_FEED), usdg: addrWord(USDG), leasehold: addrWord(lh),
    stockFeedScale: word(10n ** 10n), usdgFeedScale: word(10n ** 10n), shareUnit: word(lh === ZERO ? 0n : 10n ** 24n), scale: word(lh === ZERO ? 10n ** 48n : 1n),
  });
  const code = {
    [CHARTER]: runtime("OnixsCharter", { morpho: addrWord(MORPHO), usdg: addrWord(USDG), swapFactory: addrWord(SWAP_FACTORY), berthImplementation: addrWord(IMPL) }),
    [IMPL]: runtime("OnixsBerth", { morpho: addrWord(MORPHO), usdg: addrWord(USDG), charter: addrWord(CHARTER), usdgTo18: word(10n ** 12n) }),
    [SHORT]: runtime("OnixsMark", markImm(ZERO)),
    [CREDIT]: runtime("OnixsMark", markImm(LEASE)),
    [LEASE]: runtime("OnixsLeasehold", {
      _asset: addrWord(S.stock), _underlyingDecimals: word(18), morpho: addrWord(MORPHO), marketId: marketId(shortP).slice(2),
      mLoan: addrWord(S.stock), mCollateral: addrWord(USDG), mOracle: addrWord(SHORT), mIrm: addrWord(IRM), mLltv: word(LLTV_SHORT),
    }),
  };
  if (tamper.code) code[tamper.code] = code[tamper.code].slice(0, -2) + (code[tamper.code].endsWith("00") ? "01" : "00");
  const markArgs = (lh) => addrWord(S.feed) + addrWord(S.stock) + addrWord(USDG_FEED) + addrWord(USDG) + addrWord(lh);
  const leaseArgs = addrWord(S.stock) + addrWord(MORPHO) + addrWord(S.stock) + addrWord(USDG) + addrWord(SHORT) + addrWord(IRM) + word(LLTV_SHORT) + word(9 * 32) + word(9 * 32 + 64) + strWords("ONIXS NVDA") + strWords("onNVDA");
  const txs = [
    { block: 100, addr: CHARTER, input: ART.OnixsCharter.bytecode + addrWord(OWNER) + addrWord(MORPHO) + addrWord(USDG) + addrWord(SWAP_FACTORY) },
    { block: 200, addr: SHORT, input: ART.OnixsMark.bytecode + markArgs(ZERO) },
    { block: 201, addr: LEASE, input: ART.OnixsLeasehold.bytecode + (tamper.leaseArgs || leaseArgs) },
    { block: 203, addr: CREDIT, input: ART.OnixsMark.bytecode + markArgs(LEASE) },
  ].map((t, i) => ({ ...t, hash: "0x" + word(i + 1) }));
  const listing = "0x" + [S.stock, S.feed, tamper.pool || S.pool, LEASE].map(addrWord).join("") +
    [shortP, creditP].map((p) => addrWord(p.loanToken) + addrWord(p.collateralToken) + addrWord(p.oracle) + addrWord(p.irm) + word(p.lltv)).join("") +
    word(18000) + word(5000) + word(300) + word(93600) + word(0);
  return async (method, params) => {
    if (tamper.rpcError === method) throw new Error("node down");
    switch (method) {
      case "eth_chainId": return tamper.chainId || "0x1237";
      case "eth_getCode": return code[params[0].toLowerCase()] || "0x";
      case "eth_getBlockByNumber": {
        const b = Number(BigInt(params[0]));
        return { number: params[0], transactions: txs.filter((t) => t.block === b).map((t) => ({ hash: t.hash, to: null, input: t.input })) };
      }
      case "eth_getTransactionReceipt": {
        const t = txs.find((x) => x.hash === params[0]);
        return { status: tamper.failedTx === t.addr ? "0x0" : "0x1", contractAddress: t.addr };
      }
      case "eth_call": {
        const { to, data } = params[0];
        if (to === CHARTER && data === sel("owner()")) return "0x" + addrWord(OWNER);
        if (to === CHARTER && data === sel("pendingOwner()")) return "0x" + word(0);
        if (to === CHARTER && data === sel("listingCount()")) return "0x" + word(1);
        if (to === CHARTER && data.startsWith(sel("getListing(uint256)"))) return listing;
        if (to === MORPHO && data.startsWith(sel("market(bytes32)"))) return "0x" + word(1) + word(1) + word(0) + word(0) + word(tamper.noMarket ? 0 : 1700000000) + word(0);
        throw new Error(`unexpected call ${to} ${data.slice(0, 10)}`);
      }
      default: throw new Error(`unexpected ${method}`);
    }
  };
}

const config = { CHARTER, CHARTER_BLOCK: 100, LISTINGS: [{ symbol: "NVDA", shortMark: SHORT, leasehold: LEASE, creditMark: CREDIT, block: 200 }] };
const run = (tamper, cfg = config, expect = {}) => verifyDeployment({ config: cfg, rpc: chain(tamper), ART, expect, scanBlocks: 10 });

test("a correct deployment matches", async () => {
  const r = await run({}, config, { owner: OWNER });
  assert.equal(r.ok, true, r.lines.filter((l) => l.startsWith("FAIL")).join("\n"));
});

for (const [name, tamper] of [
  ["tampered leasehold code", { code: LEASE }],
  ["tampered berth implementation", { code: IMPL }],
  ["a mark wired to the wrong feed", { feed: STOCKS.SPY.feed }],
  ["a listing with another pool", { pool: STOCKS.SPY.pool }],
  ["a failed creation transaction", { failedTx: SHORT }],
  ["leasehold constructor arguments that differ", { leaseArgs: addrWord(S.stock) + addrWord(MORPHO) + addrWord(S.stock) + addrWord(USDG) + addrWord(CREDIT) + addrWord(IRM) + word(LLTV_SHORT) + word(9 * 32) + word(9 * 32 + 64) + strWords("x") + strWords("y") }],
  ["a missing Morpho market", { noMarket: true }],
  ["another chain", { chainId: "0x1" }],
  ["an RPC error", { rpcError: "eth_getCode" }],
]) {
  test(`fails on ${name}`, async () => {
    const r = await run(tamper);
    assert.equal(r.ok, false);
  });
}

test("fails on a wrong expected owner", async () => {
  assert.equal((await run({}, config, { owner: a(0x99) })).ok, false);
});

test("fails when nothing is configured", async () => {
  assert.equal((await run({}, { CHARTER: "", CHARTER_BLOCK: 0, LISTINGS: [] })).ok, false);
});

test("fails when the deploy block is wrong", async () => {
  assert.equal((await run({}, { ...config, CHARTER_BLOCK: 5000 })).ok, false);
});

test("reads the TypeScript config", () => {
  const cfg = readConfig(`export const CHARTER = "${CHARTER}";\nexport const CHARTER_BLOCK = 100;\nexport const LISTINGS: { symbol: "SPY" | "QQQ" | "NVDA"; shortMark: string; leasehold: string; creditMark: string; block: number }[] = [\n  { symbol: "NVDA", shortMark: "${SHORT}", leasehold: "${LEASE}", creditMark: "${CREDIT}", block: 200 },\n];\n`);
  assert.deepEqual(cfg, config);
  assert.deepEqual(readConfig(`export const CHARTER = "";\nexport const CHARTER_BLOCK = 0;\nexport const LISTINGS: { symbol: string }[] = [];`), { CHARTER: "", CHARTER_BLOCK: 0, LISTINGS: [] });
});
