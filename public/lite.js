// Linux Quest "lite mode": a simulated Linux shell in plain JavaScript.
//
// The normal page boots a real Linux computer with the v86 emulator, which
// needs WebAssembly. Some managed browsers block WebAssembly by policy (for
// example Chrome's DefaultJavaScriptJitSetting = 2). In that case app.js
// starts this instead: the same four missions, built the same way as
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
    for (const a of APPLETS.concat(["submit", "hint"])) ROOT.kids.bin.kids[a] = mkfile("", 0o755, "root");
    put("/dev/null", mkfile("", 0o666, "root"));
    put("/etc/passwd", mkfile("root:x:0:0:root:/root:/bin/sh\nplayer:x:1000:1000:player:/home/player:/bin/sh\n", 0o644, "root"));
    put("/etc/group", mkfile("root:x:0:\nplayer:x:1000:\n", 0o644, "root"));
    const profile = "export PS1='\\[\\e[1;32m\\]\\u\\[\\e[0m\\]@quest:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '\nexport PATH=/bin:/sbin\nalias ls='ls --color=auto'\ncd ~\n";
    put("/etc/profile", mkfile(profile, 0o644, "root"));
    put(HOME, mkdir(0o755, USER));
    put(HOME + "/.profile", mkfile(profile, 0o644, USER));
    const H = HOME;
    const flag = (w) => "CQ{" + w + "-" + hex(4) + "}";
    const keep = async (n, f) => { FLAGHASH[n] = await sha256hex(f); put("/etc/quest/" + n, mkfile(FLAGHASH[n] + "\n", 0o644, "root")); };
    put("/etc/quest", mkdir(0o755, "root"));

    // 1: hidden file
    let F = flag("hidden"); await keep(1, F);
    put(H + "/mission1", mkdir(0o755, USER));
    put(H + "/mission1/notes.txt", mkfile("Nothing to see here. Or is there? Some files are shy.\n", 0o644, USER));
    put(H + "/mission1/.old-" + rnd(4), mkfile("Close, but this hidden file is a decoy.\n", 0o644, USER));
    put(H + "/mission1/." + pick(["vault", "stash", "secret-notes", "backup-codes"]), mkfile("You found the hidden file.\nFlag: " + F + "\n", 0o644, USER));

    // 2: find by name
    F = flag("finder"); await keep(2, F);
    const ext = pick(["key", "vault", "gem"]);
    const dirs = [];
    for (const a of ["alpha", "bravo", "charlie", "delta", "echo"])
      for (let b = 0; b < 4; b++) { const d = H + "/mission2/archive/" + a + "/" + pick(["box", "bin", "shelf", "drawer"]) + "-" + rnd(4); if (!lookup(d).node) put(d, mkdir(0o755, USER)); dirs.push(d); }
    for (const d of dirs) for (let c = 0; c < 4; c++) put(d + "/" + rnd(6) + "." + pick(["txt", "log", "dat"]), mkfile("junk " + rnd(20) + "\n", 0o644, USER));
    put(pick(dirs) + "/" + rnd(6) + "." + ext, mkfile("Flag: " + F + "\n", 0o644, USER));
    put(H + "/mission2/README.txt", mkfile("Somewhere in archive/ is ONE file ending in ." + ext + "\nIt holds the flag.\n", 0o644, USER));

    // 3: grep a log
    F = flag("grep"); await keep(3, F);
    const who = pick(["nightowl", "ghost_fox", "zero_cool", "red_panda", "pixel_wolf"]);
    const users = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi", "ivan", "judy"];
    const acts = ["LOGIN_OK", "LOGIN_FAIL", "VIEW_PAGE", "DOWNLOAD", "LOGOUT"];
    const hit = 1500 + randInt(9000), lines = new Array(12000);
    const p2 = (n) => (n < 10 ? "0" : "") + n;
    for (let i = 0; i < 12000; i++) {
      const t = 8 * 3600 + i, stamp = p2(Math.floor(t / 3600) % 24) + ":" + p2(Math.floor(t / 60) % 60) + ":" + p2(t % 60);
      lines[i] = i === hit ? stamp + " user=" + who + " action=LOGIN_OK token=" + F
        : stamp + " user=" + users[Math.floor(Math.random() * 10)] + " action=" + acts[Math.floor(Math.random() * 5)] + " token=" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    }
    put(H + "/mission3/access.log", mkfile(lines.join("\n") + "\n", 0o644, USER));
    put(H + "/mission3/README.txt", mkfile("An intruder logged in ONCE as:  " + who + "\nTheir token is the flag.\n", 0o644, USER));

    // 4: base64
    F = flag("decoded"); await keep(4, F);
    put(H + "/mission4/message.b64", mkfile(b64encode("Decoded! Encoding is not encryption.\nFlag: " + F + "\n", 76), 0o644, USER));
  }

  // --------------------------------------------------------------- the shell
  let cwd = HOME, lastStatus = 0, isTTY = true;
  const history = [];
  let onMission = () => {};

  const HINTS = {
    1: "Mission 1: names starting with a dot are hidden. Try: ls -a",
    2: "Mission 2: read README.txt for the ending, then: find archive -name \"*.ending\"",
    3: "Mission 3: grep prints only matching lines. Try: grep <username> access.log",
    4: "Mission 4: ask the tool. Try: base64 --help   (look for decode)",
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
    async uname(args) { return R(args.includes("-a") ? "Linux quest (Linux Quest lite mode: a simulated shell)\n" : "Linux\n"); },
    async echo(args) {
      let nl = true, esc = false;
      while (args[0] === "-n" || args[0] === "-e") { if (args[0] === "-n") nl = false; else esc = true; args = args.slice(1); }
      let s = args.join(" ");
      if (esc) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      return R(s + (nl ? "\n" : ""));
    },
    async cat(args, stdin) {
      const { items, err } = fileInputs(args.filter((a) => a !== "-n"), stdin, "cat");
      return R(items.map(([, d]) => d).join(""), err, err ? 1 : 0);
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
    async help() {
      return R("Linux Quest lite mode: a simulated shell (this browser blocks WebAssembly,\nso the real Linux computer can't run here).\n\nCommands that work:\n  " + Object.keys(CMDS).filter((c) => c !== "help").sort().join(" ") + "\n\nAlso: pipes |, > and >> redirects, ; and &&, quotes, * wildcards, Tab and the Up arrow.\n");
    },
    async hint(args) { return R((HINTS[args[0]] || "Usage: hint 1   (or 2, 3, 4)") + "\n"); },
    async submit(args) {
      if (!args[0]) return R("Usage: submit CQ{...}\n", "", 1);
      const h = await sha256hex(args[0]);
      for (const n of [1, 2, 3, 4]) if (FLAGHASH[n] === h) { onMission(n); return R("Correct! [quest] mission " + n + " complete\n"); }
      return R("Not a flag. Copy the whole thing, CQ{ to }.\n", "", 1);
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
    if (args.includes("--help") && CMDS[name] && name !== "base64") return R("", "Lite mode: --help is short here. Try it in the full Linux Quest for the real text.\nUsage: " + name + " ...\n", 0);
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

  async function start(container, hooks = {}) {
    onMission = hooks.onMission || onMission;
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
    write("\x1b[33mLinux Quest lite mode.\x1b[0m This browser blocks WebAssembly, so the real Linux\n" +
      "computer can't run here. This is a simulated shell with the commands the\nmissions use. Type \x1b[1mhelp\x1b[0m to see them.\n\n");
    term.write(prompt());
    term.focus();
    window.questLite = { runLine };
    return { seconds: (performance.now() - t0) / 1000 };
  }

  window.LinuxQuestLite = { start };
})();
