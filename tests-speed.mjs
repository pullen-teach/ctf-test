// Warm-up 2 (speed drills) test: drives the real keys (Tab, up arrow, Ctrl+C) in the terminal,
// and drill 4 by selecting the code with the mouse and middle-click pasting it.
// Serve public/ on :8099 first. Run: node tests-speed.mjs lite   (or no argument for real Linux)
import { chromium } from "playwright";
const lite = process.argv[2] === "lite";
const b = await chromium.launch({ args: ["--no-proxy-server"].concat(lite ? ["--js-flags=--jitless"] : []) });
const p = await b.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:8099/linux/" + (lite ? "?lite" : ""));
await p.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 180000 });
await p.waitForTimeout(1500);
await p.mouse.click(400, 500);
const screen = async () => (await p.evaluate(() => document.querySelector(".xterm-rows").innerText));
const type = async (t) => { await p.keyboard.type(t, { delay: 20 }); };
const enter = async (ms = 900) => { await p.keyboard.press("Enter"); await p.waitForTimeout(ms); };
await type("clear"); await enter();
await type("cd ~/speed/tab"); await enter();
await type("cat dri"); await p.keyboard.press("Tab"); await p.waitForTimeout(600); await enter();
let t = await screen(); const p1 = t.match(/Piece 1: (\w{4})/)[1];
await type("again"); await enter(600);
for (let i = 0; i < 4; i++) { await p.keyboard.press("ArrowUp"); await p.waitForTimeout(150); await enter(600); }
t = await screen(); const p2 = t.match(/Piece 2: (\w{4})/)[1];
await type("runaway"); await enter(3200);
await p.keyboard.press("Control+c"); await p.waitForTimeout(1500);
t = await screen(); const p3 = t.match(/Piece 3: (\w{4})/)[1];
// Drill 4: copy and paste. cat the code, then select it with the mouse and middle-click paste it.
await type("cd ~/speed/paste"); await enter();
await type("cat code.txt"); await enter();
t = await screen(); const code = t.match(/CODE: (\w{12})/)[1];
await type("pasteit ");
// Double-click the CODE word to select it (copy-on-select), then middle-click to paste.
const box = await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".xterm-rows > div")];
  const row = rows.find((d) => /CODE:/.test(d.textContent));
  const r = (row || document.querySelector(".xterm-screen")).getBoundingClientRect();
  const scr = document.querySelector(".xterm-screen").getBoundingClientRect();
  return { y: Math.round(r.top + r.height / 2), x0: Math.round(scr.left), w: scr.width };
});
// "CODE: " is 6 chars; the code is 12. Double-click near the middle of the code.
const cols = await p.evaluate(() => (window.term && window.term.cols) || 80);
const cw = box.w / cols;
const cx = Math.round(box.x0 + (6 + 6) * cw);
await p.mouse.dblclick(cx, box.y);
await p.waitForTimeout(300);
const sel = await p.evaluate(() => (window.getSelection && window.getSelection().toString()) || "");
await p.mouse.move(cx, box.y); await p.mouse.down({ button: "middle" }); await p.mouse.up({ button: "middle" });
await p.waitForTimeout(400);
let line = (await screen()).split("\n").reverse().find((l) => /pasteit/.test(l)) || "";
const pasted = line.includes(code);
if (!pasted) { await type(code); }   // fall back to typing if the mouse paste missed
await enter(900);
t = await screen(); const p4 = t.match(/Piece 4: (\w{4})/)[1];
console.log("drill4 selected:", JSON.stringify(sel), "| middle-click pasted:", pasted);
await type("submit CYBA{speed-" + p1 + p2 + p3 + p4 + "}"); await enter(1500);
t = await screen();
console.log(t.split("\n").filter(Boolean).slice(-8).join("\n"));
console.log("pieces", p1, p2, p3, p4, "| score:", await p.textContent("#score-pts"), "/", await p.textContent("#score-max"), "| clock:", await p.textContent("#clock-label"));
await p.click(".warm-btn[data-c='-2']"); await p.waitForTimeout(500);
await p.screenshot({ path: "speed-" + (lite ? "lite" : "vm") + ".png" });
console.log("errors", errs); await b.close();
