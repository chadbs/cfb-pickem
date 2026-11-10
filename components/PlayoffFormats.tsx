"use client";

import { useState } from "react";

/**
 * A what-if page: two hypothetical playoff formats, seeded from the first 2026
 * CFP committee rankings (Nov. 3). Nothing here touches the database — picks
 * live in component state and reset on reload.
 */

const TEAMS: Record<number, [string, string]> = {
  1: ["Miami", "8-0"], 2: ["Georgia", "7-1"], 3: ["Utah", "8-0"], 4: ["Indiana", "8-1"],
  5: ["Alabama", "6-2"], 6: ["Kentucky", "7-1"], 7: ["Texas", "6-2"], 8: ["UCLA", "8-0"],
  9: ["BYU", "7-1"], 10: ["Ole Miss", "6-2"], 11: ["Notre Dame", "7-1"], 12: ["Ohio State", "6-2"],
  13: ["Tennessee", "6-2"], 14: ["LSU", "6-2"], 15: ["Texas Tech", "7-1"], 16: ["Wake Forest", "7-1"],
  17: ["Houston", "6-2"], 18: ["Missouri", "6-2"], 19: ["Iowa", "6-2"], 20: ["USC", "7-2"],
  21: ["South Carolina", "5-3"], 22: ["Arizona", "6-2"], 23: ["Oregon", "5-3"], 24: ["Florida", "5-3"],
};

type Slot = { s: number } | { g: string };
type Game = { c: number; a: Slot; b: Slot; ya: number; yb: number };
type Format = {
  key: "16" | "24";
  games: Record<string, Game>;
  order: string[];
  final: string;
  height: number;
  swap: number;
  labels: string[];
  wins: (seed: number) => number;
  how: string[];
  stats: [string, string][];
  legend: [string, string][];
};

const SW = 128;
const CW = 154;
const CHAMP = "var(--win)";
const BYE = "var(--brand)";

function g(c: number, a: Slot, b: Slot): Game {
  return { c, a, b, ya: 0, yb: 0 };
}
const mid = (G: Record<string, Game>, id: string) => (G[id].ya + G[id].yb) / 2;
const ref = (s: Slot) => ("g" in s ? s.g : null);

function build16(): Format {
  const G: Record<string, Game> = {
    A: g(0, { s: 9 }, { s: 16 }), B: g(0, { s: 10 }, { s: 15 }),
    C: g(0, { s: 11 }, { s: 14 }), D: g(0, { s: 12 }, { s: 13 }),
    E: g(1, { s: 8 }, { g: "A" }), F: g(1, { s: 7 }, { g: "B" }),
    G: g(1, { s: 6 }, { g: "C" }), H: g(1, { s: 5 }, { g: "D" }),
    I: g(2, { s: 1 }, { g: "E" }), L: g(2, { s: 4 }, { g: "H" }),
    J: g(2, { s: 2 }, { g: "F" }), K: g(2, { s: 3 }, { g: "G" }),
    M: g(3, { g: "I" }, { g: "L" }), N: g(3, { g: "J" }, { g: "K" }),
    O: g(4, { g: "M" }, { g: "N" }),
  };
  const OFF = 34;
  [["I", "E", "A"], ["L", "H", "D"], ["J", "F", "B"], ["K", "G", "C"]].forEach(([q, r2, r1], k) => {
    const y = OFF + k * 122;
    G[r1].ya = y + 70; G[r1].yb = y + 100;
    G[r2].ya = y + 40; G[r2].yb = y + 85;
    G[q].ya = y + 10; G[q].yb = y + 62.5;
  });
  for (const id of ["M", "N", "O"]) {
    G[id].ya = mid(G, ref(G[id].a)!);
    G[id].yb = mid(G, ref(G[id].b)!);
  }
  return {
    key: "16", games: G, order: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "L", "J", "K", "M", "N", "O"],
    final: "O", height: OFF + 4 * 122, swap: 16,
    labels: ["Round 1", "Round 2", "Quarterfinals", "Semifinals", "Final", "Champion"],
    wins: (s) => (s <= 4 ? 3 : s <= 8 ? 4 : 5),
    how: [
      "4 conference champions go straight to the quarterfinals (seeds 1–4).",
      "The next 4 ranked teams get a first-round bye (seeds 5–8).",
      "Seeds 9–16 play round 1. Winners face the bye teams in round 2, and those winners face the champions.",
      "Math: 4 champs + 4 byes + 8 round 1 teams = 16, and every round splits evenly.",
    ],
    stats: [["Teams", "16"], ["Total games", "15"], ["Games to win it", "3 / 4 / 5"], ["Champs enter", "Quarterfinals"]],
    legend: [[CHAMP, "Conference champ, to quarterfinals"], [BYE, "Bye, to round 2"]],
  };
}

