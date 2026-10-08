import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const logs = [];
page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
page.on("pageerror", (e) => logs.push("pageerror: " + e));
const t0 = Date.now();
await page.goto(process.env.QUEST_URL || "http://127.0.0.1:8099/");
try {
  await page.waitForFunction(() => window.questReadySeconds, null, { timeout: 180000 });
} catch (e) { console.log("NOT READY", (Date.now()-t0)/1000, logs.slice(-15).join("\n")); await page.screenshot({ path: "v86-fail.png" }); process.exit(1); }
console.log("kernel boot done at", await page.evaluate(() => window.questBootSeconds), "s;");
console.log("ready after", await page.evaluate(() => window.questReadySeconds), "s (page), wall", (Date.now() - t0) / 1000);
await page.waitForTimeout(1500);
await page.screenshot({ path: "v86-ready.png" });
// Solve every mission by typing into the guest's serial console, like a student.
const send = (s) => page.evaluate((s) => window.quest.emulator.serial0_send(s), s);
const cmds = [
  'cd ~/mission1 && cat README.txt && vault; vault --help',
  'submit "$(vault --open | grep -o "CQ{[^}]*}")"',
  'cd ~/mission2 && ls -a',
  'submit "$(cat .[!.]* | grep -o "CQ{[^}]*}")"',
  'cd ~/mission3 && cat README.txt',
  'submit "$(cat $(find archive -name "*.$(grep -o "in \\.[a-z]*" README.txt | cut -c5-)") | grep -o "CQ{[^}]*}")"',
  'cd ~/mission4 && grep "$(head -1 README.txt | awk "{print \\$NF}")" access.log',
  'submit "$(grep "$(head -1 README.txt | awk "{print \\$NF}")" access.log | sed "s/.*token=//")"',
  'cd ~/mission5 && base64 -d message.b64',
  'submit "$(base64 -d message.b64 | grep -o "CQ{[^}]*}")"',
];
for (const c of cmds) {
  const t = Date.now();
  await send(c + "\n");
  await page.waitForTimeout(400);
  if (c.startsWith("submit")) {
    const n = (await page.evaluate(() => window.quest.done.size));
    await page.waitForFunction((n) => window.quest.done.size > n - 1, n, { timeout: 60000 }).catch(() => {});
  }
  console.log("cmd", ((Date.now() - t) / 1000).toFixed(1) + "s", c.slice(0, 50));
}
await page.waitForFunction(() => window.quest.done.size === 5, null, { timeout: 90000 }).catch(() => {});
console.log("missions done:", await page.evaluate(() => [...window.quest.done].join(",")), "status:", await page.textContent("#status"));
await send("clear; whoami; cat /etc/quest/1 | cut -c1-12; ls /root; grep -c CQ /bin/vault; hint 1\n");
await page.waitForTimeout(3000);
await page.screenshot({ path: "v86-done.png" });
console.log(logs.filter(l => /error/i.test(l)).slice(0, 5).join("\n"));
await browser.close();
