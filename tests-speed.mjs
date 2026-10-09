// Warm-up 2 (speed drills) test: types with real keys (Tab, up arrow, Ctrl+C) in the terminal.
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
await type("submit CYBA{speed-" + p1 + p2 + p3 + "}"); await enter(1500);
t = await screen();
console.log(t.split("\n").filter(Boolean).slice(-8).join("\n"));
console.log("pieces", p1, p2, p3, "| score:", await p.textContent("#score-pts"), "/", await p.textContent("#score-max"), "| clock:", await p.textContent("#clock-label"));
await p.click(".warm-btn[data-c='-2']"); await p.waitForTimeout(500);
await p.screenshot({ path: "speed-" + (lite ? "lite" : "vm") + ".png" });
console.log("errors", errs); await b.close();
