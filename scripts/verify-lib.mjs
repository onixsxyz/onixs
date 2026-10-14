// Checks behind scripts/verify-deployment.mjs, kept free of I/O so they can be tested with a fake chain.
//
// How it decides that the configured addresses run this repository's ONIXS contracts:
//   - Runtime code is compared byte for byte with src/lib/onchain/artifacts.json
//     (`npm run contracts:artifacts -- --check` proves that file is a fresh forge build). Only immutables may
//     differ; each is decoded by name and compared with the value it must hold (Morpho, USDG, feeds, wiring).
//   - The creation transaction of every contract is found from the configured block: it must have succeeded,
//     its receipt must name the configured address, and its input must be this build's creation code followed
//     by exactly the constructor arguments, which must agree with the deployed immutables.
//   - The charter's listings must point at the same leaseholds and marks as the site config, for the real stock
//     token, feed and pool of each symbol, and both Morpho markets must exist.
// Every check fails closed: an RPC error, an empty or malformed answer is a FAIL, never a skip.
import { keccak_256 } from "@noble/hashes/sha3.js";

export const CHAIN_ID = 4663;
export const MORPHO = "0x9d53d5e3bd5e8d4cbfa6db1ca238aea02e651010";
export const IRM = "0x2bd3d5965b26b51814ac95127b2b80dd6ccc0fa1";
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export const USDG_FEED = "0x61b7e5650328764b076a108eff5fa7282a1b9ad2";
export const SWAP_FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
export const STOCKS = {
  SPY: { stock: "0x117cc2133c37b721f49de2a7a74833232b3b4c0c", feed: "0x319724394d3a0e3669269846abe664cd621f9f6a", pool: "0xa7bb1ac63bbab0c44316e6c8c455213441689167" },
  QQQ: { stock: "0xd5f3879160bc7c32ebb4dc785f8a4f505888de68", feed: "0x80901d846d5d7b030f26b480776ee3b29374c2ae", pool: "0xd60a5d14db690b7afad71f76b108071d7175597d" },
  NVDA: { stock: "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec", feed: "0x379ec4f7c378f34a1b47e4f3cbebcbac3e8e9f15", pool: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3" },
};
export const SCAN_BLOCKS = 400;

const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const ZERO = "0x" + "0".repeat(40);
export const keccakHex = (hex) => "0x" + Buffer.from(keccak_256(Buffer.from(hex.replace(/^0x/, ""), "hex"))).toString("hex");
export const sel = (sig) => "0x" + Buffer.from(keccak_256(new TextEncoder().encode(sig))).toString("hex").slice(0, 8);
export const word = (n) => BigInt(n).toString(16).padStart(64, "0");
export const addrWord = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const asAddr = (w) => "0x" + w.slice(-40);
const slice = (hex, start, length) => hex.slice(2 + start * 2, 2 + (start + length) * 2);
export const put = (hex, ranges, bytes) => {
  let out = hex.slice(2);
  for (const r of ranges) out = out.slice(0, r.start * 2) + bytes(r) + out.slice((r.start + r.length) * 2);
  return "0x" + out;
};
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Morpho market id: keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv)). */
export const marketId = (p) => keccakHex("0x" + addrWord(p.loanToken) + addrWord(p.collateralToken) + addrWord(p.oracle) + addrWord(p.irm) + word(p.lltv));

/** { immutables } when `code` is this build's `kind` apart from immutables, else null. */
export function match(ART, kind, code) {
  const a = ART[kind];
  code = String(code).toLowerCase();
  if (!a || code.length !== a.runtime.length) return null;
  const immutables = {};
  for (const r of a.immutables) {
    const v = slice(code, r.start, r.length);
    if (immutables[r.name] !== undefined && immutables[r.name] !== v) return null;
    immutables[r.name] = v;
  }
  return put(a.runtime, a.immutables, (r) => immutables[r.name]) === code ? { immutables } : null;
}

/** Decodes the 19-word static OnixsListing returned by getListing(uint256). */
export function decodeListing(hex) {
  const w = (i) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
  if (!isHex(hex) || hex.length < 2 + 19 * 64) throw new Error("listing answer too short");
  const mp = (o) => ({ loanToken: asAddr(w(o)), collateralToken: asAddr(w(o + 1)), oracle: asAddr(w(o + 2)), irm: asAddr(w(o + 3)), lltv: BigInt("0x" + w(o + 4)) });
  return {
    stock: asAddr(w(0)), feed: asAddr(w(1)), pool: asAddr(w(2)), leasehold: asAddr(w(3)),
    shortMarket: mp(4), creditMarket: mp(9),
    maxLeverageBps: Number(BigInt("0x" + w(14))), shortOpenLtvBps: Number(BigInt("0x" + w(15))),
    maxSlipBps: Number(BigInt("0x" + w(16))), maxFeedAge: Number(BigInt("0x" + w(17))), paused: BigInt("0x" + w(18)) === 1n,
  };
}

