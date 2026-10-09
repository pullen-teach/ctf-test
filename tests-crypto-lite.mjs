// Crypto CTF lite-mode test: solves the warm-up and all ten missions the way a student
// would. Serve public/ on :8099 first (cd public && python3 -m http.server 8099).
import { chromium } from "playwright";
const url = process.env.QUEST_URL || "http://127.0.0.1:8099/crypto/?lite";
const browser = await chromium.launch({ args: ["--no-proxy-server", "--js-flags=--jitless"] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(url);
await page.waitForFunction(() => /Ready/.test(document.getElementById("status").textContent), null, { timeout: 60000 });
const run = (c) => page.evaluate(async (c) => { const r = await window.questLite.runLine(c); return (r.out + (r.err || "")).replace(/\x1b\[[0-9;]*m/g, ""); }, c);
const flag = (t) => (t.match(/CYBA\{[^}]+\}/) || [null])[0];
const flags = [];
flags.push((await run("cat ~/orientation.txt")).match(/CYBA\{warmup-[^}]+\}/)[0]);
flags.push(flag(await run("base64 -d ~/mission1/message.b64")));
flags.push(flag(await run("xxd -r -p ~/mission2/secret.hex")));
flags.push(flag(await run("tr 'A-Za-z' 'N-ZA-Mn-za-m' < ~/mission3/message.txt")));
flags.push(flag(await run("caesar all ~/mission4/message.txt | grep CYBA")));
flags.push(flag(await run("tr 'A-Za-z' 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba' < ~/mission5/mirror.txt")));
const code = (await run("morse ~/mission6/signal.txt")).match(/CODE IS (\w+)/)[1];
flags.push("CYBA{morse-" + code.toLowerCase() + "}");
const target = (await run("cat ~/mission7/target.sha256")).trim();
flags.push(flag(await run("hashlines ~/mission7/candidates.txt | grep " + target.slice(0, 8))));
flags.push(flag(await run("xor all ~/mission8/cipher.hex | grep CYBA")));
const kw = (await run("tr 'A-Za-z' 'N-ZA-Mn-za-m' < ~/mission9/briefing.txt")).match(/keyword is (\w+)/)[1];
flags.push(flag(await run("vigenere -d " + kw + " ~/mission9/secret.txt")));
const key = (await run("cat ~/mission10/key.sha256")).trim();
const word = (await run("hashlines ~/mission10/words.txt | grep " + key.slice(0, 8))).trim().split(/\s+/)[1];
flags.push(flag(await run("base64 -d ~/mission10/vault.b64 | vigenere -d " + word)));
let ok = 0;
for (const [n, f] of flags.entries()) {
  const r = await run("submit " + f);
  console.log(n, f, "->", r.trim().split("\n")[0]);
  if (/Correct/.test(r)) ok++;
}
await page.waitForTimeout(500);
console.log("captured", ok, "of 11 | status:", (await page.textContent("#status")).trim(), "| points:", (await page.textContent("body")).match(/(\d[\d,]*)\s*\/\s*2,?750/)?.[1]);
console.log("errors:", errs);
await browser.close();
process.exit(ok === 11 && !errs.length ? 0 : 1);
