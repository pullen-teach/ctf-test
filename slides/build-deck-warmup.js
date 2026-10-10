// Builds slides/CyberQuest-Warm-ups.pptx. Run:  node slides/build-deck-warmup.js
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
const FOOT = "CyberQuest Academy  ·  Warm-ups";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Warm-ups: get ready to compete";
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



// ---- Part 2 of the crypto deck: the codebreaker's toolkit, in mission order ----
const MODE = {
  "We do": { color: BLUE, what: "Class calls out each command. Mentor types." },
  "You do": { color: GREEN, what: "Teams race on the clock. Mentor reveals after." },
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
  const RR = pres.shapes.ROUNDED_RECTANGLE;

  // ===========================================================================
  // TITLE
  // ===========================================================================
  section("Welcome");
  s = darkSlide("Welcome. Run these two warm-ups before any CyberQuest CTF. They are optional and untimed, worth 100 bonus points, and they teach the handful of things every mission assumes you already know: what a flag is, how to submit one, how scoring works, and the keyboard moves that make the terminal fast.\n\nOpen the Warm-ups tile on the CyberQuest home page and work along on the projector.");
  s.addText("CyberQuest", { x: M, y: 1.3, w: 7.5, h: 1.3, fontFace: HEAD, fontSize: 72, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Warm-ups: get ready to compete.", { x: M, y: 2.72, w: 6.4, h: 1.0, fontFace: BODY, fontSize: 28, color: T_OUT, margin: 0, isTextBox: true });
  chip(s, "optional  ·  untimed  ·  100 bonus points", M, 4.2, 4.6, AMBER, INK, 15);
  s.addText("Do this first, then pick a CTF.", { x: M, y: 4.9, w: 6, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addShape(RR, { x: 7.5, y: 1.2, w: 5.23, h: 4.95, fill: { color: "162238" }, rectRadius: 0.12, line: { color: "2B3B5C", width: 1 } });
  ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: 7.75 + i * 0.24, y: 1.4, w: 0.14, h: 0.14, fill: { color: c } }));
  s.addText([
    { text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: "cat orientation.txt", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "what a CTF is, how to score", options: { color: T_NOTE, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: "cd ~/speed", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "Tab, up arrow, Ctrl+C, paste", options: { color: T_NOTE, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "2 warm-ups, 100 bonus points", options: { color: T_OUT, breakLine: true } },
    { text: "no clock. no rush.", options: { color: AMBER, bold: true } },
  ], { x: 7.85, y: 1.75, w: 4.6, h: 4.2, fontFace: MONO, fontSize: 15, lineSpacingMultiple: 1.25, valign: "top", margin: 0, isTextBox: true });

  // ===========================================================================
  // WHAT IS A CTF
  // ===========================================================================
  s = newSlide("What is a CTF?", "A CTF, Capture The Flag, is a friendly cybersecurity competition. Every mission (sometimes called a challenge) hides a flag: a short secret string. You use the terminal to uncover it, submit it, and score points. CyberQuest flags always start with CYBA{ and end with }.");
  const whatCards = [
    [fa.FaFlag, "Capture the flag", "Each mission hides a secret string. That string is the flag.", MC[0]],
    [fa.FaMagnifyingGlass, "Find it", "Use the terminal and the mission's README to uncover it.", MC[2]],
    [fa.FaCircleCheck, "Submit it, score", "Type submit and the flag. Correct flags earn points.", GREEN],
  ];
  for (let i = 0; i < whatCards.length; i++) {
    const [Icon, head, body, color] = whatCards[i];
    const x = M + i * 4.11;
    card(s, x, 1.6, 3.9, 2.35);
    await iconCircle(s, Icon, x + 0.3, 1.85, 0.8, color);
    text(s, head, x + 1.3, 1.95, 2.5, 0.6, { fontSize: 19, bold: true, valign: "middle" });
    text(s, body, x + 0.3, 2.75, 3.35, 1.1, { fontSize: 15, color: MUTED });
  }
  // flag anatomy
  s.addShape(RR, { x: M, y: 4.25, w: W - 2 * M, h: 2.15, fill: { color: TERM }, rectRadius: 0.12 });
  text(s, "Every flag looks like this:", M + 0.4, 4.45, 7, 0.4, { fontSize: 15, color: T_OUT });
  s.addText([
    { text: "CYBA{", options: { color: T_PROMPT } },
    { text: "word", options: { color: WHITE } },
    { text: "-", options: { color: T_NOTE } },
    { text: "1a2b3c4d", options: { color: AMBER } },
    { text: "}", options: { color: T_PROMPT } },
  ], { x: M + 0.4, y: 4.85, w: 11, h: 0.9, fontFace: MONO, fontSize: 44, bold: true, margin: 0, isTextBox: true });
  text(s, "Always starts with CYBA{  and ends with }.  Copy the whole thing — the braces too.", M + 0.4, 5.85, 11, 0.4, { fontSize: 14, color: T_NOTE });

  // ===========================================================================
  // HOW SCORING WORKS  (moved here from the CTF decks)
  // ===========================================================================
  s = newSlide("How scoring works",
    "This is the competition's scoring, the same for every CyberQuest CTF. Points come from difficulty: Easy 100, Medium 200, Hard 400, Very Hard 800. A full CTF is ten missions worth 2,700 points. These two warm-ups add 100 optional bonus points on top.\n\nThe clock counts UP. It starts when you begin Mission 1 and stops when you capture the last flag. Most points wins; on a tie, the faster time wins. Hints cost 5% of the mission's points, charged once. Wrong flags cost nothing, so encourage trying.");
  const lv = [["Easy", "100 each"], ["Medium", "200 each"], ["Hard", "400 each"], ["Very Hard", "800"]];
  lv.forEach(([name, which], i) => {
    const L = LEVEL[name], x = M + i * 3.07;
    s.addShape(RR, { x, y: 1.6, w: 2.87, h: 2.0, fill: { color: L.fill }, rectRadius: 0.12 });
    s.addText(String(L.pts), { x, y: 1.7, w: 2.87, h: 0.95, fontFace: HEAD, fontSize: 48, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true });
    s.addText(name.toUpperCase(), { x, y: 2.65, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: L.ink, align: "center", margin: 0, isTextBox: true });
    s.addText(which, { x, y: 3.02, w: 2.87, h: 0.35, fontFace: BODY, fontSize: 13, color: name === "Very Hard" ? "F3C6D4" : MUTED, align: "center", margin: 0, isTextBox: true });
  });
  const rules = [
    [fa.FaStopwatch, "The clock counts up", "It starts with Mission 1 and stops at your last flag. Nobody is cut off. The warm-ups are untimed.", BLUE],
    [fa.FaTrophy, "Most points wins", "A full CTF is 2,700 points. Tie on points? The faster time wins.", AMBER],
    [fa.FaLightbulb, "Hints cost 5%", "Of that mission's points, per hint, charged once. Wrong flags cost nothing. Warm-up hints are free.", GREEN],
  ];
  for (let i = 0; i < rules.length; i++) {
    const [Icon, head, body, color] = rules[i];
    const x = M + i * 4.11;
    card(s, x, 3.9, 3.9, 2.55);
    await iconCircle(s, Icon, x + 0.3, 4.1, 0.75, color);
    text(s, head, x + 1.25, 4.15, 2.55, 0.65, { fontSize: 18, bold: true, valign: "middle" });
    text(s, body, x + 0.3, 5.05, 3.4, 1.35, { fontSize: 14, color: MUTED });
  }

  // ===========================================================================
  // THE CAPTURE ROUTINE  (generic)
  // ===========================================================================
  s = newSlide("The capture routine, every time",
    "Four steps, the same for every mission in every CTF. Drill it now so the only new thing in each mission is the puzzle itself.\n\nSay it together: Find. Check. Copy. Submit. Check means: does it look right, and does it start with CYBA{? Copy the WHOLE flag, braces included. Submit by typing submit, a space, then paste.");
  const routine = [["Find", "uncover the flag in the files.", fa.FaMagnifyingGlass, MC[1]], ["Check", "readable? Starts CYBA{?", fa.FaEye, MC[3]], ["Copy", "the whole flag, CYBA{ to }.", fa.FaCopy, MC[4]], ["Submit", "type submit, paste, Enter.", fa.FaFlag, GREEN]];
  for (let i = 0; i < routine.length; i++) {
    const [head, body, Icon, color] = routine[i];
    const x = M + i * 3.1, w = 2.8;
    card(s, x, 1.75, w, 3.4);
    await iconCircle(s, Icon, x + 0.9, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, align: "center" });
    text(s, body, x + 0.25, 3.85, w - 0.5, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 3) s.addText(">", { x: x + w, y: 2.2, w: 0.3, h: 0.6, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{word-1a2b3c4d}   # Correct! +100 points"], { fontSize: 18 });

  // ===========================================================================
  // HINTS
  // ===========================================================================
  s = newSlide("Stuck? Help is built in", "Two kinds of help. First, every command explains itself: add --help. Second, each mission has graded hints. In a real CTF a hint costs 5% of that mission's points, charged once; in the warm-ups, hints are free. Encourage students to read --help before spending a hint.");
  const helpCards = [
    [fa.FaCircleQuestion, "Ask the command", "Add --help to any command to see what it does and its options.", "ls --help", MC[2]],
    [fa.FaLightbulb, "Ask for a hint", "hint 1 gives a nudge. In a CTF it costs 5% of the mission, once. Warm-up hints are free.", "hint 1", AMBER],
  ];
  for (let i = 0; i < helpCards.length; i++) {
    const [Icon, head, body, cmd, color] = helpCards[i];
    const x = M + i * 6.17;
    card(s, x, 1.7, 5.95, 3.1);
    await iconCircle(s, Icon, x + 0.35, 1.95, 0.9, color);
    text(s, head, x + 1.5, 2.1, 4.2, 0.65, { fontSize: 22, bold: true, valign: "middle" });
    text(s, body, x + 0.4, 3.0, 5.15, 1.0, { fontSize: 16, color: MUTED });
    s.addShape(RR, { x: x + 0.4, y: 4.05, w: 5.15, h: 0.6, fill: { color: TERM }, rectRadius: 0.1 });
    s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: cmd, options: { color: WHITE, bold: true } }], { x: x + 0.65, y: 4.05, w: 4.8, h: 0.6, fontFace: MONO, fontSize: 16, valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.1, W - 2 * M, 1.35, ["$ hint 2", "Hint 1 of 1 costs 5 points (5% of 100), charged once.", "$ cat --help          # free: every command explains itself"], { fontSize: 15 });

  // ===========================================================================
  // THE TWO WARM-UPS
  // ===========================================================================
  section("The two warm-ups");
  s = darkSlide("The warm-ups themselves. Two of them, optional and untimed, 50 points each. Open the Warm-ups tile on the home page and do them together on the projector before the first CTF.");
  s.addText("2", { x: M, y: 0.9, w: 3.2, h: 3.6, fontFace: HEAD, fontSize: 250, bold: true, color: AMBER, margin: 0, valign: "middle", isTextBox: true });
  s.addText("warm-ups", { x: 4.3, y: 1.7, w: 8, h: 0.5, fontFace: MONO, fontSize: 18, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText("Orientation, then speed", { x: 4.3, y: 2.15, w: 8.4, h: 1.2, fontFace: HEAD, fontSize: 44, bold: true, color: WHITE, margin: 0, valign: "top", isTextBox: true });
  s.addText("First, learn the game and submit your first flag. Then build the keyboard speed that makes every mission faster.", { x: 4.3, y: 3.45, w: 8.2, h: 1.2, fontFace: BODY, fontSize: 21, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
  s.addShape(RR, { x: M, y: 5.35, w: W - 2 * M, h: 0.9, fill: { color: "162238" }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: "cat orientation.txt   &&   cd ~/speed", options: { color: WHITE, bold: true } }], { x: M + 0.35, y: 5.35, w: W - 2 * M - 0.7, h: 0.9, fontFace: MONO, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });

  // ---- Warm-up 1: Orientation ----
  s = newSlide(null, "WARM-UP 1: ORIENTATION. The whole game explained in one file, plus the first flag to submit. Have everyone type cat orientation.txt and read it together: it covers how to read a mission, what a flag looks like, how to submit, and how scoring and hints work. The last line is the warm-up flag. Submit it for 50 points. There is no clock.", "cat orientation.txt");
  chip(s, "Warm-up 1 of 2", M, 0.48, 2.3, AMBER, INK, 14);
  chip(s, "OPTIONAL · UNTIMED · 50", M + 2.45, 0.48, 2.9, "E2F5EC", "12704B", 12);
  s.addText("Orientation", { x: M, y: 1.0, w: W - 2 * M, h: 0.95, fontFace: HEAD, fontSize: 42, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
  text(s, "Read the whole game in one file, then submit your first flag.", M, 1.95, 6.2, 0.5, { fontSize: 17, color: MUTED });
  numbered(s, [
    "Type  cat orientation.txt  and read it with the class.",
    "It explains: reading a mission, flags, submitting, scoring, hints.",
    "The warm-up flag is on the last line.",
    "Submit it:  submit CYBA{...}   — +50 points, no clock.",
  ], M, 2.65, 6.1, 0.92, AMBER, 17);
  term(s, 6.95, 1.6, 5.78, 4.95, ["$ cat orientation.txt", "CTF Orientation", "===============", "1. Read a mission:  cd ~/mission1  then  cat README.txt", "2. A flag looks like:  CYBA{word-1a2b3c4d}", "3. Submit it:  submit CYBA{word-1a2b3c4d}", "4. Stuck?  ls --help   then   hint 1", "...", "Warm-up flag:", { hi: "  CYBA{warmup-1a2b3c4d}" }, "$ submit CYBA{warmup-1a2b3c4d}", "Correct! +50 points"], { fontSize: 13.5, title: "player@quest" });

  // ---- Warm-up 2: Speed drills ----
  s = newSlide(null, "WARM-UP 2: SPEED DRILLS. Four tiny drills, one keyboard skill each, four pieces of one flag. Tab completes a long name; the up arrow repeats your last command; Ctrl+C stops a runaway command; and selecting text then middle-clicking is how you copy and paste in a Linux terminal. Each drill prints a 4-character piece; assemble them into CYBA{speed-...} and submit. Hints are free.", "cd ~/speed");
  chip(s, "Warm-up 2 of 2", M, 0.48, 2.3, AMBER, INK, 14);
  chip(s, "OPTIONAL · UNTIMED · 50", M + 2.45, 0.48, 2.9, "E2F5EC", "12704B", 12);
  s.addText("Speed drills", { x: M, y: 1.0, w: W - 2 * M, h: 0.95, fontFace: HEAD, fontSize: 42, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
  text(s, "Four drills, four keys, four pieces of the flag.", M, 1.95, 6.2, 0.5, { fontSize: 17, color: MUTED });
  const drills = [
    ["Tab", "completes a long name", "cat dri↹", MC[0]],
    ["Up arrow", "brings back your last command", "again  ↑ ↵", MC[2]],
    ["Ctrl+C", "stops a running command", "runaway  ^C", MC[4]],
    ["Select + middle-click", "copy and paste, the Linux way", "pasteit <paste>", MC[3]],
  ];
  drills.forEach(([k, what, cmd, color], i) => {
    const y = 2.6 + i * 0.95;
    s.addShape(RR, { x: M, y, w: 2.15, h: 0.78, fill: { color }, rectRadius: 0.1 });
    s.addText(k, { x: M + 0.1, y, w: 1.95, h: 0.78, fontFace: HEAD, fontSize: k.length > 10 ? 12 : 16, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, what, M + 2.35, y, 3.0, 0.78, { fontSize: 14.5, valign: "middle" });
    s.addShape(RR, { x: M + 5.4, y: y + 0.12, w: 1.1, h: 0.54, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: M + 5.4, y: y + 0.12, w: 1.1, h: 0.54, fontFace: MONO, fontSize: 10.5, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
  });
  term(s, 7.3, 1.6, 5.43, 4.95, ["$ cd ~/speed/tab", "$ cat dri↹          # Tab completes it", "Piece 1: 3c9e", "$ again   ↑ ↵ x5     # up arrow repeats", "Piece 2: b730", "$ runaway   ^C       # Ctrl+C stops it", "Piece 3: d88c", "$ pasteit <select+middle-click>", "Piece 4: 4a1c", "$ submit CYBA{speed-3c9eb730d88c4a1c}", "Correct! +50 points"], { fontSize: 12.5, title: "player@quest" });

  // ---- Copy and paste the Linux way ----
  s = newSlide("Copy and paste, the Linux way", "The one terminal habit students find surprising, and the one they will use constantly. In a Linux terminal you do NOT need Ctrl+C / Ctrl+V. Selecting text copies it automatically; the middle mouse button (or right-click) pastes it. On a trackpad, middle-click is usually a three-finger tap, or you can right-click to paste. This is drill 4 of the speed warm-up, and it is how you copy a flag into submit.");
  const steps = [
    [fa.FaArrowPointer, "Select to copy", "Drag over the text with the mouse or trackpad. Highlighting it IS copying — no Ctrl+C needed.", MC[2]],
    [fa.FaComputerMouse, "Middle-click to paste", "Click the middle mouse button where you want it. On a trackpad, a three-finger tap.", MC[4]],
    [fa.FaArrowPointer, "Or right-click", "A right-click also pastes. Ctrl+V works too, inside the browser terminal.", GREEN],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [Icon, head, body, color] = steps[i];
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.0);
    await iconCircle(s, Icon, x + 0.3, 1.95, 0.85, color);
    text(s, head, x + 1.3, 2.05, 2.5, 0.75, { fontSize: 18, bold: true, valign: "middle" });
    text(s, body, x + 0.3, 2.95, 3.35, 1.6, { fontSize: 15, color: MUTED });
  }
  card(s, M, 5.0, W - 2 * M, 1.45, "FFF4DC");
  text(s, [{ text: "Why it matters:  ", options: { bold: true } }, { text: "flags are long and easy to mistype. Select the flag, middle-click after  submit , and you never fat-finger a character. Selecting is copying; the middle button pastes." }], M + 0.3, 5.0, W - 2 * M - 0.6, 1.45, { fontSize: 16, valign: "middle" });

  // ===========================================================================
  // READY
  // ===========================================================================
  s = newSlide("Ready? Pick a CTF", "That is everything the warm-ups teach: what a flag is, how to submit, how scoring and the clock work, the capture routine, hints, and the keyboard. From the home page, start with the Linux CTF (the command-line foundation), then try a category: Crypto or Forensics. Each is ten missions, 2,700 points, one clock.");
  const games = [
    ["Linux CTF", "The command-line foundation.", "cd  ls  find  grep  chmod", MC[0]],
    ["Crypto CTF", "Crack the codes.", "base64  caesar  xor  vigenere", MC[3]],
    ["Forensics CTF", "Read the evidence.", "strings  file  xxd  sha256sum", "0F9488"],
  ];
  games.forEach(([name, tag, tools, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.4);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.7, w: 3.9, h: 0.12, fill: { color } });
    text(s, name, x + 0.35, 2.05, 3.2, 0.6, { fontFace: HEAD, fontSize: 24, bold: true });
    text(s, tag, x + 0.35, 2.7, 3.2, 0.6, { fontSize: 16, color: MUTED });
    s.addShape(RR, { x: x + 0.35, y: 3.35, w: 3.2, h: 0.42, fill: { color: TINT }, rectRadius: 0.21 });
    s.addText("10 missions  ·  2,700 points", { x: x + 0.35, y: 3.35, w: 3.2, h: 0.42, fontFace: BODY, fontSize: 12.5, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addShape(RR, { x: x + 0.35, y: 3.95, w: 3.2, h: 0.95, fill: { color: TERM }, rectRadius: 0.1 });
    s.addText(tools, { x: x + 0.5, y: 3.95, w: 2.9, h: 0.95, fontFace: MONO, fontSize: 12, color: T_PROMPT, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
  });
  card(s, M, 5.35, W - 2 * M, 1.1, "E2F5EC");
  text(s, [{ text: "The clock starts at Mission 1. ", options: { bold: true, color: "12704B" } }, { text: "The warm-ups you just did are untimed and already banked. Good luck." }], M + 0.3, 5.35, W - 2 * M - 0.6, 1.1, { fontSize: 17, valign: "middle" });

  const out = path.join(__dirname, "CyberQuest-Warm-ups.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

build().catch((e) => { console.error(e); process.exit(1); });
