// Builds slides/CyberQuest-Web-CTF.pptx. Run:  node slides/build-deck-web.js
// Teaching deck for the CyberQuest Web CTF page. Part 2 teaches the browser tools in the
// order the ten missions need them; Part 3 plays the missions. Fourth of the mentorship set.
// Needs: npm install pptxgenjs react react-dom react-icons sharp
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

// ---- palette (matches the CyberQuest web page) ----
const INK = "12213A", MUTED = "56657E", TINT = "F1F5FB", LINE = "D6DEEA", WHITE = "FFFFFF";
const BLUE = "2459D8", GREEN = "17875A", AMBER = "F5A623", RED = "B93434";
const TERM = "0E1726", T_OUT = "B8C4D9", T_CMD = "FFFFFF", T_PROMPT = "46D39A", T_NOTE = "7F8FAD";
// One colour per mission, matching the progress track on the page.
const MC = ["17875A", "2A9FD6", "2459D8", "7448D4", "D1416B", "E8820C", "C9A227", "0F9488", "5B6EE1", "B4233F"];
const TIER = { warm: MC[1], search: MC[2], logs: MC[3], secrets: MC[4], bonus: AMBER };
// CyberQuest difficulty scale and points.
const LEVEL = { "Easy": { pts: 100, fill: "E2F5EC", ink: "12704B" }, "Medium": { pts: 200, fill: "FFF4DE", ink: "9A5B00" }, "Hard": { pts: 400, fill: "FDE8EC", ink: "B4233F" }, "Very Hard": { pts: 800, fill: "2A1430", ink: "FF8FB1" } };
const HEAD = "Arial", BODY = "Calibri", MONO = "Courier New";
const W = 13.333, H = 7.5, M = 0.6;
const FOOT = "Lockheed Martin CyberQuest® Academy   ·   Web CTF";
// Read a PNG asset from disk into a data URI (cached) so the .pptx embeds it.
function fileImg(rel) { return "image/png;base64," + fs.readFileSync(path.join(__dirname, rel)).toString("base64"); }
const SHIELD = fileImg("assets/cyberquest-shield.png");
const DECK = "Web CTF";
const PAGES = [];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CyberQuest Web CTF: break into the app, then compete";
pres.author = "CyberQuest Academy";

pres.defineSlideMaster({ title: "LIGHT", background: { data: fileImg("assets/bg-light.png") } });
pres.defineSlideMaster({ title: "SECTION", background: { data: fileImg("assets/bg-section.png") } });
pres.defineSlideMaster({ title: "TITLE", background: { data: fileImg("assets/bg-title.png") } });

let slideNo = 0;
let SECTION = null;
function section(title) { pres.addSection({ title }); SECTION = title; }
// A content slide. tryCmd puts a green "Try it" pill top right: a safe action students
// run in their own browser. None of them solves a mission.
function newSlide(titleText, notes, tryCmd) {
  const s = pres.addSlide({ masterName: "LIGHT", ...(SECTION ? { sectionTitle: SECTION } : {}) });
  slideNo += 1;
  if (titleText) {
    s.addText(titleText, { x: M, y: 0.42, w: tryCmd ? W - 2 * M - 4.3 : W - 2 * M, h: 0.85, fontFace: HEAD, fontSize: 32, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true, fit: "shrink" });
  }
  if (tryCmd) tryIt(s, tryCmd);
  PAGES.push({ s, dark: false });
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

// A dark panel: terminal / DevTools / HTTP exchange. The deck's one recurring motif.
// lines: "$ cmd" = prompt + command, "# text" = side note, {hi: "text"} = highlighted, else output.
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
// A tool "chip": the action in mono on a dark pill, with what it does beside it.
function cmdRow(s, cmd, what, x, y, w, chipW = 1.9) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: chipW, h: 0.5, fill: { color: TERM }, rectRadius: 0.08 });
  s.addText(cmd, { x, y, w: chipW, h: 0.5, fontFace: MONO, fontSize: 14, bold: true, color: T_CMD, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
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
function tint(hex, r) {
  const n = parseInt(hex, 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
  const m = (v) => Math.round(v + (255 - v) * r).toString(16).padStart(2, "0");
  return (m(R) + m(G) + m(B)).toUpperCase();
}
async function iconTintCircle(s, Icon, x, y, d, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: tint(color, 0.80) } });
  s.addImage({ data: await iconPng(Icon, color), x: x + d * 0.27, y: y + d * 0.27, w: d * 0.46, h: d * 0.46 });
}

function darkSlide(notes) {
  const s = pres.addSlide(SECTION ? { sectionTitle: SECTION } : undefined);
  slideNo += 1;
  s.background = { color: TERM };
  s.addText(FOOT, { x: M, y: 7.0, w: 6, h: 0.3, fontFace: BODY, fontSize: 10, color: T_NOTE, margin: 0, isTextBox: true });
  PAGES.push({ s, dark: true });
  s.addNotes(notes);
  return s;
}

