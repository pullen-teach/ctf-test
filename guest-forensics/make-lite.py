"""Make public/forensics/lite.js from public/lite.js: same shell, forensics world and tools.
Run before make-forensics.py (which fills in the mission text) and make-banner.py."""
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE) + '/'
s = open(W + 'public/lite.js').read()
def sub(o, n):
    global s
    assert o in s, o[:80]
    s = s.replace(o, n, 1)

sub('// Linux Quest "lite mode": a simulated Linux shell in plain JavaScript.',
    '// CyberQuest Forensics CTF "lite mode": the same simulated shell as the Linux CTF,\n// with the forensics missions and tools (strings, filetype, tar, zcat, sha256sum -c).\n// Made from public/lite.js by guest-forensics/make-lite.py; regenerate rather than edit.')

HELPERS = r'''
  // ---------------------------------------------------------------- forensics helpers
  // Binary files are kept as strings with one character per byte (0 to 255).
  const bytesOf = (t) => Uint8Array.from(t, (c) => c.charCodeAt(0) & 255);
  function strOf(b) { let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; }
  async function pipeStream(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  const gzipStr = async (t) => strOf(await pipeStream(bytesOf(t), new CompressionStream("gzip")));
  const gunzipStr = async (t) => strOf(await pipeStream(bytesOf(t), new DecompressionStream("gzip")));
  const isGzip = (t) => t.charCodeAt(0) === 0x1f && t.charCodeAt(1) === 0x8b;
  // Random bytes with no printable characters, so strings finds only what is planted.
  function noise(n) { let s = ""; for (const b of randBytes(n)) if (b < 32 ? b !== 9 && b !== 10 && b !== 13 : b > 126) s += String.fromCharCode(b); return s; }
  const jpeg = (n) => "\xff\xd8\xff\xe0\x00\x10JFIF\x00" + noise(n) + "\xff\xd9";
  const toBytes = (t) => Array.from(bytesOf(t));
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
  // A minimal ustar archive: enough for tar -t and tar -x.
  function tarPack(files) {
    let out = "";
    const oct = (n, w) => n.toString(8).padStart(w - 1, "0") + "\0";
    const field = (v, w) => (v + "\0".repeat(w)).slice(0, w);
    const now = Math.floor(Date.now() / 1000);
    for (const [name, data] of files) {
      let h = field(name, 100) + oct(0o644, 8) + oct(1000, 8) + oct(1000, 8) + oct(data.length, 12) + oct(now, 12) + "        " + "0" + field("", 100) + "ustar\0" + "00" + field("player", 32) + field("player", 32) + field("", 183);
      let sum = 0; for (let i = 0; i < h.length; i++) sum += h.charCodeAt(i);
      h = h.slice(0, 148) + sum.toString(8).padStart(6, "0") + "\0 " + h.slice(156);
      out += h + data + "\0".repeat((512 - (data.length % 512)) % 512);
    }
    return out + "\0".repeat(1024);
  }
  function tarList(t) {
    const out = [];
    for (let off = 0; off + 512 <= t.length;) {
      const h = t.slice(off, off + 512);
      if (!/[^\0]/.test(h)) break;
      if (h.slice(257, 262) !== "ustar") return null;
      const name = h.slice(0, 100).replace(/\0.*$/s, ""), size = parseInt(h.slice(124, 136).replace(/[\0 ]/g, "") || "0", 8);
      out.push([name, t.substr(off + 512, size), h[156] === "5"]);
      off += 512 + Math.ceil(size / 512) * 512;
    }
    return out;
  }
  function fileType(d) {
    const m = toHex(toBytes(d.slice(0, 4)));
    if (m.startsWith("ffd8ff")) return "JPEG image data";
    if (m === "89504e47") return "PNG image data";
    if (m.startsWith("1f8b")) return "gzip compressed data";
    if (m === "25504446") return "PDF document";
    if (m === "504b0304") return "Zip archive data";
    if (m === "7f454c46") return "ELF program";
    if (!d.length) return "empty";
    if (d.slice(257, 262) === "ustar") return "POSIX tar archive";
    return /[^\t\r\n\x20-\x7e]/.test(d.slice(0, 512)) ? "data" : "ASCII text";
  }
  const p2 = (n) => String(n).padStart(2, "0");
  const DAY = (() => { const d = new Date(Date.now() - 86400000); return [d.getFullYear(), d.getMonth(), d.getDate()]; })();
  const DAYSTR = DAY[0] + "-" + p2(DAY[1] + 1) + "-" + p2(DAY[2]);
  const DOC_IPS = ["192.0.2.10", "192.0.2.24", "198.51.100.7", "198.51.100.42", "203.0.113.5", "203.0.113.88"];
  const INTRUDERS = ["203.0.113.66", "198.51.100.201", "192.0.2.150", "203.0.113.250", "198.51.100.99"];
  const USERS = ["mia", "noah", "liam", "ava", "zoe", "eli"];
  // An sshd log, one line per login attempt (same shape as guest-forensics/build-missions).
  function authlog(aip, auser, aticket, af) {
    const T = (sec) => DAYSTR + "T" + p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor((sec % 3600) / 60)) + ":" + p2(sec % 60);
    const lines = [], start = 7200 + randInt(1800);
    for (let i = 0; i < af; i++) lines.push(T(start + i * 37 + randInt(30)) + " sshd: Failed password for " + pick(["admin", "root", "test", "guest", "oracle"]) + " from " + aip);
    lines.push(T(start + af * 37 + 60) + " sshd: Accepted password for " + auser + " from " + aip + " ticket=" + aticket);
    for (const ip of DOC_IPS) { const f = 1 + randInt(8); for (let i = 0; i < f; i++) lines.push(T(25200 + randInt(43200)) + " sshd: Failed password for " + pick(USERS) + " from " + ip); }
    for (const u of USERS) for (let i = 0; i < 2; i++) lines.push(T(25200 + randInt(43200)) + " sshd: Accepted password for " + u + " from " + pick(DOC_IPS) + " ticket=CYBA{session-" + hex(4) + "}");
    return lines.sort().join("\n") + "\n";
  }
  // A packet capture, listed the way Wireshark shows it (same shape as build-missions).
  function capture(xip, chunks) {
    const paths = ["/", "/about", "/contact", "/img/logo.png", "/css/site.css", "/js/app.js", "/pixel.gif?page=home", "/news", "/login"];
    const doms = ["www.example.com", "cdn.example.net", "mail.example.org", "updates.example.com"];
    const pad = (v, w) => (v + " ".repeat(w)).slice(0, Math.max(w, v.length));
    const row = (t, src, dst, proto, len, info) => [t, t.toFixed(6).padStart(10) + " " + pad(src, 16) + " " + pad(dst, 16) + " " + pad(proto, 8) + " " + String(len).padStart(6) + " " + info];
    const rows = [];
    for (let i = 0; i < 240; i++) {
      const t = Math.random() * 600, h = pick(DOC_IPS), k = randInt(3);
      if (k === 0) rows.push(row(t, h, "192.0.2.80", "HTTP", 300 + randInt(200), "GET " + pick(paths) + " HTTP/1.1"));
      else if (k === 1) rows.push(row(t, h, "192.0.2.53", "DNS", 70 + randInt(20), "Standard query 0x" + randInt(65535).toString(16).padStart(4, "0") + " A " + pick(doms)));
      else rows.push(row(t, "192.0.2.80", h, "TCP", 66, "443 -> " + (49152 + randInt(16000)) + " [ACK] Seq=1 Ack=1 Win=502"));
    }
    chunks.forEach((c, i) => rows.push(row(200 + Math.random() * 300, xip, "192.0.2.80", "HTTP", 412, "GET /pixel.gif?seq=" + p2(i + 1) + "&d=" + c + " HTTP/1.1")));
    return "  No.       Time Source           Destination      Protocol Length Info\n" + rows.sort((a, b) => a[0] - b[0]).map((r, i) => String(i + 1).padStart(5) + " " + r[1]).join("\n") + "\n";
  }
'''
sub('  // --------------------------------------------------------------- the shell', HELPERS + '\n  // --------------------------------------------------------------- the shell')

