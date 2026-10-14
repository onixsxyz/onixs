/*
 * ONIXS keeps no server state: no accounts, no practice ledger. Rate limits run in process memory
 * (src/lib/ratelimit.ts falls back to it when no store is given). This type exists so the shared limiter
 * keeps one signature if a store is ever added.
 */
export type Store = {
  incrByEx(key: string, by: number, ttl: number): Promise<number>;
};
