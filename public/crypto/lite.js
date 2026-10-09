// CyberQuest Crypto CTF "lite mode": the same simulated shell as the Linux CTF,
// with the crypto missions and tools (tr, xxd, caesar, morse, xor, vigenere, hashlines).
// Made from public/lite.js by guest-crypto/make-lite.py; regenerate rather than edit.
//
// The normal page boots a real Linux computer with the v86 emulator, which
// needs WebAssembly. Some managed browsers block WebAssembly by policy (for
// example Chrome's DefaultJavaScriptJitSetting = 2). In that case app.js
// starts this instead: the same missions, built the same way as
// guest/build-missions, with flags checked by SHA-256 fingerprint, and the
// commands the lesson uses. It is a simulation, not Linux: anything outside
// those commands answers "not available in lite mode".
//
// Force it for testing with  ?lite  on the page address.
(function () {
  "use strict";

  // ---------------------------------------------------------------- helpers
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function randBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function hex(n) { return Array.from(randBytes(n), (b) => b.toString(16).padStart(2, "0")).join(""); }
  function randInt(n) { return randBytes(4).reduce((a, b) => a * 256 + b, 0) % n; }
  function pick(list) { return list[randInt(list.length)]; }
  const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
  function rnd(n) { let s = ""; for (let i = 0; i < n; i++) s += ALNUM[randInt(36)]; return s; }
  async function sha256hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function b64encode(text, wrap) {
    const bytes = enc.encode(text);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const out = btoa(bin);
    if (!wrap) return out + "\n";
    let lines = "";
    for (let i = 0; i < out.length; i += wrap) lines += out.slice(i, i + wrap) + "\n";
    return lines;
  }
  function b64decode(text) {
    const clean = text.replace(/\s+/g, "");
    const bin = atob(clean); // throws on bad input
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return dec.decode(bytes);
  }
  // Shell-style glob (* ? [..]) to RegExp.
  function globRe(glob, flags) {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
      const c = glob[i];
      if (c === "*") re += ".*";
      else if (c === "?") re += ".";
      else if (c === "[") { const j = glob.indexOf("]", i + 1); if (j > i) { re += "[" + glob.slice(i + 1, j).replace(/^!/, "^").replace(/\\/g, "\\\\") + "]"; i = j; } else re += "\\["; }
      else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
    }
    return new RegExp("^" + re + "$", flags);
  }
  const hasGlob = (s) => /[*?[]/.test(s);

  // The command names BusyBox provides in the real image, so that  ls /bin
  // looks the same. Only some are implemented here (see CMDS below).
  const APPLETS = "[ [[ acpid adjtimex ar arch arp arping ascii ash awk base64 basename bc blkdiscard blockdev brctl bunzip2 busybox bzcat bzip2 cal cat chgrp chmod chown chpasswd chroot chvt clear cmp cp cpio crc32 crond crontab cttyhack cut date dc dd deallocvt depmod devmem df diff dirname dmesg dnsdomainname dos2unix dpkg dpkg-deb du dumpkmap dumpleases echo ed egrep env expand expr factor fallocate false fatattr fdisk fgrep find findfs fold free freeramdisk fsfreeze fstrim ftpget ftpput getopt getty grep groups gunzip gzip halt head hexdump hostid hostname httpd hwclock i2cdetect i2cdump i2cget i2cset i2ctransfer id ifconfig ifdown ifup init insmod ionice ip ipcalc kill killall klogd last less link linux32 linux64 linuxrc ln loadfont loadkmap logger login logname logread losetup ls lsmod lsscsi lzcat lzma lzop md5sum mdev microcom mim mkdir mkdosfs mke2fs mkfifo mknod mkpasswd mkswap mktemp modinfo modprobe more mount mt mv nameif nbd-client nc netstat nl nologin nproc nsenter nslookup nuke od openvt partprobe passwd paste patch pidof ping ping6 pivot_root poweroff printf ps pwd rdate readlink realpath reboot renice reset resume rev rm rmdir rmmod route rpm rpm2cpio run-init run-parts sed seq setkeycodes setpriv setsid sh sha1sum sha256sum sha3sum sha512sum shred shuf sleep sort ssl_client start-stop-daemon stat static-sh strings stty su sulogin svc svok swapoff swapon switch_root sync sysctl syslogd tac tail tar taskset tc tee telnet telnetd test tftp time timeout top touch tr traceroute traceroute6 true truncate ts tty tunctl ubirename udhcpc udhcpc6 udhcpd uevent umount uname uncompress unexpand uniq unix2dos unlink unlzma unshare unxz unzip uptime usleep uudecode uuencode vconfig vi w watch watchdog wc wget which who whoami xargs xxd xz xzcat yes zcat".split(" ");

  // -------------------------------------------------------------- filesystem
  // Node: { dir: true, kids: {}, mode, owner } or { dir: false, data, mode, owner }
  const ROOT = mkdir(0o755, "root");
  function mkdir(mode, owner) { return { dir: true, kids: {}, mode, owner, mtime: new Date() }; }
  function mkfile(data, mode, owner) { return { dir: false, data, mode, owner, mtime: new Date() }; }
  const USER = "player", HOME = "/home/player";

  function canRead(n) { return (n.owner === USER ? (n.mode >> 6) : n.mode) & 4; }
  function canWrite(n) { return (n.owner === USER ? (n.mode >> 6) : n.mode) & 2; }
  function canExec(n) { return (n.owner === USER ? (n.mode >> 6) : n.mode) & 1; }

  function norm(path, cwd) {
    if (path === "~" || path.startsWith("~/")) path = HOME + path.slice(1);
    const parts = (path.startsWith("/") ? path : cwd + "/" + path).split("/");
    const out = [];
    for (const p of parts) {
      if (!p || p === ".") continue;
      if (p === "..") out.pop(); else out.push(p);
    }
    return "/" + out.join("/");
  }
  // Returns { node } or { err: "ENOENT" | "EACCES" | "ENOTDIR" }.
  function lookup(abs) {
    let n = ROOT;
    if (abs === "/") return { node: n };
    for (const p of abs.slice(1).split("/")) {
      if (!n.dir) return { err: "ENOTDIR" };
      if (!canExec(n)) return { err: "EACCES" };
      if (!(p in n.kids)) return { err: "ENOENT" };
      n = n.kids[p];
    }
    return { node: n };
  }
  function parentOf(abs) {
    const i = abs.lastIndexOf("/");
    return { dir: abs.slice(0, i) || "/", name: abs.slice(i + 1) };
  }
  function put(abs, node) {
    const { dir, name } = parentOf(abs);
    let n = ROOT;
    for (const p of dir.split("/").filter(Boolean)) {
      if (!(p in n.kids)) n.kids[p] = mkdir(0o755, n.owner === USER || p === "player" ? USER : "root");
      n = n.kids[p];
    }
    n.kids[name] = node;
    return node;
  }
  const ERRTXT = { ENOENT: "No such file or directory", EACCES: "Permission denied", ENOTDIR: "Not a directory", EISDIR: "Is a directory" };

  // ------------------------------------------------------- build the world
  // Mirrors guest/build-missions: random flags, only SHA-256 kept in /etc/quest.
  const FLAGHASH = {};
  async function buildWorld() {
    for (const d of ["bin", "sbin", "etc", "proc", "sys", "dev", "tmp", "home"]) ROOT.kids[d] = mkdir(0o755, "root");
    ROOT.kids.tmp.mode = 0o777;
    ROOT.kids.root = mkdir(0o700, "root");
    ROOT.kids.init = mkfile("#!/bin/sh\n", 0o755, "root");
    for (const a of APPLETS.concat(["submit", "hint", "mission", "caesar", "morse", "xor", "vigenere", "hashlines"])) ROOT.kids.bin.kids[a] = mkfile("", 0o755, "root");
    put("/dev/null", mkfile("", 0o666, "root"));
    put("/etc/passwd", mkfile("root:x:0:0:root:/root:/bin/sh\nplayer:x:1000:1000:player:/home/player:/bin/sh\n", 0o644, "root"));
    put("/etc/group", mkfile("root:x:0:\nplayer:x:1000:\n", 0o644, "root"));
    const profile = "export PS1='\\[\\e[1;32m\\]\\u\\[\\e[0m\\]@quest:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '\nexport PATH=/bin:/sbin\nalias ls='ls --color=auto'\ncd ~\n";
    put("/etc/profile", mkfile(profile, 0o644, "root"));
    put(HOME, mkdir(0o755, USER));
    put(HOME + "/.profile", mkfile(profile, 0o644, USER));
    const H = HOME;
    const flag = (w) => "CYBA{" + w + "-" + hex(4) + "}";
    const keep = async (n, f) => { FLAGHASH[n] = await sha256hex(f); put("/etc/quest/" + n, mkfile(FLAGHASH[n] + "\n", 0o644, "root")); };
    put("/etc/quest", mkdir(0o755, "root"));

    // Home: the game instructions, and the warm-up (Mission 0) at the bottom of orientation.txt.
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
    file("mission10/vault.b64", b64encode(vigenereText("Vault opened. You beat the final mission.\nFlag: " + F + "\n", word, 1), 76));
  }


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

  // --------------------------------------------------------------- the shell
  let cwd = HOME, lastStatus = 0, isTTY = true;
  const history = [];
  let onMission = () => {};
  let onHint = () => {};
  const hintsSeen = {};

  // Mission briefs and hints. Generated by guest-crypto/make-crypto.py.
  const MISSION_TEXT = {
"1": "Mission 1: Not so secret   [Easy, 100 points]\n\nObjective: Decode a base64 message and learn why encoding is not encryption.\n\n  cd ~/mission1\n  cat message.b64\n\nmessage.b64 looks scrambled, but it is only encoded with base64: a way\nto write any data using letters, digits, +, / and =.\n\nEncoding is not encryption. There is no key: anyone who knows the\nencoding can turn it back.\n\nUseful command: base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 1   (1 hint, 5 points each: 5% of this mission)\n",
"2": "Mission 2: Hex marks the spot   [Easy, 100 points]\n\nObjective: Turn hexadecimal back into readable text.\n\n  cd ~/mission2\n  cat secret.hex\n\nsecret.hex is a long run of digits and the letters a to f. That is\nhexadecimal: every two characters are one byte, one letter of the\nmessage.\n\nxxd is a hex tool. It turns bytes into hex, and hex back into bytes.\n\nUseful command: xxd\nWhen you have the flag: submit CYBA{...}\nStuck? hint 2   (1 hint, 5 points each: 5% of this mission)\n",
"3": "Mission 3: Thirteen steps   [Easy, 100 points]\n\nObjective: Undo ROT13 by translating letters with tr.\n\n  cd ~/mission3\n  cat message.txt\n\nROT13 moves every letter 13 places along the alphabet: A becomes N, B\nbecomes O, and so on. Do it twice and you are back where you started.\n\ntr (translate) swaps characters: give it the letters to change and the\nletters to change them into. Feed it the file with <.\n\nUseful command: tr\nWhen you have the flag: submit CYBA{...}\nStuck? hint 3   (1 hint, 5 points each: 5% of this mission)\n",
"4": "Mission 4: Hail Caesar   [Medium, 200 points]\n\nObjective: Brute-force a Caesar cipher by trying every shift.\n\n  cd ~/mission4\n  cat message.txt\n\nJulius Caesar hid messages by shifting every letter the same number of\nplaces. This message was shifted, but nobody wrote down how far.\n\nThere are only 25 possible shifts. When the key is that small, try them\nall: that is called brute force. The caesar tool can shift by one\nnumber, or try them all.\n\nUseful commands: caesar, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 4   (2 hints, 10 points each: 5% of this mission)\n",
"5": "Mission 5: Mirror, mirror   [Medium, 200 points]\n\nObjective: Reverse the Atbash cipher with a flipped alphabet.\n\n  cd ~/mission5\n  cat mirror.txt\n\nThis message uses Atbash, one of the oldest known ciphers: the alphabet\nis flipped, so A becomes Z, B becomes Y, C becomes X, and so on.\n\nFlipping twice gives you back the original. You already know a tool that\nswaps one set of letters for another.\n\nUseful command: tr\nWhen you have the flag: submit CYBA{...}\nStuck? hint 5   (2 hints, 10 points each: 5% of this mission)\n",
"6": "Mission 6: Dots and dashes   [Medium, 200 points]\n\nObjective: Decode a Morse code signal and build the flag from it.\n\n  cd ~/mission6\n  cat README.txt\n\nMorse code turns letters into short and long signals: . is short and -\nis long. Letters are separated by spaces, words by /.\n\nMorse has no curly braces, so README.txt tells you how to turn the\ndecoded code into a flag.\n\nUseful command: morse\nWhen you have the flag: submit CYBA{...}\nStuck? hint 6   (2 hints, 10 points each: 5% of this mission)\n",
"7": "Mission 7: Fingerprints   [Medium, 200 points]\n\nObjective: Crack a SHA-256 hash by fingerprinting a list of guesses.\n\n  cd ~/mission7\n  cat target.sha256\n\nA hash is a fingerprint of some text. The same text always gives the\nsame hash, but you cannot turn a hash back into the text.\n\ncandidates.txt holds 100 possible flags. Exactly one has the fingerprint\nin target.sha256. Password crackers work the same way: hash every guess\nfrom a list and compare.\n\nUseful commands: hashlines, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 7   (2 hints, 10 points each: 5% of this mission)\n",
"8": "Mission 8: XOR marks   [Hard, 400 points]\n\nObjective: Brute-force a single-byte XOR key.\n\n  cd ~/mission8\n  cat cipher.hex\n\nXOR is a building block of most modern ciphers. Every byte of this\nmessage was XORed with the same secret key byte: a number from 1 to 255.\n\nOne byte means only 255 possible keys. Same trick as Caesar: try every\nkey and look for the one that gives readable text.\n\nUseful commands: xor, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 8   (2 hints, 20 points each: 5% of this mission)\n",
"9": "Mission 9: Keyed up   [Hard, 400 points]\n\nObjective: Find the keyword, then decrypt a Vigen\u00e8re cipher.\n\n  cd ~/mission9\n  ls\n\nsecret.txt is encrypted with the Vigen\u00e8re cipher: each letter is shifted\nby a different amount, set by a keyword that repeats. Brute force won't\nwork here: there are far too many keys.\n\nBut somebody left a briefing behind, scrambled with a cipher you already\nknow.\n\nUseful commands: tr, vigenere\nWhen you have the flag: submit CYBA{...}\nStuck? hint 9   (2 hints, 20 points each: 5% of this mission)\n",
"10": "Mission 10: The vault   [Very Hard, 800 points]\n\nObjective: Crack the keyword's hash, then open the vault.\n\n  cd ~/mission10\n  cat README.txt\n\nThe final vault combines three skills. It was encrypted with a Vigen\u00e8re\nkeyword, then base64-encoded. Nobody wrote the keyword down: only its\nSHA-256 fingerprint survived.\n\nCrack the fingerprint against the wordlist, then use the keyword to open\nthe vault.\n\nUseful commands: hashlines, grep, base64, vigenere\nWhen you have the flag: submit CYBA{...}\nStuck? hint 10   (4 hints, 40 points each: 5% of this mission)\n",
"0": "Mission 0: Warm-up   [optional, 50 bonus points, untimed]\n\nObjective: Read the CTF orientation in the terminal with cat.\n\n  cat orientation.txt\n\nGet comfortable before the clock starts. Your home folder holds\norientation.txt: how a CTF works, what a flag looks like, scoring and\nthe crypto tools you will use.\n\ncat prints a file on the screen. Click the terminal, type cat\norientation.txt and press Enter. The warm-up flag is at the bottom.\n\nSubmit it for 50 bonus points, or skip the warm-up. The competition\nclock starts when you begin Mission 1.\n\nWhen you have the flag: submit CYBA{...}     Stuck? hint 0\n"
};
  const MISSION_OVERVIEW = "Your missions:\n   0  Warm-up (optional)           Bonus       50 pts  (bonus, untimed)\n   1  Not so secret                Easy       100 pts\n   2  Hex marks the spot           Easy       100 pts\n   3  Thirteen steps               Easy       100 pts\n   4  Hail Caesar                  Medium     200 pts\n   5  Mirror, mirror               Medium     200 pts\n   6  Dots and dashes              Medium     200 pts\n   7  Fingerprints                 Medium     200 pts\n   8  XOR marks                    Hard       400 pts\n   9  Keyed up                     Hard       400 pts\n  10  The vault                    Very Hard  800 pts\n                                             2700 pts\n\nRead one with: mission 1   (up to 10)\n";
  const HINTS = {
"1": [
"Read base64 --help and look for the option that decodes. Options go between the command and the file name."
],
"2": [
"Read xxd --help. You need two options together: -r (reverse: hex back to bytes) and -p (plain hex, no addresses)."
],
"3": [
"tr needs two sets: every letter, and every letter moved 13 places. A-Z moved 13 places is N-Z followed by A-M. Do the same for lowercase, and feed the file in with <."
],
"4": [
"Read caesar --help. It can try all the shifts at once.",
"caesar all message.txt prints 25 versions. Pipe it into grep CYBA to keep the one that makes sense."
],
"5": [
"Use tr again. The first set is the alphabet in order; the second set is the alphabet backwards: ZYXWVUTSRQPONMLKJIHGFEDCBA. Do lowercase too.",
"tr 'A-Za-z' 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba' < mirror.txt"
],
"6": [
"Read morse --help: decoding is what it does by default.",
"morse signal.txt prints the message. Put the code into the flag format from README.txt, in lowercase."
],
"7": [
"You can't reverse a hash, but you can hash every candidate. hashlines candidates.txt prints each line's fingerprint next to it.",
"Pipe it into grep with the first few characters of the target hash, for example hashlines candidates.txt | grep 3fa9 (use your own hash)."
],
"8": [
"Read xor --help. Like caesar, it can try every key with all.",
"xor all cipher.hex | grep CYBA keeps the one key that decodes it."
],
"9": [
"briefing.txt is ROT13, like Mission 3: tr 'A-Za-z' 'N-ZA-Mn-za-m' < briefing.txt.",
"The briefing names the keyword. Read vigenere --help, then decrypt: vigenere -d KEYWORD secret.txt."
],
"10": [
"Step 1: find the keyword. Fingerprint every word in words.txt and look for the hash from key.sha256, like Mission 7.",
"Step 2: the vault is base64 on the outside. Decode it first: base64 -d vault.b64.",
"Step 3: pipe the decoded text into the Vigen\u00e8re tool: base64 -d vault.b64 | vigenere -d KEYWORD.",
"Still gibberish? Check the keyword is exactly the word from words.txt whose hash matched. The opened vault starts with Vault opened."
],
"0": "Mission 0: The flag is on the last line of orientation.txt in your home folder. Type cat orientation.txt, press Enter, then copy the flag into submit."
};
  const MISSION_COUNT = 10;
  const README_TEXT = {
"home": "CyberQuest Crypto CTF\n=====================\n\nThis file explains the game. Each mission folder has its own README.txt\nwith that mission's instructions. Read one with:  cat README.txt\n\nHow to play\n  1. Go to a mission:    cd ~/mission1\n  2. Look around:        ls\n  3. Read its brief:     cat README.txt     (or type: mission 1)\n  4. Find the flag. It looks like CYBA{word-1a2b3c4d}\n  5. Check it:           submit CYBA{...}\n  6. Stuck?              hint 1   (costs 5% of the mission's points)\n\nMissions\n   1  Not so secret                Easy       100 pts\n   2  Hex marks the spot           Easy       100 pts\n   3  Thirteen steps               Easy       100 pts\n   4  Hail Caesar                  Medium     200 pts\n   5  Mirror, mirror               Medium     200 pts\n   6  Dots and dashes              Medium     200 pts\n   7  Fingerprints                 Medium     200 pts\n   8  XOR marks                    Hard       400 pts\n   9  Keyed up                     Hard       400 pts\n  10  The vault                    Very Hard  800 pts\n                                             2700 pts\n\nFlags change every time the page loads.\n\nNew to CTFs? Warm up first (optional, 50 bonus points):  cat orientation.txt\n",
"orientation": "CTF Orientation\n===============\n\nWhat is a CTF?\n  Capture The Flag is a cybersecurity competition. Each mission hides a\n  flag: a secret piece of text. Find it, submit it, and score points.\n\n1. Read a mission's instructions\n  Every mission has its own folder with a README.txt inside:\n    cd ~/mission1          go into the mission's folder\n    cat README.txt         read its instructions\n    cd ~                   come back home\n  Or, from anywhere:  mission 1      (mission alone lists them all)\n\n2. Find the flag\n  A flag looks like this:  CYBA{word-1a2b3c4d}\n  It always starts with CYBA{ and ends with }.\n\n3. Submit the flag\n  Type submit, a space, then the whole flag:\n    submit CYBA{word-1a2b3c4d}\n  Copy it exactly: highlight it with the mouse, then paste with Ctrl+V\n  or a right-click. Do not leave off the CYBA{ or the }.\n\n  What the replies mean:\n    Correct! +100 points                 you captured it\n    Incorrect flag. Keep hunting!        right shape, wrong flag\n    That doesn't look like a flag.       copy the whole thing, CYBA{ to }\n\n4. Stuck?\n  Read the command's built-in help first:  ls --help\n  Then ask for a nudge:  hint 1\n  A hint costs 5% of that mission's points, charged once. hint 1 tells\n  you the price first; hint 1 --show reveals it.\n\nScoring\n  Easy 100    Medium 200    Hard 400    Very Hard 800\n  The most points wins. On a tie, the faster time wins.\n  Hints cost 5% of the mission's points.\n\nThe clock\n  The clock starts when you begin Mission 1 and counts up. It stops\n  when you capture the last flag.\n\nYour crypto toolkit\n  base64   xxd   tr   sha256sum      real Linux tools\n  caesar   morse   xor   vigenere   hashlines   helpers for this CTF\n  Every one explains itself:  caesar --help\n\nWarm-up: Mission 0  (optional, 50 bonus points, untimed)\n  You just read this file with cat. Now practice step 3: submit the\n  flag below. Or skip it and go to Mission 1.\n\nWarm-up flag:\n",
"words": "acorn\namber\nanchor\narrow\naspen\nbadger\nbeacon\nbirch\nblizzard\nbramble\nbreeze\ncanyon\ncedar\ncinder\ncobalt\ncomet\ncompass\ncoral\ncricket\ncrystal\ncypress\ndagger\ndelta\ndragon\ndrift\ndune\neagle\neclipse\nember\nfalcon\nfable\nfern\ngalaxy\ngarnet\nglacier\ngranite\nharbor\nhazel\nheron\nhorizon\niris\nisland\nivory\njasper\njungle\nkestrel\nkiwi\nlagoon\nlantern\nlotus\nmagnet\nmaple\nmarble\nmeadow\nmeteor\nmint\nnebula\nnectar\nnova\noasis\nonyx\norbit\norchid\notter\npebble\nphoenix\npine\nprairie\nquartz\nquill\nraven\nreef\nripple\nrocket\nsaffron\nsapphire\nsaturn\nsierra\nspruce\nsummit\nthunder\ntiger\ntopaz\ntundra\numbra\nvelvet\nviolet\nvortex\nwalnut\nwillow\nwombat\nyonder\nzephyr\nzinnia\naurora\nbison\ndahlia\nfjord\ngecko\nmarlin\n",
"1": "Mission 1: Not so secret   [Easy, 100 points]\n\nObjective: Decode a base64 message and learn why encoding is not encryption.\n\n  cd ~/mission1\n  cat message.b64\n\nmessage.b64 looks scrambled, but it is only encoded with base64: a way\nto write any data using letters, digits, +, / and =.\n\nEncoding is not encryption. There is no key: anyone who knows the\nencoding can turn it back.\n\nUseful command: base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 1   (1 hint, 5 points each: 5% of this mission)\n",
"2": "Mission 2: Hex marks the spot   [Easy, 100 points]\n\nObjective: Turn hexadecimal back into readable text.\n\n  cd ~/mission2\n  cat secret.hex\n\nsecret.hex is a long run of digits and the letters a to f. That is\nhexadecimal: every two characters are one byte, one letter of the\nmessage.\n\nxxd is a hex tool. It turns bytes into hex, and hex back into bytes.\n\nUseful command: xxd\nWhen you have the flag: submit CYBA{...}\nStuck? hint 2   (1 hint, 5 points each: 5% of this mission)\n",
"3": "Mission 3: Thirteen steps   [Easy, 100 points]\n\nObjective: Undo ROT13 by translating letters with tr.\n\n  cd ~/mission3\n  cat message.txt\n\nROT13 moves every letter 13 places along the alphabet: A becomes N, B\nbecomes O, and so on. Do it twice and you are back where you started.\n\ntr (translate) swaps characters: give it the letters to change and the\nletters to change them into. Feed it the file with <.\n\nUseful command: tr\nWhen you have the flag: submit CYBA{...}\nStuck? hint 3   (1 hint, 5 points each: 5% of this mission)\n",
"4": "Mission 4: Hail Caesar   [Medium, 200 points]\n\nObjective: Brute-force a Caesar cipher by trying every shift.\n\n  cd ~/mission4\n  cat message.txt\n\nJulius Caesar hid messages by shifting every letter the same number of\nplaces. This message was shifted, but nobody wrote down how far.\n\nThere are only 25 possible shifts. When the key is that small, try them\nall: that is called brute force. The caesar tool can shift by one\nnumber, or try them all.\n\nUseful commands: caesar, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 4   (2 hints, 10 points each: 5% of this mission)\n",
"5": "Mission 5: Mirror, mirror   [Medium, 200 points]\n\nObjective: Reverse the Atbash cipher with a flipped alphabet.\n\n  cd ~/mission5\n  cat mirror.txt\n\nThis message uses Atbash, one of the oldest known ciphers: the alphabet\nis flipped, so A becomes Z, B becomes Y, C becomes X, and so on.\n\nFlipping twice gives you back the original. You already know a tool that\nswaps one set of letters for another.\n\nUseful command: tr\nWhen you have the flag: submit CYBA{...}\nStuck? hint 5   (2 hints, 10 points each: 5% of this mission)\n",
"6": "Mission 6: Dots and dashes   [Medium, 200 points]\n\nObjective: Decode a Morse code signal and build the flag from it.\n\n  cd ~/mission6\n  cat README.txt\n\nMorse code turns letters into short and long signals: . is short and -\nis long. Letters are separated by spaces, words by /.\n\nMorse has no curly braces, so README.txt tells you how to turn the\ndecoded code into a flag.\n\nUseful command: morse\nWhen you have the flag: submit CYBA{...}\nStuck? hint 6   (2 hints, 10 points each: 5% of this mission)\n",
"7": "Mission 7: Fingerprints   [Medium, 200 points]\n\nObjective: Crack a SHA-256 hash by fingerprinting a list of guesses.\n\n  cd ~/mission7\n  cat target.sha256\n\nA hash is a fingerprint of some text. The same text always gives the\nsame hash, but you cannot turn a hash back into the text.\n\ncandidates.txt holds 100 possible flags. Exactly one has the fingerprint\nin target.sha256. Password crackers work the same way: hash every guess\nfrom a list and compare.\n\nUseful commands: hashlines, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 7   (2 hints, 10 points each: 5% of this mission)\n",
"8": "Mission 8: XOR marks   [Hard, 400 points]\n\nObjective: Brute-force a single-byte XOR key.\n\n  cd ~/mission8\n  cat cipher.hex\n\nXOR is a building block of most modern ciphers. Every byte of this\nmessage was XORed with the same secret key byte: a number from 1 to 255.\n\nOne byte means only 255 possible keys. Same trick as Caesar: try every\nkey and look for the one that gives readable text.\n\nUseful commands: xor, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 8   (2 hints, 20 points each: 5% of this mission)\n",
"9": "Mission 9: Keyed up   [Hard, 400 points]\n\nObjective: Find the keyword, then decrypt a Vigen\u00e8re cipher.\n\n  cd ~/mission9\n  ls\n\nsecret.txt is encrypted with the Vigen\u00e8re cipher: each letter is shifted\nby a different amount, set by a keyword that repeats. Brute force won't\nwork here: there are far too many keys.\n\nBut somebody left a briefing behind, scrambled with a cipher you already\nknow.\n\nUseful commands: tr, vigenere\nWhen you have the flag: submit CYBA{...}\nStuck? hint 9   (2 hints, 20 points each: 5% of this mission)\n",
"10": "Mission 10: The vault   [Very Hard, 800 points]\n\nObjective: Crack the keyword's hash, then open the vault.\n\n  cd ~/mission10\n  cat README.txt\n\nThe final vault combines three skills. It was encrypted with a Vigen\u00e8re\nkeyword, then base64-encoded. Nobody wrote the keyword down: only its\nSHA-256 fingerprint survived.\n\nCrack the fingerprint against the wordlist, then use the keyword to open\nthe vault.\n\nUseful commands: hashlines, grep, base64, vigenere\nWhen you have the flag: submit CYBA{...}\nStuck? hint 10   (4 hints, 40 points each: 5% of this mission)\n"
};
  const HINT_COST = {"1": 5, "2": 5, "3": 5, "4": 10, "5": 10, "6": 10, "7": 10, "8": 20, "9": 20, "10": 40};
  const MISSION_POINTS = {"0": 50, "1": 100, "2": 100, "3": 100, "4": 200, "5": 200, "6": 200, "7": 200, "8": 400, "9": 400, "10": 800};
  // End of generated briefs.

  // Real BusyBox --help text, so --help reads the same as in the full Linux.
  const HELP = {
"tr": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: tr [-cds] STRING1 [STRING2]\n\nTranslate, squeeze, or delete characters from stdin, writing to stdout\n\n	-c	Take complement of STRING1\n	-d	Delete input characters coded STRING1\n	-s	Squeeze multiple output characters of STRING2 into one character\n",
"fold": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: fold [-bs] [-w WIDTH] [FILE]...\n\nWrap input lines in FILEs (or stdin), writing to stdout\n\n	-b	Count bytes rather than columns\n	-s	Break at spaces\n	-w	Use WIDTH columns instead of 80\n",
"xxd": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: xxd [-pri] [-g N] [-c N] [-l LEN] [-s OFS] [-o OFS] [FILE]\n\nHex dump FILE (or stdin)\n\n	-g N		Bytes per group\n	-c N		Bytes per line\n	-p		Show only hex bytes, assumes -c30\n	-i		C include file style\n	-l LENGTH	Show only first LENGTH bytes\n	-s OFFSET	Skip OFFSET bytes\n	-o OFFSET	Add OFFSET to displayed offset\n	-r		Reverse (with -p, assumes no offsets in input)\n",
"caesar": "Usage: caesar N [FILE]     shift every letter N places along the alphabet\n       caesar all [FILE]   try all 25 shifts; each line starts with its shift\nLetters wrap around (Z then A). Digits, spaces and symbols stay the same.\nReads FILE, or the output of another command through a pipe (|).\n",
"morse": "Usage: morse [FILE]      decode Morse code (. short, - long) into letters\n       morse -e [FILE]   encode letters and digits as Morse code\nLetters are separated by spaces and words by /.\nReads FILE, or the output of another command through a pipe (|).\n",
"xor": "Usage: xor KEY [FILE]      XOR hex data with KEY (a number from 0 to 255), print text\n       xor all [FILE]      try every key from 1 to 255, one line per key\n       xor -e KEY [FILE]   XOR text with KEY and print it as hex\nUnprintable bytes show as a dot. Reads FILE, or a pipe (|).\n",
"vigenere": "Usage: vigenere -d KEY [FILE]   decrypt with the keyword KEY\n       vigenere -e KEY [FILE]   encrypt with the keyword KEY\nEach letter is shifted by the matching letter of the keyword (A=0, B=1 ...),\nand the keyword repeats. Digits, spaces and symbols stay the same.\nReads FILE, or the output of another command through a pipe (|).\n",
"hashlines": "Usage: hashlines [FILE]   print the SHA-256 fingerprint of every line, then the line\nThis is how a wordlist attack works: hash every guess and compare.\nReads FILE, or the output of another command through a pipe (|).\n",
"ls": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: ls [-1AaCxdLHRFplinshrSXvctu] [-w WIDTH] [FILE]...\n\nList directory contents\n\n\t-1\tOne column output\n\t-a\tInclude names starting with .\n\t-A\tLike -a, but exclude . and ..\n\t-x\tList by lines\n\t-d\tList directory names, not contents\n\t-L\tFollow symlinks\n\t-H\tFollow symlinks on command line\n\t-R\tRecurse\n\t-p\tAppend / to directory names\n\t-F\tAppend indicator (one of */=@|) to names\n\t-l\tLong format\n\t-i\tList inode numbers\n\t-n\tList numeric UIDs and GIDs instead of names\n\t-s\tList allocated blocks\n\t-lc\tList ctime\n\t-lu\tList atime\n\t--full-time\tList full date/time\n\t-h\tHuman readable sizes (1K 243M 2G)\n\t--group-directories-first\n\t-S\tSort by size\n\t-X\tSort by extension\n\t-v\tSort by version\n\t-t\tSort by mtime\n\t-tc\tSort by ctime\n\t-tu\tSort by atime\n\t-r\tReverse sort order\n\t-w N\tFormat N columns wide\n\t--color[={always,never,auto}]\n",
"find": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: find [-HL] [PATH]... [OPTIONS] [ACTIONS]\n\nSearch for files and perform actions on them.\nFirst failed action stops processing of current file.\nDefaults: PATH is current directory, action is '-print'\n\n\t-L,-follow\tFollow symlinks\n\t-H\t\t...on command line only\n\t-xdev\t\tDon't descend directories on other filesystems\n\t-maxdepth N\tDescend at most N levels. -maxdepth 0 applies\n\t\t\tactions to command line arguments only\n\t-mindepth N\tDon't act on first N levels\n\t-depth\t\tAct on directory *after* traversing it\n\nActions:\n\t( ACTIONS )\tGroup actions for -o / -a\n\t! ACT\t\tInvert ACT's success/failure\n\tACT1 [-a] ACT2\tIf ACT1 fails, stop, else do ACT2\n\tACT1 -o ACT2\tIf ACT1 succeeds, stop, else do ACT2\n\t\t\tNote: -a has higher priority than -o\n\t-name PATTERN\tMatch file name (w/o directory name) to PATTERN\n\t-iname PATTERN\tCase insensitive -name\n\t-path PATTERN\tMatch path to PATTERN\n\t-ipath PATTERN\tCase insensitive -path\n\t-regex PATTERN\tMatch path to regex PATTERN\n\t-type X\t\tFile type is X (one of: f,d,l,b,c,s,p)\n\t-executable\tFile is executable\n\t-perm MASK\tAt least one mask bit (+MASK), all bits (-MASK),\n\t\t\tor exactly MASK bits are set in file's mode\n\t-mtime DAYS\tmtime is greater than (+N), less than (-N),\n\t\t\tor exactly N days in the past\n\t-atime DAYS\tatime +N/-N/N days in the past\n\t-ctime DAYS\tctime +N/-N/N days in the past\n\t-mmin MINS\tmtime is greater than (+N), less than (-N),\n\t\t\tor exactly N minutes in the past\n\t-amin MINS\tatime +N/-N/N minutes in the past\n\t-cmin MINS\tctime +N/-N/N minutes in the past\n\t-newer FILE\tmtime is more recent than FILE's\n\t-inum N\t\tFile has inode number N\n\t-samefile FILE\tFile is same as FILE\n\t-user NAME/ID\tFile is owned by given user\n\t-group NAME/ID\tFile is owned by given group\n\t-size N[bck]\tFile size is N (c:bytes,k:kbytes,b:512 bytes(def.))\n\t\t\t+/-N: file size is bigger/smaller than N\n\t-links N\tNumber of links is greater than (+N), less than (-N),\n\t\t\tor exactly N\n\t-empty\t\tMatch empty file/directory\n\t-prune\t\tIf current file is directory, don't descend into it\nIf none of the following actions is specified, -print is assumed\n\t-print\t\tPrint file name\n\t-print0\t\tPrint file name, NUL terminated\n\t-exec CMD ARG ;\tRun CMD with all instances of {} replaced by\n\t\t\tfile name. Fails if CMD exits with nonzero\n\t-exec CMD ARG + Run CMD with {} replaced by list of file names\n\t-quit\t\tExit\n",
"grep": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: grep [-HhnlLoqvsrRiwFEz] [-m N] [-A|B|C N] { PATTERN | -e PATTERN... | -f FILE... } [FILE]...\n\nSearch for PATTERN in FILEs (or stdin)\n\n\t-H\tAdd 'filename:' prefix\n\t-h\tDo not add 'filename:' prefix\n\t-n\tAdd 'line_no:' prefix\n\t-l\tShow only names of files that match\n\t-L\tShow only names of files that don't match\n\t-c\tShow only count of matching lines\n\t-o\tShow only the matching part of line\n\t-q\tQuiet. Return 0 if PATTERN is found, 1 otherwise\n\t-v\tSelect non-matching lines\n\t-s\tSuppress open and read errors\n\t-r\tRecurse\n\t-R\tRecurse and dereference symlinks\n\t-i\tIgnore case\n\t-w\tMatch whole words only\n\t-x\tMatch whole lines only\n\t-F\tPATTERN is a literal (not regexp)\n\t-E\tPATTERN is an extended regexp\n\t-z\tNUL terminated input\n\t-m N\tMatch up to N times per file\n\t-A N\tPrint N lines of trailing context\n\t-B N\tPrint N lines of leading context\n\t-C N\tSame as '-A N -B N'\n\t-e PTRN\tPattern to match\n\t-f FILE\tRead pattern from file\n",
"base64": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: base64 [-d] [-w COL] [FILE]\n\nBase64 encode or decode FILE to standard output\n\n\t-d\tDecode data\n\t-w COL\tWrap lines at COL (default 76, 0 disables)\n",
"head": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: head [OPTIONS] [FILE]...\n\nPrint first 10 lines of FILEs (or stdin).\nWith more than one FILE, precede each with a filename header.\n\n\t-n N[bkm]\tPrint first N lines\n\t-n -N[bkm]\tPrint all except N last lines\n\t-c [-]N[bkm]\tPrint first N bytes\n\t\t\t(b:*512 k:*1024 m:*1024^2)\n\t-q\t\tNever print headers\n\t-v\t\tAlways print headers\n",
"wc": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: wc [-cmlwL] [FILE]...\n\nCount lines, words, and bytes for FILEs (or stdin)\n\n\t-c\tCount bytes\n\t-m\tCount characters\n\t-l\tCount newlines\n\t-w\tCount words\n\t-L\tPrint longest line length\n",
"cut": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: cut [OPTIONS] [FILE]...\n\nPrint selected fields from FILEs to stdout\n\n\t-b LIST\tOutput only bytes from LIST\n\t-c LIST\tOutput only characters from LIST\n\t-d SEP\tField delimiter for input (default -f TAB, -F run of whitespace)\n\t-O SEP\tField delimiter for output (default = -d for -f, one space for -F)\n\t-D\tDon't sort/collate sections or match -fF lines without delimiter\n\t-f LIST\tPrint only these fields (-d is single char)\n\t-F LIST\tPrint only these fields (-d is regex)\n\t-s\tOutput only lines containing delimiter\n\t-n\tIgnored\n",
"sort": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: sort [-nrughMcszbdfiokt] [-o FILE] [-k START[.OFS][OPTS][,END[.OFS][OPTS]] [-t CHAR] [FILE]...\n\nSort lines of text\n\n\t-o FILE\tOutput to FILE\n\t-c\tCheck whether input is sorted\n\t-b\tIgnore leading blanks\n\t-f\tIgnore case\n\t-i\tIgnore unprintable characters\n\t-d\tDictionary order (blank or alphanumeric only)\n\t-n\tSort numbers\n\t-g\tGeneral numerical sort\n\t-h\tSort human readable numbers (2K 1G)\n\t-M\tSort month\n\t-V\tSort version\n\t-t CHAR\tField separator\n\t-k N[,M] Sort by Nth field\n\t-r\tReverse sort order\n\t-s\tStable (don't sort ties alphabetically)\n\t-u\tSuppress duplicate lines\n\t-z\tNUL terminated input and output\n",
"uniq": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: uniq [-cduiz] [-f,s,w N] [FILE [OUTFILE]]\n\nDiscard duplicate lines\n\n\t-c\tPrefix lines by the number of occurrences\n\t-d\tOnly print duplicate lines\n\t-u\tOnly print unique lines\n\t-i\tIgnore case\n\t-z\tNUL terminated output\n\t-f N\tSkip first N fields\n\t-s N\tSkip first N chars (after any skipped fields)\n\t-w N\tCompare N characters in line\n",
"cat": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: cat [-nbvteA] [FILE]...\n\nPrint FILEs to stdout\n\n\t-n\tNumber output lines\n\t-b\tNumber nonempty lines\n\t-v\tShow nonprinting characters as ^x or M-x\n\t-t\t...and tabs as ^I\n\t-e\t...and end lines with $\n\t-A\tSame as -vte\n",
"echo": "--help\n",
"chmod": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: chmod [-Rcvf] MODE[,MODE]... FILE...\n\nMODE is octal number (bit pattern sstrwxrwxrwx) or [ugoa]{+|-|=}[rwxXst]\n\n\t-R\tRecurse\n\t-c\tList changed files\n\t-v\tVerbose\n\t-f\tHide errors\n",
"sha256sum": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: sha256sum [-c[sw]] [FILE]...\n\nPrint or check SHA256 checksums\n\n\t-c\tCheck sums against list in FILEs\n\t-s\tDon't output anything, status code shows success\n\t-w\tWarn about improperly formatted checksum lines\n",
"tail": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: tail [OPTIONS] [FILE]...\n\nPrint last 10 lines of FILEs (or stdin) to.\nWith more than one FILE, precede each with a filename header.\n\n\t-c [+]N[bkm]\tPrint last N bytes\n\t-n N[bkm]\tPrint last N lines\n\t-n +N[bkm]\tStart on Nth line and print the rest\n\t\t\t(b:*512 k:*1024 m:*1024^2)\n\t-q\t\tNever print headers\n\t-v\t\tAlways print headers\n\t-f\t\tPrint data as file grows\n\t-F\t\tSame as -f, but keep retrying\n\t-s SECONDS\tWait SECONDS between reads with -f\n"
};
  // A command gets (args, stdin string) and returns { out, err, code }.
  const R = (out = "", err = "", code = 0) => ({ out, err, code });
  function readFile(name, cmd) {
    const abs = norm(name, cwd), r = lookup(abs);
    if (r.err) return { err: cmd + ": can't open '" + name + "': " + ERRTXT[r.err] + "\n" };
    if (r.node.dir) return { err: cmd + ": read error: Is a directory\n" };
    if (!canRead(r.node)) return { err: cmd + ": can't open '" + name + "': Permission denied\n" };
    return { data: r.node.data };
  }
  // Split options like -abc and -n 5 in a simple, predictable way.
  function opts(args, withValue = "") {
    const o = {}, rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") { rest.push(...args.slice(i + 1)); break; }
      if (a.startsWith("--")) { o[a.slice(2)] = true; continue; }
      if (a.length > 1 && a[0] === "-" && !/^-\d/.test(a)) {
        for (let j = 1; j < a.length; j++) {
          const c = a[j];
          if (withValue.includes(c)) { o[c] = a.slice(j + 1) || args[++i]; break; }
          o[c] = true;
        }
      } else if (/^-\d+$/.test(a)) o.num = a.slice(1);
      else rest.push(a);
    }
    return { o, rest };
  }
  function fileInputs(rest, stdin, cmd) {
    // Yields [name, data] pairs, or errors.
    if (!rest.length) return { items: [["-", stdin]], err: "" };
    let err = "";
    const items = [];
    for (const f of rest) { if (f === "-") { items.push(["-", stdin]); continue; } const r = readFile(f, cmd); if (r.err) err += r.err; else items.push([f, r.data]); }
    return { items, err };
  }
  const splitLines = (s) => { if (!s) return []; const l = s.split("\n"); if (l[l.length - 1] === "") l.pop(); return l; };
  const joinLines = (l) => (l.length ? l.join("\n") + "\n" : "");

  function modeStr(n) {
    const bits = "rwxrwxrwx";
    let s = n.dir ? "d" : "-";
    for (let i = 0; i < 9; i++) s += (n.mode >> (8 - i)) & 1 ? bits[i] : "-";
    return s;
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function color(name, n) {
    if (!isTTY) return name;
    if (n.dir) return "\x1b[1;34m" + name + "\x1b[0m";
    if (n.mode & 0o111) return "\x1b[1;32m" + name + "\x1b[0m";
    return name;
  }
  function columns(items, plainLen) {
    const width = term ? term.cols : 80;
    const w = Math.max(...plainLen) + 2;
    const per = Math.max(1, Math.floor(width / w)), rows = Math.ceil(items.length / per);
    let out = "";
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < per; c++) {
        const i = c * rows + r;
        if (i >= items.length) continue;
        const last = c === per - 1 || (c + 1) * rows + r >= items.length;
        line += items[i] + (last ? "" : " ".repeat(w - plainLen[i]));
      }
      out += line + "\n";
    }
    return out;
  }

  const CMDS = {
    async ls(args) {
      const { o, rest } = opts(args);
      const targets = rest.length ? rest : ["."];
      let out = "", err = "";
      const fileItems = [], dirItems = [];
      for (const t of targets) {
        const r = lookup(norm(t, cwd));
        if (r.err) { err += "ls: " + t + ": " + ERRTXT[r.err] + "\n"; continue; }
        (r.node.dir && !o.d ? dirItems : fileItems).push([t, r.node]);
      }
      const render = (entries) => {
        if (o.l) return entries.map(([name, n]) => {
          const d = n.mtime;
          const size = n.dir ? 4096 : enc.encode(n.data).length;
          return modeStr(n) + "    1 " + n.owner.padEnd(8) + " " + n.owner.padEnd(8) + " " + String(size).padStart(8) + " " + MONTHS[d.getMonth()] + " " + String(d.getDate()).padStart(2) + " " + p2t(d) + " " + color(name, n);
        }).join("\n") + (entries.length ? "\n" : "");
        if (o["1"] || !isTTY) return entries.map(([name, n]) => color(name, n)).join("\n") + (entries.length ? "\n" : "");
        if (!entries.length) return "";
        return columns(entries.map(([name, n]) => color(name, n)), entries.map(([name]) => name.length));
      };
      const p2t = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      out += render(fileItems);
      dirItems.forEach(([t, n], i) => {
        if (dirItems.length + fileItems.length > 1) out += (out ? "\n" : "") + t + ":\n";
        if (!canRead(n)) { err += "ls: can't open '" + t + "': Permission denied\n"; return; }
        let names = Object.keys(n.kids).sort();
        if (!o.a && !o.A) names = names.filter((x) => !x.startsWith("."));
        let entries = names.map((x) => [x, n.kids[x]]);
        if (o.a) entries = [[".", n], ["..", n]].concat(entries);
        out += render(entries);
      });
      return R(out, err, err ? 1 : 0);
    },
    async cd(args) {
      const t = args[0] || "~";
      const abs = norm(t, cwd), r = lookup(abs);
      if (r.err) return R("", "-sh: cd: can't cd to " + t + ": " + ERRTXT[r.err] + "\n", 1);
      if (!r.node.dir) return R("", "-sh: cd: can't cd to " + t + ": Not a directory\n", 1);
      if (!canExec(r.node)) return R("", "-sh: cd: can't cd to " + t + ": Permission denied\n", 1);
      cwd = abs;
      return R();
    },
    async pwd() { return R(cwd + "\n"); },
    async whoami() { return R(USER + "\n"); },
    async id() { return R("uid=1000(player) gid=1000(player) groups=1000(player)\n"); },
    async hostname() { return R("quest\n"); },
    async uname(args) { return R(args.includes("-a") ? "Linux quest (CyberQuest lite mode: a simulated shell)\n" : "Linux\n"); },
    async echo(args) {
      let nl = true, esc = false;
      while (args[0] === "-n" || args[0] === "-e") { if (args[0] === "-n") nl = false; else esc = true; args = args.slice(1); }
      let s = args.join(" ");
      if (esc) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      return R(s + (nl ? "\n" : ""));
    },
    async cat(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest, stdin, "cat");
      let out = items.map(([, d]) => d).join("");
      if (o.n || o.b) {
        let k = 0;
        out = joinLines(splitLines(out).map((l) => (o.b && l === "" ? l : String(++k).padStart(6) + "\t" + l)));
      }
      return R(out, err, err ? 1 : 0);
    },
    async head(args, stdin) { return headTail(args, stdin, "head"); },
    async tail(args, stdin) { return headTail(args, stdin, "tail"); },
    async wc(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest, stdin, "wc");
      const any = o.l || o.w || o.c;
      let out = "";
      for (const [name, d] of items) {
        const l = (d.match(/\n/g) || []).length, w = (d.match(/\S+/g) || []).length, c = enc.encode(d).length;
        const parts = [];
        if (!any || o.l) parts.push(l); if (!any || o.w) parts.push(w); if (!any || o.c) parts.push(c);
        const nums = parts.length === 1 ? String(parts[0]) : parts.map((n) => String(n).padStart(7)).join(" ");
        out += nums + (name === "-" ? "" : " " + name) + "\n";
      }
      return R(out, err, err ? 1 : 0);
    },
    async grep(args, stdin) {
      const { o, rest } = opts(args, "e");
      let pat = o.e !== undefined ? o.e : rest.shift();
      if (pat === undefined) return R("", "Usage: grep [-cilnrv] PATTERN [FILE]...\n", 2);
      let re;
      const flags = o.i ? "i" : "";
      try { re = new RegExp(pat.replace(/\\([(){}|+?])/g, "$1"), flags); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags); }
      let files = rest, err = "";
      const items = [];
      if (o.r || o.R) {
        if (!files.length) files = ["."];
        for (const f of files) walk(norm(f, cwd), f, (path, n) => { if (!n.dir) { if (canRead(n)) items.push([path, n.data]); else err += "grep: " + path + ": Permission denied\n"; } }, (p, e) => { err += "grep: " + p + ": " + ERRTXT[e] + "\n"; });
      } else {
        const r = fileInputs(files, stdin, "grep");
        items.push(...r.items); err += r.err;
        items.forEach((it, i) => { if (it[0] !== "-") { const n = lookup(norm(it[0], cwd)).node; if (n && n.dir) { err += "grep: " + it[0] + ": Is a directory\n"; items[i] = null; } } });
      }
      const live = items.filter(Boolean);
      const multi = live.length > 1 || o.r || o.R;
      let out = "", found = false;
      for (const [name, d] of live) {
        let count = 0;
        const ls = splitLines(d);
        for (let i = 0; i < ls.length; i++) {
          if (re.test(ls[i]) !== !!o.v) {
            count++; found = true;
            if (o.l || o.c) continue;
            out += (multi && !o.h ? name + ":" : "") + (o.n ? i + 1 + ":" : "") + ls[i] + "\n";
          }
        }
        if (o.l && count) out += name + "\n";
        if (o.c) out += (multi && !o.h ? name + ":" : "") + count + "\n";
      }
      return R(out, err, err && !found ? 2 : found ? 0 : 1);
    },
    async find(args) {
      const paths = [];
      let i = 0;
      while (i < args.length && !args[i].startsWith("-")) paths.push(args[i++]);
      if (!paths.length) paths.push(".");
      const tests = [];
      for (; i < args.length; i++) {
        const a = args[i], v = args[i + 1];
        if (a === "-name" || a === "-iname") { if (v === undefined) return R("", "find: missing argument to '" + a + "'\n", 1); const re = globRe(v, a === "-iname" ? "i" : ""); tests.push((p, n, base) => re.test(base)); i++; }
        else if (a === "-type") { if (v !== "f" && v !== "d") return R("", "find: bad arg '" + v + "'\n", 1); tests.push((p, n) => (v === "d" ? n.dir : !n.dir)); i++; }
        else if (a === "-print") continue;
        else return R("", "find: unrecognized: " + a + "\n", 1);
      }
      let out = "", err = "";
      for (const p of paths) walk(norm(p, cwd), p, (path, n) => { const base = path === p ? p.split("/").filter(Boolean).pop() || p : path.slice(path.lastIndexOf("/") + 1); if (tests.every((t) => t(path, n, base))) out += path + "\n"; }, (path, e) => { err += "find: " + path + ": " + ERRTXT[e] + "\n"; }, true);
      return R(out, err, err ? 1 : 0);
    },
    async cut(args, stdin) {
      const { o, rest } = opts(args, "dfc");
      if (!o.f && !o.c) return R("", "cut: expected a list of bytes, characters, or fields\n", 1);
      const ranges = (o.f || o.c).split(",").map((r) => { const m = r.split("-"); const a = m[0] ? +m[0] : 1, b = m.length > 1 ? (m[1] ? +m[1] : Infinity) : a; return [a, b]; });
      const want = (k) => ranges.some(([a, b]) => k >= a && k <= b);
      const delim = o.d === undefined ? "\t" : o.d || " ";
      const { items, err } = fileInputs(rest, stdin, "cut");
      let out = "";
      for (const [, d] of items) for (const line of splitLines(d)) {
        if (o.c) { out += Array.from(line).filter((_, k) => want(k + 1)).join("") + "\n"; continue; }
        if (!line.includes(delim)) { if (!o.s) out += line + "\n"; continue; }
        out += line.split(delim).filter((_, k) => want(k + 1)).join(delim) + "\n";
      }
      return R(out, err, err ? 1 : 0);
    },
    async sort(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest, stdin, "sort");
      let l = [].concat(...items.map(([, d]) => splitLines(d)));
      if (o.n) l.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || (a < b ? -1 : a > b ? 1 : 0));
      else l.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (o.r) l.reverse();
      if (o.u) l = l.filter((x, i) => i === 0 || x !== l[i - 1]);
      return R(joinLines(l), err, err ? 1 : 0);
    },
    async uniq(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest.slice(0, 1), stdin, "uniq");
      const l = items.length ? splitLines(items[0][1]) : [];
      let out = "";
      for (let i = 0; i < l.length;) {
        let j = i; while (j < l.length && l[j] === l[i]) j++;
        const n = j - i;
        if ((!o.d || n > 1) && (!o.u || n === 1)) out += (o.c ? String(n).padStart(7) + " " : "") + l[i] + "\n";
        i = j;
      }
      return R(out, err, err ? 1 : 0);
    },
    async base64(args, stdin) {
      if (args.includes("--help")) return R("", "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: base64 [-d] [-w COL] [FILE]\n\nBase64 encode or decode FILE to standard output\n\t-d\tDecode data\n\t-w COL\tWrap lines at COL (default 76, 0 disables)\n", 1);
      const { o, rest } = opts(args, "w");
      const { items, err } = fileInputs(rest.slice(0, 1), stdin, "base64");
      if (err) return R("", err, 1);
      const d = items[0][1];
      if (o.d) { try { return R(b64decode(d)); } catch (e) { return R("", "base64: invalid input\n", 1); } }
      const wrap = o.w === undefined ? 76 : +o.w;
      return R(b64encode(d, wrap));
    },
    async sha256sum(args, stdin) {
      const { items, err } = fileInputs(args, stdin, "sha256sum");
      let out = "";
      for (const [name, d] of items) out += (await sha256hex(d)) + "  " + name + "\n";
      return R(out, err, err ? 1 : 0);
    },
    async chmod(args) {
      if (args.length < 2) return R("", "Usage: chmod [-R] MODE[,MODE]... FILE...\n", 1);
      const mode = args[0];
      let err = "";
      for (const f of args.slice(1)) {
        const r = lookup(norm(f, cwd));
        if (r.err) { err += "chmod: " + f + ": " + ERRTXT[r.err] + "\n"; continue; }
        if (r.node.owner !== USER) { err += "chmod: " + f + ": Operation not permitted\n"; continue; }
        if (/^[0-7]{3,4}$/.test(mode)) { r.node.mode = parseInt(mode, 8) & 0o777; continue; }
        const m = mode.match(/^([ugoa]*)([+-=])([rwx]+)$/);
        if (!m) { err += "chmod: invalid mode '" + mode + "'\n"; break; }
        const who = m[1] || "a";
        let bits = 0;
        for (const c of m[3]) bits |= { r: 4, w: 2, x: 1 }[c];
        let mask = 0;
        if (/[ua]/.test(who)) mask |= bits << 6; if (/[ga]/.test(who)) mask |= bits << 3; if (/[oa]/.test(who)) mask |= bits;
        if (m[2] === "+") r.node.mode |= mask; else if (m[2] === "-") r.node.mode &= ~mask; else r.node.mode = mask;
      }
      return R("", err, err ? 1 : 0);
    },
    async mkdir(args) {
      const { rest } = opts(args);
      let err = "";
      for (const f of rest) {
        const abs = norm(f, cwd), { dir } = parentOf(abs), pr = lookup(dir);
        if (lookup(abs).node) { err += "mkdir: can't create directory '" + f + "': File exists\n"; continue; }
        if (pr.err || !pr.node.dir) { err += "mkdir: can't create directory '" + f + "': No such file or directory\n"; continue; }
        if (!canWrite(pr.node)) { err += "mkdir: can't create directory '" + f + "': Permission denied\n"; continue; }
        put(abs, mkdir(0o755, USER));
      }
      return R("", err, err ? 1 : 0);
    },
    async touch(args) {
      let err = "";
      for (const f of args) { const e = writeFile(f, "", true); if (e) err += "touch: " + f + ": Permission denied\n"; }
      return R("", err, err ? 1 : 0);
    },
    async rm(args) {
      const { o, rest } = opts(args);
      let err = "";
      for (const f of rest) {
        const abs = norm(f, cwd), r = lookup(abs);
        if (r.err) { if (!o.f) err += "rm: can't remove '" + f + "': " + ERRTXT[r.err] + "\n"; continue; }
        if (r.node.dir && !o.r && !o.R) { err += "rm: '" + f + "' is a directory\n"; continue; }
        const { dir, name } = parentOf(abs), p = lookup(dir).node;
        if (!canWrite(p)) { err += "rm: can't remove '" + f + "': Permission denied\n"; continue; }
        delete p.kids[name];
      }
      return R("", err, err ? 1 : 0);
    },
    async less(args, stdin) { return CMDS.cat(args, stdin); },
    async more(args, stdin) { return CMDS.cat(args, stdin); },
    async clear() { return R("\x1b[2J\x1b[3J\x1b[H"); },
    async history() { return R(history.map((h, i) => String(i + 1).padStart(5) + "  " + h).join("\n") + "\n"); },
    async date() { return R(new Date().toString() + "\n"); },
    async true() { return R(); },
    async false() { return R("", "", 1); },
    async which(args) { return R(args.filter((a) => ROOT.kids.bin.kids[a]).map((a) => "/bin/" + a).join("\n") + (args.length ? "\n" : ""), "", 0); },
    async sh(args) {
      if (!args.length) return R("", "Lite mode: a nested shell is not available. You are already in one.\n", 1);
      const r = readFile(args[0], "sh");
      if (r.err) return R("", r.err.replace("sh: can't open", "sh: can't open"), 2);
      return runScript(r.data);
    },
    async tr(args, stdin) {
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
    async help() {
      return R("CyberQuest lite mode: a simulated shell (this browser blocks WebAssembly,\nso the real Linux computer can't run here).\n\nCommands that work:\n  " + Object.keys(CMDS).filter((c) => c !== "help").sort().join(" ") + "\n\nAlso: pipes |, > and >> redirects, ; and &&, quotes, * wildcards, Tab and the Up arrow.\n");
    },
    async mission(args) { return R(MISSION_TEXT[args[0]] || MISSION_OVERVIEW); },
    // hint N shows the hints you have and the price of the next; hint N --show buys it.
    // Each costs 5% of the mission's points, charged once (the page keeps the score). Warm-up hint is free.
    async hint(args) {
      if (args[0] === "0") return R(HINTS[0] + "\n");
      const n = Number(args[0]), list = HINTS[args[0]];
      if (!list) return R("Usage: hint 1   (up to " + MISSION_COUNT + ")\n", "", 1);
      const have = hintsSeen[n] || 0, line = (k) => "Hint " + k + " of " + list.length + ": " + list[k - 1] + "\n";
      let out = "";
      for (let k = 1; k <= have; k++) out += line(k);
      if (args[1] === "--show") {
        if (have >= list.length) return R(out + "No more hints for mission " + n + ".\n");
        const k = have + 1; hintsSeen[n] = k; onHint(n, k);
        return R(out + line(k) + "[quest] hint " + n + "." + k + " used (-" + HINT_COST[n] + " points)\n");
      }
      if (have >= list.length) return R(out + "That is every hint for mission " + n + ".\n");
      return R(out + "Hint " + (have + 1) + " of " + list.length + " costs " + HINT_COST[n] + " points (5% of " + MISSION_POINTS[n] + "), charged once.\nTo see it, type:  hint " + n + " --show\n");
    },
    async submit(args) {
      if (!args[0]) return R("Usage: submit CYBA{...}\n", "", 1);
      const h = await sha256hex(args[0]);
      for (let n = 0; n <= MISSION_COUNT; n++) if (FLAGHASH[n] === h) { onMission(n); return R("Correct! +" + MISSION_POINTS[n] + " points   [quest] mission " + n + " complete\n"); }
      return R((/^CYBA\{.+\}$/.test(args[0]) ? "Incorrect flag. Keep hunting!" : "That doesn't look like a flag. Copy the whole thing, CYBA{ to }.") + "\n", "", 1);
    },
  };
  CMDS.egrep = CMDS.grep;

  function headTail(args, stdin, cmd) {
    const { o, rest } = opts(args, "n");
    const n = +(o.n || o.num || 10);
    const { items, err } = fileInputs(rest, stdin, cmd);
    let out = "";
    items.forEach(([name, d], i) => {
      if (items.length > 1) out += (i ? "\n" : "") + "==> " + name + " <==\n";
      const l = splitLines(d);
      out += joinLines(cmd === "head" ? l.slice(0, n) : l.slice(Math.max(0, l.length - n)));
    });
    return R(out, err, err ? 1 : 0);
  }

  // Depth-first walk (sorted) for find and grep -r.
  function walk(abs, shown, visit, onErr, includeDirs) {
    const r = lookup(abs);
    if (r.err) { onErr(shown, r.err); return; }
    visit(shown, r.node);
    if (!r.node.dir) return;
    if (!canRead(r.node) || !canExec(r.node)) { onErr(shown, "EACCES"); return; }
    for (const k of Object.keys(r.node.kids).sort()) walk(abs === "/" ? "/" + k : abs + "/" + k, shown.endsWith("/") ? shown + k : shown + "/" + k, visit, onErr, includeDirs);
  }

  // Write a file for a redirect. Returns an error string or "".
  function writeFile(name, data, append) {
    const abs = norm(name, cwd);
    if (abs === "/dev/null") return "";
    const r = lookup(abs);
    if (r.node) {
      if (r.node.dir) return "Is a directory";
      if (!canWrite(r.node)) return "Permission denied";
      r.node.data = append ? r.node.data + data : data;
      r.node.mtime = new Date();
      return "";
    }
    const { dir } = parentOf(abs), p = lookup(dir);
    if (p.err) return ERRTXT[p.err];
    if (!p.node.dir) return "Not a directory";
    if (!canWrite(p.node)) return "Permission denied";
    put(abs, mkfile(data, 0o644, USER));
    return "";
  }

  // ------------------------------------------------------------- the parser
  // Tokenise one command line into words and operators, honouring quotes.
  function tokenize(line) {
    const toks = [];
    let cur = null, quoted = false, i = 0;
    const push = () => { if (cur !== null) toks.push({ w: cur, q: quoted }); cur = null; quoted = false; };
    while (i < line.length) {
      const c = line[i];
      if (c === "'") { const j = line.indexOf("'", i + 1); if (j < 0) return { err: "unterminated quoted string" }; cur = (cur || "") + line.slice(i + 1, j); quoted = true; i = j + 1; continue; }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < line.length && line[j] !== '"') { if (line[j] === "\\" && j + 1 < line.length && '"\\$`'.includes(line[j + 1])) { s += line[j + 1]; j += 2; } else s += line[j++]; }
        if (j >= line.length) return { err: "unterminated quoted string" };
        cur = (cur || "") + s; quoted = true; i = j + 1; continue;
      }
      if (c === "\\" && i + 1 < line.length) { cur = (cur || "") + line[i + 1]; quoted = true; i += 2; continue; }
      if (c === " " || c === "\t") { push(); i++; continue; }
      if (c === "|" || c === ";" || c === "&") {
        push();
        if (line.startsWith("&&", i)) { toks.push({ op: "&&" }); i += 2; continue; }
        if (line.startsWith("||", i)) { toks.push({ op: "||" }); i += 2; continue; }
        if (c === "&") { i++; continue; }
        toks.push({ op: c }); i++; continue;
      }
      if (c === ">" || (c === "2" && line[i + 1] === ">" && cur === null) || (c === "<")) {
        push();
        let op = c;
        if (c === "2") { op = line.startsWith("2>&1", i) ? "2>&1" : line.startsWith("2>>", i) ? "2>>" : "2>"; }
        else if (line.startsWith(">>", i)) op = ">>";
        toks.push({ op }); i += op.length; continue;
      }
      cur = (cur || "") + c; i++;
    }
    push();
    return { toks };
  }

  async function expand(line) {
    // $(...) command substitution (one level), then $VARS outside single quotes.
    let out = "", i = 0;
    while (i < line.length) {
      if (line[i] === "'") { const j = line.indexOf("'", i + 1); if (j < 0) { out += line.slice(i); break; } out += line.slice(i, j + 1); i = j + 1; continue; }
      if (line.startsWith("$(", i)) {
        let depth = 1, j = i + 2;
        while (j < line.length && depth) { if (line[j] === "(") depth++; else if (line[j] === ")") depth--; j++; }
        const res = await runLine(line.slice(i + 2, j - 1), true);
        out += res.out.replace(/\n+$/, "");
        i = j; continue;
      }
      if (line[i] === "$") {
        const m = line.slice(i + 1).match(/^(\?|[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})/);
        if (m) {
          const name = m[1].replace(/[{}]/g, "");
          const v = { HOME, USER, PWD: cwd, PATH: "/bin:/sbin", SHELL: "/bin/sh", HOSTNAME: "quest", "?": String(lastStatus) }[name];
          out += v === undefined ? "" : v;
          i += 1 + m[1].length; continue;
        }
      }
      out += line[i++];
    }
    return out;
  }

  function globExpand(word) {
    // Expand an unquoted word with wildcards in its last path part.
    const abs = word.startsWith("/") ? word : word === "~" || word.startsWith("~/") ? word : null;
    const slash = word.lastIndexOf("/");
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
    const pat = word.slice(slash + 1);
    if (!hasGlob(pat) || hasGlob(dirPart)) return [word];
    const r = lookup(norm(dirPart || ".", cwd));
    if (r.err || !r.node.dir || !canRead(r.node)) return [word];
    const re = globRe(pat);
    const hits = Object.keys(r.node.kids).filter((k) => re.test(k) && (pat.startsWith(".") || !k.startsWith("."))).sort();
    return hits.length ? hits.map((k) => dirPart + k) : [word];
  }

  async function runLine(rawLine, capture = false) {
    const line = await expand(rawLine);
    const t = tokenize(line);
    if (t.err) return R("", "-sh: syntax error: " + t.err + "\n", 2);
    // Split into "and/or lists" separated by ; && ||.
    const lists = [];
    let cur = [], joiner = ";";
    for (const tok of t.toks) {
      if (tok.op === ";" || tok.op === "&&" || tok.op === "||") { lists.push({ joiner, toks: cur }); cur = []; joiner = tok.op; }
      else cur.push(tok);
    }
    lists.push({ joiner, toks: cur });
    let all = R(), status = 0;
    for (const { joiner: j, toks } of lists) {
      if (!toks.length) continue;
      if (j === "&&" && status !== 0) continue;
      if (j === "||" && status === 0) continue;
      const res = await runPipeline(toks, capture);
      all.out += res.out; all.err += res.err; status = res.code;
    }
    all.code = status;
    lastStatus = status;
    return all;
  }

  async function runPipeline(toks, capture) {
    const stages = [[]];
    for (const tok of toks) { if (tok.op === "|") stages.push([]); else stages[stages.length - 1].push(tok); }
    let input = "", res = R(), errAll = "";
    for (let s = 0; s < stages.length; s++) {
      const words = [], redir = [];
      const st = stages[s];
      for (let i = 0; i < st.length; i++) {
        const tok = st[i];
        if (tok.op) {
          if (tok.op === "2>&1") { redir.push({ op: tok.op }); continue; }
          const target = st[i + 1];
          if (!target || target.op) return R("", "-sh: syntax error: unexpected newline\n", 2);
          redir.push({ op: tok.op, file: target.w }); i++; continue;
        }
        let w = tok.w;
        if (!tok.q && (w === "~" || w.startsWith("~/"))) w = HOME + w.slice(1);
        if (!tok.q && hasGlob(w)) words.push(...globExpand(w)); else words.push(w);
      }
      if (!words.length && !redir.length) return R("", "-sh: syntax error: unexpected \"|\"\n", 2);
      let stdin = input;
      for (const r of redir) if (r.op === "<") { const f = readFile(r.file, "-sh"); if (f.err) return R("", "-sh: can't open " + r.file + ": No such file\n", 1); stdin = f.data; }
      isTTY = !capture && s === stages.length - 1 && !redir.some((r) => r.op === ">" || r.op === ">>");
      res = words.length ? await runCommand(words, stdin) : R();
      for (const r of redir) {
        if (r.op === ">" || r.op === ">>") { const e = writeFile(r.file, res.out, r.op === ">>"); if (e) { res.err += "-sh: can't create " + r.file + ": " + e + "\n"; res.code = 1; } res.out = ""; }
        if (r.op === "2>" || r.op === "2>>") { if (r.file !== "/dev/null") writeFile(r.file, res.err, r.op === "2>>"); res.err = ""; }
        if (r.op === "2>&1") { res.out += res.err; res.err = ""; }
      }
      errAll += res.err;
      input = res.out;
    }
    return R(res.out, errAll, res.code);
  }

  async function runCommand(words, stdin) {
    let [name, ...args] = words;
    if (name.includes("/")) {
      // ./script or /path/to/file
      const abs = norm(name, cwd), r = lookup(abs);
      if (r.err) return R("", "-sh: " + name + ": " + (r.err === "ENOENT" ? "not found" : ERRTXT[r.err]) + "\n", 127);
      if (abs.startsWith("/bin/") && CMDS[parentOf(abs).name]) return CMDS[parentOf(abs).name](args, stdin);
      if (r.node.dir || !canExec(r.node)) return R("", "-sh: " + name + ": Permission denied\n", 126);
      return runScript(r.node.data);
    }
    if (args.includes("--help") && HELP[name]) return R("", HELP[name], 1);
    if (args.includes("--help") && CMDS[name]) return R("", "Usage: " + name + " ... (short help in lite mode)\n", 0);
    if (name === "man") return R("", "man: not available here. Try: " + (args[0] || "COMMAND") + " --help\n", 1);
    const fn = CMDS[name];
    if (fn) return fn(args, stdin);
    if (APPLETS.includes(name)) return R("", "-sh: " + name + ": not available in lite mode (type help for the list)\n", 127);
    return R("", "-sh: " + name + ": not found\n", 127);
  }

  async function runScript(text) {
    const all = R();
    for (const l of splitLines(text)) {
      if (!l.trim() || l.trim().startsWith("#")) continue;
      const r = await runLine(l);
      all.out += r.out; all.err += r.err; all.code = r.code;
    }
    return all;
  }

  // --------------------------------------------------------- the terminal UI
  let term = null, buf = "", pos = 0, hIdx = 0, busy = false, lastTab = 0;
  const prompt = () => {
    const shown = cwd === HOME ? "~" : cwd.startsWith(HOME + "/") ? "~" + cwd.slice(HOME.length) : cwd;
    return "\x1b[1;32m" + USER + "\x1b[0m@quest:\x1b[1;34m" + shown + "\x1b[0m$ ";
  };
  const write = (s) => term.write(s.replace(/\r?\n/g, "\r\n"));
  function redraw() {
    term.write("\r\x1b[K" + prompt() + buf);
    const back = buf.length - pos;
    if (back > 0) term.write("\x1b[" + back + "D");
  }

  function complete() {
    const before = buf.slice(0, pos);
    const m = before.match(/(\S*)$/);
    const word = m[1];
    const isFirst = before.slice(0, before.length - word.length).trim() === "" || /[|;&]\s*$/.test(before.slice(0, before.length - word.length));
    let cands = [];
    let prefix = word, dirShown = "";
    if (isFirst && !word.includes("/")) cands = Object.keys(CMDS).concat(APPLETS).filter((c, i, a) => a.indexOf(c) === i && c.startsWith(word)).map((c) => c + " ");
    else {
      const slash = word.lastIndexOf("/");
      dirShown = slash >= 0 ? word.slice(0, slash + 1) : "";
      prefix = word.slice(slash + 1);
      const r = lookup(norm(dirShown || ".", cwd));
      if (r.node && r.node.dir && canRead(r.node))
        cands = Object.keys(r.node.kids).filter((k) => k.startsWith(prefix) && (prefix.startsWith(".") || !k.startsWith("."))).sort().map((k) => k + (r.node.kids[k].dir ? "/" : " "));
    }
    if (!cands.length) return;
    let common = cands[0];
    for (const c of cands) while (!c.startsWith(common)) common = common.slice(0, -1);
    const add = common.slice(prefix.length);
    if (add) { buf = buf.slice(0, pos) + add + buf.slice(pos); pos += add.length; redraw(); lastTab = 0; return; }
    if (cands.length > 1) {
      if (Date.now() - lastTab < 1500) {
        const names = cands.map((c) => c.trimEnd());
        write("\n" + columns(names, names.map((n) => n.length)));
        redraw();
        lastTab = 0;
      } else lastTab = Date.now();
    }
  }

  async function enter() {
    const line = buf;
    write("\n");
    buf = ""; pos = 0;
    if (line.trim()) { history.push(line); }
    hIdx = history.length;
    busy = true;
    try {
      const r = await runLine(line);
      if (r.out) write(r.out);
      if (r.err) write(r.err);
    } catch (e) {
      write("-sh: internal error: " + e.message + "\n");
    }
    busy = false;
    term.write(prompt());
  }

  async function onData(data) {
    if (busy) return;
    // Pasted text can hold several lines: run them one after another.
    if (data.length > 1 && /[\r\n]/.test(data) && !data.startsWith("\x1b")) {
      const parts = data.split(/\r\n|\r|\n/);
      for (let i = 0; i < parts.length; i++) {
        buf = buf.slice(0, pos) + parts[i] + buf.slice(pos); pos += parts[i].length;
        if (i < parts.length - 1) { term.write(parts[i]); await enter(); }
        else redraw();
      }
      return;
    }
    switch (data) {
      case "\r": await enter(); return;
      case "\x7f": case "\b": if (pos > 0) { buf = buf.slice(0, pos - 1) + buf.slice(pos); pos--; redraw(); } return;
      case "\x1b[3~": if (pos < buf.length) { buf = buf.slice(0, pos) + buf.slice(pos + 1); redraw(); } return;
      case "\t": complete(); return;
      case "\x03": write("^C\n"); buf = ""; pos = 0; term.write(prompt()); return;
      case "\x0c": term.clear(); redraw(); return;
      case "\x15": buf = buf.slice(pos); pos = 0; redraw(); return;
      case "\x01": case "\x1b[H": case "\x1bOH": pos = 0; redraw(); return;
      case "\x05": case "\x1b[F": case "\x1bOF": pos = buf.length; redraw(); return;
      case "\x1b[D": if (pos > 0) { pos--; term.write(data); } return;
      case "\x1b[C": if (pos < buf.length) { pos++; term.write(data); } return;
      case "\x1b[A": if (hIdx > 0) { hIdx--; buf = history[hIdx]; pos = buf.length; redraw(); } return;
      case "\x1b[B": if (hIdx < history.length) { hIdx++; buf = history[hIdx] || ""; pos = buf.length; redraw(); } return;
    }
    if (data.startsWith("\x1b")) return;
    const clean = data.replace(/[\x00-\x1f]/g, "");
    if (!clean) return;
    buf = buf.slice(0, pos) + clean + buf.slice(pos);
    pos += clean.length;
    if (pos === buf.length) term.write(clean); else redraw();
  }

  function fit(container) {
    // Size the terminal to its box: measure one character in the terminal font.
    const probe = document.createElement("span");
    probe.textContent = "W".repeat(50);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-family:" + term.options.fontFamily + ";font-size:" + term.options.fontSize + "px;line-height:normal";
    document.body.appendChild(probe);
    const cw = probe.getBoundingClientRect().width / 50;
    document.body.removeChild(probe);
    const rect = container.getBoundingClientRect();
    const ch = term.options.fontSize * (term.options.lineHeight || 1) * 1.2;
    const cols = Math.max(40, Math.floor((rect.width - 24) / cw));
    const rows = Math.max(12, Math.floor((rect.height - 8) / ch));
    term.resize(cols, rows);
  }

  const BANNER = {"wide": "  \u001b[38;2;139;152;173mW E L C O M E   T O\u001b[0m\n   \u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;70;211;154m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;62;197;170m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;55;183;187m\u2588\u2588\u001b[38;2;59;74;102m\u2551      \u255a\u001b[38;2;55;183;187m\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d \u001b[38;2;55;183;187m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;55;183;187m\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557  \u001b[38;2;55;183;187m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[0m\n  \u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2551       \u255a\u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d  \u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d  \u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;47;168;203m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;59;74;102m\u255a\u001b[38;2;41;153;214m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;41;153;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;41;153;214m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;41;153;214m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;41;153;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551  \u001b[38;2;41;153;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n   \u001b[38;2;59;74;102m\u255a\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u001b[0m\n   \u001b[38;2;38;114;215m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;38;114;215m\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;38;114;215m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;38;114;215m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;38;114;215m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;38;114;215m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u001b[38;2;37;95;216m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d\u001b[0m\n  \u001b[38;2;55;90;221m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;55;90;221m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;55;90;221m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;55;90;221m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;55;90;221m\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557  \u001b[38;2;55;90;221m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;55;90;221m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n  \u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;83;90;230m\u2584\u2584 \u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;83;90;230m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n  \u001b[38;2;59;74;102m\u255a\u001b[38;2;111;91;238m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u255a\u001b[38;2;111;91;238m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;111;91;238m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;111;91;238m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;111;91;238m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n   \u001b[38;2;59;74;102m\u255a\u2550\u2550\u001b[38;2;139;92;246m\u2580\u2580\u001b[38;2;59;74;102m\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d\u001b[0m\n  \u001b[38;2;59;74;102m\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[1;97mSIMULATED CTF COMPETITION\u001b[0m                \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[38;2;139;152;173mLinux CTF  \u00b7  10 missions  \u00b7  10 flags\u001b[0m   \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\u001b[0m\n\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Start:  \u001b[38;2;70;211;154mmission 1\u001b[0m   (or use the mission panel)\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Flags look like \u001b[1;97mCYBA{word-1a2b3c4d}\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Check one:  \u001b[38;2;70;211;154msubmit CYBA{...}\u001b[0m    Stuck?  \u001b[38;2;70;211;154mhint 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Instructions:  \u001b[38;2;70;211;154mcat README.txt\u001b[0m  (home and each mission folder)\n\n", "small": "  \u001b[38;2;139;152;173mW E L C O M E   T O\u001b[0m\n    \u001b[38;2;70;211;154m_____   _____ ___ ___\u001b[0m\n   \u001b[38;2;58;189;180m/ __\\ \\ / / _ ) __| _ \\\u001b[0m\n  \u001b[38;2;46;166;205m| (__ \\ \u001b[38;2;59;74;102mV \u001b[38;2;46;166;205m/| _ \\ _||   /\u001b[0m\n   \u001b[38;2;40;139;215m\\___| |_| |___/___|_|_\\\u001b[0m\n    \u001b[38;2;38;109;215m___  _   _ ___ ___ _____\u001b[0m\n   \u001b[38;2;51;89;220m/ _ \\| | | | __/ __|_   _|\u001b[0m\n  \u001b[38;2;95;91;233m| (_) | |_| | _|\\__ \\ | |\u001b[0m\n   \u001b[38;2;139;92;246m\\__\\_\\\\___/|___|___/ |_|\u001b[0m\n  \u001b[38;2;59;74;102m\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[1;97mSIMULATED CTF COMPETITION\u001b[0m  \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[38;2;139;152;173mLinux CTF \u00b7 10 flags\u001b[0m       \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\u001b[0m\n\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Start: \u001b[38;2;70;211;154mmission 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Check: \u001b[38;2;70;211;154msubmit CYBA{...}\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Stuck? \u001b[38;2;70;211;154mhint 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Help:  \u001b[38;2;70;211;154mcat README.txt\u001b[0m\n\n"};
  async function start(container, hooks = {}) {
    onMission = hooks.onMission || onMission;
    onHint = hooks.onHint || onHint;
    const t0 = performance.now();
    await buildWorld();
    term = new window.Terminal({
      fontFamily: 'ui-monospace, "Cascadia Mono", Menlo, Consolas, "Courier New", monospace',
      fontSize: 15,
      cursorBlink: true,
      convertEol: false,
      theme: { background: "#000000", foreground: "#e6edf7" },
    });
    term.open(container);
    fit(container);
    window.addEventListener("resize", () => fit(container));
    term.onData((d) => { onData(d); });
    if (window.questClipboardKeys) window.questClipboardKeys(term);
    write(BANNER[term.cols >= 50 ? "wide" : "small"] +
      "  \x1b[2mLite mode: a simulated shell. Type help for its commands.\x1b[0m\n\n");
    term.write(prompt());
    term.focus();
    window.questLite = { runLine };
    return { seconds: (performance.now() - t0) / 1000 };
  }

  // Type a command into the terminal as if the student had (used by the page's run buttons).
  async function typeLine(cmd) { if (!term || busy) return; buf = ""; pos = 0; redraw(); await onData(cmd); await onData("\r"); term.focus(); }

  window.LinuxQuestLite = { start, typeLine };
})();
