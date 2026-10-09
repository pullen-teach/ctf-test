"""Make public/crypto/lite.js from public/lite.js: same shell, crypto world and tools."""
import re
W = '/home/claude/linux-quest-web/'
s = open(W + 'public/lite.js').read()
def sub(o, n):
    global s
    assert o in s, o[:80]
    s = s.replace(o, n, 1)

sub('// Linux Quest "lite mode": a simulated Linux shell in plain JavaScript.',
    '// CyberQuest Crypto CTF "lite mode": the same simulated shell as the Linux CTF,\n// with the crypto missions and tools (tr, xxd, caesar, morse, xor, vigenere, hashlines).\n// Made from public/lite.js by guest-crypto/make-lite.py; regenerate rather than edit.')

# ---- crypto helpers (module scope)
HELPERS = r'''
  // ---------------------------------------------------------------- crypto helpers
  const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", LO = "abcdefghijklmnopqrstuvwxyz";
  function shiftChar(c, k) {
    let p = UP.indexOf(c);
    if (p >= 0) return UP[((p + k) % 26 + 26) % 26];
    p = LO.indexOf(c);
    return p >= 0 ? LO[((p + k) % 26 + 26) % 26] : c;
  }
  const caesarShift = (t, k) => Array.from(t, (c) => shiftChar(c, k)).join("");
  const atbash = (t) => Array.from(t, (c) => { let p = UP.indexOf(c); if (p >= 0) return UP[25 - p]; p = LO.indexOf(c); return p >= 0 ? LO[25 - p] : c; }).join("");
  function vigenereText(t, key, dir) {
    const k = key.toUpperCase().replace(/[^A-Z]/g, "");
    if (!k) return t;
    let j = 0;
    return Array.from(t, (c) => {
      if (!/[A-Za-z]/.test(c)) return c;
      const out = shiftChar(c, dir * UP.indexOf(k[j % k.length]));
      j++;
      return out;
    }).join("");
  }
  const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
  const DEMORSE = Object.fromEntries(Object.entries(MORSE).map(([a, b]) => [b, a]));
  const morseLine = (l) => Array.from(l.toUpperCase()).map((c) => (c === " " ? "/" : MORSE[c])).filter(Boolean).join(" ");
  const demorseLine = (l) => l.split(" ").filter((t) => t !== "").map((t) => (t === "/" ? " " : DEMORSE[t] || "?")).join("");
  const toBytes = (t) => Array.from(enc.encode(t));
  const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const wrapHex = (h, w) => (h.match(new RegExp(".{1," + w + "}", "g")) || []).join("\n") + "\n";
  const fromHex = (t) => { const h = t.toLowerCase().replace(/[^0-9a-f]/g, ""); const out = []; for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16)); return out; };
  const showByte = (v) => (v >= 32 && v <= 126 ? String.fromCharCode(v) : ".");
  function expandSet(set) {
    let out = "", s = set.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    for (let i = 0; i < s.length; i++) {
      if (s[i + 1] === "-" && i + 2 < s.length) { const a = s.charCodeAt(i), b = s.charCodeAt(i + 2); for (let c = a; c <= b; c++) out += String.fromCharCode(c); i += 2; }
      else out += s[i];
    }
    return out;
  }
'''
sub('  // --------------------------------------------------------------- the shell', HELPERS + '\n  // --------------------------------------------------------------- the shell')

