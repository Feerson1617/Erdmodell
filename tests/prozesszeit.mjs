import {execFileSync} from "node:child_process";
import {readFile,readdir} from "node:fs/promises";
export const hz = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }));
export async function processTicks(root) {
  const stats = new Map();
  for (const id of await readdir("/proc")) {
    if (!/^\d+$/.test(id)) continue;
    try {
      const raw = await readFile("/proc/" + id + "/stat", "utf8");
      const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
      stats.set(+id, { ppid: +fields[1], ticks: +fields[11] + +fields[12] });
    } catch {
      /* A helper may exit during enumeration. */
    }
  }
  const family = new Set([root]);
  for (const pid of family)
    for (const [id, s] of stats) if (s.ppid === pid) family.add(id);
  return new Map(
    [...family]
      .filter((id) => stats.has(id))
      .map((id) => [id, stats.get(id).ticks]),
  );
}
