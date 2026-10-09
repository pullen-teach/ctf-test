// Builds slides/CyberQuest-Forensics-CTF.pptx. Run:  node slides/build-deck-forensics.js
// Teaching deck for the CyberQuest Forensics CTF page (public/forensics/). Part 2 teaches the
// investigator's tools in the order the ten missions need them; Part 3 plays the missions.
// Needs: npm install pptxgenjs react react-dom react-icons sharp
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

// ---- palette (matches the Linux Quest web page) ----
const INK = "12213A", MUTED = "56657E", TINT = "F1F5FB", LINE = "D6DEEA", WHITE = "FFFFFF";
const BLUE = "2459D8", GREEN = "17875A", AMBER = "F5A623", RED = "B93434";
const TERM = "0E1726", T_OUT = "B8C4D9", T_CMD = "FFFFFF", T_PROMPT = "46D39A", T_NOTE = "7F8FAD";
// One colour per mission, matching the progress track on the page.
const MC = ["17875A", "2A9FD6", "2459D8", "7448D4", "D1416B", "E8820C", "C9A227", "0F9488", "5B6EE1", "B4233F"];
// Kept for the shared helpers and older layouts.
const TIER = { warm: MC[1], search: MC[2], logs: MC[3], secrets: MC[4], bonus: AMBER };
// CyberQuest difficulty scale and points.
const LEVEL = { "Easy": { pts: 100, fill: "E2F5EC", ink: "12704B" }, "Medium": { pts: 200, fill: "FFF4DE", ink: "9A5B00" }, "Hard": { pts: 400, fill: "FDE8EC", ink: "B4233F" }, "Very Hard": { pts: 800, fill: "2A1430", ink: "FF8FB1" } };
const HEAD = "Arial", BODY = "Calibri", MONO = "Courier New";
const W = 13.333, H = 7.5, M = 0.6;
const FOOT = "CyberQuest Academy  ·  Forensics CTF";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Forensics CTF: read the evidence, then compete";
pres.author = "CyberQuest Academy";

let slideNo = 0;
// PowerPoint sections: section("Part 1 · Linux fundamentals") groups every slide after it in the slide sorter.
let SECTION = null;
function section(title) { pres.addSection({ title }); SECTION = title; }
// A content slide. tryCmd puts a green "Try it" pill top right: a command students
// run in their own Linux Quest tab. Every one of them is safe: none solves a mission.
function newSlide(titleText, notes, tryCmd) {
  const s = pres.addSlide(SECTION ? { sectionTitle: SECTION } : undefined);
  slideNo += 1;
  s.background = { color: WHITE };
  if (titleText) {
    s.addText(titleText, { x: M, y: 0.42, w: tryCmd ? W - 2 * M - 4.3 : W - 2 * M, h: 0.85, fontFace: HEAD, fontSize: 32, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true, fit: "shrink" });
  }
  if (tryCmd) tryIt(s, tryCmd);
  s.addText(FOOT, { x: M, y: 7.0, w: 6, h: 0.3, fontFace: BODY, fontSize: 10, color: MUTED, margin: 0, isTextBox: true });
  s.addText(String(slideNo), { x: W - M - 1, y: 7.0, w: 1, h: 0.3, fontFace: BODY, fontSize: 10, color: MUTED, align: "right", margin: 0, isTextBox: true });
  s.addNotes(notes);
  return s;
}

function tryIt(s, cmd) {
  const x = W - M - 4.1, y = 0.55, w = 4.1, h = 0.6;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: "E2F5EC" }, line: { color: GREEN, width: 1.5 }, rectRadius: 0.12 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.1, y: y + 0.1, w: 0.95, h: h - 0.2, fill: { color: GREEN }, rectRadius: 0.08 });
  s.addText("TRY IT", { x: x + 0.1, y: y + 0.1, w: 0.95, h: h - 0.2, fontFace: BODY, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(cmd, { x: x + 1.2, y, w: w - 1.3, h, fontFace: MONO, fontSize: 13, bold: true, color: INK, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
}

// A dark terminal window: the deck's one recurring motif.
// lines: "$ cmd" = prompt + command, "# text" = side note, {hi: "text"} = highlighted output, anything else = output.
function term(s, x, y, w, h, lines, opts = {}) {
  const size = opts.fontSize || 14;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: TERM }, rectRadius: 0.1, shadow: { type: "outer", color: "12213A", opacity: 0.22, blur: 10, offset: 3, angle: 90 } });
  ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: x + 0.22 + i * 0.22, y: y + 0.17, w: 0.13, h: 0.13, fill: { color: c } }));
  if (opts.title) s.addText(opts.title, { x: x + 1, y: y + 0.08, w: w - 2, h: 0.3, fontFace: MONO, fontSize: 10, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
  const runs = [];
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    if (typeof line === "object") {
      runs.push({ text: line.hi, options: { color: AMBER, bold: true, breakLine: !last } });
    } else if (line.startsWith("$ ")) {
      const [cmd, note] = line.slice(2).split("   # ");
      runs.push({ text: "$ ", options: { color: T_PROMPT, bold: true } });
      runs.push({ text: cmd, options: { color: T_CMD, bold: true, breakLine: !last && !note } });
      if (note) runs.push({ text: "   # " + note, options: { color: T_NOTE, breakLine: !last } });
    } else if (line.startsWith("# ")) {
      runs.push({ text: line, options: { color: T_NOTE, breakLine: !last } });
    } else {
      runs.push({ text: line || " ", options: { color: T_OUT, breakLine: !last } });
    }
  });
  s.addText(runs, { x: x + 0.3, y: y + 0.5, w: w - 0.6, h: h - 0.65, fontFace: MONO, fontSize: size, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 2 });
}

function card(s, x, y, w, h, fill = TINT) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, rectRadius: 0.1 });
}
function text(s, t, x, y, w, h, o = {}) {
  s.addText(t, { x, y, w, h, fontFace: BODY, fontSize: 16, color: INK, margin: 0, valign: "top", isTextBox: true, ...o });
}
function mono(s, t, x, y, w, h, o = {}) {
  text(s, t, x, y, w, h, { fontFace: MONO, bold: true, ...o });
}
// A command "chip": the command in mono on a dark pill, with what it does beside it.
function cmdRow(s, cmd, what, x, y, w, chipW = 1.9) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: chipW, h: 0.5, fill: { color: TERM }, rectRadius: 0.08 });
  s.addText(cmd, { x, y, w: chipW, h: 0.5, fontFace: MONO, fontSize: 15, bold: true, color: T_CMD, align: "center", valign: "middle", margin: 0, isTextBox: true });
  text(s, what, x + chipW + 0.25, y, w - chipW - 0.25, 0.5, { valign: "middle", fontSize: 17 });
}

const iconCache = {};
async function iconPng(Icon, color) {
  const key = Icon.name + color;
  if (!iconCache[key]) {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color: "#" + color, size: 256 }));
    iconCache[key] = "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  }
  return iconCache[key];
}
async function iconCircle(s, Icon, x, y, d, bg) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg } });
  s.addImage({ data: await iconPng(Icon, WHITE), x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5 });
}

