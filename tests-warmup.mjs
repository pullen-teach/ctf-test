// Warm-ups module test. Serve public/ on :8099.  node tests-warmup.mjs lite   (or no arg for real VM)
import { chromium } from "playwright";
const lite = process.argv[2] === "lite";
const b = await chromium.launch({ args: ["--no-proxy-server"].concat(lite ? ["--js-flags=--jitless"] : []) });
const p = await b.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:8099/warmup/" + (lite ? "?lite" : ""));
await p.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 180000 });
await p.waitForTimeout(1500);
await p.mouse.click(400, 500);
const screen = async () => (await p.evaluate(() => document.querySelector(".xterm-rows").innerText));
const type = async (t) => { await p.keyboard.type(t, { delay: 20 }); };
const enter = async (ms = 800) => { await p.keyboard.press("Enter"); await p.waitForTimeout(ms); };

// ---- Warm-up 1: orientation ----
await type("clear"); await enter();
await type("cat orientation.txt"); await enter();
let t = await screen();
const f1 = t.match(/CYBA\{warmup-[0-9a-f]{8}\}/)[0];
await type("submit " + f1); await enter(1000);

// ---- Warm-up 2: speed drills ----
await type("cd ~/speed/tab"); await enter();
await type("cat dri"); await p.keyboard.press("Tab"); await p.waitForTimeout(600); await enter();
t = await screen(); const p1 = t.match(/Piece 1: (\w{4})/)[1];
await type("again"); await enter(600);
for (let i = 0; i < 4; i++) { await p.keyboard.press("ArrowUp"); await p.waitForTimeout(150); await enter(600); }
t = await screen(); const p2 = t.match(/Piece 2: (\w{4})/)[1];
await type("runaway"); await enter(3200);
await p.keyboard.press("Control+c"); await p.waitForTimeout(1500);
t = await screen(); const p3 = t.match(/Piece 3: (\w{4})/)[1];
await type("cd ~/speed/paste"); await enter();
await type("cat code.txt"); await enter();
t = await screen(); const code = t.match(/CODE: (\w{12})/)[1];
await type("pasteit ");
const box = await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".xterm-rows > div")];
  const row = rows.find((d) => /CODE:/.test(d.textContent));
  const scr = document.querySelector(".xterm-screen").getBoundingClientRect();
  const r = (row || document.querySelector(".xterm-screen")).getBoundingClientRect();
  return { y: Math.round(r.top + r.height / 2), x0: Math.round(scr.left), w: scr.width };
});
const cols = await p.evaluate(() => (window.quest && window.quest.emulator ? 0 : 0) || 80);
const cw = box.w / cols;
const cx = Math.round(box.x0 + (6 + 6) * cw);
await p.mouse.dblclick(cx, box.y); await p.waitForTimeout(300);
await p.mouse.move(cx, box.y); await p.mouse.down({ button: "middle" }); await p.mouse.up({ button: "middle" });
await p.waitForTimeout(400);
let line = (await screen()).split("\n").reverse().find((l) => /pasteit/.test(l)) || "";
if (!line.includes(code)) { await type(code); }
await enter(900);
t = await screen(); const p4 = t.match(/Piece 4: (\w{4})/)[1];
await type("submit CYBA{speed-" + p1 + p2 + p3 + p4 + "}"); await enter(1200);

const done = await p.evaluate(() => window.quest.done.size);
console.log("pieces", p1, p2, p3, p4);
console.log("done:", done, "/ 2 | score:", await p.textContent("#score-pts"), "/", await p.textContent("#score-max"),
  "| clock display:", await p.evaluate(() => getComputedStyle(document.getElementById("clock")).display),
  "| status:", await p.textContent("#status"));
console.log("tail:\n" + (await screen()).trimEnd().split("\n").filter(Boolean).slice(-6).join("\n"));
console.log("errors:", errs);
await b.close();