# ---- the crypto world: replace the missions part of buildWorld
a = s.index('    // 1: make your move.')
b = s.index('\n  }\n', a)
WORLD = r'''    // Home: the game instructions, and the warm-up (Mission 0) at the bottom of orientation.txt.
    const readme = (dir, key, clue) => put(dir + "/README.txt", mkfile((clue ? clue + "\n" : "") + README_TEXT[key], 0o644, USER));
    const file = (p, d) => put(H + "/" + p, mkfile(d, 0o644, USER));
    const room = (n, clue) => { put(H + "/mission" + n, mkdir(0o755, USER)); readme(H + "/mission" + n, String(n), clue); };
    readme(H, "home");
    const FW = flag("warmup"); await keep(0, FW);
    file("orientation.txt", README_TEXT.orientation + "  " + FW + "\n");

    // 1: base64 (encoding is not encryption)
    let F = flag("b64"); await keep(1, F); room(1);
    file("mission1/message.b64", b64encode("Encoding is not encryption. Anyone can decode this.\nFlag: " + F + "\n", 76));
    // 2: hex
    F = flag("hex"); await keep(2, F); room(2);
    file("mission2/secret.hex", wrapHex(toHex(toBytes("Hex decoded! Every two characters were one letter.\nFlag: " + F + "\n")), 60));
    // 3: ROT13 with tr
    F = flag("rot"); await keep(3, F); room(3);
    file("mission3/message.txt", caesarShift("ROT13 is a fun puzzle, not real security.\nFlag: " + F + "\n", 13));
    // 4: Caesar with an unknown shift (brute force)
    let shift = 1 + randInt(25); while (shift === 13) shift = 1 + randInt(25);
    F = flag("caesar"); await keep(4, F); room(4);
    file("mission4/message.txt", caesarShift("Veni, vidi, vici. You cracked Caesar.\nFlag: " + F + "\n", shift));
    // 5: Atbash with tr
    F = flag("mirror"); await keep(5, F); room(5);
    file("mission5/mirror.txt", atbash("Through the looking glass.\nFlag: " + F + "\n"));
    // 6: Morse; the flag is built from the decoded code
    const code = hex(4).toUpperCase(); F = "CYBA{morse-" + code.toLowerCase() + "}"; await keep(6, F);
    room(6, "Decode signal.txt. It spells out a code.\nThe flag is CYBA{morse-CODE}, with the code in lowercase.\n");
    file("mission6/signal.txt", morseLine("THE CODE IS " + code) + "\n");
    // 7: crack a SHA-256 against a list of candidates
    F = flag("hash"); await keep(7, F);
    room(7, "One line of candidates.txt has the SHA-256 fingerprint in target.sha256.\nThat line is the flag.\n");
    const cands = [F]; while (cands.length < 100) cands.push("CYBA{hash-" + hex(4) + "}");
    for (let i = cands.length - 1; i > 0; i--) { const j = randInt(i + 1); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    file("mission7/candidates.txt", cands.join("\n") + "\n");
    file("mission7/target.sha256", (await sha256hex(F)) + "\n");
    // 8: single-byte XOR
    const key8 = 1 + randInt(255);
    F = flag("xor"); await keep(8, F); room(8);
    file("mission8/cipher.hex", wrapHex(toHex(toBytes("XOR is everywhere in modern cryptography.\nFlag: " + F + "\n").map((b) => b ^ key8)), 60));
    // 9: Vigenere; the keyword is in a ROT13 briefing
    const kw = pick(["FALCON", "ORCHID", "JUPITER", "GLACIER", "PHOENIX", "LANTERN", "COMPASS", "HARBOR"]);
    F = flag("vig"); await keep(9, F); room(9);
    file("mission9/briefing.txt", caesarShift("BRIEFING: The keyword is " + kw + ". Tell no one.\n", 13));
    file("mission9/secret.txt", vigenereText("Vigenere kept its secrets for three hundred years.\nFlag: " + F + "\n", kw, 1));
    // 10: the vault. Crack the keyword's hash, base64-decode, then Vigenere-decrypt.
    const word = pick(README_TEXT.words.trim().split("\n"));
    F = flag("vault"); await keep(10, F);
    room(10, "The keyword is one of the words in words.txt. Its SHA-256 is in key.sha256.\nThe vault (vault.b64) was encrypted with that keyword, then base64-encoded.\n");
    file("mission10/words.txt", README_TEXT.words);
    file("mission10/key.sha256", (await sha256hex(word)) + "\n");
    file("mission10/vault.b64", b64encode(vigenereText("Vault opened. You beat the final mission.\nFlag: " + F + "\n", word, 1), 76));'''
