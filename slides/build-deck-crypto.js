// Builds slides/CyberQuest-Crypto-CTF.pptx. Run:  node slides/build-deck-crypto.js
// Teaching deck for the CyberQuest Crypto CTF page (public/crypto/). Part 2 teaches the
// codebreaking tools in the order the ten missions need them; Part 3 plays the missions.
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
const FOOT = "Lockheed Martin CyberQuest® Academy   ·   Crypto CTF";
// Read a PNG asset from disk into a data URI (cached) so the .pptx embeds it.
function fileImg(rel) { return "image/png;base64," + fs.readFileSync(path.join(__dirname, rel)).toString("base64"); }
const SHIELD = fileImg("assets/cyberquest-shield.png");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Crypto CTF: crack the codes, then compete";
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
  s.addImage({ data: SHIELD, x: M, y: 6.92, w: 0.3 * 66 / 87, h: 0.3 });
  s.addText(FOOT, { x: M + 0.34, y: 7.0, w: 6.5, h: 0.3, fontFace: BODY, fontSize: 9.5, color: MUTED, valign: "middle", margin: 0, isTextBox: true });
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
// Lighten a hex colour toward white by fraction r (0..1): used for soft card tints.
function tint(hex, r) {
  const n = parseInt(hex, 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
  const m = (v) => Math.round(v + (255 - v) * r).toString(16).padStart(2, "0");
  return (m(R) + m(G) + m(B)).toUpperCase();
}
// An accent-coloured icon dropped into a soft tinted circle.
async function iconTintCircle(s, Icon, x, y, d, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: tint(color, 0.80) } });
  s.addImage({ data: await iconPng(Icon, color), x: x + d * 0.27, y: y + d * 0.27, w: d * 0.46, h: d * 0.46 });
}
// Decorative mountain + dotted summit trail (top-right of the "How today works" slide).
let mountainCache = null;
async function mountainPng() {
  if (!mountainCache) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 220">
      <path d="M0 200 L90 120 L150 165 L240 70 L320 150 L380 110 L440 170 L440 220 L0 220 Z" fill="#DCE8F7"/>
      <path d="M0 220 L70 165 L140 200 L210 140 L300 200 L360 165 L440 210 L440 220 Z" fill="#C4D8F0"/>
      <path d="M20 205 C120 196 150 172 210 150 C272 127 300 108 360 72" fill="none" stroke="#8FA8CE" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round"/>
      <circle cx="70" cy="192" r="8" fill="#2EA66B"/>
      <circle cx="190" cy="156" r="8" fill="#7448D4"/>
      <circle cx="300" cy="112" r="8" fill="#D1416B"/>
      <circle cx="360" cy="72" r="7" fill="#2459D8"/>
      <rect x="368" y="34" width="4" height="40" rx="2" fill="#2459D8"/>
      <path d="M372 36 L404 44 L372 55 Z" fill="#2459D8"/>
    </svg>`;
    mountainCache = "image/png;base64," + (await sharp(Buffer.from(svg)).resize({ width: 880 }).png().toBuffer()).toString("base64");
  }
  return mountainCache;
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



// ---- Part 2 of the crypto deck: the codebreaker's toolkit, in mission order ----
const MODE = {
  "We do": { color: BLUE, what: "Class calls out each command. Mentor types." },
  "You do": { color: GREEN, what: "Students try on their own. Reveal after." },
};

// ---- the ten crypto missions, in the order the page plays them ----
// Sample output comes from the real tools. Keys, keywords and flags change on every
// page load, so the slides never show a real flag.
const MS = [
  {
    name: "Not so secret", level: "Easy", skill: "cat  base64 -d", mode: "We do", mins: 5,
    where: "~/mission1/message.b64",
    brief: "A message that looks scrambled, but there is no key anywhere. It is only encoded. Turn it back into plain text.",
    ask: ["Letters, digits, + and /, with = at the end. What does that pattern tell us?", "Does decoding need a key?", "Which command explains its own options?"],
    term: ["$ cd ~/mission1", "$ cat message.b64", "RW5jb2RpbmcgaXMgbm90IGVuY3J5cHRpb24uIEFu", "ZW9uZSBjYW4gZGVjb2RlIHRoaXMuCkZsYWc6IENZ...", "$ base64 -d message.b64", "Encoding is not encryption. Anyone can decode this.", { hi: "Flag: CYBA{b64-...}" }, "$ submit CYBA{b64-...}", "Correct! +100 points"], fs: 13,
    happened: ["cat showed base64: letters, digits, + / and a trailing =.", "base64 --help showed that -d decodes.", "No key was needed. Encoding only hides data from people who don't look."],
    real: "Base64 is everywhere: email attachments, web tokens and data inside web pages.",
    stretch: "Encode your own name with  echo NAME | base64. Why does it end in = sometimes?",
    answer: "cd ~/mission1; base64 -d message.b64",
    notes: "The lesson of the day starts here: encoding is not encryption. Base64 has no key, so anyone can undo it.\n\nIf a student tries base64 --decode, that works too.",
  },
  {
    name: "Hex marks the spot", level: "Easy", skill: "xxd -r -p", mode: "We do", mins: 5,
    where: "~/mission2/secret.hex",
    brief: "A long run of digits and the letters a to f. Every two characters are one byte. Turn the hex back into text.",
    ask: ["Why only 0–9 and a–f?", "How many hex characters make one letter?", "Which two xxd options do we need, and what does each do?"],
    term: ["$ cd ~/mission2", "$ cat secret.hex", "486578206465636f646564212045766572792074776f", "2063686172616374657273207765726520...", "$ xxd -r -p secret.hex", "Hex decoded! Every two characters were one letter.", { hi: "Flag: CYBA{hex-...}" }, "$ submit CYBA{hex-...}", "Correct! +100 points"], fs: 13,
    happened: ["Hex is base 16: digits 0–9, then a–f for 10 to 15.", "Two hex characters are one byte: 48 is H, 65 is e.", "xxd -r reverses hex into bytes; -p reads plain hex."],
    real: "Analysts read hex all day: network packets, malware and memory dumps.",
    stretch: "What is 41 in hex as a letter? Check with  echo 41 | xxd -r -p.",
    answer: "cd ~/mission2; xxd -r -p secret.hex",
    notes: "If students forget -p, xxd expects addresses and prints nothing useful. That is a good teaching moment: read --help again.",
  },
  {
    name: "Thirteen steps", level: "Easy", skill: "tr  <", mode: "You do", mins: 4,
    where: "~/mission3/message.txt",
    brief: "The words look like words, but scrambled: every letter moved 13 places along the alphabet. Move them back.",
    ask: ["If A becomes N, what does N become?", "Why is ROT13 its own undo?", "How do we feed a file into tr?"],
    term: ["$ cd ~/mission3", "$ cat message.txt", "EBG13 vf n sha chmmyr, abg erny frphevgl.", "Synt: PLON{ebg-...}", "$ tr 'A-Za-z' 'N-ZA-Mn-za-m' < message.txt", "ROT13 is a fun puzzle, not real security.", { hi: "Flag: CYBA{rot-...}" }, "$ submit CYBA{rot-...}", "Correct! +100 points"], fs: 13,
    happened: ["The shape looked like a flag: Synt: PLON{...}. Letters moved, punctuation stayed.", "tr swapped every letter for the one 13 places on.", "< fed the file into tr, which only reads input."],
    real: "ROT13 hides spoilers and puzzle answers online. It was never meant as security.",
    stretch: "Run the tr command twice in a row with a pipe. What comes out?",
    answer: "cd ~/mission3; tr 'A-Za-z' 'N-ZA-Mn-za-m' < message.txt",
    notes: "The quotes matter: without them some shells expand the brackets. Uppercase and lowercase need their own ranges.",
  },
  {
    name: "Hail Caesar", level: "Medium", skill: "caesar all  |  grep", mode: "You do", mins: 5,
    where: "~/mission4/message.txt",
    brief: "Every letter was shifted the same number of places, but nobody wrote down how far. There are only 25 shifts. Try them all.",
    ask: ["How many possible keys does a Caesar cipher have?", "How will we spot the right shift among 25 lines?", "Which tool keeps only the line we want?"],
    term: ["$ cd ~/mission4", "$ cat message.txt", "Clup, cpkp, cpjp. Fvb jyhjrlk Jhlzhy.", "Mshn: JFIH{jhlzhy-...}", "$ caesar all message.txt | head -3", "shift 1: Dmvq, dqlq, dqkq. Gwc kziksml Kimaiz.", "shift 2: Enwr, ermr, erlr. Hxd lajltnm Ljnbja.", "$ caesar all message.txt | grep CYBA", { hi: "shift 19: Flag: CYBA{caesar-...}" }], fs: 12,
    happened: ["caesar all printed every one of the 25 possible shifts.", "We knew the flag starts with CYBA, so grep found the right line.", "Trying every key is called brute force."],
    real: "Attackers brute-force any key space that is small enough. Defenders make key spaces huge.",
    stretch: "The shift changes every game. What shift did your message use? What shift undoes it?",
    answer: "cd ~/mission4; caesar all message.txt | grep CYBA",
    notes: "This is the first 'unknown key' mission. Make the point: a key space of 25 is no protection at all.\n\nThe shift is random on every load (never 13).",
  },
  {
    name: "Mirror, mirror", level: "Medium", skill: "tr (reversed alphabet)", mode: "You do", mins: 4,
    where: "~/mission5/mirror.txt",
    brief: "The oldest cipher in the deck: the alphabet is flipped. A is Z, B is Y, C is X. Hold up a mirror.",
    ask: ["What does Z become under Atbash?", "Is there a key to guess?", "Which tool from Mission 3 swaps one set of letters for another?"],
    term: ["$ cd ~/mission5", "$ cat mirror.txt", "Gsilfts gsv ollprmt tozhh.", "Uozt: XBYZ{nriili-...}", "$ tr 'A-Za-z' 'ZYXWVUTSRQPONMLKJIHGFEDCBA", "  zyxwvutsrqponmlkjihgfedcba' < mirror.txt", "Through the looking glass.", { hi: "Flag: CYBA{mirror-...}" }], fs: 13,
    happened: ["Atbash maps each letter to its mirror: A↔Z, B↔Y.", "tr took the alphabet and the alphabet backwards.", "Like ROT13, doing it twice gets the original back."],
    real: "Atbash appears in ancient Hebrew texts. Today it is a classic first puzzle in CTFs.",
    stretch: "Which letters, if any, stay the same under Atbash? Under ROT13?",
    answer: "cd ~/mission5; tr 'A-Za-z' 'ZYX...CBAzyx...cba' < mirror.txt",
    notes: "The second set must be typed in full (26 uppercase, then 26 lowercase), all on one line. Typos here are the usual problem: count the letters.",
  },
  {
    name: "Dots and dashes", level: "Medium", skill: "morse", mode: "You do", mins: 4,
    where: "~/mission6/signal.txt",
    brief: "A signal of short and long beeps. Decode it, then build the flag yourself: README.txt tells you how.",
    ask: ["What do / and the spaces mean in Morse?", "Morse has no { or }. How can it carry a flag?", "Where are this mission's flag rules written?"],
    term: ["$ cd ~/mission6", "$ cat README.txt", "Decode signal.txt. It spells out a code.", "The flag is CYBA{morse-CODE}, with the code in lowercase.", "$ cat signal.txt", "- .... . / -.-. --- -.. . / .. ... / --... -... ...", "$ morse signal.txt", { hi: "THE CODE IS 7B0AB9BE" }, "$ submit CYBA{morse-7b0ab9be}   # yours differs"], fs: 12,
    happened: ["Morse turns letters into short (.) and long (-) signals.", "morse decoded it; the README said how to build the flag.", "Reading the instructions was half the mission."],
    real: "Morse still runs on ham radio and aviation beacons. Reading the brief carefully is a CTF superpower.",
    stretch: "Encode SOS with  echo SOS | morse -e. Why was it chosen for emergencies?",
    answer: "cd ~/mission6; morse signal.txt; submit CYBA{morse-<code in lowercase>}",
    notes: "The most common mistake: forgetting to lowercase the code. The README says so. Point there, don't answer.\n\nThe code shown on this slide is an example; every computer has its own.",
  },
  {
    name: "Fingerprints", level: "Medium", skill: "hashlines  |  grep", mode: "You do", mins: 5,
    where: "~/mission7/candidates.txt",
    brief: "One hundred possible flags. One of them has the fingerprint in target.sha256. You can't reverse a hash, but you can compare.",
    ask: ["Can we turn a hash back into text?", "If we hash every candidate, how do we find the match?", "How few characters of the hash do we need to grep for?"],
    term: ["$ cd ~/mission7", "$ cat target.sha256", "27662c13440b14e1cdd8fda516ef37fe1b2fb035...", "$ hashlines candidates.txt | head -2", "9c1f04e2...  CYBA{hash-1d03be55}", "e47a90b3...  CYBA{hash-80c2f1aa}", "$ hashlines candidates.txt | grep 27662c13", { hi: "27662c13440b14e1...  CYBA{hash-...}" }], fs: 12,
    happened: ["A hash is a fingerprint: same input, same hash, every time.", "hashlines fingerprinted all 100 candidates.", "grep found the one whose fingerprint matched the target."],
    real: "This is exactly how password crackers attack leaked password hashes with wordlists.",
    stretch: "Hash 'hello' and 'Hello' with sha256sum. How much of the hash changes?",
    answer: "cd ~/mission7; hashlines candidates.txt | grep $(cut -c1-8 target.sha256)",
    notes: "In real-Linux mode hashlines takes 15 to 25 seconds for 100 lines: it runs sha256sum once per line. Tell teams to wait for the prompt.",
  },
  {
    name: "XOR marks", level: "Hard", skill: "xor all  |  grep", mode: "You do", mins: 5,
    where: "~/mission8/cipher.hex",
    brief: "Every byte was XORed with the same secret key byte: a number from 1 to 255. Same trick as Caesar, bigger key space.",
    ask: ["How many keys does a single byte allow?", "Is 255 still small enough to try them all?", "What text do we know will be in the answer?"],
    term: ["$ cd ~/mission8", "$ cat cipher.hex", "15021f6d243e6d283b283f343a25283f286d2423", "6d202229283f236d2e3f343d3922...", "$ xor all cipher.hex | head -2", "key 1: ...l%?l):)>5;$)>)l%\"l!#()>\"l/>5<8#+>-<$5...", "key 2: ...o&<o*9*=68'*=*o&!o\" +*=!o,=6?; (=.?'6...", "...", "$ xor all cipher.hex | grep CYBA", { hi: "key 77: XOR is everywhere ...Flag: CYBA{xor-...}" }], fs: 12,
    happened: ["The file was hex, so xor first turned it back into bytes.", "xor all tried all 255 keys, one line per key.", "grep CYBA picked the only key that produced readable text."],
    real: "XOR is inside almost every modern cipher. Malware still hides strings with single-byte XOR.",
    stretch: "XOR twice with the same key: what do you get? Try  echo hi | xor -e 7 | xor 7.",
    answer: "cd ~/mission8; xor all cipher.hex | grep CYBA",
    notes: "The key is random each load. The newline shows as a dot in xor all; that is expected.",
  },
  {
    name: "Keyed up", level: "Hard", skill: "tr  then  vigenere -d", mode: "You do", mins: 6,
    where: "~/mission9/briefing.txt  secret.txt",
    brief: "secret.txt uses Vigenère: a keyword sets a different shift for each letter. Too many keys to brute-force, but someone left a briefing behind.",
    ask: ["Why won't caesar all work on Vigenère?", "The briefing is scrambled with a cipher we already know. Which one?", "What does the Vigenère tool need besides the file?"],
    term: ["$ cd ~/mission9", "$ cat briefing.txt", "OEVRSVAT: Gur xrljbeq vf UNEOBE. Gryy ab bar.", "$ tr 'A-Za-z' 'N-ZA-Mn-za-m' < briefing.txt", { hi: "BRIEFING: The keyword is HARBOR. Tell no one." }, "$ cat secret.txt", "Cixfbvye bfdk ptj tstyekt tfy tyssv ...", "$ vigenere -d HARBOR secret.txt", "Vigenere kept its secrets for three hundred years.", { hi: "Flag: CYBA{vig-...}" }], fs: 11.5,
    happened: ["The briefing was ROT13 (Mission 3), so tr revealed the keyword.", "Vigenère shifts each letter by the matching keyword letter.", "vigenere -d with the keyword undid it."],
    real: "Real attacks rarely break the cipher. They find the key: a sticky note, a leaked file, a reused password.",
    stretch: "Encrypt ATTACK with LEMON:  echo ATTACK | vigenere -e LEMON. Why do the two Ts differ?",
    answer: "cd ~/mission9; tr 'A-Za-z' 'N-ZA-Mn-za-m' < briefing.txt; vigenere -d <KEYWORD> secret.txt",
    notes: "The keyword is one of eight, picked at random: FALCON, ORCHID, JUPITER, GLACIER, PHOENIX, LANTERN, COMPASS, HARBOR.\n\nThe big idea: key management. The cipher held; the key leaked.",
  },
  {
    name: "The vault", level: "Very Hard", skill: "hashlines · base64 · vigenere", mode: "You do", mins: 8,
    where: "~/mission10/words.txt  key.sha256  vault.b64",
    brief: "Three skills in one. Crack the keyword's fingerprint against the wordlist, base64-decode the vault, then Vigenère-decrypt it.",
    ask: ["Which mission taught us to crack a hash with a list?", "The vault is base64 on the outside. What comes off first?", "How do we chain the decode straight into the decrypt?"],
    term: ["$ cd ~/mission10", "$ hashlines words.txt | grep $(cut -c1-8 key.sha256)", { hi: "914cb64a1bfac4c6...  otter" }, "$ base64 -d vault.b64", "Jtnpk cixrvr. Rhy sstm xys ybrrz fbwjwhg.", "$ base64 -d vault.b64 | vigenere -d otter", "Vault opened. You beat the final mission.", { hi: "Flag: CYBA{vault-...}" }, "$ submit CYBA{vault-...}", "Correct! +800 points"], fs: 11.5,
    happened: ["hashlines + grep cracked the keyword's hash, like Mission 7.", "base64 -d peeled off the outer layer, like Mission 1.", "The pipe fed it straight into vigenere -d, like Mission 9."],
    real: "Real investigations chain small steps exactly like this: identify, peel a layer, check, repeat.",
    stretch: "Which single step would have been impossible without the wordlist? Why?",
    answer: "hashlines words.txt | grep <hash start>;  base64 -d vault.b64 | vigenere -d <word>",
    notes: "The keyword is one of 100 words, picked at random each load. 'otter' on this slide is an example.\n\nIf students type $(...) in lite mode it will not work: they can type the first 8 characters of the hash by hand instead.",
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
    "Welcome the class and introduce the mentors: name, what you do, and one sentence on where you meet cryptography at work.\n\n" +
    "Promise: 'In this session you will learn how secret codes work, how codebreakers think, and crack a cipher the way security pros do.'\n\n" +
    "Before class: the Crypto CTF link is written on the 'Open the CTF' slide in the appendix, and you have watched it reach 'Ready' on a student Chromebook on the school network.");
  s.addText("CyberQuest", { x: M, y: 1.35, w: 6.6, h: 1.3, fontFace: HEAD, fontSize: 72, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Crypto CTF: crack the codes, then compete.", { x: M, y: 2.75, w: 6.3, h: 1.1, fontFace: BODY, fontSize: 28, color: T_OUT, margin: 0, isTextBox: true });
  chip(s, "simulated CTF competition", M, 4.15, 3.0, AMBER, INK, 15);
  s.addText("CyberQuest Academy mentorship session", { x: M, y: 4.85, w: 6, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: WHITE, margin: 0, isTextBox: true });
  trail(s, M, 5.85, 6.0, N + 1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 1.2, w: 5.43, h: 4.95, fill: { color: "162238" }, rectRadius: 0.12, line: { color: "2B3B5C", width: 1 } });
  ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: 7.55 + i * 0.24, y: 1.4, w: 0.14, h: 0.14, fill: { color: c } }));
  s.addText([
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "cat welcome.txt", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "Jrypbzr, pbqroernxre.", options: { color: T_OUT, breakLine: true } },
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "caesar 13 welcome.txt", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "Welcome, codebreaker.", options: { color: T_PROMPT, bold: true, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "./start-ctf", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "10 ciphers", options: { color: T_OUT, breakLine: true } },
    { text: "2,700 points up for grabs", options: { color: T_OUT, breakLine: true } },
    { text: "Good luck.", options: { color: AMBER, bold: true } },
  ], { x: 7.65, y: 1.85, w: 4.8, h: 4.1, fontFace: MONO, fontSize: 18, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 3 });

  // ---- run of show ----
  s = newSlide("How today works",
    "Set expectations up front. This is a focused, mentor-led session, not a race to finish every cipher. The goal is that students understand how codebreakers think - and most of all, how a CTF actually works: read the challenge, spot the method, try a decoder, read the output, adjust, capture a flag.\n\n" +
    "Say it plainly: 'You will NOT crack every cipher today, and that is fine. We want you to understand the process and feel confident starting a challenge on your own.'\n\n" +
    "The arc below is the shape of the session: short theory, one flag cracked together, then you start one yourself, then we reflect.");
  s.addImage({ data: await mountainPng(), x: 9.55, y: 0.12, w: 3.3, h: 1.65 });
  const arc = [["Concept", "What a crypto CTF is, and why codes matter.", MC[0], fa.FaLightbulb], ["Mental model", "How codebreakers think: identify, then reverse.", MC[1], fa.FaBrain], ["Tools", "A handful of decoders - just what a cipher needs.", MC[2], fa.FaKey], ["Guided", "We crack a cipher together, step by step.", MC[3], fa.FaMapLocationDot], ["Independent", "You start a cipher yourself. Finishing is optional.", MC[4], fa.FaPersonHiking], ["Reflection", "Why it worked, and where this leads.", GREEN, fa.FaClipboardCheck]];
  const CW = 3.95, CH = 1.98, GX = 4.19;
  for (let i = 0; i < arc.length; i++) {
    const [name, what, color, Icon] = arc[i];
    const x = M + (i % 3) * GX, y = 1.78 + Math.floor(i / 3) * 2.18;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: CW, h: CH, fill: { color: tint(color, 0.9) }, line: { color: tint(color, 0.68), width: 1 }, rectRadius: 0.12 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.56, h: 0.56, fill: { color } });
    s.addText(String(i + 1), { x: x + 0.3, y: y + 0.3, w: 0.56, h: 0.56, fontFace: HEAD, fontSize: 20, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, name, x + 1.0, y + 0.3, 2.5, 0.56, { fontFace: HEAD, fontSize: 21, bold: true, color, valign: "middle" });
    text(s, what, x + 0.32, y + 1.0, 2.35, 0.9, { fontSize: 14.5, color: INK });
    await iconTintCircle(s, Icon, x + CW - 1.12, y + 0.92, 0.92, color);
    if (i % 3 < 2) s.addShape(pres.shapes.LINE, { x: x + CW + 0.02, y: y + CH / 2, w: GX - CW - 0.04, h: 0, line: { color: "9AA7BD", width: 2, endArrowType: "triangle" } });
  }
  const dy = 1.78 + 2 * 2.18 - 0.08;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: dy, w: W - 2 * M, h: 0.84, fill: { color: "EAF2FD" }, line: { color: "CFE0F6", width: 1 }, rectRadius: 0.1 });
  await iconTintCircle(s, fa.FaGraduationCap, M + 0.28, dy + 0.17, 0.5, BLUE);
  text(s, [{ text: "The deal: ", options: { bold: true, color: BLUE } }, { text: "no maths degree needed. Spotting what a cipher is and reading what comes back is how everyone learns this." }], M + 1.0, dy, W - 2 * M - 1.3, 0.84, { valign: "middle", fontSize: 16.5 });

  // ---- what is a crypto CTF ----
  s = newSlide("What is a crypto CTF?",
    "A capture the flag, or CTF, is a puzzle competition for security skills. In a crypto CTF, every flag is hidden inside a code or a cipher. Work out what you are looking at, undo it, submit the flag.\n\n" +
    "Read the flag anatomy out loud. Every flag starts with CYBA and has its secret between curly braces. That known start is a codebreaker's gift: it tells you when a guess is right.\n\n" +
    "Stress permission: breaking codes you were handed in a CTF is practice. Breaking someone else's is a crime.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "PLON{pnrfne-4p8p640o}", options: { color: T_NOTE, bold: true } }, { text: "   >   ", options: { color: MUTED, bold: true } }, { text: "CYBA", options: { color: "7FB2FF", bold: true } }, { text: "{", options: { color: AMBER, bold: true } }, { text: "caesar-4c8c640b", options: { color: T_PROMPT, bold: true } }, { text: "}", options: { color: AMBER, bold: true } }],
    { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 26, align: "center", valign: "middle", margin: 0, isTextBox: true });
  [["Scrambled", "C07A00", "What you're given", "A flag hidden in base64, hex, a cipher or a hash."], ["Undo it", "2459D8", "Your job", "Spot the method, pick the tool, reverse it."], ["CYBA{...}", "17875A", "The proof", "Readable text and CYBA{ at the start: you cracked it."]].forEach(([tok, color, head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 3.45, 3.9, 1.65);
    mono(s, tok, x + 0.25, 3.6, 3.4, 0.4, { fontSize: 19, color });
    text(s, head, x + 0.25, 4.05, 3.4, 0.35, { fontSize: 16, bold: true });
    text(s, body, x + 0.25, 4.42, 3.45, 0.6, { fontSize: 14, color: MUTED });
  });
  const round = [["Identify", "the code"], ["Decode", "with the right tool"], ["Submit", "the whole flag"], ["Score", "points on the board"]];
  round.forEach(([a, b], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.45, w: 2.6, h: 1.0, fill: { color: MC[i + 1] }, rectRadius: 0.1 });
    s.addText([{ text: a, options: { bold: true, fontSize: 20, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x, y: 5.45, w: 2.6, h: 1.0, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addText(">", { x: x + 2.6, y: 5.45, w: 0.47, h: 1.0, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });

  // ---- the CTF flow (the core activity concept) ----
  s = newSlide("The flow of every challenge",
    "This is the single most important idea in the session. Every CTF challenge - and a lot of real security work - runs this same loop. Say it out loud, and point back to it every time the room gets stuck.\n\n" +
    "The key move is the middle of the loop: you TRY a decoder, CHECK what came back, and ADJUST. Nobody is expected to know the answer up front. Reading the output and adjusting IS the skill. For crypto, 'Observe the clues' is where you ask: is this base64, hex, a shifted alphabet, a hash?\n\n" +
    "Capturing the flag is just where the loop ends. The habit of read, try, check, adjust is what students should leave with.");
  const flow = [["Read", "the challenge", fa.FaBookOpen], ["Observe", "the clues", fa.FaMagnifyingGlass], ["Choose", "a decoder", fa.FaScrewdriverWrench], ["Try", "a command", fa.FaTerminal], ["Check", "the output", fa.FaEye], ["Adjust", "if needed", fa.FaArrowsRotate], ["Capture", "the flag", fa.FaFlag], ["Submit", "& reflect", fa.FaCircleCheck]];
  for (let i = 0; i < flow.length; i++) {
    const [head, body, Icon] = flow[i];
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * 3.08, y = 1.65 + row * 2.45, color = MC[i % 6];
    card(s, x, y, 2.85, 2.2);
    await iconCircle(s, Icon, x + 0.95, y + 0.25, 0.9, color);
    text(s, head, x + 0.15, y + 1.28, 2.55, 0.45, { fontFace: HEAD, fontSize: 20, bold: true, align: "center" });
    text(s, body, x + 0.15, y + 1.72, 2.55, 0.4, { fontSize: 14, color: MUTED, align: "center" });
    if (col < 3) s.addText(">", { x: x + 2.85, y: y + 0.55, w: 0.23, h: 0.6, fontFace: MONO, fontSize: 20, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  text(s, "read -> try -> check -> adjust is the loop. Capturing the flag is just where it ends.", M, 6.62, W - 2 * M, 0.35, { fontSize: 13, color: MUTED, align: "center" });

  // ===========================================================================
  // PART 1: CRYPTO FUNDAMENTALS
  // ===========================================================================
  section("Part 1 · Crypto fundamentals");
  divider(1, "Crypto fundamentals", "2,500 years of secret messages, the three ways to hide data, and why key size is everything.", MC[0], "echo 'Uryyb' | tr A-Za-z N-ZA-Mn-za-m",
    "Section break. Ask: 'Who has ever written a secret message to a friend?' Most hands go up. That is cryptography.\n\nThe command on screen is ROT13: you will learn it in Part 2. (It prints Hello.)");

  // ---- history ----
  s = newSlide("2,500 years of secret messages",
    "A fast tour. Each step was invented because the previous one got broken.\n\n" +
    "Atbash (around 500 BC): flip the alphabet. Appears in Hebrew scripture. No key at all.\n" +
    "Caesar (around 50 BC): Julius Caesar shifted letters by 3 to write to his generals.\n" +
    "Vigenère (1553): first described by Giovan Battista Bellaso, later credited to Blaise de Vigenère. A keyword sets a different shift per letter. Called 'the indecipherable cipher' for about 300 years.\n" +
    "Enigma (1940s): German machine cipher broken at Bletchley Park by Alan Turing, Joan Clarke and team; historians credit it with shortening the war.\n" +
    "Public-key (1976–77): Diffie and Hellman, then Rivest, Shamir and Adleman (RSA). Two strangers can agree on a secret in public. This made online shopping possible.\n" +
    "Today: HTTPS, end-to-end messaging and AES protect billions of conversations a day.\n\n" +
    "Point out: missions 3, 4, 5 and 9 use the first three ciphers on this timeline.");
  const hist = [["~500 BC", "Atbash", "Flip the alphabet: A↔Z.", MC[0]], ["~50 BC", "Caesar", "Shift every letter 3 places.", MC[1]], ["1553", "Vigenère", "A keyword sets each shift. Unbroken for 300 years.", MC[2]], ["1940s", "Enigma", "A machine cipher, broken at Bletchley Park.", MC[3]], ["1976", "Public key", "Strangers share secrets in public.", MC[4]], ["Today", "HTTPS & AES", "Billions of protected messages a day.", MC[7]]];
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 2.47, w: W - 2 * M, h: 0.06, fill: { color: LINE } });
  hist.forEach(([yr, name, what, color], i) => {
    const x = M + i * 2.04;
    s.addShape(pres.shapes.OVAL, { x: x + 0.72, y: 2.27, w: 0.46, h: 0.46, fill: { color }, line: { color: WHITE, width: 3 } });
    text(s, yr, x, 1.6, 1.9, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color, align: "center" });
    card(s, x, 3.0, 1.9, 2.55);
    text(s, name, x + 0.15, 3.15, 1.6, 0.5, { fontFace: HEAD, fontSize: 17, bold: true });
    text(s, what, x + 0.15, 3.7, 1.65, 1.7, { fontSize: 14, color: MUTED });
  });
  card(s, M, 5.85, W - 2 * M, 0.75, "FFF4DC");
  text(s, [{ text: "The pattern: ", options: { bold: true } }, { text: "every cipher gets broken eventually. Codebreakers are why codes keep getting better." }], M + 0.3, 5.85, W - 2 * M - 0.6, 0.75, { valign: "middle", fontSize: 17 });

  // ---- encoding vs encryption vs hashing ----
  s = newSlide("Three ways to hide data",
    "The single most important idea of the session. Every mission today is one of these three.\n\n" +
    "Encoding (base64, hex, Morse): changes how data looks. No key. Anyone can reverse it. Used to move data safely, never to keep secrets.\n\n" +
    "Encryption (Caesar, Vigenère, XOR, AES): needs a key. Without the key you either find it (missions 9 and 10) or try every key (missions 4 and 8).\n\n" +
    "Hashing (SHA-256): a one-way fingerprint. You cannot reverse it; you can only hash guesses and compare (missions 7 and 10).\n\n" +
    "Ask: 'Which one would you use to store passwords?' Hashing: the site never needs the password back, only to check it.", "echo hi | sha256sum");
  const three = [
    ["Encoding", "No key. Anyone can reverse it.", "base64  hex  Morse", "aGkK", "Missions 1, 2, 6", MC[1]],
    ["Encryption", "Needs a key to reverse.", "Caesar  Vigenère  XOR  AES", "uv", "Missions 3–5, 8–10", MC[3]],
    ["Hashing", "One way. Can't be reversed, only compared.", "SHA-256", "98ea6e4f...", "Missions 7, 10", MC[4]],
  ];
  three.forEach(([name, rule, ex, sample, which, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.65, 3.9, 4.85);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 3.9, h: 0.12, fill: { color } });
    text(s, name, x + 0.3, 1.95, 3.3, 0.6, { fontFace: HEAD, fontSize: 28, bold: true, color });
    text(s, rule, x + 0.3, 2.6, 3.3, 0.8, { fontSize: 17, bold: true });
    text(s, "Examples", x + 0.3, 3.5, 3.3, 0.35, { fontSize: 12, bold: true, color: MUTED });
    mono(s, ex, x + 0.3, 3.82, 3.4, 0.45, { fontSize: 14 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 4.45, w: 3.3, h: 0.95, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText([{ text: "hi  >  ", options: { color: T_NOTE } }, { text: sample, options: { color: AMBER } }], { x: x + 0.45, y: 4.45, w: 3.1, h: 0.95, fontFace: MONO, fontSize: 17, bold: true, valign: "middle", margin: 0, isTextBox: true });
    text(s, which, x + 0.3, 5.6, 3.3, 0.6, { fontSize: 14, color: MUTED, valign: "middle" });
  });

  // ---- crypto is everywhere ----
  s = newSlide("Crypto is in your pocket",
    "Make it personal. Students use strong cryptography dozens of times a day without noticing.\n\n" +
    "HTTPS: the padlock in the browser. Messaging apps with end-to-end encryption. Your phone's lock screen encrypts the storage. Sites store a hash of your password, not the password. Wi-Fi uses WPA2/WPA3. Contactless payments sign each transaction.\n\n" +
    "Ask: 'What did you do this morning that used cryptography?'");
  const pocket = [[fa.FaLock, "The padlock", "HTTPS encrypts every page between you and the site.", MC[1]], [fa.FaComments, "Messages", "End-to-end encryption: only the two phones hold the keys.", MC[2]], [fa.FaKey, "Passwords", "Sites keep a hash of your password, not the password itself.", MC[3]], [fa.FaWifi, "Wi-Fi", "WPA2 and WPA3 encrypt the air between you and the router.", MC[4]], [fa.FaCreditCard, "Tap to pay", "Each payment is signed, so it can't be copied and replayed.", MC[5]], [fa.FaMobileScreen, "Phone unlock", "Your passcode unlocks the key that decrypts your phone.", MC[7]]];
  for (let i = 0; i < pocket.length; i++) {
    const [Icon, head, body, color] = pocket[i];
    const x = M + (i % 3) * 4.11, y = 1.65 + Math.floor(i / 3) * 2.45;
    card(s, x, y, 3.9, 2.25);
    await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.8, color);
    text(s, head, x + 1.3, y + 0.35, 2.4, 0.7, { fontFace: HEAD, fontSize: 21, bold: true, valign: "middle" });
    text(s, body, x + 0.3, y + 1.25, 3.35, 0.9, { fontSize: 15, color: MUTED });
  }

  // ---- keys and brute force ----
  s = newSlide("Key size is everything",
    "Brute force means trying every key. Whether that works depends only on how many keys there are.\n\n" +
    "Caesar: 25 keys. A human can try them all in minutes; a computer in microseconds. (Mission 4.)\n" +
    "Single-byte XOR: 255 keys. Still instant. (Mission 8.)\n" +
    "A 6-letter Vigenère keyword: 26 to the 6th, about 309 million. A laptop gets through that, but not by hand, and longer keywords grow fast. That's why in Mission 9 we find the key instead.\n" +
    "AES-128: 2 to the 128th, about 3.4 × 10^38 keys. Every computer on Earth working together would need far longer than the age of the universe.\n\n" +
    "The lesson: real crypto isn't broken by guessing keys. It's broken by stealing keys, weak passwords and bad implementations.");
  const keys = [["Caesar", "25", "Mission 4", "Try them all by hand", 0.06, MC[1]], ["Single-byte XOR", "255", "Mission 8", "Instant for a computer", 0.14, MC[3]], ["6-letter Vigenère", "308,915,776", "Mission 9", "Find the key instead", 0.45, MC[4]], ["AES-128", "3.4 × 10³⁸", "Real world", "Longer than the age of the universe", 1.0, RED]];
  keys.forEach(([name, n, which, verdict, frac, color], i) => {
    const y = 1.65 + i * 1.18;
    text(s, name, M, y, 2.9, 0.45, { fontSize: 18, bold: true });
    text(s, which, M, y + 0.45, 2.9, 0.35, { fontSize: 13, color: MUTED });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.6, y: y + 0.08, w: 9.13, h: 0.7, fill: { color: "E4EAF3" }, rectRadius: 0.08 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.6, y: y + 0.08, w: Math.max(0.55, 9.13 * frac), h: 0.7, fill: { color }, rectRadius: 0.08 });
    s.addText([{ text: n + " keys", options: { bold: true, color: frac > 0.3 ? WHITE : INK } }], { x: frac > 0.3 ? 3.8 : 3.6 + Math.max(0.55, 9.13 * frac) + 0.2, y: y + 0.08, w: 4.2, h: 0.7, fontFace: MONO, fontSize: 16, valign: "middle", margin: 0, isTextBox: true });
    text(s, verdict, 8.3, y + 0.08, 4.3, 0.7, { fontSize: 14, bold: true, color: frac > 0.6 ? WHITE : MUTED, align: "right", valign: "middle" });
  });
  text(s, "Bar lengths are not to scale. On a true scale, Caesar's bar would be invisible.", M, 6.5, 10, 0.35, { fontSize: 12, color: MUTED });

  // ---- identify what you're looking at ----
  s = newSlide("First, identify what you're looking at",
    "Half of every crypto CTF is recognising the method. Teach these six fingerprints; students will lean on this slide all session.\n\n" +
    "Base64: letters, digits, + and /, often ending in = or ==. Length a multiple of 4.\n" +
    "Hex: only 0–9 and a–f, an even number of characters.\n" +
    "Morse: only dots, dashes, spaces and slashes.\n" +
    "Caesar or ROT13: real-looking punctuation and word lengths, nonsense letters. A flag shape like XXXX{...}.\n" +
    "Atbash: same look as Caesar. If caesar all finds nothing, try the mirror.\n" +
    "SHA-256: exactly 64 hex characters.\n\n" +
    "Leave this slide up while students work if you can.");
  const ids = [["Base64", "RW5jb2RpbmcgaXMg...==", "Letters, digits, + /, ends in =", "base64 -d", MC[0]], ["Hex", "48657820646563...", "Only 0–9 and a–f", "xxd -r -p", MC[1]], ["Morse", "- .... . / -.-. ---", "Only . - and /", "morse", MC[5]], ["Caesar / ROT13", "Mshn: JFIH{...}", "Word shapes kept, letters wrong", "caesar all | grep", MC[3]], ["Atbash", "Uozt: XBYZ{...}", "Same look; caesar all finds nothing", "tr (flipped)", MC[4]], ["SHA-256", "27662c13440b...(64)", "Exactly 64 hex characters", "hashlines | grep", MC[2]]];
  ids.forEach(([name, sample, tell, tool, color], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.65;
    card(s, x, y, 5.96, 1.5);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.12, h: 1.5, fill: { color } });
    text(s, name, x + 0.35, y + 0.12, 2.6, 0.45, { fontFace: HEAD, fontSize: 19, bold: true, color });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 3.1, y: y + 0.15, w: 2.65, h: 0.42, fill: { color: TERM }, rectRadius: 0.06 });
    s.addText(tool, { x: x + 3.1, y: y + 0.15, w: 2.65, h: 0.42, fontFace: MONO, fontSize: 13, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
    mono(s, sample, x + 0.35, y + 0.65, 5.4, 0.35, { fontSize: 13, color: INK, bold: false });
    text(s, tell, x + 0.35, y + 1.02, 5.4, 0.35, { fontSize: 13.5, color: MUTED });
  });

  // ===========================================================================
  // PART 2: THE CODEBREAKER'S TOOLKIT
  // ===========================================================================
  section("Part 2 · Codebreaker's toolkit");
  divider(2, "The codebreaker's toolkit", "Open the Crypto CTF, then one tool per cipher, in the order the missions need them. Every slide has a Try it.", MC[2], "caesar --help   # every tool explains itself",
    "Section break. Open the Crypto CTF now (mentor appendix: 'Open the CTF'), so every device is booted for the Try it pills.\n\nDemo every command live on the projector. Then give the room 30 seconds to type the green Try it command themselves.\n\nNone of the Try it commands touch the mission folders, so nothing gets spoiled.");

  // ---- base64 and hex ----
  s = newSlide("Encodings: base64 and hex",
    "Two encodings, two tools. Both are 'encode one way, decode the other' with no key.\n\n" +
    "base64 turns any data into 64 safe characters. base64 -d decodes. The = at the end is padding.\n\n" +
    "Hex writes each byte as two characters from 0–9 and a–f. xxd shows hex; xxd -r -p turns plain hex back into text. -r means reverse, -p means plain (no addresses).\n\n" +
    "Have students run the Try it, then decode it again: echo aGkK | base64 -d.", "echo hi | base64");
  forMission(s, [1, 2]);
  cmdRow(s, "base64", "encode text as base64", M, 1.75, 5.9, 2.3);
  cmdRow(s, "base64 -d", "decode it again", M, 2.4, 5.9, 2.3);
  cmdRow(s, "xxd -p", "show text as plain hex", M, 3.25, 5.9, 2.3);
  cmdRow(s, "xxd -r -p", "turn plain hex back into text", M, 3.9, 5.9, 2.3);
  card(s, M, 4.75, 5.9, 1.75, "FFF4DC");
  text(s, [{ text: "Encoding is not encryption. ", options: { bold: true } }, { text: "There is no key. Anyone who recognises the format can read it. It moves data safely; it does not keep secrets." }], M + 0.3, 4.85, 5.3, 1.55, { fontSize: 16, valign: "middle" });
  term(s, 6.9, 1.6, 5.83, 4.9, ["$ echo hi | base64", "aGkK", "$ echo aGkK | base64 -d", { hi: "hi" }, "$ echo hi | xxd -p", "68690a", "$ echo 68690a | xxd -r -p", { hi: "hi" }, "# 68 = h, 69 = i, 0a = new line"], { fontSize: 16, title: "player@quest" });

  // ---- tr: ROT13 and Atbash ----
  s = newSlide("Swap letters: ROT13 and Atbash",
    "tr (translate) swaps characters one for one: every character of the first set becomes the matching character of the second set.\n\n" +
    "ROT13: A-Z becomes N-Z then A-M (13 places on). Add the same for lowercase.\n\n" +
    "Atbash: the second set is the alphabet backwards.\n\n" +
    "tr only reads input, never a file name: pipe text in with |, or feed a file with <. Quote both sets.", "echo HI | tr A-Z N-ZA-M");
  forMission(s, [3, 5, 9]);
  const trs = [["ROT13", "A B C ... M N O ... Z", "N O P ... Z A B ... M", "tr 'A-Za-z' 'N-ZA-Mn-za-m'", MC[2]], ["Atbash", "A B C ... X Y Z", "Z Y X ... C B A", "tr 'A-Z' 'ZYXWVUTSRQPONMLKJIHGFEDCBA'", MC[4]]];
  trs.forEach(([name, from, to, cmd, color], i) => {
    const y = 1.65 + i * 2.1;
    card(s, M, y, 7.0, 1.9);
    text(s, name, M + 0.3, y + 0.15, 2, 0.45, { fontFace: HEAD, fontSize: 21, bold: true, color });
    mono(s, from, M + 2.2, y + 0.15, 4.6, 0.4, { fontSize: 15, color: MUTED, bold: false });
    mono(s, to, M + 2.2, y + 0.6, 4.6, 0.4, { fontSize: 15, color });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.3, y: y + 1.15, w: 6.4, h: 0.55, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: M + 0.45, y: y + 1.15, w: 6.2, h: 0.55, fontFace: MONO, fontSize: 13, bold: true, color: T_CMD, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
  });
  card(s, M, 5.95, 7.0, 0.6, "E2F5EC");
  text(s, "Both are their own undo: run them twice and you're back.", M + 0.3, 5.95, 6.5, 0.6, { valign: "middle", fontSize: 15, bold: true, color: "0F6A45" });
  term(s, 7.9, 1.6, 4.83, 4.95, ["$ echo HELLO | tr A-Z N-ZA-M", { hi: "URYYB" }, "$ echo URYYB | tr A-Z N-ZA-M", "HELLO", "$ tr A-Z a-z < notes.txt", "# < feeds a file into tr"], { fontSize: 14, title: "player@quest" });

  // ---- brute force ----
  s = newSlide("Brute force: try every key",
    "When the key space is small, don't guess: try them all and let grep find the readable one.\n\n" +
    "caesar N shifts by N; caesar all prints all 25 shifts, one line each.\n" +
    "xor all does the same for single-byte XOR: 255 lines, one per key.\n\n" +
    "The trick that makes it fast: we know the answer contains CYBA. Pipe into grep CYBA and only the right line survives. That 'known plaintext' trick broke Enigma too: the codebreakers guessed words like weather reports.", "echo Khoor | caesar all");
  forMission(s, [4, 8]);
  cmdRow(s, "caesar N", "shift every letter N places", M, 1.75, 6.2, 2.4);
  cmdRow(s, "caesar all", "try all 25 shifts", M, 2.4, 6.2, 2.4);
  cmdRow(s, "xor all", "try all 255 XOR keys", M, 3.05, 6.2, 2.4);
  cmdRow(s, "| grep CYBA", "keep only the readable line", M, 3.7, 6.2, 2.4);
  card(s, M, 4.55, 6.2, 1.95, "FFF4DC");
  text(s, [{ text: "Known plaintext. ", options: { bold: true } }, { text: "Every flag starts with CYBA. Knowing a piece of the answer is how Bletchley Park broke Enigma: they guessed words like 'weather'." }], M + 0.3, 4.65, 5.6, 1.75, { fontSize: 16, valign: "middle" });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ echo Khoor | caesar all", "shift 1: Lipps", "shift 2: Mjqqt", "...", { hi: "shift 23: Hello" }, "...", "shift 25: Jgnnq", "$ echo Khoor | caesar all | grep ell", { hi: "shift 23: Hello" }], { fontSize: 15, title: "player@quest" });

  // ---- morse ----
  s = newSlide("Dots and dashes: morse",
    "Morse code is an encoding from the 1830s: each letter is a pattern of short (.) and long (-) signals. Letters are separated by spaces, words by /.\n\n" +
    "morse FILE decodes; morse -e encodes. Morse has only capital letters and digits: no punctuation, no curly braces. That's why Mission 6 tells you how to build the flag from the code.", "echo SOS | morse -e");
  forMission(s, [6]);
  const mz = [["A", ".-"], ["E", "."], ["O", "---"], ["S", "..."], ["T", "-"], ["1", ".----"]];
  mz.forEach(([ch, code], i) => {
    const x = M + (i % 3) * 2.15, y = 1.75 + Math.floor(i / 3) * 1.35;
    card(s, x, y, 2.0, 1.2);
    text(s, ch, x + 0.2, y + 0.15, 0.6, 0.9, { fontFace: HEAD, fontSize: 36, bold: true, color: MC[5], valign: "middle" });
    mono(s, code, x + 0.8, y + 0.15, 1.15, 0.9, { fontSize: 22, valign: "middle" });
  });
  cmdRow(s, "morse FILE", "decode Morse code", M, 4.6, 6.3, 2.4);
  cmdRow(s, "morse -e", "encode text as Morse", M, 5.25, 6.3, 2.4);
  text(s, "Space between letters, / between words.", M, 5.95, 6.3, 0.4, { fontSize: 14, color: MUTED });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ echo SOS | morse -e", { hi: "... --- ..." }, "$ echo '.... ..' | morse", "HI", "$ morse --help", "# every tool explains itself"], { fontSize: 15, title: "player@quest" });

  // ---- hashes ----
  s = newSlide("Hashes: one-way fingerprints",
    "A hash function turns any text into a fixed-length fingerprint. SHA-256 always gives 64 hex characters.\n\n" +
    "Same input, same hash, every time. Change one letter and the whole hash changes. And there is no 'unhash'.\n\n" +
    "So how do we crack one? Guess. Hash every candidate from a list and compare. hashlines does that for every line of a file. This is exactly how real password cracking works, which is why long, unusual passwords matter.", "echo hello | sha256sum");
  forMission(s, [7, 10]);
  cmdRow(s, "sha256sum", "fingerprint a file or text", M, 1.75, 6.2, 2.4);
  cmdRow(s, "hashlines", "fingerprint every line of a file", M, 2.4, 6.2, 2.4);
  cmdRow(s, "| grep 2cf2", "find the matching fingerprint", M, 3.05, 6.2, 2.4);
  card(s, M, 3.9, 6.2, 2.6, "FFF4DC");
  text(s, "A wordlist attack", M + 0.3, 4.05, 5.6, 0.4, { fontSize: 17, bold: true });
  numbered(s, ["Hash every guess in the list.", "Compare each hash with the target.", "The match is the original text."], M + 0.3, 4.6, 5.6, 0.6, MC[6], 15);
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ echo hello | sha256sum", "5891b5b522d5df08...  -", "$ echo Hello | sha256sum", { hi: "66a045b452102c59...  -" }, "# one letter changed, every character changed", "$ hashlines guesses.txt", "2cf24dba5fb0a30e...  hello", "486ea46224d1bb4f...  world"], { fontSize: 13.5, title: "player@quest" });

  // ---- XOR ----
  s = newSlide("XOR: the building block",
    "XOR compares two bits: 1 if they differ, 0 if they're the same. XOR a byte with a key to hide it; XOR with the same key again to get it back.\n\n" +
    "Real ciphers like AES use XOR inside, with huge keys. Mission 8 uses a single byte as the key: only 255 possibilities, so it is brute-forced exactly like Caesar.\n\n" +
    "xor -e KEY encodes text to hex; xor KEY decodes hex; xor all tries every key.", "echo hi | xor -e 7");
  forMission(s, [8]);
  const xt = [["0", "0", "0"], ["0", "1", "1"], ["1", "0", "1"], ["1", "1", "0"]];
  card(s, M, 1.7, 3.5, 3.1);
  ["bit", "key", "XOR"].forEach((h, j) => text(s, h, M + 0.35 + j * 1.0, 1.85, 0.9, 0.4, { fontSize: 14, bold: true, color: MUTED, align: "center" }));
  xt.forEach((row, i) => row.forEach((v, j) => mono(s, v, M + 0.35 + j * 1.0, 2.35 + i * 0.58, 0.9, 0.5, { fontSize: 22, align: "center", color: j === 2 ? MC[7] : INK })));
  card(s, M + 3.75, 1.7, 3.0, 3.1, "FFF4DC");
  text(s, [{ text: "Same key twice = undo.", options: { bold: true, breakLine: true } }, { text: "text XOR key = cipher", options: { breakLine: true } }, { text: "cipher XOR key = text" }], M + 4.0, 1.85, 2.6, 2.8, { fontSize: 15, valign: "middle" });
  cmdRow(s, "xor -e KEY", "hide text, print hex", M, 5.05, 6.75, 2.4);
  cmdRow(s, "xor all", "try all 255 keys", M, 5.7, 6.75, 2.4);
  term(s, 7.7, 1.6, 5.03, 4.9, ["$ echo hi | xor -e 7", "6f6e0d", "$ echo 6f6e0d | xor 7", { hi: "hi" }, "$ echo 6f6e0d | xor all | head -3", "key 1: no.", "key 2: ml.", "key 3: lm."], { fontSize: 15, title: "player@quest" });

  // ---- vigenère ----
  s = newSlide("Vigenère: a keyword sets the shifts",
    "Vigenère is Caesar with a different shift for each letter. The keyword repeats under the message; each keyword letter says how far to shift (A = 0, B = 1, ... Z = 25).\n\n" +
    "Example: ATTACK with LEMON. A+L = L, T+E = X, T+M = F, A+O = O, C+N = P, K+L = V. Notice the two Ts become different letters: that's what beat simple frequency analysis for 300 years.\n\n" +
    "Too many keys to try by hand, so in Mission 9 we find the keyword instead. vigenere -e KEY encrypts, vigenere -d KEY decrypts.", "echo HI | vigenere -e KEY");
  forMission(s, [9, 10]);
  const pt = "ATTACK".split(""), ky = "LEMONL".split(""), ct = "LXFOPV".split("");
  [["text", pt, INK], ["key", ky, MC[4]], ["cipher", ct, MC[8]]].forEach(([lbl, row, color], r) => {
    text(s, lbl, M, 1.85 + r * 0.9, 1.3, 0.7, { fontSize: 15, bold: true, color: MUTED, valign: "middle" });
    row.forEach((ch, j) => {
      const x = M + 1.4 + j * 0.9;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.85 + r * 0.9, w: 0.75, h: 0.7, fill: { color: r === 1 ? "F3EEFF" : TINT }, rectRadius: 0.08 });
      mono(s, ch, x, 1.85 + r * 0.9, 0.75, 0.7, { fontSize: 24, color, align: "center", valign: "middle" });
    });
  });
  cmdRow(s, "vigenere -e KEY", "encrypt with a keyword", M, 4.75, 6.6, 2.8);
  cmdRow(s, "vigenere -d KEY", "decrypt with the keyword", M, 5.4, 6.6, 2.8);
  term(s, 7.6, 1.6, 5.13, 4.9, ["$ echo ATTACK | vigenere -e LEMON", { hi: "LXFOPV" }, "$ echo LXFOPV | vigenere -d LEMON", "ATTACK", "# the two Ts became X and F"], { fontSize: 15, title: "player@quest" });

  // ---- pipes ----
  s = newSlide("Chain decoders with pipes",
    "The pipe | sends one command's output straight into the next. In crypto CTFs, layers are common: base64 on the outside, a cipher inside. Peel them one pipe at a time.\n\n" +
    "Build the chain step by step: run the first command, look at the output, identify it, add the next tool. Never type the whole chain at once.\n\n" +
    "Mission 10 is three layers. Mission 9 is two steps in a row.", "echo aGkK | base64 -d");
  forMission(s, [10]);
  const chain = [["vault.b64", "base64 on the outside", MC[0]], ["base64 -d", "peel the outer layer", MC[1]], ["vigenere -d KEY", "decrypt the inside", MC[8]], ["CYBA{...}", "the flag", GREEN]];
  chain.forEach(([cmd, what, color], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 2.75, h: 1.5, fill: { color }, rectRadius: 0.1 });
    s.addText([{ text: cmd, options: { fontFace: MONO, bold: true, fontSize: 17, breakLine: true } }, { text: what, options: { fontSize: 14 } }], { x, y: 1.75, w: 2.75, h: 1.5, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addText("|", { x: x + 2.75, y: 1.75, w: 0.32, h: 1.5, fontFace: MONO, fontSize: 30, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  numbered(s, ["Run the first step. Look at the output.", "Identify what it is now.", "Add one more | and the next tool.", "Repeat until you see CYBA{."], M, 3.65, 6.0, 0.72, MC[2], 16);
  term(s, 6.9, 3.55, 5.83, 2.95, ["$ echo aGkK | base64 -d", "hi", "$ echo aGkK | base64 -d | tr a-z A-Z", { hi: "HI" }], { fontSize: 15, title: "one layer at a time" });

  // ---- when stuck ----
  s = newSlide("When you are stuck",
    "Same three-step routine as every CTF.\n\n" +
    "1. --help is free and is usually enough: every tool in this CTF explains itself. man has the long manual for real Linux tools.\n" +
    "2. Go back to the identify slide: what does the text look like?\n" +
    "3. hint N costs 5% of that mission's points, charged once per hint. Harder missions have several hints, each more direct. hint N shows the price; hint N --show buys the next one.", "xor --help");
  numbered(s, [
    [{ text: "Read --help. ", options: { bold: true } }, { text: "Free. Every tool here explains itself, even caesar and xor." }],
    [{ text: "Identify it again. ", options: { bold: true } }, { text: "=, only hex, only dots? The shape names the tool." }],
    [{ text: "Build one step at a time. ", options: { bold: true } }, { text: "Look at the output before adding the next pipe." }],
    [{ text: "Buy a hint. ", options: { bold: true } }, { text: "hint N shows the price. 5% of the mission, charged once." }],
  ], M, 1.8, 6.2, 1.05, BLUE, 17);
  term(s, 7.1, 1.6, 5.63, 4.9, ["$ hint 4", "Hint 1 of 2 costs 10 points (5% of 200),", "charged once.", "To see it, type:  hint 4 --show", "$ hint 4 --show", { hi: "Hint 1 of 2: Read caesar --help." }, { hi: "It can try all the shifts at once." }, "# -10 points on the scoreboard"], { fontSize: 14, title: "player@quest" });

  // ---- toolkit recap ----
  s = newSlide("Your codebreaker's toolkit",
    "One slide to photograph. Every tool, which mission it powers, and the --help that explains it.\n\n" +
    "base64, xxd, tr and sha256sum are standard Linux tools you'll find on any server. caesar, morse, xor, vigenere and hashlines are small helpers built into this CTF, written as short shell scripts.");
  const kit = [["base64 -d", "decode base64", 1], ["xxd -r -p", "hex to text", 2], ["tr", "swap letters: ROT13", 3], ["caesar all", "try every shift", 4], ["tr (flipped)", "Atbash", 5], ["morse", "decode Morse", 6], ["hashlines", "hash every line", 7], ["xor all", "try every XOR key", 8], ["vigenere -d", "decrypt with a keyword", 9], ["A | B | C", "peel layers in a chain", 10]];
  kit.forEach(([cmd, what, n], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 0.98;
    card(s, x, y, 5.96, 0.85);
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fill: { color: MC[n - 1] } });
    s.addText(String(n), { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    mono(s, cmd, x + 0.9, y, 2.4, 0.85, { fontSize: 16, valign: "middle" });
    text(s, what, x + 3.3, y, 2.55, 0.85, { fontSize: 15, color: MUTED, valign: "middle" });
  });
  text(s, "Stuck on any of them?  TOOL --help", M, 6.55, 8, 0.35, { fontSize: 14, bold: true });

  // ===========================================================================
  // PART 3: THE COMPETITION
  // ===========================================================================
  section("Part 3 · Capture a flag");
  divider(3, "Capture a flag", "Crack one cipher together, then you start one yourself. Finishing every cipher is not the goal - understanding the flow is.", MC[3], "./crack   # read, try, check, adjust",
    "Section break. This is the heart of the session: students doing it, not watching. Crack Mission 1 together, then hand the keyboard over.\n\nPut the CTF on one half of the projector and these slides on the other, or switch between them.\n\nEach mission has two slides: the brief (show it, read it, ask the three questions) and the walkthrough (reveal it after the class has tried). You will not get through all ten, and that is by design - pick the ones that fit your group.");

  // ---- the capture routine ----
  s = newSlide("The codebreaker's routine, every time",
    "Five steps, the same for every mission. Drill it now so that the only new thing in each round is the cipher.\n\n" +
    "Say it together: Identify. Decode. Check. Copy. Submit.\n\n" +
    "Check is the crypto-specific step: readable English and CYBA{ at the start means you cracked it. Gibberish means wrong tool or wrong key; go back to Identify.");
  const routine = [["Identify", "what kind of code is it?", fa.FaMagnifyingGlass, MC[1]], ["Decode", "with the matching tool.", fa.FaKey, MC[2]], ["Check", "readable? Starts CYBA{?", fa.FaEye, MC[3]], ["Copy", "the whole flag, CYBA{ to }.", fa.FaCopy, MC[4]], ["Submit", "type submit, paste, Enter.", fa.FaFlag, GREEN]];
  for (let i = 0; i < routine.length; i++) {
    const [head, body, Icon, color] = routine[i];
    const x = M + i * 2.48, w = 2.2;
    card(s, x, 1.75, w, 3.5);
    await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, align: "center" });
    text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{b64-3c9e01f7}   # Correct! +100 points"], { fontSize: 18 });

  // ---- the learning model (mentor rhythm) ----
  s = newSlide("How we'll work through it",
    "Name the teaching loop so the room knows what to expect, and why you keep pausing to ask questions. This is the mentor's rhythm for the guided cipher and for every decoder demo.\n\n" +
    "Predict is the step people skip. Always ask 'what do you think this will do?' BEFORE running it. A wrong prediction corrected by real output sticks far better than being handed the answer.\n\n" +
    "Explain closes the loop: a student puts what happened in their own words. If they can explain it, they own it.");
  const model = [["Teach", "name the idea", MC[0]], ["Ask", "a question first", MC[1]], ["Predict", "what will happen?", MC[2]], ["Try", "run the command", MC[3]], ["Explain", "in your words", MC[4]], ["Apply", "on the next one", GREEN]];
  model.forEach(([a2, b2, color], i) => {
    const x = M + i * 2.03;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: 1.85, h: 2.4, fill: { color }, rectRadius: 0.12 });
    s.addText(String(i + 1), { x: x + 0.15, y: 2.02, w: 1.55, h: 0.45, fontFace: HEAD, fontSize: 17, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
    s.addText(a2, { x: x + 0.1, y: 2.5, w: 1.65, h: 0.8, fontFace: HEAD, fontSize: 22, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(b2, { x: x + 0.1, y: 3.35, w: 1.65, h: 0.85, fontFace: BODY, fontSize: 13, color: "FFFFFF", align: "center", valign: "top", margin: 0, isTextBox: true });
    if (i < 5) s.addText(">", { x: x + 1.83, y: 2.7, w: 0.22, h: 0.8, fontFace: MONO, fontSize: 18, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, M, 4.8, W - 2 * M, 1.7, "FFF4DC");
  text(s, "Watch for", M + 0.3, 4.95, 5, 0.4, { fontFace: HEAD, fontSize: 17, bold: true });
  bullets(s, ["Ask before you tell - a question beats an answer every time.", "Always get a prediction before running a decoder.", "Let a student explain it back; that's how you know it landed.", "Guide and connect to real work. Don't type for students."], M + 0.3, 5.4, W - 2 * M - 0.6, 1.05, { fontSize: 14.5, paraSpaceAfter: 3 });

  // ---- the trail map ----
  s = newSlide("The challenges",
    "The map of what is available. Leave it up for a moment and let students read the names - but set the expectation: this is a menu, not a to-do list. In one session, you crack the guided one together and students start one or two on their own.\n\n" +
    "Notice the order follows the toolkit from Part 2, and history runs roughly forward: encodings, then classical ciphers, then hashes and XOR, then keyed ciphers. An early cipher uses a decoder we just practiced.\n\n" +
    "Do not frame this as a race to the end. Mission 1 is a great start for everyone; where each student goes next is up to them.");
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

  // ---- the 10 missions: brief + walkthrough ----
  function missionPair(i) {
    const c = MS[i], n = i + 1, mode = MODE[c.mode], color = MC[i], L = LEVEL[c.level];
    let s = newSlide(null, "MISSION " + n + " OF " + N + ": " + c.name + "   [" + c.level + ", " + L.pts + " points, " + c.mode + "]\n\n" +
      "Show this slide first. Read the brief out loud, then ask the three questions BEFORE anyone types. Take one answer per question; do not confirm or correct yet - predicting, then checking, is where the learning happens.\n\n" + c.notes);
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
    s.addText(c.mode, { x: 8.2, y: 5.35, w: 1.7, h: 1.15, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText(mode.what, { x: 9.95, y: 5.35, w: 2.6, h: 1.15, fontFace: BODY, fontSize: 13.5, color: WHITE, valign: "middle", margin: 0, isTextBox: true });

    s = newSlide(null, "WALKTHROUGH " + n + " OF " + N + ": " + c.name + "\n\n" +
      (c.mode === "You do" ? "Independent mission: reveal this slide only after students have tried, or when the room is stuck. Not everyone needs to reach it - one cracked cipher is a win.\n\n" : "Guided mission: crack it live with the class calling out commands, then use this slide to recap.\n\n") +
      "The slide never shows a real flag: every computer has its own keys and flags, so students still have to run the commands themselves.\n\n" +
      "Ask one student to explain the three steps in their own words. Offer the stretch question to anyone who finished early.\n\n" + c.notes);
    chip(s, "Walkthrough " + n + " of " + N, M, 0.48, 2.3, color, WHITE, 14);
    levelChip(s, c.level, M + 2.45, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n);
    s.addText("Cracking " + c.name, { x: M, y: 0.98, w: W - 2 * M, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    term(s, M, 1.85, 7.35, 4.65, c.term, { fontSize: c.fs || 14, title: "player@quest" });
    text(s, "What just happened", 8.25, 1.85, 4.4, 0.4, { fontFace: HEAD, fontSize: 18, bold: true });
    numbered(s, c.happened, 8.25, 2.4, 4.48, 0.86, color, 14);
    card(s, 8.25, 5.0, 4.48, 0.82, "FFF4DC");
    text(s, [{ text: "Real world: ", options: { bold: true } }, { text: c.real }], 8.42, 5.0, 4.16, 0.82, { fontSize: 12.5, valign: "middle", fit: "shrink" });
    card(s, 8.25, 5.92, 4.48, 0.62);
    text(s, [{ text: "Stretch: ", options: { bold: true, color } }, { text: c.stretch }], 8.42, 5.92, 4.16, 0.62, { fontSize: 11.5, valign: "middle", fit: "shrink" });
    text(s, "Keys, keywords and flags change on every computer.", M, 6.58, 7.35, 0.3, { fontSize: 11, color: MUTED });
  }

  // ---- guided application: crack a flag together (missions 1-2) ----
  section("Guided application");
  missionPair(0);
  missionPair(1);

  // ---- independent application: now you try (missions 3-10 live in the appendix bank) ----
  section("Independent application");
  s = newSlide("Now you try",
    "This is the heart of the session. Point students at the CTF and let them start a cipher on their OWN. Say clearly: you do NOT have to finish, and you do NOT have to do them in order. Pick one that looks interesting and run the loop: read, observe, try, check, adjust.\n\n" +
    "Walk the room. Ask questions instead of answering them: 'What kind of code do you think this is?' 'What did the output say?' 'What would you try next?' Resist typing for students.\n\n" +
    "The remaining ciphers (3-10) are in the mentor appendix as a bank: pull one up if the room wants a nudge, or leave them for self-study. Finishing them is not the goal - confidence starting one is.");
  text(s, "Pick a cipher and run the loop. You don't have to finish - starting is the win.", M, 1.55, W - 2 * M, 0.5, { fontSize: 18, color: MUTED });
  const menu = [["Decode base64 or hex", "base64 -d", MC[0]], ["Shift the alphabet back", "caesar", MC[2]], ["Translate dots and dashes", "morse", MC[3]], ["Brute force every key", "caesar 1..25", MC[4]], ["Crack a keyword cipher", "vigenere", "5B6EE1"], ["Chain decoders with a pipe", "base64 -d | rev", "0F9488"]];
  menu.forEach(([what, cmd, color], i) => {
    const x = M + (i % 3) * 4.11, y = 2.25 + Math.floor(i / 3) * 1.65;
    card(s, x, y, 3.9, 1.4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.12, h: 1.4, fill: { color } });
    text(s, what, x + 0.35, y + 0.22, 3.4, 0.6, { fontSize: 16.5, bold: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.35, y: y + 0.82, w: 2.4, h: 0.42, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: x + 0.35, y: y + 0.82, w: 2.4, h: 0.42, fontFace: MONO, fontSize: 12.5, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, M, 5.9, W - 2 * M, 0.72, "E2F5EC");
  text(s, [{ text: "Mentor: ", options: { bold: true, color: "0F6A45" } }, { text: "one cipher cracked, understood, and explained back beats ten rushed. Celebrate the process, not the leaderboard." }], M + 0.3, 5.9, W - 2 * M - 0.6, 0.72, { valign: "middle", fontSize: 16 });

  section("Part 3 · Wrapping up");
  // ---- side quests ----
  s = newSlide("Side quests: for anyone who wants more",
    "No flags and no points: teams compare answers out loud.\n\n" +
    "Letter detective: frequency analysis is how Caesar and substitution ciphers were broken for 1,000 years (al-Kindi, 9th century). In English the most common letter is E. In ~/mission4, fold -w1 message.txt | grep '[a-z]' | sort | uniq -c | sort -n | tail -3 shows the most common cipher letters. Is the top one the shift of E? Usually not: the message is too short. That is the lesson: frequency analysis needs lots of text.\n\n" +
    "Secret notes: encrypt a message with vigenere -e and a keyword, write the ciphertext on paper, and whisper the keyword to the next team.\n\n" +
    "Hash race: how many words in ~/mission10/words.txt have a SHA-256 starting with 0? hashlines words.txt | grep '^0' | wc -l gives 7 (cedar, cinder, drift, fable, kestrel, phoenix, raven). Same on every computer. About 1 in 16 is expected: hashes look random.\n\n" +
    "Two layers: make your own two-layer puzzle (e.g. tr ROT13 then base64) and swap with a neighbour.");
  const side = [
    ["Letter detective", "~/mission4", "Which cipher letter is most common? In English it's E. Does the trick work on a short message?", "fold -w1 · sort · uniq -c · sort -n"],
    ["Secret notes", "anywhere", "Encrypt a note with a keyword. Swap papers with the next team, whisper the key.", "echo ... | vigenere -e KEY"],
    ["Hash race", "~/mission10", "How many words in words.txt have a hash that starts with 0? Which ones?", "hashlines words.txt | grep '^0'"],
    ["Two layers", "anywhere", "Build a two-layer puzzle for a neighbour. Can they peel it?", "tr ... | base64"],
  ];
  side.forEach(([name, where, brief, tools], i) => {
    const x = M + (i % 2) * 6.17, y = 1.65 + Math.floor(i / 2) * 2.45;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.96, h: 2.25, fill: { color: TERM }, rectRadius: 0.12 });
    s.addText(name, { x: x + 0.35, y: y + 0.2, w: 3.8, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: WHITE, margin: 0, isTextBox: true });
    s.addText(where, { x: x + 4.0, y: y + 0.25, w: 1.7, h: 0.4, fontFace: MONO, fontSize: 12, color: T_NOTE, align: "right", margin: 0, isTextBox: true });
    s.addText(brief, { x: x + 0.35, y: y + 0.8, w: 5.3, h: 0.85, fontFace: BODY, fontSize: 16, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
    s.addText([{ text: "$ ", options: { color: T_PROMPT } }, { text: tools, options: { color: AMBER } }], { x: x + 0.35, y: y + 1.68, w: 5.3, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, margin: 0, isTextBox: true });
  });

  // ---- read your scorecard ----
  s = newSlide("Read your scorecard",
    "When the last flag lands, the clock stops and the sidebar turns into the finish screen.\n\n" +
    "Points per mission and the total. 'Took' is how long each flag took since the previous one: the biggest Took shows which cipher slowed you down. 'Time' is the clock reading at each submit.\n\n" +
    "Replay quest builds a brand-new computer with new keys and new flags. Can you beat your time?\n\nThe times in this screenshot are an example.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.25, y: 1.55, w: 3.1, h: 4.52, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img-crypto", "sidebar-finish.png"), x: M + 0.3, y: 1.6, w: 3.0, h: 3.0 * 752 / 512 });
  const sc = [["Points", "2,700 for all ten flags.", AMBER], ["Took", "Time since your previous flag. Your biggest Took is the cipher to practise.", BLUE], ["Time", "The clock when you submitted each flag.", MC[3]], ["Replay quest", "New keys, new flags, a fresh clock. Beat your time.", GREEN]];
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
  section("Part 4 · Reflection");
  divider(4, "Reflection", "Puzzle crypto vs real crypto, what you just did, who gets paid to do it, and how to keep going.", MC[4], "echo 'Jryy qbar' | tr A-Za-z N-ZA-Mn-za-m",
    "Section break. Applaud the fastest teams, and also the team that got unstuck the most times.\n\nFun closer: have everyone run the command on this slide. It prints 'Well done'.");

  // ---- real vs CTF crypto ----
  s = newSlide("Puzzle crypto vs real crypto",
    "The most important takeaway: every cipher today was broken centuries ago. Never use them to protect anything real.\n\n" +
    "Real systems use vetted algorithms (AES, ChaCha20, SHA-256, RSA/elliptic curves) from well-tested libraries. Rule number one in security engineering: don't invent your own crypto.\n\n" +
    "And real attacks rarely break the maths. They steal keys, guess weak passwords, or exploit mistakes, just like Mission 9 (a leaked keyword) and Mission 10 (a keyword from a wordlist).\n\n" +
    "Ask: 'After today, how would you choose a password?' Long, unusual, not a dictionary word: Mission 10 cracked a dictionary word in seconds.");
  const vs = [["Today's ciphers", "Caesar, Atbash, Vigenère, single-byte XOR", "Broken centuries ago. Great puzzles, zero protection.", RED], ["Real crypto", "AES, ChaCha20, SHA-256, RSA", "Unbroken maths. Use tested libraries; never invent your own.", GREEN]];
  vs.forEach(([head, ex, verdict, color], i) => {
    const x = M + i * 6.17;
    card(s, x, 1.65, 5.96, 2.5);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 5.96, h: 0.12, fill: { color } });
    text(s, head, x + 0.35, 1.95, 5.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, color });
    mono(s, ex, x + 0.35, 2.55, 5.3, 0.45, { fontSize: 14 });
    text(s, verdict, x + 0.35, 3.1, 5.3, 0.9, { fontSize: 16, color: MUTED });
  });
  text(s, "So how do real attackers win?", M, 4.45, 8, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  const how = [["Leaked keys", "Mission 9: the keyword was in a file."], ["Weak passwords", "Mission 10: a dictionary word, cracked in seconds."], ["Mistakes", "Encoding used as if it were encryption: Mission 1."]];
  how.forEach(([head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 5.0, 3.9, 1.5, "FFF4DC");
    text(s, head, x + 0.3, 5.12, 3.4, 0.45, { fontSize: 18, bold: true });
    text(s, body, x + 0.3, 5.6, 3.4, 0.8, { fontSize: 14.5, color: MUTED });
  });

  // ---- skill passport ----
  s = newSlide("Your skill passport",
    "A visual receipt for the session, in mission order. Each stamp is a technique the class used today.\n\n" +
    "Ask students to count the stamps they earned.");
  const stamps = [["base64 -d", 1], ["xxd -r -p", 2], ["tr", 3], ["ROT13", 3], ["brute force", 4], ["grep CYBA", 4], ["Atbash", 5], ["morse", 6], ["read the brief", 6], ["sha256sum", 7], ["wordlist attack", 7], ["XOR", 8], ["Vigenère", 9], ["find the key", 9], ["|  layers", 10], ["identify", 0], ["--help", 0], ["known plaintext", 0]];
  stamps.forEach(([cmd, n], i) => {
    const x = M + (i % 6) * 2.04, y = 1.65 + Math.floor(i / 6) * 1.6, color = n ? MC[n - 1] : MUTED;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.88, h: 1.42, fill: { color: WHITE }, rectRadius: 0.12, line: { color, width: 2.5, dashType: "dash" } });
    mono(s, cmd, x + 0.05, y + 0.2, 1.78, 0.6, { fontSize: cmd.length > 9 ? 13 : 18, color, align: "center", valign: "middle" });
    text(s, n ? "Mission " + n : "Every mission", x, y + 0.88, 1.88, 0.35, { fontSize: 12, color: MUTED, align: "center" });
  });
  text(s, "Eighteen codebreaking skills, used on a real Linux system, in one session.", M, 6.6, W - 2 * M, 0.35, { fontSize: 15, bold: true });

  // ---- the job ----
  s = newSlide("What you just did is the job",
    "Connect the missions to real work. Ask the questions on the right and let students answer before you do.\n\n" +
    "Mentors: share one real story (unclassified and non-sensitive) of meeting encodings, hashes or keys at work.");
  const jobs = [[fa.FaMagnifyingGlass, "Identify, then decode", "Analysts decode base64 and hex in suspicious emails and malware every day", MC[0]], [fa.FaFingerprint, "Hashes and wordlists", "Penetration testers check whether a company's passwords fall to a wordlist", MC[6]], [fa.FaKey, "Find the key", "Incident responders hunt for leaked keys and passwords in files and code", MC[8]], [fa.FaShieldHalved, "Use real crypto right", "Engineers protect data with tested libraries and good key management", MC[2]]];
  for (let i = 0; i < jobs.length; i++) {
    const [Icon, cmd, job, color] = jobs[i];
    const y = 1.7 + i * 1.2;
    await iconCircle(s, Icon, M, y, 0.8, color);
    text(s, cmd, M + 1.05, y, 6, 0.4, { fontSize: 18, bold: true });
    text(s, job, M + 1.05, y + 0.42, 6.2, 0.6, { fontSize: 15, color: MUTED });
  }
  card(s, 8.1, 1.7, 4.63, 4.75);
  text(s, "Ask the room", 8.45, 1.95, 4, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  bullets(s, ["Which cipher had your biggest Took time? Why?", "Which mission was 'find the key' rather than 'break the cipher'?", "Why are long, unusual passwords safer after Mission 10?", "Where have you seen base64 or hex in real life?"], 8.45, 2.6, 4.0, 3.6, { fontSize: 16, paraSpaceAfter: 11 });

  // ---- keep going ----
  s = newSlide("Keep climbing",
    "Close with what students can do tomorrow, for free.\n\n" +
    "CyberQuest Academy is where the next challenges live: fill in the link. The Crypto CTF works at home on any computer; every replay has new keys and new flags. CyberChef (GCHQ's free 'cyber Swiss army knife' in the browser) is a great tool for exploring encodings.\n\n" +
    "Thank the class and the teacher.");
  const next = [["Next: CyberQuest", "[CyberQuest Academy link]", "More CTFs, live scoreboards and harder missions are waiting for you there.", MC[2]], ["Replay the Crypto CTF", "[your CTF link]/crypto/", "Works at home. New keys and flags on every replay. Beat your time.", MC[3]], ["Explore CyberChef", "gchq.github.io/CyberChef", "Drag-and-drop decoders. Try a recipe: From Base64, then ROT13.", MC[4]]];
  next.forEach(([head, where, body, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.3);
    text(s, head, x + 0.3, 1.95, 3.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color });
    mono(s, where, x + 0.3, 2.55, 3.4, 0.5, { fontSize: 13, color: INK });
    text(s, body, x + 0.3, 3.15, 3.3, 1.7, { fontSize: 16, color: MUTED });
  });
  term(s, M, 5.3, W - 2 * M, 1.15, ["$ echo 'Gunaxf sbe cynlvat.' | tr A-Za-z N-ZA-Mn-za-m   # Thanks for playing."], { fontSize: 17 });

  // ===========================================================================
  // MENTOR APPENDIX
  // ===========================================================================
  section("Mentor appendix");

  s = darkSlide("Mentor appendix: reference for whoever runs the room — the page layout, how flags work under the hood, how to open the CTF, the answer key, and fixes for the usual snags. Not student-facing.");
  s.addText("Mentor", { x: M, y: 1.5, w: 11, h: 1.0, fontFace: HEAD, fontSize: 40, bold: true, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText("Appendix", { x: M, y: 2.35, w: 11, h: 1.6, fontFace: HEAD, fontSize: 92, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("The page layout, the mechanics, the answer key, and what to do when things go wrong.", { x: M, y: 4.15, w: 10.5, h: 1.0, fontFace: BODY, fontSize: 22, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.35, w: W - 2 * M, h: 0.9, fill: { color: "162238" }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: "man mentor   # for the person running the room", options: { color: WHITE, bold: true } }], { x: M + 0.35, y: 5.35, w: W - 2 * M - 0.7, h: 0.9, fontFace: MONO, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });

  // ---- anatomy of the page ----
  s = newSlide("Anatomy of the Crypto CTF page",
    "A real screenshot from the middle of a game: the first three flags captured, Mission 4 (Hail Caesar) open, and the brute force running in the terminal.\n\n" +
    "Walk the eight parts. It is the same page as the Linux CTF, so students who played that one already know it. The Crypto CTF tag is top left; the 'Linux CTF' link switches games (it starts a new game, so don't click it mid-race).\n\n" +
    "The most common problem in class is typing before clicking inside the terminal. Say it twice.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M - 0.05, y: 1.6, w: 7.3, h: 4.34, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img-crypto", "page.png"), x: M, y: 1.65, w: 7.2, h: 4.235 });
  const k = 7.2 / 1360, px = (x) => M + x * k, py = (y) => 1.65 + y * k;
  const P8 = JSON.parse(fs.readFileSync(path.join(__dirname, "img-crypto", "pins.json"), "utf8"));
  const sorted = [[...P8.track, MC[1]], [...P8.points, AMBER], [...P8.clock, BLUE], [...P8.stepper, MC[0]], [...P8.level, MC[4]], [...P8.copy, MC[3]], [...P8.terminal, "56657E"], [...P8.next, MC[2]]];
  sorted.forEach(([x, y, color], i) => {
    s.addShape(pres.shapes.OVAL, { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fill: { color }, line: { color: WHITE, width: 2 } });
    s.addText(String(i + 1), { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "Mid-game: missions 1 to 3 captured, Mission 4 open.", M, 6.1, 7, 0.35, { fontSize: 12, color: MUTED });
  const parts8 = [["Progress track", "One coloured bar lights up per flag.", MC[1]], ["Points", "Your score, out of 2,700.", AMBER], ["Clock", "Starts at Mission 1 and counts up.", BLUE], ["Stepper", "A green check per captured flag.", MC[0]], ["Level and points", "Easy 100 up to Very Hard 800.", MC[4]], ["Copy buttons", "Copy a starting command, then paste it.", MC[3]], ["Terminal", "Click inside it before you type.", "56657E"], ["Next mission", "Unlocks when the flag is captured.", MC[2]]];
  parts8.forEach(([head, body, color], i) => {
    const y = 1.62 + i * 0.6;
    s.addShape(pres.shapes.OVAL, { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fill: { color } });
    s.addText(String(i + 1), { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, [{ text: head + "  ", options: { bold: true, fontSize: 15 } }, { text: body, options: { fontSize: 13, color: MUTED } }], 8.6, y, 4.15, 0.5, { valign: "middle" });
  });

  s = newSlide("Mentor appendix: how the Crypto CTF works",
    "MENTOR READING. The Crypto CTF lives in the same GitLab project as the Linux CTF, in public/crypto/. It reuses the same emulator and page code; only the missions, the tools and the Linux image differ.\n\n" +
    "Real-Linux mode boots v86 with crypto.cpio.gz: BusyBox plus five helper scripts (caesar, morse, xor, vigenere, hashlines) in /bin. Every boot generates random flags, random Caesar shift and XOR key, and a random keyword for missions 9 and 10. Only SHA-256 hashes of the flags are kept, so there is no answer file.\n\n" +
    "Lite mode (no WebAssembly) is a JavaScript simulated shell with the same missions and the same tools.\n\n" +
    "Rebuild after editing missions: python3 guest-crypto/make-crypto.py, then guest-crypto/build.sh.");
  const lq = [[fa.FaTerminal, "A real terminal", "Linux in the browser, plus five small crypto helper tools.", MC[1]], [fa.FaKey, "New keys every load", "Random flags, shifts, XOR keys and keywords. No answer file.", MC[3]], [fa.FaLaptop, "Nothing to install", "One link: your Pages address + /crypto/. No accounts.", MC[4]]];
  for (let i = 0; i < lq.length; i++) {
    const [Icon, head, body, color] = lq[i];
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.35);
    await iconCircle(s, Icon, x + 0.3, 1.95, 0.95, color);
    text(s, head, x + 0.3, 3.1, 3.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true });
    text(s, body, x + 0.3, 3.65, 3.3, 1.3, { fontSize: 16, color: MUTED });
  }
  text(s, "Under the hood", M, 5.35, 3, 0.35, { fontSize: 14, bold: true, color: MUTED });
  const hood = [["Your browser", "E4EAF3", MUTED], ["v86: a PC in WebAssembly", MC[2], WHITE], ["Linux + BusyBox", MC[3], WHITE], ["crypto helper tools", MC[4], WHITE], ["Your 10 ciphers", AMBER, INK]];
  let hx = M;
  hood.forEach(([name, fill, ink], i) => { const w = name.length * 0.095 + 0.5; chip(s, name, hx, 5.8, w, fill, ink, 12.5); hx += w + 0.12; if (i < hood.length - 1) { s.addText(">", { x: hx - 0.12, y: 5.8, w: 0.12, h: 0.38, fontFace: MONO, fontSize: 12, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true }); hx += 0.06; } });
  text(s, "Source: public/crypto/ (page) and guest-crypto/ (missions, tools, Linux image).", M, 6.4, 11.5, 0.35, { fontSize: 13, color: MUTED });

  s = newSlide("Mentor appendix: open the Crypto CTF",
    "MENTOR READING: run this with students right before Part 2, so every device is booted for the Try it pills.\n\n" +
    "WRITE YOUR ADDRESS IN THE BOX before presenting. It is your GitLab Pages address with /crypto/ on the end. The Linux CTF page also has a 'Crypto CTF' link in its header.\n\n" +
    "Most important rule: do not reload the page. A reload builds a new computer with new keys and flags, and resets the clock and points.");
  numbered(s, [
    [{ text: "Open Chrome ", options: { bold: true } }, { text: "and type the address from the box on the right." }],
    [{ text: "Watch it boot. ", options: { bold: true } }, { text: "The status says 'Ready' when Linux is up." }],
    [{ text: "Click inside the black terminal. ", options: { bold: true } }, { text: "A cursor should blink." }],
    [{ text: "Never reload the page. ", options: { bold: true } }, { text: "Reloading means new flags, zero points and a reset clock." }],
  ], M, 1.85, 6.6, 1.1, BLUE, 18);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.7, y: 1.7, w: 5.03, h: 3.2, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText("Crypto CTF address", { x: 7.7, y: 1.9, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 16, color: T_OUT, align: "center", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fill: { color: "162238" }, rectRadius: 0.08, line: { color: AMBER, width: 2, dashType: "dash" } });
  s.addText("your-group.gitlab.io/.../crypto/", { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fontFace: MONO, fontSize: 17, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Type it exactly. One computer per pair.", { x: 7.7, y: 4.2, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 14, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
  card(s, 7.7, 5.15, 5.03, 1.3, "FFF4DC");
  text(s, [{ text: "Don't start yet! ", options: { bold: true } }, { text: "The clock starts when you open Mission 1 — explore the page freely first." }], 8.0, 5.15, 4.5, 1.3, { valign: "middle", fontSize: 15 });

  s = newSlide("Mentor appendix: answer key",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Flags, shifts, XOR keys and keywords are random on every page load and the CTF keeps only fingerprints, so there is no list of flags: play each mission yourself before class.\n\n" +
    "Mission 9 keywords: FALCON ORCHID JUPITER GLACIER PHOENIX LANTERN COMPASS HARBOR. Mission 10 keyword: one of the 100 words in words.txt.\n\n" +
    "In lite mode $(...) is not supported: type the first 8 characters of the hash instead of $(cut -c1-8 ...).");
  const key = [].concat(MS.map((c, i) => [String(i + 1), c.name, c.answer, c.level + " · " + LEVEL[c.level].pts, MC[i]])).concat([
    ["+", "Letter detective", "fold -w1 message.txt | grep '[a-z]' | sort | uniq -c | sort -n | tail -3", "side quest", MUTED],
    ["+", "Hash race", "hashlines words.txt | grep '^0' | wc -l   (7)", "side quest", MUTED],
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
    "Most problems are the same as the Linux CTF: the school web filter, Pages visibility, or typing before clicking the terminal. The crypto-specific ones are below.\n\n" +
    "Plan B if most devices can't load it: drive the CTF on the projector and run the competition as 'We do', with teams racing to call out the next command on paper.");
  const fixes = [
    ["tr prints nothing or the wrong letters", "Quote both sets and count them: 'A-Za-z' and 'N-ZA-Mn-za-m'. Feed the file with <."],
    ["xxd -r prints nothing", "Add -p: the file is plain hex with no addresses. xxd -r -p secret.hex"],
    ["hashlines seems stuck (real Linux)", "It hashes one line at a time: 100 lines take 15–25 s. Wait for the prompt."],
    ["Mission 6 flag is 'Incorrect'", "The code goes in lowercase: CYBA{morse-7b0ab9be}. README.txt says so."],
    ["Vigenère output is still gibberish", "Wrong keyword, or -e instead of -d. Mission 10: decode base64 first."],
    ["$(...) doesn't work", "Lite mode has no $(...). Type the first 8 hash characters into grep."],
    ["\"Incorrect flag\"", "Copy the whole flag, CYBA{ to }. Flags from another computer never work."],
    ["Page was reloaded by accident", "New keys, new flags; points and clock reset. The second run is fast."],
  ];
  fixes.forEach(([problem, fix], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.24;
    card(s, x, y, 5.96, 1.1);
    text(s, problem, x + 0.25, y + 0.1, 5.5, 0.35, { fontSize: 14.5, bold: true, color: RED });
    text(s, fix, x + 0.25, y + 0.45, 5.5, 0.6, { fontSize: 12.5, color: INK });
  });

  section("Mentor appendix · Mission bank");
  s = newSlide("Mission bank: missions 3-10",
    "A reference bank, not a checklist. Missions 1 and 2 are the guided example in the main deck; these eight are here for independent work and self-study.\n\nPull one up when a student wants a nudge on a cipher they chose, or share the deck afterward. In a one-hour session you will not show most of these live - and that's the point.\n\nEach mission has a brief (the clue and three questions) and a walkthrough (one correct path). Flags differ on every computer, so walkthroughs are safe to show.");
  text(s, "Each has a brief (clue + questions) and a walkthrough (one path). Pull up whatever a student needs.", M, 2.0, W - 2 * M, 0.6, { fontSize: 18, color: MUTED });
  MS.slice(2).forEach((c, i) => {
    const x = M + (i % 4) * 3.08, y = 2.9 + Math.floor(i / 4) * 1.75;
    card(s, x, y, 2.85, 1.5);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: MC[i + 2] } });
    s.addText(String(i + 3), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.name, x + 0.9, y + 0.22, 1.85, 0.6, { fontSize: 14, bold: true, valign: "middle" });
    levelChip(s, c.level, x + 0.25, y + 0.9, 1.75, 9.5);
    mono(s, c.skill, x + 2.05, y + 0.92, 0.7, 0.3, { fontSize: 9, color: MUTED, bold: false, fit: "shrink" });
  });
  for (let i = 2; i < MS.length; i++) missionPair(i);

  const out = path.join(__dirname, "CyberQuest-Crypto-CTF.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

build().catch((e) => { console.error(e); process.exit(1); });
