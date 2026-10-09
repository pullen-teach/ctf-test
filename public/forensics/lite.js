// CyberQuest Forensics CTF "lite mode": the same simulated shell as the Linux CTF,
// with the forensics missions and tools (strings, filetype, tar, zcat, sha256sum -c).
// Made from public/lite.js by guest-forensics/make-lite.py; regenerate rather than edit.
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
    const buf = await crypto.subtle.digest("SHA-256", /[^\x00-\x7f]/.test(text) ? Uint8Array.from(text, (c) => c.charCodeAt(0) & 255) : enc.encode(text));
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
    for (const a of APPLETS.concat(["submit", "hint", "mission", "filetype"])) ROOT.kids.bin.kids[a] = mkfile("", 0o755, "root");
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
    file("mission10/homes/" + cuser + "/" + pick(["notes.txt", "photo.jpg", "report.pdf", "budget.csv"]), await gzipStr(b64encode("Case closed.\nFlag: " + F + "\n", 76)));
  }


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

  // --------------------------------------------------------------- the shell
  let cwd = HOME, lastStatus = 0, isTTY = true;
  const history = [];
  let onMission = () => {};
  let onHint = () => {};
  const hintsSeen = {};

  // Mission briefs and hints. Generated by guest-forensics/make-forensics.py.
  const MISSION_TEXT = {
"1": "Mission 1: Case file   [Easy, 100 points]\n\nObjective: Find the evidence file that changed at the minute of the break-in.\n\n  cd ~/mission1\n  cat README.txt\n\nEvery file remembers when it was last changed: its modification time.\nInvestigators use it to build a timeline.\n\nREADME.txt gives this game's break-in time. Ten files in evidence/ hold\nflags, but only the file changed at that minute has the real one.\n\nUseful commands: ls -l, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 1   (1 hint, 5 points each: 5% of this mission)\n",
"2": "Mission 2: Say cheese   [Easy, 100 points]\n\nObjective: Read the hidden metadata fields inside a photo.\n\n  cd ~/mission2\n  filetype photo.jpg\n\nPhotos carry metadata: hidden fields such as the camera, the software,\nthe time it was taken, the author and comments. Viewers don't show them,\nbut they are in the file.\n\nTools like exiftool list metadata neatly. Here, strings can pull the\nreadable fields out of the picture's bytes.\n\nUseful commands: strings, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 2   (1 hint, 5 points each: 5% of this mission)\n",
"3": "Mission 3: Wrong label   [Easy, 100 points]\n\nObjective: Find the photo that isn't a photo, and open it.\n\n  cd ~/mission3\n  ls photos\n\nA file's extension, like .jpg, is only a label: anyone can rename a\nfile. The first bytes of a file, its magic number, say what it really\nis.\n\nOne of these photos is something else. filetype reads the first bytes\nfor you.\n\nUseful commands: filetype, zcat\nWhen you have the flag: submit CYBA{...}\nStuck? hint 3   (1 hint, 5 points each: 5% of this mission)\n",
"4": "Mission 4: Russian dolls   [Medium, 200 points]\n\nObjective: Unpack archives nested inside archives.\n\n  cd ~/mission4\n  ls -l\n\nEvidence often arrives packed: an archive (tar) bundles files together\nand gzip squeezes them smaller. Sometimes there are layers inside\nlayers.\n\nThe inner layers have no helpful extensions. Unpack one layer, ask\nfiletype what you got, and repeat.\n\nUseful commands: tar, filetype, zcat\nWhen you have the flag: submit CYBA{...}\nStuck? hint 4   (2 hints, 10 points each: 5% of this mission)\n",
"5": "Mission 5: Log detective   [Medium, 200 points]\n\nObjective: Find the IP address behind the break-in, then its one successful login.\n\n  cd ~/mission5\n  head auth.log\n\nauth.log records every login attempt to a server. Someone guessed\npasswords over and over, then got in.\n\nCount the Failed attempts per IP address. The busiest IP is the\nattacker. Its Accepted line holds the flag.\n\nUseful commands: grep, cut, sort, uniq\nWhen you have the flag: submit CYBA{...}\nStuck? hint 5   (2 hints, 10 points each: 5% of this mission)\n",
"6": "Mission 6: Hidden tail   [Medium, 200 points]\n\nObjective: Find the message hidden after the end of a picture (steganography).\n\n  cd ~/mission6\n  filetype cat.jpg\n\ncat.jpg opens as a normal picture. But picture viewers stop at the\nimage's end marker, and anything stored after it stays invisible.\n\nHiding data inside another file is called steganography. Here somebody\nappended a message to the end of the picture, then encoded it. Look at\nthe readable text near the end.\n\nUseful commands: strings, tail, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 6   (2 hints, 10 points each: 5% of this mission)\n",
"7": "Mission 7: Tampered   [Medium, 200 points]\n\nObjective: Find the program that doesn't match its known-good fingerprint.\n\n  cd ~/mission7\n  head -3 manifest.sha256\n\nmanifest.sha256 lists the SHA-256 fingerprint of every program in bin/,\ntaken when the server was clean.\n\nChange one byte of a file and its fingerprint changes completely. Every\nprogram has a flag inside; only the tampered one has the real flag.\n\nUseful commands: sha256sum -c, grep, strings\nWhen you have the flag: submit CYBA{...}\nStuck? hint 7   (2 hints, 10 points each: 5% of this mission)\n",
"8": "Mission 8: Persistence   [Hard, 400 points]\n\nObjective: Find the scheduled task the intruder left behind, and decode what it carries.\n\n  cd ~/mission8\n  ls cron\n\nIntruders want to come back. One trick is persistence: a scheduled task\n(a cron job) that runs their script again and again.\n\ncron/ holds a copy of each user's crontab. Each line is a schedule and a\ncommand. One command doesn't belong.\n\nUseful commands: cat, ls -a, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 8   (3 hints, 20 points each: 5% of this mission)\n",
"9": "Mission 9: Leaked in pieces   [Hard, 400 points]\n\nObjective: Rebuild data that left the network in small pieces, from a packet capture.\n\n  cd ~/mission9\n  head -5 capture.txt\n\ncapture.txt is a packet capture, listed the way Wireshark shows it: one\nline per packet, with its time, source and destination addresses,\nprotocol and a summary.\n\nOne host kept requesting /pixel.gif with extra values: a seq number and\na chunk of hex data. Put the chunks in seq order, join them and decode\nthe hex.\n\nUseful commands: grep, cut, sort, tr, xxd\nWhen you have the flag: submit CYBA{...}\nStuck? hint 9   (3 hints, 20 points each: 5% of this mission)\n",
"10": "Mission 10: Case closed   [Very Hard, 800 points]\n\nObjective: Trace the break-in from the log to the stolen file, then open it.\n\n  cd ~/mission10\n  cat README.txt\n\nThe final case uses everything. First find which account was broken\ninto, like Mission 5.\n\nThen search that user's folder under homes/ for a file whose label lies,\nlike Mission 3. Unpack it and decode what's inside.\n\nUseful commands: grep, cut, sort, uniq, filetype, zcat, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 10   (4 hints, 40 points each: 5% of this mission)\n",
"0": "Mission 0: Warm-up   [optional, 50 bonus points, untimed]\n\nObjective: Read the CTF orientation in the terminal with cat.\n\n  cat orientation.txt\n\nGet comfortable before the clock starts. Your home folder holds\norientation.txt: how a CTF works, what a flag looks like, scoring and\nthe forensics tools you will use.\n\ncat prints a file on the screen. Click the terminal, type cat\norientation.txt and press Enter. The warm-up flag is at the bottom.\n\nSubmit it for 50 bonus points, or skip the warm-up. The competition\nclock starts when you begin Mission 1.\n\nWhen you have the flag: submit CYBA{...}     Stuck? hint 0\n"
};
  const MISSION_OVERVIEW = "Your missions:\n   0  Warm-up (optional)           Bonus       50 pts  (bonus, untimed)\n   1  Case file                    Easy       100 pts\n   2  Say cheese                   Easy       100 pts\n   3  Wrong label                  Easy       100 pts\n   4  Russian dolls                Medium     200 pts\n   5  Log detective                Medium     200 pts\n   6  Hidden tail                  Medium     200 pts\n   7  Tampered                     Medium     200 pts\n   8  Persistence                  Hard       400 pts\n   9  Leaked in pieces             Hard       400 pts\n  10  Case closed                  Very Hard  800 pts\n                                             2700 pts\n\nRead one with: mission 1   (up to 10)\n";
  const HINTS = {
"1": [
"ls -l evidence shows each file's time. Look for the one that matches the time on the first line of README.txt, then cat it."
],
"2": [
"strings photo.jpg | head prints the readable text near the start of the file: that's where the metadata fields live. Look for the Comment field."
],
"3": [
"filetype photos/* names every file's real type. One is gzip, not JPEG. Read it with zcat, using its full path."
],
"4": [
"Start with tar -xzf evidence.tar.gz, then ls. You'll get a file with no extension.",
"filetype each new file. A tar archive unpacks with tar -xf NAME; gzip opens with zcat NAME."
],
"5": [
"The IP address is field 8: grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n. The last line is the busiest IP.",
"Now find that IP's successful login: grep Accepted auth.log | grep THE-IP."
],
"6": [
"strings cat.jpg shows the readable text. The appended message is the last line.",
"It's base64: strings cat.jpg | tail -1 | base64 -d."
],
"7": [
"sha256sum -c manifest.sha256 checks every file in the list. Look for the one that says FAILED.",
"Every program has a CYBA build id inside. Read the failed one's: strings bin/NAME | grep CYBA."
],
"8": [
"cat cron/* prints every crontab. Most commands are normal system jobs. Which one points into a hidden folder in this mission?",
"The odd line runs a script under var/.cache/. Hidden files start with a dot: ls -a var/.cache, then cat the script.",
"The script's PAYLOAD is base64. Copy the text between the quotes and decode it: echo TEXT | base64 -d."
],
"9": [
"Only one host sent seq=. Keep those packets: grep seq= capture.txt.",
"Cut each line down to the values: grep seq= capture.txt | cut -d'?' -f2 | cut -d' ' -f1. Then sort puts them in seq order.",
"Keep only the hex after the last =, join it and decode: ... | sort | cut -d'=' -f3 | tr -d '\\n' | xxd -r -p."
],
"10": [
"Step 1: find the attacker's IP the same way as Mission 5: count Failed lines per IP (field 8).",
"Step 2: that IP's Accepted line names the user (field 6). Their folder is homes/USER/.",
"Step 3: filetype homes/USER/*. The file whose type doesn't match its name is the one.",
"Step 4: zcat it. The text inside is base64: zcat homes/USER/FILE | base64 -d."
],
"0": "Mission 0: The flag is on the last line of orientation.txt in your home folder. Type cat orientation.txt, press Enter, then copy the flag into submit."
};
  const MISSION_COUNT = 10;
  const README_TEXT = {
"home": "CyberQuest Forensics CTF\n========================\n\nThis file explains the game. Each mission folder has its own README.txt\nwith that mission's instructions. Read one with:  cat README.txt\n\nHow to play\n  1. Go to a mission:    cd ~/mission1\n  2. Look around:        ls\n  3. Read its brief:     cat README.txt     (or type: mission 1)\n  4. Find the flag. It looks like CYBA{word-1a2b3c4d}\n  5. Check it:           submit CYBA{...}\n  6. Stuck?              hint 1   (costs 5% of the mission's points)\n\nMissions\n   1  Case file                    Easy       100 pts\n   2  Say cheese                   Easy       100 pts\n   3  Wrong label                  Easy       100 pts\n   4  Russian dolls                Medium     200 pts\n   5  Log detective                Medium     200 pts\n   6  Hidden tail                  Medium     200 pts\n   7  Tampered                     Medium     200 pts\n   8  Persistence                  Hard       400 pts\n   9  Leaked in pieces             Hard       400 pts\n  10  Case closed                  Very Hard  800 pts\n                                             2700 pts\n\nFlags change every time the page loads.\n\nNew to CTFs? Warm up first (optional, 50 bonus points):  cat orientation.txt\n",
"orientation": "CTF Orientation\n===============\n\nWhat is a CTF?\n  Capture The Flag is a cybersecurity competition. Each mission hides a\n  flag: a secret piece of text. Find it, submit it, and score points.\n\n1. Read a mission's instructions\n  Every mission has its own folder with a README.txt inside:\n    cd ~/mission1          go into the mission's folder\n    cat README.txt         read its instructions\n    cd ~                   come back home\n  Or, from anywhere:  mission 1      (mission alone lists them all)\n\n2. Find the flag\n  A flag looks like this:  CYBA{word-1a2b3c4d}\n  It always starts with CYBA{ and ends with }.\n\n3. Submit the flag\n  Type submit, a space, then the whole flag:\n    submit CYBA{word-1a2b3c4d}\n  Copy it exactly: highlight it with the mouse, then paste with Ctrl+V\n  or a right-click. Do not leave off the CYBA{ or the }.\n\n  What the replies mean:\n    Correct! +100 points                 you captured it\n    Incorrect flag. Keep hunting!        right shape, wrong flag\n    That doesn't look like a flag.       copy the whole thing, CYBA{ to }\n\n4. Stuck?\n  Read the command's built-in help first:  ls --help\n  Then ask for a nudge:  hint 1\n  A hint costs 5% of that mission's points, charged once. hint 1 tells\n  you the price first; hint 1 --show reveals it.\n\nScoring\n  Easy 100    Medium 200    Hard 400    Very Hard 800\n  The most points wins. On a tie, the faster time wins.\n  Hints cost 5% of the mission's points.\n\nThe clock\n  The clock starts when you begin Mission 1 and counts up. It stops\n  when you capture the last flag.\n\nYour forensics toolkit\n  ls -l   strings   xxd   tar   zcat   sha256sum -c   real Linux tools\n  grep   cut   sort   uniq -c   base64            from the Linux CTF\n  filetype                                       a helper for this CTF\n  Every one explains itself:  strings --help\n\nWarm-up: Mission 0  (optional, 50 bonus points, untimed)\n  You just read this file with cat. Now practice step 3: submit the\n  flag below. Or skip it and go to Mission 1.\n\nWarm-up flag:\n",
"1": "Mission 1: Case file   [Easy, 100 points]\n\nObjective: Find the evidence file that changed at the minute of the break-in.\n\n  cd ~/mission1\n  cat README.txt\n\nEvery file remembers when it was last changed: its modification time.\nInvestigators use it to build a timeline.\n\nREADME.txt gives this game's break-in time. Ten files in evidence/ hold\nflags, but only the file changed at that minute has the real one.\n\nUseful commands: ls -l, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 1   (1 hint, 5 points each: 5% of this mission)\n",
"2": "Mission 2: Say cheese   [Easy, 100 points]\n\nObjective: Read the hidden metadata fields inside a photo.\n\n  cd ~/mission2\n  filetype photo.jpg\n\nPhotos carry metadata: hidden fields such as the camera, the software,\nthe time it was taken, the author and comments. Viewers don't show them,\nbut they are in the file.\n\nTools like exiftool list metadata neatly. Here, strings can pull the\nreadable fields out of the picture's bytes.\n\nUseful commands: strings, grep\nWhen you have the flag: submit CYBA{...}\nStuck? hint 2   (1 hint, 5 points each: 5% of this mission)\n",
"3": "Mission 3: Wrong label   [Easy, 100 points]\n\nObjective: Find the photo that isn't a photo, and open it.\n\n  cd ~/mission3\n  ls photos\n\nA file's extension, like .jpg, is only a label: anyone can rename a\nfile. The first bytes of a file, its magic number, say what it really\nis.\n\nOne of these photos is something else. filetype reads the first bytes\nfor you.\n\nUseful commands: filetype, zcat\nWhen you have the flag: submit CYBA{...}\nStuck? hint 3   (1 hint, 5 points each: 5% of this mission)\n",
"4": "Mission 4: Russian dolls   [Medium, 200 points]\n\nObjective: Unpack archives nested inside archives.\n\n  cd ~/mission4\n  ls -l\n\nEvidence often arrives packed: an archive (tar) bundles files together\nand gzip squeezes them smaller. Sometimes there are layers inside\nlayers.\n\nThe inner layers have no helpful extensions. Unpack one layer, ask\nfiletype what you got, and repeat.\n\nUseful commands: tar, filetype, zcat\nWhen you have the flag: submit CYBA{...}\nStuck? hint 4   (2 hints, 10 points each: 5% of this mission)\n",
"5": "Mission 5: Log detective   [Medium, 200 points]\n\nObjective: Find the IP address behind the break-in, then its one successful login.\n\n  cd ~/mission5\n  head auth.log\n\nauth.log records every login attempt to a server. Someone guessed\npasswords over and over, then got in.\n\nCount the Failed attempts per IP address. The busiest IP is the\nattacker. Its Accepted line holds the flag.\n\nUseful commands: grep, cut, sort, uniq\nWhen you have the flag: submit CYBA{...}\nStuck? hint 5   (2 hints, 10 points each: 5% of this mission)\n",
"6": "Mission 6: Hidden tail   [Medium, 200 points]\n\nObjective: Find the message hidden after the end of a picture (steganography).\n\n  cd ~/mission6\n  filetype cat.jpg\n\ncat.jpg opens as a normal picture. But picture viewers stop at the\nimage's end marker, and anything stored after it stays invisible.\n\nHiding data inside another file is called steganography. Here somebody\nappended a message to the end of the picture, then encoded it. Look at\nthe readable text near the end.\n\nUseful commands: strings, tail, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 6   (2 hints, 10 points each: 5% of this mission)\n",
"7": "Mission 7: Tampered   [Medium, 200 points]\n\nObjective: Find the program that doesn't match its known-good fingerprint.\n\n  cd ~/mission7\n  head -3 manifest.sha256\n\nmanifest.sha256 lists the SHA-256 fingerprint of every program in bin/,\ntaken when the server was clean.\n\nChange one byte of a file and its fingerprint changes completely. Every\nprogram has a flag inside; only the tampered one has the real flag.\n\nUseful commands: sha256sum -c, grep, strings\nWhen you have the flag: submit CYBA{...}\nStuck? hint 7   (2 hints, 10 points each: 5% of this mission)\n",
"8": "Mission 8: Persistence   [Hard, 400 points]\n\nObjective: Find the scheduled task the intruder left behind, and decode what it carries.\n\n  cd ~/mission8\n  ls cron\n\nIntruders want to come back. One trick is persistence: a scheduled task\n(a cron job) that runs their script again and again.\n\ncron/ holds a copy of each user's crontab. Each line is a schedule and a\ncommand. One command doesn't belong.\n\nUseful commands: cat, ls -a, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 8   (3 hints, 20 points each: 5% of this mission)\n",
"9": "Mission 9: Leaked in pieces   [Hard, 400 points]\n\nObjective: Rebuild data that left the network in small pieces, from a packet capture.\n\n  cd ~/mission9\n  head -5 capture.txt\n\ncapture.txt is a packet capture, listed the way Wireshark shows it: one\nline per packet, with its time, source and destination addresses,\nprotocol and a summary.\n\nOne host kept requesting /pixel.gif with extra values: a seq number and\na chunk of hex data. Put the chunks in seq order, join them and decode\nthe hex.\n\nUseful commands: grep, cut, sort, tr, xxd\nWhen you have the flag: submit CYBA{...}\nStuck? hint 9   (3 hints, 20 points each: 5% of this mission)\n",
"10": "Mission 10: Case closed   [Very Hard, 800 points]\n\nObjective: Trace the break-in from the log to the stolen file, then open it.\n\n  cd ~/mission10\n  cat README.txt\n\nThe final case uses everything. First find which account was broken\ninto, like Mission 5.\n\nThen search that user's folder under homes/ for a file whose label lies,\nlike Mission 3. Unpack it and decode what's inside.\n\nUseful commands: grep, cut, sort, uniq, filetype, zcat, base64\nWhen you have the flag: submit CYBA{...}\nStuck? hint 10   (4 hints, 40 points each: 5% of this mission)\n"
};
  const HINT_COST = {"1": 5, "2": 5, "3": 5, "4": 10, "5": 10, "6": 10, "7": 10, "8": 20, "9": 20, "10": 40};
  const MISSION_POINTS = {"0": 50, "1": 100, "2": 100, "3": 100, "4": 200, "5": 200, "6": 200, "7": 200, "8": 400, "9": 400, "10": 800};
  // End of generated briefs.

  // Real BusyBox --help text, so --help reads the same as in the full Linux.
  const HELP = {
"tr": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: tr [-cds] STRING1 [STRING2]\n\nTranslate, squeeze, or delete characters from stdin, writing to stdout\n\n	-c	Take complement of STRING1\n	-d	Delete input characters coded STRING1\n	-s	Squeeze multiple output characters of STRING2 into one character\n",
"xxd": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: xxd [-pri] [-g N] [-c N] [-l LEN] [-s OFS] [-o OFS] [FILE]\n\nHex dump FILE (or stdin)\n\n	-g N		Bytes per group\n	-c N		Bytes per line\n	-p		Show only hex bytes, assumes -c30\n	-i		C include file style\n	-l LENGTH	Show only first LENGTH bytes\n	-s OFFSET	Skip OFFSET bytes\n	-o OFFSET	Add OFFSET to displayed offset\n	-r		Reverse (with -p, assumes no offsets in input)\n",
"strings": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: strings [-fo] [-t o|d|x] [-n LEN] [FILE]...\n\nDisplay printable strings in a binary file\n\n	-f		Precede strings with filenames\n	-o		Precede strings with octal offsets\n	-t o|d|x	Precede strings with offsets in base 8/10/16\n	-n LEN		At least LEN characters form a string (default 4)\n",
"tar": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: tar c|x|t [-ZzJjahmvokO] [-f TARFILE] [-C DIR] [FILE]...\n\nCreate, extract, or list files from a tar file\n\n	c	Create\n	x	Extract\n	t	List\n	-f FILE	Name of TARFILE ('-' for stdin/out)\n	-C DIR	Change to DIR before operation\n	-v	Verbose\n	-O	Extract to stdout\n	-m	Don't restore mtime\n	-o	Don't restore user:group\n	-k	Don't replace existing files\n	-Z	(De)compress using compress\n	-z	(De)compress using gzip\n	-J	(De)compress using xz\n	-j	(De)compress using bzip2\n	--lzma	(De)compress using lzma\n	-a	(De)compress based on extension\n	-h	Follow symlinks\n	--overwrite		Replace existing files\n	--strip-components NUM	NUM of leading components to strip\n	--no-recursion		Don't descend in directories\n	--numeric-owner		Use numeric user:group\n	--no-same-permissions	Don't restore access permissions\n	--to-command COMMAND	Pipe files to COMMAND\n",
"zcat": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: zcat [FILE]...\n\nDecompress to stdout\n",
"gunzip": "BusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) multi-call binary.\n\nUsage: gunzip [-cfkt] [FILE]...\n\nDecompress FILEs (or stdin)\n\n	-c	Write to stdout\n	-f	Force\n	-k	Keep input files\n	-t	Test integrity\n",
"filetype": "Usage: filetype FILE...   name each file's real type from its first bytes\nA file name's extension is only a label. The first bytes of a file, its\n\"magic number\", say what it really is:\n  ff d8 ff      JPEG image          89 50 4e 47   PNG image\n  1f 8b         gzip compressed     25 50 44 46   PDF document\n  50 4b 03 04   zip archive         7f 45 4c 46   ELF program\n  \"ustar\" at byte 257: tar archive  only printable bytes: ASCII text\nSee them yourself:  head -c 16 FILE | xxd\n",
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
          const size = n.dir ? 4096 : n.data.length;
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
    async head(args, stdin) { return headTail(bytesArgs(args), stdin, "head"); },
    async tail(args, stdin) { return headTail(bytesArgs(args), stdin, "tail"); },
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

  // head/tail -c N: pull the byte count out so headTail can apply it.
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
    }
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

  const BANNER = {"wide": "  \u001b[38;2;139;152;173mW E L C O M E   T O\u001b[0m\n   \u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;70;211;154m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;70;211;154m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;55;194;149m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;40;177;144m\u2588\u2588\u001b[38;2;59;74;102m\u2551      \u255a\u001b[38;2;40;177;144m\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d \u001b[38;2;40;177;144m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;40;177;144m\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557  \u001b[38;2;40;177;144m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[0m\n  \u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2551       \u255a\u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d  \u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d  \u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u001b[38;2;25;159;139m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;59;74;102m\u255a\u001b[38;2;17;149;143m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;17;149;143m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;17;149;143m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;17;149;143m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;17;149;143m\u2588\u2588\u001b[38;2;59;74;102m\u2551  \u001b[38;2;17;149;143m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n   \u001b[38;2;59;74;102m\u255a\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u001b[0m\n   \u001b[38;2;32;155;186m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557 \u001b[38;2;32;155;186m\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;32;155;186m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;32;155;186m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;32;155;186m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;32;155;186m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[0m\n  \u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u001b[38;2;40;158;207m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d\u001b[0m\n  \u001b[38;2;41;146;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;41;146;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;41;146;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;41;146;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;41;146;214m\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557  \u001b[38;2;41;146;214m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557   \u001b[38;2;41;146;214m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n  \u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;39;127;215m\u2584\u2584 \u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2554\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;39;127;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n  \u001b[38;2;59;74;102m\u255a\u001b[38;2;38;108;215m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u255a\u001b[38;2;38;108;215m\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2554\u255d\u001b[38;2;38;108;215m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2557\u001b[38;2;38;108;215m\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u001b[38;2;59;74;102m\u2551   \u001b[38;2;38;108;215m\u2588\u2588\u001b[38;2;59;74;102m\u2551\u001b[0m\n   \u001b[38;2;59;74;102m\u255a\u2550\u2550\u001b[38;2;36;89;216m\u2580\u2580\u001b[38;2;59;74;102m\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d\u001b[0m\n  \u001b[38;2;59;74;102m\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[1;97mDIGITAL FORENSICS CTF COMPETITION\u001b[0m           \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[38;2;139;152;173mForensics CTF  \u00b7  10 missions  \u00b7  10 flags\u001b[0m  \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\u001b[0m\n\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Start:  \u001b[38;2;70;211;154mmission 1\u001b[0m   (or use the mission panel)\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Flags look like \u001b[1;97mCYBA{word-1a2b3c4d}\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Check one:  \u001b[38;2;70;211;154msubmit CYBA{...}\u001b[0m    Stuck?  \u001b[38;2;70;211;154mhint 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Instructions:  \u001b[38;2;70;211;154mcat README.txt\u001b[0m  (home and each mission folder)\n\n", "small": "  \u001b[38;2;139;152;173mW E L C O M E   T O\u001b[0m\n    \u001b[38;2;70;211;154m_____   _____ ___ ___\u001b[0m\n   \u001b[38;2;46;184;146m/ __\\ \\ / / _ ) __| _ \\\u001b[0m\n  \u001b[38;2;23;157;139m| (__ \\ \u001b[38;2;59;74;102mV \u001b[38;2;23;157;139m/| _ \\ _||   /\u001b[0m\n   \u001b[38;2;23;151;158m\\___| |_| |___/___|_|_\\\u001b[0m\n    \u001b[38;2;34;156;192m___  _   _ ___ ___ _____\u001b[0m\n   \u001b[38;2;41;149;214m/ _ \\| | | | __/ __|_   _|\u001b[0m\n  \u001b[38;2;39;119;215m| (_) | |_| | _|\\__ \\ | |\u001b[0m\n   \u001b[38;2;36;89;216m\\__\\_\\\\___/|___|___/ |_|\u001b[0m\n  \u001b[38;2;59;74;102m\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[1;97mDIGITAL FORENSICS CTF COMPETITION\u001b[0m  \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2502\u001b[0m  \u001b[38;2;139;152;173mForensics CTF \u00b7 10 flags\u001b[0m           \u001b[38;2;59;74;102m\u2502\u001b[0m\n  \u001b[38;2;59;74;102m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\u001b[0m\n\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Start: \u001b[38;2;70;211;154mmission 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Check: \u001b[38;2;70;211;154msubmit CYBA{...}\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Stuck? \u001b[38;2;70;211;154mhint 1\u001b[0m\n  \u001b[38;2;245;166;35m\u25b8\u001b[0m Help:  \u001b[38;2;70;211;154mcat README.txt\u001b[0m\n\n"};
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
