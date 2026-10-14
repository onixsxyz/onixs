import { NextResponse } from "next/server";
import { readBoard, type Board } from "@/lib/server/board";

export const dynamic = "force-dynamic";

/*
 * The board for the whole site: stock prices and feed ages, pool prices and depth, ONIXS markets once
 * deployed. One refresh at a time and at most one attempt per TTL even while reads fail, so an upstream
 * outage is not multiplied by the number of visitors.
 */

let cache: { at: number; value: Board } | null = null;
let inflight: Promise<void> | null = null;
let lastTry = 0;
const TTL = 15_000;

export async function GET() {
  if ((!cache || Date.now() - cache.at > TTL) && Date.now() - lastTry > TTL) {
    lastTry = Date.now();
    inflight ??= readBoard()
      .then((value) => {
        // A failed read does not replace a good one that is still recent.
        if (value.block !== null || !cache || Date.now() - cache.at > 120_000) cache = { at: Date.now(), value };
      })
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  if (inflight) await inflight;
  if (!cache) return NextResponse.json({ error: "Chain data is not available yet." }, { status: 503, headers: { "cache-control": "no-store" } });
  return NextResponse.json(cache.value, { headers: { "cache-control": "no-store" } });
}
