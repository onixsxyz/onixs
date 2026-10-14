/*
 * Browser storage keys. Deliberately neutral (not the brand name), so renaming the project never
 * orphans what visitors' browsers already hold.
 */
const PREFIX = "x4";
export const storageKey = (...parts: string[]) => [PREFIX, ...parts].join(".");
