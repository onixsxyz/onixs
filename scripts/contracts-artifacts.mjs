// Collects the compiled ONIXS contracts into one generated file used by the /deploy page and by
// scripts/verify-deployment.mjs:
//   src/lib/onchain/artifacts.json  (abi, creation + runtime bytecode, named immutable ranges)
// Run after a forge build:
//   (cd contracts && ./setup.sh && forge build --force) && node scripts/contracts-artifacts.mjs
// Fork tests need `--evm-version cancun`, which rewrites out/: always rebuild before running this script.
// With --check it only compares the committed file against a fresh forge build.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = new URL("../contracts/out/", import.meta.url);
const TARGET = new URL("../src/lib/onchain/artifacts.json", import.meta.url);
// Deployment order. Per stock: short mark, then its leasehold (creates the short market), then the credit mark.
// The charter deploys the OnixsBerth implementation itself; OnixsBerth is listed so its code can be checked.
const NAMES = [
  ["OnixsCharter", "OnixsCharter.sol"],
  ["OnixsMark", "OnixsMark.sol"],
  ["OnixsLeasehold", "OnixsLeasehold.sol"],
  ["OnixsBerth", "OnixsBerth.sol"],
];

/** Immutable byte ranges with the name of the variable they hold (from the AST). */
function namedImmutables(a) {
  const refs = a.deployedBytecode.immutableReferences ?? {};
  const names = {};
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.nodeType === "VariableDeclaration" && refs[String(n.id)]) names[n.id] = n.name;
    for (const v of Object.values(n)) walk(v);
  };
  walk(a.ast);
  return Object.entries(refs).flatMap(([id, list]) => {
    if (!names[id]) throw new Error(`no name for immutable ${id} (build with ast = true)`);
    return list.map((r) => ({ name: names[id], start: r.start, length: r.length }));
  });
}

// OpenZeppelin's ERC4626 and the leasehold both live in other source units; the AST of the artifact only covers
// its own file, so immutables declared in parents are resolved from the parent artifacts.
function parentAsts(name) {
  if (name !== "OnixsLeasehold") return [];
  return [JSON.parse(readFileSync(new URL("ERC4626.sol/ERC4626.json", OUT), "utf8")).ast];
}

const contracts = {};
for (const [name, file] of NAMES) {
  const a = JSON.parse(readFileSync(new URL(`${file}/${name}.json`, OUT), "utf8"));
  const creation = a.bytecode.object.toLowerCase();
  const runtime = a.deployedBytecode.object.toLowerCase();
  if (!creation.startsWith("0x") || creation.length < 10) throw new Error(`${name}: no bytecode (build first)`);
  // `forge test --evm-version cancun` (needed for fork tests) rewrites out/; deployable bytecode must be paris.
  const evm = a.metadata?.settings?.evmVersion;
  if (evm !== "paris") throw new Error(`${name} in out/ was built for ${evm}; run (cd contracts && forge build --force) first`);
  const asts = [a.ast, ...parentAsts(name)];
  const immutables = namedImmutables({ ...a, ast: asts });
  contracts[name] = {
    abi: a.abi,
    bytecode: creation,
    runtime,
    immutables,
    sha256: createHash("sha256").update(creation).digest("hex"),
  };
}

const out = {
  generatedBy: "scripts/contracts-artifacts.mjs",
  compiler: "solc 0.8.28, optimizer 200 runs, evm paris, no via-ir, no metadata hash",
  deployOrder: [
    "OnixsCharter(owner, morpho, usdg, swapFactory) — also deploys the OnixsBerth implementation",
    "per stock: OnixsMark(stockFeed, stock, usdgFeed, usdg, 0x0) — short mark",
    "per stock: OnixsLeasehold(stock, morpho, shortMarket, name, symbol) — creates the short market",
    "per stock: OnixsMark(stockFeed, stock, usdgFeed, usdg, leasehold) — credit mark",
    "per stock: OnixsCharter.list(listing) from the owner — creates the credit market",
  ],
  constructorArgs: {
    OnixsCharter: ["address owner", "address morpho", "address usdg", "address swapFactory"],
    OnixsMark: ["address stockFeed", "address stock", "address usdgFeed", "address usdg", "address leasehold"],
    OnixsLeasehold: ["address stock", "address morpho", "(address,address,address,address,uint256) shortMarket", "string name", "string symbol"],
    OnixsBerth: ["address morpho", "address usdg"],
  },
  contracts,
};
const text = JSON.stringify(out) + "\n";
if (process.argv.includes("--check")) {
  let same = false;
  try {
    same = readFileSync(TARGET, "utf8") === text;
  } catch {
    // missing file: not the same
  }
  console.log(same ? "artifacts.json matches this forge build" : "artifacts.json DIFFERS from this forge build");
  process.exit(same ? 0 : 1);
}
writeFileSync(TARGET, text);
for (const [n, c] of Object.entries(contracts)) {
  console.log(`${n}: ${(c.bytecode.length - 2) / 2} bytes creation, ${(c.runtime.length - 2) / 2} runtime, immutables ${[...new Set(c.immutables.map((i) => i.name))].join(",")}`);
}