/** ABI string at a byte offset inside the constructor arguments. */
function readString(args, offsetBytes) {
  const at = Number(offsetBytes) * 2;
  const len = Number(BigInt("0x" + args.slice(at, at + 64)));
  return Buffer.from(args.slice(at + 64, at + 64 + len * 2), "hex").toString("utf8");
}

/**
 * config: { CHARTER, CHARTER_BLOCK, LISTINGS: [{ symbol, shortMark, leasehold, creditMark, block }] }
 * rpc(method, params) -> result (may throw). expect: { owner? }. ART: artifacts.json `contracts`.
 * Returns { ok, lines }.
 */
export async function verifyDeployment({ config, rpc, expect = {}, ART, scanBlocks = SCAN_BLOCKS }) {
  const lines = [];
  let failed = false;
  const ok = (m) => lines.push(`OK   ${m}`);
  const info = (m) => lines.push(`INFO ${m}`);
  const fail = (m) => {
    failed = true;
    lines.push(`FAIL ${m}`);
  };
  const call = async (to, data) => {
    const out = await rpc("eth_call", [{ to, data }, "latest"]);
    if (!isHex(out) || out.length < 66) throw new Error(`empty answer for ${data.slice(0, 10)} at ${to}`);
    return out;
  };
  const expectImm = (label, m, name, want) => {
    const got = m.immutables[name];
    const wantHex = isAddr(want) ? addrWord(want) : word(want);
    if (got === wantHex) ok(`${label}.${name} = ${isAddr(want) ? want : BigInt(want).toString()}`);
    else fail(`${label}.${name} = 0x${got}, expected ${want}`);
  };

  async function codeOf(label, kind, at) {
    let code;
    try {
      code = String((await rpc("eth_getCode", [at, "latest"])) || "0x").toLowerCase();
    } catch (e) {
      fail(`${label} at ${at}: eth_getCode failed (${e instanceof Error ? e.message : e})`);
      return null;
    }
    if (code === "0x") {
      fail(`${label} at ${at}: no code`);
      return null;
    }
    const m = match(ART, kind, code);
    if (!m) fail(`${label} at ${at}: runtime code differs from this build's ${kind}`);
    else ok(`${label} at ${at}: runtime code is this build's ${kind}`);
    return m;
  }

  // Creation transactions in [from, from + scanBlocks): contract address -> { hash, input }.
  const creations = new Map();
  const scanned = new Set();
  async function scan(from) {
    if (scanned.has(from)) return;
    scanned.add(from);
    for (let b = from; b < from + scanBlocks; b++) {
      const blk = await rpc("eth_getBlockByNumber", ["0x" + b.toString(16), true]);
      if (!blk) break;
      for (const t of blk.transactions || []) {
        if (t.to !== null && t.to !== undefined) continue;
        const r = await rpc("eth_getTransactionReceipt", [t.hash]);
        if (!r || !isAddr(r.contractAddress)) continue;
        creations.set(r.contractAddress.toLowerCase(), { hash: t.hash, input: String(t.input || "").toLowerCase(), status: r.status, block: b });
      }
    }
  }

  async function creationArgs(label, kind, at, fromBlock) {
    if (!Number.isInteger(fromBlock) || fromBlock <= 0) {
      fail(`${label}: no deploy block in the config`);
      return null;
    }
    await scan(fromBlock);
    const c = creations.get(at.toLowerCase());
    if (!c) {
      fail(`${label}: no creation transaction for ${at} within ${scanBlocks} blocks of ${fromBlock}`);
      return null;
    }
    if (c.status !== "0x1") {
      fail(`${label}: creation transaction ${c.hash} failed`);
      return null;
    }
    ok(`${label}: created by ${c.hash} (block ${c.block}), receipt names ${at}`);
    const creation = ART[kind].bytecode;
    if (!isHex(c.input) || !c.input.startsWith(creation)) {
      fail(`${label}: creation input differs from this build's ${kind} creation code`);
      return null;
    }
    ok(`${label}: creation input starts with this build's creation code`);
    return c.input.slice(creation.length);
  }

  try {
    const id = await rpc("eth_chainId", []);
    if (!/^0x[0-9a-fA-F]+$/.test(String(id))) return { ok: false, lines: [...lines, `FAIL chain id unreadable: ${id}`] };
    if (Number(BigInt(id)) === CHAIN_ID) ok(`chain id ${CHAIN_ID}`);
    else fail(`chain id is ${Number(BigInt(id))}, expected ${CHAIN_ID}`);

    const charter = String(config.CHARTER || "").toLowerCase();
    if (!isAddr(charter)) {
      fail(`CHARTER is not set (${config.CHARTER || "empty"}): nothing is deployed yet`);
      return { ok: false, lines };
    }

    // ---- charter + berth implementation
    const cm = await codeOf("OnixsCharter", "OnixsCharter", charter);
    if (cm) {
      expectImm("OnixsCharter", cm, "morpho", MORPHO);
      expectImm("OnixsCharter", cm, "usdg", USDG);
      expectImm("OnixsCharter", cm, "swapFactory", SWAP_FACTORY);
      const impl = asAddr(cm.immutables.berthImplementation);
      const bm = await codeOf("OnixsBerth implementation", "OnixsBerth", impl);
      if (bm) {
        expectImm("OnixsBerth", bm, "morpho", MORPHO);
        expectImm("OnixsBerth", bm, "usdg", USDG);
        expectImm("OnixsBerth", bm, "charter", charter);
        expectImm("OnixsBerth", bm, "usdgTo18", 10n ** 12n);
      }
      const args = await creationArgs("OnixsCharter", "OnixsCharter", charter, config.CHARTER_BLOCK);
      if (args !== null) {
        if (args.length !== 4 * 64) fail(`OnixsCharter constructor arguments have ${args.length / 2} bytes, expected 128`);
        else {
          const w = (i) => args.slice(i * 64, (i + 1) * 64);
          if (w(1) === cm.immutables.morpho && w(2) === cm.immutables.usdg && w(3) === cm.immutables.swapFactory) ok("OnixsCharter constructor morpho/usdg/swapFactory = deployed values");
          else fail("OnixsCharter constructor arguments differ from the deployed immutables");
          const owner0 = asAddr(w(0));
          if (expect.owner && !same(owner0, expect.owner)) fail(`OnixsCharter constructor owner ${owner0}, expected ${expect.owner}`);
          else info(`OnixsCharter constructor owner = ${owner0}`);
        }
      }
      const owner = asAddr((await call(charter, sel("owner()"))).slice(2));
      if (expect.owner && !same(owner, expect.owner)) fail(`OnixsCharter.owner() = ${owner}, expected ${expect.owner}`);
      else info(`OnixsCharter.owner() = ${owner}`);
      const pending = asAddr((await call(charter, sel("pendingOwner()"))).slice(2));
      if (!same(pending, ZERO)) info(`OnixsCharter.pendingOwner() = ${pending} (ownership transfer not accepted yet)`);
      const count = Number(BigInt(await call(charter, sel("listingCount()"))));
      const n = (config.LISTINGS || []).length;
      if (count === n) ok(`OnixsCharter.listingCount() = ${count}, the config lists ${n}`);
      else fail(`OnixsCharter.listingCount() = ${count}, the config lists ${n}`);
    }

    // ---- listings
    for (let i = 0; i < (config.LISTINGS || []).length; i++) {
      const L = config.LISTINGS[i];
      const s = STOCKS[L.symbol];
      const tag = `${L.symbol} (listing ${i})`;
      if (!s) {
        fail(`${tag}: unknown symbol`);
        continue;
      }
      for (const k of ["shortMark", "leasehold", "creditMark"]) if (!isAddr(L[k])) fail(`${tag}: ${k} is not an address (${L[k]})`);
      if (failed && !isAddr(L.shortMark)) continue;

      // marks
      for (const [label, at, lh] of [
        [`${tag} short mark`, L.shortMark, ZERO],
        [`${tag} credit mark`, L.creditMark, L.leasehold],
      ]) {
        const m = await codeOf(label, "OnixsMark", at);
        if (!m) continue;
        expectImm(label, m, "stockFeed", s.feed);
        expectImm(label, m, "stock", s.stock);
        expectImm(label, m, "usdgFeed", USDG_FEED);
        expectImm(label, m, "usdg", USDG);
        expectImm(label, m, "leasehold", lh);
        const args = await creationArgs(label, "OnixsMark", at, L.block);
        if (args !== null) {
          const want = addrWord(s.feed) + addrWord(s.stock) + addrWord(USDG_FEED) + addrWord(USDG) + addrWord(lh);
          if (args === want) ok(`${label}: constructor arguments = (feed, stock, USDG feed, USDG, ${same(lh, ZERO) ? "no leasehold" : "leasehold"})`);
          else fail(`${label}: constructor arguments differ from the expected wiring`);
        }
      }

      // leasehold
      const lm = await codeOf(`${tag} leasehold`, "OnixsLeasehold", L.leasehold);
      let shortParams = null;
      if (lm) {
        expectImm("OnixsLeasehold", lm, "_asset", s.stock);
        expectImm("OnixsLeasehold", lm, "morpho", MORPHO);
        expectImm("OnixsLeasehold", lm, "mLoan", s.stock);
        expectImm("OnixsLeasehold", lm, "mCollateral", USDG);
        expectImm("OnixsLeasehold", lm, "mOracle", L.shortMark);
        expectImm("OnixsLeasehold", lm, "mIrm", IRM);
        shortParams = { loanToken: s.stock, collateralToken: USDG, oracle: L.shortMark, irm: IRM, lltv: BigInt("0x" + lm.immutables.mLltv) };
        const mid = marketId(shortParams);
        if ("0x" + lm.immutables.marketId === mid) ok(`${tag} leasehold.marketId = ${mid} (lltv ${Number(shortParams.lltv) / 1e16}%)`);
        else fail(`${tag} leasehold.marketId differs from keccak of its market params`);
        const args = await creationArgs(`${tag} leasehold`, "OnixsLeasehold", L.leasehold, L.block);
        if (args !== null) {
          const head = addrWord(s.stock) + addrWord(MORPHO) + addrWord(s.stock) + addrWord(USDG) + addrWord(L.shortMark) + addrWord(IRM) + lm.immutables.mLltv;
          if (args.startsWith(head)) ok(`${tag} leasehold: constructor (stock, morpho, short market) = deployed values`);
          else fail(`${tag} leasehold: constructor arguments differ from the deployed immutables`);
          try {
            const name = readString(args, BigInt("0x" + args.slice(7 * 64, 8 * 64)));
            const symbol = readString(args, BigInt("0x" + args.slice(8 * 64, 9 * 64)));
            info(`${tag} leasehold name "${name}", symbol "${symbol}"`);
          } catch {
            fail(`${tag} leasehold: constructor strings unreadable`);
          }
        }
      }

      // the charter's listing points at the same contracts
      if (isAddr(String(config.CHARTER || ""))) {
        try {
          const l = decodeListing(await call(config.CHARTER, sel("getListing(uint256)") + word(i)));
          const checks = [
            ["stock", l.stock, s.stock],
            ["feed", l.feed, s.feed],
            ["pool", l.pool, s.pool],
            ["leasehold", l.leasehold, L.leasehold],
            ["short market oracle", l.shortMarket.oracle, L.shortMark],
            ["credit market oracle", l.creditMarket.oracle, L.creditMark],
            ["credit market collateral", l.creditMarket.collateralToken, L.leasehold],
            ["credit market loan", l.creditMarket.loanToken, USDG],
          ];
          const bad = checks.filter(([, a, b]) => !same(a, b));
          if (bad.length === 0) ok(`${tag}: charter listing matches the config (stock, feed, pool, leasehold, both marks)`);
          else for (const [k, a, b] of bad) fail(`${tag}: charter listing ${k} = ${a}, expected ${b}`);
          if (shortParams && marketId(l.shortMarket) !== marketId(shortParams)) fail(`${tag}: charter short market differs from the leasehold's market`);
          for (const [k, p] of [
            ["short", l.shortMarket],
            ["credit", l.creditMarket],
          ]) {
            const mk = await call(MORPHO, sel("market(bytes32)") + marketId(p).slice(2));
            const lastUpdate = BigInt("0x" + mk.slice(2 + 4 * 64, 2 + 5 * 64));
            if (lastUpdate > 0n) ok(`${tag}: Morpho ${k} market ${marketId(p)} exists (lltv ${Number(p.lltv) / 1e16}%)`);
            else fail(`${tag}: Morpho ${k} market ${marketId(p)} does not exist`);
          }
          info(`${tag}: leverage ${l.maxLeverageBps / 100}%, short open limit ${l.shortOpenLtvBps / 100}%, slip ${l.maxSlipBps} bps, feed age ${l.maxFeedAge} s, paused ${l.paused}`);
        } catch (e) {
          fail(`${tag}: could not read the charter listing (${e instanceof Error ? e.message : e})`);
        }
      }
    }
  } catch (e) {
    fail(`unexpected error: ${e instanceof Error ? e.message : e}`);
  }
  return { ok: !failed, lines };
}