// Section divider: big part number, title, and a one-line "boot" message.
function divider(part, title, sub, color, cmd, notes) {
  const s = pres.addSlide({ masterName: "SECTION" });
  slideNo += 1;
  s.addText(String(part), { x: M, y: 0.7, w: 2.3, h: 3.4, fontFace: HEAD, fontSize: 230, bold: true, color, margin: 0, valign: "middle", isTextBox: true });
  s.addText(title, { x: 3.0, y: 0.7, w: 7.6, h: 3.4, fontFace: HEAD, fontSize: 56, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true, fit: "shrink" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.55, w: 7.1, h: 0.8, fill: { color: "0E1726" }, rectRadius: 0.1, shadow: { type: "outer", color: "6E86AE", opacity: 0.35, blur: 8, offset: 2, angle: 90 } });
  s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: cmd, options: { color: WHITE, bold: true } }], { x: M + 0.3, y: 5.55, w: 6.6, h: 0.8, fontFace: MONO, fontSize: 18, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
  PAGES.push({ s, dark: false });
  s.addNotes(notes);
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
function levelChip(s, level, x, y, w = 1.9, size = 13) {
  const L = LEVEL[level];
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.38, fill: { color: L.fill }, rectRadius: 0.19 });
  s.addText(level.toUpperCase() + "  ·  " + L.pts, { x, y, w, h: 0.38, fontFace: BODY, fontSize: size, bold: true, color: L.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function forMission(s, nums) {
  const label = (nums.length > 1 ? "For missions " : "For mission ") + nums.join(" & ");
  const w = 0.25 + label.length * 0.095;
  const x = M, y = 0.12;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.3, fill: { color: MC[nums[0] - 1] }, rectRadius: 0.15 });
  s.addText(label, { x, y, w, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
}

const MODE = {
  "We do": { color: BLUE, what: "Class calls out each move. Mentor drives." },
  "You do": { color: GREEN, what: "Students try on their own. Reveal after." },
};

// ---- the ten web missions, in the order the page plays them ----
// IDs, tokens and flags change on every page load, so the slides never show a real flag.
const MS = [
  {
    name: "View the source", level: "Easy", skill: "View Source · curl", mode: "We do", mins: 5,
    where: "/mission1/   ·   View Source  (or curl)",
    brief: "The page looks almost empty. But the answer is written right into it, inside a comment the browser never shows on screen. Read the page's real source - in the browser, or straight from the terminal.",
    ask: ["What's the difference between what a page shows and what it actually contains?", "Two ways to see a page's raw HTML - what are they?", "Where in HTML can text hide without appearing on screen?"],
    term: ["# right-click → View Source  (Ctrl+U)", "<body>", "  <h1>Nothing to see here</h1>", "  <!-- TODO: remove before launch", "       Flag: CYBA{src-...} -->", "</body>", { hi: "Flag: CYBA{src-...}" }], fs: 13,
    twin: ["$ curl -s URL/ > page.html", "$ grep -o 'CYBA{[^}]*}' page.html"],
    happened: ["The page renders only what's between the visible tags.", "View Source (or curl) showed the raw HTML the server sent.", "The flag sat in an HTML comment: invisible on screen, plain in the source."],
    real: "curl + grep is a real recon workflow too: pull a page to a file, search it for secrets, no browser needed.",
    stretch: "Skip the file: curl -s URL | grep -o 'CYBA{[^}]*}'. Why didn't you need the browser at all?",
    answer: "View Source (Ctrl+U) and read the comment - or: curl -s URL | grep CYBA",
    notes: "The lesson of the day starts here: the browser shows a rendering, not the whole truth. Everything the page is built from was sent to your computer - and View Source and curl both reveal it.\n\nThis also bridges from the Linux CTF: the terminal path is the same curl, grep and pipes, now aimed at a web page. Show both; let students use whichever they prefer. The flag is random each load.",
  },
  {
    name: "Hidden in plain sight", level: "Easy", skill: "F12 · Inspect", mode: "We do", mins: 5,
    where: "/mission2/   ·   F12 → Elements",
    brief: "There is a field you can't see and an element the page hides with CSS. Hidden is not gone. Inspect the live page and read the value.",
    ask: ["If CSS hides an element, is the element still on the page?", "Which DevTools panel shows the live page structure?", "How could a field hold a value you never see?"],
    term: ["# F12 → Elements", "<input type=\"hidden\"", "       name=\"flag\"", { hi: "       value=\"CYBA{hidden-...}\">" }, "<div style=\"display:none\">", "  secret panel", "</div>"], fs: 12.5,
    happened: ["display:none and type=hidden hide things from view, not from the page.", "The Elements panel showed every node, hidden or not.", "The flag was right there in an attribute."],
    real: "Hidden form fields carry prices, user IDs and roles that sites wrongly assume you can't change.",
    stretch: "In Elements, double-click a heading and edit the text. Did the real website change? (No: only your copy.)",
    answer: "F12 → Elements; find the hidden element and read its value.",
    twin: ["$ curl -s URL/ | grep -o 'value=\"CYBA{[^\"]*}\"'"],
    notes: "Reinforce Mission 1's point: the browser hides things for looks, not for security. 'display:none' is a style, not a lock.\n\nEditing the DOM in Elements only changes the local copy; a reload undoes it. Good moment to say so.",
  },
  {
    name: "Check the cookies", level: "Easy", skill: "Application · Cookies", mode: "You do", mins: 5,
    where: "/mission3/   ·   F12 → Application → Cookies",
    brief: "When you opened the page, the site handed you some cookies. One holds the flag. Another decides what you're allowed to see.",
    ask: ["What is a cookie, and who stores it: you or the server?", "Where can you read and change your own cookies?", "If a cookie says role=user, what might role=admin unlock?"],
    term: ["# Application → Cookies", "session = 8f2a9c...", { hi: "flag    = CYBA{cookie-...}" }, "role    = user", "# change role to admin, then reload", "# the admin panel appears"], fs: 12.5,
    happened: ["Cookies are small text values your browser stores and sends back every request.", "The Application panel listed them and let us edit them.", "A site that trusts role=user from a cookie is trusting the client."],
    real: "Changing a cookie's role or user id is one of the most common real web bugs: broken access control.",
    stretch: "What should the server do instead of trusting role=admin in a cookie it handed you?",
    answer: "F12 → Application → Cookies; read the flag cookie (and try setting role=admin).",
    twin: ["$ curl -is URL/ | grep -i set-cookie      # read the flag cookie", "$ curl -s -b 'role=admin' URL/ | grep CYBA   # become admin"],
    notes: "First 'You do' mission. Let them explore the Application tab. The flag cookie is the capture; the role cookie is the teaching point for later.\n\nCookie names and the flag are random each load.",
  },
  {
    name: "Tamper with the URL", level: "Medium", skill: "?id= query param", mode: "You do", mins: 5,
    where: "/mission4/?id=1",
    brief: "You can see your own record at ?id=1. The flag lives on another record. The only lock on that door is the number in the address bar.",
    ask: ["Which part of a URL is the query string?", "If ?id=1 is your record, whose is ?id=2?", "Why is 'nobody will guess the number' not real security?"],
    term: ["$ GET /mission4/?id=1", "Record 1: your profile (guest)", "$ GET /mission4/?id=2", "Record 2: administrator", { hi: "Flag: CYBA{idor-...}" }], fs: 13,
    happened: ["The query string (?id=1) is just input, and input can be changed.", "Changing it to id=2 returned a record that wasn't ours.", "This is IDOR: the server never checked we were allowed to see it."],
    real: "IDOR, changing an id in a URL, has exposed real users' invoices, messages and medical records.",
    stretch: "What single check, on the server, would have stopped this?",
    answer: "Change ?id=1 to another id in the address bar.",
    twin: ["$ for i in $(seq 1 10); do curl -s \"URL/?id=$i\" | grep CYBA; done"],
    notes: "The first 'change the request' mission. Make the point: the URL is input the user controls, never a lock.\n\nWhich id holds the flag is random each load; encourage trying a few.",
  },
  {
    name: "Robots and secret paths", level: "Medium", skill: "/robots.txt", mode: "You do", mins: 5,
    where: "/mission5/robots.txt",
    brief: "Every site has a robots.txt that asks search engines to skip certain pages. That list of 'please don't look here' paths is a map of what someone wanted hidden.",
    ask: ["What is robots.txt actually for?", "Does 'Disallow' stop a person from visiting the page?", "If you wanted to hide a page, is listing it in robots.txt a good idea?"],
    term: ["$ GET /mission5/robots.txt", "User-agent: *", { hi: "Disallow: /mission5/admin-7f3c/" }, "$ GET /mission5/admin-7f3c/", "Flag: CYBA{robots-...}"], fs: 12.5,
    happened: ["robots.txt is a public request to crawlers, not a lock.", "The Disallow line pointed straight at a hidden folder.", "Visiting that path returned the flag."],
    real: "robots.txt has leaked admin panels and staging sites belonging to real companies for years.",
    stretch: "Why is 'security through obscurity' (hiding a page instead of locking it) never enough?",
    answer: "Open /robots.txt, then visit the Disallowed path.",
    twin: ["$ curl -s URL/robots.txt", "$ curl -s URL/<disallowed-path>/ | grep CYBA"],
    notes: "The hidden folder name is random each load; students must read robots.txt, not guess.\n\nGreat place to name 'security through obscurity' and why it fails.",
  },
  {
    name: "The console knows", level: "Medium", skill: "F12 · Console", mode: "You do", mins: 5,
    where: "/mission6/   ·   F12 → Console",
    brief: "The page runs JavaScript in your browser. Somewhere in that code is a function that builds the flag. You just have to call it yourself.",
    ask: ["What is the Console in DevTools?", "If a page defines a function, can you run it too?", "Why is anything the page's JavaScript knows also yours?"],
    term: ["# F12 → Console", "> getFlag()", { hi: "'CYBA{console-...}'" }, "> document.cookie", "'session=8f2a...'", "# the page's JS is yours to run"], fs: 12.5,
    happened: ["The Console runs JavaScript inside the page, right now.", "Calling getFlag() ran the page's own code for us.", "Anything the client-side JS can compute, the user can compute too."],
    real: "Logic and secrets shipped to the browser are never private: attackers read and run them at will.",
    stretch: "Type 'window' in the console and expand it. How much of the page can you reach from there?",
    answer: "F12 → Console; call the page's flag function.",
    twin: ["$ curl -s URL/app.js | grep -i flag      # read what the JS builds"],
    notes: "The function name is shown in the brief / page hints and is stable enough to call. Encourage exploring the Console: it is the single most powerful tool in the deck.",
  },
  {
    name: "Break the lock", level: "Medium", skill: "Sources · read the JS", mode: "You do", mins: 6,
    where: "/mission7/   ·   the login form",
    brief: "A login form checks your password with JavaScript in the page itself. If the check runs in your browser, you can read exactly what it is checking for.",
    ask: ["Where does this login decide right from wrong: your computer, or the server?", "If the password check is in the page's JS, can you read the password?", "Why should a real login never check the password in the browser?"],
    term: ["# Sources → app.js", "function login(pw) {", { hi: "  if (pw === 'sunfl0wer-42') {" }, "    reveal('CYBA{login-...}')", "  }", "}", "# the password shipped to your browser"], fs: 12,
    happened: ["The whole password check was shipped to the browser.", "Reading the JavaScript revealed the password in plain text.", "A check that runs on the client is no check at all."],
    real: "Client-side authentication and hard-coded passwords are real, serious bugs found in shipped apps.",
    stretch: "Where must the password actually be checked so that you cannot read it?",
    answer: "Open Sources; read the password in the JS (or call reveal() in the Console).",
    twin: ["$ curl -s URL/app.js | grep -i \"pw ===\"    # the password, in the code"],
    notes: "Two paths work: read the password and type it, or skip the check entirely by calling the reveal function in the Console. Either one proves the point.",
  },
  {
    name: "Decode the token", level: "Hard", skill: "base64 · JWT", mode: "You do", mins: 6,
    where: "/mission8/   ·   Application → Local Storage",
    brief: "After login the site stored a token that looks like random gibberish. It isn't encrypted, only encoded. Decode it and read what it says about you.",
    ask: ["Encoded or encrypted: which one needs a key? (Remember the Crypto CTF.)", "A token in three dot-separated parts is a JWT. What's in the middle part?", "If you can read a token, what might you be tempted to change?"],
    term: ["# Local Storage", "token = eyJ1c2VyIjoiZ3Vlc3QiLCJm...", "$ echo eyJ1c2VyIjoi... | base64 -d", { hi: '{"user":"guest","flag":"CYBA{jwt-...}"}' }, "# encoding is not encryption"], fs: 11.5,
    happened: ["The token was base64, the same encoding from the Crypto CTF.", "base64 -d turned it straight back into readable JSON.", "Encoding hides nothing: a token you hold is a token you can read."],
    real: "JWTs carry user data in base64. Reading one is trivial; apps must sign them so they can't be forged.",
    stretch: "A real JWT has a signature as its third part. Why does that stop you changing user to admin?",
    answer: "Read the token from storage; base64-decode the middle part.",
    twin: ["$ curl -s URL/ | grep -o 'eyJ[A-Za-z0-9._-]*' \\", "    | cut -d. -f2 | base64 -d      # decode the payload"],
    notes: "Callback to the Crypto CTF: base64 again. If students played that deck, let them point it out.\n\nThe console has atob() for base64 too: atob('eyJ1c2Vy...').",
  },
  {
    name: "A little injection", level: "Hard", skill: "input tampering", mode: "You do", mins: 6,
    where: "/mission9/   ·   the search box",
    brief: "Whatever you type in the search box is pasted straight back into the page. If the page doesn't clean your input, you can make it do more than search.",
    ask: ["After you hit search, is your text shown as plain text, or treated as code?", "If the page trusts your input, what could you slip in?", "Whose job is it to clean user input: the user, or the site?"],
    term: ["$ search: apple", "You searched for: apple", "$ search: <b>hi</b>", "You searched for: hi   (it went bold!)", { hi: "input is run, not shown — Flag: CYBA{inject-...}" }], fs: 11.5,
    happened: ["Our input was reflected back into the page unchanged.", "HTML we typed was treated as HTML, not as text.", "That is the root of XSS: untrusted input used without cleaning."],
    real: "Injection (XSS and SQL injection) sits at the top of the OWASP list, all from trusting user input.",
    stretch: "What should the site do to your <b> so it shows as the letters '<b>' instead of going bold?",
    answer: "Type HTML into the input and submit; the reflected input unlocks the flag.",
    twin: ["$ curl -s \"URL/search?q=<b>x</b>\" | grep CYBA   # reflected input"],
    notes: "Keep this gentle and conceptual: a reflected <b> tag is enough to show the idea. Everything is in the CTF sandbox; stress that injecting into sites you don't own is a crime.",
  },
  {
    name: "The full chain", level: "Very Hard", skill: "robots · ?id= · base64", mode: "You do", mins: 8,
    where: "/mission10/",
    brief: "Three skills in one. robots.txt names a hidden API; the API wants an id you tamper; it returns a token you decode. Peel it one layer at a time.",
    ask: ["Which mission taught us to read robots.txt?", "Which taught us to change an id in a request?", "Which taught us to decode a base64 token?"],
    term: ["$ GET /mission10/robots.txt", "Disallow: /mission10/api/", "$ GET /mission10/api/?id=7", { hi: "token = Q1lCQXt2YXVsdC0uLi59" }, "$ echo Q1lCQXt2YXVsdC0uLi59 | base64 -d", "Flag: CYBA{vault-...}", "Vault opened. You beat the final mission."], fs: 11.5,
    happened: ["robots.txt pointed to the hidden API, like Mission 5.", "Tampering ?id= returned a record that wasn't ours, like Mission 4.", "base64 -d decoded the token, like Mission 8."],
    real: "Real attacks chain small, unglamorous steps exactly like this: map, poke, decode, repeat.",
    stretch: "Which single missing check would have broken the whole chain?",
    answer: "robots.txt → visit /api/?id=... → base64-decode the token it returns.",
    twin: ["$ curl -s URL/robots.txt               # find /api/", "$ curl -s \"URL/api/?id=7\" | base64 -d   # decode the token"],
    notes: "The capstone: it revisits missions 5, 4 and 8. Walk it only if time allows; reaching it is a stretch goal, not the point of the hour.",
  },
];

async function build() {
  let s;

  // ===========================================================================
  // OPENING
  // ===========================================================================
  section("Opening");
  s = pres.addSlide({ masterName: "TITLE" });
  slideNo += 1;
  s.addText("CyberQuest", { x: M, y: 1.5, w: 7.2, h: 1.4, fontFace: HEAD, fontSize: 84, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Web CTF: break into the app.\nLearn how, then compete.", { x: M, y: 3.05, w: 6.9, h: 1.3, fontFace: BODY, fontSize: 26, color: "E8EEFF", margin: 0, isTextBox: true });
  chip(s, "simulated CTF competition", M, 4.55, 3.0, AMBER, INK, 15);
  s.addText("CyberQuest Academy mentorship session", { x: M, y: 5.12, w: 6.5, h: 0.4, fontFace: BODY, fontSize: 18, bold: true, color: WHITE, margin: 0, isTextBox: true });
  PAGES.push({ s, dark: true });
  s.addNotes(
    "Welcome the class and introduce the mentors: name, what you do, and one sentence on where you meet web security at work.\n\n" +
    "Promise: 'Today you will learn how websites really work, where they go wrong, and break into a practice app the way security pros do - using only your browser.'\n\n" +
    "Before class: the Web CTF link is on the 'Open the CTF' slide in the appendix, and you have watched it load on a student Chromebook on the school network. Nothing to install; it runs in a browser tab.");

  // ---- run of show ----
  s = newSlide("How today works",
    "Set expectations up front. This is a focused, mentor-led session, not a race to finish every challenge. The goal is that students understand how an attacker thinks about a website - and most of all, how a CTF actually works: read the challenge, look at the app, try something, read what came back, adjust, capture a flag.\n\n" +
    "Say it plainly: 'You will NOT finish every challenge today, and that is fine. We want you to understand the process and feel confident starting one on your own.'\n\n" +
    "The arc below is the shape of the session: short theory, one flag captured together, then you start one yourself, then we reflect.\n\n" +
    "The deal: no coding needed. Looking closely at a page and changing what you send back is how everyone learns this.");
  const arc = [["Concept", "What a web CTF is, and why web bugs matter.", MC[0], fa.FaLightbulb], ["Mental model", "How attackers think: never trust the browser.", MC[1], fa.FaBrain], ["Tools", "The browser's own DevTools - just what a challenge needs.", MC[2], fa.FaWrench], ["Guided", "We capture a flag together, step by step.", MC[3], fa.FaMapLocationDot], ["Independent", "You start a challenge yourself. Finishing is optional.", MC[4], fa.FaPersonHiking], ["Reflection", "Why it worked, and where this leads.", GREEN, fa.FaClipboardCheck]];
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
    if (i % 3 < 2) s.addShape(pres.shapes.LINE, { x: x + CW + 0.02, y: y + CH / 2, w: GX - CW - 0.04, h: 0.02, line: { color: "9AA7BD", width: 2, endArrowType: "triangle" } });
  }

  // ---- what is a web CTF ----
  s = newSlide("What is a web CTF?",
    "A capture the flag, or CTF, is a puzzle competition for security skills. In a web CTF, every flag is hidden somewhere inside a website: in the page's source, a cookie, the URL, a token, or the way the app handles your input. Find it, pull it out, submit it.\n\n" +
    "Read the flag anatomy out loud. Every flag starts with CYBA and has its secret between curly braces. That known start tells you when you've found the real thing.\n\n" +
    "Stress permission: poking at an app you were handed in a CTF is practice. Doing it to a site you don't own is a crime.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fill: { color: TERM }, rectRadius: 0.1 });
  s.addText([{ text: "<!-- ", options: { color: T_NOTE, bold: true } }, { text: "CYBA", options: { color: "7FB2FF", bold: true } }, { text: "{", options: { color: AMBER, bold: true } }, { text: "src-4c8c640b", options: { color: T_PROMPT, bold: true } }, { text: "}", options: { color: AMBER, bold: true } }, { text: " -->", options: { color: T_NOTE, bold: true } }],
    { x: M, y: 1.65, w: W - 2 * M, h: 1.5, fontFace: MONO, fontSize: 26, align: "center", valign: "middle", margin: 0, isTextBox: true });
  [["In the app", "C07A00", "What you're given", "A flag hidden in the page, a cookie, a URL or a token."], ["Find it", "2459D8", "Your job", "Inspect, tamper, decode: make the app reveal it."], ["CYBA{...}", "17875A", "The proof", "Readable text starting CYBA{: you captured it."]].forEach(([tok, color, head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 3.45, 3.9, 1.65);
    text(s, tok, x + 0.25, 3.6, 3.4, 0.4, { fontFace: HEAD, fontSize: 18, bold: true, color });
    text(s, head, x + 0.25, 4.05, 3.4, 0.35, { fontSize: 16, bold: true });
    text(s, body, x + 0.25, 4.42, 3.45, 0.6, { fontSize: 14, color: MUTED });
  });
  const round = [["Inspect", "look closely"], ["Change", "the request"], ["Submit", "the whole flag"], ["Score", "points on the board"]];
  round.forEach(([a, b], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.45, w: 2.6, h: 1.0, fill: { color: MC[i + 1] }, rectRadius: 0.1 });
    s.addText([{ text: a, options: { bold: true, fontSize: 20, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x, y: 5.45, w: 2.6, h: 1.0, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addText(">", { x: x + 2.6, y: 5.45, w: 0.47, h: 1.0, fontFace: MONO, fontSize: 24, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });

  // ---- the CTF flow ----
  s = newSlide("The flow of every challenge",
    "This is the single most important idea in the session. Every CTF challenge - and a lot of real security work - runs this same loop. Say it out loud, and point back to it every time the room gets stuck.\n\n" +
    "The key move is the middle of the loop: you TRY something, CHECK what came back, and ADJUST. Nobody is expected to know the answer up front. Reading the response and adjusting IS the skill. For web, 'Observe the clues' is where you ask: is the flag in the source, a cookie, the URL, a token, or the way my input is handled?\n\n" +
    "Capturing the flag is just where the loop ends. The habit of read, try, check, adjust is what students should leave with.");
  const flow = [["Read", "the challenge", fa.FaBookOpen], ["Observe", "the app", fa.FaMagnifyingGlass], ["Choose", "a tool", fa.FaWrench], ["Try", "a change", fa.FaHand], ["Check", "the response", fa.FaEye], ["Adjust", "if needed", fa.FaArrowsRotate], ["Capture", "the flag", fa.FaFlag], ["Submit", "& reflect", fa.FaCircleCheck]];
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
  // PART 1: WEB FUNDAMENTALS
  // ===========================================================================
  section("Part 1 · Web fundamentals");
  divider(1, "Web fundamentals", "How the web really works, the three layers of a page, and the one rule every bug breaks: never trust the browser.", MC[0], "curl https://site/   # what the server really sent",
    "Section break. Ask: 'Who has used a website today?' Every hand. 'Everything you did went through the loop we're about to see.'\n\nThe command on screen fetches a page's raw code - exactly what you'll read in Part 2.");

  // ---- what is web exploitation ----
  s = newSlide("What is web exploitation?",
    "The top-level definition and the vocabulary for the session. Web exploitation is finding mistakes in how a website is built and using them to make it do something it shouldn't - here, hand you a flag.\n\n" +
    "Walk the flow left to right: your browser sends a REQUEST, the server sends back a RESPONSE, the browser shows it. The catch is in the middle: the server often trusts whatever the request says. And you control the request.\n\n" +
    "Name the four words the class will hear all day: request, response, client (your browser), server (the app).\n\n" +
    "In this CTF you play the visitor who looks closer and changes the request: your job is to make the app reveal what it shouldn't.\n\n" +
    "At its heart: the browser will send whatever you tell it, and a careless server believes it.");
  text(s, "Finding mistakes in how a website trusts you, and using them to make it do something it shouldn't. The browser sends a request; a careless server believes whatever it says.", M, 1.5, W - 2 * M, 0.55, { fontSize: 17, color: MUTED });
  const fb = 2.35, fh = 1.42, bw = 3.1, bx = [M, 5.1, 9.6];
  const boxes = [["YOUR BROWSER", "GET /?id=1", "you send", false], ["THE SERVER", "trusts it", "it answers", true], ["THE RESPONSE", "the page", "you read & change", false]];
  boxes.forEach(([lbl, val, sub, dark], i) => {
    const x = bx[i];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: fb, w: bw, h: fh, fill: { color: dark ? TERM : tint(MC[0], 0.88) }, line: { color: dark ? TERM : tint(MC[0], 0.55), width: 1 }, rectRadius: 0.1 });
    s.addText(lbl, { x, y: fb + 0.14, w: bw, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: dark ? T_NOTE : "4A5B78", align: "center", margin: 0, isTextBox: true });
    s.addText(val, { x, y: fb + 0.42, w: bw, h: 0.6, fontFace: MONO, fontSize: 24, bold: true, color: dark ? T_PROMPT : INK, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(sub, { x, y: fb + 1.02, w: bw, h: 0.3, fontFace: BODY, fontSize: 12, color: dark ? T_OUT : MUTED, align: "center", margin: 0, isTextBox: true });
  });
  for (const [x1, x2, Ic, lbl] of [[bx[0] + bw, bx[1], fa.FaArrowRightLong, "request"], [bx[1] + bw, bx[2], fa.FaArrowRightLong, "response"]]) {
    const cx = (x1 + x2) / 2;
    s.addShape(pres.shapes.LINE, { x: x1 + 0.08, y: fb + fh - 0.12, w: (x2 - x1) - 0.16, h: 0.02, line: { color: "9AA7BD", width: 2, endArrowType: "triangle" } });
    await iconTintCircle(s, Ic, cx - 0.32, fb + 0.12, 0.64, MC[2]);
    s.addText(lbl, { x: cx - 0.7, y: fb + 0.82, w: 1.4, h: 0.3, fontFace: HEAD, fontSize: 13, bold: true, color: MC[2], align: "center", margin: 0, isTextBox: true });
  }
  const fy = 4.22, fcH = 1.86;
  card(s, M, fy, 5.95, fcH);
  text(s, "What you'll actually do", M + 0.3, fy + 0.15, 5.4, 0.35, { fontFace: HEAD, fontSize: 17, bold: true });
  const forrows = [[fa.FaEye, MC[0], "Look closer", "read the source, cookies and tokens the app sent you"], [fa.FaHand, MC[2], "Change the request", "edit a URL, a cookie, or what you type in"], [fa.FaFlag, MC[4], "Capture the flag", "make the app reveal what it shouldn't"]];
  for (let i = 0; i < forrows.length; i++) {
    const [Ic, ac, h, b] = forrows[i], ry = fy + 0.58 + i * 0.42;
    await iconTintCircle(s, Ic, M + 0.3, ry, 0.34, ac);
    text(s, [{ text: h + ": ", options: { bold: true } }, { text: b }], M + 0.76, ry - 0.02, 5.0, 0.38, { fontSize: 14, valign: "middle" });
  }
  card(s, 6.78, fy, 5.95, fcH);
  text(s, "Where you meet the web every day", 7.08, fy + 0.15, 5.4, 0.35, { fontFace: HEAD, fontSize: 17, bold: true });
  const meet = [[fa.FaGlobe, "Websites", MC[1]], [fa.FaMobileScreen, "Phone apps", MC[2]], [fa.FaGamepad, "Online games", MC[3]], [fa.FaCreditCard, "Shopping", MC[5]]];
  for (let i = 0; i < meet.length; i++) {
    const [Ic, lbl, ac] = meet[i], tx = 6.95 + i * 1.46;
    await iconTintCircle(s, Ic, tx + 0.33, fy + 0.62, 0.72, ac);
    text(s, lbl, tx - 0.05, fy + 1.42, 1.5, 0.35, { fontSize: 11.5, bold: true, align: "center" });
  }

  // ---- how the web works ----
  s = newSlide("How the web works: request and response",
    "The mechanic everything else rests on. Type a web address, press Enter, and your browser sends a REQUEST to a server. The server runs some code and sends back a RESPONSE: the HTML, plus headers (extra info like cookies). The browser draws the page.\n\n" +
    "Point out the parts on the right: the method (GET), the path (/?id=1), the headers (including the cookie your browser sends every time). Everything in that request is text, and every bit of it is under your control.\n\n" +
    "That is the whole opening for the attacker: the server is a stranger who only knows what your request told it.");
  numbered(s, [
    [{ text: "You ask. ", options: { bold: true } }, { text: "Type an address or click a link; the browser builds a request." }],
    [{ text: "The browser sends it. ", options: { bold: true } }, { text: "Method, path, and headers (including your cookies)." }],
    [{ text: "The server answers. ", options: { bold: true } }, { text: "It runs code and sends back HTML and headers." }],
    [{ text: "The browser draws it. ", options: { bold: true } }, { text: "You see a page; you never see the code that made it." }],
  ], M, 1.75, 6.2, 1.12, BLUE, 16);
  term(s, 7.1, 1.6, 5.63, 4.9, [
    "$ GET /mission4/?id=1 HTTP/1.1", "Host: web.ctf", "Cookie: role=user", "# ^ the request: all of it is yours", " ",
    "HTTP/1.1 200 OK", "Set-Cookie: session=8f2a...", "Content-Type: text/html", " ", "<html>...your profile...</html>", "# ^ the response the browser draws",
  ], { fontSize: 13.5, title: "one request, one response" });

  // ---- three layers ----
  s = newSlide("Three layers of a web page",
    "The single most useful mental model of the session. Every page is three layers, and each one leaks differently.\n\n" +
    "HTML is the structure and content: headings, text, forms, hidden fields - and comments. Secrets hide here (missions 1, 2).\n\n" +
    "CSS is the look: colour, layout, and what's shown or hidden. 'Hidden' is just a style, not a lock (mission 2).\n\n" +
    "JavaScript is the behaviour: it runs in YOUR browser, so you can read it and run it yourself. Any secret or check it holds is yours (missions 6, 7).\n\n" +
    "Ask: 'If the login check is JavaScript, where does it run?' In your browser - so you can read it.");
  const three = [
    ["HTML", "Structure & content. Comments and hidden fields live here.", "<!-- -->  <input hidden>", "View Source", "Missions 1, 2", MC[0]],
    ["CSS", "The look. 'Hidden' is a style, not a lock.", "display:none", "Inspect", "Mission 2", MC[3]],
    ["JavaScript", "Behaviour. Runs in YOUR browser - so you can read it.", "getFlag()  if(pw===...)", "Console", "Missions 6, 7", MC[4]],
  ];
  three.forEach(([name, rule, ex, sample, which, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.65, 3.9, 4.85);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 3.9, h: 0.12, fill: { color } });
    text(s, name, x + 0.3, 1.95, 3.3, 0.6, { fontFace: HEAD, fontSize: 28, bold: true, color });
    text(s, rule, x + 0.3, 2.6, 3.3, 1.0, { fontSize: 17, bold: true });
    text(s, "Looks like", x + 0.3, 3.65, 3.3, 0.35, { fontSize: 12, bold: true, color: MUTED });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 4.0, w: 3.3, h: 0.9, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(ex, { x: x + 0.45, y: 4.0, w: 3.0, h: 0.9, fontFace: MONO, fontSize: 14, bold: true, color: T_PROMPT, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 5.05, w: 1.7, h: 0.42, fill: { color: tint(color, 0.8) }, rectRadius: 0.08 });
    s.addText(sample, { x: x + 0.3, y: 5.05, w: 1.7, h: 0.42, fontFace: BODY, fontSize: 12.5, bold: true, color, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, which, x + 0.3, 5.65, 3.3, 0.6, { fontSize: 14, color: MUTED });
  });

  // ---- client vs server ----
  s = newSlide("Client vs server: who can you trust?",
    "The one rule the whole deck leans on. There are two sides to every website: the client (your browser) and the server (the app).\n\n" +
    "Everything on the client side you control completely: the HTML, the CSS, the cookies, the JavaScript, and every request you send. You can read it and change it. So the server can never trust any of it.\n\n" +
    "Say it, write it, repeat it: NEVER TRUST THE CLIENT. Every mission today is a server that broke this rule - it believed a cookie, a URL, or a check that ran in your browser.\n\n" +
    "Analogy: the request is a form you fill in yourself. A careful office re-checks it; a careless one just stamps whatever you wrote.\n\n" +
    "The takeaway: if a decision happens in the browser, the user owns it. Security has to happen on the server.");
  text(s, "Everything in your browser, you control. So the server can never trust it. Say it out loud: never trust the client.", M, 1.5, W - 2 * M, 0.5, { fontSize: 17, color: MUTED });
  const kc = [[fa.FaLaptop, MC[4], "The client (you)", "Your browser. HTML, cookies, JavaScript and every request - all of it you can read and change. None of it can be trusted."], [fa.FaServer, MC[0], "The server (the app)", "The only place a real decision is safe. It must re-check everything, because the request came from a stranger."]];
  for (let i = 0; i < kc.length; i++) {
    const [Ic, ac, ttl, body] = kc[i], y = 2.15 + i * 1.92;
    card(s, M, y, 5.5, 1.78);
    await iconTintCircle(s, Ic, M + 0.3, y + 0.32, 0.9, ac);
    text(s, ttl, M + 1.45, y + 0.3, 3.8, 0.6, { fontFace: HEAD, fontSize: 21, bold: true, color: ac, valign: "middle" });
    text(s, body, M + 0.35, y + 1.0, 5.0, 0.7, { fontSize: 13.5, color: INK });
  }
  term(s, 6.4, 2.15, 6.33, 3.68, [
    "# the browser sends whatever you set", "$ Cookie: role=user", "   -> careless server: 'ok, user'", { hi: "$ Cookie: role=admin" }, { hi: "   -> careless server: 'ok, admin!'" }, " ",
    "# a careful server decides for itself", "$ Cookie: role=admin", "   -> 'who are you really? checking...'", "   -> 'denied.'",
  ], { fontSize: 13.5, title: "never trust the client" });

  // ---- web is everywhere ----
  s = newSlide("The web is everywhere",
    "Make it personal. Almost every app students use is a web app under the hood, talking to servers with the same requests and responses we just saw.\n\n" +
    "Social apps, games, banking, shopping, streaming, and the school portal all run on web technology. The skills today apply to all of them - which is exactly why web security is one of the biggest fields in the industry.\n\n" +
    "Ask: 'What's an app you used today that talks to the internet?' Almost all of them do.");
  const pocket = [[fa.FaComments, "Social apps", "Posts, messages and logins are web requests behind the scenes.", MC[1]], [fa.FaGamepad, "Online games", "Scores, matches and purchases all travel as requests.", MC[2]], [fa.FaCreditCard, "Shopping", "Carts, prices and checkout are web pages and APIs.", MC[3]], [fa.FaGraduationCap, "School portal", "Grades and schedules: a web app you log into.", MC[4]], [fa.FaCloud, "Streaming", "Every video you pick is a request to a server.", MC[5]], [fa.FaMobileScreen, "Phone apps", "Most apps are a web request wrapped in an icon.", MC[7]]];
  for (let i = 0; i < pocket.length; i++) {
    const [Icon, head, body, color] = pocket[i];
    const x = M + (i % 3) * 4.11, y = 1.65 + Math.floor(i / 3) * 2.45;
    card(s, x, y, 3.9, 2.25);
    await iconCircle(s, Icon, x + 0.3, y + 0.3, 0.8, color);
    text(s, head, x + 1.3, y + 0.35, 2.4, 0.7, { fontFace: HEAD, fontSize: 21, bold: true, valign: "middle" });
    text(s, body, x + 0.3, y + 1.25, 3.35, 0.9, { fontSize: 15, color: MUTED });
  }

  // ---- DevTools intro ----
  s = newSlide("Your browser is a hacking toolbox",
    "The single most important tool slide. Everything today is done with DevTools - already built into Chrome, Edge and Firefox. Open it now on the projector: press F12 (or right-click → Inspect).\n\n" +
    "Walk the five panels. Students do not need to master them - just know which panel holds what, so they know where to look when they see the challenge.\n\n" +
    "Elements = the live page. Console = run JavaScript. Network = every request and response. Application = cookies and storage. Sources = the page's code files.\n\n" +
    "Say it: 'This is the same tool professional web developers and security testers use every day. It's free, and it's already on your computer.'");
  text(s, "Press F12 (or right-click → Inspect). It's built into every browser - the same tool the pros use.", M, 1.5, W - 2 * M, 0.5, { fontSize: 17, color: MUTED });
  const panels = [[fa.FaCode, "Elements", "The live page - every tag, even the hidden ones. Edit it in place.", MC[0], "1, 2"], [fa.FaTerminal, "Console", "Run JavaScript on the page right now. Call its functions.", MC[2], "6, 7"], [fa.FaNetworkWired, "Network", "Every request and response, with headers and data.", MC[3], "4, 10"], [fa.FaDatabase, "Application", "Cookies and storage the site saved in your browser.", MC[4], "3, 8"], [fa.FaFileCode, "Sources", "The page's actual code files, including its JavaScript.", MC[7], "7"]];
  for (let i = 0; i < panels.length; i++) {
    const [Icon, head, body, color, miss] = panels[i];
    const x = M + (i % 3) * 4.11, y = 2.2 + Math.floor(i / 3) * 2.2;
    card(s, x, y, 3.9, 2.0);
    await iconCircle(s, Icon, x + 0.3, y + 0.28, 0.72, color);
    text(s, head, x + 1.2, y + 0.32, 2.5, 0.6, { fontFace: HEAD, fontSize: 20, bold: true, valign: "middle" });
    text(s, body, x + 0.3, y + 1.12, 3.35, 0.7, { fontSize: 13.5, color: MUTED });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 2.95, y: y + 0.32, w: 0.85, h: 0.34, fill: { color: tint(color, 0.8) }, rectRadius: 0.17 });
    s.addText("M " + miss, { x: x + 2.95, y: y + 0.32, w: 0.85, h: 0.34, fontFace: BODY, fontSize: 10, bold: true, color, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  card(s, 8.82, 4.4, 3.91, 2.0, "FFF4DC");
  text(s, [{ text: "The golden rule: ", options: { bold: true } }, { text: "look before you touch. Open DevTools on every challenge and read what the app already handed you." }], 9.12, 4.55, 3.4, 1.7, { fontSize: 15, valign: "middle" });

  // ---- identify where the flag hides ----
  s = newSlide("First, find where the flag hides",
    "Half of every web CTF is knowing where to look. Teach these six hiding places; students will lean on this slide all session.\n\n" +
    "In the source: an HTML comment or hidden field -> View Source / Inspect.\n" +
    "In a cookie or storage: a value the site saved in your browser -> Application.\n" +
    "In the URL: an id or name you can change -> edit the address bar.\n" +
    "In robots.txt: a hidden path someone tried to keep quiet -> visit it.\n" +
    "In the JavaScript: a function or password in the page's code -> Console / Sources.\n" +
    "In a token: base64 or a JWT that only looks random -> decode it.\n\n" +
    "Leave this slide up while students work if you can.");
  const ids = [["In the source", "<!-- CYBA{...} -->", "Comment or hidden field", "View Source / Inspect", MC[0]], ["In a cookie", "flag=CYBA{...}", "A value saved in your browser", "Application → Cookies", MC[1]], ["In the URL", "/?id=1  ->  ?id=2", "An id or name you can change", "edit the address bar", MC[2]], ["In robots.txt", "Disallow: /admin-7f3/", "A path someone hid", "visit the path", MC[5]], ["In the JavaScript", "if (pw === '...')", "A function or password in code", "Console / Sources", MC[3]], ["In a token", "eyJ1c2VyIjoi...", "base64 / JWT, only looks random", "base64 -d / atob()", MC[4]]];
  ids.forEach(([name, sample, tell, tool, color], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.65;
    card(s, x, y, 5.96, 1.5);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.12, h: 1.5, fill: { color } });
    text(s, name, x + 0.35, y + 0.12, 2.9, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 3.25, y: y + 0.15, w: 2.5, h: 0.42, fill: { color: TERM }, rectRadius: 0.06 });
    s.addText(tool, { x: x + 3.25, y: y + 0.15, w: 2.5, h: 0.42, fontFace: MONO, fontSize: 11, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    mono(s, sample, x + 0.35, y + 0.65, 5.4, 0.35, { fontSize: 13, color: INK, bold: false });
    text(s, tell, x + 0.35, y + 1.02, 5.4, 0.35, { fontSize: 13.5, color: MUTED });
  });

  // ===========================================================================
  // PART 2: THE BROWSER TOOLKIT
  // ===========================================================================
  section("Part 2 · Browser toolkit");
  divider(2, "The browser toolkit", "Open the Web CTF, then one tool per challenge, in the order the missions need them. Every slide has a Try it.", MC[2], "F12   # your browser already has everything you need",
    "Section break. Open the Web CTF now (mentor appendix: 'Open the CTF'), so every device is ready for the Try it pills.\n\nDemo every move live on the projector. Then give the room 30 seconds to try the green Try it themselves.\n\nNone of the Try it actions touch the missions, so nothing gets spoiled.");

  // ---- view source & inspect ----
  s = newSlide("See everything: View Source & Inspect",
    "Two ways to read what the page is really made of. Both reveal content the rendered page hides.\n\n" +
    "View Source (Ctrl+U) shows the raw HTML the server sent, exactly as it arrived - comments and all.\n\n" +
    "Inspect (F12 → Elements, or right-click → Inspect) shows the LIVE page: the current structure, including elements added by JavaScript and anything hidden with CSS. Right-click an element and 'Inspect' jumps straight to it.\n\n" +
    "Have students View Source on this very slide's CTF page, then open Elements and find a hidden element.", "Ctrl+U");
  forMission(s, [1, 2]);
  cmdRow(s, "Ctrl+U", "view the raw HTML the server sent", M, 1.75, 6.2, 2.0);
  cmdRow(s, "F12", "open DevTools on the Elements panel", M, 2.4, 6.2, 2.0);
  cmdRow(s, "right-click · Inspect", "jump to one element in the page", M, 3.05, 6.2, 2.3);
  card(s, M, 3.9, 6.2, 2.6, "FFF4DC");
  text(s, [{ text: "Source vs live page. ", options: { bold: true } }, { text: "View Source is the page as it arrived. Elements is the page as it is now - after JavaScript ran and after you've edited it. For hidden fields and comments, either one works." }], M + 0.3, 4.05, 5.6, 2.3, { fontSize: 15, valign: "top" });
  term(s, 6.9, 1.6, 5.83, 4.9, ["# Ctrl+U  (View Source)", "<body>", "  <h1>Welcome</h1>", "  <!-- flag: CYBA{...} -->", { hi: "  ^ a comment: never shown on screen" }, "  <input type=\"hidden\"", "        value=\"CYBA{...}\">", { hi: "  ^ a field you can't see" }, "</body>"], { fontSize: 14, title: "view-source:" });

  // ---- elements panel ----
  s = newSlide("Edit the live page: Elements",
    "The Elements panel is a live, editable copy of the page. Double-click text to change it; right-click a node to delete it, or to flip a style.\n\n" +
    "This is how you reveal things the page hides: find the element with display:none or a disabled button, and turn the style off or delete it. The hidden content pops into view.\n\n" +
    "Important and freeing to say: editing here only changes YOUR copy in YOUR browser. A reload throws it all away. You cannot break the real website from Elements.", "F12 → double-click any text");
  forMission(s, [2]);
  numbered(s, [
    [{ text: "Find the element. ", options: { bold: true } }, { text: "Right-click → Inspect, or scroll the Elements tree." }],
    [{ text: "See the hidden ones. ", options: { bold: true } }, { text: "display:none and type=hidden are still right there." }],
    [{ text: "Flip the switch. ", options: { bold: true } }, { text: "Untick a style, or delete the node that hides it." }],
    [{ text: "Read the value. ", options: { bold: true } }, { text: "A hidden field's value sits in plain text in the HTML." }],
  ], M, 1.8, 6.2, 1.05, MC[3], 16);
  card(s, M, 6.1, 6.2, 0.5, "E2F5EC");
  text(s, "Editing Elements changes only your copy. A reload undoes it.", M + 0.3, 6.1, 5.6, 0.5, { valign: "middle", fontSize: 14, bold: true, color: "0F6A45" });
  term(s, 7.1, 1.6, 5.63, 4.9, ["# Elements", "<button disabled>Secret</button>", { hi: "^ delete 'disabled' to click it" }, " ", "<div style=\"display:none\">", "   Flag: CYBA{hidden-...}", "</div>", { hi: "^ untick display:none to reveal it" }], { fontSize: 14, title: "the live DOM" });

  // ---- cookies & storage ----
  s = newSlide("Cookies & storage: what the site saved on you",
    "A cookie is a small text value the server asks your browser to keep and send back on every request. Local storage is similar, but stays in the browser. Both live in DevTools → Application.\n\n" +
    "You can read them, and you can change them. If a site decides what you can see from a cookie it handed you - role=user - you can try role=admin and reload. That's the mission 3 idea.\n\n" +
    "Tokens often live here too (mission 8). We'll decode those two slides from now.", "F12 → Application → Cookies");
  forMission(s, [3, 8]);
  cmdRow(s, "Application → Cookies", "read & edit cookies", M, 1.75, 6.5, 2.9);
  cmdRow(s, "Application → Storage", "local & session storage", M, 2.4, 6.5, 2.9);
  cmdRow(s, "double-click a value", "change it, then reload", M, 3.05, 6.5, 2.9);
  card(s, M, 3.9, 6.5, 2.6, "FFF4DC");
  text(s, [{ text: "A cookie is a note you carry. ", options: { bold: true } }, { text: "The server wrote it, but it rides in your browser and you can rewrite it. A site that trusts role=admin in a cookie is trusting a note the visitor can edit - the root of broken access control." }], M + 0.3, 4.05, 5.9, 2.3, { fontSize: 15, valign: "top" });
  term(s, 7.3, 1.6, 5.43, 4.9, ["# Application → Cookies", "session  8f2a9c1d...", "flag     CYBA{cookie-...}", { hi: "^ the capture" }, "role     user", { hi: "^ try: double-click -> admin" }, "# then reload the page"], { fontSize: 13.5, title: "cookies" });

  // ---- URL & robots ----
  s = newSlide("The URL is input: params & robots.txt",
    "The web address is not fixed furniture - it's input you type, so you can change it.\n\n" +
    "The query string is the part after the ?: /profile?id=1. Each name=value is a parameter. Change id=1 to id=2 and you've asked for a different record. If the server didn't check you're allowed, you get it (mission 4: IDOR).\n\n" +
    "robots.txt (at the site root) lists paths the site asks crawlers to skip. It's public, and it's a map of what someone wanted hidden. Read it, then visit the Disallowed path (mission 5).", "add ?id=2 to a URL");
  forMission(s, [4, 5]);
  cmdRow(s, "?name=value", "change a query parameter", M, 1.75, 6.3, 2.4);
  cmdRow(s, "/robots.txt", "list the paths a site hides", M, 2.4, 6.3, 2.4);
  cmdRow(s, "visit the path", "there's no lock, just a request", M, 3.05, 6.3, 2.4);
  card(s, M, 3.9, 6.3, 2.6, "FFF4DC");
  text(s, [{ text: "'They won't guess it' is not security. ", options: { bold: true } }, { text: "A guessable id and a hidden-but-public path both rely on nobody looking. Real protection checks, on the server, whether you're allowed - every time." }], M + 0.3, 4.05, 5.7, 2.3, { fontSize: 15, valign: "top" });
  term(s, 7.2, 1.6, 5.53, 4.9, ["$ GET /profile?id=1", "Your profile", "$ GET /profile?id=2", { hi: "Someone else's profile" }, " ", "$ GET /robots.txt", "Disallow: /admin-7f3c/", { hi: "^ a map of what's hidden" }], { fontSize: 14, title: "the address bar" });

  // ---- console ----
  s = newSlide("The Console: run the page's JavaScript",
    "The Console is a live JavaScript prompt attached to the page. Anything the page's code can do, you can type and run right now.\n\n" +
    "Call a function the page defined: getFlag(). Read a variable. Inspect document.cookie. Decode a token with atob(). It is the most powerful tool in the deck.\n\n" +
    "The lesson underneath: all this code was sent to your browser, so there are no secrets in it. If the page can compute the flag, so can you.", "F12 → Console, type 2+2");
  forMission(s, [6, 7]);
  cmdRow(s, "getFlag()", "call a function the page defined", M, 1.75, 6.3, 2.4);
  cmdRow(s, "atob('eyJ...')", "base64-decode in the browser", M, 2.4, 6.3, 2.4);
  cmdRow(s, "document.cookie", "read your cookies as text", M, 3.05, 6.3, 2.4);
  card(s, M, 3.9, 6.3, 2.6, "FFF4DC");
  text(s, [{ text: "Shipped to you means readable by you. ", options: { bold: true } }, { text: "Every line of a page's JavaScript was downloaded to your browser. You can read it, run it and change it - so a secret or a password in client-side code is already yours." }], M + 0.3, 4.05, 5.7, 2.3, { fontSize: 15, valign: "top" });
  term(s, 7.2, 1.6, 5.53, 4.9, ["> 2 + 2", "4", "> getFlag()", { hi: "'CYBA{console-...}'" }, "> atob('aGkK')", "'hi'", "# the page's code, in your hands"], { fontSize: 14.5, title: "Console" });

  // ---- read the JS ----
  s = newSlide("Read the code: the Sources panel",
    "Sources (sometimes 'Debugger') lists every code file the page loaded, including its JavaScript. You can open and read all of it.\n\n" +
    "When a page checks a password, shows or hides a button, or builds a flag in JavaScript, the logic is sitting right there to read. Mission 7's login password is one string in a .js file.\n\n" +
    "Two ways to win once you can read it: use what you learned (type the password), or skip the check entirely by calling the reveal function in the Console. Both prove the same point: client-side checks don't protect anything.", "F12 → Sources");
  forMission(s, [7]);
  numbered(s, [
    [{ text: "Open Sources. ", options: { bold: true } }, { text: "Every .js file the page loaded is listed on the left." }],
    [{ text: "Find the logic. ", options: { bold: true } }, { text: "Search for the button text, 'password', or 'flag'." }],
    [{ text: "Read the secret. ", options: { bold: true } }, { text: "The password or flag is a plain string in the code." }],
    [{ text: "Or skip the check. ", options: { bold: true } }, { text: "Call the reveal function straight from the Console." }],
  ], M, 1.8, 6.2, 1.05, MC[7], 16);
  term(s, 7.1, 1.6, 5.63, 4.9, ["# Sources → app.js", "function login(pw) {", { hi: "  if (pw === 'sunfl0wer-42') {" }, "    reveal('CYBA{login-...}')", "  }", "}", " ", "# or, in the Console:", "> reveal('x')   // skip the check"], { fontSize: 13.5, title: "app.js" });

  // ---- decode tokens ----
  s = newSlide("Decode tokens: base64 & JWT",
    "Tokens prove who you are after login. They often LOOK like random gibberish, but most are only base64-encoded, not encrypted. No key needed to read them.\n\n" +
    "base64 turns bytes into safe letters and digits; it is reversible by anyone - exactly like the Crypto CTF. Decode with the Console's atob(), or base64 -d.\n\n" +
    "A JWT is three base64 parts split by dots: header.payload.signature. The middle part (payload) is your data - decode it and read it. The signature is what stops you forging changes, which is Mission 8's stretch question.", "atob('eyJoaSI6MX0')");
  forMission(s, [8]);
  const chain8 = [["eyJ1c2Vy...", "a token - looks random", MC[0]], ["base64 -d", "it's only encoded", MC[1]], ['{"user":...}', "readable JSON", MC[7]], ["CYBA{...}", "the flag inside", GREEN]];
  chain8.forEach(([cmd, what, color], i) => {
    const x = M + i * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 2.75, h: 1.4, fill: { color }, rectRadius: 0.1 });
    s.addText([{ text: cmd, options: { fontFace: MONO, bold: true, fontSize: 15, breakLine: true } }, { text: what, options: { fontSize: 13 } }], { x, y: 1.75, w: 2.75, h: 1.4, fontFace: BODY, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    if (i < 3) s.addText(">", { x: x + 2.75, y: 1.75, w: 0.32, h: 1.4, fontFace: MONO, fontSize: 28, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, M, 3.4, 6.1, 3.0, "FFF4DC");
  text(s, "A JWT has three parts", M + 0.3, 3.55, 5.5, 0.4, { fontSize: 17, bold: true });
  const jwtp = [["header", "which algorithm", MC[1]], ["payload", "your data - decode & read this", MC[4]], ["signature", "proves it wasn't changed", MC[0]]];
  jwtp.forEach(([a, b, c], i) => {
    const y = 4.05 + i * 0.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.3, y, w: 1.75, h: 0.6, fill: { color: c }, rectRadius: 0.08 });
    s.addText(a, { x: M + 0.3, y, w: 1.75, h: 0.6, fontFace: MONO, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, b, M + 2.25, y, 3.7, 0.6, { fontSize: 14.5, valign: "middle", color: INK });
  });
  term(s, 6.9, 3.4, 5.83, 3.0, ["> atob('eyJ1c2VyIjoiZ3Vlc3QifQ')", { hi: '{"user":"guest"}' }, "# the middle part of a JWT", "# encoding, not encryption:", "# no key, anyone can read it"], { fontSize: 13.5, title: "Console" });

  // ---- injection ----
  s = newSlide("Tamper with input: injection basics",
    "The biggest category of real web bugs, in one idea: when a site takes what you type and uses it without cleaning it, you can change what the app does.\n\n" +
    "If a search box pastes your text back into the page as HTML, typing <b>hi</b> comes back bold - the browser ran your input instead of showing it. That's cross-site scripting (XSS). The same careless-trust idea, aimed at a database, is SQL injection.\n\n" +
    "Mission 9 is a gentle, sandboxed version. The fix is always the same: treat user input as text, never as code. Clean it, escape it, don't trust it.\n\n" +
    "Say clearly: we only do this inside the CTF. Injecting into sites you don't own is a crime.", "type <b>hi</b> in a search box");
  forMission(s, [9, 10]);
  const inj = [["You type", "<b>hi</b>", "ordinary-looking input", MC[1]], ["Careless site", "shows: hi", "ran it as HTML", MC[4]], ["The idea", "input = code", "if it isn't cleaned", RED]];
  inj.forEach(([head, code, what, color], i) => {
    const x = M + i * 2.4;
    card(s, x, 1.75, 2.25, 1.9);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.75, w: 2.25, h: 0.1, fill: { color } });
    text(s, head, x + 0.2, 1.95, 1.9, 0.4, { fontSize: 14, bold: true, color });
    mono(s, code, x + 0.2, 2.4, 1.9, 0.5, { fontSize: 14, align: "center", valign: "middle" });
    text(s, what, x + 0.2, 3.05, 1.9, 0.5, { fontSize: 12, color: MUTED });
  });
  card(s, M, 3.95, 7.0, 2.55, "FFF4DC");
  text(s, "Two faces of the same mistake", M + 0.3, 4.1, 6.4, 0.4, { fontSize: 16, bold: true });
  text(s, [{ text: "XSS: ", options: { bold: true, color: MC[4] } }, { text: "your input is run as HTML/JavaScript in the page.", options: { breakLine: true } }, { text: "SQL injection: ", options: { bold: true, color: MC[9] } }, { text: "your input is run as a database query.", options: { breakLine: true } }, { text: "The fix (both): ", options: { bold: true, color: GREEN } }, { text: "treat input as text, never as code. Clean it, escape it, don't trust it." }], M + 0.3, 4.55, 6.5, 1.8, { fontSize: 15, paraSpaceAfter: 6 });
  term(s, 7.75, 1.6, 4.98, 4.9, ["$ search: apple", "You searched: apple", "$ search: <b>hi</b>", { hi: "You searched: hi  (bold!)" }, "# input was run,", "# not shown as text", " ", "# only ever in the CTF."], { fontSize: 13.5, title: "the search box" });

  // ---- when stuck ----
  s = newSlide("When you are stuck",
    "Same three-step routine as every CTF.\n\n" +
    "1. Open DevTools and look. Most flags are already in front of you: the source, a cookie, the URL, the JavaScript. Read before you touch.\n" +
    "2. Go back to the 'find where the flag hides' slide: which of the six places fits what you see?\n" +
    "3. hint N costs 5% of that mission's points, charged once per hint. Harder missions have several hints, each more direct. hint N shows the price; hint N --show buys the next one.", "F12, then look around");
  numbered(s, [
    [{ text: "Open DevTools and read. ", options: { bold: true } }, { text: "Free. The source, cookies and JS are usually enough." }],
    [{ text: "Name where it hides. ", options: { bold: true } }, { text: "Source? Cookie? URL? Token? The place names the tool." }],
    [{ text: "Change one thing. ", options: { bold: true } }, { text: "Edit the URL, a cookie, or your input - then look again." }],
    [{ text: "Buy a hint. ", options: { bold: true } }, { text: "hint N shows the price. 5% of the mission, charged once." }],
  ], M, 1.8, 6.2, 1.05, BLUE, 17);
  term(s, 7.1, 1.6, 5.63, 4.9, ["$ hint 4", "Hint 1 of 2 costs 10 points (5% of 200),", "charged once.", "To see it, type:  hint 4 --show", "$ hint 4 --show", { hi: "Hint 1 of 2: The id in the URL is" }, { hi: "input. What if you change it?" }, "# -10 points on the scoreboard"], { fontSize: 14, title: "the challenge page" });

  // ---- toolkit recap ----
  s = newSlide("Your browser toolkit",
    "One slide to photograph. Every tool, and which mission it powers. All of it is built into the browser - nothing to install.\n\n" +
    "View Source, Elements, Console, Application, Sources and the address bar are standard parts of DevTools in Chrome, Edge and Firefox.");
  const kit = [["Ctrl+U", "view the raw HTML", 1], ["F12 → Elements", "edit the live page", 2], ["Application → Cookies", "read & change cookies", 3], ["edit ?id= in the URL", "ask for another record", 4], ["/robots.txt", "find hidden paths", 5], ["F12 → Console", "run the page's JS", 6], ["F12 → Sources", "read the page's code", 7], ["atob() / base64 -d", "decode a token", 8], ["type HTML into a box", "injection basics", 9], ["robots → id → decode", "chain the steps", 10]];
  kit.forEach(([cmd, what, n], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 0.98;
    card(s, x, y, 5.96, 0.85);
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fill: { color: MC[n - 1] } });
    s.addText(String(n), { x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    mono(s, cmd, x + 0.9, y, 3.0, 0.85, { fontSize: 13.5, valign: "middle", fit: "shrink" });
    text(s, what, x + 3.95, y, 1.9, 0.85, { fontSize: 14, color: MUTED, valign: "middle" });
  });
  text(s, [{ text: "Everything here is in your browser (F12) - and has a terminal twin: ", options: { bold: true } }, { text: "curl fetches the page, grep and base64 do the rest.", options: { color: MUTED } }], M, 6.55, 12.1, 0.35, { fontSize: 14 });

  // ===========================================================================
  // PART 3: THE COMPETITION
  // ===========================================================================
  section("Part 3 · Capture a flag");
  divider(3, "Capture a flag", "Capture one flag together, then you start one yourself. Finishing every challenge is not the goal - understanding the flow is.", MC[3], "./inspect   # read, try, check, adjust",
    "Section break. This is the heart of the session: students doing it, not watching. Capture Mission 1 together, then hand it over.\n\nPut the CTF on one half of the projector and these slides on the other, or switch between them.\n\nEach mission has two slides: the brief (show it, read it, ask the three questions) and the walkthrough (reveal it after the class has tried). You will not get through all ten, and that is by design - pick the ones that fit your group.");

  // ---- the capture routine ----
  s = newSlide("The capture routine, every time",
    "Five steps, the same for every mission. Drill it now so that the only new thing in each round is the challenge.\n\n" +
    "Say it together: Inspect. Find. Change. Check. Submit.\n\n" +
    "Check is the web-specific step: readable text starting CYBA{ means you captured it. Nothing? Wrong place or wrong change - go back to Inspect and look again.");
  const routine = [["Inspect", "open DevTools, look closely.", fa.FaMagnifyingGlass, MC[1]], ["Find", "where does the flag hide?", fa.FaEye, MC[2]], ["Change", "edit the request or page.", fa.FaHand, MC[3]], ["Check", "readable? Starts CYBA{?", fa.FaCircleCheck, MC[4]], ["Submit", "paste the whole flag, Enter.", fa.FaFlag, GREEN]];
  for (let i = 0; i < routine.length; i++) {
    const [head, body, Icon, color] = routine[i];
    const x = M + i * 2.48, w = 2.2;
    card(s, x, 1.75, w, 3.5);
    await iconCircle(s, Icon, x + 0.6, 2.0, 1.0, color);
    text(s, head, x + 0.15, 3.25, w - 0.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, align: "center" });
    text(s, body, x + 0.2, 3.85, w - 0.4, 1.2, { fontSize: 15, color: MUTED, align: "center" });
    if (i < 4) s.addText(">", { x: x + w, y: 2.2, w: 0.28, h: 0.6, fontFace: MONO, fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  term(s, M, 5.5, W - 2 * M, 1.0, ["$ submit CYBA{src-3c9e01f7}   # Correct! +100 points"], { fontSize: 18 });

  // ---- the learning model ----
  s = newSlide("How we'll work through it",
    "Name the teaching loop so the room knows what to expect, and why you keep pausing to ask questions. This is the mentor's rhythm for the guided flag and for every tool demo.\n\n" +
    "Predict is the step people skip. Always ask 'what do you think this will do?' BEFORE clicking. A wrong prediction corrected by the real response sticks far better than being handed the answer.\n\n" +
    "Explain closes the loop: a student puts what happened in their own words. If they can explain it, they own it.\n\n" +
    "Watch for:\n- Ask before you tell - a question beats an answer every time.\n- Always get a prediction before trying something.\n- Let a student explain it back; that's how you know it landed.\n- Guide and connect to real work. Don't drive for students.");
  const model = [["Teach", "name the idea", MC[0]], ["Ask", "a question first", MC[1]], ["Predict", "what will happen?", MC[2]], ["Try", "make the change", MC[3]], ["Explain", "in your words", MC[4]], ["Apply", "on the next one", GREEN]];
  model.forEach(([a2, b2, color], i) => {
    const x = M + i * 2.03;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.9, w: 1.85, h: 2.55, fill: { color }, rectRadius: 0.12 });
    s.addText(String(i + 1), { x: x + 0.15, y: 3.05, w: 1.55, h: 0.45, fontFace: HEAD, fontSize: 17, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
    s.addText(a2, { x: x + 0.1, y: 3.55, w: 1.65, h: 0.8, fontFace: HEAD, fontSize: 22, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(b2, { x: x + 0.1, y: 4.45, w: 1.65, h: 0.85, fontFace: BODY, fontSize: 13, color: "FFFFFF", align: "center", valign: "top", margin: 0, isTextBox: true });
    if (i < 5) s.addText(">", { x: x + 1.83, y: 3.8, w: 0.22, h: 0.8, fontFace: MONO, fontSize: 18, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });

  // ---- the challenges map ----
  s = newSlide("The challenges",
    "The map of what is available. Leave it up for a moment and let students read the names - but set the expectation: this is a menu, not a to-do list. In one session, you capture the guided one together and students start one or two on their own.\n\n" +
    "Notice the order follows the toolkit from Part 2, and the difficulty climbs: source and cookies first, then the URL and hidden paths, then the Console and JavaScript, then tokens, injection and the final chain.\n\n" +
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
    mono(s, c.skill, x + 0.18, y + 1.95, 2.0, 0.3, { fontSize: 9.5, color: MUTED, bold: false, fit: "shrink" });
  });

  // ---- the 10 missions: brief + walkthrough ----
  function missionPair(i) {
    const c = MS[i], n = i + 1, mode = MODE[c.mode], color = MC[i], L = LEVEL[c.level];
    let s = newSlide(null, "MISSION " + n + " OF " + N + ": " + c.name + "   [" + c.level + ", " + L.pts + " points, " + c.mode + "]\n\n" +
      "Show this slide first. Read the brief out loud, then ask the three questions BEFORE anyone touches the app. Take one answer per question; do not confirm or correct yet - predicting, then checking, is where the learning happens.\n\n" + c.notes);
    chip(s, "Mission " + n + " of " + N, M, 0.48, 2.0, color, WHITE, 14);
    levelChip(s, c.level, M + 2.15, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n);
    s.addText(c.name, { x: M, y: 1.0, w: W - 2 * M, h: 0.95, fontFace: HEAD, fontSize: 42, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.1, w: 7.05, h: 4.4, fill: { color: TERM }, rectRadius: 0.12, shadow: { type: "outer", color: "12213A", opacity: 0.22, blur: 10, offset: 3, angle: 90 } });
    s.addText("# the brief", { x: M + 0.4, y: 2.3, w: 4, h: 0.4, fontFace: MONO, fontSize: 15, color: T_NOTE, margin: 0, isTextBox: true });
    s.addText(c.brief, { x: M + 0.4, y: 2.8, w: 6.25, h: 2.25, fontFace: BODY, fontSize: 21, color: WHITE, margin: 0, valign: "top", isTextBox: true, fit: "shrink" });
    s.addText(c.where, { x: M + 0.4, y: 5.1, w: 6.3, h: 0.35, fontFace: MONO, fontSize: 13, color: T_OUT, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fill: { color: AMBER }, rectRadius: 0.08 });
    s.addText([{ text: "Tool: ", options: { fontFace: BODY } }, { text: c.skill, options: { fontFace: MONO, bold: true } }], { x: M + 0.4, y: 5.65, w: 3.6, h: 0.55, fontSize: 13, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fill: { color: "2B3B5C" }, rectRadius: 0.08 });
    s.addText("+" + L.pts + " points", { x: M + 4.2, y: 5.65, w: 2.45, h: 0.55, fontFace: MONO, fontSize: 16, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, 7.95, 2.1, 4.78, 3.05);
    text(s, "Before anyone touches it", 8.25, 2.25, 4.2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true });
    bullets(s, c.ask, 8.25, 2.8, 4.25, 2.3, { fontSize: 15, paraSpaceAfter: 7 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.95, y: 5.35, w: 4.78, h: 1.15, fill: { color: mode.color }, rectRadius: 0.1 });
    s.addText(c.mode, { x: 8.2, y: 5.35, w: 1.7, h: 1.15, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
    s.addText(mode.what, { x: 9.95, y: 5.35, w: 2.6, h: 1.15, fontFace: BODY, fontSize: 13.5, color: WHITE, valign: "middle", margin: 0, isTextBox: true });

    s = newSlide(null, "WALKTHROUGH " + n + " OF " + N + ": " + c.name + "\n\n" +
      (c.mode === "You do" ? "Independent mission: reveal this slide only after students have tried, or when the room is stuck. Not everyone needs to reach it - one captured flag is a win.\n\n" : "Guided mission: capture it live with the class calling out each move, then use this slide to recap.\n\n") +
      "The slide never shows a real flag: every computer has its own ids, tokens and flags, so students still have to do the steps themselves.\n\n" +
      "Ask one student to explain the three steps in their own words. Offer the stretch question to anyone who finished early.\n\n" + c.notes);
    chip(s, "Walkthrough " + n + " of " + N, M, 0.48, 2.3, color, WHITE, 14);
    levelChip(s, c.level, M + 2.45, 0.48, 2.0, 13);
    trail(s, 7.4, 0.52, 5.33, n);
    s.addText("Capturing " + c.name, { x: M, y: 0.98, w: W - 2 * M, h: 0.7, fontFace: HEAD, fontSize: 30, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
    term(s, M, 1.85, 7.35, 3.5, c.term, { fontSize: c.fs || 14, title: "web.ctf (browser path)" });
    // ---- the terminal path: the curl equivalent (hybrid: browser + terminal) ----
    {
      const ty = 5.5, th = 0.98, twin = c.twin || [];
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: ty, w: 7.35, h: th, fill: { color: "0B1322" }, rectRadius: 0.1, line: { color: GREEN, width: 1 } });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M + 0.18, y: ty + 0.32, w: 1.3, h: 0.34, fill: { color: GREEN }, rectRadius: 0.17 });
      s.addText("TERMINAL", { x: M + 0.18, y: ty + 0.32, w: 1.3, h: 0.34, fontFace: BODY, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
      const truns = [];
      twin.forEach((line, i) => {
        const last = i === twin.length - 1;
        if (line.startsWith("$ ")) {
          const [cmd, note] = line.slice(2).split("   # ");
          truns.push({ text: "$ ", options: { color: T_PROMPT, bold: true } });
          truns.push({ text: cmd, options: { color: T_CMD, bold: true, breakLine: !last && !note } });
          if (note) truns.push({ text: "   # " + note, options: { color: T_NOTE, breakLine: !last } });
        } else {
          truns.push({ text: line, options: { color: T_OUT, breakLine: !last } });
        }
      });
      s.addText(truns, { x: M + 1.62, y: ty, w: 5.6, h: th, fontFace: MONO, fontSize: 11.5, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    }
    text(s, "What just happened", 8.25, 1.85, 4.4, 0.4, { fontFace: HEAD, fontSize: 18, bold: true });
    numbered(s, c.happened, 8.25, 2.4, 4.48, 0.86, color, 14);
    card(s, 8.25, 5.0, 4.48, 0.82, "FFF4DC");
    text(s, [{ text: "Real world: ", options: { bold: true } }, { text: c.real }], 8.42, 5.0, 4.16, 0.82, { fontSize: 12.5, valign: "middle", fit: "shrink" });
    card(s, 8.25, 5.92, 4.48, 0.62);
    text(s, [{ text: "Stretch: ", options: { bold: true, color } }, { text: c.stretch }], 8.42, 5.92, 4.16, 0.62, { fontSize: 11.5, valign: "middle", fit: "shrink" });
    text(s, "IDs, tokens and flags change on every computer.", M, 6.58, 7.35, 0.3, { fontSize: 11, color: MUTED });
  }

  // ---- guided application: missions 1-2 ----
  section("Guided application");
  missionPair(0);
  missionPair(1);

  // ---- independent application ----
  section("Independent application");
  s = newSlide("Now you try",
    "This is the heart of the session. Point students at the CTF and let them start a challenge on their OWN. Say clearly: you do NOT have to finish, and you do NOT have to do them in order. Pick one that looks interesting and run the loop: read, observe, try, check, adjust.\n\n" +
    "Walk the room. Ask questions instead of answering them: 'Where do you think the flag hides?' 'What did the response say?' 'What would you change next?' Resist driving for students.\n\n" +
    "The remaining challenges (3-10) are in the mentor appendix as a bank: pull one up if the room wants a nudge, or leave them for self-study. Finishing them is not the goal - confidence starting one is.\n\n" +
    "Mentor: one flag captured, understood, and explained back beats ten rushed. Celebrate the process, not the leaderboard.");
  text(s, "Pick a challenge and run the loop. You don't have to finish - starting is the win.", M, 1.55, W - 2 * M, 0.5, { fontSize: 18, color: MUTED });
  const menu = [["Read the page's source", "Ctrl+U", MC[0]], ["Inspect a hidden element", "F12 → Elements", MC[2]], ["Read & edit a cookie", "Application", MC[3]], ["Change an id in the URL", "?id=2", MC[4]], ["Run the page's JavaScript", "F12 → Console", "5B6EE1"], ["Decode a token", "atob('...')", "0F9488"]];
  menu.forEach(([what, cmd, color], i) => {
    const x = M + (i % 3) * 4.11, y = 2.25 + Math.floor(i / 3) * 1.65;
    card(s, x, y, 3.9, 1.4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.12, h: 1.4, fill: { color } });
    text(s, what, x + 0.35, y + 0.22, 3.4, 0.6, { fontSize: 16.5, bold: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.35, y: y + 0.82, w: 2.6, h: 0.42, fill: { color: TERM }, rectRadius: 0.08 });
    s.addText(cmd, { x: x + 0.35, y: y + 0.82, w: 2.6, h: 0.42, fontFace: MONO, fontSize: 12.5, bold: true, color: T_PROMPT, align: "center", valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
  });

  section("Part 3 · Wrapping up");
  // ---- side quests ----
  s = newSlide("Side quests: for anyone who wants more",
    "No flags and no points: teams compare answers out loud.\n\n" +
    "Comment hunt: open View Source on three real websites you use. Who finds the most interesting HTML comment a developer left behind?\n\n" +
    "Cookie census: open Application → Cookies on a site you're logged into. How many cookies is it storing on you? Can you guess what any of them do?\n\n" +
    "Token reader: find a base64 string anywhere (a token, a data URL) and decode it with atob() in the Console. What was inside?\n\n" +
    "Spot the trust: look at any form online. What stops you from changing the hidden fields before you submit? (On a careless site: nothing.)");
  const side = [
    ["Comment hunt", "any site", "View Source on three sites you use. Who finds the most interesting developer comment?", "Ctrl+U  ->  find <!-- -->"],
    ["Cookie census", "any login", "How many cookies does a site store on you? Can you guess what they do?", "Application -> Cookies"],
    ["Token reader", "Console", "Find a base64 string and decode it. What was hidden inside?", "atob('eyJ...')"],
    ["Spot the trust", "any form", "What stops you editing a hidden field before submitting? On a careless site: nothing.", "F12 -> Elements -> edit"],
  ];
  side.forEach(([name, where, brief, tools], i) => {
    const x = M + (i % 2) * 6.17, y = 1.65 + Math.floor(i / 2) * 2.45;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.96, h: 2.25, fill: { color: TERM }, rectRadius: 0.12 });
    s.addText(name, { x: x + 0.35, y: y + 0.2, w: 3.8, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: WHITE, margin: 0, isTextBox: true });
    s.addText(where, { x: x + 4.0, y: y + 0.25, w: 1.7, h: 0.4, fontFace: MONO, fontSize: 12, color: T_NOTE, align: "right", margin: 0, isTextBox: true });
    s.addText(brief, { x: x + 0.35, y: y + 0.8, w: 5.3, h: 0.85, fontFace: BODY, fontSize: 16, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
    s.addText([{ text: "> ", options: { color: T_PROMPT } }, { text: tools, options: { color: AMBER } }], { x: x + 0.35, y: y + 1.68, w: 5.3, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, margin: 0, isTextBox: true });
  });

  // ===========================================================================
  // PART 4: REFLECTION
  // ===========================================================================
  section("Part 4 · Reflection");
  divider(4, "Reflection", "CTF web bugs vs the real web, what you just did, who gets paid to do it, and how to keep going.", MC[4], "echo 'the fix is: never trust the client'",
    "Section break. Applaud the fastest teams, and also the team that got unstuck the most times.\n\nFun closer: have everyone open the Console and type  console.log('nice work!')  - their first line of JavaScript.");

  // ---- CTF vs real ----
  s = newSlide("CTF web bugs vs the real web",
    "The most important takeaway: every bug today is a real category of web vulnerability, just made easy and safe. These exact mistakes show up in real apps - that's why companies pay people to find them.\n\n" +
    "Point at the OWASP connection: broken access control (missions 3, 4), security misconfiguration (mission 5), and injection (mission 9) are near the top of the real-world OWASP Top 10.\n\n" +
    "And the single fix behind almost all of them: never trust the client. Check on the server, clean every input, don't ship secrets to the browser.\n\n" +
    "Ask: 'After today, would you trust a website that checks your password in JavaScript?'");
  const vs = [["Today's challenges", "Hidden fields, cookie roles, ?id=, robots.txt, client-side logins", "Made easy and safe - but every one is a real bug class.", MC[1]], ["The real web", "The same bugs, in real apps - the OWASP Top 10", "Found and fixed by security testers every day. The fix: don't trust the client.", GREEN]];
  vs.forEach(([head, ex, verdict, color], i) => {
    const x = M + i * 6.17;
    card(s, x, 1.65, 5.96, 2.5);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 5.96, h: 0.12, fill: { color } });
    text(s, head, x + 0.35, 1.95, 5.3, 0.5, { fontFace: HEAD, fontSize: 24, bold: true, color });
    text(s, ex, x + 0.35, 2.55, 5.3, 0.9, { fontSize: 14, color: INK });
    text(s, verdict, x + 0.35, 3.35, 5.3, 0.8, { fontSize: 15, color: MUTED });
  });
  text(s, "The real bugs behind the missions", M, 4.45, 8, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  const how = [["Broken access control", "Missions 3 & 4: a cookie or a URL id, trusted."], ["Misconfiguration", "Mission 5: a secret path, left findable in robots.txt."], ["Injection", "Mission 9: user input, used without cleaning."]];
  how.forEach(([head, body], i) => {
    const x = M + i * 4.11;
    card(s, x, 5.0, 3.9, 1.5, "FFF4DC");
    text(s, head, x + 0.3, 5.12, 3.4, 0.45, { fontSize: 17, bold: true });
    text(s, body, x + 0.3, 5.6, 3.4, 0.8, { fontSize: 14, color: MUTED });
  });

  // ---- skill passport ----
  s = newSlide("Your skill passport",
    "A visual receipt for the session, in mission order. Each stamp is a technique the class used today.\n\n" +
    "Ask students to count the stamps they earned.");
  const stamps = [["View Source", 1], ["HTML comments", 1], ["Inspect", 2], ["hidden fields", 2], ["edit cookies", 3], ["access control", 3], ["URL tampering", 4], ["IDOR", 4], ["robots.txt", 5], ["Console", 6], ["run page JS", 6], ["read the JS", 7], ["decode base64", 8], ["read a JWT", 8], ["injection / XSS", 9], ["chain the steps", 10], ["DevTools", 0], ["never trust client", 0]];
  stamps.forEach(([cmd, n], i) => {
    const x = M + (i % 6) * 2.04, y = 1.65 + Math.floor(i / 6) * 1.6, color = n ? MC[n - 1] : MUTED;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.88, h: 1.42, fill: { color: WHITE }, rectRadius: 0.12, line: { color, width: 2.5, dashType: "dash" } });
    mono(s, cmd, x + 0.05, y + 0.2, 1.78, 0.6, { fontSize: cmd.length > 11 ? 12 : 15, color, align: "center", valign: "middle", fit: "shrink" });
    text(s, n ? "Mission " + n : "Every mission", x, y + 0.9, 1.88, 0.35, { fontSize: 12, color: MUTED, align: "center" });
  });
  text(s, "Eighteen web security skills, used in a real browser, in one session.", M, 6.6, W - 2 * M, 0.35, { fontSize: 15, bold: true });

  // ---- the job ----
  s = newSlide("What you just did is the job",
    "Connect the missions to real work. Ask the questions on the right and let students answer before you do.\n\n" +
    "Mentors: share one real story (unclassified and non-sensitive) of meeting a web bug, a code review, or a security test at work.");
  const jobs = [[fa.FaBug, "Find the bug", "Penetration testers and bug-bounty hunters look for exactly these flaws, with permission", MC[0]], [fa.FaUserShield, "Fix the trust", "Engineers move every real check onto the server and clean all input", MC[8]], [fa.FaMagnifyingGlass, "Review the code", "Security reviewers read source and JavaScript for leaked secrets and bad checks", MC[6]], [fa.FaShieldHalved, "Build it right", "Developers ship apps that never trust the client, using tested frameworks", MC[2]]];
  for (let i = 0; i < jobs.length; i++) {
    const [Icon, cmd, job, color] = jobs[i];
    const y = 1.7 + i * 1.2;
    await iconCircle(s, Icon, M, y, 0.8, color);
    text(s, cmd, M + 1.05, y, 6, 0.4, { fontSize: 18, bold: true });
    text(s, job, M + 1.05, y + 0.42, 6.2, 0.6, { fontSize: 15, color: MUTED });
  }
  card(s, 8.1, 1.7, 4.63, 4.75);
  text(s, "Ask the room", 8.45, 1.95, 4, 0.45, { fontFace: HEAD, fontSize: 20, bold: true });
  bullets(s, ["Which mission surprised you most? Why?", "Which bug was 'the server trusted me' rather than a clever trick?", "Why is a password check in JavaScript a bad idea?", "Where have you seen a cookie or a token in real life?"], 8.45, 2.6, 4.0, 3.6, { fontSize: 16, paraSpaceAfter: 11 });

  // ---- keep going ----
  s = newSlide("Keep climbing",
    "Close with what students can do tomorrow, for free.\n\n" +
    "CyberQuest Academy is where the next challenges live: fill in the link. The Web CTF works at home on any computer; every replay has new flags. OWASP Juice Shop is a free, legal practice app made of deliberately vulnerable pages - perfect for safe, hands-on learning.\n\n" +
    "Remind them of the rule one more time: only ever test sites you own or are given permission to test. Then thank the class and the teacher.");
  const next = [["Next: CyberQuest", "[CyberQuest Academy link]", "More CTFs, live scoreboards and harder missions are waiting for you there.", MC[2]], ["Replay the Web CTF", "[your CTF link]/web/", "Works at home. New flags on every replay. Beat your time.", MC[3]], ["OWASP Juice Shop", "owasp.org/www-project-juice-shop", "A free, legal, deliberately broken app built just for practice.", MC[4]]];
  next.forEach(([head, where, body, color], i) => {
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.3);
    text(s, head, x + 0.3, 1.95, 3.4, 0.5, { fontFace: HEAD, fontSize: 20, bold: true, color });
    mono(s, where, x + 0.3, 2.55, 3.4, 0.5, { fontSize: 12.5, color: INK, fit: "shrink" });
    text(s, body, x + 0.3, 3.15, 3.3, 1.7, { fontSize: 16, color: MUTED });
  });
  card(s, M, 5.3, W - 2 * M, 1.15, "FFF4DC");
  text(s, [{ text: "The one rule: ", options: { bold: true } }, { text: "only ever test apps you own or have permission to test. In a CTF you have permission. Everywhere else, get it first." }], M + 0.35, 5.3, W - 2 * M - 0.7, 1.15, { fontSize: 17, valign: "middle" });

  // ===========================================================================
  // MENTOR APPENDIX
  // ===========================================================================
  section("Mentor appendix");

  s = darkSlide("Mentor appendix: reference for whoever runs the room - the page layout, how the challenges work under the hood, how to open the CTF, the answer key, and fixes for the usual snags. Not student-facing.");
  s.addText("Mentor", { x: M, y: 1.5, w: 11, h: 1.0, fontFace: HEAD, fontSize: 40, bold: true, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText("Appendix", { x: M, y: 2.35, w: 11, h: 1.6, fontFace: HEAD, fontSize: 92, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("The page layout, the mechanics, the answer key, and what to do when things go wrong.", { x: M, y: 4.15, w: 10.5, h: 1.0, fontFace: BODY, fontSize: 22, color: T_OUT, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.35, w: W - 2 * M, h: 0.9, fill: { color: "162238" }, rectRadius: 0.1 });
  s.addText([{ text: "$ ", options: { color: T_PROMPT, bold: true } }, { text: "man mentor   # for the person running the room", options: { color: WHITE, bold: true } }], { x: M + 0.35, y: 5.35, w: W - 2 * M - 0.7, h: 0.9, fontFace: MONO, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });

  // ---- anatomy of the page (drawn mock, no screenshot) ----
  s = newSlide("Anatomy of the Web CTF page",
    "A map of the page, drawn here rather than a screenshot so it stays current. It is the same shell as the Linux and Crypto CTFs: a challenge panel on the left, a live browser frame on the right, and the scoreboard across the top.\n\n" +
    "Walk the eight parts. The 'Web CTF' tag is top left; the links to the other CTFs switch games (they start a new game, so don't click mid-race).\n\n" +
    "The most common snag in class is forgetting DevTools: students read the challenge, then stare at the rendered page. Say it twice - open F12 first.");
  // drawn browser mock
  const mx = M - 0.05, my = 1.6, mw = 7.3, mh = 4.5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx, y: my, w: mw, h: mh, fill: { color: WHITE }, rectRadius: 0.08, line: { color: LINE, width: 1.5 }, shadow: { type: "outer", color: "12213A", opacity: 0.15, blur: 10, offset: 3, angle: 90 } });
  // top scoreboard bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 0.15, y: my + 0.15, w: mw - 0.3, h: 0.55, fill: { color: "11213E" }, rectRadius: 0.06 });
  s.addText("CyberQuest · Web CTF", { x: mx + 0.3, y: my + 0.15, w: 2.6, h: 0.55, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
  s.addText("1240 pts   ·   04:12", { x: mx + mw - 2.7, y: my + 0.15, w: 2.4, h: 0.55, fontFace: MONO, fontSize: 12, bold: true, color: T_PROMPT, align: "right", valign: "middle", margin: 0, isTextBox: true });
  // progress track
  for (let i = 0; i < 10; i++) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 0.3 + i * 0.52, y: my + 0.82, w: 0.42, h: 0.16, fill: { color: i < 3 ? MC[i] : "D6DEEA" }, rectRadius: 0.04 });
  // left challenge panel
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 0.3, y: my + 1.15, w: 3.0, h: mh - 1.45, fill: { color: "F1F5FB" }, rectRadius: 0.06 });
  s.addText("Mission 4 · Tamper with the URL", { x: mx + 0.45, y: my + 1.3, w: 2.7, h: 0.5, fontFace: HEAD, fontSize: 11, bold: true, color: INK, valign: "top", margin: 0, isTextBox: true });
  s.addText("You can see record ?id=1.\nThe flag is on another.", { x: mx + 0.45, y: my + 1.85, w: 2.7, h: 0.8, fontFace: BODY, fontSize: 10, color: MUTED, margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 0.45, y: my + 2.75, w: 1.5, h: 0.35, fill: { color: AMBER }, rectRadius: 0.05 });
  s.addText("Easy · 100", { x: mx + 0.45, y: my + 2.75, w: 1.5, h: 0.35, fontFace: BODY, fontSize: 9, bold: true, color: INK, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 0.45, y: my + 3.25, w: 2.7, h: 0.45, fill: { color: "0E1726" }, rectRadius: 0.05 });
  s.addText("submit CYBA{...}", { x: mx + 0.6, y: my + 3.25, w: 2.5, h: 0.45, fontFace: MONO, fontSize: 10, bold: true, color: T_PROMPT, valign: "middle", margin: 0, isTextBox: true });
  // right live frame with address bar + devtools
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 3.5, y: my + 1.15, w: 3.5, h: 0.4, fill: { color: "E4EAF3" }, rectRadius: 0.05 });
  s.addText("web.ctf/mission4/?id=1", { x: mx + 3.65, y: my + 1.15, w: 3.2, h: 0.4, fontFace: MONO, fontSize: 10, color: INK, valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 3.5, y: my + 1.65, w: 3.5, h: 1.3, fill: { color: WHITE }, line: { color: LINE, width: 1 }, rectRadius: 0.05 });
  s.addText("Your profile (guest)", { x: mx + 3.65, y: my + 1.8, w: 3.2, h: 0.9, fontFace: BODY, fontSize: 11, color: MUTED, valign: "top", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx + 3.5, y: my + 3.05, w: 3.5, h: 1.25, fill: { color: "0E1726" }, rectRadius: 0.05 });
  s.addText("DevTools", { x: mx + 3.65, y: my + 3.12, w: 3.2, h: 0.3, fontFace: MONO, fontSize: 9, color: T_NOTE, margin: 0, isTextBox: true });
  s.addText([{ text: "> ", options: { color: T_PROMPT } }, { text: "document.cookie", options: { color: WHITE } }], { x: mx + 3.65, y: my + 3.42, w: 3.2, h: 0.75, fontFace: MONO, fontSize: 10, bold: true, valign: "top", margin: 0, isTextBox: true });
  // pins
  const pins = [[mx + 1.5, my + 0.42], [mx + mw - 1.5, my + 0.42], [mx + 0.55, my + 0.9], [mx + 1.6, my + 1.5], [mx + 1.2, my + 2.92], [mx + 2.0, my + 3.47], [mx + 5.2, my + 1.35], [mx + 5.2, my + 3.6]];
  pins.forEach(([px, py], i) => {
    const col = [MC[1], AMBER, MC[0], MC[2], MC[4], MC[3], BLUE, "56657E"][i];
    s.addShape(pres.shapes.OVAL, { x: px - 0.17, y: py - 0.17, w: 0.34, h: 0.34, fill: { color: col }, line: { color: WHITE, width: 2 } });
    s.addText(String(i + 1), { x: px - 0.17, y: py - 0.17, w: 0.34, h: 0.34, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  text(s, "A drawn map - the live page may differ slightly.", M, 6.2, 7, 0.3, { fontSize: 11, color: MUTED });
  const parts8 = [["Game tag", "Web CTF; links switch games.", MC[1]], ["Points", "Your score; adds up per flag.", AMBER], ["Progress track", "One bar lights up per flag.", MC[0]], ["Challenge panel", "The brief, level and submit box.", MC[2]], ["Level & points", "Easy 100 up to Very Hard 800.", MC[4]], ["Submit", "Paste the whole flag here.", MC[3]], ["Address bar", "The URL - editable input.", BLUE], ["DevTools", "F12: your main tool.", "56657E"]];
  parts8.forEach(([head, body, color], i) => {
    const y = 1.62 + i * 0.6;
    s.addShape(pres.shapes.OVAL, { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fill: { color } });
    s.addText(String(i + 1), { x: 8.1, y: y + 0.05, w: 0.36, h: 0.36, fontFace: HEAD, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, [{ text: head + "  ", options: { bold: true, fontSize: 15 } }, { text: body, options: { fontSize: 13, color: MUTED } }], 8.6, y, 4.15, 0.5, { valign: "middle" });
  });

  s = newSlide("Mentor appendix: how the Web CTF works",
    "MENTOR READING. The Web CTF lives in the same GitLab project as the Linux and Crypto CTFs, in public/web/. It reuses the same page shell and scoreboard; only the challenges differ.\n\n" +
    "Each challenge is a small, self-contained page served inside the CTF. On every load the server generates random flags, random record ids (mission 4), a random hidden path (mission 5), a random login password (mission 7), and random tokens (missions 8, 10). Only SHA-256 hashes of the flags are kept, so there is no answer file.\n\n" +
    "Everything runs client-side in the browser, so there is nothing to install and no backend to host: the 'server' behaviour is simulated in the page, which is why it works from GitLab Pages on a Chromebook.\n\n" +
    "Rebuild after editing challenges: python3 guest-web/make-web.py, then guest-web/build.sh.");
  const lq = [[fa.FaWindowMaximize, "A real browser", "DevTools is the whole toolkit: nothing extra to install.", MC[1]], [fa.FaKey, "New flags every load", "Random flags, ids, paths, passwords and tokens. No answer file.", MC[3]], [fa.FaLaptop, "Nothing to install", "One link: your Pages address + /web/. No accounts.", MC[4]]];
  for (let i = 0; i < lq.length; i++) {
    const [Icon, head, body, color] = lq[i];
    const x = M + i * 4.11;
    card(s, x, 1.7, 3.9, 3.35);
    await iconCircle(s, Icon, x + 0.3, 1.95, 0.95, color);
    text(s, head, x + 0.3, 3.1, 3.3, 0.5, { fontFace: HEAD, fontSize: 22, bold: true });
    text(s, body, x + 0.3, 3.65, 3.3, 1.3, { fontSize: 16, color: MUTED });
  }
  text(s, "Under the hood", M, 5.35, 3, 0.35, { fontSize: 14, bold: true, color: MUTED });
  const hood = [["Your browser", "E4EAF3", MUTED], ["the CTF page shell", MC[2], WHITE], ["10 challenge pages", MC[3], WHITE], ["simulated server logic", MC[4], WHITE], ["random flags & tokens", AMBER, INK]];
  let hx = M;
  hood.forEach(([name, fill, ink], i) => { const w = name.length * 0.095 + 0.5; chip(s, name, hx, 5.8, w, fill, ink, 12.5); hx += w + 0.12; if (i < hood.length - 1) { s.addText(">", { x: hx - 0.12, y: 5.8, w: 0.12, h: 0.38, fontFace: MONO, fontSize: 12, bold: true, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true }); hx += 0.06; } });
  text(s, "Source: public/web/ (page) and guest-web/ (challenges, tokens, flag logic).", M, 6.4, 11.5, 0.35, { fontSize: 13, color: MUTED });

  s = newSlide("Mentor appendix: open the Web CTF",
    "MENTOR READING: run this with students right before Part 2, so every device is ready for the Try it pills.\n\n" +
    "WRITE YOUR ADDRESS IN THE BOX before presenting. It is your GitLab Pages address with /web/ on the end. The Linux and Crypto CTF pages also link to it in their headers.\n\n" +
    "Most important rule: do not reload a challenge mid-capture. A reload builds a new page with new flags and ids, and resets the clock and points.");
  numbered(s, [
    [{ text: "Open Chrome ", options: { bold: true } }, { text: "and type the address from the box on the right." }],
    [{ text: "Wait for it to load. ", options: { bold: true } }, { text: "The challenge list appears when it's ready." }],
    [{ text: "Press F12. ", options: { bold: true } }, { text: "Open DevTools now - it's the tool for every mission." }],
    [{ text: "Don't reload mid-capture. ", options: { bold: true } }, { text: "Reloading means new flags, zero points and a reset clock." }],
  ], M, 1.85, 6.6, 1.1, BLUE, 18);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.7, y: 1.7, w: 5.03, h: 3.2, fill: { color: TERM }, rectRadius: 0.12 });
  s.addText("Web CTF address", { x: 7.7, y: 1.9, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 16, color: T_OUT, align: "center", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fill: { color: "162238" }, rectRadius: 0.08, line: { color: AMBER, width: 2, dashType: "dash" } });
  s.addText("your-group.gitlab.io/.../web/", { x: 8.1, y: 2.55, w: 4.23, h: 1.5, fontFace: MONO, fontSize: 17, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Type it exactly. One computer per pair.", { x: 7.7, y: 4.2, w: 5.03, h: 0.4, fontFace: BODY, fontSize: 14, color: T_NOTE, align: "center", margin: 0, isTextBox: true });
  card(s, 7.7, 5.15, 5.03, 1.3, "FFF4DC");
  text(s, [{ text: "Open DevTools first. ", options: { bold: true } }, { text: "Every mission starts with F12. Make it a reflex before students read the brief." }], 8.0, 5.15, 4.5, 1.3, { valign: "middle", fontSize: 15 });

  s = newSlide("Mentor appendix: answer key",
    "FOR MENTORS. Hide this slide when presenting.\n\n" +
    "Flags, ids, hidden paths, passwords and tokens are random on every page load and the CTF keeps only fingerprints, so there is no list of flags: play each mission yourself before class.\n\n" +
    "Mission 7 passwords come from a small word+number list; Mission 5 hidden path and Mission 4 target id are random each load.\n\n" +
    "Most captures are a DevTools action, not a typed command - the 'answer' column is the move to make.");
  const key = [].concat(MS.map((c, i) => [String(i + 1), c.name, c.answer, c.level + " · " + LEVEL[c.level].pts, MC[i]])).concat([
    ["+", "Comment hunt", "View Source on real sites; find developer comments", "side quest", MUTED],
    ["+", "Token reader", "atob('<base64>') in the Console", "side quest", MUTED],
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
    "Most problems are the same as the other CTFs: the school web filter, Pages visibility, or forgetting to open DevTools. The web-specific ones are below.\n\n" +
    "Plan B if most devices can't load it: drive the CTF on the projector and run the competition as 'We do', with teams racing to call out the next move.");
  const fixes = [
    ["No 'View Source' on right-click", "Use Ctrl+U, or F12 then scroll to the top of the Elements panel."],
    ["DevTools won't open", "Press F12, or Ctrl+Shift+I. On a locked Chromebook, use the ⋮ menu → More tools → Developer tools."],
    ["Edited the page but nothing happened", "Elements edits are local and undone by reload. For cookies/URL, the change must be re-sent: reload or re-request."],
    ["Console says 'getFlag is not defined'", "Wrong page, or typed before it loaded. Re-run on the mission's own tab after it's ready."],
    ["atob() gives gibberish", "It's not base64, or you grabbed extra characters. Copy only the token's middle part."],
    ["'Incorrect flag'", "Copy the whole flag, CYBA{ to }. Flags from another computer never work."],
    ["Reloaded a challenge by accident", "New flags and ids; points and clock reset. The second run is fast."],
    ["Injection box shows the tags as text", "That page is doing it right (escaping). Use the mission's own vulnerable box."],
  ];
  fixes.forEach(([problem, fix], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 1.24;
    card(s, x, y, 5.96, 1.1);
    text(s, problem, x + 0.25, y + 0.1, 5.5, 0.35, { fontSize: 14.5, bold: true, color: RED });
    text(s, fix, x + 0.25, y + 0.45, 5.5, 0.6, { fontSize: 12, color: INK });
  });

  section("Mentor appendix · Mission bank");
  s = newSlide("Mission bank: missions 3-10",
    "A reference bank, not a checklist. Missions 1 and 2 are the guided example in the main deck; these eight are here for independent work and self-study.\n\nPull one up when a student wants a nudge on a challenge they chose, or share the deck afterward. In a one-hour session you will not show most of these live - and that's the point.\n\nEach mission has a brief (the clue and three questions) and a walkthrough (one correct path). Flags differ on every computer, so walkthroughs are safe to show.");
  text(s, "Each has a brief (clue + questions) and a walkthrough (one path). Pull up whatever a student needs.", M, 2.0, W - 2 * M, 0.6, { fontSize: 18, color: MUTED });
  MS.slice(2).forEach((c, i) => {
    const x = M + (i % 4) * 3.08, y = 2.9 + Math.floor(i / 4) * 1.75;
    card(s, x, y, 2.85, 1.5);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: MC[i + 2] } });
    s.addText(String(i + 3), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    text(s, c.name, x + 0.9, y + 0.22, 1.85, 0.6, { fontSize: 14, bold: true, valign: "middle" });
    levelChip(s, c.level, x + 0.25, y + 0.9, 1.75, 9.5);
    mono(s, c.skill, x + 2.05, y + 0.92, 0.7, 0.3, { fontSize: 8.5, color: MUTED, bold: false, fit: "shrink" });
  });
  for (let i = 2; i < MS.length; i++) missionPair(i);

  const TOTAL = PAGES.length;
  PAGES.forEach(({ s, dark }, idx) => {
    s.addText(DECK + "   ·   " + (idx + 1) + " / " + TOTAL, { x: W - M - 3.4, y: 7.0, w: 3.4, h: 0.3, fontFace: BODY, fontSize: 10, color: dark ? T_NOTE : MUTED, align: "right", valign: "middle", margin: 0, isTextBox: true });
  });

  const out = path.join(__dirname, "CyberQuest-Web-CTF.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out, "slides:", slideNo);
}

build().catch((e) => { console.error(e); process.exit(1); });
