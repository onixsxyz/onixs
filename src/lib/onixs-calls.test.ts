import { test } from "node:test";
import assert from "node:assert/strict";
import artifacts from "./onchain/artifacts.json" with { type: "json" };
import { SIG } from "./onixs/calls";
import { EVENTS } from "./onixs/events";
import { topic } from "./calls";

type Item = { type: string; name?: string; inputs?: { type: string; components?: Item["inputs"] }[] };
const typeOf = (i: { type: string; components?: Item["inputs"] }): string => (i.type.startsWith("tuple") ? `(${(i.components ?? []).map(typeOf).join(",")})${i.type.slice(5)}` : i.type);
const sigs = new Set<string>();
const events = new Set<string>();
for (const c of Object.values((artifacts as unknown as { contracts: Record<string, { abi: Item[] }> }).contracts))
  for (const it of c.abi) {
    const s = `${it.name}(${(it.inputs ?? []).map(typeOf).join(",")})`;
    if (it.type === "function") sigs.add(s);
    if (it.type === "event") events.add(topic(s));
  }

test("every ONIXS call the site encodes exists in the compiled ABI", () => {
  for (const [k, s] of Object.entries(SIG)) assert.ok(sigs.has(s), `${k}: ${s}`);
});

test("every event topic the site reads exists in the compiled ABI", () => {
  for (const [k, t] of Object.entries(EVENTS)) assert.ok(events.has(t), k);
});