s = s[:a] + WORLD + s[b:]

# helper programs appear in /bin
sub('for (const a of APPLETS.concat(["submit", "hint"]))', 'for (const a of APPLETS.concat(["submit", "hint", "mission", "caesar", "morse", "xor", "vigenere", "hashlines"]))')

# ---- the commands
CMDS = r'''    async tr(args, stdin) {
      const { o, rest } = opts(args);
      if (!rest.length) return R("", "tr: missing operand\n", 1);
      if (stdin === undefined || stdin === null) return R("", "tr: tr reads from a pipe or from < FILE\n", 1);
      const s1 = expandSet(rest[0]), s2 = expandSet(rest[1] || "");
      if (o.d) return R(Array.from(stdin).filter((c) => !s1.includes(c)).join(""));
      if (!s2) return R("", "tr: missing operand after '" + rest[0] + "'\n", 1);
      const map = {};
      for (let i = 0; i < s1.length; i++) map[s1[i]] = s2[Math.min(i, s2.length - 1)];
      return R(Array.from(stdin, (c) => (c in map ? map[c] : c)).join(""));
    },
    async fold(args, stdin) {
      let w = 80; const files = [];
      for (let i = 0; i < args.length; i++) {
        const m = /^-w(\d*)$/.exec(args[i]);
        if (m) w = Number(m[1] || args[++i]) || 80; else if (args[i] !== "-s" && args[i] !== "-b") files.push(args[i]);
      }
      const { items, err } = fileInputs(files, stdin, "fold");
      const out = items.map(([, d]) => splitLines(d).map((l) => { const parts = []; for (let i = 0; i < l.length; i += w) parts.push(l.slice(i, i + w)); return parts.length ? parts.join("\n") : ""; }).join("\n") + (d ? "\n" : "")).join("");
      return R(out, err, err ? 1 : 0);
    },
    async xxd(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest.slice(0, 1), stdin, "xxd");
      if (err) return R("", err, 1);
      const d = items[0][1] || "";
      if (o.r) return R(dec.decode(new Uint8Array(fromHex(d))));
      const bytes = toBytes(d);
      if (o.p) return R(wrapHex(toHex(bytes), 60));
      let out = "";
      for (let i = 0; i < bytes.length; i += 16) {
        const row = bytes.slice(i, i + 16), hx = toHex(row).replace(/(.{4})/g, "$1 ").trim();
        out += i.toString(16).padStart(8, "0") + ": " + hx.padEnd(40) + "  " + row.map(showByte).join("") + "\n";
      }
      return R(out);
    },
    async caesar(args, stdin) {
      if (!args.length) return R("", HELP.caesar, 1);
      const n = args[0], { items, err } = fileInputs(args.slice(1), stdin, "caesar");
      if (err) return R("", err, 1);
      const lines = splitLines(items.map(([, d]) => d).join(""));
      if (n === "all") { const out = []; for (const l of lines) for (let k = 1; k <= 25; k++) out.push("shift " + k + ": " + caesarShift(l, k)); return R(joinLines(out)); }
      if (!/^-?\d+$/.test(n)) return R("", "caesar: N must be a number, or all\n", 1);
      return R(joinLines(lines.map((l) => caesarShift(l, +n))));
    },
    async morse(args, stdin) {
      const e = args[0] === "-e", { items, err } = fileInputs(e ? args.slice(1) : args, stdin, "morse");
      if (err) return R("", err, 1);
      const lines = splitLines(items.map(([, d]) => d).join(""));
      return R(joinLines(lines.map(e ? morseLine : demorseLine)));
    },
    async xor(args, stdin) {
      if (!args.length) return R("", HELP.xor, 1);
      const e = args[0] === "-e", rest = e ? args.slice(1) : args, k = rest[0];
      const { items, err } = fileInputs(rest.slice(1), stdin, "xor");
      if (err) return R("", err, 1);
      const d = items.map(([, x]) => x).join("");
      if (k !== "all" && !(/^\d+$/.test(k) && +k < 256)) return R("", "xor: KEY must be a number from 0 to 255, or all\n", 1);
      if (e) return R(toHex(toBytes(d).map((b) => b ^ +k)) + "\n");
      const bytes = fromHex(d);
      if (k === "all") { const out = []; for (let kk = 1; kk < 256; kk++) out.push("key " + kk + ": " + bytes.map((b) => showByte(b ^ kk)).join("")); return R(joinLines(out)); }
      let txt = bytes.map((b) => (b ^ +k) === 10 ? "\n" : showByte(b ^ +k)).join("");
      return R(txt.endsWith("\n") ? txt : txt + "\n");
    },
    async vigenere(args, stdin) {
      if (args[0] !== "-d" && args[0] !== "-e") return R("", HELP.vigenere, 1);
      if (!args[1]) return R("", "vigenere: missing keyword\n", 1);
      const { items, err } = fileInputs(args.slice(2), stdin, "vigenere");
      if (err) return R("", err, 1);
      return R(vigenereText(items.map(([, d]) => d).join(""), args[1], args[0] === "-d" ? -1 : 1));
    },
    async hashlines(args, stdin) {
      const { items, err } = fileInputs(args, stdin, "hashlines");
      if (err) return R("", err, 1);
      let out = "";
      for (const l of splitLines(items.map(([, d]) => d).join(""))) out += (await sha256hex(l)) + "  " + l + "\n";
      return R(out);
    },
    async help() {'''
