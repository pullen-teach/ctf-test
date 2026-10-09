// Builds slides/CyberQuest-Linux-CTF.pptx. Run:  node slides/build-deck-ctf.js
// Teaching deck for the CyberQuest Linux CTF page. Part 2 introduces the commands in
// the same order the ten missions need them; Part 3 plays the missions in that order.
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
const MC = ["17875A", "2A9FD6", "2459D8", "7448D4", "D1416B", "E8820C", "C9A227", "0F9488", "5B6EE1"];
// Kept for the shared helpers and older layouts.
const TIER = { warm: MC[1], search: MC[2], logs: MC[3], secrets: MC[4], bonus: AMBER };
// CyberQuest difficulty scale and points.
const LEVEL = { "Easy": { pts: 100, fill: "E2F5EC", ink: "12704B" }, "Medium": { pts: 200, fill: "FFF4DE", ink: "9A5B00" }, "Hard": { pts: 400, fill: "FDE8EC", ink: "B4233F" }, "Very Hard": { pts: 800, fill: "2A1430", ink: "FF8FB1" } };
const HEAD = "Arial", BODY = "Calibri", MONO = "Courier New";
const W = 13.333, H = 7.5, M = 0.6;
const FOOT = "CyberQuest Academy  ·  Crypto CTF";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Crypto CTF: learn cryptography, then compete";
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
const N = 9;
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


// ---- the nine crypto missions, in the order the page plays them ----
const MS = [
  { n: 1, name: "Base camp", level: "Easy", skill: "base64 -d", idea: 0,
    brief: "message.b64 is written in base64: letters, digits, + and /, often ending in =. Decode it to read the flag.",
    happened: "base64 -d turned the encoding back into text. Encoding needs no key: anyone can undo it.",
    term: ["$ cd ~/mission1", "$ cat message.b64", "V2VsY29tZSB0byBiYXNlIGNhbXAh...", "$ base64 -d message.b64", "Welcome to base camp!", { hi: "Flag: CYBA{base-...}" }] },
  { n: 2, name: "Hex marks the spot", level: "Easy", skill: "xxd -r -p", idea: 0,
    brief: "Every byte can be written as two hex characters (0-9, a-f): 'A' is 41, a space is 20. Turn the hex back into text.",
    happened: "xxd -r -p reversed plain hex into text. -r reverses, -p means plain hex with no columns.",
    term: ["$ cd ~/mission2", "$ cat signal.hex", "48657820776169746573...", "$ xxd -r -p signal.hex", "Hex writes every byte as two characters.", { hi: "Flag: CYBA{hex-...}" }] },
  { n: 3, name: "Spin cycle", level: "Easy", skill: "caesar 13", idea: 1,
    brief: "ROT13 rotates every letter 13 places: A becomes N. Rotating by 13 twice returns to the start, so rotate again to read it.",
    happened: "caesar 13 rotated the letters back. ROT13 is its own undo, because 13 + 13 = 26, a full loop.",
    term: ["$ cd ~/mission3", "$ cat note.txt", "Ebgngr zr 13 cynprf...", "$ caesar 13 note.txt", "Rotate me 13 places and I spin right back.", { hi: "Flag: CYBA{rot-...}" }] },
  { n: 4, name: "Hail Caesar", level: "Medium", skill: "caesar --all", idea: 1,
    brief: "scroll.txt uses a Caesar shift, but nobody wrote down which one. There are only 25 shifts, so let the computer try them all.",
    happened: "caesar --all showed all 25 shifts; one reads as English. Trying every key is a brute-force attack.",
    term: ["$ cd ~/mission4", "$ caesar --all scroll.txt", "shift  1: Tdoj ...", "shift  3: Veni vidi vici: I came...", "$ caesar 3 scroll.txt", { hi: "Flag: CYBA{caesar-...}" }] },
  { n: 5, name: "Russian doll", level: "Medium", skill: "pipes", idea: 0,
    brief: "This message is wrapped in three layers: hex, base64 and ROT13. Work out the order from the outside in, and peel with pipes.",
    happened: "Recognising each layer (hex = only 0-9 a-f; base64 = mixed case and =) let us pipe one decoder into the next.",
    term: ["$ cd ~/mission5", "$ cat doll.txt", "54474a6f49474a6...", "$ xxd -r -p doll.txt | base64 -d | caesar 13", "You opened every doll!", { hi: "Flag: CYBA{doll-...}" }] },
  { n: 6, name: "Fingerprints", level: "Medium", skill: "sha256sum", idea: 2,
    brief: "A hash is a fingerprint for data. The keys folder holds a dozen look-alike keys; README gives the SHA-256 of the real one.",
    happened: "sha256sum fingerprinted every key; grep matched the one from README. You can't reverse a hash, but you can compare.",
    term: ["$ cd ~/mission6", "$ cat README.txt", "fingerprint: 9ba7be9e...", "$ sha256sum keys/* | grep 9ba7be9e", "9ba7be9e... keys/key-qxra.txt", "$ cat keys/key-qxra.txt", { hi: "CYBA{print-...}" }] },
  { n: 7, name: "Letter detective", level: "Hard", skill: "freq, tr", idea: 1,
    brief: "A substitution cipher swaps every letter for another. Too many keys to brute-force, but language leaks: e and t are common, and 'the' repeats.",
    happened: "freq ranked the letters; the most common is usually e, and the commonest 3-letter word is 'the'. tr tested each guess.",
    term: ["$ cd ~/mission7", "$ freq cipher.txt", "  t   58  ####...", "  g   41  ###...", "$ cat cipher.txt | tr 'tg' 'ET'", "THE message...", { hi: "...the secret word is cipher" }] },
  { n: 8, name: "Keyword cipher", level: "Hard", skill: "vigenere -d", idea: 1,
    brief: "A Vigenere cipher is a Caesar shift that changes with every letter, following a keyword. The keyword is hidden in plain sight in poem.txt.",
    happened: "The first letter of each line of the poem spelled the keyword (an acrostic). vigenere -d undid the shifting.",
    term: ["$ cd ~/mission8", "$ cat poem.txt", "Clouds drift / Echoes fade / ...", "# first letters spell: cedar", "$ vigenere -d cedar secret.txt", { hi: "Flag: CYBA{keyword-...}" }] },
  { n: 9, name: "The vault", level: "Very Hard", skill: "all of it", idea: 2,
    brief: "vault.b64 was Vigenere-encrypted, then base64-encoded. The keyword is in key.txt, but that note was itself scrambled with a Caesar shift.",
    happened: "caesar --all recovered the keyword, base64 -d peeled the outer layer, vigenere -d decrypted the core. Every skill, chained.",
    term: ["$ caesar --all key.txt", "shift 16: The vault keyword is copper", "$ base64 -d vault.b64 | vigenere -d copper", "You cracked the vault.", { hi: "Flag: CYBA{vault-...}" }] },
];

