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
const MC = ["17875A", "2A9FD6", "2459D8", "7448D4", "D1416B", "E8820C", "C9A227", "0F9488", "5B6EE1", "B4233F"];
// Kept for the shared helpers and older layouts.
const TIER = { warm: MC[1], search: MC[2], logs: MC[3], secrets: MC[4], bonus: AMBER };
// CyberQuest difficulty scale and points.
const LEVEL = { "Easy": { pts: 100, fill: "E2F5EC", ink: "12704B" }, "Medium": { pts: 200, fill: "FFF4DE", ink: "9A5B00" }, "Hard": { pts: 400, fill: "FDE8EC", ink: "B4233F" }, "Very Hard": { pts: 800, fill: "2A1430", ink: "FF8FB1" } };
const HEAD = "Arial", BODY = "Calibri", MONO = "Courier New";
const W = 13.333, H = 7.5, M = 0.6;
const FOOT = "CyberQuest Academy  ·  Linux CTF";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Linux CTF: learn the command line, then compete";
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


// ---- Part 2 is four big ideas ----
const CONCEPTS = [
  { title: "The file system", color: MC[0], missions: "1, 2, 3, 7", cmds: "pwd  cd  ls  cat  chmod",
    short: "Everything is a file or a folder. Point at them with paths, then move around or look inside.",
    statement: "Everything is a file or a folder. You point at them with a path, then move to them or look inside them.",
    verbs: [["Point", "/  ~  .  ..", "A path is the address of a file or folder."], ["Move", "pwd  cd", "Find out where you are, and go somewhere else."], ["Look", "ls  cat", "ls looks inside folders. cat looks inside files."]] },
  { title: "Learning any command", color: MC[1], missions: "2 and up", cmds: "--help  Tab",
    short: "Every command has the same shape, and every command can explain itself.",
    statement: "Every command has the same shape, and every command can explain itself. Nobody memorises them all.",
    verbs: [["Shape", "cmd -opt path", "What to do, how to do it, and what to do it to."], ["Ask", "--help", "Every command explains itself. Read the options."], ["Speed up", "Tab  ↑  Ctrl+C", "Type less, fix faster."]] },
  { title: "Searching", color: MC[3], missions: "4, 5, 6, 10", cmds: "find  grep  |  sort  uniq",
    short: "Too much to read by hand? Search by name or inside files, and chain tools together.",
    statement: "When there is too much to read by hand, let the computer search: by name, or inside files.",
    verbs: [["By name", "find", "Search the whole folder tree for a name."], ["Inside files", "grep", "Print only the lines that contain your word."], ["Chain", "|", "Feed one command's output into the next."]] },
  { title: "Data and secrets", color: MC[5], missions: "8, 9, 10", cmds: "base64",
    short: "Some text only looks secret. Encoding is not encryption.",
    statement: "Some text only looks secret. Encoding changes how data looks; only encryption needs a key.",
    verbs: [["Encode", "base64", "Rewrite any data as plain letters and digits."], ["Decode", "base64 --help", "Anyone can undo it. No key needed."], ["Encrypt", "a secret key", "The real way to keep something secret."]] },
];
// A concept opener: number, title, the one-sentence idea, its three verbs, and the missions it powers.
async function conceptSlide(i, notes) {
  const c = CONCEPTS[i];
  const s = newSlide(null, notes);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.28, h: H, fill: { color: c.color } });
  s.addShape(pres.shapes.OVAL, { x: M + 0.1, y: 0.75, w: 1.3, h: 1.3, fill: { color: c.color } });
  s.addText(String(i + 1), { x: M + 0.1, y: 0.75, w: 1.3, h: 1.3, fontFace: HEAD, fontSize: 54, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Big idea " + (i + 1) + " of 4", { x: M + 1.75, y: 0.8, w: 6, h: 0.4, fontFace: MONO, fontSize: 15, color: MUTED, margin: 0, isTextBox: true });
  s.addText(c.title, { x: M + 1.75, y: 1.15, w: 10, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
  s.addText(c.statement, { x: M + 0.1, y: 2.4, w: W - 2 * M - 0.2, h: 1.1, fontFace: BODY, fontSize: 25, color: INK, margin: 0, valign: "top", isTextBox: true });
  c.verbs.forEach(([verb, cmd, what], j) => {
    const x = M + 0.1 + j * 4.08;
    card(s, x, 3.85, 3.85, 2.15);
    text(s, verb, x + 0.3, 4.0, 3.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true, color: c.color });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 4.6, w: 3.25, h: 0.5, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: x + 0.3, y: 4.6, w: 3.25, h: 0.5, fontFace: MONO, fontSize: 15, bold: true, color: T_CMD, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, what, x + 0.3, 5.2, 3.3, 0.7, { fontSize: 14.5, color: MUTED });
  });
  return s;
}

const MODE = {
  "We do": { color: BLUE, what: "Class calls out each command. Mentor types." },
  "You do": { color: GREEN, what: "Teams race on the clock. Mentor reveals after." },
};

// ---- the ten missions, in the order the page plays them ----
// Terminal output was captured from the page itself. Names, line numbers and flags
// change on every page load, so the slides never show a real flag.
const MS = [
  {
    name: "Make your move", level: "Easy", skill: "pwd  ls  cd  cd ..", mode: "We do", mins: 6,
    where: "~/mission1/town",
    brief: "A flag waits at the end of a trail of folders. Nothing needs opening: the file names are signposts. Read them with ls, follow them with cd.",
    ask: ["Which command shows where you are right now?", "A sign says 'dead end, go back up'. What do we type?", "How will we know which names are folders and which are signs?"],
    term: ["$ cd ~/mission1/town", "$ ls", "library  market  park  sign--go-into-the-library", "$ cd library", "$ ls", "dead-end--go-back-up-and-try-the-park", "$ cd ..", "$ cd park", "$ ls", "gazebo  go-into-the-gazebo-then-the-crate", "$ cd gazebo/crate", "$ ls", { hi: "CYBA{moves-...}  you-made-it--the-flag-is-the-file-name" }, "$ submit CYBA{moves-...}", "Correct! +100 points"], fs: 12,
    happened: ["ls read the signposts: the names of the files in each folder.", "cd followed them, and cd .. backed out of the dead end.", "The last folder's file is named after the flag. No cat needed."],
    real: "Responders land on unfamiliar servers and have to find their way around by typing.",
    stretch: "From the crate folder, how many  cd ..  get you back to ~/mission1? Check with pwd.",
    answer: "cd town; ls; cd <sign>; cd ..; cd <right place>; cd <a>/<b>; ls",
    notes: "CLASS CALLS IT OUT. This is the first mission and the first time the clock matters, so keep it upbeat.\n\nAsk before every cd: 'what do the names say?' Folders show in blue in ls; the long dashed names are plain files used as signs. Try cd into a sign on purpose: 'Not a directory' is a great teaching moment.\n\nThe first sign always leads to a dead end on purpose, so the class has to use cd .. . The last step shows that cd can take two folders at once: cd gazebo/crate.\n\nThe flag is a file NAME. Select it in the ls output and paste it after submit.\n\nPlace names are random per computer: park, library, market, harbor, station, arcade; then fountain, gazebo, tunnel, bridge or kiosk; then locker, crate, shed, cellar or toolbox.",
  },
  {
    name: "Let the cat out of the bag", level: "Easy", skill: "cat  --help", mode: "We do", mins: 6,
    where: "~/mission2",
    brief: "bag.txt has 100 lines and every one looks like a flag. README.txt names the one real line. Counting by hand is how mistakes happen: make cat number the lines.",
    ask: ["How do we read README.txt?", "How could we find out what options cat has?", "Once the lines are numbered, how do we find ours fast?"],
    term: ["$ cd ~/mission2", "$ cat README.txt", "The cat is hiding in bag.txt.", "Every line in the bag looks like a flag,", "but only line 63 is real.", "$ cat --help", "Usage: cat [-nbvteA] [FILE]...", "        -n      Number output lines", "$ cat -n bag.txt", "    62  meow CYBA{cat-1f0c2a9e}", { hi: "    63  meow CYBA{cat-...}" }, "    64  meow CYBA{cat-77b3d4c1}", "$ submit CYBA{cat-...}", "Correct! +100 points"], fs: 12.5,
    happened: ["cat printed README.txt, which named the real line.", "cat --help listed its options; -n numbers the lines.", "cat -n bag.txt put a number on every line, so line 63 was easy to spot."],
    real: "Engineers learn new tools every week. Reading --help is how they do it.",
    stretch: "Try  cat --help  again. What does -b do differently from -n?",
    answer: "cat README.txt;  cat --help;  cat -n bag.txt",
    notes: "CLASS CALLS IT OUT. Two lessons in one: cat reads files, and --help makes any command explain itself.\n\nBefore anyone runs cat --help, ask: 'how would you find out what a program can do if nobody told you?' Then show the two dashes.\n\nRead the help out loud: the Usage line says cat takes options, then files. -n numbers output lines.\n\nThe real line number is random per computer (30 to 95). Teams scroll up to find it; on a laptop that is easy.\n\nSubmitting a look-alike line gives 'Incorrect flag', a nice proof that only one is real.",
  },
  {
    name: "Now you see me", level: "Easy", skill: "ls -a", mode: "You do", mins: 4,
    where: "~/mission3",
    brief: "There is a flag in this folder, but plain ls will not show it. Files whose names start with a dot are hidden. One hidden file is a decoy.",
    ask: ["What did we learn about names that start with a dot?", "Which ls option shows them?", "How will we tell the real file from the decoy?"],
    term: ["$ cd ~/mission3", "$ ls", "notes.txt", "$ ls -a", ".  ..  .old-n0mp  .stash  notes.txt", "$ cat .old-n0mp", "Close, but this hidden file is a decoy.", "$ cat .stash", "You found the hidden file.", { hi: "Flag: CYBA{hidden-...}" }, "$ submit CYBA{hidden-...}", "Correct! +100 points"],
    happened: ["Plain ls skipped every name that starts with a dot.", "ls -a showed them all, decoy included.", "cat read each one until the real flag appeared."],
    real: "On a suspicious machine, ls -a is one of the first commands an investigator runs.",
    stretch: "Run  ls -a ~  . Which hidden file lives in your home folder?",
    answer: "ls -a;  cat the dot file that is not .old-...",
    notes: "TEAMS RACE. From here on the clock really matters: teams solve first, and you reveal this walkthrough after most have it.\n\nIf a team is stuck, point them at hint 3, or ask 'what does ls --help say about names that start with a dot?'\n\nThe real file is .treasure, .stash, .secret-notes or .backup-codes; the decoy always starts with .old-.\n\nStretch answer: .profile, the file that sets up the coloured prompt.",
  },
  {
    name: "Needle in the tree", level: "Medium", skill: "find -name", mode: "You do", mins: 6,
    where: "~/mission4",
    brief: "The archive folder holds about 80 files in 20 folders. One file has the ending named in README.txt, and it holds the flag.",
    ask: ["Opening 20 folders by hand would take ages. Which tool searches for us?", "What does the star in  \"*.gem\"  mean?", "Once find prints a path, how do we read that file?"],
    term: ["$ cd ~/mission4", "$ cat README.txt", "Somewhere in archive/ is ONE file ending in .gem", "It holds the flag.", "$ find archive -name \"*.gem\"", "archive/charlie/bin-x7q2/k3d9fa.gem", "$ cat archive/charlie/bin-x7q2/k3d9fa.gem", { hi: "Flag: CYBA{finder-...}" }, "$ submit CYBA{finder-...}", "Correct! +200 points"],
    happened: ["README.txt turned 'some file' into a pattern: any name ending in .gem.", "find searched every folder below archive in one go.", "cat read the file at the exact path find printed."],
    real: "Responders search whole servers for key and password files that should not be there.",
    stretch: "Type the cat command again, but press Tab after each few letters of the path.",
    answer: "cat README.txt;  find archive -name \"*.<ending>\";  cat <path>",
    notes: "TEAMS RACE. Worth 200 points: the first Medium.\n\nThe ending is random per computer: .key, .gem or .relic. Teams must read their OWN README.\n\nWhen revealing, read the find command as a sentence: find, starting in archive, things whose name ends in .gem. Keep the quotes around the pattern.\n\nThe long path is the perfect moment for Tab.",
  },
  {
    name: "Search party", level: "Medium", skill: "grep", mode: "You do", mins: 6,
    where: "~/mission5",
    brief: "An intruder logged in once. Their line is buried in access.log, which has 12,000 lines. The token on that line is the flag.",
    ask: ["What happens if we just cat a 12,000-line file?", "find searches file names. What searches inside a file?", "What word should we search for?"],
    term: ["$ cd ~/mission5", "$ cat README.txt", "An intruder logged in ONCE as:  red_panda", "$ wc -l access.log", "12000 access.log", "$ head -2 access.log", "08:00:00 user=erin action=LOGOUT token=1cca26ec", "08:00:01 user=ivan action=LOGIN_FAIL token=5bb550e1", "$ grep red_panda access.log", { hi: "10:47:13 user=red_panda action=LOGIN_OK token=CYBA{grep-...}" }, "$ submit CYBA{grep-...}", "Correct! +200 points"], fs: 12,
    happened: ["wc -l proved the log is far too long to read.", "head showed the shape of one line: time, user, action, token.", "grep kept only the intruder's line. The token is the flag."],
    real: "Security analysts search millions of log lines for one name or address every day.",
    stretch: "Try  grep -c LOGIN_OK access.log  . What does -c change?",
    answer: "cat README.txt;  grep <name> access.log",
    notes: "TEAMS RACE. If a team runs cat access.log, 12,000 lines blur past: that makes the case for grep. Ctrl+C stops it early.\n\nThe intruder's name is random per computer: nightowl, ghost_fox, zero_cool, red_panda or pixel_wolf.\n\nCopy only the token value, starting at CYBA{ and ending at }.",
  },
  {
    name: "Odd one out", level: "Medium", skill: "sort  uniq  |", mode: "You do", mins: 5,
    where: "~/mission6",
    brief: "codes.txt holds about 900 flags. Every fake one appears at least twice; the real one appears exactly once. Sort the lines so twins sit together, then keep the loner.",
    ask: ["Why would sorting help us spot duplicates?", "What does the | symbol do with two commands?", "Which uniq option keeps only the lines with no twin?"],
    term: ["$ cd ~/mission6", "$ head -3 codes.txt", "CYBA{odd-3f9a0c1e}", "CYBA{odd-b27d44a0}", "CYBA{odd-3f9a0c1e}", "$ wc -l codes.txt", "906 codes.txt", "$ uniq --help", "        -u      Only print unique lines", "$ sort codes.txt | uniq -u", { hi: "CYBA{odd-...}" }, "$ submit CYBA{odd-...}", "Correct! +200 points"], fs: 12,
    happened: ["sort put identical lines next to each other.", "uniq -u kept only the lines that appear exactly once.", "The pipe fed sort's output straight into uniq: no extra file needed."],
    real: "Analysts run sort | uniq -c on logs every day to find the one odd event among millions.",
    stretch: "Try  sort codes.txt | uniq -c | sort -n | head -3  . What does the first column mean?",
    answer: "sort codes.txt | uniq -u",
    notes: "TEAMS RACE. The first pipe mission. uniq only compares NEIGHBOURING lines, so uniq -u on the unsorted file prints almost everything: a great 'why?' moment.\n\nIf stuck: hint 6 (costs 10 points), or 'what does uniq --help say about unique lines?'\n\nAlso correct: sort codes.txt | uniq -c | sort -n | head -1 shows a count of 1 next to the flag.",
  },
  {
    name: "Permission denied", level: "Medium", skill: "ls -l  chmod +x", mode: "You do", mins: 5,
    where: "~/mission7",
    brief: "The flag is behind a locked door: unlock.sh, a script. Run it and Linux refuses. ls -l shows the file's permissions, and you own the file, so you can change them.",
    ask: ["What is 'Permission denied' telling us?", "In  -rw-r--r--  which letter would mean 'can run'?", "How do we add that permission?"],
    term: ["$ cd ~/mission7", "$ ./unlock.sh", "-sh: ./unlock.sh: Permission denied", "$ ls -l unlock.sh", "-rw-r--r--  1 player player  108 unlock.sh", "$ chmod +x unlock.sh", "$ ls -l unlock.sh", { hi: "-rwxr-xr-x  1 player player  108 unlock.sh" }, "$ ./unlock.sh", "Access granted.", { hi: "Flag: CYBA{exec-...}" }, "$ submit CYBA{exec-...}", "Correct! +200 points"], fs: 12,
    happened: ["ls -l showed r and w, but no x: readable, not runnable.", "chmod +x added the execute permission.", "./unlock.sh ran the script from this folder, and it printed the flag."],
    real: "Admins fix 'Permission denied' every week; attackers hunt for files whose permissions are too loose.",
    stretch: "Run  ls -l /etc/quest  . Who owns those files? Can you chmod them?",
    answer: "chmod +x unlock.sh;  ./unlock.sh",
    notes: "TEAMS RACE. Read the permission string in threes: owner, group, everyone. r read, w write, x execute (run).\n\nSome teams will cat unlock.sh and decode its hidden .door file with base64 by hand. That works too: praise it as thinking like an attacker, then ask them to do it the intended way.\n\nStretch answer: root owns them, and player cannot change them (Operation not permitted). That is exactly why the answers are safe.",
  },
  {
    name: "Decoder ring", level: "Hard", skill: "base64 -d", mode: "You do", mins: 5,
    where: "~/mission8",
    brief: "message.b64 looks like gibberish. It is not encrypted, only encoded. No password needed, just the right option.",
    ask: ["Upper case, lower case, digits and an = at the end. Which encoding looks like that?", "Encoded or encrypted: what is the difference?", "How do we find the option that decodes?"],
    term: ["$ cd ~/mission8", "$ cat message.b64", "RGVjb2RlZCEgRW5jb2RpbmcgaXMgbm90IGVuY3J5cHRpb24u...", "ZTJhNGZ9Cg==", "$ base64 --help", "Usage: base64 [-d] [-w COL] [FILE]", "        -d      Decode data", "$ base64 -d message.b64", "Decoded! Encoding is not encryption.", { hi: "Flag: CYBA{decoded-...}" }, "$ submit CYBA{decoded-...}", "Correct! +400 points"],
    happened: ["The letters, digits and trailing = gave base64 away.", "--help showed that -d means decode.", "No key was needed, because encoding is not encryption."],
    real: "Attackers hide commands in base64 hoping nobody looks. Analysts decode first.",
    stretch: "Encode your first name with  echo NAME | base64  . Can a neighbour decode it?",
    answer: "base64 -d message.b64",
    notes: "TEAMS RACE. Worth 400 points: the first Hard. The command is short; recognising base64 and finding -d in the help is the hard part.\n\nAsk again after: did we need a password to undo this? No. So it was never secret. Mission 9 builds straight on this.",
  },
  {
    name: "Layer cake", level: "Hard", skill: "base64 -d | base64 -d", mode: "You do", mins: 5,
    where: "~/mission9",
    brief: "cake.b64 was base64-encoded, then encoded again, and again: four to six layers, and nobody wrote down how many. Peel them with one pipeline.",
    ask: ["After one decode it still looks like base64. Now what?", "How can one base64 -d feed the next one?", "How will we know we reached the last layer?"],
    term: ["$ cd ~/mission9", "$ base64 -d cake.b64", "Vm0wd2QyUXlVWGxWV0d4V1YwZDRWMVl3WkRSWFJteFZVMjA1...", "$ base64 -d cake.b64 | base64 -d", "Vm0weE5HSXlTWGxUV0doVVlteHdUMVpzVW5O...", "# Up arrow, add one more | base64 -d, repeat", "$ base64 -d cake.b64 | base64 -d | base64 -d \\", "    | base64 -d | base64 -d", { hi: "Flag: CYBA{layers-...}" }, "$ submit CYBA{layers-...}", "Correct! +400 points"], fs: 11.5,
    happened: ["Each base64 -d removed one layer.", "Pipes stacked the decodes: Up arrow plus one more  | base64 -d  was the whole workflow.", "When the output read 'Flag:', no layers were left."],
    real: "Malware often wraps its payload in several layers of encoding. Analysts peel them one at a time.",
    stretch: "Make your own:  echo hi | base64 | base64 | base64  . Swap with a team and peel theirs.",
    answer: "base64 -d cake.b64 | base64 -d | ...  (4 to 6 times)",
    notes: "TEAMS RACE. Worth 400 points. The number of layers is random (4, 5 or 6), so teams cannot copy each other's command.\n\nThe Up arrow is the star of this mission: bring the last command back, add  | base64 -d , press Enter.\n\nIf the output turns into garbage symbols, they decoded once too many: remove the last pipe.",
  },
  {
    name: "Endgame", level: "Very Hard", skill: "find  grep  cut  base64  chmod", mode: "You do", mins: 10,
    where: "~/mission10",
    brief: "The final boss. The flag is split into three pieces, each hidden a different way: a hidden file in a folder tree, a base64 token in a log, and a locked script. Assemble CYBA{piece1-piece2-piece3}.",
    ask: ["Which earlier mission taught the skill for each piece?", "How can we pull just the token out of one log line?", "In which order do the pieces go?"],
    term: ["$ cd ~/mission10", "$ grep Piece README.txt", "  Piece 2: glitch logged in once in auth.log ...", "$ find vault -name \".*\" -type f", "vault/south/rack-ml4/.stash   (+ 3 decoys)", "$ cat vault/south/rack-ml4/.stash", { hi: "piece 1: 244e32" }, "$ grep glitch auth.log | cut -d= -f4 | base64 -d", { hi: "piece 2: a7fdd6" }, "$ chmod +x unlock.sh && ./unlock.sh", { hi: "piece 3: 917b9b" }, "$ submit CYBA{244e32-a7fdd6-917b9b}", "Correct! +800 points"], fs: 11,
    happened: ["find listed every hidden file in vault; cat told the real piece from the decoys.", "grep found the intruder's line, cut kept field 4 (the token) and base64 -d decoded it.", "chmod +x unlocked the script, which printed piece 3."],
    real: "Real incidents are never one trick: responders chain search, logs and decoding to rebuild what happened.",
    stretch: "When the last flag lands the clock stops. What was your total, and which mission had your biggest Took?",
    answer: "find vault -name \".*\";  grep NAME auth.log | cut -d= -f4 | base64 -d;  chmod +x unlock.sh",
    notes: "TEAMS RACE. Worth 800 points: the biggest prize and the only Very Hard mission. Expect only the strongest teams to finish. Points land only for the whole flag, but every piece found is progress worth praising.\n\nCoach piece by piece: 'Which mission taught you hidden files? Searching a log? A locked script?'\n\ncut -d= -f4 means: split the line at every = sign and keep the 4th part, the token. Copying the token by hand into  echo TOKEN | base64 -d  works too.\n\nThe pieces on this slide are an example: every computer has its own.\n\nWhen the last flag lands, the clock stops and the sidebar shows the finish card. Celebrate it.",
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
    "Welcome the class and introduce the mentors: name, what you do, and one sentence on how you use a terminal at work.\n\n" +
    "Promise: 'In the next 90 minutes you will start a Linux computer inside your browser, learn about a dozen commands, then compete for 2,700 points against the clock.'\n\n" +
    "Before class: the link is written on the 'Open the CTF' slide, and you have watched it reach 'Ready' on a student Chromebook on the school network.");
  s.addText("CyberQuest", { x: M, y: 1.35, w: 6.6, h: 1.3, fontFace: HEAD, fontSize: 72, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Linux CTF: learn the command line, then compete.", { x: M, y: 2.75, w: 6.3, h: 1.1, fontFace: BODY, fontSize: 28, color: T_OUT, margin: 0, isTextBox: true });
  chip(s, "simulated CTF competition", M, 4.15, 3.0, AMBER, INK, 15);
  s.addText("CyberQuest Academy mentorship session", { x: M, y: 4.85, w: 6, h: 0.4, fontFace: BODY, fontSize: 17, bold: true, color: WHITE, margin: 0, isTextBox: true });
  trail(s, M, 5.85, 6.0, N + 1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 1.2, w: 5.43, h: 4.95, fill: { color: "162238" }, rectRadius: 0.12, line: { color: "2B3B5C", width: 1 } });
  ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: 7.55 + i * 0.24, y: 1.4, w: 0.14, h: 0.14, fill: { color: c } }));
  s.addText([
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "whoami", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "player", options: { color: T_OUT, breakLine: true } },
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "ls skills/", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "(empty, for now)", options: { color: T_NOTE, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: P, options: { color: T_PROMPT, bold: true } }, { text: "./start-ctf", options: { color: WHITE, bold: true, breakLine: true } },
    { text: "10 flags hidden, plus a warm-up", options: { color: T_OUT, breakLine: true } },
    { text: "2,700 points up for grabs", options: { color: T_OUT, breakLine: true } },
    { text: "clock starts when you type", options: { color: T_OUT, breakLine: true } },
    { text: "Good luck.", options: { color: AMBER, bold: true } },
  ], { x: 7.65, y: 1.85, w: 4.8, h: 4.1, fontFace: MONO, fontSize: 18, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 3 });

  // ---- run of show ----
  s = newSlide("Today's mission, in four parts",
    "Walk the timeline so students know the competition is coming and the theory is short.\n\n" +
    "Timing for 90 minutes: opening 3 min, Part 1 Linux 101 10 min, Part 2 learn 25 min (open the CTF at the start: see the mentor appendix), Part 3 compete 42 min, Part 4 debrief 10 min.\n\n" +
    "Part 2 teaches the commands in exactly the order the missions need them, so each mission feels like using something you just learned.\n\n" +
    "If you only have 60 minutes: demo the Try it pills instead of pausing for them, and skip the side quests.");
  const plan = [["10", "Linux 101", "Where Linux came from, why it is everywhere, and why we type.", MC[0]], ["25", "Learn", "Open the CTF, then a dozen commands in the order the missions use them.", MC[2]], ["42", "Compete", "Ten flags, 2,700 points, one clock. Easiest first.", MC[3]], ["10", "Debrief", "How it stays fair, and where this leads.", MC[4]]];
  plan.forEach(([min, name, what, color], i) => {
    const x = M + i * 3.07;
    card(s, x, 1.7, 2.87, 3.9);
    s.addText(min, { x: x + 0.25, y: 1.9, w: 1.9, h: 1.15, fontFace: HEAD, fontSize: 58, bold: true, color, margin: 0, isTextBox: true });
    text(s, "minutes", x + 0.25, 3.05, 1.9, 0.35, { fontSize: 14, color: MUTED });
    text(s, name, x + 0.25, 3.55, 1.9, 0.5, { fontFace: HEAD, fontSize: 21, bold: true });
    text(s, what, x + 0.25, 4.1, 1.85, 1.4, { fontSize: 14.5, color: MUTED });
  });
  card(s, M, 5.85, W - 2 * M, 0.75, "FFF4DC");
  text(s, [{ text: "The deal: ", options: { bold: true } }, { text: "nobody is expected to know any of this already. Typing the wrong thing is how everyone learns it." }], M + 0.3, 5.85, W - 2 * M - 0.6, 0.75, { valign: "middle", fontSize: 17 });

  // ---- what is a CTF ----
  s = newSlide("What is a capture the flag?",
    "A capture the flag, or CTF, is a puzzle competition for security skills. Each puzzle hides a secret piece of text called a flag. Find it, submit it, score points.\n\n" +
    "Read the flag anatomy out loud. Every flag today starts with CYBA and has its secret between curly braces.\n\n" +
    "Ask: 'Why would companies want people who are good at this?' Because finding the hidden thing, legally and with permission, is exactly what defenders are paid to do.\n\n" +
    "Stress the word permission. This CTF is built to be explored. Real systems are not yours to poke at.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "CYBA", options: { color: "7FB2FF", bold: true } }, { text: "{", options: { color: AMBER, bold: true } }, { text: "moves-4c8c640b", options: { color: T_PROMPT, bold: true } }, { text: "}", options: { color: AMBER, bold: true } }],
    { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 40, align: "center", valign: "middle", margin: 0, isTextBox: true });
  [["CYBA", "2459D8", "Always the same start", "Every flag today begins with CYBA."], ["{   }", "C07A00", "The wrapper", "Curly braces mark where the secret begins and ends."], ["moves-4c8c640b", "17875A", "The secret", "A word, a dash, 8 random characters. New on every computer."]].forEach(([tok, color, head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 3.45, 3.9, 1.65);
    mono(s, tok, x + 0.25, 3.6, 3.4, 0.4, { fontSize: 19, color });
    text(s, head, x + 0.25, 4.05, 3.4, 0.35, { fontSize: 16, bold: true });
    text(s, body, x + 0.25, 4.42, 3.45, 0.6, { fontSize: 14, color: MUTED });
  });
  const round = [["Read", "the mission"], ["Find", "the flag"], ["Submit", "the whole thing"], ["Score", "points on the board"]];
  round.forEach(([a, b], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.45, w: 2.6, h: 1.0, fill: { color: MC[i + 1] }, rectRadius: 0.1 });
    s.addText([{ text: a, options: { bold: true, fontSize: 20, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x, y: 5.45, w: 2.6, h: 1.0, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addText(">", { x: x + 2.6, y: 5.45, w: 0.47, h: 1.0, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });

  // ===========================================================================
  // PART 1: BOOT UP
  // ===========================================================================
  section("Part 1 · Linux fundamentals");
  divider(1, "Linux fundamentals", "Where Linux came from, why it runs nearly everything, and why professionals still drive it with a keyboard.", MC[0], "uname -s   # Linux",
    "Section break. Eight minutes of story before anyone touches a keyboard. Keep it fast and visual: the point is WHY this matters, not memorising dates.\n\nAsk: 'Who thinks they have used Linux today?' Count hands now, and again at the end of this part.");

  // ---- a brief history ----
  s = newSlide("A brief history of Linux",
    "Tell it as a story: a small idea from a phone company lab, a free-software movement, and a student's hobby project that ended up running the world.\n\n" +
    "1969: Ken Thompson and Dennis Ritchie create Unix at Bell Labs. Its ideas (small tools, everything is a file, a shell to glue them together) are exactly what we use today.\n" +
    "1983: Richard Stallman launches the GNU project to build a free Unix-like system. Many everyday commands come from that tradition.\n" +
    "1991: Linus Torvalds, a 21-year-old student in Helsinki, posts a 'just a hobby' kernel. Combined with free tools, it becomes a complete free operating system.\n" +
    "2008: the first Android phone ships, built on the Linux kernel.\n" +
    "2017: from the November 2017 TOP500 list on, every one of the world's 500 fastest supercomputers runs Linux.\n\n" +
    "Vocabulary: Linux is the kernel, the core that talks to the hardware. A distribution (Ubuntu, Debian, Fedora, Kali) is Linux plus tools, packaged together. Linux is open source: anyone can read and improve the code.");
  const hist = [["1969", "Unix is born", "Thompson and Ritchie build Unix at Bell Labs: small tools, files and a shell.", MC[1]],
    ["1983", "GNU begins", "Stallman starts building a free, Unix-like system and its tools.", MC[2]],
    ["1991", "Linux", "Linus Torvalds, a 21-year-old student, posts a 'hobby' kernel.", MC[0]],
    ["2008", "Android", "The first Android phone ships, built on the Linux kernel.", MC[3]],
    ["2017", "500 / 500", "Every one of the world's top 500 supercomputers runs Linux.", MC[4]],
    ["Today", "Everywhere", "Phones, servers, the cloud, TVs, cars and game consoles.", MC[5]]];
  s.addShape(pres.shapes.RECTANGLE, { x: M + 0.2, y: 2.32, w: W - 2 * M - 0.4, h: 0.06, fill: { color: LINE } });
  hist.forEach(([year, head, body, color], i) => {
    const x = M + i * 2.04;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.14, y: 2.0, w: 1.6, h: 0.7, fill: { color }, rectRadius: 0.12 });
    s.addText(year, { x: x + 0.14, y: 2.0, w: 1.6, h: 0.7, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, x, 3.0, 1.88, 3.3);
    text(s, head, x + 0.18, 3.15, 1.6, 0.6, { fontFace: HEAD, fontSize: 18, bold: true, color });
    text(s, body, x + 0.18, 3.8, 1.58, 2.3, { fontSize: 14.5, color: MUTED });
  });
  text(s, [{ text: "Linux ", options: { bold: true } }, { text: "is the kernel, the core. A " }, { text: "distribution ", options: { bold: true } }, { text: "(Ubuntu, Debian, Kali) is Linux plus tools, ready to use." }], M, 6.45, W - 2 * M, 0.4, { fontSize: 14 });

  // ---- developers and security ----
  s = newSlide("Why developers and security pros live in Linux",
    "Two audiences, same tool.\n\n" +
    "Developers: most servers, cloud machines and containers run Linux, so code gets built, tested and deployed there. Git, the tool almost every developer uses, was written by Linus Torvalds in 2005 to manage the Linux kernel. In Stack Overflow's 2025 developer survey, about 28% of developers said they use Ubuntu for personal work, and that is just one Linux distribution.\n\n" +
    "Security: defenders read Linux logs, investigate Linux servers and run security tools that are made for Linux first. Kali Linux, a distribution built for penetration testing, ships with hundreds of security tools. CTF competitions, like the one later today, are usually played on Linux.\n\n" +
    "Bridge: every command you learn today works on those same systems.");
  card(s, M, 1.7, 4.3, 2.2, TERM);
  s.addText("500 / 500", { x: M + 0.35, y: 1.85, w: 3.6, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: T_PROMPT, margin: 0, isTextBox: true });
  text(s, "of the world's fastest supercomputers run Linux (TOP500, since 2017).", M + 0.35, 2.8, 3.6, 0.9, { fontSize: 15, color: WHITE });
  card(s, M, 4.1, 4.3, 2.2, TERM);
  s.addText("28%", { x: M + 0.35, y: 4.25, w: 3.6, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: AMBER, margin: 0, isTextBox: true });
  text(s, "of developers use Ubuntu, just one Linux, for personal work (Stack Overflow 2025 survey).", M + 0.35, 5.2, 3.6, 0.9, { fontSize: 15, color: WHITE });
  const pros = [[fa.FaCode, "Developers", "Servers, the cloud and containers run Linux, so code is built, tested and shipped there. Git was written for the Linux kernel.", MC[2]],
    [fa.FaShieldHalved, "Security analysts", "Logs, servers and investigations live on Linux. Most security tools are made for it first.", MC[4]],
    [fa.FaUserSecret, "Ethical hackers", "Kali Linux ships with hundreds of testing tools. CTFs like today's are played on Linux.", MC[3]]];
  for (let i = 0; i < pros.length; i++) {
    const [Icon, head, body, color] = pros[i];
    const y = 1.75 + i * 1.55;
    await iconCircle(s, Icon, 5.5, y, 0.9, color);
    text(s, head, 6.7, y - 0.02, 6, 0.45, { fontSize: 22, bold: true });
    text(s, body, 6.7, y + 0.45, 5.9, 0.85, { fontSize: 16, color: MUTED });
  }

  // ---- in your pocket ----
  s = newSlide("It's in your pocket",
    "Make it personal: most students carry Linux every day without knowing it.\n\n" +
    "About 69% of the world's phones run Android (StatCounter, September 2026), and Android is built on the Linux kernel. iPhones are not Linux, but they come from the same Unix family tree, so many of today's commands work on a Mac too.\n\n" +
    "Chromebooks run ChromeOS, which is built on Linux: anyone on a Chromebook right now is using Linux. Many smart TVs, home Wi-Fi routers, car dashboards and the Steam Deck run Linux too. And almost every app on your phone talks to servers that run Linux.\n\n" +
    "Ask: 'Now who thinks they used Linux today?' Count hands again.");
  card(s, M, 1.7, 4.3, 4.6, TERM);
  s.addText("69%", { x: M + 0.35, y: 2.0, w: 3.6, h: 1.3, fontFace: HEAD, fontSize: 72, bold: true, color: T_PROMPT, margin: 0, isTextBox: true });
  text(s, "of the world's phones run Android, which is built on the Linux kernel.", M + 0.35, 3.4, 3.6, 1.2, { fontSize: 20, color: WHITE });
  text(s, "StatCounter, worldwide mobile OS share, September 2026", M + 0.35, 5.6, 3.6, 0.5, { fontSize: 12, color: T_NOTE });
  const devices = [[fa.FaMobileScreen, "Android phones", MC[3]], [fa.FaLaptop, "Chromebooks", MC[2]], [fa.FaTv, "Smart TVs", MC[4]], [fa.FaWifi, "Wi-Fi routers", MC[1]],
    [fa.FaCar, "Car dashboards", MC[5]], [fa.FaGamepad, "Steam Deck", MC[7]], [fa.FaCloud, "The cloud", MC[8]], [fa.FaServer, "Web servers", MC[0]]];
  for (let i = 0; i < devices.length; i++) {
    const [Icon, label, color] = devices[i];
    const x = 5.3 + (i % 4) * 1.9, y = 1.75 + Math.floor(i / 4) * 2.0;
    card(s, x, y, 1.75, 1.8);
    await iconCircle(s, Icon, x + 0.47, y + 0.22, 0.8, color);
    text(s, label, x + 0.05, y + 1.15, 1.65, 0.5, { fontSize: 14, bold: true, align: "center" });
  }
  card(s, 5.3, 5.85, 7.45, 0.6, "E2F5EC");
  text(s, "On a Chromebook right now? You are already using Linux.", 5.55, 5.85, 7, 0.6, { valign: "middle", fontSize: 16, bold: true, color: "0F6A45" });

  // ---- terminal vs shell ----
  s = newSlide("Terminal, shell, kernel: who does what?",
    "People say 'terminal' and 'shell' as if they were the same thing. They are layers.\n\n" +
    "The terminal is the window: it shows text and sends your keystrokes. The shell is the program inside it that reads each command, runs it and prints the answer. Popular shells are bash, zsh and sh; today's CTF uses sh from BusyBox. The kernel is Linux itself: it runs programs and talks to the hardware.\n\n" +
    "The prompt (player@quest:~$) is the shell saying 'your turn'. CLI means command-line interface: working by typing commands. GUI means graphical user interface: windows, icons and a mouse.");
  const layers = [["You", "type a command and press Enter", "E4EAF3", INK], ["Terminal", "the window: shows text, sends your keystrokes", MC[1], WHITE],
    ["Shell", "reads the command and runs it: sh, bash, zsh", MC[2], WHITE], ["Kernel", "Linux itself: runs programs, talks to hardware", MC[0], WHITE], ["Hardware", "CPU, memory, disk, network", "56657E", WHITE]];
  layers.forEach(([name, what, fill, ink], i) => {
    const y = 1.65 + i * 0.98, inset = i * 0.25;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + inset, y, w: 6.6 - 2 * inset, h: 0.82, fill: { color: fill }, rectRadius: 0.1 });
    s.addText([{ text: name + "   ", options: { bold: true, fontSize: 20 } }, { text: what, options: { fontSize: 13.5 } }], { x: M + inset + 0.25, y, w: 6.2 - 2 * inset, h: 0.82, fontFace: BODY, color: ink, valign: "middle", margin: 0, isTextBox: true });
  });
  term(s, 7.55, 1.65, 5.18, 2.9, ["$ echo $0", "sh", "# the shell's name", "$ uname -s", "Linux", "# the kernel's name"], { fontSize: 16, title: "terminal window" });
  card(s, 7.55, 4.75, 5.18, 1.7);
  text(s, [{ text: "CLI ", options: { bold: true, color: MC[2] } }, { text: "command-line interface: you type.", options: { breakLine: true } }, { text: "GUI ", options: { bold: true, color: MC[4] } }, { text: "graphical user interface: you point and click." }], 7.8, 4.85, 4.8, 1.5, { fontSize: 16, valign: "middle" });

  // ---- anatomy of the terminal ----
  s = newSlide("Anatomy of the terminal",
    "Before anyone types, name the parts of the screen. Point at each one on the projector as you go.\n\n" +
    "1. The terminal is the black window. It is just text: no buttons, no icons. You talk to the computer by typing, and it answers in text.\n" +
    "2. The prompt, player@quest:~, tells you who you are (player), which computer (quest) and which folder you are in (~, your home).\n" +
    "3. The prompt character $ means 'ready, your turn'. A very common beginner mistake is typing the $ as well. Don't: it is already there.\n" +
    "4. The command is what you type after the $. Nothing happens until you press Enter.\n" +
    "5. The output is the computer's answer, printed underneath.\n" +
    "6. Then a fresh prompt appears with a blinking cursor: your turn again.\n\n" +
    "Ask a student to come up and point at each part on the screen.");
  {
    const tx = M, ty = 1.6, tw = 7.7, th = 4.85, cw = 17 * 0.6 / 72, x0 = 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: ty, w: tw, h: th, fill: { color: TERM }, rectRadius: 0.1, shadow: { type: "outer", color: "12213A", opacity: 0.22, blur: 10, offset: 3, angle: 90 } });
    ["E5534B", "F5A623", "46D39A"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: tx + 0.22 + i * 0.22, y: ty + 0.17, w: 0.13, h: 0.13, fill: { color: c } }));
    s.addText("CyberQuest Linux CTF terminal", { x: tx + 1, y: ty + 0.08, w: tw - 2, h: 0.3, fontFace: MONO, fontSize: 10, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
    const seg = (t, col, cIdx, y, color, bold = true) => s.addText(t, { x: x0 + cIdx * cw, y, w: t.length * cw + 0.3, h: 0.45, fontFace: MONO, fontSize: 17, bold, color, margin: 0, valign: "middle", isTextBox: true });
    const ring = (cIdx, len, y, color) => { const p = len === 1 ? 0.02 : 0.07; return s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0 + cIdx * cw - p, y: y - 0.02, w: len * cw + 2 * p, h: 0.49, fill: { type: "none" }, line: { color, width: 2 }, rectRadius: 0.06 }); };
    const badge = (n, x, y, color, ink = INK) => {
      s.addShape(pres.shapes.OVAL, { x, y, w: 0.36, h: 0.36, fill: { color } });
      s.addText(String(n), { x, y, w: 0.36, h: 0.36, fontFace: HEAD, fontSize: 13, bold: true, color: ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
    };
    const L1 = 2.45, L2 = 3.55, L3 = 4.65;
    const C = { prompt: "46D39A", dollar: AMBER, cmd: "7FB2FF", out: "C9A7FF", cur: "FF8FB1" };
    seg("player@quest:~", 0, 0, L1, C.prompt); seg("$", 0, 14, L1, C.dollar); seg("pwd", 0, 16, L1, WHITE);
    seg("# then press Enter", 0, 21, L1, T_NOTE, false);
    seg("/home/player", 0, 0, L2, T_OUT, false);
    seg("player@quest:~", 0, 0, L3, C.prompt); seg("$", 0, 14, L3, C.dollar);
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + 16 * cw, y: L3 + 0.05, w: cw * 0.9, h: 0.36, fill: { color: T_OUT } });
    ring(0, 14, L1, C.prompt); ring(14, 1, L1, C.dollar); ring(16, 3, L1, C.cmd); ring(0, 12, L2, C.out); ring(16, 1, L3, C.cur);
    badge(1, tx + tw - 0.55, ty + 0.12, WHITE);
    badge(2, x0 - 0.12, L1 - 0.46, C.prompt); badge(3, x0 + 14 * cw - 0.1, L1 - 0.46, C.dollar); badge(4, x0 + 16 * cw + 0.12, L1 - 0.46, C.cmd);
    badge(5, x0 - 0.12, L2 - 0.46, C.out); badge(6, x0 + 16 * cw - 0.1, L3 - 0.46, C.cur);
    const legend = [["The terminal", "The black window. You type, and the computer answers in text.", "8B98AD"], ["The prompt", "player@quest:~ shows who you are, which computer, which folder.", "17875A"], ["The prompt character", "$ means 'ready, your turn'. Never type it yourself.", "C07A00"], ["The command", "What you type after the $. Then press Enter.", BLUE], ["The output", "The computer's answer, printed underneath.", MC[3]], ["A new prompt", "A fresh $ and a blinking cursor: your turn again.", MC[4]]];
    legend.forEach(([head, body, color], i) => {
      const y = 1.6 + i * 0.85;
      s.addShape(pres.shapes.OVAL, { x: 8.6, y: y + 0.02, w: 0.38, h: 0.38, fill: { color } });
      s.addText(String(i + 1), { x: 8.6, y: y + 0.02, w: 0.38, h: 0.38, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
      text(s, head, 9.15, y - 0.02, 3.6, 0.35, { fontSize: 17, bold: true });
      text(s, body, 9.15, y + 0.33, 3.6, 0.45, { fontSize: 13, color: MUTED });
    });
  }

  // ---- CLI vs GUI ----
  s = newSlide("CLI vs GUI",
    "Be fair to the GUI: it is easier to discover, and great for one-off visual work. Professionals use both and pick the right tool.\n\n" +
    "The CLI wins whenever the work is precise, repeated, big, remote or needs to be shared. A command is also documentation: you can paste exactly what you did into a chat or a script.\n\n" +
    "Ask: 'Which column would you want if you had to do this job a thousand times?'");
  const rows = [["Learning it", "Easy to discover: look around and click", "Learn the words first, then you are fast"],
    ["Rename 500 files", "500 right-clicks", "One line"],
    ["Find one line in a huge log", "Scroll, squint, Ctrl+F", "grep finds it in a blink"],
    ["Repeat yesterday's work", "Remember every click", "Press the Up arrow, or run the script"],
    ["A server 1,000 miles away", "Needs a remote desktop and a fast link", "Works over a slow text connection"],
    ["Show someone how you did it", "Screenshots and arrows", "Paste the command"]];
  const cx = [M, M + 3.3, M + 7.75], cw = [3.2, 4.35, 4.38];
  [["", INK], ["GUI: point and click", MC[4]], ["CLI: type commands", MC[2]]].forEach(([h, color], j) => {
    if (h) { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx[j], y: 1.6, w: cw[j], h: 0.6, fill: { color }, rectRadius: 0.08 });
      s.addText(h, { x: cx[j], y: 1.6, w: cw[j], h: 0.6, fontFace: HEAD, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true }); }
  });
  rows.forEach(([task, gui, cli], i) => {
    const y = 2.32 + i * 0.7;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: W - 2 * M, h: 0.62, fill: { color: i % 2 ? WHITE : TINT } });
    text(s, task, cx[0] + 0.15, y, cw[0] - 0.2, 0.62, { fontSize: 15, bold: true, valign: "middle" });
    text(s, gui, cx[1] + 0.15, y, cw[1] - 0.2, 0.62, { fontSize: 15, color: MUTED, valign: "middle" });
    text(s, cli, cx[2] + 0.15, y, cw[2] - 0.2, 0.62, { fontSize: 15, color: i ? GREEN : MUTED, bold: i > 0, valign: "middle" });
  });

  // ---- performance ----
  s = newSlide("Speed: nothing beats the command line",
    "The conclusion of Part 1. For work that is repeated, large or remote, the command line is unmatched by any GUI.\n\n" +
    "Speed of doing: one line replaces hundreds of clicks, and a script repeats it forever. Speed of the machine: a shell needs a few megabytes of memory, while a graphical desktop needs far more, so a command line runs fine on tiny devices and busy servers. Speed of reach: text travels over even a weak connection, so one person can manage thousands of servers.\n\n" +
    "The click times are estimates, about three seconds per rename. The point is the shape, not the exact numbers.\n\n" +
    "Bridge to Part 2: 'In the competition you will search a 12,000-line log. Let's open the CTF and learn the command-line essentials.'");
  const races = [["Rename 500 photos", "~25 min", "of clicking", "1 line", "for f in *.jpg; do mv \"$f\" \"trip-$f\"; done", MC[2]],
    ["Find one line in 12,000", "minutes", "of scrolling and squinting", "< 1 sec", "grep red_panda access.log", MC[3]],
    ["Do it on 100 servers", "hours", "of remote desktops", "1 loop", "for h in $(cat servers); do ssh $h uptime; done", MC[4]]];
  races.forEach(([task, gt, gwhat, ct, cmd, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.65, 3.9, 3.85);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 3.9, h: 0.1, fill: { color } });
    text(s, task, x + 0.3, 1.85, 3.4, 0.5, { fontFace: HEAD, fontSize: 19, bold: true });
    text(s, "GUI", x + 0.3, 2.45, 1.0, 0.35, { fontSize: 12, bold: true, color: MUTED });
    s.addText([{ text: gt + "  ", options: { fontSize: 26, bold: true, color: MC[4] } }, { text: gwhat, options: { fontSize: 13, color: MUTED } }], { x: x + 0.3, y: 2.75, w: 3.4, h: 0.6, fontFace: HEAD, margin: 0, valign: "middle", isTextBox: true });
    text(s, "CLI", x + 0.3, 3.45, 1.0, 0.35, { fontSize: 12, bold: true, color: MUTED });
    s.addText(ct, { x: x + 0.3, y: 3.75, w: 3.4, h: 0.6, fontFace: HEAD, fontSize: 26, bold: true, color: GREEN, margin: 0, valign: "middle", isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 4.5, w: 3.3, h: 0.75, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: x + 0.4, y: 4.5, w: 3.1, h: 0.75, fontFace: MONO, fontSize: 11, bold: true, color: T_CMD, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.75, w: W - 2 * M, h: 0.75, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT } }, { text: "Repeated, big or remote work? The command line is unmatched.", options: { color: WHITE } }], { x: M + 0.35, y: 5.75, w: W - 2 * M - 0.7, h: 0.75, fontFace: MONO, fontSize: 19, bold: true, valign: "middle", margin: 0, isTextBox: true });

  // ---- anatomy of the page ----
  s = newSlide("Anatomy of the competition page",
    "A real screenshot from the middle of a game: warm-up and two flags captured, mission 3 open.\n\n" +
    "Walk the eight parts. The progress track lights one coloured bar per flag. Points, the clock and flags captured sit at the top of the sidebar. The clock waits during the warm-up, starts with Mission 1, counts up and stops at the last flag. The stepper shows a green check for each captured mission. Each mission shows its difficulty and points. Run buttons type the starting commands for you. Next unlocks once the flag is captured.\n\n" +
    "The most common problem in class is typing before clicking inside the terminal. Say it twice.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M - 0.05, y: 1.6, w: 7.3, h: 4.34, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img", "page.png"), x: M, y: 1.65, w: 7.2, h: 4.235 });
  const k = 7.2 / 1360, px = (x) => M + x * k, py = (y) => 1.65 + y * k;
  // Pin positions come from the screenshot script (img/pins.json), so they always match the picture.
  const P8 = JSON.parse(fs.readFileSync(path.join(__dirname, "img", "pins.json"), "utf8"));
  const sorted = [[...P8.track, MC[1]], [...P8.points, AMBER], [...P8.clock, BLUE], [...P8.stepper, MC[0]], [...P8.level, MC[4]], [...P8.copy, MC[3]], [...P8.terminal, "56657E"], [...P8.next, MC[2]]];
  sorted.forEach(([x, y, color], i) => {
    s.addShape(pres.shapes.OVAL, { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fill: { color }, line: { color: WHITE, width: 2 } });
    s.addText(String(i + 1), { x: px(x) - 0.2, y: py(y) - 0.2, w: 0.4, h: 0.4, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "Mid-game: warm-up and missions 1 and 2 captured, mission 3 open.", M, 6.1, 7, 0.35, { fontSize: 12, color: MUTED });
  const parts8 = [["Progress track", "One coloured bar lights up per flag.", MC[1]], ["Points", "Your score, out of 2,750 with the warm-up.", AMBER], ["Clock", "Starts at Mission 1 and counts up.", BLUE], ["Stepper", "0 is the warm-up; a green check per flag.", MC[0]], ["Level and points", "Easy 100 up to Very Hard 800.", MC[4]], ["Copy buttons", "Copy a starting command, then paste it.", MC[3]], ["Terminal", "Click inside it before you type.", "56657E"], ["Next mission", "Unlocks when the flag is captured.", MC[2]]];
  parts8.forEach(([head, body, color], i) => {
    const y = 1.62 + i * 0.6;
    s.addShape(pres.shapes.OVAL, { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fill: { color } });
    s.addText(String(i + 1), { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, [{ text: head + "  ", options: { bold: true, fontSize: 15 } }, { text: body, options: { fontSize: 13, color: MUTED } }], 8.6, y, 4.15, 0.5, { valign: "middle" });
  });

  // ===========================================================================
  // PART 2: LEARN, IN MISSION ORDER
  // ===========================================================================
  section("Part 2 · Command-line essentials");
  divider(2, "Command-line essentials", "Open the CTF, then four big ideas and a dozen commands. Each idea powers a mission, and every slide has a Try it.", MC[2], "man linux   # the manual, in 25 minutes",
    "Section break. Tell the class: 'Part 2 is four big ideas. Each one is a set of tools for the competition.'\n\nDemo every command live on the projector. Then give the room 30 seconds to type the green Try it command themselves.\n\nNone of the Try it commands touch the mission folders, so nothing gets spoiled.");

  // ---- the four big ideas ----
  s = newSlide("Four big ideas",
    "The map of Part 2. Every command today belongs to one of four ideas, and the ideas build on each other.\n\n" +
    "1. The file system: everything is a file or a folder. You point at them with paths, then move around or look inside.\n" +
    "2. Learning any command: every command has the same shape, and every command can explain itself.\n" +
    "3. Searching: when there is too much to look at by hand, let the computer search by name or inside files.\n" +
    "4. Data and secrets: some text only looks secret.\n\n" +
    "Each idea is a set of tools the class will need in the competition.");
  CONCEPTS.forEach((c, i) => {
    const x = M + i * 3.07;
    card(s, x, 1.65, 2.87, 4.85);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 2.87, h: 0.12, fill: { color: c.color } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.98, w: 0.7, h: 0.7, fill: { color: c.color } });
    s.addText(String(i + 1), { x: x + 0.25, y: 1.98, w: 0.7, h: 0.7, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.title, x + 0.25, 2.85, 2.45, 0.8, { fontFace: HEAD, fontSize: 21, bold: true, valign: "top" });
    text(s, c.short, x + 0.25, 3.7, 2.45, 1.3, { fontSize: 14.5, color: MUTED });
    mono(s, c.cmds, x + 0.25, 5.05, 2.45, 0.75, { fontSize: 13, color: INK });
  });

  section("Big idea 1 · The file system");
  await conceptSlide(0, "Concept 1: the file system. Say the sentence on the slide out loud and have the class repeat the three verbs: point, move, look.\n\n" +
    "Everything that follows in this concept is one of those three things: a path points at something; pwd and cd move you; ls and cat look.");

  // ---- files and folders ----
  s = newSlide("Files and folders",
    "Two kinds of things live on a Linux computer, and telling them apart is the first skill.\n\n" +
    "A file holds data: text, a picture, a program. You look inside a file with cat.\n" +
    "A folder (Linux says 'directory') holds files and other folders. You look inside a folder with ls, and you can step into it with cd.\n\n" +
    "Three ways to tell them apart: ls shows folders in blue; ls -l starts folder lines with d and file lines with -; cd into a file says 'Not a directory'.\n\n" +
    "TRY IT: ls -l ~ . Every mission line starts with d, because each mission is a folder.\n\n" +
    "COMES BACK IN: Mission 1 is a trail of folders, and its signposts are file names.", "ls -l ~");
  [["Folder", "a.k.a. directory", "Holds files and other folders. Look inside with ls. Step into it with cd.", "ls shows it in blue  ·  ls -l starts with d", MC[2], fa.FaFolderOpen], ["File", "", "Holds data: text, a picture, a program. Look inside with cat. You can't cd into it.", "ls shows it in white  ·  ls -l starts with -", MC[4], fa.FaFileLines]].forEach(([head, aka, body, how, color], i) => {
    const y = 1.65 + i * 2.45;
    card(s, M, y, 5.9, 2.25);
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: 0.12, h: 2.25, fill: { color } });
    text(s, [{ text: head, options: { bold: true, fontSize: 24 } }, { text: aka ? "   " + aka : "", options: { fontSize: 14, color: MUTED } }], M + 0.35, y + 0.15, 5.3, 0.55, { fontFace: HEAD, valign: "middle" });
    text(s, body, M + 0.35, y + 0.75, 4.5, 0.8, { fontSize: 16 });
    mono(s, how, M + 0.35, y + 1.6, 5.4, 0.45, { fontSize: 12.5, color: color, bold: true });
  });
  for (let i = 0; i < 2; i++) await iconCircle(s, i ? fa.FaFileLines : fa.FaFolderOpen, M + 4.95, 1.8 + i * 2.45, 0.7, i ? MC[4] : MC[2]);
  term(s, 6.85, 1.6, 5.88, 4.85, ["$ ls ~", "mission1  mission2  ...  mission10", "$ ls -l ~", { hi: "drwxr-xr-x  2 player ... mission1" }, "# d at the start: a directory (folder)", "$ ls -l /etc/passwd", "-rw-r--r--  1 root  ...  /etc/passwd", "# - = a plain file", "$ cd /etc/passwd", "-sh: cd: can't cd to /etc/passwd:", "  Not a directory"], { fontSize: 14 });

  // ---- paths ----
  s = newSlide("Pointing at things: paths",
    "A path is the address of a file or folder: folder names joined by slashes. Commands need paths to know what to act on.\n\n" +
    "Absolute paths start with / (the root) and work from anywhere. Relative paths start from wherever you are now, so they are shorter but depend on your location.\n\n" +
    "Four special names: / is the top of the tree, ~ is your home, . is right here, .. is one level up.\n\n" +
    "All three commands at the bottom go to the same place when you start at home. Ask the class: which one works from anywhere?\n\n" +
    "TRY IT: ls /home/player and ls ~ show the same thing.", "ls /home/player   ls ~");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.25, fill: { color: TERM }, rectRadius: 0.1 });
  const segs = [["/", AMBER], ["home", "7FB2FF"], ["/", AMBER], ["player", "46D39A"], ["/", AMBER], ["mission1", "C9A7FF"], ["/", AMBER], ["town", "FF8FB1"]];
  s.addText(segs.map(([t, c]) => ({ text: t, options: { color: c, bold: true } })), { x: M, y: 1.65, w: W - 2 * M, h: 1.25, fontFace: MONO, fontSize: 38, align: "center", valign: "middle", margin: 0, isTextBox: true });
  text(s, "Each name is a folder inside the one before it. The slashes join them.", M, 2.98, W - 2 * M, 0.35, { fontSize: 14, color: MUTED, align: "center" });
  [["/", "the root: top of the tree"], ["~", "your home: /home/player"], [".", "right here"], ["..", "one level up"]].forEach(([t, d], i) => {
    const x = M + i * 3.07;
    card(s, x, 3.5, 2.87, 1.15);
    mono(s, t, x + 0.25, 3.6, 0.9, 0.95, { fontSize: 32, color: MC[i + 1], valign: "middle" });
    text(s, d, x + 1.15, 3.6, 1.6, 0.95, { fontSize: 14.5, valign: "middle" });
  });
  [["Absolute", "cd /home/player/mission1/town", "Starts at /. Works from anywhere."], ["Relative", "cd mission1/town", "Starts where you are (here: home)."], ["From home", "cd ~/mission1/town", "Starts at ~. Works from anywhere."]].forEach(([head, cmd, what], i) => {
    const x = M + i * 4.11;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.9, w: 3.9, h: 1.55, fill: { color: TINT }, rectRadius: 0.1 });
    text(s, head, x + 0.25, 5.0, 3.4, 0.4, { fontSize: 16, bold: true });
    mono(s, cmd, x + 0.25, 5.42, 3.5, 0.4, { fontSize: 12.5, color: BLUE });
    text(s, what, x + 0.25, 5.85, 3.5, 0.45, { fontSize: 13, color: MUTED });
  });


  // ---- mission 1: moving around ----
  s = newSlide("Moving around: pwd and cd",
    "Files live in folders (Linux calls them directories), and folders nest like a tree. The top is / , called the root.\n\n" +
    "Five moves: pwd prints where you are, ls lists what is here, cd NAME goes into a folder, cd .. goes back up one level, and cd ~ (or just cd) takes you home. cd can also take a path: cd a/b goes two levels down at once.\n\n" +
    "In ls, folders show in blue. cd only works on folders; cd into a file says 'Not a directory'.\n\n" +
    "TRY IT: cd /etc, pwd, cd .., pwd, cd ~. Have students say out loud where they expect to be before pressing Enter.\n\n" +
    "COMES BACK IN: Mission 1, Make your move, is all about these five.", "cd /etc   cd ..   cd ~");
  const box = (label, x, y, w, color = TINT, ink = INK) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.46, fill: { color }, rectRadius: 0.08 });
    s.addText(label, { x, y, w, h: 0.46, fontFace: MONO, fontSize: 14, bold: true, color: ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
  };
  const line = (x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: y2 - y1, line: { color: "9AA8BF", width: 1.5 }, flipH: x2 < x1 });
  line(2.9, 2.1, 1.35, 2.55); line(2.9, 2.1, 2.9, 2.55); line(2.9, 2.1, 4.45, 2.55);
  line(2.9, 3.0, 2.9, 3.35); line(2.9, 3.8, 2.9, 4.15);
  box("/", 2.5, 1.65, 0.8, TERM, WHITE);
  box("etc", 0.75, 2.55, 1.2); box("home", 2.3, 2.55, 1.2); box("tmp", 3.85, 2.55, 1.2);
  box("player   ~", 2.05, 3.35, 1.7, AMBER, INK);
  box("mission1", 2.15, 4.15, 1.5, MC[0], WHITE);
  s.addText([{ text: "↓ cd mission1", options: { breakLine: true } }, { text: "↑ cd .." }], { x: 3.1, y: 3.72, w: 2.2, h: 0.5, fontFace: MONO, fontSize: 11, bold: true, color: MUTED, margin: 0, isTextBox: true });
  // command chips in two rows under the tree
  [["pwd", "where am I?"], ["ls", "what's here?"], ["cd NAME", "go in"], ["cd ..", "go up"], ["cd ~", "go home"]].forEach(([c, w], i) => {
    const x = M + (i % 3) * 1.9, y = 4.85 + Math.floor(i / 3) * 0.78;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.75, h: 0.4, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(c, { x, y, w: 1.75, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, color: T_CMD, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, w, x, y + 0.4, 1.75, 0.3, { fontSize: 12, color: MUTED, align: "center" });
  });
  term(s, 6.2, 1.6, 6.5, 4.9, ["$ pwd", "/home/player", "$ cd /etc", "$ pwd", "/etc", "$ cd ..   # up one level", "$ pwd", "/", "$ cd ~   # home again", "$ ls   # folders show in blue", "mission1  mission2  ...  mission10"], { fontSize: 15 });

  // ---- viewing folders ----
  s = newSlide("Looking inside folders: ls",
    "ls looks inside a folder. On its own it looks where you are; give it a path and it looks there without moving you.\n\n" +
    "Hidden files: any name that starts with a dot is skipped by plain ls. ls -a shows all of them, including . (here) and .. (up). Hiding is a convention, not security. Your home folder has one: .profile.\n\n" +
    "ls -l shows details: file or folder, permissions, owner, size.\n\n" +
    "TRY IT: ls -a ~ shows the hidden .profile.\n\n" +
    "COMES BACK IN: Mission 1 (reading signposts with ls) and Mission 3, Now you see me (ls -a).", "ls -a ~");
  [["ls", "what is in this folder?"], ["ls PATH", "look somewhere else, without moving"], ["ls -a", "all, including hidden dot files"], ["ls -l", "long: type, permissions, owner, size"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 1.8 + i * 0.85, 5.9, 1.9));
  card(s, M, 5.35, 5.9, 1.1, "FFF4DC");
  text(s, [{ text: "Hidden is not secret. ", options: { bold: true } }, { text: "A dot at the start of a name just tells ls to skip it." }], M + 0.3, 5.35, 5.3, 1.1, { valign: "middle", fontSize: 17 });
  term(s, 7.0, 1.6, 5.7, 4.85, ["$ ls ~", "mission1  mission2  ...  mission10", "", "$ ls -a ~", { hi: ".  ..  .profile" }, "mission1  mission2  ...  mission10", "", "$ ls /home   # look without moving", "player"], { fontSize: 15, title: "names starting with a dot are hidden" });

  // ---- mission 2: reading files ----
  s = newSlide("Looking inside files: cat",
    "cat prints a whole file. That is perfect for short files and terrible for huge ones, so there are tools for looking at part of a file, or just measuring it.\n\n" +
    "/etc/passwd lists the accounts on this computer. Here there are only two: root, the all-powerful administrator, and player, you.\n\n" +
    "less opens a file you can scroll: arrow keys or space to move, q to quit. Say 'q to quit' twice.\n\n" +
    "COMES BACK IN: cat is in every mission from Mission 2 on; head and wc -l help in Mission 5.", "cat /etc/passwd");
  [["cat file", "print the whole file"], ["head -3 file", "only the first 3 lines"], ["wc -l file", "count the lines"], ["less file", "scroll through it (q quits)"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 1.8 + i * 0.85, 5.9, 2.6));
  card(s, M, 5.35, 5.9, 1.1, "FFF4DC");
  text(s, [{ text: "Stuck inside less? ", options: { bold: true } }, { text: "Press q. Stuck anywhere else? Press Ctrl+C." }], M + 0.3, 5.35, 5.3, 1.1, { valign: "middle", fontSize: 17 });
  term(s, 7.0, 1.6, 5.7, 4.85, ["$ cat /etc/passwd", "root:x:0:0:root:/root:/bin/sh", "player:x:1000:1000:player:", "  /home/player:/bin/sh", "", "$ wc -l /etc/passwd", { hi: "2 /etc/passwd" }, "", "$ head -1 /etc/passwd", "root:x:0:0:root:/root:/bin/sh"], { fontSize: 15 });

  // ---- permissions: ls -l and chmod ----
  s = newSlide("Who can do what: ls -l and chmod",
    "Every file carries permissions: who may read it, change it, or run it. ls -l shows them as a ten-letter string; chmod changes them, but only on files you own.\n\n" +
    "Read the string in threes after the first letter: owner, group, everyone. r read, w write, x execute (run). A dash means 'no'.\n\n" +
    "./name runs a program or script in the current folder. Without the x permission, Linux answers 'Permission denied'.\n\n" +
    "Demo on the right with a two-line script. Do NOT use mission 7's file: that is the puzzle.\n\n" +
    "COMES BACK IN: Mission 7, Permission denied, and Endgame.", "ls -l /etc/passwd");
  [["ls -l", "show permissions"], ["chmod +x file", "add execute (run)"], ["chmod -w file", "take away write"], ["./file", "run a script in this folder"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 1.8 + i * 0.85, 5.9, 2.6));
  card(s, M, 5.3, 5.9, 1.2);
  mono(s, "-  rwx  r-x  r-x", M + 0.3, 5.38, 3.2, 0.5, { fontSize: 22, color: INK });
  text(s, "type   owner   group   everyone", M + 0.3, 5.88, 3.6, 0.4, { fontSize: 13, color: MUTED });
  text(s, "r read  ·  w write  ·  x run", M + 3.6, 5.38, 2.2, 0.9, { fontSize: 14, bold: true, color: MC[0], valign: "middle" });
  term(s, 7.0, 1.6, 5.7, 4.9, ["$ echo 'echo hello' > hi.sh", "$ ./hi.sh", "-sh: ./hi.sh: Permission denied", "$ ls -l hi.sh", "-rw-r--r--  1 player ... hi.sh", "$ chmod +x hi.sh", "$ ls -l hi.sh", { hi: "-rwxr-xr-x  1 player ... hi.sh" }, "$ ./hi.sh", { hi: "hello" }], { fontSize: 15, title: "permissions" });

  section("Big idea 2 · Learning any command");
  await conceptSlide(1, "Concept 2: learning any command. Nobody memorises every command. Professionals know the shape of a command and how to make it explain itself.\n\n" +
    "Point back to Concept 1: the arguments of most commands are paths.");

  s = newSlide("The shape of a command",
    "Read the line left to right. Everything before the $ is the prompt. Everything after it is what you type.\n\n" +
    "Most commands follow the same shape: command, then options (usually starting with a dash), then arguments (what to act on).\n\n" +
    "TRY IT: ls -l /home lists /home in the long format. Nothing happens until you press Enter, and Linux is case-sensitive: LS does not work.", "ls -l /home");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  const parts = [["player", "46D39A"], ["@", T_OUT], ["quest", "7FB2FF"], [":", T_OUT], ["~", AMBER], ["$ ", T_OUT], ["ls", WHITE], [" -l", "FF8FB1"], [" /home", "7EE0D2"]];
  s.addText(parts.map(([t, c]) => ({ text: t, options: { color: c, bold: true } })), { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 36, align: "center", valign: "middle", margin: 0, isTextBox: true });
  const labels = [["player", "17875A", "Who you are", "the account inside your computer"], ["quest", "2459D8", "Which computer", "the Linux running in your tab"], ["~", "C07A00", "Where you are", "~ means your home folder"], ["ls", INK, "The command", "what to do: list files"], ["-l", "C2356A", "An option", "how to do it: the long format"], ["/home", "0E8C7A", "An argument", "what to do it to"]];
  labels.forEach(([tok, color, head, body], i) => {
    const x = M + (i % 3) * 4.11, y = 3.55 + Math.floor(i / 3) * 1.55;
    card(s, x, y, 3.9, 1.3);
    mono(s, tok, x + 0.25, y + 0.15, 3.4, 0.4, { fontSize: 20, color });
    text(s, [{ text: head + ": ", options: { bold: true } }, { text: body }], x + 0.25, y + 0.65, 3.5, 0.5, { fontSize: 15 });
  });

  // ---- mission 2: --help ----
  s = newSlide("Ask any command: --help",
    "The most useful skill of the whole session. Almost every command explains itself if you type its name, a space, and --help.\n\n" +
    "Read the help in two parts. The Usage line shows the shape: options in square brackets are optional, FILE... means one or more files. Then the option list: each option and what it does.\n\n" +
    "We use wc here on purpose; Mission 2 asks students to do the same with cat, so don't show cat --help yet.\n\n" +
    "On a full Linux system, man COMMAND opens the longer manual (q quits). The page's small Linux has --help only.\n\n" +
    "COMES BACK IN: Mission 2 needs it, and the first hint for most missions says 'read the --help'. --help is free; hints are not.", "wc --help");
  term(s, M, 1.6, 7.1, 4.85, ["$ wc --help", "Usage: wc [-cmlwL] [FILE]...", "", "Count lines, words, and bytes for FILEs", "", "        -c      Count bytes", "        -m      Count characters", { hi: "        -l      Count newlines" }, "        -w      Count words", "        -L      Print longest line length"], { fontSize: 15, title: "the command explains itself" });
  const helpParts = [["Usage line", "The shape of the command. [ ] means optional. FILE... means one or more files.", MC[2]], ["Option list", "One option per line, with what it does. Pick the one that matches your goal.", MC[3]], ["Then try it", "Put the option between the command and the file:  wc -l file", MC[1]]];
  helpParts.forEach(([head, body, color], i) => {
    const y = 1.6 + i * 1.65;
    card(s, 8.0, y, 4.73, 1.45);
    s.addShape(pres.shapes.RECTANGLE, { x: 8.0, y, w: 0.12, h: 1.45, fill: { color } });
    text(s, head, 8.35, y + 0.15, 4.2, 0.4, { fontSize: 18, bold: true });
    text(s, body, 8.35, y + 0.58, 4.25, 0.8, { fontSize: 14, color: MUTED });
  });

  // ---- keyboard shortcuts ----
  s = newSlide("Type less, fix faster",
    "Four keys that make everyone faster, and that matter in a timed competition.\n\n" +
    "Tab: type the first letters of a name and press Tab; the shell finishes it. If several names match, press Tab twice to see the choices. It also prevents typos in long paths.\n\n" +
    "Up arrow brings back the last command so you can fix or extend it. Ctrl+C stops whatever is running. clear wipes the screen.\n\n" +
    "TRY IT: type cd miss and press Tab twice.", "cd miss<Tab><Tab>");
  term(s, M, 1.6, 6.0, 3.6, ["$ cd miss<Tab>", "$ cd mission   # 10 matches, so it stops", "# press Tab twice to list them", "mission1/  mission2/  ...  mission10/", "$ cd mission4/arch<Tab>", "$ cd mission4/archive/"], { fontSize: 15, title: "Tab finishes names for you" });
  const keys = [["Tab", "finish a name or path", MC[1]], ["Up arrow", "bring back the last command", MC[2]], ["Ctrl+C", "stop what is running", MC[4]], ["clear", "wipe the screen", MC[3]]];
  keys.forEach(([k, w, color], i) => {
    const y = 1.6 + i * 0.92;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.95, y, w: 1.9, h: 0.75, fill: { color: WHITE }, rectRadius: 0.1, line: { color, width: 2.5 } });
    s.addText(k, { x: 6.95, y, w: 1.9, h: 0.75, fontFace: MONO, fontSize: 17, bold: true, color, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, w, 9.05, y, 3.7, 0.75, { fontSize: 18, valign: "middle" });
  });
  card(s, M, 5.45, W - 2 * M, 1.0);
  await iconCircle(s, fa.FaKeyboard, M + 0.25, 5.6, 0.7, BLUE);
  text(s, [{ text: "In a race, Tab is speed. ", options: { bold: true } }, { text: "Long paths like archive/charlie/bin-x7q2/k3d9fa.gem take seconds with Tab and a minute without it." }], M + 1.2, 5.45, 10.6, 1.0, { valign: "middle", fontSize: 17 });

  section("Big idea 3 · Searching");
  await conceptSlide(2, "Concept 3: searching. When a folder tree or a file is too big to read by hand, you let the computer search.\n\n" +
    "find searches the TREE by name. grep searches INSIDE files by content. Pipes let you chain small tools into a bigger question.");

  // ---- mission 4: find ----
  s = newSlide("Finding files with find",
    "Opening folders one by one does not scale. find walks every sub-folder for you.\n\n" +
    "Read the command as a sentence: find, starting in /etc, files whose name matches this pattern. The star means 'anything'. Keep the quotes around a pattern that has a star.\n\n" +
    "TRY IT: find /etc -name \"p*\" finds passwd and profile.\n\n" +
    "COMES BACK IN: Mission 4, Needle in the tree.", "find /etc -name \"p*\"");
  const fparts = [["find", "the command", INK, WHITE], ["/etc", "where to start looking", MC[2], WHITE], ["-name \"p*\"", "what to match: any name starting with p", MC[3], WHITE]];
  let fx = M;
  fparts.forEach(([t, d, color, ink], i) => {
    const w = [1.3, 1.8, 3.1][i];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: 1.8, w, h: 0.75, fill: { color }, rectRadius: 0.08 });
    s.addText(t, { x: fx, y: 1.8, w, h: 0.75, fontFace: MONO, fontSize: 17, bold: true, color: ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, d, fx, 2.65, w, 0.9, { fontSize: 13, color: MUTED });
    fx += w + 0.12;
  });
  cmdRow(s, "-name passwd", "match one exact name", M, 3.95, 6.4, 3.1);
  cmdRow(s, "-name \"*.txt\"", "match a pattern", M, 4.65, 6.4, 3.1);
  cmdRow(s, "-type d", "only folders (f for files)", M, 5.35, 6.4, 3.1);
  term(s, 7.3, 1.6, 5.4, 4.85, ["$ find /etc -name \"p*\"", "/etc/passwd", "/etc/profile", "", "$ find /etc -type d", "/etc", "/etc/quest"], { fontSize: 16 });

  // ---- mission 5: grep ----
  s = newSlide("Searching inside files: grep",
    "find looks at file names. grep looks inside files and prints only the lines that contain your word.\n\n" +
    "This is the everyday tool of a security analyst: logs are huge, and the one line that matters is in there somewhere.\n\n" +
    "TRY IT: grep player /etc/passwd prints the one line about your account.\n\n" +
    "COMES BACK IN: Mission 5, Search party.", "grep player /etc/passwd");
  term(s, M, 1.6, W - 2 * M, 2.75, ["$ grep player /etc/passwd   # search one file", { hi: "player:x:1000:1000:player:/home/player:/bin/sh" }, "$ grep -r PS1 /etc   # search every file below here", { hi: "/etc/profile:export PS1='...'" }], { fontSize: 17 });
  [["grep word file", "print the lines that contain the word"], ["grep -r word /etc", "search every file in every folder below"], ["grep -c word file", "just count the matching lines"]].forEach(([c, w], i) => {
    const x = M + i * 4.11;
    card(s, x, 4.75, 3.9, 1.7);
    mono(s, c, x + 0.25, 4.95, 3.5, 0.4, { fontSize: 16 });
    text(s, w, x + 0.25, 5.45, 3.4, 0.9, { fontSize: 16, color: MUTED });
  });

  // ---- pipes ----
  s = newSlide("Pipes: chain small tools",
    "The pipe character sends the output of one command into the next. Each tool does one small job; chained together they answer a real question.\n\n" +
    "Here: how many commands on this computer have 'sh' in their name? ls /bin lists every command. grep keeps the names containing sh. wc -l counts them.\n\n" +
    "Build it up live, one stage at a time, using the Up arrow to bring the last command back. The pipe key is Shift plus backslash.\n\n" +
    "COMES BACK IN: Mission 5 (head and wc -l to size up the log), Missions 6, 9 and 10, and the side quests.", "ls /bin | grep sh | wc -l");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.6, w: W - 2 * M, h: 0.85, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT } }, { text: "ls /bin ", options: { color: WHITE } }, { text: "|", options: { color: AMBER } }, { text: " grep sh ", options: { color: WHITE } }, { text: "|", options: { color: AMBER } }, { text: " wc -l", options: { color: WHITE } }],
    { x: M + 0.35, y: 1.6, w: W - 2 * M - 0.7, h: 0.85, fontFace: MONO, fontSize: 24, bold: true, valign: "middle", margin: 0, isTextBox: true });
  const stages = [["ls /bin", "list every command", "[\nacpid\nadjtimex\nash\n...\nzcat", MUTED, 3.1], ["grep sh", "keep names containing sh", "ash\nsh\nsha1sum\nsha256sum\n...\nunshare", MC[2], 3.1], ["wc -l", "count the lines", "10", MC[3], 2.75], ["answer", "one number", "10 commands", MC[4], 2.1]];
  let px0 = M;
  stages.forEach(([name, what, data, color, w], i) => {
    card(s, px0, 2.85, w, 3.6);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px0 + 0.2, y: 3.05, w: w - 0.4, h: 0.5, fill: { color }, rectRadius: 0.08 });
    s.addText(name, { x: px0 + 0.2, y: 3.05, w: w - 0.4, h: 0.5, fontFace: MONO, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, what, px0 + 0.2, 3.65, w - 0.4, 0.4, { fontSize: 13, color: MUTED });
    mono(s, data, px0 + 0.2, 4.15, w - 0.4, 2.2, { fontSize: 15, bold: i >= 2, color: i >= 2 ? GREEN : INK });
    if (i < stages.length - 1) s.addText(i < 2 ? "|" : "=", { x: px0 + w, y: 4.2, w: 0.36, h: 0.6, fontFace: MONO, fontSize: 24, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
    px0 += w + 0.36;
  });

  // ---- sort, uniq, cut ----
  s = newSlide("Sort and count: sort, uniq, cut",
    "Three more small tools that shine in a pipe.\n\n" +
    "sort puts lines in order, so identical lines end up next to each other. uniq squashes neighbouring repeats: -c counts them, -u keeps only the lines with no twin. Because uniq only looks at neighbours, it almost always comes after sort.\n\n" +
    "cut slices one field out of every line: -d says what separates the fields, -f which field to keep. Try it on /etc/passwd, where fields are separated by colons.\n\n" +
    "COMES BACK IN: Mission 6, Odd one out (sort | uniq), Endgame (cut) and the side quests.", "cut -d: -f1 /etc/passwd");
  [["sort file", "put lines in order"], ["uniq -c", "count neighbouring repeats"], ["uniq -u", "only lines with no twin"], ["cut -d: -f1", "keep field 1 (split at :)"]].forEach(([c, w], i) => cmdRow(s, c, w, M, 1.8 + i * 0.85, 5.9, 2.6));
  card(s, M, 5.35, 5.9, 1.1, "FFF4DC");
  text(s, [{ text: "Rule of thumb: ", options: { bold: true } }, { text: "sort first, then uniq. uniq only compares lines that sit next to each other." }], M + 0.3, 5.35, 5.3, 1.1, { valign: "middle", fontSize: 16 });
  term(s, 7.0, 1.6, 5.7, 4.9, ["# an example file", "$ cat snacks.txt", "chips", "apple", "chips", "pear", "apple", "chips", "$ sort snacks.txt | uniq -c", "      2 apple", "      3 chips", "      1 pear", "$ sort snacks.txt | uniq -u", { hi: "pear" }], { fontSize: 14, title: "sort and uniq" });

  section("Big idea 4 · Data and secrets");
  await conceptSlide(3, "Concept 4: data and secrets. It powers Missions 8, 9 and the Endgame.\n\n" +
    "Some text only looks secret. Knowing the difference between encoding and encryption is a core security idea.");

  // ---- mission 6: encoding ----
  s = newSlide("Encoding is not encryption",
    "A security idea worth one slide. Base64 turns any data into plain letters and digits so it can travel through systems that only handle text. It looks scrambled, but there is no key: anyone can reverse it.\n\n" +
    "Encryption needs a secret key to undo. Attackers often hide commands in base64 hoping nobody looks; analysts decode it in one command.\n\n" +
    "Don't show the decode option: finding it with base64 --help is Mission 8. Ask 'how could we find out which option decodes?' and leave it open.\n\n" +
    "How to recognise base64: a mix of upper case, lower case and digits, sometimes ending in one or two = signs.\n\n" +
    "COMES BACK IN: Mission 8, Decoder ring; Mission 9, Layer cake; and the Endgame.", "echo hello | base64");
  card(s, M, 1.7, 3.6, 2.2);
  text(s, "Encoding", M + 0.3, 1.9, 3, 0.45, { fontFace: HEAD, fontSize: 22, bold: true, color: MC[2] });
  text(s, "A different way to write the same data. No secret. Anyone can undo it.", M + 0.3, 2.45, 3.0, 1.3, { fontSize: 16, color: MUTED });
  card(s, M, 4.15, 3.6, 2.3);
  text(s, "Encryption", M + 0.3, 4.35, 3, 0.45, { fontFace: HEAD, fontSize: 22, bold: true, color: MC[4] });
  text(s, "Scrambled with a secret key. Without the key, you cannot read it.", M + 0.3, 4.9, 3.0, 1.3, { fontSize: 16, color: MUTED });
  term(s, 4.6, 1.6, 8.1, 4.85, ["$ echo hello | base64", "aGVsbG8K", "", "# and back again? which option decodes?", "$ base64 --help   # you know what to do", "", "# that's Mission 8."], { fontSize: 18 });

  section("Part 2 · Recap");
  // ---- when stuck ----
  s = newSlide("When you are stuck",
    "Normalise being stuck. Professionals look things up all day.\n\n" +
    "The page has a hint for every mission: hint 1 up to hint 10, or the Need a hint? box in the sidebar. Hints come in tiers: the first points to a command's --help, later ones give more direction (Easy missions have one hint, the Endgame has four). Each hint costs 5% of that mission's points, charged once, and hint N always shows the price before you buy with hint N --show. Try --help first: it is free.\n\n" +
    "An error message is information. 'Permission denied' means you found something protected. 'No such file' usually means a typo or the wrong folder: run pwd and ls.", "hint 1");
  const tips = [[fa.FaLightbulb, "hint 1", "hint N shows the price; hint N --show buys it. 5% of the mission each.", AMBER, MONO], [fa.FaCircleQuestion, "--help", "Any command explains itself. Read the option list.", MC[2], MONO], [fa.FaKeyboard, "Tab", "Finishes file names for you", MC[1], MONO], [fa.FaArrowUp, "Up arrow", "Brings back your last command", MC[3], MONO], [fa.FaHand, "Ctrl+C", "Stops whatever is running", MC[4], MONO], [fa.FaTriangleExclamation, "Read the error", "Permission denied is a clue, not a failure", GREEN, HEAD]];
  for (let i = 0; i < tips.length; i++) {
    const [Icon, head, body, color, face] = tips[i];
    const x = M + (i % 3) * 4.11, y = 1.7 + Math.floor(i / 3) * 2.45;
    card(s, x, y, 3.9, 2.2);
    await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.7, color);
    text(s, head, x + 1.2, y + 0.3, 2.6, 0.7, { fontSize: 20, bold: true, valign: "middle", fontFace: face });
    text(s, body, x + 0.3, y + 1.2, 3.3, 0.85, { fontSize: 16, color: MUTED });
  }

  // ---- toolbox recap ----
  s = newSlide("Your toolbox",
    "A one-slide recap before the competition, grouped by the four big ideas. Do not re-teach: point and name.\n\n" +
    "Mentors can flip back to this slide at any time during Part 3.");
  const groups = [
    [0, [["pwd  cd  cd ..", "where am I? move", 1], ["ls  ls -a", "look in folders", "1·3"], ["cat", "look in files", 2], ["ls -l  chmod", "permissions", 7]]],
    [1, [["--help", "learn any command", 2], ["Tab", "finish names", 4]]],
    [2, [["find", "search by name", 4], ["grep", "search inside", 5], ["head  wc  |", "peek, count, chain", 5], ["sort  uniq  cut", "sort, count, slice", 6]]],
    [3, [["base64 -d", "decode", 8], ["| base64 -d", "peel more layers", 9]]],
  ];
  let gy = 1.6;
  groups.forEach(([ci, tools]) => {
    const c = CONCEPTS[ci];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: gy, w: 2.55, h: 1.05, fill: { color: c.color }, rectRadius: 0.1 });
    s.addText([{ text: String(ci + 1) + "  ", options: { fontSize: 20 } }, { text: c.title, options: { fontSize: 14 } }], { x: M + 0.15, y: gy, w: 2.35, h: 1.05, fontFace: HEAD, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    tools.forEach(([cmd, what, n], j) => {
      const x = M + 2.7 + j * 2.38;
      card(s, x, gy, 2.2, 1.05);
      mono(s, cmd, x + 0.15, gy + 0.08, 1.75, 0.45, { fontSize: 15, valign: "middle" });
      text(s, what, x + 0.15, gy + 0.55, 2.0, 0.4, { fontSize: 13, color: MUTED });
    });
    gy += 1.2;
  });

  // ===========================================================================
  // PART 3: COMPETE
  // ===========================================================================
  section("Part 3 · Rules and warm-up");
  divider(3, "The competition", "A warm-up, ten missions, 2,700 points, one clock. Missions 1 and 2 we solve together. Then teams race.", MC[3], "./capture --all   # 10 flags, 2,700 points",
    "Section break. If students played around while learning, have everyone reload now for a fresh computer, zero points and a clean clock. This is the ONE time a reload is welcome.\n\nPut the CTF on one half of the projector and these slides on the other, or switch between them.\n\nEach mission has two slides: the brief (show it, read it, ask the three questions) and the walkthrough (reveal it after the class has tried).");

  // ---- scoring ----
  s = newSlide("How scoring works",
    "Make the rules of the competition crystal clear before the clock matters.\n\n" +
    "Points come from difficulty, on CyberQuest's scale: Easy 100, Medium 200, Hard 400, Very Hard 800. Today's ten missions are worth 2,700 in total, plus 50 bonus points for the optional warm-up. Mission 10, the Endgame, is the one Very Hard.\n\n" +
    "The clock counts UP. It waits during the warm-up, starts at the first keystroke of Mission 1, and stops when you capture the last flag. Nobody gets cut off; the clock just records how long you took.\n\n" +
    "Ranking: most points wins; on a tie, the faster time wins. Hints cost 5% of the mission's points each (an Easy hint is 5 points, an Endgame hint 40), charged once. Wrong flags cost nothing.\n\n" +
    "A wrong flag costs nothing. Encourage trying.");
  const lv = [["Easy", "Missions 1, 2, 3"], ["Medium", "Missions 4 to 7"], ["Hard", "Missions 8, 9"], ["Very Hard", "Mission 10: Endgame"]];
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
  s = newSlide("The capture routine, every single time",
    "This five-step routine is the same for every mission. Drill it now so that the only new thing in each round is the puzzle itself.\n\n" +
    "Say it together as a class: Read. Go. Hunt. Copy. Submit.\n\n" +
    "Step 4 trips people up: select the flag in the terminal with the mouse and copy it, including CYBA and both curly braces. On a Chromebook, Ctrl+Shift+V pastes into the terminal.");
  const routine = [["Read", "the sidebar, or cat README.txt.", fa.FaBookOpen, MC[1]], ["Go", "into the mission folder: Copy, then paste.", fa.FaFolderOpen, MC[2]], ["Hunt", "with the tool that fits the clue.", fa.FaMagnifyingGlass, MC[3]], ["Copy", "the whole flag, CYBA{ to }.", fa.FaCopy, MC[4]], ["Submit", "type submit, paste, Enter. Points!", fa.FaFlag, GREEN]];
  for (let i = 0; i < routine.length; i++) {
    const [head, body, Icon, color] = routine[i];
    const x = M + i * 2.48, w = 2.2;
    card(s, x, 1.75, w, 3.5);
    await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, align: "center" });
    text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{moves-4c8c640b}   # Correct! +100 points"], { fontSize: 18 });

  // ---- the warm-up ----
  s = newSlide("Mission 0: the warm-up",
    "Do this together, before the clock matters. It practises the capture routine with zero pressure.\n\n" +
    "orientation.txt in the home folder explains the game: how to read a mission's instructions (cd into the folder, cat README.txt), what a flag looks like, how to submit it, what the replies mean, and where hints live. Its last line is the warm-up flag.\n\n" +
    "It is optional and untimed: worth 50 bonus points, and the sidebar has a Skip warm-up button. The clock only starts once a team moves on to Mission 1.\n\n" +
    "Copying the flag is the real lesson: highlight it with the mouse, paste with Ctrl+V or a right-click, and include CYBA{ and the }.", "cat orientation.txt");
  numbered(s, [
    "Type  cat orientation.txt  and read it.",
    "The warm-up flag is on its last line.",
    "Highlight it, then  submit  and paste.",
    "+50 bonus. Or press Skip warm-up.",
  ], M, 1.8, 5.6, 1.0, MC[0], 18);
  card(s, M, 5.95, 5.6, 0.6, "E2F5EC");
  text(s, "Untimed: the clock starts with Mission 1.", M + 0.3, 5.95, 5.2, 0.6, { valign: "middle", fontSize: 16, bold: true, color: "0F6A45" });
  term(s, 6.7, 1.6, 6.03, 4.95, ["$ cat orientation.txt", "CTF Orientation", "1. Read a mission's instructions", "    cd ~/mission1   then   cat README.txt", "3. Submit the flag", "    submit CYBA{word-1a2b3c4d}", "...", "Warm-up flag:", { hi: "  CYBA{warmup-...}" }, "$ submit CYBA{warmup-...}", "Correct! +50 points"], { fontSize: 14, title: "player@quest" });

  // ---- how rounds work ----
  s = newSlide("How the competition runs",
    "Two phases so nobody is left behind.\n\n" +
    "Missions 1 and 2 are guided ('We do'): the class tells the mentor what to type and everyone captures together. The clock is running, but everyone moves at the same pace.\n\n" +
    "Missions 3 to 10 are a race ('You do'): teams solve on their own. Show the brief slide, ask the questions, then let them go. Reveal each walkthrough once most teams have the flag, or when the room is stuck.\n\n" +
    "Mentors walk the room during the race: point at hints, ask questions, don't type for students.");
  const phases = [["Missions 1–2", "We do", "Guided. The class calls out each command; the mentor types; everyone captures together.", "200 pts", BLUE], ["Missions 3–10", "You do", "The race. Teams solve on their own clock. The walkthrough comes after most teams have it.", "2,500 pts", GREEN]];
  phases.forEach(([which, mode, body, pts, color], i) => {
    const x = M + i * 6.17;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.7, w: 5.96, h: 3.2, fill: { color }, rectRadius: 0.14 });
    s.addText(which, { x: x + 0.4, y: 1.9, w: 4, h: 0.5, fontFace: BODY, fontSize: 18, bold: true, color: "E8EEFF", margin: 0, isTextBox: true });
    s.addText(mode, { x: x + 0.4, y: 2.4, w: 4, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: WHITE, margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.4, y: 3.35, w: 5.1, h: 1.2, fontFace: BODY, fontSize: 16, color: WHITE, margin: 0, valign: "top", isTextBox: true });
    s.addText(pts, { x: x + 4.0, y: 1.9, w: 1.6, h: 0.5, fontFace: MONO, fontSize: 18, bold: true, color: WHITE, align: "right", margin: 0, isTextBox: true });
  });
  const steps5 = [["Read", "the brief out loud"], ["Predict", "which tool, what output"], ["Type", "one command at a time"], ["Capture", "everyone submits"], ["Explain", "in plain words"]];
  steps5.forEach(([a, b], i) => {
    const x = M + i * 2.48;
    card(s, x, 5.2, 2.28, 1.25);
    text(s, a, x + 0.2, 5.3, 2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true, color: MC[i % 6] });
    text(s, b, x + 0.2, 5.78, 2, 0.6, { fontSize: 14, color: MUTED });
  });

  // ---- the trail map ----
  s = newSlide("The trail: ten missions, 2,700 points",
    "The map of the whole competition. Leave it up for a moment and let students read the names.\n\n" +
    "Notice the order: the commands appear in the same order we learned them in Part 2.\n\n" +
    "Suggested pacing: the warm-up together in 3 minutes, missions 1 and 2 together in 12, then the race for missions 3 to 10. Most teams reach Mission 8 or 9 in 35 minutes; the Endgame is for the fastest. Stop the race on time: points and times are already recorded.");
  MS.forEach((c, i) => {
    const x = M + (i % 5) * 2.45, y = 1.6 + Math.floor(i / 5) * 2.45, color = MC[i];
    card(s, x, y, 2.3, 2.3);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.3, h: 0.1, fill: { color } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fill: { color } });
    s.addText(String(i + 1), { x: x + 0.18, y: y + 0.28, w: 0.55, h: 0.55, fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.mode, x + 0.85, y + 0.28, 1.3, 0.55, { fontSize: 12, bold: true, color: MODE[c.mode].color, align: "right", valign: "middle" });
    text(s, c.name, x + 0.18, y + 0.9, 2.0, 0.6, { fontSize: 15, bold: true, valign: "middle" });
    levelChip(s, c.level, x + 0.18, y + 1.52, 1.95, 10.5);
    mono(s, c.skill, x + 0.18, y + 1.95, 2.0, 0.3, { fontSize: 10, color: MUTED, bold: false });
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
    s.addText(c.brief, { x: M + 0.4, y: 2.8, w: 6.25, h: 2.25, fontFace: BODY, fontSize: 22, color: WHITE, margin: 0, valign: "top", isTextBox: true });
    s.addText(c.where, { x: M + 0.4, y: 5.1, w: 6.3, h: 0.35, fontFace: MONO, fontSize: 13, color: T_OUT, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fill: { color: AMBER }, rectRadius: 0.08 });
    s.addText([{ text: "Tools: ", options: { fontFace: BODY } }, { text: c.skill, options: { fontFace: MONO, bold: true } }], { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fontSize: 13.5, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fill: { color: "2B3B5C" }, rectRadius: 0.08 });
    s.addText("+" + L.pts + " points", { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fontFace: MONO, fontSize: 16, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, 7.95, 2.1, 4.78, 3.05);
    text(s, "Before anyone types", 8.25, 2.25, 4.2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true });
    bullets(s, c.ask, 8.25, 2.8, 4.25, 2.3, { fontSize: 15.5, paraSpaceAfter: 7 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.95, y: 5.35, w: 4.78, h: 1.15, fill: { color: mode.color }, rectRadius: 0.1 });
    s.addText(c.mode, { x: 8.2, y: 5.35, w: 1.45, h: 1.15, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText(mode.what, { x: 9.65, y: 5.35, w: 2.05, h: 1.15, fontFace: BODY, fontSize: 13, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText([{ text: String(c.mins), options: { fontSize: 26, bold: true, breakLine: true } }, { text: "min", options: { fontSize: 12 } }], { x: 11.75, y: 5.35, w: 0.85, h: 1.15, fontFace: HEAD, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });

    s = newSlide(null, "WALKTHROUGH " + n + " OF " + N + ": " + c.name + "\n\n" +
      (c.mode === "You do" ? "Race mission: reveal this slide only after most teams have the flag, or when the room is stuck.\n\n" : "Guided mission: solve it live with the class calling out commands, then use this slide to recap.\n\n") +
      "The slide never shows a real flag: every computer has its own, so students still have to run the commands themselves.\n\n" +
      "Ask one student to explain the three steps in their own words. Offer the stretch question to anyone who finished early.\n\n" + c.notes);
    chip(s, "Walkthrough " + n + " of " + N, M, 0.48, 2.3, color, WHITE, 14);
    levelChip(s, c.level, M + 2.45, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n + 1);
    s.addText("Solving " + c.name, { x: M, y: 0.98, w: W - 2 * M, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    term(s, M, 1.85, 7.35, 4.65, c.term, { fontSize: c.fs || (c.term.length > 8 ? 14 : 16), title: "player@quest" });
    text(s, "What just happened", 8.25, 1.85, 4.4, 0.4, { fontFace: HEAD, fontSize: 18, bold: true });
    numbered(s, c.happened, 8.25, 2.4, 4.48, 0.86, color, 14);
    card(s, 8.25, 5.0, 4.48, 0.82, "FFF4DC");
    text(s, [{ text: "Real world: ", options: { bold: true } }, { text: c.real }], 8.42, 5.0, 4.16, 0.82, { fontSize: 13, valign: "middle" });
    card(s, 8.25, 5.92, 4.48, 0.62);
    text(s, [{ text: "Stretch: ", options: { bold: true, color } }, { text: c.stretch }], 8.42, 5.92, 4.16, 0.62, { fontSize: 12, valign: "middle" });
    text(s, "Names, line numbers and flags change on every computer.", M, 6.58, 7.35, 0.3, { fontSize: 11, color: MUTED });
  }

  section("Part 3 · After the race");
  // ---- side quests ----
  s = newSlide("Side quests: for teams that finish early",
    "No flags and no points: the answer is a number or a name, and teams compare out loud. Perfect for teams that finish the race early.\n\n" +
    "Answers:\n" +
    "Count the haystack: find archive -type f | wc -l  gives 81 files; -type d gives 26 folders. Same on every computer.\n" +
    "Who failed most?: grep LOGIN_FAIL access.log | cut -d' ' -f2 | sort | uniq -c | sort -n | tail -3. Different on every computer; ties happen.\n" +
    "Head count: cut -d' ' -f2 access.log | sort -u | wc -l gives 11 (ten users plus the intruder).\n" +
    "Swap secrets: echo meet at the gym | base64, write it on paper, swap with a neighbour, decode with echo ... | base64 -d.");
  const side = [
    ["Count the haystack", "~/mission4", "How many files did find search through? How many folders?", "find archive -type f | wc -l"],
    ["Who failed most?", "~/mission5", "Which user has the most LOGIN_FAIL lines? Build it one pipe at a time.", "grep · cut · sort · uniq -c"],
    ["Head count", "~/mission5", "How many different user names appear in access.log?", "cut -d' ' -f2 · sort -u · wc -l"],
    ["Swap secrets", "anywhere", "Encode a message, write it on paper, swap with the next team, decode theirs.", "echo ... | base64"],
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
    "Walk the scorecard. Points per mission and the total. 'Took' is how long each flag took since the previous one: the biggest Took shows where you got stuck. 'Time' is the clock reading when you submitted.\n\n" +
    "Ask: 'Which mission had your biggest Took? Why?' That is the skill to practise next.\n\n" +
    "Then the replay challenge: Replay quest builds a brand-new computer with new flags. Can you beat your time? Write the best times on the board.\n\n" +
    "The times in this screenshot are an example.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.25, y: 1.55, w: 3.1, h: 4.52, fill: { color: WHITE }, rectRadius: 0.06, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  s.addImage({ path: path.join(__dirname, "img", "sidebar-finish.png"), x: M + 0.3, y: 1.6, w: 3.0, h: 3.0 * 752 / 512 });
  const sc = [["Points", "2,700 for all ten flags, 2,750 with the warm-up.", AMBER], ["Took", "Time since your previous flag. Your biggest Took is where you got stuck.", BLUE], ["Time", "The clock when you submitted each flag.", MC[3]], ["Replay quest", "A brand-new computer, new flags, a fresh clock. Beat your time.", GREEN]];
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
  divider(4, "Debrief", "How the game stays fair, what you just did, who gets paid to do it, and how to keep going.", MC[4], "echo \"$(whoami) leveled up\"",
    "Section break. Applaud the fastest teams, and also the team that got unstuck the most times.\n\nFun closer: have everyone type the command on this slide. $(whoami) runs whoami and drops its answer into the sentence.");

  // ---- can you cheat ----
  s = newSlide("Can you cheat? Try it.",
    "Frame it as a heist: 'the answers are on this computer. Let's steal them.' Then let the computer say no. Run these live.\n\n" +
    "ls -l: every file has an owner and three sets of permissions: owner, group, everyone else. r is read, w is write, x is run. The quest's files belong to root: we may read, not write.\n\n" +
    "cat shows 64 letters and digits: not a flag, a fingerprint (a SHA-256 hash) of the flag.\n\n" +
    "Writing fails with Permission denied, and a forged flag is rejected. Leads straight into the next slide.", "ls -l /etc/quest");
  const perm = [["-", "file type", "- is a file\nd is a folder", MUTED, 0.9], ["rw-", "owner", "may read\nand write", MC[2], 1.9], ["r--", "group", "may only\nread", MC[3], 1.9], ["r--", "everyone else", "may only\nread", MC[4], 1.9]];
  let pxx = M;
  perm.forEach(([bits, who, what, color, w]) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: pxx, y: 1.75, w, h: 0.95, fill: { color }, rectRadius: 0.08 });
    s.addText(bits, { x: pxx, y: 1.75, w, h: 0.95, fontFace: MONO, fontSize: 30, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, who, pxx, 2.82, w, 0.35, { fontSize: 15, bold: true, color });
    text(s, what, pxx, 3.18, w, 0.7, { fontSize: 13, color: MUTED });
    pxx += w + 0.12;
  });
  text(s, "r = read     w = write     x = run", M, 4.1, 6.5, 0.4, { fontFace: MONO, fontSize: 15, color: MUTED });
  card(s, M, 4.7, 6.9, 1.75, "FFF4DC");
  text(s, [{ text: "Why it fails: ", options: { bold: true } }, { text: "the answer files belong to root, so you can read but not change them. And they hold fingerprints, not flags." }], M + 0.3, 4.7, 6.3, 1.75, { valign: "middle", fontSize: 17 });
  term(s, 7.75, 1.6, 4.98, 4.85, ["$ ls -l /etc/quest", "-rw-r--r-- 1 root root 65 ... 1", "# ...and 2 to 6", "$ cat /etc/quest/1", "<64 letters and digits>", "$ echo hacked > /etc/quest/1", "-sh: can't create /etc/quest/1:", "  Permission denied", "$ submit CYBA{fake-12345678}", { hi: "Incorrect flag. Keep hunting!" }], { fontSize: 13 });

  // ---- how submit works ----
  s = newSlide("How does submit know you're right?",
    "At start-up the CTF makes eleven random flags (ten missions and the warm-up), saves only their SHA-256 fingerprints in /etc/quest, and throws the flags away. submit fingerprints your guess and compares. A match means correct, and the points land.\n\n" +
    "A hash function turns any input into a fixed 64-character fingerprint. Same input, same fingerprint; change one letter and it changes completely; and it only works one way.\n\n" +
    "Good websites store passwords the same way. If attackers steal the database they get fingerprints, not passwords. (Real systems also add a random 'salt' and use deliberately slow hashes.)", "echo hello | sha256sum");
  const flowRow = (y, guess, hash, ok) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 3.4, h: 1.0, fill: { color: TINT }, rectRadius: 0.1 });
    text(s, "your guess", M + 0.2, y + 0.1, 3, 0.3, { fontSize: 12, color: MUTED });
    mono(s, guess, M + 0.2, y + 0.42, 3.1, 0.45, { fontSize: 14, color: ok ? GREEN : RED });
    s.addText(">", { x: M + 3.4, y, w: 0.4, h: 1.0, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 3.8, y, w: 1.5, h: 1.0, fill: { color: TERM }, rectRadius: 0.1 });
    s.addText("SHA-256", { x: M + 3.8, y, w: 1.5, h: 1.0, fontFace: MONO, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(">", { x: M + 5.3, y, w: 0.4, h: 1.0, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 5.7, y, w: 2.9, h: 1.0, fill: { color: TINT }, rectRadius: 0.1 });
    text(s, "fingerprint", M + 5.9, y + 0.1, 2.5, 0.3, { fontSize: 12, color: MUTED });
    mono(s, hash, M + 5.9, y + 0.42, 2.6, 0.45, { fontSize: 15 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 8.8, y, w: 3.33, h: 1.0, fill: { color: ok ? "E2F5EC" : "FBE9E9" }, rectRadius: 0.1, line: { color: ok ? GREEN : RED, width: 1.5 } });
    text(s, [{ text: ok ? "Matches the saved one" : "No match", options: { bold: true, breakLine: true } }, { text: ok ? "Correct! +100 points." : "Incorrect flag." }], M + 9.05, y, 2.95, 1.0, { fontSize: 15, valign: "middle", color: ok ? "0F5A3B" : RED });
  };
  flowRow(1.75, "CYBA{moves-4c8c640b}", "b49ce699...6b22", true);
  flowRow(3.0, "CYBA{fake-12345678}", "cb1cffe1...c5d1", false);
  const fp = [[fa.FaFingerprint, "Same input, same fingerprint", MC[2]], [fa.FaShuffle, "One letter changes everything", MC[3]], [fa.FaLock, "One way only: no way back", MC[4]]];
  for (let i = 0; i < fp.length; i++) {
    const [Icon, head, color] = fp[i];
    const x = M + i * 4.11;
    card(s, x, 4.4, 3.9, 1.0);
    await iconCircle(s, Icon, x + 0.2, 4.55, 0.7, color);
    text(s, head, x + 1.05, 4.4, 2.75, 1.0, { fontSize: 15.5, bold: true, valign: "middle" });
  }
  card(s, M, 5.6, W - 2 * M, 0.85, "FFF4DC");
  text(s, [{ text: "Same trick, real world: ", options: { bold: true } }, { text: "good websites store a fingerprint of your password, not the password. That is why 'forgot password' resets it instead of emailing it." }], M + 0.3, 5.6, W - 2 * M - 0.6, 0.85, { fontSize: 15, valign: "middle" });

  // ---- skill passport ----
  s = newSlide("Your skill passport",
    "A visual receipt for the session, in mission order. Each stamp is a tool the class used today.\n\n" +
    "Ask students to count the stamps they earned. Anyone with ten or more did a full beginner Linux lab in one session.");
  const stamps = [["pwd", 1], ["ls", 1], ["cd  cd ..", 1], ["cat", 2], ["--help", 2], ["ls -a", 3], ["Tab", 3], ["find", 4], ["grep", 5], ["head  wc -l", 5], ["|", 6], ["sort  uniq", 6], ["ls -l", 7], ["chmod +x", 7], ["base64 -d", 8], ["| base64 -d", 9], ["cut", 10], ["sha256sum", 0]];
  stamps.forEach(([cmd, n], i) => {
    const x = M + (i % 6) * 2.04, y = 1.65 + Math.floor(i / 6) * 1.6, color = n ? MC[n - 1] : MUTED;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.88, h: 1.42, fill: { color: WHITE }, rectRadius: 0.12, line: { color, width: 2.5, dashType: "dash" } });
    mono(s, cmd, x, y + 0.2, 1.88, 0.6, { fontSize: cmd.length > 9 ? 14 : 20, color, align: "center", valign: "middle" });
    text(s, n ? "Mission " + n : "Debrief", x, y + 0.88, 1.88, 0.35, { fontSize: 12, color: MUTED, align: "center" });
  });
  text(s, "Eighteen tools, used on a real Linux system, in one session.", M, 6.6, W - 2 * M, 0.35, { fontSize: 15, bold: true });

  // ---- the job ----
  s = newSlide("What you just did is the job",
    "Connect the missions to real work. Ask the questions on the right and let students answer before you do.\n\n" +
    "Mentors: share one real story (unclassified and non-sensitive) of using these commands at work.");
  const jobs = [[fa.FaFolderOpen, "cd, ls and ls -a", "Finding your way around an unfamiliar server, hidden files included", MC[0]], [fa.FaMagnifyingGlass, "find and grep", "Searching servers and logs for the one line that shows an intruder", MC[3]], [fa.FaBookOpen, "--help", "Learning a new tool in minutes, without anyone teaching you", MC[1]], [fa.FaFingerprint, "base64 -d and sha256sum", "Decoding hidden text and checking fingerprints", MC[4]]];
  for (let i = 0; i < jobs.length; i++) {
    const [Icon, cmd, job, color] = jobs[i];
    const y = 1.7 + i * 1.2;
    await iconCircle(s, Icon, M, y, 0.8, color);
    mono(s, cmd, M + 1.05, y, 6, 0.4, { fontSize: 18 });
    text(s, job, M + 1.05, y + 0.42, 6.2, 0.45, { fontSize: 16, color: MUTED });
  }
  card(s, 8.1, 1.7, 4.63, 4.75);
  text(s, "Ask the room", 8.45, 1.95, 4, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  bullets(s, ["Which mission had your biggest Took time? Why?", "Which command will you remember next week?", "If you defended the server in mission 5, how would you catch the intruder sooner?", "Where have you seen something 'hidden' that wasn't really secret?"], 8.45, 2.6, 4.0, 3.6, { fontSize: 16, paraSpaceAfter: 11 });

  // ---- keep going ----
  s = newSlide("Keep climbing",
    "Close with what students can do tomorrow, for free.\n\n" +
    "CyberQuest Academy is where the next challenges live: fill in the link. The Linux CTF works at home on any computer, and every replay is a fresh set of flags and a fresh clock.\n\n" +
    "Thank the class and the teacher.");
  const next = [["Next: CyberQuest", "[CyberQuest Academy link]", "More CTFs, live scoreboards and harder missions are waiting for you there.", MC[2]], ["Replay the Linux CTF", "[your CTF link]", "Works at home. Every replay hides six new flags. Beat your time.", MC[3]], ["Teach someone", "cd, ls -a, grep, --help", "Show a friend or family member one trick from today. Teaching is the fastest way to remember.", MC[4]]];
  next.forEach(([head, where, body, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.3);
    text(s, head, x + 0.3, 1.95, 3.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color });
    mono(s, where, x + 0.3, 2.55, 3.4, 0.5, { fontSize: 13, color: INK });
    text(s, body, x + 0.3, 3.15, 3.3, 1.7, { fontSize: 16, color: MUTED });
  });
  term(s, M, 5.3, W - 2 * M, 1.15, ["$ echo \"Thanks for playing. Keep typing.\""], { fontSize: 18 });

  // ===========================================================================
  // MENTOR APPENDIX
  // ===========================================================================
  section("Mentor appendix");
  s = newSlide("Mentor appendix: set-up before class",
    "THIS SLIDE IS FOR MENTORS. Skip it when presenting to students, or hide it.\n\n" +
    "The page is the ctf-test project on GitLab. Its .gitlab-ci.yml has a 'pages' job that publishes the public/ folder whenever the default branch changes. Set Settings > General > Visibility > Pages to Everyone, or students get a GitLab sign-in page.\n\n" +
    "Two things can get in the way at a school:\n" +
    "1. The web filter blocks *.gitlab.io. Ask IT to allow your Pages address.\n" +
    "2. WebAssembly is switched off by policy. The page handles this itself by starting lite mode; the status then says 'Ready (lite mode)'. Add ?lite to the address to try lite mode yourself.\n\n" +
    "Test on an actual student device, on the school network.");
  numbered(s, [
    [{ text: "Push the project to GitLab. ", options: { bold: true } }, { text: "The pages job publishes it. Set Pages visibility to Everyone." }],
    [{ text: "Write the address ", options: { bold: true } }, { text: "on the 'Open the CTF' slide." }],
    [{ text: "Test on a student Chromebook, on school Wi-Fi. ", options: { bold: true } }, { text: "It must reach 'Ready'." }],
    [{ text: "Blocked page? ", options: { bold: true } }, { text: "Ask IT to allow your *.gitlab.io address." }],
    [{ text: "Play all ten missions yourself once. ", options: { bold: true } }, { text: "Note your time: it makes a fun target." }],
  ], M, 1.75, 7.0, 0.92, BLUE, 16);
  card(s, 8.1, 1.7, 4.63, 4.75, "FFF4DC");
  text(s, "The day before", 8.4, 1.9, 4, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  bullets(s, ["Open the link on a student device and time the boot.", "'Ready' or 'Ready (lite mode)' are both fine.", "Have a Plan B: a projector demo from a device that works.", "Bring the link as a QR code or short link for the board."], 8.4, 2.5, 4.1, 3.8, { fontSize: 16 });

  s = newSlide("Mentor appendix: how the page works",
    "The CyberQuest Linux CTF is our own page, hosted free on GitLab Pages. When it loads, it starts a small but real Linux computer inside the tab.\n\n" +
    "How: a program called v86 pretends to be a PC, using a browser feature called WebAssembly. That pretend PC boots a real Linux kernel, and a toolkit called BusyBox provides the commands.\n\n" +
    "Some school and work browsers switch WebAssembly off. Then the page starts lite mode instead: a simulated shell with the same ten missions and the same commands. Students barely notice the difference.\n\n" +
    "Everything runs on the student's own device. Every page load hides ten new random flags (plus the warm-up), which is why reloading resets your progress.");
  const lq = [[fa.FaTerminal, "A real terminal", "A Linux shell with standard commands, running in your tab.", MC[1]], [fa.FaFlag, "Ten missions", "2,700 points, easiest first. New random flags on every page load.", MC[3]], [fa.FaLaptop, "Nothing to install", "One link. No accounts. Works on Chromebooks, laptops and desktops.", MC[4]]];
  for (let i = 0; i < lq.length; i++) {
    const [Icon, head, body, color] = lq[i];
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.35);
    await iconCircle(s, Icon, x + 0.3, 1.95, 0.95, color);
    text(s, head, x + 0.3, 3.1, 3.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true });
    text(s, body, x + 0.3, 3.65, 3.3, 1.3, { fontSize: 16, color: MUTED });
  }
  text(s, "Under the hood", M, 5.35, 3, 0.35, { fontSize: 14, bold: true, color: MUTED });
  const hood = [["Your browser", "E4EAF3", MUTED], ["v86: a PC in WebAssembly", MC[2], WHITE], ["Linux kernel", MC[3], WHITE], ["BusyBox commands", MC[4], WHITE], ["Your 10 missions", AMBER, INK]];
  let hx = M;
  hood.forEach(([name, fill, ink], i) => { const w = name.length * 0.095 + 0.5; chip(s, name, hx, 5.8, w, fill, ink, 12.5); hx += w + 0.12; if (i < hood.length - 1) { s.addText(">", { x: hx - 0.12, y: 5.8, w: 0.12, h: 0.38, fontFace: MONO, fontSize: 12, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true }); hx += 0.06; } });
  text(s, "No WebAssembly? The page switches to lite mode: a simulated shell with the same missions.", M, 6.4, 11.5, 0.35, { fontSize: 13, color: MUTED });

  s = newSlide("Mentor appendix: open the CTF",
    "MENTOR READING: run this with students right before Part 2 (Command-line essentials), so every device is booted for the Try it pills. Give students two or three minutes. Mentors walk the room.\n\n" +
    "WRITE YOUR GITLAB PAGES ADDRESS IN THE BOX before presenting (click the dashed box and type). A QR code or short link on the board also helps.\n\n" +
    "Boot takes about 10 seconds on a laptop; Chromebooks can take longer. The status in the top right corner says 'Ready in N s' when it is done.\n\n" +
    "Most important rule: do not reload the page. A reload builds a brand-new computer with new flags, and resets the clock and points.");
  numbered(s, [
    [{ text: "Open Chrome ", options: { bold: true } }, { text: "and type the address from the box on the right." }],
    [{ text: "Watch it boot. ", options: { bold: true } }, { text: "The status says 'Ready' when Linux is up." }],
    [{ text: "Click inside the black terminal. ", options: { bold: true } }, { text: "A cursor should blink." }],
    [{ text: "Never reload the page. ", options: { bold: true } }, { text: "Reloading means new flags, zero points and a reset clock." }],
  ], M, 1.85, 6.6, 1.1, BLUE, 18);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.7, y: 1.7, w: 5.03, h: 3.2, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText("CTF address", { x: 7.7, y: 1.9, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 16, color: T_OUT, align: "center", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fill: { color: "162238" }, rectRadius: 0.08, line: { color: AMBER, width: 2, dashType: "dash" } });
  s.addText("your-group.gitlab.io/...", { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fontFace: MONO, fontSize: 20, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Type it exactly. One computer per pair.", { x: 7.7, y: 4.2, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 14, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
  card(s, 7.7, 5.15, 5.03, 1.3, "FFF4DC");
  text(s, [{ text: "Don't type yet! ", options: { bold: true } }, { text: "The clock waits for Mission 1. The warm-up is untimed, so explore freely." }], 8.0, 5.15, 4.5, 1.3, { valign: "middle", fontSize: 15 });

  // ---- the conversation loop ----
  s = newSlide("Mentor appendix: every command is a conversation",
    "The terminal works in a loop, and once students see the loop they stop being nervous of it.\n\n" +
    "Prompt, type, Enter, output, prompt again. Walk the four cards, then show the two terminals underneath.\n\n" +
    "Left: some commands print nothing at all. cd moves you and stays silent; the new prompt shows the new folder. Silence usually means it worked.\n\n" +
    "Right: errors are output too. LS fails because Linux is case-sensitive. ls /nope fails because the folder does not exist. The message tells you what went wrong, so read it out loud.");
  const loop = [["1", "Prompt appears", "The computer says: your turn.", MC[1]], ["2", "You type", "Letters appear after the $. Nothing runs yet.", MC[2]], ["3", "You press Enter", "Now the computer runs the command.", MC[3]], ["4", "Output appears", "Then a new prompt, and back to step 1.", MC[4]]];
  loop.forEach(([n, head, body, color], i) => {
    const x = M + i * 3.07, w = 2.75;
    card(s, x, 1.65, w, 2.35);
    s.addText(n, { x: x + 0.3, y: 1.8, w: 1, h: 0.8, fontFace: HEAD, fontSize: 44, bold: true, color, margin: 0, isTextBox: true });
    text(s, head, x + 0.3, 2.62, w - 0.5, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
    text(s, body, x + 0.3, 3.1, w - 0.5, 0.8, { fontSize: 15, color: MUTED });
    s.addText(i < 3 ? ">" : "↺", { x: x + w, y: 2.45, w: 0.32, h: 0.6, fontFace: i < 3 ? MONO : BODY, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  term(s, M, 4.3, 5.95, 2.2, ["$ cd /etc", "$ pwd", "/etc", "$ cd ~"], { fontSize: 16, title: "no output? that's normal" });
  term(s, M + 6.18, 4.3, 5.95, 2.2, ["$ LS", "-sh: LS: not found", "$ ls /nope", "ls: /nope: No such file or directory"], { fontSize: 16, title: "errors are output too: read them" });

  // ---- first commands ----
  s = newSlide("Mentor appendix: your first three commands",
    "Have everyone click in the terminal and type three commands: whoami, pwd and ls. Show it on the projector at the same time.\n\n" +
    "This is practice: the competition clock does not start until Mission 1, so nothing here counts against anyone.\n\n" +
    "whoami answers 'player'. pwd shows the home folder. ls shows README.txt, orientation.txt and the ten mission folders.\n\n" +
    "Do not move on until every student has a prompt and sees the ten missions. Thumbs up when you do.");
  numbered(s, [
    [{ text: "Click inside the terminal ", options: { bold: true } }, { text: "so your typing goes there." }],
    [{ text: "Type a command, press Enter. ", options: { bold: true } }, { text: "Nothing happens until you press Enter." }],
    [{ text: "Type the three commands ", options: { bold: true } }, { text: "on the right, one at a time." }],
    [{ text: "Leave the missions alone ", options: { bold: true } }, { text: "for now. The competition comes later." }],
  ], M, 1.8, 5.6, 1.05, BLUE, 17);
  card(s, M, 6.0, 5.6, 0.6, "E2F5EC");
  text(s, "Thumbs up when you see mission1 to mission10.", M + 0.3, 6.0, 5.2, 0.6, { valign: "middle", fontSize: 16, bold: true, color: "0F6A45" });
  term(s, 6.7, 1.6, 6.03, 4.95, ["$ whoami", "player", "$ pwd", "/home/player", "$ ls", { hi: "README.txt  mission10  mission4  mission7" }, { hi: "mission1    mission2   mission5  mission8" }, { hi: "orientation.txt  ...  mission9" }], { fontSize: 16, title: "your own Linux computer" });

  s = newSlide("Mentor appendix: answer key",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Flags are random on every page load and the CTF keeps only fingerprints, so there is no list of flags: play each mission yourself before class.\n\n" +
    "Fixed side-quest answers: Count the haystack is 81 files and 26 folders; Head count is 11.");
  const key = [["0", "Warm-up", "cat orientation.txt;  submit the flag on its last line", "Bonus · 50", MUTED]].concat(MS.map((c, i) => [String(i + 1), c.name, c.answer, c.level + " · " + LEVEL[c.level].pts, MC[i]])).concat([
    ["+", "Count the haystack", "find archive -type f | wc -l  (81);  -type d  (26)", "side quest", MUTED],
    ["+", "Who failed most?", "grep LOGIN_FAIL access.log | cut -d' ' -f2 | sort | uniq -c | sort -n", "side quest", MUTED],
    ["+", "Head count", "cut -d' ' -f2 access.log | sort -u | wc -l  (11)", "side quest", MUTED],
    ["+", "Swap secrets", "echo <text> | base64;   echo <code> | base64 -d", "side quest", MUTED],
  ]);
  key.forEach(([n, name, ans, lvl, color], i) => {
    const RH = 0.33, y = 1.45 + i * RH;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: W - 2 * M, h: RH, fill: { color: i % 2 ? WHITE : TINT } });
    s.addShape(pres.shapes.OVAL, { x: M + 0.12, y: y + 0.04, w: 0.25, h: 0.25, fill: { color } });
    s.addText(n, { x: M + 0.12, y: y + 0.04, w: 0.25, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, name, M + 0.5, y, 2.6, RH, { fontSize: 12, bold: true, valign: "middle" });
    mono(s, ans, M + 3.1, y, 7.6, RH, { fontSize: 10, bold: false, valign: "middle" });
    text(s, lvl, M + 10.6, y, 1.5, RH, { fontSize: 11, bold: true, color: MUTED, valign: "middle", align: "right" });
  });

  s = newSlide("Mentor appendix: when things go wrong",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Most problems are outside the page: the school web filter, or the GitLab Pages visibility setting. Test on a student device, on the school network, beforehand.\n\n" +
    "Plan B if most devices can't load it: drive the CTF on the projector from a device that works, and run the whole competition as 'We do', with teams racing to call out the next command on paper.");
  const fixes = [
    ["The page asks for a GitLab sign-in", "Pages visibility is not public. Settings > General > Visibility > Pages: Everyone."],
    ["The page will not load at all", "The web filter is blocking *.gitlab.io. Ask IT to allow your Pages address."],
    ["Status says 'Ready (lite mode)'", "That browser blocks WebAssembly. Lite mode has the same missions: carry on."],
    ["Typing does nothing", "Click inside the black terminal first."],
    ["\"Incorrect flag\"", "Copy the whole flag, CYBA{ to }, with no extra spaces. Flags from another computer never work."],
    ["Page was reloaded by accident", "New computer, new flags, points and clock reset. The second run is fast."],
    ["Screen flooded with text, or stuck", "Ctrl+C stops a command. q quits less. clear wipes the screen."],
    ["The clock didn't start", "It waits during the warm-up. It starts at the first keystroke after the warm-up is captured or skipped."],
  ];
  fixes.forEach(([problem, fix], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.24;
    card(s, x, y, 5.96, 1.1);
    text(s, problem, x + 0.25, y + 0.1, 5.5, 0.35, { fontSize: 14.5, bold: true, color: RED });
    text(s, fix, x + 0.25, y + 0.45, 5.5, 0.6, { fontSize: 12.5, color: INK });
  });

  const out = path.join(__dirname, "CyberQuest-Linux-CTF.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

build().catch((e) => { console.error(e); process.exit(1); });
