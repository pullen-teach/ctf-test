import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const logs = [];
page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
page.on("pageerror", (e) => logs.push("pageerror: " + e));
const t0 = Date.now();
await page.goto(process.env.QUEST_URL || "http://127.0.0.1:8099/linux/");
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
  'cd ~/mission1 && ls && cd town && ls && cd $(ls | sed -n "s/sign--go-into-the-//p") && ls && cd .. && cd $(ls */ | sed -n "s/dead-end--go-back-up-and-try-the-//p") && cd $(ls | sed -n "s/go-into-the-\\(.*\\)-then-the-\\(.*\\)/\\1\\/\\2/p") && pwd && ls',
  'submit "$(ls | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission2 && cat README.txt && cat --help; cat -n bag.txt | tail -3',
  'submit "$(sed -n "$(grep -o "line [0-9][0-9]*" README.txt | cut -c6-)p" bag.txt | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission3 && ls -a',
  'submit "$(cat .[!.]* | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission4 && cat README.txt',
  'submit "$(cat $(find archive -name "*.$(grep -o "in \\.[a-z]*" README.txt | cut -c5-)") | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission5 && grep "$(head -1 README.txt | awk "{print \\$NF}")" access.log',
  'submit "$(grep "$(head -1 README.txt | awk "{print \\$NF}")" access.log | sed "s/.*token=//")"',
  'cd ~/mission8 && base64 -d message.b64',
  'submit "$(base64 -d message.b64 | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission6 && sort codes.txt | uniq -u',
  'submit "$(sort ~/mission6/codes.txt | uniq -u)"',
  'cd ~/mission7 && ls -l && ./unlock.sh; chmod +x unlock.sh && ./unlock.sh',
  'submit "$(~/mission7/unlock.sh | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission9 && c=$(cat cake.b64); while ! echo "$c" | grep -q Flag; do c=$(echo "$c" | base64 -d); done; echo "$c"',
  'submit "$(echo "$c" | grep -o "CYBA{[^}]*}")"',
  'cd ~/mission10 && w=$(grep "Piece 2" README.txt | awk "{print \\$3}") && p1=$(cat $(find vault -name ".*" -type f) | grep "piece 1" | cut -d" " -f3) && p2=$(grep "user=$w " auth.log | cut -d= -f4 | base64 -d | cut -d" " -f3) && chmod +x unlock.sh && p3=$(./unlock.sh | cut -d" " -f3) && echo "CYBA{$p1-$p2-$p3}"',
  'submit "CYBA{$p1-$p2-$p3}"',
];
for (const c of cmds) {
  const t = Date.now();
  await send(c + "\n");
  // Long commands keep the emulated CPU busy; wait so the next line is not typed into a full serial buffer.
  await page.waitForTimeout(c.length > 120 ? 8000 : 400);
  if (c.startsWith("submit")) {
    const n = (await page.evaluate(() => window.quest.done.size));
    await page.waitForFunction((n) => window.quest.done.size > n - 1, n, { timeout: 60000 }).catch(() => {});
  }
  console.log("cmd", ((Date.now() - t) / 1000).toFixed(1) + "s", c.slice(0, 50));
}
await page.waitForFunction(() => window.quest.done.size === 10, null, { timeout: 90000 }).catch(() => {});
console.log("missions done:", await page.evaluate(() => [...window.quest.done].join(",")), "status:", await page.textContent("#status"));
await send("clear; whoami; cat /etc/quest/1 | cut -c1-12; ls /root; hint 1\n");
await page.waitForTimeout(3000);
await page.screenshot({ path: "v86-done.png" });
console.log(logs.filter(l => /error/i.test(l)).slice(0, 5).join("\n"));
await browser.close();