sub('    async help() {', CMDS)

# ---- help texts (same words as the real-Linux helpers)
def js(t): return t.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
import subprocess
def tool_help(name):
    txt = open(W + 'guest-crypto/tools/' + name).read()
    m = re.search(r"cat <<'EOF'\n(.*?)EOF", txt, re.S)
    return m.group(1)
BB = "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\n"
helps = {
    "tr": BB + "Usage: tr [-cds] STRING1 [STRING2]\n\nTranslate, squeeze, or delete characters from stdin, writing to stdout\n\n\t-c\tTake complement of STRING1\n\t-d\tDelete input characters coded STRING1\n\t-s\tSqueeze multiple output characters of STRING2 into one character\n",
    "fold": BB + "Usage: fold [-bs] [-w WIDTH] [FILE]...\n\nWrap input lines in FILEs (or stdin), writing to stdout\n\n\t-b\tCount bytes rather than columns\n\t-s\tBreak at spaces\n\t-w\tUse WIDTH columns instead of 80\n",
    "xxd": BB + "Usage: xxd [-pri] [-g N] [-c N] [-l LEN] [-s OFS] [-o OFS] [FILE]\n\nHex dump FILE (or stdin)\n\n\t-g N\t\tBytes per group\n\t-c N\t\tBytes per line\n\t-p\t\tShow only hex bytes, assumes -c30\n\t-i\t\tC include file style\n\t-l LENGTH\tShow only first LENGTH bytes\n\t-s OFFSET\tSkip OFFSET bytes\n\t-o OFFSET\tAdd OFFSET to displayed offset\n\t-r\t\tReverse (with -p, assumes no offsets in input)\n",
}
for t in ["caesar", "morse", "xor", "vigenere", "hashlines"]:
    helps[t] = tool_help(t)
sub('  const HELP = {\n', '  const HELP = {\n' + "".join('"%s": "%s",\n' % (k, js(v)) for k, v in helps.items()))
open(W + 'public/crypto/lite.js', 'w').write(s)
print("ok")