// ---- Part 2: four big ideas of crypto ----
const CONCEPTS = [
  { title: "Encodings", color: MC[1], short: "Same data, written a different way. No key, so anyone can undo it.",
    verbs: [["base64", "letters, digits, + / ="], ["hex", "two chars per byte"], ["decode", "base64 -d, xxd -r -p"]] },
  { title: "Classical ciphers", color: MC[3], short: "Old ways to hide a message by moving or swapping letters.",
    verbs: [["shift", "Caesar, ROT13"], ["substitute", "swap each letter"], ["keyword", "Vigenere"]] },
  { title: "Breaking ciphers", color: MC[4], short: "You don't need the key if the cipher is weak.",
    verbs: [["brute force", "try all 25 shifts"], ["frequency", "e and t are common"], ["known word", "'the' repeats"]] },
  { title: "Hashes", color: MC[5], short: "A one-way fingerprint. You can compare, but never reverse.",
    verbs: [["fingerprint", "sha256sum"], ["compare", "same in = same out"], ["one-way", "no undo"]] },
];
const IDEA = CONCEPTS;

async function build() {
  let s;

  // ======================= OPENING =======================
  section("Opening");
  s = darkSlide(
    "Welcome the class. One sentence on who you are and how you use codes or crypto at work.\n\n" +
    "Promise: 'In 90 minutes you'll learn how secret messages are hidden and cracked, then compete to break 9 of them for 2,500 points.'");
  s.addText("CyberQuest", { x: M, y: 1.35, w: 8, h: 1.1, fontFace: HEAD, fontSize: 64, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Crypto CTF: crack the code, then compete.", { x: M, y: 2.7, w: 9, h: 1, fontFace: BODY, fontSize: 28, color: T_OUT, margin: 0, isTextBox: true });
  s.addText("CyberQuest Academy mentorship session", { x: M, y: 4.7, w: 8, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: WHITE, margin: 0, isTextBox: true });
  term(s, M, 5.3, W - 2 * M, 1.15, ["$ echo 'Q1lCQXt3ZWxjb21lfQ==' | base64 -d", "CYBA{welcome}"], { fontSize: 18 });

  s = newSlide("Today, in four parts",
    "Walk the plan. Timing for 90 min: opening 3, Part 1 fundamentals 12, Part 2 essentials 25, Part 3 compete 40, Part 4 debrief 10.");
  const plan = [["12", "Fundamentals", "What crypto is, and why it is everywhere.", MC[0]],
    ["25", "Essentials", "Encodings, ciphers, how to break them, hashes.", MC[2]],
    ["40", "Compete", "Nine flags, 2,500 points, one clock. Easiest first.", MC[3]],
    ["10", "Debrief", "How it stays fair, and where this leads.", MC[4]]];
  plan.forEach(([min, name, what, color], i) => {
    const x = M + i * 3.07; card(s, x, 1.7, 2.87, 3.9);
    s.addText(min, { x: x + 0.3, y: 1.9, w: 2.3, h: 1.1, fontFace: HEAD, fontSize: 60, bold: true, color, margin: 0, isTextBox: true });
    text(s, "minutes", x + 0.3, 3.0, 2.3, 0.35, { fontSize: 14, color: MUTED });
    text(s, name, x + 0.3, 3.5, 2.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true });
    text(s, what, x + 0.3, 4.1, 2.35, 1.3, { fontSize: 15, color: MUTED });
  });
  card(s, M, 5.85, W - 2 * M, 0.75, "FFF4DC");
  text(s, [{ text: "The deal: ", options: { bold: true } }, { text: "no maths degree needed. You'll crack real ciphers today with a few simple commands." }], M + 0.3, 5.85, W - 2 * M - 0.6, 0.75, { valign: "middle", fontSize: 17 });

  s = newSlide("What is a capture the flag?",
    "A CTF is a puzzle competition for security skills. Each puzzle hides a flag: a secret string. Find it, submit it, score points.\n\nEvery flag today starts with CYBA and has its secret in curly braces. Stress: this CTF is built to be cracked; real systems are not yours to attack.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.7, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText([{ text: "CYBA", options: { color: T_PROMPT, bold: true } }, { text: "{", options: { color: T_OUT } }, { text: "caesar-8fba6fd0", options: { color: AMBER, bold: true } }, { text: "}", options: { color: T_OUT } }],
    { x: M, y: 1.7, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 40, align: "center", valign: "middle", margin: 0, isTextBox: true });
  const parts = [["CYBA", "Always the same start", MC[0]], ["{   }", "The wrapper", MC[2]], ["caesar-8fba6fd0", "The secret you crack", MC[4]]];
  parts.forEach(([a, b, color], i) => { const x = M + i * 4.11; card(s, x, 3.5, 3.9, 1.5); mono(s, a, x + 0.25, 3.65, 3.4, 0.5, { fontSize: 18, color }); text(s, b, x + 0.25, 4.25, 3.45, 0.6, { fontSize: 15, color: MUTED }); });
  card(s, M, 5.3, W - 2 * M, 1.2, "FFF4DC");
  text(s, [{ text: "Permission matters. ", options: { bold: true } }, { text: "Finding the hidden thing, legally and with permission, is exactly what security professionals are paid to do." }], M + 0.3, 5.3, W - 2 * M - 0.6, 1.2, { valign: "middle", fontSize: 17 });

  // ======================= PART 1: FUNDAMENTALS =======================
  section("Part 1 · Crypto fundamentals");
  divider(1, "Crypto fundamentals", "What cryptography is, why it underpins the whole internet, and the three ideas you'll use all day.", MC[0], "echo secret | base64   # a first taste",
    "Ten minutes of story before the hands-on part. Keep it fast and visual.");

  s = newSlide("What is cryptography?",
    "Cryptography is the science of protecting information: keeping it secret, and proving it hasn't changed. People have done it for thousands of years; today it runs quietly behind almost everything you do online.");
  const whatc = [[fa.FaLock, "Confidentiality", "Only the right people can read it. That's encryption.", MC[2]],
    [fa.FaFingerprint, "Integrity", "Proving data hasn't been changed. That's hashing.", MC[5]],
    [fa.FaUserCheck, "Authenticity", "Proving who really sent it. That's signatures.", MC[3]]];
  for (let i = 0; i < whatc.length; i++) { const [Icon, head, body, color] = whatc[i]; const y = 1.8 + i * 1.5; await iconCircle(s, Icon, M, y, 0.9, color); text(s, head, M + 1.2, y - 0.02, 5, 0.5, { fontSize: 22, bold: true }); text(s, body, M + 1.2, y + 0.5, 6, 0.6, { fontSize: 16, color: MUTED }); }
  term(s, 7.9, 1.8, 4.83, 4.4, ["# today's CTF is about the first two:", "", "encryption  -> keep a secret", "hashing     -> prove a fingerprint", "", "and the oldest trick of all:", "", "codes & ciphers", "-> hide a message in plain sight"], { fontSize: 15, title: "what we'll crack" });

  s = newSlide("Encode, encrypt, hash: not the same",
    "The single most useful idea in crypto CTFs. Students confuse these constantly.\n\nEncoding has NO key: anyone can undo it (base64, hex). Encryption needs a KEY to undo (Caesar, Vigenere). Hashing is ONE-WAY: it cannot be undone at all, only compared.");
  const three = [["Encoding", "F1EDFD", "7448D4", "A different way to write the same data.", "No key. Anyone decodes it.", "base64, hex"],
    ["Encryption", "E7EEFC", "2459D8", "Scrambled with a secret key.", "Need the key to read it.", "Caesar, Vigenere"],
    ["Hashing", "FDE8EC", "B4233F", "A one-way fingerprint of the data.", "Cannot be undone, only compared.", "SHA-256, MD5"]];
  three.forEach(([name, fill, ink, a, b, egs], i) => {
    const x = M + i * 4.11; s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 3.9, h: 4.0, fill: { color: fill }, rectRadius: 0.14 });
    text(s, name, x + 0.35, 2.0, 3.2, 0.6, { fontFace: HEAD, fontSize: 24, bold: true, color: ink });
    text(s, a, x + 0.35, 2.75, 3.2, 0.9, { fontSize: 16 });
    text(s, b, x + 0.35, 3.7, 3.2, 0.9, { fontSize: 16, bold: true, color: ink });
    mono(s, egs, x + 0.35, 4.9, 3.2, 0.5, { fontSize: 14, color: ink });
  });
  card(s, M, 6.0, W - 2 * M, 0.6, "FFF4DC");
  text(s, [{ text: "First question on any puzzle: ", options: { bold: true } }, { text: "is this encoded, encrypted, or hashed? The answer tells you how to attack it." }], M + 0.3, 6.0, W - 2 * M - 0.6, 0.6, { valign: "middle", fontSize: 16 });

  s = newSlide("A short history of secret writing",
    "Tell it as a story: people have hidden messages for 2,000 years, and every method here appears in today's competition.");
  const hist = [["~50 BC", "Caesar", "Julius Caesar shifts each letter a few places to hide army orders.", MC[0]],
    ["800s", "Al-Kindi", "An Arab scholar breaks ciphers by counting letters: frequency analysis.", MC[1]],
    ["1500s", "Vigenere", "A keyword changes the shift for every letter: unbroken for 300 years.", MC[3]],
    ["1940s", "Enigma", "Codebreakers at Bletchley Park crack Nazi machines and shorten the war.", MC[4]],
    ["Today", "Everywhere", "Maths-based crypto secures every website, payment and message.", MC[2]]];
  hist.forEach(([year, head, body, color], i) => {
    const x = M + i * 2.45; s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.1, y: 2.0, w: 2.1, h: 0.7, fill: { color }, rectRadius: 0.12 });
    s.addText(year, { x: x + 0.1, y: 2.0, w: 2.1, h: 0.7, fontFace: HEAD, fontSize: 19, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, x, 3.0, 2.3, 3.3); text(s, head, x + 0.2, 3.15, 1.95, 0.5, { fontFace: HEAD, fontSize: 18, bold: true, color }); text(s, body, x + 0.2, 3.75, 1.95, 2.4, { fontSize: 14, color: MUTED });
  });

  s = newSlide("Crypto is everywhere you look",
    "Make it personal. Students use cryptography hundreds of times a day without noticing.");
  const ev = [[fa.FaLock, "The padlock in your browser", "Every https site encrypts the page on its way to you.", MC[2]],
    [fa.FaComments, "Your messages", "WhatsApp and iMessage are end-to-end encrypted.", MC[3]],
    [fa.FaCreditCard, "Every payment", "Card numbers are encrypted in transit and hashed at rest.", MC[0]],
    [fa.FaKey, "Your passwords", "Good sites store only a hash of your password, never the password.", MC[4]],
    [fa.FaCoins, "Crypto-currency", "Bitcoin is built entirely on hashing and signatures.", MC[1]],
    [fa.FaWifi, "Your wifi", "The password protecting your home network is a cipher key.", MC[5]]];
  for (let i = 0; i < ev.length; i++) { const [Icon, head, body, color] = ev[i]; const x = M + (i % 3) * 4.11, y = 1.75 + Math.floor(i / 3) * 2.4; card(s, x, y, 3.9, 2.2); await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.8, color); text(s, head, x + 1.25, y + 0.3, 2.5, 0.8, { fontSize: 17, bold: true, valign: "middle" }); text(s, body, x + 0.3, y + 1.25, 3.3, 0.85, { fontSize: 14.5, color: MUTED }); }

  s = newSlide("Your CTF toolkit",
    "The page is the same terminal as the Linux CTF, plus crypto tools. Every command is safe to try.");
  const lq = [[fa.FaTerminal, "A real terminal", "A Linux shell in your browser tab. No install.", MC[1]],
    [fa.FaFlag, "Nine missions", "2,500 points, easiest first. New flags on every load.", MC[3]],
    [fa.FaToolbox, "Crypto tools", "caesar, freq, vigenere, xxd, base64, sha256sum.", MC[4]]];
  for (let i = 0; i < lq.length; i++) { const [Icon, head, body, color] = lq[i]; const x = M + i * 4.11; card(s, x, 1.7, 3.9, 2.3); await iconCircle(s, Icon, x + 0.3, 1.95, 0.9, color); text(s, head, x + 1.25, 1.95, 2.5, 0.8, { fontSize: 20, bold: true, valign: "middle" }); text(s, body, x + 0.3, 2.9, 3.3, 0.9, { fontSize: 15, color: MUTED }); }
  term(s, M, 4.3, W - 2 * M, 2.1, ["$ echo 'try me' | base64", "dHJ5IG1lCg==", "$ caesar 3 <<< 'hello'", "khoor", "$ echo -n password | sha256sum", "5e884898da...  -"], { fontSize: 15, title: "every tool has --help" });

  // ======================= PART 2: ESSENTIALS =======================
  section("Part 2 · Crypto essentials");
  divider(2, "Crypto essentials", "Four big ideas and the tools for each. Open the CTF now so you can try every command (see the mentor appendix).", MC[2], "man crypto   # the essentials, in 25 minutes",
    "Section break. Have students open the CTF (mentor appendix has the steps). Demo each tool live.");

  s = newSlide("Four big ideas",
    "The map of Part 2. Each idea powers missions in the competition.");
  IDEA.forEach((c, i) => {
    const x = M + i * 3.07; card(s, x, 1.65, 2.87, 4.85);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.98, w: 0.7, h: 0.7, fill: { color: c.color } });
    s.addText(String(i + 1), { x: x + 0.25, y: 1.98, w: 0.7, h: 0.7, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.title, x + 0.25, 2.85, 2.45, 0.9, { fontFace: HEAD, fontSize: 20, bold: true, valign: "top" });
    text(s, c.short, x + 0.25, 3.8, 2.45, 1.9, { fontSize: 14.5, color: MUTED });
  });

  // encodings
  s = newSlide("Encodings: base64 and hex", "Encoding = same data, new clothes. No key. base64 uses A-Z a-z 0-9 + / and often ends in =. Hex uses 0-9 a-f, two characters per byte. Recognise them by sight, then decode.", "echo hi | base64");
  [["base64 -d FILE", "decode base64"], ["xxd -r -p FILE", "decode plain hex"], ["xxd -p FILE", "turn text into hex"], ["base64 FILE", "turn text into base64"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 1.8 + i * 0.85, 6.0, 2.7));
  card(s, M, 5.35, 6.0, 1.1, "FFF4DC");
  text(s, [{ text: "Tell them apart: ", options: { bold: true } }, { text: "only 0-9 and a-f = hex. Mixed-case letters with +, / or = = base64." }], M + 0.3, 5.35, 5.4, 1.1, { valign: "middle", fontSize: 16 });
  term(s, 7.0, 1.6, 5.7, 4.85, ["$ echo -n hi | base64", "aGk=", "$ echo aGk= | base64 -d", "hi", "", "$ echo -n hi | xxd -p", "6869", "$ echo 6869 | xxd -r -p", "hi"], { fontSize: 15, title: "two encodings" });

  // caesar/rot13
  s = newSlide("Caesar and ROT13: shifting letters", "The oldest cipher. Shift every letter a fixed number of places: with a shift of 3, A becomes D. ROT13 is just a shift of 13, and because the alphabet is 26 letters, doing it twice brings you home.", "caesar 3 <<< hello");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.7, w: W - 2 * M, h: 1.4, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "A B C D E F ...  ", options: { color: T_OUT } }, { text: "shift +3  ->  ", options: { color: AMBER, bold: true } }, { text: "D E F G H I ...", options: { color: T_PROMPT } }], { x: M + 0.4, y: 1.7, w: W - 2 * M - 0.8, h: 1.4, fontFace: MONO, fontSize: 24, bold: true, valign: "middle", margin: 0, isTextBox: true });
  [["caesar N FILE", "shift every letter by N"], ["caesar -N FILE", "shift back the other way"], ["caesar 13 FILE", "ROT13 (its own undo)"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 3.4 + i * 0.8, 6.0, 2.3));
  term(s, 7.0, 3.3, 5.7, 3.1, ["$ caesar 3 <<< 'hello'", "khoor", "$ caesar -3 <<< 'khoor'", "hello", "$ caesar 13 <<< 'why'", "jul"], { fontSize: 16, title: "shift and shift back" });

  // breaking: brute force + frequency
  s = newSlide("Breaking ciphers without the key", "Weak ciphers break two ways. A Caesar has only 25 keys, so a computer tries them all: brute force. A substitution has far too many keys to try, but letters betray it: in English, e and t are the most common, and 'the' appears again and again.", "caesar --all scroll.txt");
  card(s, M, 1.75, 6.0, 2.2); text(s, "Brute force", M + 0.3, 1.9, 5.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color: MC[3] });
  text(s, "Few possible keys? Try them all. caesar --all prints all 25 shifts; one reads as English.", M + 0.3, 2.45, 5.4, 1.4, { fontSize: 16, color: MUTED });
  card(s, M, 4.15, 6.0, 2.3); text(s, "Frequency analysis", M + 0.3, 4.3, 5.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color: MC[4] });
  text(s, "Too many keys? Count letters with freq. The top letter is probably e; the top 3-letter word is probably 'the'. Guess, then check.", M + 0.3, 4.85, 5.4, 1.5, { fontSize: 16, color: MUTED });
  term(s, 7.0, 1.75, 5.7, 4.7, ["$ freq cipher.txt", "  t   58  ##############", "  g   41  ##########", "  k   33  ########", "", "# t is most common -> probably e", "# find the commonest 3-letter", "#   word -> probably 'the'", "$ cat cipher.txt | tr 'tgk' 'ETH'"], { fontSize: 14, title: "letters leak" });

  // vigenere
  s = newSlide("Vigenere: a keyword cipher", "For 300 years this was unbreakable by hand. Instead of one shift, a keyword gives a different shift for every letter, then repeats. The trick in a CTF is finding the keyword: it is often hidden nearby, or crackable from a clue.", "vigenere -d KEY secret.txt");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.7, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "key:  ", options: { color: T_OUT } }, { text: "L E M O N L E M O N", options: { color: AMBER, bold: true } }, { text: "\nmsg:  ", options: { color: T_OUT } }, { text: "A T T A C K A T D...", options: { color: T_PROMPT } }],
    { x: M + 0.4, y: 1.7, w: W - 2 * M - 0.8, h: 1.5, fontFace: MONO, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });
  [["vigenere -d KEY FILE", "decrypt with a keyword"], ["vigenere -e KEY FILE", "encrypt"], ["vigenere --help", "how it works"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 3.45 + i * 0.8, 6.0, 2.7));
  term(s, 7.0, 3.35, 5.7, 3.1, ["$ vigenere -e lemon <<< 'attack'", "lxfopv", "$ vigenere -d lemon <<< 'lxfopv'", "attack"], { fontSize: 15, title: "keyword in, keyword out" });

  // hashes
  s = newSlide("Hashes: one-way fingerprints", "A hash turns any data into a short fingerprint. The same input always gives the same hash, and changing one letter changes everything. You cannot turn a hash back into the data, but you can hash a guess and compare. That's how a weak password gets cracked, and how this CTF checks your flags without ever storing them.", "echo -n hello | sha256sum");
  term(s, M, 1.7, 6.2, 3.3, ["$ echo -n hello | sha256sum", "2cf24dba5fb0a30e...  -", "$ echo -n hellp | sha256sum", "7d6fd7774f0d87624...  -", "# one letter changed -> totally different"], { fontSize: 14, title: "sensitive to change" });
  card(s, M, 5.15, 6.2, 1.3, "FFF4DC");
  text(s, [{ text: "Why it matters: ", options: { bold: true } }, { text: "a site stores your password's hash, not your password. If the password is a common word, an attacker hashes a wordlist and finds the match." }], M + 0.3, 5.15, 5.6, 1.3, { valign: "middle", fontSize: 15 });
  const hc = [[fa.FaFingerprint, "Same in, same out", MC[0]], [fa.FaArrowRightArrowLeft, "One letter flips it all", MC[4]], [fa.FaBan, "No undo, only compare", MC[2]]];
  for (let i = 0; i < hc.length; i++) { const [Icon, t, color] = hc[i]; const y = 1.75 + i * 1.6; await iconCircle(s, Icon, 7.0, y, 0.85, color); text(s, t, 8.1, y + 0.1, 4.6, 0.7, { fontSize: 19, bold: true, valign: "middle" }); }

  // toolbox recap
  s = newSlide("Your toolbox", "One-slide recap before the competition, grouped by the four ideas. Point and name; don't re-teach.");
  const groups = [[0, [["base64 -d", "decode base64"], ["xxd -r -p", "decode hex"]]],
    [1, [["caesar N", "shift letters"], ["caesar 13", "ROT13"], ["vigenere -d", "keyword cipher"]]],
    [2, [["caesar --all", "brute force"], ["freq", "count letters"], ["tr 'a' 'B'", "swap letters"]]],
    [3, [["sha256sum", "fingerprint"], ["grep", "match a hash"]]]];
  let gy = 1.6;
  groups.forEach(([ci, tools]) => {
    const c = IDEA[ci]; s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: gy, w: 2.9, h: 1.05, fill: { color: c.color }, rectRadius: 0.1 });
    s.addText([{ text: String(ci + 1) + "  ", options: { fontSize: 20 } }, { text: c.title, options: { fontSize: 14 } }], { x: M + 0.15, y: gy, w: 2.7, h: 1.05, fontFace: HEAD, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    tools.forEach(([cmd, what], j) => { const x = M + 3.05 + j * 2.5; card(s, x, gy, 2.35, 1.05); mono(s, cmd, x + 0.15, gy + 0.1, 2.05, 0.45, { fontSize: 14, valign: "middle" }); text(s, what, x + 0.15, gy + 0.56, 2.1, 0.4, { fontSize: 13, color: MUTED }); });
    gy += 1.2;
  });

  // ======================= PART 3: COMPETE =======================
  section("Part 3 · The competition");
  divider(3, "The competition", "A warm-up, nine missions, 2,500 points, one clock. Easiest first; the vault is the Very Hard finale.", MC[3], "./capture --all   # 9 flags, 2,500 points",
    "Section break. Have everyone reload for a fresh set of flags, zero points and a clean clock.");

  s = newSlide("How scoring works",
    "Make the rules clear before the clock matters. Points come from difficulty: Easy 100, Medium 200, Hard 400, Very Hard 800. The nine missions total 2,500, plus 50 bonus for the warm-up. The clock counts up from your first command in Mission 1 and stops at the last flag. Most points wins; ties break on time. Hints cost 5% of a mission, charged once. Wrong flags cost nothing.");
  const lv = [["Easy", "Missions 1-3"], ["Medium", "Missions 4-6"], ["Hard", "Missions 7-8"], ["Very Hard", "Mission 9"]];
  lv.forEach(([name, which], i) => { const L = LEVEL[name], x = M + i * 3.07; s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 2.87, h: 2.0, fill: { color: L.fill }, rectRadius: 0.12 }); s.addText(String(L.pts), { x, y: 1.9, w: 2.87, h: 0.95, fontFace: HEAD, fontSize: 46, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true }); s.addText(name.toUpperCase(), { x, y: 2.85, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true }); s.addText(which, { x, y: 3.25, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 13, color: name === "Very Hard" ? "F3C6D4" : MUTED, align: "center", margin: 0, isTextBox: true }); });
  const rules = [[fa.FaStopwatch, "The clock counts up", "Starts at Mission 1, stops at your last flag. Nobody is cut off.", BLUE], [fa.FaTrophy, "Most points wins", "Tie on points? The faster time wins.", AMBER], [fa.FaLightbulb, "Hints cost 5%", "Of that mission, charged once. Wrong flags are free.", GREEN]];
  for (let i = 0; i < rules.length; i++) { const [Icon, head, body, color] = rules[i]; const x = M + i * 4.11; card(s, x, 3.95, 3.9, 2.5); await iconCircle(s, Icon, x + 0.3, 4.15, 0.75, color); text(s, head, x + 1.25, 4.2, 2.55, 0.65, { fontSize: 18, bold: true, valign: "middle" }); text(s, body, x + 0.3, 5.15, 3.35, 1.2, { fontSize: 14.5, color: MUTED }); }

  s = newSlide("The capture routine, every time",
    "Drill this five-step routine so the only new thing each round is the puzzle. Step 4 trips people up: copy the flag from CYBA to the closing brace.");
  const routine = [["Read", "the mission brief.", fa.FaBookOpen, MC[1]], ["Spot", "encoded, encrypted, or hashed?", fa.FaMagnifyingGlass, MC[2]], ["Crack", "with the tool that fits.", fa.FaKey, MC[3]], ["Copy", "the whole flag.", fa.FaCopy, MC[4]], ["Submit", "submit CYBA{...}", fa.FaFlagCheckered, MC[0]]];
  for (let i = 0; i < routine.length; i++) { const [head, body, Icon, color] = routine[i]; const x = M + i * 2.48, w = 2.2; card(s, x, 1.75, w, 3.5); await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color); text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 23, bold: true, align: "center" }); text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 14.5, color: MUTED, align: "center" }); if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true }); }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{caesar-8fba6fd0}   # Correct! +200 points"], { fontSize: 18 });

  s = newSlide("Anatomy of the page",
    "A real screenshot. The sidebar carries the mission, the stepper, points, the clock and flags captured. The clock waits during the warm-up and starts with Mission 1. Most common issue: typing before clicking inside the terminal.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M - 0.05, y: 1.6, w: 9.6, h: 5.0, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img", "page.png"), x: M, y: 1.65, w: 9.5, h: 4.9 * 800 / 1360 });
  const an = [["Banner", "The welcome and how to play."], ["Stepper", "0 is the warm-up; a dot per mission."], ["Points & clock", "Score out of 2,550, clock from Mission 1."], ["Mission panel", "Brief, Start Here, Quick Reference."], ["Terminal", "Click inside before you type."]];
  an.forEach(([h, b], i) => { const y = 1.75 + i * 0.95; text(s, [{ text: h + "  ", options: { bold: true, fontSize: 16 } }, { text: b, options: { fontSize: 13, color: MUTED } }], 10.0, y, 2.7, 0.9, { valign: "top" }); });

  s = newSlide("Mission 0: the warm-up",
    "Do this together, untimed, before the clock matters. It practises the capture routine: read orientation.txt, find the flag on the last line, submit it for 50 bonus. Or skip it.");
  numbered(s, [[{ text: "Type ", options: {} }, { text: "cat orientation.txt", options: { bold: true } }, { text: " and read it." }],
    [{ text: "The warm-up flag is on the last line." }],
    [{ text: "Copy it, then ", options: {} }, { text: "submit", options: { bold: true } }, { text: " and paste." }],
    [{ text: "+50 bonus, or press ", options: {} }, { text: "Skip warm-up.", options: { bold: true } }]], M, 1.85, 5.9, 1.0, MC[0], 18);
  card(s, M, 6.0, 5.9, 0.55, "E2F5EC"); text(s, "Untimed: the clock starts with Mission 1.", M + 0.3, 6.0, 5.4, 0.55, { valign: "middle", fontSize: 15, bold: true, color: "0F6A45" });
  term(s, 6.7, 1.6, 6.03, 4.85, ["$ cat orientation.txt", "CTF Orientation", "...", "Warm-up flag:", { hi: "  CYBA{warmup-...}" }, "$ submit CYBA{warmup-...}", "Correct! +50 points"], { fontSize: 14, title: "player@quest" });

  s = newSlide("The trail: nine missions, 2,500 points",
    "The map of the competition. The commands appear in the order Part 2 taught them: encodings, then ciphers, then breaking them, then hashes, then everything at once.");
  MS.forEach((m, i) => {
    const x = M + (i % 5) * 2.45, y = 1.6 + Math.floor(i / 5) * 2.45, color = MC[i]; card(s, x, y, 2.3, 2.3);
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fill: { color } });
    s.addText(String(m.n), { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, m.name, x + 0.18, y + 0.95, 2.0, 0.6, { fontSize: 15, bold: true, valign: "middle" });
    levelChip(s, m.level, x + 0.18, y + 1.52, 1.95, 10.5);
    mono(s, m.skill, x + 0.18, y + 1.95, 2.0, 0.3, { fontSize: 10, color: MUTED, bold: false });
  });
  text(s, "Plus Mission 0, the warm-up: optional, untimed, +50 bonus.", M, 6.55, 8, 0.35, { fontSize: 13, color: MUTED });

  // one slide per mission (brief + tool + what happened)
  for (const m of MS) {
    const color = MC[m.n - 1], L = LEVEL[m.level];
    s = newSlide(null, "MISSION " + m.n + " OF 9: " + m.name + " [" + m.level + ", " + L.pts + " pts]\n\nRead the brief, let teams work, then reveal the terminal. Flags differ on every computer, so students still run the commands themselves.");
    chip(s, "Mission " + m.n + " of 9", M, 0.5, 2.1, color, WHITE, 14);
    levelChip(s, m.level, M + 2.25, 0.5, 2.0, 13);
    trail(s, 7.4, 0.54, 5.33, m.n);
    s.addText(m.name, { x: M, y: 1.05, w: W - 2 * M, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    card(s, M, 2.15, 6.3, 2.7, "F1F5FB");
    text(s, "The brief", M + 0.3, 2.3, 5.7, 0.4, { fontFace: HEAD, fontSize: 16, bold: true, color });
    text(s, m.brief, M + 0.3, 2.8, 5.75, 1.9, { fontSize: 17 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.05, w: 3.1, h: 0.6, fill: { color: AMBER }, rectRadius: 0.08 });
    s.addText([{ text: "Tool: ", options: { fontFace: BODY } }, { text: m.skill, options: { fontFace: MONO, bold: true } }], { x: M, y: 5.05, w: 3.1, h: 0.6, fontSize: 14, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 3.3, y: 5.05, w: 3.0, h: 0.6, fill: { color: "2B3B5C" }, rectRadius: 0.08 });
    s.addText("+" + L.pts + " points", { x: M + 3.3, y: 5.05, w: 3.0, h: 0.6, fontFace: MONO, fontSize: 16, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, M, 5.85, 6.3, 0.75, "E2F5EC");
    text(s, [{ text: "What just happened: ", options: { bold: true, color: "0F6A45" } }, { text: m.happened }], M + 0.3, 5.85, 5.75, 0.75, { fontSize: 13.5, valign: "middle" });
    term(s, 6.75, 2.15, 5.98, 4.45, m.term, { fontSize: m.term.length > 6 ? 14 : 16, title: "player@quest" });
  }

  s = newSlide("Read your scorecard",
    "When the last flag lands the clock stops and the sidebar shows the finish screen. Walk the scorecard: points per mission and the total, Took (time since your previous flag, where you got stuck) and Time (the clock when you submitted). Then the replay challenge: a new set of ciphers, can you beat your time?");
  const sc = [["Points", "2,500 for all nine flags, 2,550 with the warm-up.", AMBER], ["Took", "Time since your previous flag. Your biggest Took is where you got stuck.", BLUE], ["Time", "The clock when you submitted each flag.", GREEN], ["Replay", "A brand-new set of ciphers and a clean clock. Beat your time.", MC[3]]];
  const scIcons = [fa.FaCoins, fa.FaStopwatch, fa.FaClock, fa.FaRotateRight];
  for (let i = 0; i < sc.length; i++) { const [head, body, color] = sc[i]; const y = 1.7 + i * 1.2; card(s, M, y, W - 2 * M, 1.05); await iconCircle(s, scIcons[i], M + 0.3, y + 0.15, 0.75, color); text(s, head, M + 1.3, y + 0.12, 2.5, 0.8, { fontSize: 20, bold: true, valign: "middle" }); text(s, body, M + 4.0, y + 0.12, 7.9, 0.8, { fontSize: 16, color: MUTED, valign: "middle" }); }

  // ======================= PART 4: DEBRIEF =======================
  section("Part 4 · Debrief");
  divider(4, "Debrief", "How the game stays fair, what you just did, and how to keep going.", MC[4], "echo \"$(whoami) cracked the code\"",
    "Applaud the fastest teams and the team that got unstuck the most.");

  s = newSlide("How does submit know you're right?",
    "The clever part, and a lesson in hashing. At start-up the CTF makes nine random flags, stores only their SHA-256 fingerprints, and throws the flags away. submit fingerprints your guess and compares. A match means correct. Because a hash can't be reversed, reading the stored file never reveals a flag.");
  term(s, M, 1.8, W - 2 * M, 2.6, ["$ cat /etc/quest/4", "a3f9...  # just a fingerprint, not the flag", "$ submit CYBA{caesar-8fba6fd0}", "# fingerprints your guess, compares, matches", "Correct! +200 points"], { fontSize: 16, title: "only fingerprints are stored" });
  card(s, M, 4.7, W - 2 * M, 1.6, "FFF4DC");
  text(s, [{ text: "This is exactly how real websites check passwords. ", options: { bold: true } }, { text: "They store the hash, compare the hash of what you type, and never keep the password itself. It's also why a site can tell you your password is right but can never email it back to you." }], M + 0.3, 4.7, W - 2 * M - 0.6, 1.6, { valign: "middle", fontSize: 17 });

  s = newSlide("What you just did is the job",
    "Connect the missions to real work. Let students answer before you do.");
  const jobs = [[fa.FaCode, "Decode encodings", "Reading data that's been base64'd or hex'd: everyday work for developers and analysts.", MC[1]], [fa.FaMagnifyingGlass, "Break weak ciphers", "Spotting and cracking weak home-made crypto is a real finding in security audits.", MC[3]], [fa.FaFingerprint, "Understand hashing", "Knowing hashes vs encryption is the foundation of password security.", MC[5]], [fa.FaUserSecret, "Think like an attacker", "Finding the hidden thing, with permission, is what security pros are paid to do.", MC[4]]];
  for (let i = 0; i < jobs.length; i++) { const [Icon, head, body, color] = jobs[i]; const x = M + (i % 2) * 6.17, y = 1.75 + Math.floor(i / 2) * 2.4; card(s, x, y, 5.96, 2.2); await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.85, color); text(s, head, x + 1.3, y + 0.3, 4.4, 0.8, { fontSize: 19, bold: true, valign: "middle" }); text(s, body, x + 0.3, y + 1.25, 5.3, 0.85, { fontSize: 15, color: MUTED }); }

  s = newSlide("Keep cracking",
    "Close with what students can do next. Fill in your links. Point them to CyberQuest Academy and the replayable CTF.");
  const next = [["Next: CyberQuest Academy", "[CyberQuest link]", "More CTFs, live scoreboards, and harder crypto: RSA, XOR and modern ciphers.", MC[2]], ["Replay the Crypto CTF", "[your CTF link]", "Works at home. Every replay is a fresh set of ciphers and a fresh clock.", MC[0]]];
  next.forEach(([head, where, body, color], i) => { const x = M + i * 6.17; card(s, x, 1.8, 5.96, 3.3); text(s, head, x + 0.35, 2.05, 5.3, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color }); mono(s, where, x + 0.35, 2.7, 5.3, 0.5, { fontSize: 14, color: INK }); text(s, body, x + 0.35, 3.35, 5.3, 1.6, { fontSize: 16, color: MUTED }); });
  term(s, M, 5.4, W - 2 * M, 1.0, ["$ echo \"Thanks for playing. Keep cracking.\""], { fontSize: 18 });

  // ======================= MENTOR APPENDIX =======================
  section("Mentor appendix");
  s = newSlide("Mentor appendix: open the CTF",
    "MENTOR READING: run this with students right before Part 2, so every device is booted for the Try it commands. Give two or three minutes; walk the room. Write your CTF address in the box beforehand. Most important rule: do not reload during the competition.");
  numbered(s, [[{ text: "Open the CTF link ", options: { bold: true } }, { text: "in Chrome from the box on the right." }], [{ text: "Watch it boot. ", options: { bold: true } }, { text: "The status says Ready when it's up." }], [{ text: "Click inside the black terminal. ", options: { bold: true } }, { text: "A cursor should blink." }], [{ text: "Try a command: ", options: { bold: true } }, { text: "echo hi | base64" }]], M, 1.85, 6.6, 1.05, BLUE, 17);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.7, y: 1.8, w: 5.03, h: 3.0, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText("CTF address", { x: 7.7, y: 2.0, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 16, color: T_OUT, align: "center", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 2.6, w: 4.23, h: 1.4, fill: { color: "162238" }, rectRadius: 0.08, line: { color: AMBER, width: 2, dashType: "dash" } });
  s.addText("your-group.gitlab.io/...", { x: 8.1, y: 2.6, w: 4.23, h: 1.4, fontFace: MONO, fontSize: 18, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
  card(s, 7.7, 5.1, 5.03, 1.3, "FFF4DC"); text(s, [{ text: "Don't reload! ", options: { bold: true } }, { text: "A reload builds a new set of ciphers and resets points and the clock." }], 8.0, 5.1, 4.5, 1.3, { valign: "middle", fontSize: 15 });

  s = newSlide("Mentor appendix: answer key",
    "FOR MENTORS. Hide when presenting. Flags are random per load; only fingerprints are stored, so play each mission yourself first.");
  const key = [["0", "Warm-up", "cat orientation.txt; submit the last line", "Bonus 50"]].concat(MS.map((m) => [String(m.n), m.name, m.answer || answerFor(m.n), m.level + " " + LEVEL[m.level].pts]));
  key.forEach(([n, name, ans, lvl], i) => { const RH = 0.5, y = 1.5 + i * RH; s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: W - 2 * M, h: RH, fill: { color: i % 2 ? WHITE : TINT } }); const color = n === "0" ? MUTED : MC[(+n) - 1]; s.addShape(pres.shapes.OVAL, { x: M + 0.12, y: y + 0.13, w: 0.3, h: 0.3, fill: { color } }); s.addText(n, { x: M + 0.12, y: y + 0.13, w: 0.3, h: 0.3, fontFace: HEAD, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true }); text(s, name, M + 0.6, y, 2.8, RH, { fontSize: 13, bold: true, valign: "middle" }); mono(s, ans, M + 3.5, y, 7.3, RH, { fontSize: 11, bold: false, valign: "middle" }); text(s, lvl, M + 10.6, y, 1.5, RH, { fontSize: 11, bold: true, color: MUTED, valign: "middle", align: "right" }); });

  s = newSlide("Mentor appendix: when things go wrong",
    "FOR MENTORS. Hide when presenting. Most problems are the school web filter or the page being reloaded.");
  const fixes = [["The page won't load", "The web filter may block *.gitlab.io. Ask IT to allow your Pages address."], ["Status says 'lite mode'", "That browser blocks WebAssembly. Lite mode has the same missions: carry on."], ["Typing does nothing", "Click inside the black terminal first."], ["\"Incorrect flag\"", "Copy the whole flag, CYBA{ to }, no extra spaces. Flags from another computer never work."], ["A tool says 'not found'", "Check spelling: caesar, freq, vigenere, xxd. Type the tool with --help."], ["Page was reloaded", "New ciphers, points and clock reset. The second run is fast."]];
  fixes.forEach(([problem, fix], i) => { const x = M + (i % 2) * 6.17, y = 1.7 + Math.floor(i / 2) * 1.45; card(s, x, y, 5.96, 1.3); text(s, problem, x + 0.25, y + 0.12, 5.5, 0.4, { fontSize: 15, bold: true, color: RED }); text(s, fix, x + 0.25, y + 0.5, 5.5, 0.7, { fontSize: 13, color: INK }); });

  const out = path.join(__dirname, "CyberQuest-Crypto-CTF.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

function answerFor(n) {
  return {
    1: "base64 -d message.b64", 2: "xxd -r -p signal.hex", 3: "caesar 13 note.txt",
    4: "caesar --all scroll.txt; caesar N scroll.txt", 5: "xxd -r -p doll.txt | base64 -d | caesar 13  (or swap first two)",
    6: "sha256sum keys/* | grep <fp>; cat <match>", 7: "freq cipher.txt; tr guesses; read word+number",
    8: "first letters of poem.txt spell the key; vigenere -d KEY secret.txt",
    9: "caesar --all key.txt; base64 -d vault.b64 | vigenere -d KEY",
  }[n];
}

build().catch((e) => { console.error(e); process.exit(1); });