a = s.index('    // 1: make your move.')
b = s.index('\n  }\n', a)
WORLD = r'''    // Home: the game instructions, and the warm-up (Mission 0) at the bottom of orientation.txt.
    const readme = (dir, key, clue) => put(dir + "/README.txt", mkfile((clue ? clue + "\n" : "") + README_TEXT[key], 0o644, USER));
    const file = (p, d) => put(H + "/" + p, mkfile(d, 0o644, USER));
    const room = (n, clue) => { put(H + "/mission" + n, mkdir(0o755, USER)); readme(H + "/mission" + n, String(n), clue); };
    const at = (node, hh, mm) => { node.mtime = new Date(DAY[0], DAY[1], DAY[2], hh, mm); return node; };
    readme(H, "home");
    const FW = flag("warmup"); await keep(0, FW);
    file("orientation.txt", README_TEXT.orientation + "  " + FW + "\n");

    // 1: the file changed at the minute of the break-in
    const hh = 2 + randInt(4), mm = randInt(60);
    let F = flag("case"); await keep(1, F);
    room(1, "The break-in happened at " + p2(hh) + ":" + p2(mm) + " last night.\nOne file in evidence/ was changed at exactly that minute. Its flag is the real one.\n");
    const names1 = ["notes.txt", "budget.csv", "backup.log", "todo.txt", "contacts.csv", "report.txt", "memo.txt", "schedule.txt", "inventory.csv", "minutes.txt"];
    const real1 = pick(names1);
    for (const f of names1) {
      if (f === real1) at(file("mission1/evidence/" + f, "Last edited during the break-in.\nFlag: " + F + "\n"), hh, mm);
      else at(file("mission1/evidence/" + f, "Routine office file.\nFlag: " + flag("case") + "\n"), 8 + randInt(11), randInt(60));
    }
    // 2: hidden fields in a photo's metadata (a JPEG comment segment)
    F = flag("meta"); await keep(2, F); room(2);
    file("mission2/photo.jpg", "\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xfe\x00\x80" + "Camera: QuestCam X100\0Software: PhotoFix 2.1\0Taken: " + DAYSTR + " 02:41\0Author: night-shift\0Comment: " + F + "\0" + noise(2500) + "\xff\xd9");
    // 3: one "photo" is really a gzip file
    F = flag("label"); await keep(3, F); room(3);
    const odd = 1 + randInt(8);
    for (let i = 1; i <= 8; i++) file("mission3/photos/IMG_10" + (40 + i) + ".jpg", i === odd ? await gzipStr("This was never a photo.\nFlag: " + F + "\n") : jpeg(900 + i * 37));
    // 4: archives nested inside archives, with no helpful file extensions
    F = flag("dolls"); await keep(4, F); room(4);
    const inner = await gzipStr("You reached the smallest doll.\nFlag: " + F + "\n");
    file("mission4/evidence.tar.gz", await gzipStr(tarPack([["box", tarPack([["inner", inner]])]])));
    // 5: the IP with the most failed logins, and its one successful login
    F = flag("log"); await keep(5, F); room(5);
    file("mission5/auth.log", authlog(pick(INTRUDERS), pick(USERS), F, 31 + randInt(15)));
    // 6: base64 text hidden after the end of a JPEG
    F = flag("tail"); await keep(6, F); room(6);
    file("mission6/cat.jpg", jpeg(3000) + "\n" + b64encode("Hidden after the picture.\nFlag: " + F + "\n", 0));
    // 7: one program no longer matches its known-good fingerprint
    F = flag("tamper"); await keep(7, F); room(7);
    const tools = ["backup", "cleanup", "diskcheck", "logrotate", "netstat2", "printer-setup", "report", "scheduler", "updater", "viewer"];
    const prog = (b, id) => "\x7fELF\x02\x01\x01\x00" + noise(400) + b + " version 2.4.1\0build " + id + "\0" + noise(300);
    let manifest = "";
    for (const b of tools) { const d = prog(b, flag("build")); file("mission7/bin/" + b, d); manifest += (await sha256hex(d)) + "  bin/" + b + "\n"; }
    file("mission7/manifest.sha256", manifest);
    const bad = pick(tools); file("mission7/bin/" + bad, prog(bad, F));
    // 8: a scheduled task that runs a hidden script (the script itself does nothing)
    F = flag("cron"); await keep(8, F); room(8);
    const head = "# m h dom mon dow command\n";
    const cron = { root: head + "0 2 * * * /usr/local/bin/backup.sh\n30 3 * * 0 /usr/sbin/logrotate /etc/logrotate.conf\n", "www-data": head + "*/15 * * * * /usr/local/bin/cache-clean\n", mia: head + "0 9 * * 1-5 /home/mia/bin/send-report\n", noah: head + "15 12 * * * /home/noah/bin/sync-photos\n", billing: head + "0 0 1 * * /usr/local/bin/invoice-run\n" };
    cron[pick(Object.keys(cron))] += "*/10 * * * * /home/player/mission8/var/.cache/.sys-update.sh\n";
    for (const [u, t] of Object.entries(cron)) file("mission8/cron/" + u, t);
    file("mission8/var/.cache/.sys-update.sh", "#!/bin/sh\n# sys-update: \"keeps the system up to date\"\n# Evidence copy: the incident team disabled this script. It does nothing now.\nPAYLOAD=\"" + b64encode("Persistence found.\nFlag: " + F + "\n", 0).trim() + "\"\nexit 0\n");
    // 9: data that left the server in small pieces, hidden in web requests
    F = flag("pieces"); await keep(9, F); room(9);
    file("mission9/capture.txt", capture(pick(INTRUDERS), toHex(toBytes("Reassembled.\nFlag: " + F + "\n")).match(/.{1,8}/g)));
    // 10: case closed. Whose account? Which file? What is inside it?
    const cuser = pick(USERS);
    F = flag("closed"); await keep(10, F);
    room(10, "One account was broken into last night. auth.log shows how.\nThe stolen evidence is hidden in that user's folder under homes/.\n");
    file("mission10/auth.log", authlog(pick(INTRUDERS), cuser, "CYBA{session-" + hex(4) + "}", 31 + randInt(15)));
    for (const u of USERS) {
      file("mission10/homes/" + u + "/notes.txt", "Meeting notes for " + u + ".\n");
      file("mission10/homes/" + u + "/photo.jpg", jpeg(700));
      file("mission10/homes/" + u + "/report.pdf", "%PDF-1.4\n% report for " + u + "\n");
      file("mission10/homes/" + u + "/budget.csv", "quarter,total\nQ1,100\nQ2,120\n");
    }
    file("mission10/homes/" + cuser + "/" + pick(["notes.txt", "photo.jpg", "report.pdf", "budget.csv"]), await gzipStr(b64encode("Case closed.\nFlag: " + F + "\n", 76)));'''