function darkSlide(notes) {
  const s = pres.addSlide(SECTION ? { sectionTitle: SECTION } : undefined);
  slideNo += 1;
  s.background = { color: TERM };
  s.addText(FOOT, { x: M, y: 7.0, w: 6, h: 0.3, fontFace: BODY, fontSize: 10, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText(String(slideNo), { x: W - M - 1, y: 7.0, w: 1, h: 0.3, fontFace: BODY, fontSize: 10, color: T_NOTE, align: "right", margin: 0, isTextBox: true });
  s.addNotes(notes);
  return s;
}

// Section divider: big part number, title, and a one-line terminal "boot" message.
function divider(part, title, sub, color, cmd, notes) {
  const s = darkSlide(notes);
  s.addText(String(part), { x: M, y: 0.9, w: 3.2, h: 3.6, fontFace: HEAD, fontSize: 250, bold: true, color, margin: 0, valign: "middle", isTextBox: true });
  s.addText("Part " + part + " of 4", { x: 4.3, y: 1.6, w: 8, h: 0.4, fontFace: MONO, fontSize: 16, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText(title, { x: 4.3, y: 2.05, w: 8.4, h: 1.5, fontFace: HEAD, fontSize: 46, bold: true, color: WHITE, margin: 0, valign: "top", isTextBox: true });
  s.addText(sub, { x: 4.3, y: 3.65, w: 8.2, h: 1.0, fontFace: BODY, fontSize: 22, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.35, w: W - 2 * M, h: 0.9, fill: { color: "162238" }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: cmd, options: { color: WHITE, bold: true } }], { x: M + 0.35, y: 5.35, w: W - 2 * M - 0.7, h: 0.9, fontFace: MONO, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });
  return s;
}

function chip(s, label, x, y, w, fill, ink = WHITE, size = 13) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.38, fill: { color: fill }, rectRadius: 0.19 });
  s.addText(label, { x, y, w, h: 0.38, fontFace: BODY, fontSize: size, bold: true, color: ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
}

function numbered(s, items, x, y, w, rowH, color = BLUE, size = 17) {
  items.forEach((item, i) => {
    const yy = y + i * rowH;
    s.addShape(pres.shapes.OVAL, { x, y: yy, w: 0.5, h: 0.5, fill: { color } });
    s.addText(String(i + 1), { x, y: yy, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, item, x + 0.7, yy - 0.03, w - 0.7, rowH - 0.1, { fontSize: size, valign: "top" });
  });
}

function bullets(s, items, x, y, w, h, o = {}) {
  text(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), x, y, w, h, { paraSpaceAfter: 9, ...o });
}

// ---- the trail: the ten missions, one colour each (the page's progress track) ----
const N = 10;
function trail(s, x, y, w, current) {
  const gap = 0.08, pw = (w - gap * (N - 1)) / N;
  MC.forEach((color, i) => {
    const n = i + 1, here = n === current, done = n < current;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + i * (pw + gap), y: here ? y - 0.06 : y, w: pw, h: here ? 0.44 : 0.32, fill: { color: here || done ? color : "E4EAF3" }, rectRadius: 0.06 });
    s.addText(String(n), { x: x + i * (pw + gap), y: here ? y - 0.06 : y, w: pw, h: here ? 0.44 : 0.32, fontFace: HEAD, fontSize: here ? 13 : 10, bold: true, color: here || done ? WHITE : "8B98AD", align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
}
// A level badge, like the page: "Easy · 100".
function levelChip(s, level, x, y, w = 1.9, size = 13) {
  const L = LEVEL[level];
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.38, fill: { color: L.fill }, rectRadius: 0.19 });
  s.addText(level.toUpperCase() + "  ·  " + L.pts, { x, y, w, h: 0.38, fontFace: BODY, fontSize: size, bold: true, color: L.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
// A small "Mission N" tag for theory slides: which mission this tool is for.
function forMission(s, nums) {
  const label = (nums.length > 1 ? "For missions " : "For mission ") + nums.join(" & ");
  const w = 0.25 + label.length * 0.095;
  const x = M, y = 0.12;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.3, fill: { color: MC[nums[0] - 1] }, rectRadius: 0.15 });
  s.addText(label, { x, y, w, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
}



// ---- Part 2 of the forensics deck: the investigator's toolkit, in mission order ----
const MODE = {
  "We do": { color: BLUE, what: "Class calls out each command. Mentor types." },
  "You do": { color: GREEN, what: "Teams race on the clock. Mentor reveals after." },
};

// ---- the ten forensics missions, in the order the page plays them ----
// Sample output comes from the real tools. Times, names, IPs and flags change on every
// page load, so the slides never show a real flag.
const MS = [
  {
    name: "Case file", level: "Easy", skill: "ls -l  cat", mode: "We do", mins: 5,
    where: "~/mission1/evidence/",
    brief: "Ten files, ten flags. The break-in happened at one exact minute last night, and only the file changed at that minute holds the real flag.",
    ask: ["Where does README.txt say the break-in time is?", "Which ls option shows when a file was last changed?", "How do we check only one line of a long listing?"],
    term: ["$ cd ~/mission1", "$ head -1 README.txt", "The break-in happened at 02:53 last night.", "$ ls -l evidence", "-rw-r--r-- 1 player player 47 Oct  8 17:15 backup.log", "-rw-r--r-- 1 player player 47 Oct  8 13:46 budget.csv", { hi: "-rw-r--r-- 1 player player 47 Oct  8 02:53 memo.txt" }, "...", "$ cat evidence/memo.txt", "Last edited during the break-in.", { hi: "Flag: CYBA{case-...}" }], fs: 12,
    happened: ["README.txt gave this game's break-in minute.", "ls -l showed every file's last-modified time.", "One file changed in the middle of the night: that's the evidence."],
    real: "Investigators build a timeline from file times. It tells them what the intruder touched, and when.",
    stretch: "Sort the files by time with  ls -lt evidence. Which file changed most recently?",
    answer: "cd ~/mission1; ls -l evidence  (match the README time);  cat evidence/<file>",
    notes: "The time is random every load (between 02:00 and 05:59). The decoy files all changed during office hours.\n\nIf a student greps for CYBA they find ten flags: good moment to say 'evidence needs context'.",
  },
  {
    name: "Say cheese", level: "Easy", skill: "strings  |  grep", mode: "We do", mins: 4,
    where: "~/mission2/photo.jpg",
    brief: "An ordinary-looking photo. But pictures carry hidden fields (camera, software, time, author, comments) that viewers never show. Read them.",
    ask: ["What is metadata?", "Why would metadata matter to an investigator?", "Which tool pulls readable text out of any file?"],
    term: ["$ cd ~/mission2", "$ filetype photo.jpg", "photo.jpg: JPEG image data", "$ strings photo.jpg | head -6", "JFIF", "Camera: QuestCam X100", "Software: PhotoFix 2.1", "Taken: 2026-10-08 02:41", "Author: night-shift", { hi: "Comment: CYBA{meta-...}" }], fs: 12.5,
    happened: ["The photo is a real JPEG; viewers only show the picture.", "Its metadata fields sit in the file as plain text.", "strings printed them, including the Comment."],
    real: "Metadata has exposed real people: camera serial numbers, edit software, even GPS location. exiftool reads it all.",
    stretch: "See the fields in hex:  head -c 120 photo.jpg | xxd",
    answer: "strings ~/mission2/photo.jpg | grep Comment",
    notes: "On a full Linux system, exiftool photo.jpg lists metadata neatly. This tiny Linux doesn't have it, so strings does the job.\n\nGood discussion: what metadata is in the photos on your phone? (Usually time, phone model, and often location.)",
  },
  {
    name: "Wrong label", level: "Easy", skill: "filetype  zcat", mode: "You do", mins: 4,
    where: "~/mission3/photos/",
    brief: "Eight holiday photos. One of them isn't a photo at all. Its name lies; its first bytes don't.",
    ask: ["Can anyone rename a file to .jpg?", "Where does a file say what it really is?", "Once we know it's gzip, which tool opens it?"],
    term: ["$ cd ~/mission3", "$ filetype photos/*", "photos/IMG_1041.jpg: JPEG image data", { hi: "photos/IMG_1042.jpg: gzip compressed data" }, "photos/IMG_1043.jpg: JPEG image data", "...", "$ zcat photos/IMG_1042.jpg", "This was never a photo.", { hi: "Flag: CYBA{label-...}" }], fs: 13,
    happened: ["filetype read the first bytes (the magic number) of each file.", "One 'photo' started with 1f 8b: gzip, not JPEG.", "zcat decompressed it, whatever its name said."],
    real: "Attackers rename files to slip past filters. Analysts trust magic bytes, not extensions.",
    stretch: "See the magic bytes yourself:  head -c 4 photos/IMG_1041.jpg | xxd",
    answer: "cd ~/mission3; filetype photos/*;  zcat photos/<the gzip one>",
    notes: "filetype is a small helper that works like the real 'file' command (which this tiny Linux doesn't have). Both read the magic number.",
  },
  {
    name: "Russian dolls", level: "Medium", skill: "tar  filetype  zcat", mode: "You do", mins: 5,
    where: "~/mission4/evidence.tar.gz",
    brief: "The evidence arrived packed: an archive inside an archive inside a compressed file. The inner layers have no file extensions to help.",
    ask: ["What's the difference between tar and gzip?", "After unpacking a layer, how do we know what we got?", "Which command opens each kind of layer?"],
    term: ["$ cd ~/mission4", "$ tar -xzf evidence.tar.gz", "$ filetype box", "box: POSIX tar archive", "$ tar -xf box", "$ filetype inner", "inner: gzip compressed data", "$ zcat inner", "You reached the smallest doll.", { hi: "Flag: CYBA{dolls-...}" }], fs: 13,
    happened: ["tar -xzf unzipped and unpacked the outer layer.", "filetype named each new file: a tar, then a gzip.", "Repeat until there's nothing left to unwrap."],
    real: "Malware and stolen data often travel in nested archives. Unpack, identify, repeat.",
    stretch: "List an archive without unpacking it:  tar -tzf evidence.tar.gz",
    answer: "cd ~/mission4; tar -xzf evidence.tar.gz; tar -xf box; zcat inner",
    notes: "tar bundles files; gzip compresses. .tar.gz is both. -x extract, -z gzip, -f file.",
  },
  {
    name: "Log detective", level: "Medium", skill: "grep  cut  sort  uniq -c", mode: "You do", mins: 5,
    where: "~/mission5/auth.log",
    brief: "Hundreds of login attempts. Someone guessed passwords over and over, then got in. Find the attacker's IP address, then its one successful login.",
    ask: ["What does a password-guessing attack look like in a log?", "Which field is the IP address?", "How do we count lines per IP?"],
    term: ["$ cd ~/mission5", "$ head -2 auth.log", "2026-10-08T02:04:39 sshd: Failed password for guest from 203.0.113.66", "...", "$ grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n | tail -2", "      7 192.0.2.24", { hi: "     40 203.0.113.66" }, "$ grep Accepted auth.log | grep 203.0.113.66", { hi: "... Accepted password for ava from 203.0.113.66 ticket=CYBA{log-...}" }], fs: 11.5,
    happened: ["grep kept the Failed lines; cut kept field 8, the IP.", "sort | uniq -c counted each IP; sort -n put the biggest last.", "The busiest IP's Accepted line was the break-in."],
    real: "This is a brute-force login attack. Analysts spot it exactly this way, and block the IP.",
    stretch: "Which usernames did the attacker try?  grep 203.0.113.66 auth.log | cut -d' ' -f6 | sort | uniq -c",
    answer: "count Failed per IP (cut -f8 | sort | uniq -c);  grep Accepted auth.log | grep <IP>",
    notes: "All IP addresses are from the reserved documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x), so they belong to nobody.\n\nBuild the pipe one stage at a time with the class.",
  },
  {
    name: "Hidden tail", level: "Medium", skill: "strings  tail  base64 -d", mode: "You do", mins: 4,
    where: "~/mission6/cat.jpg",
    brief: "A cat picture that opens normally. But someone hid a message after the picture's end marker, where viewers never look. Steganography.",
    ask: ["Why doesn't a picture viewer show the extra data?", "Where in the file would appended data be?", "The message looks scrambled. What encoding has letters, digits and = at the end?"],
    term: ["$ cd ~/mission6", "$ filetype cat.jpg", "cat.jpg: JPEG image data", "$ strings cat.jpg | tail -2", "JFIF", "SGlkZGVuIGFmdGVyIHRoZSBwaWN0dXJlLgpGbGFn...==", "$ strings cat.jpg | tail -1 | base64 -d", "Hidden after the picture.", { hi: "Flag: CYBA{tail-...}" }], fs: 13,
    happened: ["The picture is real; viewers stop at its end marker (ff d9).", "strings found readable text after it: the last line.", "It was base64, so base64 -d revealed it (Crypto CTF skills!)."],
    real: "Steganography hides data inside innocent files. Tools like binwalk and steghide find and extract it.",
    stretch: "See the end of the picture in hex:  tail -c 120 cat.jpg | xxd",
    answer: "strings ~/mission6/cat.jpg | tail -1 | base64 -d",
    notes: "This is the simplest steganography: appending. Real stego can also hide data inside the pixels, which needs special tools.",
  },
  {
    name: "Tampered", level: "Medium", skill: "sha256sum -c  strings", mode: "You do", mins: 5,
    where: "~/mission7/bin/  manifest.sha256",
    brief: "Ten programs and a list of their fingerprints, taken when the server was clean. One program has been changed since. Find it.",
    ask: ["What happens to a hash if one byte changes?", "How can sha256sum check a whole list at once?", "Every program has a flag inside. Which one is real?"],
    term: ["$ cd ~/mission7", "$ sha256sum -c manifest.sha256", "bin/backup: OK", "bin/cleanup: OK", { hi: "bin/diskcheck: FAILED" }, "bin/logrotate: OK", "...", "sha256sum: WARNING: 1 of 10 computed checksums did NOT match", "$ strings bin/diskcheck | grep CYBA", { hi: "CYBA{tamper-...}" }], fs: 12,
    happened: ["The manifest held each program's known-good SHA-256.", "sha256sum -c re-hashed every file and compared.", "The one that FAILED was tampered; its flag is the real one."],
    real: "File integrity monitoring (Tripwire, AIDE) does exactly this to catch backdoored system programs.",
    stretch: "Why does grep -r CYBA bin/ not solve this mission?",
    answer: "cd ~/mission7; sha256sum -c manifest.sha256 | grep FAILED;  strings bin/<file> | grep CYBA",
    notes: "Every program carries a decoy flag, so the hash comparison is the only way to know which is real.",
  },
  {
    name: "Persistence", level: "Hard", skill: "cat  ls -a  base64 -d", mode: "You do", mins: 6,
    where: "~/mission8/cron/  var/",
    brief: "Intruders want to come back. One of these crontabs runs a script that doesn't belong. Find it, read it, decode what it carries.",
    ask: ["What is a cron job?", "What makes a file 'hidden' in Linux?", "The script's payload is scrambled. Which decoder fits?"],
    term: ["$ cd ~/mission8", "$ cat cron/*", "0 2 * * * /usr/local/bin/backup.sh", { hi: "*/10 * * * * /home/player/mission8/var/.cache/.sys-update.sh" }, "...", "$ ls -a var/.cache", ".  ..  .sys-update.sh", "$ cat var/.cache/.sys-update.sh", "PAYLOAD=\"UGVyc2lzdGVuY2UgZm91bmQu...\"", "$ echo UGVyc2lz... | base64 -d", { hi: "Flag: CYBA{cron-...}" }], fs: 11.5,
    happened: ["One cron line ran a script every 10 minutes from a hidden folder.", "ls -a found the hidden script; cat showed its base64 payload.", "base64 -d revealed what it carried."],
    real: "Persistence (cron jobs, startup scripts, services) is one of the first things responders hunt after a break-in.",
    stretch: "Read the schedule: what does */10 * * * * mean? And 0 2 * * *?",
    answer: "cat cron/*;  cat var/.cache/.sys-update.sh;  echo <PAYLOAD> | base64 -d",
    notes: "The script is inert: it only sets a variable and exits. Nothing in this CTF runs anything harmful.\n\nCron fields: minute, hour, day of month, month, day of week.",
  },
  {
    name: "Leaked in pieces", level: "Hard", skill: "grep · cut · sort · xxd", mode: "You do", mins: 6,
    where: "~/mission9/capture.txt",
    brief: "A packet capture, listed the way Wireshark shows it. One host kept requesting /pixel.gif with a seq number and a chunk of hex. Put the chunks in order and decode them.",
    ask: ["How do we keep only the suspicious requests?", "The chunks arrived out of order. How do we fix that?", "Hex again: which tool turns it back into text?"],
    term: ["$ cd ~/mission9", "$ grep seq= capture.txt | head -2", " 90 218.2 203.0.113.66 192.0.2.80 HTTP 412 GET /pixel.gif?seq=07&d=70696563", " 91 221.0 203.0.113.66 192.0.2.80 HTTP 412 GET /pixel.gif?seq=03&d=6c65642e", "$ grep seq= capture.txt | cut -d'?' -f2 | cut -d' ' -f1 \\", "  | sort | cut -d'=' -f3 | tr -d '\\n' | xxd -r -p", "Reassembled.", { hi: "Flag: CYBA{pieces-...}" }], fs: 11.5,
    happened: ["grep kept one host's packets; two cuts kept seq=..&d=...", "sort put them in seq order; cut kept the hex; tr joined it.", "xxd -r -p turned the hex back into the stolen text."],
    real: "Data theft often hides in ordinary-looking traffic, split into small pieces. Wireshark's 'Follow stream' does this reassembly for you.",
    stretch: "How many pieces were there? How many bytes per piece?",
    answer: "grep seq= capture.txt | cut -d'?' -f2 | cut -d' ' -f1 | sort | cut -d= -f3 | tr -d '\\n' | xxd -r -p",
    notes: "Build the pipeline one stage at a time on the projector. Each stage's output should make sense before adding the next.",
  },
  {
    name: "Case closed", level: "Very Hard", skill: "grep · filetype · zcat", mode: "You do", mins: 8,
    where: "~/mission10/auth.log  homes/",
    brief: "Everything at once. Find whose account was broken into, find the file in their folder whose label lies, unpack it and decode what's inside.",
    ask: ["Which mission taught us to find the attacker in auth.log?", "Which one taught us to spot a file whose label lies?", "What layers might be inside?"],
    term: ["$ cd ~/mission10", "$ grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n | tail -1", "     38 198.51.100.201", "$ grep Accepted auth.log | grep 198.51.100.201 | cut -d' ' -f6", { hi: "liam" }, "$ filetype homes/liam/*", { hi: "homes/liam/notes.txt: gzip compressed data" }, "$ zcat homes/liam/notes.txt | base64 -d", "Case closed.", { hi: "Flag: CYBA{closed-...}" }], fs: 11.5,
    happened: ["Counting Failed lines found the attacker; Accepted named the user.", "filetype found the file in their folder that wasn't what it claimed.", "zcat, then base64 -d, opened the stolen evidence."],
    real: "A real investigation is exactly this chain: logs lead to an account, the account leads to files, files lead to proof.",
    stretch: "Write the whole case as three sentences: who, how, what was taken.",
    answer: "attacker IP as M5; Accepted line field 6 = user;  filetype homes/<user>/*;  zcat <file> | base64 -d",
    notes: "The user, the file and the IP change every load. If teams are stuck, point them back at Missions 5 and 3.",
  },
];

async function build() {
  let s;
  const P = "$ ";

  // ===========================================================================
  // OPENING
  // ===========================================================================
  section("Opening");
  s = darkSlide(
    "Welcome the class and introduce the mentors: name, what you do, and one sentence on a time you had to figure out what happened on a computer.\n\n" +
    "Promise: 'In the next 90 minutes you will learn how investigators read digital evidence, then solve a break-in for 2,700 points against the clock.'\n\n" +
    "Before class: the Forensics CTF link is written on the 'Open the CTF' slide in the appendix, and you have watched it reach 'Ready' on a student Chromebook on the school network.");
  s.addText("CyberQuest", { x: M, y: 1.35, w: 6.6, h: 1.3, fontFace: HEAD, fontSize: 72, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Forensics CTF: read the evidence, then compete.", { x: M, y: 2.75, w: 6.3, h: 1.1, fontFace: BODY, fontSize: 28, color: T_OUT, margin: 0, isTextBox: true });
  chip(s, "simulated CTF competition", M, 4.15, 3.0, AMBER, INK, 15);
  s.addText("CyberQuest Academy mentorship session", { x: M, y: 4.85, w: 6, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: WHITE, margin: 0, isTextBox: true });
  trail(s, M, 5.85, 6.0, N + 1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 1.2, w: 5.43, h: 4.95, fill: { color: "162238" }, rectRadius: 0.12, line: { color: "2B3B5C", width: 1 } });
  ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: 7.55 + i * 0.24, y: 1.4, w: 0.14, h: 0.14, fill: { color: c } }));
  s.addText([
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "cat incident.txt", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "Server breached overnight.", options: { color: T_OUT, breakLine: true } },
    { text: "Logs, files and images kept.", options: { color: T_OUT, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "./start-investigation", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "10 clues, plus a warm-up", options: { color: T_OUT, breakLine: true } },
    { text: "2,700 points up for grabs", options: { color: T_OUT, breakLine: true } },
    { text: "Good luck, detective.", options: { color: AMBER, bold: true } },
  ], { x: 7.65, y: 1.85, w: 4.8, h: 4.1, fontFace: MONO, fontSize: 18, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 3 });

  // ---- run of show ----
  s = newSlide("Today's mission, in four parts",
    "Walk the timeline so students know the competition is coming and the theory is short.\n\n" +
    "Timing for 90 minutes: opening 3 min, Part 1 Forensics fundamentals 10 min, Part 2 the investigator's toolkit 25 min (open the Forensics CTF at the start: see the mentor appendix), Part 3 compete 42 min, Part 4 debrief 10 min.\n\n" +
    "Students who played the Linux or Crypto CTF will recognise the page and several tools (grep, cut, sort, base64, xxd). Nobody needs to have played them first.");
  const plan = [["10", "Forensics 101", "What investigators do, and where evidence hides.", MC[0]], ["25", "Toolkit", "Open the CTF, then one tool per kind of evidence, in mission order.", MC[2]], ["42", "Compete", "Ten clues, 2,700 points, one clock. Easiest first.", MC[3]], ["10", "Debrief", "Pro tools, the real competition, and where this leads.", MC[4]]];
  plan.forEach(([min, name, what, color], i) => {
    const x = M + i * 3.07;
    card(s, x, 1.7, 2.87, 3.9);
    s.addText(min, { x: x + 0.25, y: 1.9, w: 1.9, h: 1.15, fontFace: HEAD, fontSize: 58, bold: true, color, margin: 0, isTextBox: true });
    text(s, "minutes", x + 0.25, 3.05, 1.9, 0.35, { fontSize: 14, color: MUTED });
    text(s, name, x + 0.25, 3.55, 2.4, 0.5, { fontFace: HEAD, fontSize: 21, bold: true });
    text(s, what, x + 0.25, 4.1, 2.4, 1.4, { fontSize: 14.5, color: MUTED });
  });
  card(s, M, 5.85, W - 2 * M, 0.75, "FFF4DC");
  text(s, [{ text: "The deal: ", options: { bold: true } }, { text: "every clue can be found with a short command and a good question. Investigators ask before they type." }], M + 0.3, 5.85, W - 2 * M - 0.6, 0.75, { valign: "middle", fontSize: 17 });

  // ---- what is a forensics CTF ----
  s = newSlide("What is a forensics CTF?",
    "A capture the flag, or CTF, is a puzzle competition for security skills. In a forensics CTF, every flag is hidden in evidence: a log, a file that lies about its type, an archive, a picture, a memory dump.\n\n" +
    "Read the flag anatomy out loud. Every flag starts with CYBA and has its secret between curly braces.\n\n" +
    "Stress permission: investigating evidence you were given is the job. Snooping on systems that aren't yours is a crime.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "CYBA", options: { color: "7FB2FF", bold: true } }, { text: "{", options: { color: AMBER, bold: true } }, { text: "case-4c8c640b", options: { color: T_PROMPT, bold: true } }, { text: "}", options: { color: AMBER, bold: true } }],
    { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 40, align: "center", valign: "middle", margin: 0, isTextBox: true });
  [["Evidence", "C07A00", "What you're given", "Logs, files, images, archives and a memory dump."], ["Investigate", "2459D8", "Your job", "Ask what happened, then find the proof."], ["CYBA{...}", "17875A", "The proof", "Each flag is a clue you dug out of the evidence."]].forEach(([tok, color, head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 3.45, 3.9, 1.65);
    mono(s, tok, x + 0.25, 3.6, 3.4, 0.4, { fontSize: 19, color });
    text(s, head, x + 0.25, 4.05, 3.4, 0.35, { fontSize: 16, bold: true });
    text(s, body, x + 0.25, 4.42, 3.45, 0.6, { fontSize: 14, color: MUTED });
  });
  const round = [["Read", "the case"], ["Investigate", "the evidence"], ["Submit", "the whole flag"], ["Score", "points on the board"]];
  round.forEach(([a, b], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.45, w: 2.6, h: 1.0, fill: { color: MC[i + 1] }, rectRadius: 0.1 });
    s.addText([{ text: a, options: { bold: true, fontSize: 20, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x, y: 5.45, w: 2.6, h: 1.0, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addText(">", { x: x + 2.6, y: 5.45, w: 0.47, h: 1.0, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });

  section("Part 1 · Forensics fundamentals");
  divider(1, "Forensics fundamentals", "What investigators do, where evidence hides, and why you never trust a file's name.", MC[0], "ls -l --full-time evidence/",
    "Section break. Ask: 'If someone broke into your phone, how would you know? What would they leave behind?' Collect answers: those are the clues forensics looks for.");

  // ---- what investigators do ----
  s = newSlide("What digital investigators do",
    "Digital forensics answers four questions after an incident: what happened, when, how, and who (or at least from where).\n\n" +
    "Walk the five steps. Preserve: make a copy and fingerprint it, so nobody can say the evidence changed. Collect: logs, disks, memory, network data. Examine: pull out what matters. Analyze: build a timeline and connect the dots. Report: explain it so a manager, a lawyer or a court can follow.\n\n" +
    "Today students do mostly Examine and Analyze. Mission 7 is a taste of Preserve: comparing fingerprints.");
  const steps = [["Preserve", "Copy the evidence and fingerprint it (hash).", fa.FaShieldHalved, MC[0]], ["Collect", "Logs, files, images, memory, traffic.", fa.FaBoxArchive, MC[1]], ["Examine", "Pull out the readable, the hidden, the odd.", fa.FaMagnifyingGlass, MC[2]], ["Analyze", "Build a timeline. Connect the dots.", fa.FaTimeline, MC[3]], ["Report", "Explain what happened, with proof.", fa.FaFileLines, MC[4]]];
  for (let i = 0; i < steps.length; i++) {
    const [head, body, Icon, color] = steps[i];
    const x = M + i * 2.48, w = 2.2;
    card(s, x, 1.75, w, 3.5);
    await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true, align: "center" });
    text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  card(s, M, 5.6, W - 2 * M, 0.9, "FFF4DC");
  text(s, [{ text: "Four questions: ", options: { bold: true } }, { text: "What happened? When? How? From where? Every mission today answers one of them." }], M + 0.3, 5.6, W - 2 * M - 0.6, 0.9, { valign: "middle", fontSize: 17 });

  // ---- evidence is everywhere ----
  s = newSlide("Evidence is everywhere",
    "Computers write things down constantly. Every login, every web request, every file change leaves a trace.\n\n" +
    "Walk the six cards; each one is a mission today. Ask: 'Which of these would an intruder try to delete?' (The logs! That's why real systems copy logs somewhere else.)");
  const ev = [[fa.FaClock, "File times", "Every file remembers when it last changed.", "Mission 1", MC[0]], [fa.FaCamera, "Metadata", "Photos and documents carry hidden fields.", "Mission 2", MC[1]], [fa.FaImage, "Files and images", "Names can lie; first bytes can't. Data can hide inside.", "Missions 3, 6", MC[2]], [fa.FaBoxArchive, "Archives", "Evidence arrives packed, layers inside layers.", "Mission 4", MC[3]], [fa.FaNetworkWired, "Logs and traffic", "Every login and every packet leaves a line.", "Missions 5, 9", MC[4]], [fa.FaGears, "System settings", "Scheduled tasks and programs that changed.", "Missions 7, 8", MC[5]]];
  for (let i = 0; i < ev.length; i++) {
    const [Icon, head, body, which, color] = ev[i];
    const x = M + (i % 3) * 4.11, y = 1.65 + Math.floor(i / 3) * 2.45;
    card(s, x, y, 3.9, 2.25);
    await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.8, color);
    text(s, head, x + 1.3, y + 0.3, 2.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, valign: "middle" });
    text(s, which, x + 1.3, y + 0.78, 2.4, 0.35, { fontSize: 13, bold: true, color });
    text(s, body, x + 0.3, y + 1.3, 3.35, 0.85, { fontSize: 15, color: MUTED });
  }

  // ---- three questions for any file ----
  s = newSlide("Three questions for any file",
    "Teach these three questions; students will ask them in every mission.\n\n" +
    "When? ls -l shows the last-modified time. What is it really? The first bytes, the magic number, say the real type, whatever the name says. Has it changed? A SHA-256 hash is a fingerprint: change one byte and the hash changes completely.\n\n" +
    "The hash is also how investigators prove evidence wasn't altered: hash it when you collect it, hash it again in court.", "filetype ~/*");
  const q3 = [["When?", "ls -l", "Last-modified time", "-rw-r--r-- ... Oct  8 02:53 memo.txt", MC[0]], ["What is it really?", "filetype  ·  head -c 4 | xxd", "The magic number", "ff d8 ff = JPEG    1f 8b = gzip", MC[2]], ["Has it changed?", "sha256sum", "A fingerprint", "1 byte changed = whole hash changes", MC[4]]];
  q3.forEach(([q, cmd, what, sample, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.65, 3.9, 4.85);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 3.9, h: 0.12, fill: { color } });
    text(s, q, x + 0.3, 1.95, 3.3, 0.6, { fontFace: HEAD, fontSize: 26, bold: true, color });
    text(s, what, x + 0.3, 2.6, 3.3, 0.45, { fontSize: 17, bold: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 3.25, w: 3.3, h: 0.55, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: x + 0.3, y: 3.25, w: 3.3, h: 0.55, fontFace: MONO, fontSize: 14, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    mono(s, sample, x + 0.3, 4.1, 3.35, 1.0, { fontSize: 13, color: INK, bold: false });
  });

  // ---- rules of evidence ----
  s = newSlide("How investigators work",
    "Four habits that separate an investigation from poking around.\n\n" +
    "Work on copies, never the original. Hash the evidence first. Write down every step (your notes are part of the report). Question everything: a file name, a log line, even a timestamp can be faked.\n\n" +
    "In the CTF, the 'notes' habit pays off: teams that write down the IP, the user and the file name solve Mission 10 much faster.");
  numbered(s, [
    [{ text: "Work on a copy. ", options: { bold: true } }, { text: "The original stays untouched, so nobody can say you changed it." }],
    [{ text: "Fingerprint it first. ", options: { bold: true } }, { text: "A hash taken now proves later that nothing changed." }],
    [{ text: "Write down every step. ", options: { bold: true } }, { text: "Your notes become the report. Note IPs, users, times." }],
    [{ text: "Trust nothing. ", options: { bold: true } }, { text: "Names, extensions and even timestamps can be faked." }],
  ], M, 1.8, 6.4, 1.15, BLUE, 18);
  term(s, 7.3, 1.6, 5.43, 4.95, ["# case notes, 08 Oct", "02:04  Failed logins start", "       from 203.0.113.66", "02:26  Accepted: user ava", "02:53  memo.txt changed", "03:01  pixel.gif requests", "       with hex chunks", "Next:  check cron for", "       persistence"], { fontSize: 15, title: "notes.txt" });

  // ---- competition map ----
  s = newSlide("What you'll see at the competition",
    "The CYBERQUEST competition has seven categories: Reverse Engineering, Web, PWN, Education & Awareness, Forensics, OSINT and Crypto. Its skills page also stresses command-line navigation and SSH.\n\n" +
    "Forensics is today, and its listed key concepts are all here: file formats and signatures (Missions 3, 4, 10), metadata (Mission 2), steganography (Mission 6), network traffic (Mission 9) and hex (xxd). Its listed tools: strings (today), plus exiftool, binwalk, steghide and Wireshark (on the pro-tools slide).\n\n" +
    "Be honest about the rest: Web and PWN need other tools and other sessions.");
  const cats = [["Forensics", "Today: signatures, metadata, stego, logs, packets", GREEN, true], ["Crypto", "The Crypto CTF: encodings, ciphers, hashes", GREEN, true], ["Reverse engineering", "strings, xxd and file signatures are step one", AMBER, false], ["Web", "Coming: the Web CTF (OWASP Top 10)", MUTED, false], ["Education & Awareness", "Trivia: phishing, passwords, cyber ethics", AMBER, false], ["PWN", "Linux permissions (Linux CTF) are the start", AMBER, false], ["OSINT", "Metadata (Mission 2) is part of it", AMBER, false], ["Command line + SSH", "The Linux CTF, and every command today", GREEN, true]];
  cats.forEach(([name, how, color, done], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.24;
    card(s, x, y, 5.96, 1.1);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.12, h: 1.1, fill: { color } });
    text(s, name, x + 0.35, y + 0.1, 3.4, 0.45, { fontSize: 18, bold: true });
    text(s, how, x + 0.35, y + 0.55, 5.3, 0.45, { fontSize: 14, color: MUTED });
    chip(s, done ? "practised" : color === AMBER ? "first steps" : "later", x + 4.25, y + 0.14, 1.5, done ? "E2F5EC" : color === AMBER ? "FFF4DE" : "E4EAF3", done ? "12704B" : color === AMBER ? "9A5B00" : MUTED, 11.5);
  });

  // ---- anatomy of the page ----
  s = newSlide("Anatomy of the Forensics CTF page",
    "A real screenshot from the middle of a game: warm-up and three flags captured, Mission 4 (Russian dolls) open, with the layers being unpacked in the terminal.\n\n" +
    "Walk the eight parts. It is the same page as the Linux and Crypto CTFs. '← All CTFs' goes back to the home page (it starts a new game, so don't click it mid-race).\n\n" +
    "The most common problem in class is typing before clicking inside the terminal. Say it twice.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M - 0.05, y: 1.6, w: 7.3, h: 4.34, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img-forensics", "page.png"), x: M, y: 1.65, w: 7.2, h: 4.235 });
  const k = 7.2 / 1360, px = (x) => M + x * k, py = (y) => 1.65 + y * k;
  const P8 = JSON.parse(fs.readFileSync(path.join(__dirname, "img-forensics", "pins.json"), "utf8"));
  const sorted = [[...P8.track, MC[1]], [...P8.points, AMBER], [...P8.clock, BLUE], [...P8.stepper, MC[0]], [...P8.level, MC[4]], [...P8.copy, MC[3]], [...P8.terminal, "56657E"], [...P8.next, MC[2]]];
  sorted.forEach(([x, y, color], i) => {
    s.addShape(pres.shapes.OVAL, { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fill: { color }, line: { color: WHITE, width: 2 } });
    s.addText(String(i + 1), { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "Mid-game: warm-up and missions 1 to 3 captured, Mission 4 open.", M, 6.1, 7, 0.35, { fontSize: 12, color: MUTED });
  const parts8 = [["Progress track", "One coloured bar lights up per flag.", MC[1]], ["Points", "Your score, out of 2,750 with the warm-up.", AMBER], ["Clock", "Starts at Mission 1 and counts up.", BLUE], ["Stepper", "0 is the warm-up; a green check per flag.", MC[0]], ["Level and points", "Easy 100 up to Very Hard 800.", MC[4]], ["Copy buttons", "Copy a starting command, then paste it.", MC[3]], ["Terminal", "Click inside it before you type.", "56657E"], ["Next mission", "Unlocks when the flag is captured.", MC[2]]];
  parts8.forEach(([head, body, color], i) => {
    const y = 1.62 + i * 0.6;
    s.addShape(pres.shapes.OVAL, { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fill: { color } });
    s.addText(String(i + 1), { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, [{ text: head + "  ", options: { bold: true, fontSize: 15 } }, { text: body, options: { fontSize: 13, color: MUTED } }], 8.6, y, 4.15, 0.5, { valign: "middle" });
  });

  // ===========================================================================
  // PART 2: THE CODEBREAKER'S TOOLKIT
  // ===========================================================================
  section("Part 2 · Investigator's toolkit");
  divider(2, "The investigator's toolkit", "Open the Forensics CTF, then one tool per kind of evidence, in the order the missions need them. Every slide has a Try it.", MC[2], "strings --help   # every tool explains itself",
    "Section break. Open the Forensics CTF now (mentor appendix: 'Open the CTF'), so every device is booted for the Try it pills.\n\nDemo every command live on the projector. Then give the room 30 seconds to type the green Try it command themselves.\n\nNone of the Try it commands touch the mission folders, so nothing gets spoiled.");

  // ---- timestamps ----
  s = newSlide("When? File times with ls -l",
    "ls -l lists files in long form: permissions, owner, size, and the last-modified time.\n\n" +
    "Point at the time column. Files changed recently show a time; old files show a year instead.\n\n" +
    "ls -lt sorts newest first: a quick timeline. Mission 1 needs exactly this.", "ls -l ~");
  forMission(s, [1]);
  cmdRow(s, "ls -l", "long listing, with times", M, 1.75, 6.2, 2.4);
  cmdRow(s, "ls -lt", "newest first: a timeline", M, 2.4, 6.2, 2.4);
  cmdRow(s, "| grep 02:53", "keep the lines with that time", M, 3.05, 6.2, 2.4);
  card(s, M, 3.9, 6.2, 2.6, "FFF4DC");
  text(s, "Reading a long listing", M + 0.3, 4.05, 5.6, 0.4, { fontSize: 17, bold: true });
  numbered(s, ["Permissions and owner: who can touch it.", "Size in bytes.", "Last-modified date and time: when."], M + 0.3, 4.6, 5.6, 0.6, MC[0], 15);
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ ls -l", "-rw-r--r-- 1 player player 515", "      Oct  8 09:12 report.txt", { hi: "-rw-r--r-- 1 player player  47" }, { hi: "      Oct  8 02:53 memo.txt" }, "-rw-r--r-- 1 player player 210", "      Oct  8 14:40 todo.txt", "# 02:53? Nobody works then."], { fontSize: 14, title: "player@quest" });

  // ---- strings ----
  s = newSlide("Metadata and readable text: strings",
    "Binary files (pictures, programs, memory dumps) are mostly bytes that aren't letters, so cat shows garbage and can even scramble the terminal.\n\n" +
    "strings prints only runs of 4 or more readable characters. Metadata fields (camera, software, author, comments), file paths and messages leak out.\n\n" +
    "The pro tool for metadata is exiftool, which lists every field neatly. On the competition's Kali Linux, try exiftool photo.jpg.", "strings ~/README.txt");
  forMission(s, [2, 6, 7]);
  cmdRow(s, "strings FILE", "print the readable text", M, 1.75, 6.2, 2.6);
  cmdRow(s, "| grep CYBA", "search inside it", M, 2.4, 6.2, 2.6);
  cmdRow(s, "| tail -1", "just the last readable line", M, 3.05, 6.2, 2.6);
  card(s, M, 3.9, 6.2, 2.6, "FFF4DC");
  text(s, [{ text: "Don't cat a binary. ", options: { bold: true } }, { text: "It prints garbage and can confuse the terminal. If that happens, type " }, { text: "reset", options: { fontFace: MONO, bold: true } }, { text: " or " }, { text: "clear", options: { fontFace: MONO, bold: true } }, { text: "." }], M + 0.3, 4.0, 5.6, 2.4, { fontSize: 16, valign: "middle" });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ cat photo.jpg", "\u00ff\u00d8\u00ff\u00e0 JFIF \u0081\u00e7\u00c4 ... garbage", "$ strings photo.jpg | head -5", "JFIF", "Camera: QuestCam X100", "Software: PhotoFix 2.1", "Author: night-shift", "# exiftool shows these neatly"], { fontSize: 14, title: "player@quest" });

  // ---- magic bytes ----
  s = newSlide("What is it really? Magic bytes",
    "A file's extension is just part of its name; anyone can rename a file. The first few bytes, the magic number, say what the file really is.\n\n" +
    "filetype is a helper in this CTF that works like Linux's file command: it reads the magic number and names the type. You can see the bytes yourself with head -c 4 | xxd.\n\n" +
    "Learn three: ff d8 ff is JPEG, 1f 8b is gzip, 25 50 44 46 is '%PDF'.", "filetype ~/*");
  forMission(s, [3, 4, 10]);
  const mb = [["ff d8 ff", "JPEG image"], ["89 50 4e 47", "PNG image (.PNG)"], ["1f 8b", "gzip compressed"], ["25 50 44 46", "PDF (%PDF)"], ["50 4b 03 04", "zip (PK)"], ["ustar @ 257", "tar archive"]];
  mb.forEach(([hx, what], i) => {
    const x = M + (i % 2) * 3.15, y = 1.75 + Math.floor(i / 2) * 1.05;
    card(s, x, y, 3.0, 0.9);
    mono(s, hx, x + 0.2, y, 1.6, 0.9, { fontSize: 14, color: MC[2], valign: "middle" });
    text(s, what, x + 1.75, y, 1.2, 0.9, { fontSize: 13, color: MUTED, valign: "middle" });
  });
  cmdRow(s, "filetype FILE", "name the real type", M, 5.05, 6.2, 2.6);
  cmdRow(s, "head -c 4 FILE | xxd", "see the bytes yourself", M, 5.7, 6.2, 2.6);
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ filetype photos/*", "IMG_1041.jpg: JPEG image data", { hi: "IMG_1042.jpg: gzip compressed data" }, "$ head -c 4 IMG_1041.jpg | xxd", "00000000: ffd8 ffe0   ....", "$ head -c 4 IMG_1042.jpg | xxd", { hi: "00000000: 1f8b 0800   ...." }], { fontSize: 14, title: "player@quest" });

  // ---- archives ----
  s = newSlide("Unwrapping archives: tar and zcat",
    "tar bundles many files into one. gzip squeezes a file smaller. A .tar.gz is both: a bundle, then squeezed.\n\n" +
    "tar -xzf unpacks a .tar.gz; tar -xf unpacks a plain tar; zcat prints what's inside a gzip file. tar -tf lists without unpacking.\n\n" +
    "The habit for Mission 4: unpack one layer, ask filetype what you got, repeat.", "tar --help");
  forMission(s, [4, 10]);
  cmdRow(s, "tar -xzf F.tar.gz", "unpack a squeezed bundle", M, 1.75, 6.2, 2.6);
  cmdRow(s, "tar -xf F", "unpack a plain bundle", M, 2.4, 6.2, 2.6);
  cmdRow(s, "tar -tf F", "list what's inside", M, 3.05, 6.2, 2.6);
  cmdRow(s, "zcat F", "print a gzip file's contents", M, 3.7, 6.2, 2.6);
  const dolls = [["evidence.tar.gz", MC[3]], ["box (tar)", MC[4]], ["inner (gzip)", MC[5]], ["flag", GREEN]];
  dolls.forEach(([name, color], i) => {
    const x = M + i * 1.58;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.75, w: 1.42, h: 1.0, fill: { color }, rectRadius: 0.1 });
    s.addText(name, { x, y: 4.75, w: 1.42, h: 1.0, fontFace: MONO, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "x: extract   t: list   z: gzip   f: the file", M, 5.95, 6.2, 0.4, { fontSize: 13, color: MUTED });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ tar -tzf evidence.tar.gz", "box", "$ tar -xzf evidence.tar.gz", "$ filetype box", { hi: "box: POSIX tar archive" }, "$ tar -xf box", "$ filetype inner", { hi: "inner: gzip compressed data" }], { fontSize: 14, title: "player@quest" });

  // ---- logs ----
  s = newSlide("Reading logs: grep, cut, sort, uniq -c",
    "Logs are text, one event per line, so the Linux tools from the Linux CTF are an investigator's best friends.\n\n" +
    "The counting pipeline: grep the lines you care about, cut out one field, sort them so repeats sit together, uniq -c counts each, sort -n puts the biggest last.\n\n" +
    "Build it one stage at a time, and look at the output after each step. This pipeline solves Missions 5 and 10 and is the same idea as Splunk or Wireshark statistics.", "cut -d: -f1 /etc/passwd");
  forMission(s, [5, 9, 10]);
  const pipe = [["grep Failed", "keep the failures"], ["cut -d' ' -f8", "keep field 8: the IP"], ["sort", "line up repeats"], ["uniq -c", "count each one"], ["sort -n | tail", "biggest last"]];
  pipe.forEach(([cmd, what], i) => {
    const x = M + i * 2.48;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 2.25, h: 1.25, fill: { color: MC[i + 1] }, rectRadius: 0.1 });
    s.addText([{ text: cmd, options: { fontFace: MONO, bold: true, fontSize: 14, breakLine: true } }, { text: what, options: { fontSize: 13 } }], { x, y: 1.75, w: 2.25, h: 1.25, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 4) s.addText("|", { x: x + 2.25, y: 1.75, w: 0.23, h: 1.25, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  term(s, M, 3.35, W - 2 * M, 3.15, ["$ head -1 auth.log", "2026-10-08T02:04:39 sshd: Failed password for guest from 203.0.113.66", "#  field 1             2     3      4        5   6     7    8", "$ grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n | tail -2", "      7 192.0.2.24", { hi: "     40 203.0.113.66" }], { fontSize: 14, title: "player@quest" });

  // ---- steganography ----
  s = newSlide("Hidden in plain sight",
    "Cryptography scrambles a message. Steganography hides that there is a message at all.\n\n" +
    "The simplest trick: append data after the end of a picture. Picture viewers stop at the end marker (ff d9 for JPEG), so the picture looks normal, but the bytes are still in the file.\n\n" +
    "Real stego can also hide data in the pixels themselves; tools like steghide, zsteg and binwalk find it. Today: strings and tail.", "xxd ~/README.txt");
  forMission(s, [6]);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.8, w: 4.2, h: 1.3, fill: { color: MC[2] }, rectRadius: 0.08 });
  s.addText([{ text: "ff d8 ff ...", options: { fontFace: MONO, bold: true, breakLine: true } }, { text: "the picture" }], { x: M, y: 1.8, w: 4.2, h: 1.3, fontFace: BODY, fontSize: 16, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 4.3, y: 1.8, w: 0.6, h: 1.3, fill: { color: INK }, rectRadius: 0.08 });
  s.addText("ff d9", { x: M + 4.3, y: 1.8, w: 0.6, h: 1.3, fontFace: MONO, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 5.0, y: 1.8, w: 1.2, h: 1.3, fill: { color: AMBER }, rectRadius: 0.08 });
  s.addText("hidden", { x: M + 5.0, y: 1.8, w: 1.2, h: 1.3, fontFace: BODY, fontSize: 14, bold: true, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true });
  text(s, "Viewers stop at the end marker. The hidden part never shows.", M, 3.2, 6.2, 0.4, { fontSize: 13, color: MUTED });
  cmdRow(s, "strings F | tail -2", "readable text near the end", M, 3.85, 6.2, 2.6);
  cmdRow(s, "tail -c 120 F | xxd", "the last bytes, in hex", M, 4.5, 6.2, 2.6);
  card(s, M, 5.3, 6.2, 1.2, "FFF4DC");
  text(s, [{ text: "Crypto vs stego: ", options: { bold: true } }, { text: "crypto hides what a message says. Stego hides that it exists. CTFs love combining them." }], M + 0.3, 5.3, 5.6, 1.2, { fontSize: 15, valign: "middle" });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ filetype cat.jpg", "cat.jpg: JPEG image data", "$ strings cat.jpg | tail -2", "JFIF", { hi: "SGlkZGVuIGFmdGVyIHRo...==" }, "# letters, digits, =  ...", "# looks like base64!"], { fontSize: 14, title: "player@quest" });

  // ---- integrity ----
  s = newSlide("Has it changed? Fingerprints",
    "A SHA-256 hash is a fingerprint of a file. Change one byte and the hash changes completely.\n\n" +
    "Defenders record the hashes of important programs while the system is clean (a manifest). Later, sha256sum -c re-hashes every file in the list and reports OK or FAILED.\n\n" +
    "This is what file-integrity tools like Tripwire and AIDE do, and it's how investigators prove evidence wasn't altered.", "sha256sum ~/README.txt");
  forMission(s, [7]);
  cmdRow(s, "sha256sum FILE", "fingerprint a file", M, 1.75, 6.2, 2.6);
  cmdRow(s, "sha256sum -c LIST", "check every file in a list", M, 2.4, 6.2, 2.6);
  cmdRow(s, "| grep FAILED", "show only the changed ones", M, 3.05, 6.2, 2.6);
  card(s, M, 3.9, 6.2, 2.6, "FFF4DC");
  text(s, "A manifest line", M + 0.3, 4.05, 5.6, 0.4, { fontSize: 17, bold: true });
  mono(s, "9c1f04e2a7...  bin/backup", M + 0.3, 4.55, 5.6, 0.4, { fontSize: 15 });
  text(s, "The fingerprint, two spaces, then the file. Taken when the server was clean.", M + 0.3, 5.05, 5.6, 1.2, { fontSize: 15, color: MUTED });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ sha256sum -c manifest.sha256", "bin/backup: OK", "bin/cleanup: OK", { hi: "bin/diskcheck: FAILED" }, "bin/logrotate: OK", "...", "WARNING: 1 of 10 computed", "checksums did NOT match"], { fontSize: 14, title: "player@quest" });

  // ---- persistence ----
  s = newSlide("How intruders come back: cron jobs",
    "Once in, an intruder wants to come back. Persistence means leaving something that runs again on its own. A favourite on Linux: a cron job.\n\n" +
    "A crontab line is five time fields (minute, hour, day of month, month, day of week) and a command. */10 in the minute field means every 10 minutes.\n\n" +
    "Look for commands in odd places: hidden folders (names starting with a dot), /tmp, a user's home. ls -a shows hidden files.", "ls -a ~");
  forMission(s, [8]);
  const cronf = [["*/10", "minute", "every 10"], ["*", "hour", "every"], ["*", "day", "every"], ["*", "month", "every"], ["*", "weekday", "every"]];
  cronf.forEach(([v, name, mean], i) => {
    const x = M + i * 1.25;
    card(s, x, 1.75, 1.15, 1.45);
    mono(s, v, x, 1.85, 1.15, 0.5, { fontSize: 20, color: MC[8], align: "center" });
    text(s, name, x, 2.4, 1.15, 0.35, { fontSize: 12, bold: true, align: "center" });
    text(s, mean, x, 2.75, 1.15, 0.35, { fontSize: 11, color: MUTED, align: "center" });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 3.35, w: 6.2, h: 0.6, fill: { color: TERM }, rectRadius: 0.08 });
  s.addText("/home/player/.../.cache/.sys-update.sh", { x: M + 0.2, y: 3.35, w: 5.9, h: 0.6, fontFace: MONO, fontSize: 13, bold: true, color: AMBER, valign: "middle", margin: 0, isTextBox: true });
  text(s, "...then the command it runs. A hidden folder? Suspicious.", M, 4.0, 6.2, 0.4, { fontSize: 13, color: MUTED });
  cmdRow(s, "cat cron/*", "read every crontab", M, 4.6, 6.2, 2.6);
  cmdRow(s, "ls -a DIR", "show hidden (dot) files", M, 5.25, 6.2, 2.6);
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ cat cron/*", "0 2 * * * /usr/local/bin/backup.sh", "30 3 * * 0 /usr/sbin/logrotate", { hi: "*/10 * * * * .../.sys-update.sh" }, "15 12 * * * /home/noah/bin/sync", "# which line doesn't belong?"], { fontSize: 14, title: "player@quest" });

  // ---- reassembly ----
  s = newSlide("Reading a packet capture",
    "A packet capture (a .pcap file) records the network traffic itself. Wireshark shows it as one line per packet: number, time, source, destination, protocol, length and a summary. capture.txt is that list view, exported as text.\n\n" +
    "Mission 9's host smuggled data out in tiny pieces, each with a sequence number. To rebuild it: keep those packets, cut down to the parameters, sort by seq, keep the hex, join it, decode. In Wireshark you'd filter on the URL and follow the stream.\n\n" +
    "tr -d '\\n' deletes newlines, joining lines together. xxd -r -p turns hex into text (the Crypto CTF's Mission 2).", "echo 48690a | xxd -r -p");
  forMission(s, [9]);
  term(s, M, 1.65, W - 2 * M, 1.25, ["   91 221.089240 203.0.113.66  192.0.2.80  HTTP  412 GET /pixel.gif?seq=03&d=6c65642e HTTP/1.1", "#  No.  time      source        destination protocol  info: the request and its ?parameters"], { fontSize: 13, title: "capture.txt (Wireshark list view)" });
  const rb = [["grep seq=", "that host's packets"], ["cut ... -f2", "keep the ? part"], ["sort", "pieces in order"], ["cut -d'=' -f3", "just the hex"], ["tr -d '\\n'", "join the lines"], ["xxd -r -p", "hex to text"]];
  rb.forEach(([cmd, what], i) => {
    const x = M + (i % 3) * 4.11, y = 3.15 + Math.floor(i / 3) * 1.65;
    card(s, x, y, 3.9, 1.45);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.45, h: 0.45, fill: { color: MC[i + 2] } });
    s.addText(String(i + 1), { x: x + 0.2, y: y + 0.2, w: 0.45, h: 0.45, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    mono(s, cmd, x + 0.85, y + 0.15, 2.95, 0.5, { fontSize: 15, valign: "middle" });
    text(s, what, x + 0.85, y + 0.7, 2.95, 0.5, { fontSize: 14, color: MUTED });
  });

  // ---- when stuck ----
  s = newSlide("When you are stuck",
    "Same routine as every CTF.\n\n" +
    "1. --help is free. 2. Ask the three file questions: when, what is it really, has it changed? 3. Build pipelines one step at a time. 4. hint N costs 5% of that mission's points, charged once per hint; harder missions have several hints, each more direct.", "filetype --help");
  numbered(s, [
    [{ text: "Read --help. ", options: { bold: true } }, { text: "Free. Every tool explains itself, even filetype." }],
    [{ text: "Ask the three questions. ", options: { bold: true } }, { text: "When? What is it really? Has it changed?" }],
    [{ text: "Build one step at a time. ", options: { bold: true } }, { text: "Look at the output before adding the next pipe." }],
    [{ text: "Buy a hint. ", options: { bold: true } }, { text: "hint N shows the price. 5% of the mission, charged once." }],
  ], M, 1.8, 6.2, 1.05, BLUE, 17);
  term(s, 7.1, 1.6, 5.63, 4.9, ["$ hint 5", "Hint 1 of 2 costs 10 points (5% of 200),", "charged once.", "To see it, type:  hint 5 --show", "$ hint 5 --show", { hi: "Hint 1 of 2: The IP address is" }, { hi: "field 8 ..." }, "# -10 points on the scoreboard"], { fontSize: 14, title: "player@quest" });

  // ---- toolkit recap ----
  s = newSlide("Your investigator's toolkit",
    "One slide to photograph. Every tool, which mission it powers.\n\n" +
    "All of these are standard Linux tools except filetype, a tiny helper in this CTF that does what the real file command does. On a full Linux system (Kali, Ubuntu) you'd type file instead.");
  const kit = [["ls -l", "when did it change?", 1], ["strings", "metadata in any file", 2], ["filetype", "what is it really?", 3], ["tar  zcat", "unwrap the layers", 4], ["grep | cut | uniq -c", "count events in logs", 5], ["strings | tail", "find what's appended", 6], ["sha256sum -c", "has it changed?", 7], ["cat cron/*  ls -a", "find persistence", 8], ["sort | tr | xxd -r", "rebuild the pieces", 9], ["all of the above", "close the case", 10]];
  kit.forEach(([cmd, what, n], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 0.98;
    card(s, x, y, 5.96, 0.85);
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fill: { color: MC[n - 1] } });
    s.addText(String(n), { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    mono(s, cmd, x + 0.9, y, 2.7, 0.85, { fontSize: 14, valign: "middle", fit: "shrink" });
    text(s, what, x + 3.6, y, 2.25, 0.85, { fontSize: 14, color: MUTED, valign: "middle" });
  });
  text(s, "Stuck on any of them?  TOOL --help", M, 6.55, 8, 0.35, { fontSize: 14, bold: true });

  // ===========================================================================
  // PART 3: THE COMPETITION
  // ===========================================================================
  section("Part 3 · Rules and warm-up");
  divider(3, "The competition", "A warm-up, ten clues, 2,700 points, one clock. Missions 1 and 2 we solve together. Then teams race.", MC[3], "./investigate --all   # 10 flags, 2,700 points",
    "Section break. If students played around while learning, have everyone reload now for a fresh computer, zero points and a clean clock. This is the ONE time a reload is welcome.\n\nPut the CTF on one half of the projector and these slides on the other, or switch between them.\n\nEach mission has two slides: the brief (show it, read it, ask the three questions) and the walkthrough (reveal it after the class has tried).");

  // ---- scoring ----
  s = newSlide("How scoring works",
    "Points come from difficulty, on CyberQuest's scale: Easy 100, Medium 200, Hard 400, Very Hard 800. The ten missions are worth 2,700, plus 50 bonus points for the optional warm-up. Mission 10, Case closed, is the one Very Hard.\n\n" +
    "The clock counts UP. It waits during the warm-up, starts with Mission 1, and stops when you capture the last flag.\n\n" +
    "Ranking: most points wins; on a tie, the faster time wins. Hints cost 5% of the mission's points each, charged once. Wrong flags cost nothing: encourage trying.");
  const lv = [["Easy", "Missions 1, 2, 3"], ["Medium", "Missions 4 to 7"], ["Hard", "Missions 8, 9"], ["Very Hard", "Mission 10: Case closed"]];
  lv.forEach(([name, which], i) => {
    const L = LEVEL[name], x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.65, w: 2.87, h: 2.0, fill: { color: L.fill }, rectRadius: 0.12 });
    s.addText(String(L.pts), { x, y: 1.75, w: 2.87, h: 0.95, fontFace: HEAD, fontSize: 48, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true });
    s.addText(name.toUpperCase() + "  ·  points", { x, y: 2.7, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true });
    s.addText(which, { x, y: 3.1, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 13, color: name === "Very Hard" ? "F3C6D4" : MUTED, align: "center", margin: 0, isTextBox: true });
  });
  const rules = [[fa.FaStopwatch, "The clock counts up", "It starts with Mission 1 and stops at your last flag. Nobody is cut off.", BLUE], [fa.FaTrophy, "Most points wins", "Tie on points? The faster time wins.", AMBER], [fa.FaLightbulb, "Hints cost 5%", "Of that mission's points, per hint, charged once. Wrong flags cost nothing.", GREEN]];
  for (let i = 0; i < rules.length; i++) {
    const [Icon, head, body, color] = rules[i];
    const x = M + i * 4.11;
    card(s, x, 3.95, 3.9, 2.5);
    await iconCircle(s, Icon, x + 0.3, 4.15, 0.75, color);
    text(s, head, x + 1.25, 4.2, 2.55, 0.65, { fontSize: 19, bold: true, valign: "middle" });
    text(s, body, x + 0.3, 5.1, 3.35, 1.2, { fontSize: 15, color: MUTED });
  }

  // ---- the capture routine ----
  s = newSlide("The investigator's routine, every time",
    "Five steps, the same for every mission. Drill it now so that the only new thing in each round is the evidence.\n\n" +
    "Say it together: Read. Survey. Ask. Extract. Submit.\n\n" +
    "Ask is the forensics-specific step: when did it change, what is it really, has it changed? Write down anything you find (IPs, users, times): Mission 10 needs them.");
  const routine = [["Read", "the case: cat README.txt.", fa.FaBookOpen, MC[1]], ["Survey", "ls -l, filetype: what's here?", fa.FaFolderOpen, MC[2]], ["Ask", "when? what is it? changed?", fa.FaMagnifyingGlass, MC[3]], ["Extract", "pull out the clue: CYBA{ to }.", fa.FaFileExport, MC[4]], ["Submit", "type submit, paste, Enter.", fa.FaFlag, GREEN]];
  for (let i = 0; i < routine.length; i++) {
    const [head, body, Icon, color] = routine[i];
    const x = M + i * 2.48, w = 2.2;
    card(s, x, 1.75, w, 3.5);
    await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, align: "center" });
    text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{case-3c9e01f7}   # Correct! +100 points"], { fontSize: 18 });

  // ---- the warm-up ----
  s = newSlide("Mission 0: the warm-up",
    "Do this together, before the clock matters.\n\n" +
    "orientation.txt in the home folder explains the game: how to read a mission's instructions, what a flag looks like, how to submit it, what the replies mean, how hints work, and a list of the forensics toolkit. Its last line is the warm-up flag.\n\n" +
    "Optional and untimed: worth 50 bonus points, and the sidebar has a Skip warm-up button. The clock only starts with Mission 1.", "cat orientation.txt");
  numbered(s, [
    "Type  cat orientation.txt  and read it.",
    "Find 'Your forensics toolkit': the tools for today.",
    "The warm-up flag is on its last line. Submit it.",
    "+50 bonus. Or press Skip warm-up.",
  ], M, 1.8, 5.6, 1.0, MC[0], 18);
  card(s, M, 5.95, 5.6, 0.6, "E2F5EC");
  text(s, "Untimed: the clock starts with Mission 1.", M + 0.3, 5.95, 5.2, 0.6, { valign: "middle", fontSize: 16, bold: true, color: "0F6A45" });
  term(s, 6.7, 1.6, 6.03, 4.95, ["$ cat orientation.txt", "CTF Orientation", "...", "Your forensics toolkit", "  ls -l  strings  xxd  tar  zcat", "  sha256sum -c  grep  cut  sort  uniq -c", "  filetype: a helper for this CTF", "Warm-up flag:", { hi: "CYBA{warmup-...}" }, "$ submit CYBA{warmup-...}", "Correct! +50 points"], { fontSize: 13.5, title: "player@quest" });

  // ---- how rounds work ----
  s = newSlide("How the competition runs",
    "Missions 1 and 2 are guided ('We do'): the class tells the mentor what to type and everyone captures together.\n\n" +
    "Missions 3 to 10 are a race ('You do'): show the brief slide, ask the questions, then let teams go. Reveal each walkthrough once most teams have the flag, or when the room is stuck.\n\n" +
    "Mentors walk the room: point at the three file questions and --help, ask questions, don't type for students.");
  const phases = [["Missions 1–2", "We do", "Guided. The class calls out each command; the mentor types; everyone captures together.", "200 pts", BLUE], ["Missions 3–10", "You do", "The race. Teams investigate on their own clock. The walkthrough comes after most teams have it.", "2,500 pts", GREEN]];
  phases.forEach(([which, mode, body, pts, color], i) => {
    const x = M + i * 6.17;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.7, w: 5.96, h: 3.2, fill: { color }, rectRadius: 0.14 });
    s.addText(which, { x: x + 0.4, y: 1.9, w: 4, h: 0.5, fontFace: BODY, fontSize: 18, bold: true, color: "E8EEFF", margin: 0, isTextBox: true });
    s.addText(mode, { x: x + 0.4, y: 2.4, w: 4, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: WHITE, margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.4, y: 3.35, w: 5.1, h: 1.2, fontFace: BODY, fontSize: 16, color: WHITE, margin: 0, valign: "top", isTextBox: true });
    s.addText(pts, { x: x + 4.0, y: 1.9, w: 1.6, h: 0.5, fontFace: MONO, fontSize: 18, bold: true, color: WHITE, align: "right", margin: 0, isTextBox: true });
  });
  const steps5 = [["Read", "the brief out loud"], ["Ask", "the three questions"], ["Predict", "which tool, what output"], ["Extract", "one step at a time"], ["Explain", "in plain words"]];
  steps5.forEach(([a, b], i) => {
    const x = M + i * 2.48;
    card(s, x, 5.2, 2.28, 1.25);
    text(s, a, x + 0.2, 5.3, 2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true, color: MC[i % 6] });
    text(s, b, x + 0.2, 5.78, 2, 0.6, { fontSize: 14, color: MUTED });
  });

  // ---- the trail map ----
  s = newSlide("The trail: ten clues, 2,700 points",
    "The map of the whole competition. Notice the order follows the toolkit from Part 2: single files first, then archives, logs and traffic, then the whole case.\n\n" +
    "Suggested pacing: the warm-up together in 3 minutes, missions 1 and 2 together in 8, then the race. Most teams reach Mission 8 or 9 in 35 minutes; Case closed is for the fastest.");
  MS.forEach((c, i) => {
    const x = M + (i % 5) * 2.45, y = 1.6 + Math.floor(i / 5) * 2.45, color = MC[i];
    card(s, x, y, 2.3, 2.3);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.3, h: 0.1, fill: { color } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fill: { color } });
    s.addText(String(i + 1), { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.mode, x + 0.85, y + 0.28, 1.3, 0.55, { fontSize: 12, bold: true, color: MODE[c.mode].color, align: "right", valign: "middle" });
    text(s, c.name, x + 0.18, y + 0.9, 2.0, 0.6, { fontSize: 15, bold: true, valign: "middle" });
    levelChip(s, c.level, x + 0.18, y + 1.52, 1.95, 10.5);
    mono(s, c.skill, x + 0.18, y + 1.95, 2.0, 0.3, { fontSize: 10, color: MUTED, bold: false, fit: "shrink" });
  });
  text(s, "Plus Mission 0, the warm-up: optional, untimed, +50 bonus.", M, 6.55, 8, 0.35, { fontSize: 13, color: MUTED });

  // ---- the 10 missions: brief + walkthrough ----
  for (let i = 0; i < MS.length; i++) {
    if (i === 0) section("Missions 1–2 · Together");
    if (i === 2) section("Missions 3–10 · The race");
    const c = MS[i], n = i + 1, mode = MODE[c.mode], color = MC[i], L = LEVEL[c.level];
    s = newSlide(null, "MISSION " + n + " OF " + N + ": " + c.name + "   [" + c.level + ", " + L.pts + " points, " + c.mode + ", about " + c.mins + " minutes]\n\n" +
      "Show this slide first. Read the brief out loud, then ask the three questions BEFORE anyone types. Take one answer per question; do not confirm or correct yet.\n\n" + c.notes);
    chip(s, "Mission " + n + " of " + N, M, 0.48, 2.0, color, WHITE, 14);
    levelChip(s, c.level, M + 2.15, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n);
    s.addText(c.name, { x: M, y: 1.0, w: W - 2 * M, h: 0.95, fontFace: HEAD, fontSize: 42, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.1, w: 7.05, h: 4.4, fill: { color: TERM }, rectRadius: 0.12, shadow: { type: "outer", color: "12213A", opacity: 0.22, blur: 10, offset: 3, angle: 90 } });
    s.addText("# the brief", { x: M + 0.4, y: 2.3, w: 4, h: 0.4, fontFace: MONO, fontSize: 15, color: T_NOTE, margin: 0, isTextBox: true });
    s.addText(c.brief, { x: M + 0.4, y: 2.8, w: 6.25, h: 2.25, fontFace: BODY, fontSize: 21, color: WHITE, margin: 0, valign: "top", isTextBox: true, fit: "shrink" });
    s.addText(c.where, { x: M + 0.4, y: 5.1, w: 6.3, h: 0.35, fontFace: MONO, fontSize: 13, color: T_OUT, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fill: { color: AMBER }, rectRadius: 0.08 });
    s.addText([{ text: "Tools: ", options: { fontFace: BODY } }, { text: c.skill, options: { fontFace: MONO, bold: true } }], { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fontSize: 13, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fill: { color: "2B3B5C" }, rectRadius: 0.08 });
    s.addText("+" + L.pts + " points", { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fontFace: MONO, fontSize: 16, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, 7.95, 2.1, 4.78, 3.05);
    text(s, "Before anyone types", 8.25, 2.25, 4.2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true });
    bullets(s, c.ask, 8.25, 2.8, 4.25, 2.3, { fontSize: 15, paraSpaceAfter: 7 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.95, y: 5.35, w: 4.78, h: 1.15, fill: { color: mode.color }, rectRadius: 0.1 });
    s.addText(c.mode, { x: 8.2, y: 5.35, w: 1.45, h: 1.15, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText(mode.what, { x: 9.65, y: 5.35, w: 2.05, h: 1.15, fontFace: BODY, fontSize: 13, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText([{ text: String(c.mins), options: { fontSize: 26, bold: true, breakLine: true } }, { text: "min", options: { fontSize: 12 } }], { x: 11.75, y: 5.35, w: 0.85, h: 1.15, fontFace: HEAD, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });

    s = newSlide(null, "WALKTHROUGH " + n + " OF " + N + ": " + c.name + "\n\n" +
      (c.mode === "You do" ? "Race mission: reveal this slide only after most teams have the flag, or when the room is stuck.\n\n" : "Guided mission: solve it live with the class calling out commands, then use this slide to recap.\n\n") +
      "The slide never shows a real flag: every computer has its own evidence and flags, so students still have to run the commands themselves.\n\n" +
      "Ask one student to explain the three steps in their own words. Offer the stretch question to anyone who finished early.\n\n" + c.notes);
    chip(s, "Walkthrough " + n + " of " + N, M, 0.48, 2.3, color, WHITE, 14);
    levelChip(s, c.level, M + 2.45, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n + 1);
    s.addText("Solving " + c.name, { x: M, y: 0.98, w: W - 2 * M, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    term(s, M, 1.85, 7.35, 4.65, c.term, { fontSize: c.fs || 14, title: "player@quest" });
    text(s, "What just happened", 8.25, 1.85, 4.4, 0.4, { fontFace: HEAD, fontSize: 18, bold: true });
    numbered(s, c.happened, 8.25, 2.4, 4.48, 0.86, color, 14);
    card(s, 8.25, 5.0, 4.48, 0.82, "FFF4DC");
    text(s, [{ text: "Real world: ", options: { bold: true } }, { text: c.real }], 8.42, 5.0, 4.16, 0.82, { fontSize: 12.5, valign: "middle", fit: "shrink" });
    card(s, 8.25, 5.92, 4.48, 0.62);
    text(s, [{ text: "Stretch: ", options: { bold: true, color } }, { text: c.stretch }], 8.42, 5.92, 4.16, 0.62, { fontSize: 11.5, valign: "middle", fit: "shrink" });
    text(s, "Times, names, IPs and flags change on every computer.", M, 6.58, 7.35, 0.3, { fontSize: 11, color: MUTED });
  }

  section("Part 3 · After the race");
  // ---- side quests ----
  s = newSlide("Side quests: for teams that finish early",
    "No flags and no points: teams compare answers out loud.\n\n" +
    "Who did they try?: grep <attacker IP> ~/mission5/auth.log | cut -d' ' -f6 | sort | uniq -c. Usually admin, root, test, guest, oracle: the classic guesses. Talk about why default usernames matter.\n\n" +
    "Timeline: write the attack as a timeline from Missions 1, 5, 8 and 9 (times are in the logs and ls -l). Compare with the next team.\n\n" +
    "Magic hunt: run filetype on everything in ~/mission10/homes/*/* and count each type.\n\n" +
    "Cron decoder: what do 0 2 * * * and 30 3 * * 0 mean in ~/mission8/cron/root? (2:00 every day; 3:30 every Sunday.)");
  const side = [
    ["Who did they try?", "~/mission5", "Which usernames did the attacker guess? Why those?", "grep IP auth.log | cut -d' ' -f6"],
    ["Timeline", "missions 1, 5, 8, 9", "Put the night in order: login, file change, data leaving.", "ls -l · grep · head"],
    ["Magic hunt", "~/mission10", "How many files of each real type are in homes/?", "filetype homes/*/* | cut -d: -f2"],
    ["Cron decoder", "~/mission8", "Translate every schedule in cron/root into plain English.", "cat cron/root"],
  ];
  side.forEach(([name, where, brief, tools], i) => {
    const x = M + (i % 2) * 6.17, y = 1.65 + Math.floor(i / 2) * 2.45;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.96, h: 2.25, fill: { color: TERM }, rectRadius: 0.12 });
    s.addText(name, { x: x + 0.35, y: y + 0.2, w: 3.6, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: WHITE, margin: 0, isTextBox: true });
    s.addText(where, { x: x + 3.6, y: y + 0.25, w: 2.1, h: 0.4, fontFace: MONO, fontSize: 12, color: T_NOTE, align: "right", margin: 0, isTextBox: true });
    s.addText(brief, { x: x + 0.35, y: y + 0.8, w: 5.3, h: 0.85, fontFace: BODY, fontSize: 16, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
    s.addText([{ text: "$ ", options: { color: T_PROMPT } }, { text: tools, options: { color: AMBER } }], { x: x + 0.35, y: y + 1.68, w: 5.3, h: 0.4, fontFace: MONO, fontSize: 12.5, bold: true, margin: 0, isTextBox: true, fit: "shrink" });
  });

  // ---- read your scorecard ----
  s = newSlide("Read your scorecard",
    "When the last flag lands, the clock stops and the sidebar turns into the finish screen.\n\n" +
    "Points per mission and the total. 'Took' is how long each flag took since the previous one: the biggest Took shows which kind of evidence slowed you down. 'Time' is the clock reading at each submit.\n\n" +
    "Replay quest builds a brand-new computer with new evidence and new flags. Can you beat your time?\n\nThe times in this screenshot are an example.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.25, y: 1.55, w: 3.1, h: 4.52, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img-forensics", "sidebar-finish.png"), x: M + 0.3, y: 1.6, w: 3.0, h: 3.0 * 752 / 512 });
  const sc = [["Points", "2,700 for all ten flags, 2,750 with the warm-up.", AMBER], ["Took", "Time since your previous flag. Your biggest Took is the skill to practise.", BLUE], ["Time", "The clock when you submitted each flag.", MC[3]], ["Replay quest", "New evidence, new flags, a fresh clock. Beat your time.", GREEN]];
  sc.forEach(([head, body, color], i) => {
    const y = 1.65 + i * 1.2;
    card(s, 4.6, y, 8.13, 1.05);
    s.addShape(pres.shapes.RECTANGLE, { x: 4.6, y, w: 0.12, h: 1.05, fill: { color } });
    text(s, head, 4.95, y + 0.12, 2.2, 0.8, { fontSize: 20, bold: true, valign: "middle" });
    text(s, body, 7.1, y + 0.12, 5.4, 0.8, { fontSize: 16, color: MUTED, valign: "middle" });
  });

  // ===========================================================================
  // PART 4: DEBRIEF
  // ===========================================================================
  section("Part 4 · Debrief");
  divider(4, "Debrief", "The tools professionals use, what you just did, who gets paid to do it, and how to keep going.", MC[4], "echo \"case closed by $(whoami)\"",
    "Section break. Applaud the fastest teams, and also the team with the best case notes.\n\nFun closer: have everyone type the command on this slide. $(whoami) drops their username into the sentence.");

  // ---- pro tools ----
  s = newSlide("Today's tools, and the pro versions",
    "Everything today used small, standard command-line tools. Professionals use bigger tools that do the same jobs at scale. Name them so students recognise them at the competition and in job ads. Most come pre-installed on Kali Linux.\n\n" +
    "The competition's own tool list for Forensics is Wireshark, binwalk, exiftool, strings and steghide. All five are on this slide.\n\n" +
    "Autopsy: a free forensics workbench with timelines. ExifTool: reads photo and document metadata. binwalk: finds files hidden inside other files. steghide and zsteg: steganography. Volatility: memory analysis. Wireshark: network traffic. Splunk and the ELK stack: search millions of log lines. Tripwire and AIDE: file integrity.");
  const pro = [["ls -l", "Mission 1", "Autopsy timelines"], ["strings", "Mission 2", "exiftool (metadata)"], ["filetype", "Mission 3", "file, binwalk"], ["tar  zcat", "Mission 4", "7-Zip, binwalk -e"], ["grep | uniq -c", "Missions 5, 9", "Wireshark, Splunk"], ["strings | tail", "Mission 6", "binwalk, steghide"], ["sha256sum -c", "Mission 7", "Tripwire, AIDE"], ["cat cron/*", "Mission 8", "osquery, Autoruns (Windows)"]];
  pro.forEach(([today, which, prof], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.22;
    card(s, x, y, 5.96, 1.08);
    mono(s, today, x + 0.25, y + 0.1, 2.3, 0.5, { fontSize: 16, color: MC[i + 1] });
    text(s, which, x + 0.25, y + 0.6, 2.3, 0.35, { fontSize: 12, color: MUTED });
    s.addText(">", { x: x + 2.45, y, w: 0.4, h: 1.08, fontFace: MONO, fontSize: 20, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, prof, x + 2.9, y, 2.95, 1.08, { fontSize: 14.5, bold: true, valign: "middle" });
  });

  // ---- skill passport ----
  s = newSlide("Your skill passport",
    "A visual receipt for the session, in mission order. Each stamp is an investigation skill the class used today.\n\n" +
    "Ask students to count the stamps they earned.");
  const stamps = [["ls -l", 1], ["timeline", 1], ["metadata", 2], ["strings", 2], ["magic bytes", 3], ["zcat", 3], ["tar -x", 4], ["cut", 5], ["uniq -c", 5], ["stego", 6], ["base64 -d", 6], ["sha256sum -c", 7], ["cron", 8], ["ls -a", 8], ["packet list", 9], ["case notes", 10], ["--help", 0], ["chain of evidence", 0]];
  stamps.forEach(([cmd, n], i) => {
    const x = M + (i % 6) * 2.04, y = 1.65 + Math.floor(i / 6) * 1.6, color = n ? MC[n - 1] : MUTED;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.88, h: 1.42, fill: { color: WHITE }, rectRadius: 0.12, line: { color, width: 2.5, dashType: "dash" } });
    mono(s, cmd, x + 0.05, y + 0.2, 1.78, 0.6, { fontSize: cmd.length > 9 ? 13 : 18, color, align: "center", valign: "middle" });
    text(s, n ? "Mission " + n : "Every mission", x, y + 0.88, 1.88, 0.35, { fontSize: 12, color: MUTED, align: "center" });
  });
  text(s, "Eighteen investigation skills, used on a real Linux system, in one session.", M, 6.6, W - 2 * M, 0.35, { fontSize: 15, bold: true });

  // ---- the job ----
  s = newSlide("What you just did is the job",
    "Connect the missions to real work. Ask the questions on the right and let students answer before you do.\n\n" +
    "Mentors: share one real story (unclassified and non-sensitive) of tracking down what happened on a system.");
  const jobs = [[fa.FaListUl, "Read the logs", "SOC analysts spot brute-force logins and odd traffic all day", MC[4]], [fa.FaMagnifyingGlass, "Examine the files", "Forensic examiners recover hidden, renamed and deleted evidence", MC[2]], [fa.FaFingerprint, "Prove what changed", "Incident responders compare fingerprints and hunt persistence", MC[6]], [fa.FaFileLines, "Tell the story", "Every investigation ends in a report someone else can follow", MC[0]]];
  for (let i = 0; i < jobs.length; i++) {
    const [Icon, cmd, job, color] = jobs[i];
    const y = 1.7 + i * 1.2;
    await iconCircle(s, Icon, M, y, 0.8, color);
    text(s, cmd, M + 1.05, y, 6, 0.4, { fontSize: 18, bold: true });
    text(s, job, M + 1.05, y + 0.42, 6.2, 0.6, { fontSize: 15, color: MUTED });
  }
  card(s, 8.1, 1.7, 4.63, 4.75);
  text(s, "Ask the room", 8.45, 1.95, 4, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  bullets(s, ["Which mission had your biggest Took time? Why?", "What would you check first after a break-in?", "What metadata might your own photos give away?", "How would you stop the Mission 5 attack next time?"], 8.45, 2.6, 4.0, 3.6, { fontSize: 16, paraSpaceAfter: 11 });

  // ---- keep going ----
  s = newSlide("Keep climbing",
    "Close with what students can do tomorrow, for free.\n\n" +
    "CyberQuest Academy is where the next challenges live: fill in the link. The Forensics CTF works at home on any computer; every replay has new evidence and new flags. Wireshark is free: download it at home and look at your own network traffic (only your own).\n\n" +
    "Thank the class and the teacher.");
  const next = [["Next: CyberQuest", "[CyberQuest Academy link]", "More CTFs, live scoreboards and harder missions are waiting for you there.", MC[2]], ["Replay the CTF", "[your CTF link]/forensics/", "Works at home. New evidence and flags on every replay. Beat your time.", MC[3]], ["Try Wireshark", "wireshark.org", "Free. Watch your own computer's traffic and spot the DNS and HTTPS packets.", MC[4]]];
  next.forEach(([head, where, body, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.3);
    text(s, head, x + 0.3, 1.95, 3.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color });
    mono(s, where, x + 0.3, 2.55, 3.4, 0.5, { fontSize: 13, color: INK });
    text(s, body, x + 0.3, 3.15, 3.3, 1.7, { fontSize: 16, color: MUTED });
  });
  term(s, M, 5.3, W - 2 * M, 1.15, ["$ echo \"Case closed. Thanks for playing.\""], { fontSize: 17 });

  // ===========================================================================
  // MENTOR APPENDIX
  // ===========================================================================
  section("Mentor appendix");
  s = newSlide("Mentor appendix: how the Forensics CTF works",
    "MENTOR READING. The Forensics CTF lives in the same GitLab project as the Linux and Crypto CTFs, in public/forensics/. It reuses the same emulator and page code; only the missions, one helper tool and the Linux image differ.\n\n" +
    "Real-Linux mode boots v86 with forensics.cpio.gz: BusyBox plus the filetype helper in /bin. Every boot generates random flags and fresh evidence: file times, the attacker's IP and user, which photo lies, which program is tampered. Only SHA-256 hashes of the flags are kept, so there is no answer file. All IP addresses come from the reserved documentation ranges, and the 'persistence' script does nothing.\n\n" +
    "Lite mode (no WebAssembly) is a JavaScript simulated shell with the same missions and tools.\n\n" +
    "Rebuild after editing missions: python3 guest-forensics/make-lite.py, python3 guest-forensics/make-forensics.py, python3 guest-forensics/make-banner.py, then sh guest-forensics/build.sh.");
  const lq = [[fa.FaTerminal, "A real terminal", "Linux in the browser, with standard forensics tools.", MC[1]], [fa.FaMagnifyingGlass, "Fresh evidence", "Random times, IPs, users, files and flags. No answer file.", MC[3]], [fa.FaLaptop, "Nothing to install", "One link: your Pages address + /forensics/. No accounts.", MC[4]]];
  for (let i = 0; i < lq.length; i++) {
    const [Icon, head, body, color] = lq[i];
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.35);
    await iconCircle(s, Icon, x + 0.3, 1.95, 0.95, color);
    text(s, head, x + 0.3, 3.1, 3.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true });
    text(s, body, x + 0.3, 3.65, 3.3, 1.3, { fontSize: 16, color: MUTED });
  }
  text(s, "Under the hood", M, 5.35, 3, 0.35, { fontSize: 14, bold: true, color: MUTED });
  const hood = [["Your browser", "E4EAF3", MUTED], ["v86: a PC in WebAssembly", MC[2], WHITE], ["Linux + BusyBox", MC[3], WHITE], ["filetype helper", MC[4], WHITE], ["Your 10 clues", AMBER, INK]];
  let hx = M;
  hood.forEach(([name, fill, ink], i) => { const w = name.length * 0.095 + 0.5; chip(s, name, hx, 5.8, w, fill, ink, 12.5); hx += w + 0.12; if (i < hood.length - 1) { s.addText(">", { x: hx - 0.12, y: 5.8, w: 0.12, h: 0.38, fontFace: MONO, fontSize: 12, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true }); hx += 0.06; } });
  text(s, "Source: public/forensics/ (page) and guest-forensics/ (missions, tools, Linux image).", M, 6.4, 11.5, 0.35, { fontSize: 13, color: MUTED });

  s = newSlide("Mentor appendix: open the Forensics CTF",
    "MENTOR READING: run this with students right before Part 2, so every device is booted for the Try it pills.\n\n" +
    "WRITE YOUR ADDRESS IN THE BOX before presenting. It is your GitLab Pages address with /forensics/ on the end, or pick Forensics CTF on the home page.\n\n" +
    "Most important rule: do not reload the page. A reload builds a new computer with new evidence and flags, and resets the clock and points.");
  numbered(s, [
    [{ text: "Open Chrome ", options: { bold: true } }, { text: "and type the address from the box on the right." }],
    [{ text: "Watch it boot. ", options: { bold: true } }, { text: "The status says 'Ready' when Linux is up." }],
    [{ text: "Click inside the black terminal. ", options: { bold: true } }, { text: "A cursor should blink." }],
    [{ text: "Never reload the page. ", options: { bold: true } }, { text: "Reloading means new flags, zero points and a reset clock." }],
  ], M, 1.85, 6.6, 1.1, BLUE, 18);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.7, y: 1.7, w: 5.03, h: 3.2, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText("Forensics CTF address", { x: 7.7, y: 1.9, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 16, color: T_OUT, align: "center", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fill: { color: "162238" }, rectRadius: 0.08, line: { color: AMBER, width: 2, dashType: "dash" } });
  s.addText("your-group.gitlab.io/.../forensics/", { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fontFace: MONO, fontSize: 17, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Type it exactly. One computer per pair.", { x: 7.7, y: 4.2, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 14, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
  card(s, 7.7, 5.15, 5.03, 1.3, "FFF4DC");
  text(s, [{ text: "Don't start yet! ", options: { bold: true } }, { text: "The clock waits for Mission 1. The warm-up is untimed, so explore freely." }], 8.0, 5.15, 4.5, 1.3, { valign: "middle", fontSize: 15 });

  s = newSlide("Mentor appendix: answer key",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Flags and evidence are random on every page load and the CTF keeps only fingerprints, so there is no list of flags: play each mission yourself before class.\n\n" +
    "In lite mode $(...) is not supported: type values (IPs, file names) by hand.");
  const key = [["0", "Warm-up", "cat orientation.txt;  submit the flag on its last line", "Bonus · 50", MUTED]].concat(MS.map((c, i) => [String(i + 1), c.name, c.answer, c.level + " · " + LEVEL[c.level].pts, MC[i]])).concat([
    ["+", "Who did they try?", "grep <IP> ~/mission5/auth.log | cut -d' ' -f6 | sort | uniq -c", "side quest", MUTED],
    ["+", "Cron decoder", "0 2 * * * = 02:00 daily;  30 3 * * 0 = 03:30 Sundays", "side quest", MUTED],
  ]);
  key.forEach(([n, name, ans, lvl, color], i) => {
    const RH = 0.36, y = 1.45 + i * RH;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: W - 2 * M, h: RH, fill: { color: i % 2 ? WHITE : TINT } });
    s.addShape(pres.shapes.OVAL, { x: M + 0.12, y: y + 0.055, w: 0.25, h: 0.25, fill: { color } });
    s.addText(n, { x: M + 0.12, y: y + 0.055, w: 0.25, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, name, M + 0.5, y, 2.4, RH, { fontSize: 12, bold: true, valign: "middle" });
    mono(s, ans, M + 2.9, y, 7.9, RH, { fontSize: 9.5, bold: false, valign: "middle", fit: "shrink" });
    text(s, lvl, M + 10.6, y, 1.5, RH, { fontSize: 11, bold: true, color: MUTED, valign: "middle", align: "right" });
  });

  s = newSlide("Mentor appendix: when things go wrong",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Most problems are the same as the Linux CTF: the school web filter, Pages visibility, or typing before clicking the terminal. The forensics-specific ones are below.\n\n" +
    "Plan B if most devices can't load it: drive the CTF on the projector and run the competition as 'We do', with teams racing to call out the next command on paper.");
  const fixes = [
    ["The terminal filled with garbage", "Someone ran cat on a binary file. Type reset (or clear), then use strings instead."],
    ["tar: can't open / invalid magic", "Check the name with ls, and the type with filetype. A plain tar needs -xf; a .tar.gz needs -xzf."],
    ["zcat: invalid magic", "That file isn't gzip. Run filetype on it first."],
    ["Mission 1: no file at that time", "Use the time on the first line of README.txt in mission1, and ls -l evidence (not ls)."],
    ["The cut pipeline prints nothing", "Build it one step at a time. Quote the delimiter: cut -d' ' -f8 and cut -d'?' -f2."],
    ["$(...) doesn't work", "Lite mode has no $(...). Type the IP or file name by hand."],
    ["\"Incorrect flag\"", "Copy the whole flag, CYBA{ to }. Decoy flags exist: Missions 1, 5 and 7 need the right one."],
    ["Page was reloaded by accident", "New evidence, new flags; points and clock reset. The second run is fast."],
  ];
  fixes.forEach(([problem, fix], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.24;
    card(s, x, y, 5.96, 1.1);
    text(s, problem, x + 0.25, y + 0.1, 5.5, 0.35, { fontSize: 14.5, bold: true, color: RED });
    text(s, fix, x + 0.25, y + 0.45, 5.5, 0.6, { fontSize: 12.5, color: INK });
  });

  const out = path.join(__dirname, "CyberQuest-Forensics-CTF.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

build().catch((e) => { console.error(e); process.exit(1); });
