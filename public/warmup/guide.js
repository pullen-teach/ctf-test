// The Warm-ups module guide: two untimed warm-ups (Orientation and Speed
// drills). Same engine as the CTF games; generated block below, then the
// shared engine body. Edit gen-warmup.py, not this file.
(function () {
  "use strict";

  const MISSIONS = [
  {
    "title": "Orientation",
    "level": "Warm-up",
    "points": 50,
    "hintCost": 0,
    "objective": "Read the CTF orientation in the terminal with cat, then submit your first flag.",
    "run": [
      "cat orientation.txt"
    ],
    "ref": [
      [
        "cat FILE",
        "print a file on the screen"
      ],
      [
        "submit CYBA{...}",
        "check a flag"
      ],
      [
        "clear",
        "clear the screen (or Ctrl+L)"
      ]
    ],
    "notes": [
      "Welcome. This module gets you comfortable before you start a real CTF. Your <b>home folder</b> holds <code>orientation.txt</code>: what a CTF is, what a flag looks like, how scoring works and the rules.",
      "<code>cat</code> prints a file on the screen. Click the terminal, type <code>cat orientation.txt</code> and press Enter. The warm-up flag is on the last line.",
      "A flag looks like <code>CYBA{word-1a2b3c4d}</code>. Submit it with <code>submit</code>, a space, then the whole flag, for <b>50 points</b>. These warm-ups are untimed, so there is no rush."
    ],
    "hints": [
      "The flag is on the last line of <code>orientation.txt</code> in your home folder. Type <code>cat orientation.txt</code>, press Enter, then copy the flag into <code>submit</code>."
    ]
  },
  {
    "title": "Speed drills",
    "level": "Warm-up",
    "points": 50,
    "hintCost": 0,
    "objective": "Practise the keys that make you fast: Tab, the up arrow, Ctrl+C, and Linux-style copy and paste.",
    "run": [
      "cd ~/speed",
      "cat README.txt"
    ],
    "ref": [
      [
        "Tab",
        "finish a file or command name for you"
      ],
      [
        "up arrow",
        "bring back your last command"
      ],
      [
        "Ctrl+C",
        "stop a running command"
      ],
      [
        "select, then middle-click",
        "copy and paste, the Linux way (right-click also pastes)"
      ],
      [
        "history",
        "list the commands you have typed"
      ],
      [
        "clear",
        "clear the screen (or Ctrl+L)"
      ]
    ],
    "notes": [
      "Four drills, four pieces of the flag. Each drill needs one terminal skill, and each piece is 4 characters.",
      "<b>Drill 1, Tab:</b> <code>cd tab</code>, type <code>cat dri</code> and press <b>Tab</b>. The long file name finishes itself.",
      "<b>Drill 2, up arrow:</b> run <code>again</code> 5 times within 15 seconds. After the first one, press <b>up arrow</b> then Enter.",
      "<b>Drill 3, Ctrl+C:</b> run <code>runaway</code>. It never stops by itself. Hold <b>Ctrl</b> and press <b>C</b>.",
      "<b>Drill 4, copy and paste:</b> <code>cd ~/speed/paste</code>, then <code>cat code.txt</code>. <b>Highlight</b> the long code with the mouse or trackpad (that copies it), type <code>pasteit </code> and a space, then <b>middle-click</b> to paste it (<b>right-click</b> also pastes) and press Enter. No Ctrl+C or Ctrl+V needed: in a Linux terminal, selecting is copying and the middle button pastes.",
      "Put the pieces together in order: <code>submit CYBA{speed-PIECE1PIECE2PIECE3PIECE4}</code>. Paste each piece the same way: highlight it, then middle-click (or right-click)."
    ],
    "hints": [
      "Drill 1: in ~/speed/tab type <code>cat dri</code>, then press Tab. Drill 2: type <code>again</code> and Enter, then press the up arrow and Enter four more times, quickly. Drill 3: type <code>runaway</code>, then hold Ctrl and press C. Drill 4: in ~/speed/paste run <code>cat code.txt</code>, highlight the CODE with the mouse, type <code>pasteit </code> then middle-click (or right-click) to paste it. The flag is <code>CYBA{speed-</code> followed by the four pieces in order, then <code>}</code>."
    ]
  }
];
  const LEARNED = ["Read files with <code>cat</code> and submitted your first flag with <code>submit</code>.", "Learned what a CTF is, what a flag looks like, and how scoring works.", "Built terminal speed: <code>Tab</code> completion, the up arrow for history, <code>Ctrl+C</code> to stop a command.", "Copied and pasted the Linux way: select to copy, middle-click (or right-click) to paste."];
  const N = MISSIONS.length;
  const CFG = window.QUEST_CONFIG || {};
  const UNIT = CFG.unit || "Mission";          // "Mission" for a CTF, "Warm-up" for the Warm-ups module
  const UNITS = UNIT.toLowerCase();
  const UNTIMED = !!CFG.untimed;               // the Warm-ups module has no competition clock
  const GAME = CFG.game || "CTF";
  const BOARD_KEY = CFG.board || "cq-ctf-runs";
  const el = (id) => document.getElementById(id);
  const done = new Set();
  // Hints cost 5% of the mission's points, charged once per mission (0 = free), from the panel or the terminal.
  const hintsUsed = {};   // mission number -> how many of its hints have been bought
  const hintCost = (n) => (hintsUsed[n] || 0) * MISSIONS[n - 1].hintCost;
  const hintTotal = () => Object.keys(hintsUsed).reduce((t, n) => t + hintCost(Number(n)), 0);
  // Clock time (ms) of each capture. "Took" is the time since the capture before it.
  const capturedAt = {};
  const fmt = (ms) => (window.questClock ? window.questClock.fmt(ms) : "");
  const clockAt = (n) => (n in capturedAt ? fmt(capturedAt[n]) : "");
  const took = (n) => {
    if (!(n in capturedAt)) return "";
    const before = Object.values(capturedAt).filter((t) => t < capturedAt[n]);
    return fmt(capturedAt[n] - (before.length ? Math.max(...before) : 0));
  };
  const MAX = MISSIONS.reduce((t, m) => t + m.points, 0);
  const score = () => [...done].reduce((t, n) => t + MISSIONS[n - 1].points, 0) - hintTotal();
  const scoreEl = el("score"), scorePts = el("score-pts");
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TROPHY = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd54a"/><stop offset="1" stop-color="#f5a300"/></linearGradient></defs><path fill="url(#g)" d="M17 5h30v5h11v8c0 8-6 14-14 15a15 15 0 0 1-9 8.6V48h9v6H20v-6h9v-6.4A15 15 0 0 1 20 33C12 32 6 26 6 18v-8h11zm-5 11v2c0 4 2.5 7.5 6.5 8.6A30 30 0 0 1 17 16zm40 0h-5a30 30 0 0 1-1.5 10.6C54.5 25.5 52 22 52 18z"/><rect x="18" y="54" width="28" height="5" rx="1.5" fill="#d98a00"/><path fill="#fff6c9" d="M32 12l3 6.1 6.7 1-4.9 4.7 1.2 6.7L32 27.3l-6 3.2 1.2-6.7-4.9-4.7 6.7-1z"/></svg>';
  const ICON = {"chart": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"13\" width=\"4.5\" height=\"8\" rx=\"1\" fill=\"#2459d8\"/><rect x=\"9.75\" y=\"8\" width=\"4.5\" height=\"13\" rx=\"1\" fill=\"#2459d8\"/><rect x=\"16.5\" y=\"3\" width=\"4.5\" height=\"18\" rx=\"1\" fill=\"#2a9fd6\"/></svg>", "bulb": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"#f5b301\" d=\"M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z\"/><rect x=\"9\" y=\"19\" width=\"6\" height=\"2.6\" rx=\"1.2\" fill=\"#c98a00\"/></svg>", "replay": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 12a8 8 0 1 1-2.34-5.66\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path d=\"M20 4v5h-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "cup": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M7 3h10v5a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6\"/></svg>", "target": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"none\" stroke=\"#d1416b\" stroke-width=\"2.2\"/><circle cx=\"12\" cy=\"12\" r=\"5.5\" fill=\"none\" stroke=\"#d1416b\" stroke-width=\"2.2\"/><circle cx=\"12\" cy=\"12\" r=\"1.9\" fill=\"#d1416b\"/></svg>", "term": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"2\" y=\"3.5\" width=\"20\" height=\"17\" rx=\"3\" fill=\"#7448d4\"/><path d=\"M6.5 9l3.2 3-3.2 3\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"11.5\" y=\"14.2\" width=\"6\" height=\"1.9\" rx=\".9\" fill=\"#fff\"/></svg>", "book": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"#2459d8\" d=\"M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z\"/><path fill=\"#9db7f0\" d=\"M6.5 18H20v4H6.5a2 2 0 0 1 0-4z\"/><rect x=\"8\" y=\"6\" width=\"8\" height=\"1.8\" rx=\".9\" fill=\"#fff\"/></svg>", "info": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#2a9fd6\"/><rect x=\"10.8\" y=\"10.2\" width=\"2.4\" height=\"7\" rx=\"1.2\" fill=\"#fff\"/><circle cx=\"12\" cy=\"7.1\" r=\"1.45\" fill=\"#fff\"/></svg>", "pts": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"#f5b301\"/><circle cx=\"12\" cy=\"12\" r=\"6.6\" fill=\"none\" stroke=\"#fff3c4\" stroke-width=\"1.6\"/><path fill=\"#fff\" d=\"M12 7.6l1.35 2.75 3.03.44-2.19 2.14.52 3.02L12 14.5l-2.71 1.45.52-3.02-2.19-2.14 3.03-.44z\"/></svg>", "copy": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"8.5\" y=\"8.5\" width=\"12\" height=\"12\" rx=\"2.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M15.5 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>", "play": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10.5-6.5z\" fill=\"currentColor\"/></svg>", "flag": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 21V4\" stroke=\"#17875a\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><path d=\"M6 4.5h11.5l-2.5 4 2.5 4H6z\" fill=\"#17875a\"/></svg>"};
  function showScore(bump) {
    if (!scorePts) return;
    scorePts.textContent = score();
    if (bump) { scoreEl.classList.remove("bump"); void scoreEl.offsetWidth; scoreEl.classList.add("bump"); }
    const fc = el("flags-count"), fs = el("flags-stat"), fl = el("flags-label");
    const noun = UNTIMED ? "" : " flags";
    if (fc) fc.innerHTML = done.size === N ? "All " + N + noun : done.size + '<span class="of"> / ' + N + "</span>";
    if (fl) fl.textContent = done.size === N ? (UNTIMED ? "Done!" : "Captured!") : (UNTIMED ? "Completed" : "Flags Captured");
    if (fs) fs.classList.toggle("all", done.size === N);
  }
  // The stepper: a check in a green circle for each captured step, a ring for the current one.
  function paintSteps(cur) {
    const r = reachable();
    dots.querySelectorAll(".step-btn").forEach((d, i) => {
      const ok = done.has(i + 1);
      d.className = "step-btn" + (ok ? " ok" : "") + (i === cur ? " here" : "");
      d.querySelector(".step-dot").innerHTML = ok ? CHECK : String(i + 1);
      d.disabled = !(i <= r || done.size === N);
      d.setAttribute("aria-current", i === cur ? "step" : "false");
    });
    dots.querySelectorAll(".step-bar").forEach((b, i) => b.classList.toggle("ok", done.has(i + 1) && done.has(i + 2)));
  }
  let current = 0;
  let runner = null;

  const article = el("mission");
  const count = el("m-count");
  const prev = el("prev");
  const next = el("next");
  const state = el("m-state");
  const dots = el("m-dots");
  const body = document.querySelector(".guide-body");

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // Steps you can open: every captured one, plus the first one not yet captured.
  const reachable = () => { let i = 0; while (i < N - 1 && done.has(i + 1)) i++; return i; };

  const lvlClass = (l) => l.toLowerCase().replace(/\s+/g, "-");
  const head = (ico, title, sub) => '<div class="c-head"><span class="c-ico">' + ICON[ico] + '</span><div><h3>' + title + "</h3>" + (sub ? "<p>" + sub + "</p>" : "") + "</div></div>";
  // Copy without starting the clock; falls back to a hidden textarea where the clipboard API is blocked.
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => fallback(t));
    return fallback(t);
  }
  function fallback(t) {
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
    return Promise.resolve();
  }

  // The hint box: hints bought so far, then the price of the next one (free when hintCost is 0).
  function hintHtml(m, n) {
    const free = !m.hintCost;
    const have = hintsUsed[n] || 0, total = m.hints.length;
    const label = free ? 'Need a hint? <span class="hint-cost free">free</span>'
      : have ? "Hints " + have + " of " + total + ' <span class="hint-cost">−' + have * m.hintCost + " pts</span>"
      : "Need a hint? " + '<span class="hint-cost">' + total + (total > 1 ? " hints, " : " hint, ") + "−" + m.hintCost + " pts each</span>";
    let body = m.hints.slice(0, have).map((h, k) => '<div class="hint-step">' + (total > 1 ? "<b>Hint " + (k + 1) + ".</b> " : "") + h + "</div>").join("");
    if (have < total)
      body += "<p>" + (have ? "Want more direction? " : "") + "Hint " + (have + 1) + (free ? " is free." : " costs <b>" + m.hintCost + " points</b>: 5% of this " + UNITS + "'s " + m.points +
        ". Each hint is charged once,") + (free ? " Reveal it here, or type " : " here or with ") + "<code>hint " + n + (free ? "" : " --show") + "</code> in the terminal.</p>" +
        '<button type="button" class="btn hint-buy">Show hint ' + (have + 1) + " of " + total + (free ? "" : " (−" + m.hintCost + " pts)") + "</button>";
    return '<details class="hint fold"' + (have ? " open" : "") + '><summary><span class="c-ico">' + ICON.bulb + "</span>" + label +
      '<span class="chev" aria-hidden="true"></span></summary><div>' + body + "</div></details>";
  }

  function render() {
    const m = MISSIONS[current];
    const n = current + 1;
    const ok = done.has(n);
    count.textContent = UNIT + " " + n + " of " + N + (UNTIMED ? " · optional" : "");
    const rows = m.run.map((c) =>
      '<div class="cmd-row"><code class="cmd"><span class="run-prompt" aria-hidden="true">$</span>' + esc(c) + "</code>" +
      '<button class="mini copy" type="button" data-cmd="' + esc(c) + '" aria-label="Copy ' + esc(c) + '">' + ICON.copy + "<span>Copy</span></button></div>").join("");
    const ref = m.ref.concat([["submit CYBA{...}", "check your flag"], ["hint " + n, m.hintCost ? "a nudge (costs 5%)" : "a free nudge"]]);
    article.innerHTML =
      '<div class="title-row"><h2>' + m.title + '</h2><span class="level ' + lvlClass(m.level) + '">' + m.level + '</span>' +
        '<span class="pts-pill">' + ICON.pts + m.points + " pts</span>" +
        (UNTIMED ? '<span class="untimed">Untimed</span>' : "") + "</div>" +
      '<div class="objective"><span class="c-ico">' + ICON.target + "</span><p><b>Objective</b>" + esc(m.objective) + "</p></div>" +
      '<section class="card start">' + head("term", "Start Here", "Type these commands in the terminal to begin.") + '<div class="cmd-rows">' + rows + "</div></section>" +
      '<section class="card ref">' + head("book", "Quick Reference", "Common commands you'll use here.") +
        '<table class="ref-table"><tr><th>Command</th><th>What it does</th></tr>' + ref.map(([c, d]) => "<tr><td><code>" + esc(c) + "</code></td><td>" + esc(d) + "</td></tr>").join("") + "</table></section>" +
      '<section class="card notes">' + head("info", UNIT + " Notes") + m.notes.map((p) => "<p>" + p + "</p>").join("") + "</section>" +
      (ok
        ? '<section class="card captured">' + '<span class="c-ico big">' + TROPHY + '</span><div><h3>Flag Captured <span class="pts">+' + m.points + " points</span></h3>" +
          (UNTIMED ? "<p>Nice work. Open the next one, or jump into a CTF when you're ready.</p></div></section>"
            : "<p>This flag took <b class=\"captured-at\">" + took(n) + "</b>; the clock read <b class=\"captured-at\">" + clockAt(n) + "</b> when you submitted it.</p></div></section>")
        : '<section class="card submit-card">' + head("flag", "Found the flag?", "Worth " + m.points + " points. Type <code>submit</code>, a space, then paste the whole flag:") +
          "<pre>submit CYBA{word-1a2b3c4d}</pre></section>") +
hintHtml(m, n);
    const buy = article.querySelector(".hint-buy");
    if (buy) buy.addEventListener("click", () => window.questGuide.hintUsed(n, (hintsUsed[n] || 0) + 1));
    article.querySelectorAll(".copy").forEach((b) => b.addEventListener("click", () => {
      copyText(b.dataset.cmd).then(() => {
        b.classList.add("copied"); b.querySelector("span").textContent = "Copied";
        setTimeout(() => { b.classList.remove("copied"); b.querySelector("span").textContent = "Copy"; }, 1400);
      }, () => {});
    }));
    state.textContent = ok ? "Flag captured. Next " + UNITS + " unlocked." : "Capture this flag to unlock the next " + UNITS + ".";
    state.className = ok ? "m-state ok" : "m-state";
    prev.disabled = current === 0;
    next.disabled = !ok;
    next.innerHTML = current === N - 1 ? "Finish &rarr;" : "Next " + UNITS + " &rarr;";
    paintSteps(current);
    body.scrollTop = 0;
  }

  // ---- leaderboard: finished runs saved in this browser (best score, then fastest) ----
  const loadRuns = () => { try { return JSON.parse(localStorage.getItem(BOARD_KEY) || "[]"); } catch (e) { return []; } };
  let thisRun = null;
  function saveRun() {
    if (thisRun) return;
    thisRun = { score: score(), ms: window.questClock ? window.questClock.elapsed() : 0, when: Date.now() };
    try { localStorage.setItem(BOARD_KEY, JSON.stringify(loadRuns().concat([thisRun]).slice(-50))); } catch (e) { /* storage blocked: the board just shows this run */ }
  }
  function boardHtml() {
    let runs = loadRuns();
    if (thisRun && !runs.some((r) => r.when === thisRun.when)) runs.push(thisRun);
    runs.sort((x, y) => y.score - x.score || x.ms - y.ms);
    const timeCol = UNTIMED ? "" : '<td class="num">Time</td>';
    const rows = runs.slice(0, 8).map((r, i) => '<tr' + (thisRun && r.when === thisRun.when ? ' class="me"' : "") + '><td class="rk">' + (i + 1) + "</td><td>" +
      new Date(r.when).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + new Date(r.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) +
      (thisRun && r.when === thisRun.when ? ' <span class="you">this run</span>' : "") + '</td><td class="num">' + r.score + ' pts</td>' + (UNTIMED ? "" : '<td class="num">' + fmt(r.ms) + "</td>") + "</tr>").join("");
    return '<div class="card board-card" id="board-card"><h3><span class="h-ico">' + ICON.cup.replace('stroke="currentColor"', 'stroke="#f5a623"') + "</span>Leaderboard</h3>" +
      '<table class="times"><tr class="head"><td>#</td><td>Run</td><td class="num">Points</td>' + timeCol + "</tr>" + rows + "</table>" +
      '<p class="small">Best runs on this computer. Replay to add another. A class-wide leaderboard comes with CyberQuest.</p></div>';
  }
  const boardBtn = el("board");
  if (boardBtn) boardBtn.addEventListener("click", () => {
    const old = el("board-card");
    if (old) { old.remove(); return; }
    article.insertAdjacentHTML("beforeend", boardHtml());
    el("board-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function finish() {
    const total = UNTIMED ? "" : (window.questClock ? window.questClock.text() : "");
    saveRun();
    count.textContent = "";
    const title = UNTIMED ? "Warm-ups Complete" : "Quest Complete";
    const blurb = UNTIMED
      ? "Nice work — you finished all " + N + " warm-ups and banked <b>" + score() + " points</b>. You're ready: pick a CTF from the home page."
      : "Great job! You captured all " + N + " flags and completed the " + GAME + " in <b>" + total + "</b>.";
    const timeCols = UNTIMED ? "" : '<td class="num">Took</td><td class="num">Time</td>';
    article.innerHTML =
      '<div class="complete"><span class="confetti" aria-hidden="true">' + "<i></i>".repeat(12) + "</span>" +
        '<span class="trophy">' + TROPHY + "</span>" +
        "<div><h2>" + title + "</h2><p>" + blurb + "</p></div></div>" +
      '<div class="card sc"><h3><span class="h-ico">' + ICON.chart + "</span>" + UNIT + " Scorecard</h3><table class=\"times\">" +
        '<tr class="head"><td></td><td>#</td><td>' + UNIT + '</td><td class="num">Points</td>' + timeCols + "</tr>" +
        MISSIONS.map((m, i) => '<tr><td class="ck">' + (done.has(i + 1) ? '<span class="tick">' + CHECK + "</span>" : "") + '</td><td class="rk">' + (i + 1) + "</td><td>" + m.title + '</td><td class="num">' + (done.has(i + 1) ? m.points : 0) + " pts" + (hintCost(i + 1) ? '<span class="hint-cost">−' + hintCost(i + 1) + (hintsUsed[i + 1] > 1 ? " hints" : " hint") + "</span>" : "") + "</td>" + (UNTIMED ? "" : '<td class="num dim">' + took(i + 1) + '</td><td class="num">' + clockAt(i + 1) + "</td>") + "</tr>").join("") +
        '<tr class="total"><td></td><td></td><td>Total</td><td class="num">' + score() + ' pts</td>' + (UNTIMED ? "" : '<td class="num"></td><td class="num">' + total + "</td>") + "</tr></table>" +
        (UNTIMED ? "" : '<p class="small"><b>Took</b>: time since your previous flag. <b>Time</b>: the clock when you submitted.</p>') + "</div>" +
      '<div class="card learned"><h3><span class="h-ico">' + ICON.bulb + "</span>What you learned</h3><ul>" + LEARNED.map((t) => '<li><span class="tick blue">' + CHECK + "</span><span>" + t + "</span></li>").join("") + "</ul></div>";
    state.textContent = "";
    state.className = "m-state ok";
    next.disabled = false;
    next.innerHTML = '<span class="b-ico">' + ICON.replay + "</span>" + (UNTIMED ? "Start over" : "Replay Quest");
    next.classList.add("replay");
    prev.hidden = true;
    if (boardBtn) boardBtn.hidden = false;
    el("guide-foot").classList.add("finished");
    current = N;
    paintSteps(-9);
    body.scrollTop = 0;
  }

  function unfinish() { next.classList.remove("replay"); prev.hidden = false; if (boardBtn) boardBtn.hidden = true; el("guide-foot").classList.remove("finished"); }
  prev.addEventListener("click", () => { if (current > 0 && current <= N) { current = Math.min(current, N) - 1; unfinish(); render(); } });
  next.addEventListener("click", () => {
    if (current === N) { location.reload(); return; }
    if (current === N - 1) { if (done.size === N) finish(); return; }
    if (done.has(current + 1)) { current++; render(); }
  });

  if (el("score-max")) el("score-max").textContent = MAX;
  showScore(false);
  dots.innerHTML = MISSIONS.map((m, i) => (i ? '<span class="step-bar" aria-hidden="true"></span>' : "") +
    '<button type="button" class="step-btn" title="' + UNIT + " " + (i + 1) + ': ' + m.title + ' (' + m.level + ', ' + m.points + ' pts)"><span class="step-dot">' + (i + 1) + '</span><span class="step-num">' + (i + 1) + "</span></button>").join("");
  dots.querySelectorAll(".step-btn").forEach((d, i) => d.addEventListener("click", () => { if (i <= reachable() || done.size === N) { current = i; unfinish(); render(); } }));
  render();

  window.questGuide = {
    done(n, at) {
      if (!(n >= 1 && n <= N)) return;
      const fresh = !done.has(n); done.add(n);
      if (typeof at === "number" && at && !(n in capturedAt)) capturedAt[n] = at;
      showScore(fresh); if (current < N) render(); },
    setRunner(fn) { runner = fn; },
    current: () => current + 1,
    // A hint was bought (k = which tier). Charged once: buying a tier you already have is free.
    hintUsed(n, k) {
      if (!(n >= 1 && n <= N)) return;
      const m = MISSIONS[n - 1], had = hintsUsed[n] || 0, now = Math.min(m.hints.length, Math.max(had, k || had + 1));
      if (now > had) { hintsUsed[n] = now; showScore(true); }
      if (current === n - 1) render();
    },
  };
})();
