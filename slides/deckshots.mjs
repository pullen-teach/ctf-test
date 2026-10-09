import { chromium } from "playwright";
import fs from "fs";
const out = new URL("./img/", import.meta.url).pathname;
const b = await chromium.launch({ args: ["--no-proxy-server"] });
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
// A) real Linux, mid-game: warm-up and missions 1-2 captured, mission 3 open
{
  const p = await b.newPage({ viewport: { width: 1360, height: 800 } });
  await p.goto("http://127.0.0.1:8099/");
  await p.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 180000 });
  await p.waitForTimeout(1500);
  const type = async (c, w = 900) => { await p.click("#terminal"); await p.keyboard.type(c, { delay: 20 }); await p.keyboard.press("Enter"); await p.waitForTimeout(w); };
  await type('submit "$(tail -1 orientation.txt | tr -d " ")"', 2500);
  await p.click("#next");                                  // Start Mission 1: the clock starts at the next keystroke
  await type("clear", 600);
  await type('cd ~/mission1/town && cd $(ls | sed -n "s/sign--go-into-the-//p") && cd .. && cd $(ls */ | sed -n "s/dead-end--go-back-up-and-try-the-//p") && cd $(ls | sed -n "s/go-into-the-\\(.*\\)-then-the-\\(.*\\)/\\1\\/\\2/p")', 4000);
  await type('submit "$(ls | grep -o "CYBA{[^}]*}")"', 3000);
  await type('cd ~/mission2 && submit "$(sed -n "$(grep -o "line [0-9][0-9]*" README.txt | cut -c6-)p" bag.txt | grep -o "CYBA{[^}]*}")"', 4000);
  await p.waitForFunction(() => window.quest.done.size === 2, null, { timeout: 60000 });
  await type("clear", 600);
  await p.click("#next"); await p.click("#next");
  await type("cd ~/mission3", 800);
  await type("ls -a", 4000);
  await p.screenshot({ path: out + "page.png" });
  const c = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }, sel);
  const pins = {
    track: await c(".track"), points: await c("#score .stat-ico"), clock: await c("#clock .stat-ico"), stepper: await c(".step-btn:nth-of-type(4) .step-dot"),
    level: await c(".mission .level"), copy: await c(".mini.copy"), terminal: [430, 420], next: await c("#next"),
  };
  fs.writeFileSync(out + "pins.json", JSON.stringify(pins));
  console.log("pins", pins, "clock", await p.textContent("#clock-time"));
  await p.close();
}
// B) finish scorecard (example times), lite mode
{
  const p = await b.newPage({ viewport: { width: 1360, height: 800 } });
  await p.goto("http://127.0.0.1:8099/?lite");
  await p.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent));
  const times = [118, 265, 352, 571, 769, 1012, 1236, 1388, 1655, 2310].map((s) => s * 1000);
  await p.evaluate((times) => { let i = 0; window.questClock.elapsed = () => times[Math.min(i++, times.length - 1)]; window.questClock.text = () => "38:30"; }, times);
  const run = (c) => p.evaluate(async (c) => { const r = await window.questLite.runLine(c); return r.out + r.err; }, c);
  const names = async () => strip(await run("ls")).split(/\s+/).filter(Boolean);
  const sign = async (pre) => (await names()).find((x) => x.startsWith(pre)).slice(pre.length);
  const fw = (await run("cat ~/orientation.txt")).match(/CYBA\{warmup-[^}]+\}/)[0];
  await run("cd ~/mission1/town"); await run("cd " + await sign("sign--go-into-the-"));
  const back = await sign("dead-end--go-back-up-and-try-the-"); await run("cd .."); await run("cd " + back);
  const two = (await sign("go-into-the-")).match(/^(\w+)-then-the-(\w+)$/); await run("cd " + two[1] + "/" + two[2]);
  const f = [(await names()).find((x) => x.startsWith("CYBA{"))];
  await run("cd ~");
  const ln = (await run("cat ~/mission2/README.txt")).match(/line (\d+)/)[1];
  f.push((await run("cat -n ~/mission2/bag.txt")).split("\n").find((l) => l.startsWith(ln.padStart(6) + "\t")).match(/CYBA\{[^}]+\}/)[0]);
  const real = strip(await run("ls -a ~/mission3")).split(/\s+/).find((n) => n.startsWith(".") && n.length > 2 && !n.startsWith(".old"));
  f.push((await run("cat ~/mission3/" + real)).match(/CYBA\{[^}]+\}/)[0]);
  const ext = (await run("cat ~/mission4/README.txt")).match(/ending in \.(\w+)/)[1];
  f.push((await run("cat ~/mission4/" + (await run("cd ~/mission4; find archive -name \"*." + ext + "\"; cd ~")).trim())).match(/CYBA\{[^}]+\}/)[0]);
  const who = (await run("cat ~/mission5/README.txt")).match(/as:\s+(\S+)/)[1];
  f.push((await run("grep " + who + " ~/mission5/access.log")).match(/CYBA\{[^}]+\}/)[0]);
  f.push((await run("sort ~/mission6/codes.txt | uniq -u")).trim());
  f.push((await run("chmod +x ~/mission7/unlock.sh; ~/mission7/unlock.sh")).match(/CYBA\{[^}]+\}/)[0]);
  f.push((await run("base64 -d ~/mission8/message.b64")).match(/CYBA\{[^}]+\}/)[0]);
  let f9 = null; for (let k = 1; k < 9 && !f9; k++) { const m = (await run("base64 -d ~/mission9/cake.b64" + " | base64 -d".repeat(k - 1))).match(/CYBA\{[^}]+\}/); if (m) f9 = m[0]; }
  f.push(f9);
  const w10 = (await run("cat ~/mission10/README.txt")).match(/Piece 2: (\S+)/)[1];
  let pc1; for (const q of (await run("find ~/mission10/vault -name '.*' -type f")).trim().split("\n")) { const m = (await run("cat " + q)).match(/piece 1: (\w+)/); if (m) pc1 = m[1]; }
  const pc2 = (await run("grep 'user=" + w10 + " ' ~/mission10/auth.log | cut -d= -f4 | base64 -d")).match(/piece 2: (\w+)/)[1];
  const pc3 = (await run("cd ~/mission10; chmod +x unlock.sh; ./unlock.sh; cd ~")).match(/piece 3: (\w+)/)[1];
  f.push("CYBA{" + pc1 + "-" + pc2 + "-" + pc3 + "}");
  await p.click("#terminal");
  await p.keyboard.type("submit " + fw); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  await p.click("#next");
  for (const x of f) { await p.click("#terminal"); await p.keyboard.type("submit " + x); await p.keyboard.press("Enter"); await p.waitForTimeout(250); }
  for (let i = 0; i < 10; i++) await p.click("#next");
  await p.evaluate(() => { document.getElementById("clock-time").textContent = "38:30"; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + "finish.png" });
  await p.locator(".side").screenshot({ path: out + "sidebar-full.png" });
  console.log("finish flags:", await p.textContent("#status"));
  await p.close();
}
await b.close();
