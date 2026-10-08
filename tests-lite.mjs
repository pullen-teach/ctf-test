// Lite mode test: Chromium with --js-flags=--jitless has no WebAssembly, like a
// browser under DefaultJavaScriptJitSetting=2. Serve public/ on :8099 first.
import { chromium } from "playwright";
const url = process.env.QUEST_URL || "http://127.0.0.1:8099/";
const browser = await chromium.launch({ args: ["--no-proxy-server", "--js-flags=--jitless"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(url);
console.log("typeof WebAssembly:", await page.evaluate(() => typeof WebAssembly));
await page.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 30000 });
console.log("status:", await page.textContent("#status"));
const run = (cmd) => page.evaluate(async (c) => { const r = await window.questLite.runLine(c); return r.out + r.err; }, cmd);
const cmds = ["whoami", "pwd", "ls", "ls -a ~", "ls -a /home", "cd / ; ls ; cd ~", "cat /etc/passwd", "wc -l /etc/passwd", "head -1 /etc/passwd",
  "find /etc -name \"p*\"", "find /etc -type d", "grep player /etc/passwd", "grep -r PS1 /etc", "ls /bin | wc -l", "ls /bin | grep sh | wc -l",
  "ls /root", "ls -l /etc/passwd", "echo 'echo hi' > hi.sh", "./hi.sh", "chmod +x hi.sh", "./hi.sh", "echo hello | base64", "echo aGVsbG8K | base64 -d",
  "echo hello | sha256sum", "echo Hello | sha256sum", "LS", "ls /nope", "cd /etc; pwd; cd ~", "hint 2", "echo \"$(whoami) leveled up\"", "uname", "cd /root", "cat /etc/quest/1",
  "echo hacked > /etc/quest/1", "submit CQ{fake-12345678}", "cat ~/mission2/notes.txt", "cat --help", "cat -n ~/mission1/README.txt", "hint 1", "base64 --help", "vi", "frobnicate"];
for (const c of cmds) console.log("$ " + c + "\n" + (await run(c)).trimEnd());
// Solve the missions, and submit by typing into the terminal (tests the keyboard path).
const ln = (await run("cat ~/mission1/README.txt")).match(/line (\d+)/)[1];
const f0 = (await run("cat -n ~/mission1/bag.txt")).split("\n").find((l) => l.startsWith(ln.padStart(6) + "\t")).match(/CQ\{[^}]+\}/)[0];
console.log("line", ln, "decoy rejected:", (await run("submit " + (await run("head -1 ~/mission1/bag.txt")).match(/CQ\{[^}]+\}/)[0])).trim());
const ls1 = await run("ls -a ~/mission2");
const real = ls1.replace(/\x1b\[[0-9;]*m/g, "").split(/\s+/).find((n) => n.startsWith(".") && n.length > 2 && !n.startsWith(".old"));
const f1 = (await run("cat ~/mission2/" + real)).match(/CQ\{[^}]+\}/)[0];
const ext = (await run("cat ~/mission3/README.txt")).match(/ending in \.(\w+)/)[1];
const p2 = (await run("cd ~/mission3; find archive -name \"*." + ext + "\"; cd ~")).trim();
const f2 = (await run("cat ~/mission3/" + p2)).match(/CQ\{[^}]+\}/)[0];
console.log("count files/dirs:", (await run("cd ~/mission3; find archive -type f | wc -l; find archive -type d | wc -l; cd ~")).replace(/\n/g, " "));
const who = (await run("cat ~/mission4/README.txt")).match(/as:\s+(\S+)/)[1];
const f3 = (await run("grep " + who + " ~/mission4/access.log")).match(/CQ\{[^}]+\}/)[0];
const f4 = (await run("base64 -d ~/mission5/message.b64")).match(/CQ\{[^}]+\}/)[0];
await page.click("#terminal");
for (const f of [f0, f1, f2, f3, f4]) { await page.keyboard.type("submit " + f); await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
// Tab completion and history through the keyboard.
await page.keyboard.type("cd miss"); await page.keyboard.press("Tab"); await page.keyboard.type("3"); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
await page.keyboard.type("pwd"); await page.keyboard.press("Enter"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Enter");
await page.waitForTimeout(400);
console.log("status after submits:", await page.textContent("#status"));
console.log("green cards:", await page.evaluate(() => window.quest.done.size));
console.log("screen tail:\n" + (await page.evaluate(() => document.querySelector(".xterm-rows").innerText)).trimEnd().split("\n").slice(-12).join("\n"));
await page.screenshot({ path: "lite.png" });
console.log("page errors:", errs);
await browser.close();