s = s[:a] + WORLD + s[b:]

sub('for (const a of APPLETS.concat(["submit", "hint"]))', 'for (const a of APPLETS.concat(["submit", "hint", "mission", "filetype"]))')
# file sizes are bytes: one character per byte here
sub('const size = n.dir ? 4096 : enc.encode(n.data).length;', 'const size = n.dir ? 4096 : n.data.length;')
# head -c N and tail -c N (bytes)
sub('    async head(args, stdin) { return headTail(args, stdin, "head"); },\n    async tail(args, stdin) { return headTail(args, stdin, "tail"); },',
    r'''    async head(args, stdin) { return headTail(bytesArgs(args), stdin, "head"); },
    async tail(args, stdin) { return headTail(bytesArgs(args), stdin, "tail"); },''')
sub('  function headTail(args, stdin, cmd) {', r'''  // head/tail -c N: pull the byte count out so headTail can apply it.
  function bytesArgs(args) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
      const m = /^-c(\d*)$/.exec(args[i]);
      if (m) out.bytes = +(m[1] || args[++i]); else out.push(args[i]);
    }
    return out;
  }
  function headTail(args, stdin, cmd) {
    if (args.bytes !== undefined) {
      const { items, err } = fileInputs(args.filter((x) => !/^-/.test(x)), stdin, cmd);
      const n = args.bytes;
      return R(items.map(([, d]) => (cmd === "head" ? d.slice(0, n) : d.slice(Math.max(0, d.length - n)))).join(""), err, err ? 1 : 0);
    }''')