function build24(): Format {
  const G: Record<string, Game> = {};
  for (let k = 1; k <= 8; k++) G["r" + k] = g(0, { s: 17 - k }, { s: 16 + k });
  for (let k = 1; k <= 8; k++) G["b" + k] = g(1, { s: k }, { g: "r" + k });
  G.q1 = g(2, { g: "b1" }, { g: "b8" }); G.q2 = g(2, { g: "b4" }, { g: "b5" });
  G.q3 = g(2, { g: "b2" }, { g: "b7" }); G.q4 = g(2, { g: "b3" }, { g: "b6" });
  G.s1 = g(3, { g: "q1" }, { g: "q2" }); G.s2 = g(3, { g: "q3" }, { g: "q4" });
  G.f = g(4, { g: "s1" }, { g: "s2" });
  const order: string[] = [];
  for (let k = 1; k <= 8; k++) order.push("r" + k);
  for (let k = 1; k <= 8; k++) order.push("b" + k);
  order.push("q1", "q2", "q3", "q4", "s1", "s2", "f");
  const OFF = 34;
  [1, 8, 4, 5, 2, 7, 3, 6].forEach((s, i) => {
    const y = OFF + i * 76;
    G["b" + s].ya = y + 10; G["b" + s].yb = y + 46;
    G["r" + s].ya = y + 34; G["r" + s].yb = y + 58;
  });
  for (const id of ["q1", "q2", "q3", "q4", "s1", "s2", "f"]) {
    G[id].ya = mid(G, ref(G[id].a)!);
    G[id].yb = mid(G, ref(G[id].b)!);
  }
  return {
    key: "24", games: G, order, final: "f", height: OFF + 8 * 76, swap: 24,
    labels: ["Round 1", "Round of 16", "Quarterfinals", "Semifinals", "Final", "Champion"],
    wins: (s) => (s <= 8 ? 4 : 5),
    how: [
      "4 conference champions (seeds 1–4) and the 4 top-ranked other teams (seeds 5–8) all get a bye into the round of 16.",
      "Seeds 9–24 play round 1: 9 vs 24, 10 vs 23, down to 16 vs 17.",
      "The 1 seed gets the 16/17 winner, the 8 seed gets the 9/24 winner, and so on.",
      "Math: 8 byes + 16 round 1 teams = 24. If all 8 byes went straight to the quarterfinals, there'd be no spots left for anyone else.",
    ],
    stats: [["Teams", "24"], ["Total games", "23"], ["Games to win it", "4 / 5"], ["Champs enter", "Round of 16"]],
    legend: [[CHAMP, "Conference champ bye"], [BYE, "At-large bye"]],
  };
}

const FORMATS = { "16": build16(), "24": build24() };

