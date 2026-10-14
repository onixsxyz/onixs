/*
 * The stock feeds follow a 24/5 schedule: they update around the clock from Sunday 8pm to Friday 8pm
 * New York time and rest over the weekend. Opens on ONIXS also refuse a feed older than the listing's
 * limit, so a stale Friday price is never used to size a new position. Closing never waits for a feed.
 */

export type Session = { open: boolean; label: string; nextChange: number };

function nyParts(t: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { day, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Whether the 24/5 feed window is open at `t` (ms), and roughly when it changes next. */
export function feedSession(t = Date.now()): Session {
  const { day, minutes } = nyParts(t);
  const at8pm = 20 * 60;
  const resting = day === 6 || (day === 5 && minutes >= at8pm) || (day === 0 && minutes < at8pm);
  // Minutes until the next change, walked forward in New York local terms.
  let mins: number;
  if (resting) {
    const toSun8 = ((7 - day) % 7) * 1440 + at8pm - minutes;
    mins = day === 0 ? at8pm - minutes : toSun8;
  } else {
    mins = ((5 - day + 7) % 7) * 1440 + at8pm - minutes;
  }
  return { open: !resting, label: resting ? "Feeds resting for the weekend" : "Feeds updating 24/5", nextChange: t + mins * 60_000 };
}

export function ageLabel(seconds: number) {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} days ago`;
}