# sha256sum with -c
a = s.index('    async sha256sum(args, stdin) {')
b = s.index('    },\n', a) + len('    },\n')
s = s[:a] + r'''    async sha256sum(args, stdin) {
      const { o, rest } = opts(args);
      if (o.c) {
        const { items, err } = fileInputs(rest, stdin, "sha256sum");
        let out = "", bad = 0, e = err;
        for (const [, list] of items) for (const line of splitLines(list)) {
          const m = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim());
          if (!m) continue;
          const r = readFile(m[2], "sha256sum");
          if (r.err) { e += r.err; out += m[2] + ": FAILED open or read\n"; bad++; continue; }
          const ok = (await sha256hex(r.data)) === m[1];
          if (!ok) bad++;
          out += m[2] + ": " + (ok ? "OK" : "FAILED") + "\n";
        }
        if (bad) e += "sha256sum: WARNING: " + bad + " of " + items.reduce((n, [, l]) => n + splitLines(l).length, 0) + " computed checksums did NOT match\n";
        return R(out, e, bad ? 1 : 0);
      }
      const { items, err } = fileInputs(rest, stdin, "sha256sum");
      let out = "";
      for (const [name, d] of items) out += (await sha256hex(d)) + "  " + name + "\n";
      return R(out, err, err ? 1 : 0);
    },
''' + s[b:]
# sha256 of binary data: hash the bytes themselves, not their UTF-8 form
sub('    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));',
    '    const buf = await crypto.subtle.digest("SHA-256", /[^\\x00-\\x7f]/.test(text) ? Uint8Array.from(text, (c) => c.charCodeAt(0) & 255) : enc.encode(text));')

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
    async xxd(args, stdin) {
      const { o, rest } = opts(args);
      const { items, err } = fileInputs(rest.slice(0, 1), stdin, "xxd");
      if (err) return R("", err, 1);
      const d = items[0][1] || "";
      if (o.r) return R(strOf(Uint8Array.from(fromHex(d))));
      const bytes = toBytes(d);
      if (o.p) return R(wrapHex(toHex(bytes), 60));
      let out = "";
      for (let i = 0; i < bytes.length; i += 16) {
        const row = bytes.slice(i, i + 16), hx = toHex(row).replace(/(.{4})/g, "$1 ").trim();
        out += i.toString(16).padStart(8, "0") + ": " + hx.padEnd(40) + "  " + row.map(showByte).join("") + "\n";
      }
      return R(out);
    },
    async strings(args, stdin) {
      const { o, rest } = opts(args, "n");
      const n = +(o.n || 4), re = new RegExp("[\\x20-\\x7e\\t]{" + n + ",}", "g");
      const { items, err } = fileInputs(rest, stdin, "strings");
      return R(items.map(([, d]) => (d.match(re) || []).map((x) => x + "\n").join("")).join(""), err, err ? 1 : 0);
    },
    async filetype(args) {
      if (!args.length || args[0] === "--help" || args[0] === "-h") return R(HELP.filetype, "", args.length ? 0 : 1);
      let out = "";
      for (const f of args) {
        const r = lookup(norm(f, cwd));
        if (r.err) { out += f + ": cannot open\n"; continue; }
        out += f + ": " + (r.node.dir ? "directory" : fileType(r.node.data)) + "\n";
      }
      return R(out);
    },
    async zcat(args, stdin) {
      const { items, err } = fileInputs(args.filter((a) => !/^-/.test(a)), stdin, "zcat");
      let out = "", e = err;
      for (const [name, d] of items) {
        if (!isGzip(d || "")) { e += "zcat: " + (name === "-" ? "stdin" : name) + ": invalid magic\n"; continue; }
        try { out += await gunzipStr(d); } catch (x) { e += "zcat: corrupted data\n"; }
      }
      return R(out, e, e ? 1 : 0);
    },
    async gunzip(args, stdin) {
      const { o, rest } = opts(args);
      if (o.c || !rest.length) return CMDS.zcat(rest, stdin);
      let e = "";
      for (const f of rest) {
        if (!/\.(gz|tgz)$/.test(f)) { e += "gunzip: " + f + ": unknown suffix - ignored\n"; continue; }
        const r = readFile(f, "gunzip");
        if (r.err) { e += r.err; continue; }
        if (!isGzip(r.data)) { e += "gunzip: " + f + ": invalid magic\n"; continue; }
        const w = writeFile(f.replace(/\.gz$/, "").replace(/\.tgz$/, ".tar"), await gunzipStr(r.data), false);
        if (w) { e += "gunzip: " + f + ": " + w + "\n"; continue; }
        const abs = norm(f, cwd), { dir, name } = parentOf(abs);
        delete lookup(dir).node.kids[name];
      }
      return R("", e, e ? 1 : 0);
    },
    async tar(args) {
      let mode = "", z = false, v = false, file = null, dir = null;
      const rest = [];
      for (let i = 0; i < args.length; i++) {
        let a = args[i];
        if (a === "-C") { dir = args[++i]; continue; }
        if (i === 0 && !a.startsWith("-")) a = "-" + a;
        if (/^-[a-zA-Z]+$/.test(a)) {
          for (const c of a.slice(1)) {
            if ("xtc".includes(c)) mode = c; else if (c === "z") z = true; else if (c === "v") v = true;
            else if (c === "f") file = args[++i];
          }
        } else rest.push(a);
      }
      if (!mode) return R("", HELP.tar, 1);
      if (mode === "c") return R("", "tar: creating archives is not available in lite mode\n", 1);
      if (!file) return R("", "tar: specify an archive with -f FILE\n", 1);
      const r = readFile(file, "tar");
      if (r.err) return R("", r.err, 1);
      let data = r.data;
      if (z || isGzip(data)) { if (!isGzip(data)) return R("", "tar: invalid magic\n", 1); data = await gunzipStr(data); }
      const list = tarList(data);
      if (!list) return R("", "tar: invalid tar magic\n", 1);
      let out = "", e = "";
      for (const [name, d, isDir] of list) {
        if (mode === "t" || v) out += name + "\n";
        if (mode === "x") {
          const target = (dir ? dir.replace(/\/$/, "") + "/" : "") + name.replace(/\/$/, "");
          if (isDir) { if (!lookup(norm(target, cwd)).node) put(norm(target, cwd), mkdir(0o755, USER)); continue; }
          const w = writeFile(target, d, false);
          if (w) e += "tar: " + target + ": " + w + "\n";
        }
      }
      return R(out, e, e ? 1 : 0);
    },
    async help() {'''
sub('    async help() {', CMDS)

def js(t): return t.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
BB = W + 'guest/busybox'
def bb(name):
    r = subprocess.run([BB, name, '--help'], capture_output=True, text=True); r = r.stdout + r.stderr; return r
helps = {n: bb(n) for n in ["tr", "xxd", "strings", "tar", "zcat", "gunzip"]}
txt = open(HERE + '/tools/filetype').read()
helps["filetype"] = re.search(r"cat <<'EOT'\n(.*?)EOT", txt, re.S).group(1)
sub('  const HELP = {\n', '  const HELP = {\n' + "".join('"%s": "%s",\n' % (k, js(v)) for k, v in helps.items()))
open(W + 'public/forensics/lite.js', 'w').write(s)
print("ok")