export function PlayoffFormats() {
  const [key, setKey] = useState<"16" | "24">("16");
  const [winners, setWinners] = useState<Record<string, number>>({});
  const [g6, setG6] = useState(false);
  const f = FORMATS[key];

  const name = (s: number) => (s === f.swap && g6 ? "Boise State" : TEAMS[s][0]);
  const rec = (s: number) => (s === f.swap && g6 ? "7-1" : TEAMS[s][1]);

  const resolve = (w: Record<string, number>, slot: Slot) => ("s" in slot ? slot.s : w[slot.g]);

  /** Drops any pick whose team no longer reaches that game. Order is topological. */
  const clean = (w: Record<string, number>) => {
    const next = { ...w };
    for (const id of f.order) {
      const gm = f.games[id];
      if (next[id] && ![resolve(next, gm.a), resolve(next, gm.b)].includes(next[id])) delete next[id];
    }
    return next;
  };

  const fill = (pick: (a: number, b: number) => number) => {
    const w: Record<string, number> = {};
    for (const id of f.order) {
      const gm = f.games[id];
      w[id] = pick(resolve(w, gm.a), resolve(w, gm.b));
    }
    setWinners(w);
  };

  const switchTo = (k: "16" | "24") => {
    setKey(k);
    setWinners({});
  };

  const champ = winners[f.final];
  const width = 5 * CW + SW + 4;

  const svg = (() => {
    const out: React.ReactNode[] = [];
    const slot = (x: number, y: number, s: number | undefined, gid: string, state: "" | "w" | "l", ready: boolean, k: string) => {
      const tc = state === "l" ? "var(--ink-faint)" : "var(--ink)";
      out.push(
        <g
          key={k}
          onClick={ready && s ? () => setWinners((w) => clean({ ...w, [gid]: s })) : undefined}
          style={{ cursor: ready && s ? "pointer" : "default" }}
        >
          <rect
            x={x} y={y - 11} width={SW} height={22} rx={5}
            fill={state === "w" ? "color-mix(in srgb, var(--brand) 26%, var(--card-bg))" : "var(--bg-elev)"}
            stroke={state === "w" ? "var(--brand)" : "var(--line-strong)"}
          />
          {s ? (
            <>
              {s <= 8 && <rect x={x} y={y - 11} width={4} height={22} rx={1} fill={s <= 4 ? CHAMP : BYE} />}
              <text x={x + 11} y={y + 4} fontSize={11} fill="var(--ink-faint)">{s}</text>
              <text x={x + 30} y={y + 4} fontSize={12} fill={tc} fontWeight={state === "w" ? 600 : 400}>{name(s)}</text>
              <text x={x + SW - 6} y={y + 4} fontSize={10} fill="var(--ink-faint)" textAnchor="end">{rec(s)}</text>
            </>
          ) : null}
        </g>,
      );
    };
    f.labels.forEach((t, i) =>
      out.push(<text key={"l" + i} x={i * CW} y={16} fontSize={12} fill="var(--ink-dim)">{t}</text>),
    );
    for (const id of f.order) {
      const gm = f.games[id];
      const x = gm.c * CW;
      const a = resolve(winners, gm.a);
      const b = resolve(winners, gm.b);
      const w = winners[id];
      const m = mid(f.games, id);
      const ready = Boolean(a && b);
      out.push(
        <path
          key={"p" + id}
          d={`M${x + SW} ${gm.ya}H${x + SW + 12}V${gm.yb}H${x + SW}M${x + SW + 12} ${m}H${x + CW}`}
          fill="none" stroke="var(--line-strong)"
        />,
      );
      slot(x, gm.ya, a, id, w ? (w === a ? "w" : "l") : "", ready, id + "a");
      slot(x, gm.yb, b, id, w ? (w === b ? "w" : "l") : "", ready, id + "b");
    }
    slot(5 * CW, mid(f.games, f.final), champ, "Z", champ ? "w" : "", false, "champ");
    return out;
  })();

  const btn =
    "rounded-[var(--r-ctl)] border border-[var(--line-strong)] bg-[var(--bg-elev)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--card-bg-hover)] active:scale-[0.98]";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em]">What if the playoff looked like this?</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-dim)]">
          Two formats where conference champions get rewarded, seeded from the first 2026 CFP rankings
          (Nov. 3). Champs are guesses: the top-ranked team in each Power 4 league.
        </p>
      </div>

      <div className="inline-flex w-fit rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)] p-[3px]">
        {(["16", "24"] as const).map((k) => (
          <button
            key={k}
            onClick={() => switchTo(k)}
            className={`rounded-[7px] px-4 py-1.5 text-[13px] font-medium transition-colors ${
              key === k ? "bg-white/[0.09] text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            {k} teams
          </button>
        ))}
      </div>

      <div className="card px-4 py-3">
        <p className="text-[13px] font-semibold">How it works</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--ink-dim)]">
          {f.how.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {f.stats.map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2.5">
            <div className="text-[11.5px] text-[var(--ink-faint)]">{k}</div>
            <div className="nums text-[17px] font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => fill((a, b) => (Math.random() < b / (a + b) ? a : b))}>Simulate</button>
        <button className={btn} onClick={() => fill((a, b) => Math.min(a, b))}>Favorites win</button>
        <button className={btn} onClick={() => setWinners({})}>Reset</button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-dim)]">
        {f.legend.map(([c, t]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
            {t}
          </span>
        ))}
        <span className="text-[var(--ink-faint)]">Tap a team to advance it · swipe sideways on a phone</span>
      </div>

      <div className="card overflow-x-auto p-3">
        <svg width={width} height={f.height} style={{ display: "block", fontFamily: "inherit" }}>{svg}</svg>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-[var(--ink-dim)]">
        <input type="checkbox" checked={g6} onChange={(e) => setG6(e.target.checked)} />
        Guarantee a Group of 6 spot (Boise State in for {TEAMS[f.swap][0]})
      </label>

      {champ ? (
        <div className="card px-4 py-3 text-[14px]">
          National champion: <strong>{name(champ)}</strong>{" "}
          <span className="text-[var(--ink-dim)]">(seed {champ}, won {f.wins(champ)} playoff games)</span>
        </div>
      ) : null}

      <p className="text-[11.5px] text-[var(--ink-faint)]">
        Simulate weights each game by seed (a 1 seed beats a 16 seed about 94% of the time). Rankings from the{" "}
        <a className="underline hover:text-[var(--ink-dim)]" href="https://www.ncaa.com/news/football/article/2026-11-03/miami-georgia-lead-first-college-football-playoff-rankings-2026">
          CFP committee, Nov. 3, 2026
        </a>
        .
      </p>
    </div>
  );
}
