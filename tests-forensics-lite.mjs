// Forensics CTF lite-mode test: solves the warm-up and all ten missions the way a student
// would. Serve public/ on :8099 first (cd public && python3 -m http.server 8099).
import { chromium } from "playwright";
const url = process.env.QUEST_URL || "http://127.0.0.1:8099/forensics/?lite";
const browser = await chromium.launch({ args: ["--no-proxy-server", "--js-flags=--jitless"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(url);
await page.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 60000 });
const run = (c) => page.evaluate(async (c) => { const r = await window.questLite.runLine(c); return (r.out + (r.err || "")).replace(/\x1b\[[0-9;]*m/g, ""); }, c);
const flag = (t) => (t.match(/CYBA\{[^}]+\}/) || [null])[0];
const show = (label, t) => console.log("--- " + label + "\n" + t.trimEnd().split("\n").slice(0, 6).join("\n"));
const flags = [];
// 1: the file changed at the break-in minute
await run("cd ~/mission1");
const t1 = (await run("head -1 README.txt")).match(/(\d\d:\d\d)/)[1];
const ls1 = await run("ls -l evidence"); show("ls -l evidence", ls1);
const f1 = ls1.split("\n").find((l) => l.includes(" " + t1 + " ")).trim().split(/\s+/).pop();
flags.push(flag(await run("cat evidence/" + f1)));
// 2: photo metadata
show("strings photo.jpg | head", await run("strings ~/mission2/photo.jpg | head -6"));
flags.push(flag(await run("strings ~/mission2/photo.jpg | grep Comment")));
// 3: wrong label
await run("cd ~/mission3");
const ft3 = await run("filetype photos/*"); show("filetype photos/*", ft3);
const odd = ft3.split("\n").find((l) => /gzip/.test(l)).split(":")[0];
flags.push(flag(await run("zcat " + odd)));
// 4: Russian dolls
await run("cd ~/mission4");
show("tar -xzf", await run("tar -xzf evidence.tar.gz; ls; filetype box"));
show("tar -xf box", await run("tar -xf box; ls; filetype inner"));
flags.push(flag(await run("zcat inner")));
// 5: log detective
await run("cd ~/mission5");
const c5 = await run("grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n | tail -1"); show("busiest IP", c5);
flags.push(flag(await run("grep Accepted auth.log | grep " + c5.trim().split(/\s+/)[1])));
// 6: hidden tail
show("strings | tail", await run("strings ~/mission6/cat.jpg | tail -2"));
flags.push(flag(await run("strings ~/mission6/cat.jpg | tail -1 | base64 -d")));
// 7: tampered
await run("cd ~/mission7");
const c7 = await run("sha256sum -c manifest.sha256"); show("sha256sum -c", c7);
const bad = c7.split("\n").find((l) => /FAILED/.test(l)).split(":")[0];
flags.push(flag(await run("strings " + bad + " | grep CYBA")));
// 8: persistence
await run("cd ~/mission8");
const cron = await run("cat cron/*");
const script = cron.split("\n").find((l) => l.includes(".sys-update")).trim().split(/\s+/).pop();
show("ls -a var/.cache", await run("ls -a var/.cache"));
const payload = (await run("cat " + script)).match(/PAYLOAD="([^"]+)"/)[1];
flags.push(flag(await run("echo " + payload + " | base64 -d")));
// 9: leaked in pieces
await run("cd ~/mission9");
show("capture", await run("head -4 capture.txt; grep seq= capture.txt | head -2"));
flags.push(flag(await run("grep seq= capture.txt | cut -d'?' -f2 | cut -d' ' -f1 | sort | cut -d'=' -f3 | tr -d '\\n' | xxd -r -p")));
// 10: case closed
await run("cd ~/mission10");
const ip10 = (await run("grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n | tail -1")).trim().split(/\s+/)[1];
const user = (await run("grep Accepted auth.log | grep " + ip10 + " | cut -d' ' -f6")).trim();
const ft10 = await run("filetype homes/" + user + "/*"); show("filetype homes/" + user, ft10);
const hid = ft10.split("\n").find((l) => /gzip/.test(l)).split(":")[0];
flags.push(flag(await run("zcat " + hid + " | base64 -d")));
let ok = 0;
for (const [n, f] of flags.entries()) {
  const r = await run("submit " + f);
  console.log(n, f, "->", r.trim().split("\n")[0]);
  if (/Correct/.test(r)) ok++;
}
await page.waitForTimeout(500);
console.log("captured", ok, "of 10 | status:", (await page.textContent("#status")).trim(), "| points:", (await page.textContent("#score-pts")).trim(), "/", (await page.textContent("#score-max")).trim());
console.log("errors:", errs);
await browser.close();
process.exit(ok === 10 && !errs.length ? 0 : 1);
