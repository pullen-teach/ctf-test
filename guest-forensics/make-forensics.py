#!/usr/bin/env python3
"""One place for the Forensics CTF mission briefs. Writes every copy of them:

  guest-forensics/mission, hint, submit    commands inside the real Linux VM
  guest-forensics/readme/*.txt             README.txt files
  public/forensics/lite.js                 the same commands in lite mode
  public/forensics/guide.js                the mission panel on the right

Usage: python3 guest-forensics/make-forensics.py
Markup in the text below: `code` and **bold**. level is Easy, Medium, Hard or Very Hard (CyberQuest's scale).
"""
import json, os, re, sys, textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GAME = "Forensics"

MISSIONS = [
    dict(title="Case file", objective="Find the evidence file that changed at the minute of the break-in.",
         ref=[("ls -l", "list files with their size and time"), ("ls -l | grep TEXT", "keep only lines with TEXT"), ("cat FILE", "print a file on the screen")],
         level="Easy", run=["cd ~/mission1", "cat README.txt"],
         body=["Every file remembers when it was last changed: its **modification time**. Investigators use it to build a timeline.",
               "`README.txt` gives this game's break-in time. Ten files in `evidence/` hold flags, but only the file changed at that minute has the real one."],
         useful=["ls -l", "grep"]),
    dict(title="Say cheese", objective="Read the hidden metadata fields inside a photo.",
         ref=[("strings FILE", "print the readable text inside any file"), ("head -c 200 FILE | xxd", "see the first bytes in hex"), ("A | grep TEXT", "keep only lines with TEXT")],
         level="Easy", run=["cd ~/mission2", "filetype photo.jpg"],
         body=["Photos carry **metadata**: hidden fields such as the camera, the software, the time it was taken, the author and comments. Viewers don't show them, but they are in the file.",
               "Tools like `exiftool` list metadata neatly. Here, `strings` can pull the readable fields out of the picture's bytes."],
         useful=["strings", "grep"]),
    dict(title="Wrong label", objective="Find the photo that isn't a photo, and open it.",
         ref=[("filetype FILE...", "name each file's real type"), ("head -c 16 FILE | xxd", "see a file's first bytes"), ("zcat FILE", "print a gzip-compressed file")],
         level="Easy", run=["cd ~/mission3", "ls photos"],
         body=["A file's extension, like `.jpg`, is only a label: anyone can rename a file. The **first bytes** of a file, its magic number, say what it really is.",
               "One of these photos is something else. `filetype` reads the first bytes for you."],
         useful=["filetype", "zcat"]),
    dict(title="Russian dolls", objective="Unpack archives nested inside archives.",
         ref=[("tar -xzf FILE", "unpack a .tar.gz archive"), ("tar -xf FILE", "unpack a .tar archive"), ("filetype FILE", "name a file's real type"), ("zcat FILE", "print a gzip-compressed file")],
         level="Medium", run=["cd ~/mission4", "ls -l"],
         body=["Evidence often arrives packed: an **archive** (tar) bundles files together and **gzip** squeezes them smaller. Sometimes there are layers inside layers.",
               "The inner layers have no helpful extensions. Unpack one layer, ask `filetype` what you got, and repeat."],
         useful=["tar", "filetype", "zcat"]),
    dict(title="Log detective", objective="Find the IP address behind the break-in, then its one successful login.",
         ref=[("grep TEXT FILE", "keep lines with TEXT"), ("cut -d' ' -f8", "keep the 8th space-separated field"), ("sort | uniq -c", "count repeated lines"), ("sort -n | tail -1", "the biggest count")],
         level="Medium", run=["cd ~/mission5", "head auth.log"],
         body=["`auth.log` records every login attempt to a server. Someone guessed passwords over and over, then got in.",
               "Count the **Failed** attempts per IP address. The busiest IP is the attacker. Its **Accepted** line holds the flag."],
         useful=["grep", "cut", "sort", "uniq"]),
    dict(title="Hidden tail", objective="Find the message hidden after the end of a picture (steganography).",
         ref=[("strings FILE", "print the readable text inside a file"), ("tail -1", "keep only the last line"), ("base64 -d", "decode base64")],
         level="Medium", run=["cd ~/mission6", "filetype cat.jpg"],
         body=["`cat.jpg` opens as a normal picture. But picture viewers stop at the image's end marker, and anything stored after it stays invisible.",
               "Hiding data inside another file is called **steganography**. Here somebody appended a message to the end of the picture, then encoded it. Look at the readable text near the end."],
         useful=["strings", "tail", "base64"]),
    dict(title="Tampered", objective="Find the program that doesn't match its known-good fingerprint.",
         ref=[("sha256sum FILE", "fingerprint a file"), ("sha256sum -c LIST", "check files against a list of fingerprints"), ("strings FILE", "print the readable text inside a file")],
         level="Medium", run=["cd ~/mission7", "head -3 manifest.sha256"],
         body=["`manifest.sha256` lists the SHA-256 fingerprint of every program in `bin/`, taken when the server was clean.",
               "Change one byte of a file and its fingerprint changes completely. Every program has a flag inside; only the **tampered** one has the real flag."],
         useful=["sha256sum -c", "grep", "strings"]),
    dict(title="Persistence", objective="Find the scheduled task the intruder left behind, and decode what it carries.",
         ref=[("cat cron/*", "print every crontab"), ("ls -a", "show hidden files too"), ("cut -d'\"' -f2", "keep the text between quotes"), ("base64 -d", "decode base64")],
         level="Hard", run=["cd ~/mission8", "ls cron"],
         body=["Intruders want to come back. One trick is **persistence**: a scheduled task (a cron job) that runs their script again and again.",
               "`cron/` holds a copy of each user's crontab. Each line is a schedule and a command. One command doesn't belong."],
         useful=["cat", "ls -a", "base64"]),
    dict(title="Leaked in pieces", objective="Rebuild data that left the network in small pieces, from a packet capture.",
         ref=[("grep TEXT FILE", "keep lines with TEXT"), ("cut -d'?' -f2", "keep what follows the first ?"), ("sort", "put lines in order"), ("tr -d '\\n'", "join lines together"), ("xxd -r -p", "turn hex back into text")],
         level="Hard", run=["cd ~/mission9", "head -5 capture.txt"],
         body=["`capture.txt` is a packet capture, listed the way Wireshark shows it: one line per packet, with its time, source and destination addresses, protocol and a summary.",
               "One host kept requesting `/pixel.gif` with extra values: a **seq** number and a chunk of **hex** data. Put the chunks in seq order, join them and decode the hex."],
         useful=["grep", "cut", "sort", "tr", "xxd"]),
    dict(title="Case closed", objective="Trace the break-in from the log to the stolen file, then open it.",
         ref=[("grep, cut, sort, uniq -c", "find the attacker in auth.log"), ("filetype FILE...", "name each file's real type"), ("zcat FILE", "print a gzip-compressed file"), ("base64 -d", "decode base64")],
         level="Very Hard", run=["cd ~/mission10", "cat README.txt"],
         body=["The final case uses everything. First find which account was broken into, like Mission 5.",
               "Then search that user's folder under `homes/` for a file whose label lies, like Mission 3. Unpack it and decode what's inside."],
         useful=["grep", "cut", "sort", "uniq", "filetype", "zcat", "base64"]),
]
N = len(MISSIONS)

# Mission 0: an optional, untimed warm-up worth bonus points. Its flag is at the bottom of ~/orientation.txt.
WARMUP = dict(title="Warm-up", level="Warm-up", points=50,
              objective="Read the CTF orientation in the terminal with cat.",
              run=["cat orientation.txt"],
              ref=[("cat FILE", "print a file on the screen"), ("clear", "clear the screen")],
              body=["Get comfortable before the clock starts. Your **home folder** holds `orientation.txt`: how a CTF works, what a flag looks like, scoring and the forensics tools you will use.",
                    "`cat` prints a file on the screen. Click the terminal, type `cat orientation.txt` and press Enter. The warm-up flag is at the bottom.",
                    "Submit it for **50 bonus points**, or skip the warm-up. The competition clock starts when you begin Mission 1."],
              hint="The flag is on the last line of `orientation.txt` in your home folder. Type `cat orientation.txt`, press Enter, then copy the flag into `submit`.",
              short="the flag is at the bottom of ~/orientation.txt.  Read it: cat orientation.txt")
# CyberQuest scoring: points come from the difficulty level.
POINTS = {"Easy": 100, "Medium": 200, "Hard": 400, "Very Hard": 800}
for _m in MISSIONS: _m["points"] = POINTS[_m["level"]]
TOTAL_POINTS = sum(m["points"] for m in MISSIONS)
LEARNED = [
    "Found an altered file by its modification time with <code>ls -l</code> and <code>stat</code>.",
    "Read hidden metadata and strings inside files with <code>exiftool</code> and <code>strings</code>.",
    "Identified a file by its signature (magic bytes), not its extension, with <code>file</code> and <code>xxd</code>.",
    "Unpacked nested archives and traced a break-in through server logs with <code>grep</code>.",
    "Recovered a message hidden after the end of an image (steganography).",
    "Matched a tampered program against a known-good <code>sha256sum</code> fingerprint.",
    "Reassembled leaked data from a packet capture and closed the case.",
]
# Hints, in tiers: each one gives more direction than the last. Each costs 5% of the
# mission's points, charged once. Easy missions get one hint; harder ones get more.
HINT_TIERS = {
    "Case file": ["`ls -l evidence` shows each file's time. Look for the one that matches the time on the first line of `README.txt`, then `cat` it."],
    "Say cheese": ["`strings photo.jpg | head` prints the readable text near the start of the file: that's where the metadata fields live. Look for the Comment field."],
    "Wrong label": ["`filetype photos/*` names every file's real type. One is gzip, not JPEG. Read it with `zcat`, using its full path."],
    "Russian dolls": ["Start with `tar -xzf evidence.tar.gz`, then `ls`. You'll get a file with no extension.",
                      "`filetype` each new file. A tar archive unpacks with `tar -xf NAME`; gzip opens with `zcat NAME`."],
    "Log detective": ["The IP address is field 8: `grep Failed auth.log | cut -d' ' -f8 | sort | uniq -c | sort -n`. The last line is the busiest IP.",
                      "Now find that IP's successful login: `grep Accepted auth.log | grep THE-IP`."],
    "Hidden tail": ["`strings cat.jpg` shows the readable text. The appended message is the last line.",
                    "It's base64: `strings cat.jpg | tail -1 | base64 -d`."],
    "Tampered": ["`sha256sum -c manifest.sha256` checks every file in the list. Look for the one that says FAILED.",
                 "Every program has a CYBA build id inside. Read the failed one's: `strings bin/NAME | grep CYBA`."],
    "Persistence": ["`cat cron/*` prints every crontab. Most commands are normal system jobs. Which one points into a hidden folder in this mission?",
                    "The odd line runs a script under `var/.cache/`. Hidden files start with a dot: `ls -a var/.cache`, then `cat` the script.",
                    "The script's PAYLOAD is base64. Copy the text between the quotes and decode it: `echo TEXT | base64 -d`."],
    "Leaked in pieces": ["Only one host sent `seq=`. Keep those packets: `grep seq= capture.txt`.",
                         "Cut each line down to the values: `grep seq= capture.txt | cut -d'?' -f2 | cut -d' ' -f1`. Then `sort` puts them in seq order.",
                         "Keep only the hex after the last `=`, join it and decode: `... | sort | cut -d'=' -f3 | tr -d '\\n' | xxd -r -p`."],
    "Case closed": ["**Step 1:** find the attacker's IP the same way as Mission 5: count Failed lines per IP (field 8).",
                    "**Step 2:** that IP's Accepted line names the user (field 6). Their folder is `homes/USER/`.",
                    "**Step 3:** `filetype homes/USER/*`. The file whose type doesn't match its name is the one.",
                    "**Step 4:** `zcat` it. The text inside is base64: `zcat homes/USER/FILE | base64 -d`."],
}
for _m in MISSIONS: _m["hints"] = HINT_TIERS[_m["title"]]
# Each hint costs 5% of the mission's points. The warm-up hint is free.
HINT_RATE = 0.05
def hint_cost(m): return int(round(m["points"] * HINT_RATE))
WEB_LOG, KC_LOG = "", ""


def fill(t, loglines): return t.replace("{LOGLINES}", loglines)
def esc(t): return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def html(t):
    t = esc(t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
def plain(t): return re.sub(r"\*\*([^*]+)\*\*", r"\1", t.replace("`", ""))
def useful_label(m): return "Useful command" + ("s" if len(m["useful"]) > 1 else "")

# ---------------------------------------------------------------- plain text
def brief(i, loglines):
    m, n = MISSIONS[i], i + 1
    out = ["Mission %d: %s   [%s, %d points]" % (n, m["title"], m["level"], m["points"]), ""] + ["Objective: " + m["objective"], ""] + ["  " + c for c in m["run"]] + [""]
    for b in m["body"]:
        if isinstance(b, list):
            out += ["  %-11s %s" % row for row in b] + [""]
        else:
            out += textwrap.wrap(plain(fill(b, loglines)), 72) + [""]
    out += [useful_label(m) + ": " + ", ".join(m["useful"]),
            "When you have the flag: submit CYBA{...}",
            "Stuck? hint %d   (%d hint%s, %d points each: 5%% of this mission)" % (n, len(m["hints"]), "" if len(m["hints"]) == 1 else "s", hint_cost(m))]
    return "\n".join(out) + "\n"

def brief_warmup():
    m = WARMUP
    out = ["Mission 0: Warm-up   [optional, %d bonus points, untimed]" % m["points"], "", "Objective: " + m["objective"], ""]
    out += ["  " + c for c in m["run"]] + [""]
    for b in m["body"]:
        out += textwrap.wrap(plain(b), 72) + [""]
    out += ["When you have the flag: submit CYBA{...}     Stuck? hint 0"]
    return "\n".join(out) + "\n"

def overview():
    lines = ["Your missions:"] + ["  %2d  %-28s %-9s %4d pts" % (i + 1, m["title"], m["level"], m["points"]) for i, m in enumerate(MISSIONS)]
    lines += ["  %s %4d pts" % (" " * 42, TOTAL_POINTS)]
    return "\n".join(lines + ["", "Read one with: mission 1   (up to %d)" % N]) + "\n"

# ---------------------------------------------------------------- README.txt files
# The home folder (game instructions) and each mission folder (that mission) get a README.txt.
# Missions 2, 4 and 5 put this run's clue on top (the builders write it), then the brief.
def readme(i, loglines, kc=False):
    t = brief(i, loglines)
    if kc:
        t = t.replace("submit CYBA{...}\n", "submit CYBA{...}, then press CHECK.\n")
        t = re.sub(r"Stuck\? hint \d+ .*", "Stuck? Open the Hint in the instructions panel.", t)
    return t

def readme_home(kc=False):
    rows = ["  %2d  %-28s %-9s %4d pts" % (i + 1, m["title"], m["level"], m["points"]) for i, m in enumerate(MISSIONS)]
    steps = ["  1. Go to a mission:    cd ~/mission1",
             "  2. Look around:        ls",
             "  3. Read its brief:     cat README.txt" + ("" if kc else "     (or type: mission 1)"),
             "  4. Find the flag. It looks like CYBA{word-1a2b3c4d}",
             "  5. Check it:           submit CYBA{...}" + ("     then press CHECK" if kc else "")]
    if not kc: steps.append("  6. Stuck?              hint 1   (costs 5% of the mission's points)")
    return "\n".join(["CyberQuest Forensics CTF", "========================", "",
                      "This file explains the game. Each mission folder has its own README.txt",
                      "with that mission's instructions. Read one with:  cat README.txt", "", "How to play"] + steps +
                     ["", "Missions"] + rows + ["  %s %4d pts" % (" " * 42, TOTAL_POINTS), "",
                      "Flags change every time the %s." % ("scenario starts" if kc else "page loads"), "",
                      "New to CTFs? Do the Warm-ups module first (on the home page): it covers how a CTF works.", ""])

def orientation(kc=False):
    check = "     then press CHECK" if kc else ""
    lines = [
        "CTF Orientation", "===============", "",
        "What is a CTF?",
        "  Capture The Flag is a cybersecurity competition. Each mission hides a",
        "  flag: a secret piece of text. Find it, submit it, and score points.", "",
        "1. Read a mission's instructions",
        "  Every mission has its own folder with a README.txt inside:",
        "    cd ~/mission1          go into the mission's folder",
        "    cat README.txt         read its instructions",
        "    cd ~                   come back home",
    ]
    if not kc:
        lines += ["  Or, from anywhere:  mission 1      (mission alone lists them all)"]
    lines += ["",
        "2. Find the flag",
        "  A flag looks like this:  CYBA{word-1a2b3c4d}",
        "  It always starts with CYBA{ and ends with }.", "",
        "3. Submit the flag",
        "  Type submit, a space, then the whole flag:",
        "    submit CYBA{word-1a2b3c4d}" + check,
        "  Copy it exactly: highlight it with the mouse, then paste with Ctrl+V",
        "  or a right-click. Do not leave off the CYBA{ or the }.", ""]
    if not kc:
        lines += ["  What the replies mean:",
        "    Correct! +100 points                 you captured it",
        "    Incorrect flag. Keep hunting!        right shape, wrong flag",
        "    That doesn't look like a flag.       copy the whole thing, CYBA{ to }", ""]
    lines += [
        "4. Stuck?",
        "  Read the command's built-in help first:  ls --help",
    ] + (["  Then ask for a nudge:  hint 1",
              "  A hint costs 5% of that mission's points, charged once. hint 1 tells",
              "  you the price first; hint 1 --show reveals it."] if not kc else ["  Then open the Hint in the instructions panel."]) + ["",
        "Scoring",
        "  Easy 100    Medium 200    Hard 400    Very Hard 800",
        "  The most points wins. On a tie, the faster time wins.",
        "  Hints cost 5% of the mission's points." if not kc else "  Hints are free in this version.", ""]
    if not kc:
        lines += ["The clock",
        "  The clock starts when you begin Mission 1 and counts up. It stops",
        "  when you capture the last flag.", ""]
    lines += ["Your forensics toolkit",
        "  ls -l   strings   xxd   tar   zcat   sha256sum -c   real Linux tools",
        "  grep   cut   sort   uniq -c   base64            from the Linux CTF",
        "  filetype                                       a helper for this CTF",
        "  Every one explains itself:  strings --help", ""]
    lines += [
        "Warm-up: Mission 0  (optional, %d bonus points%s)" % (WARMUP["points"], "" if kc else ", untimed"),
        "  You just read this file with cat. Now practice step 3: submit the",
        "  flag below. Or skip it and go to Mission 1.", "",
        "Warm-up flag:"]
    return "\n".join(lines) + "\n"

def hint_file(i):
    m = MISSIONS[i]
    out = ["Hint for Mission %d: %s" % (i + 1, m["title"]), ""] + textwrap.wrap(plain(m["hint"]), 72)
    if m["hint_cmd"]:
        out += ["", "Try:  " + m["hint_cmd"]]
    return "\n".join(out) + "\n"

def readmes(loglines, kc=False):
    r = {"home": readme_home(kc)}

    r.update({str(i + 1): readme(i, loglines, kc) for i in range(N)})
    return r

def hint_line(i): return "Mission %d: %s" % (i + 1, MISSIONS[i]["short"])

def write_guest():
    sh = ["#!/bin/sh", "# mission [N]  prints a mission brief, the same text as the panel on the page.",
          "# Generated by guest-forensics/make-forensics.py: edit that file, not this one.", 'case "$1" in']
    for i in range(N):
        sh += ["  %d) cat <<'EOF'" % (i + 1), brief(i, WEB_LOG) + "EOF", "  ;;"]
    sh += ["  *) cat <<'EOF'", overview() + "EOF", "  ;;", "esac", ""]
    open(os.path.join(HERE, "mission"), "w").write("\n".join(sh))
    def sq(t): return "'" + "\n".join(textwrap.wrap(plain(t), 66)).replace("'", "'\\''") + "'"
    h = ["#!/bin/sh", "# hint N           shows the hints you already have and the price of the next one",
         "# hint N --show    buys the next hint. Each hint costs 5% of the mission's points,",
         "# charged once: the page keeps the score when it sees the [quest] line. The warm-up hint is free.",
         "# Generated by guest-forensics/make-forensics.py: edit that file, not this one.",
         'case "$1" in']
    for i, m in enumerate(MISSIONS):
        h += ["  %d) pts=%d; cost=%d; total=%d" % (i + 1, m["points"], hint_cost(m), len(m["hints"]))]
        h += ["     h%d=%s" % (k + 1, sq(t)) for k, t in enumerate(m["hints"])]
        h += ["     ;;"]
    h += ['  *) echo "Usage: hint 1   (up to %d)"; exit 1 ;;' % N, "esac",
          "seen=/tmp/.quest-hints",
          'have=$(grep -c "^$1\\." "$seen" 2>/dev/null); [ -n "$have" ] || have=0',
          'i=1; while [ "$i" -le "$have" ]; do eval "t=\\$h$i"; echo "Hint $i of $total: $t"; i=$((i + 1)); done',
          'if [ "$2" = "--show" ]; then',
          '  if [ "$have" -ge "$total" ]; then echo "No more hints for mission $1."; exit 0; fi',
          '  k=$((have + 1)); echo "$1.$k" >> "$seen"; eval "t=\\$h$k"',
          '  echo "Hint $k of $total: $t"',
          '  echo "[quest] hint $1.$k used (-$cost points)"',
          "  exit 0",
          "fi",
          'if [ "$have" -ge "$total" ]; then echo "That is every hint for mission $1."; exit 0; fi',
          'echo "Hint $((have + 1)) of $total costs $cost points (5% of $pts), charged once."',
          'echo "To see it, type:  hint $1 --show"', ""]
    open(os.path.join(HERE, "hint"), "w").write("\n".join(h))
    pts = " ".join(str(m["points"]) for m in MISSIONS)
    sub = ["#!/bin/sh", "# submit <flag>  checks your flag against every mission and shows its points.",
           "# Generated by guest-forensics/make-forensics.py: edit that file, not this one.",
           'if [ -z "$1" ]; then echo "Usage: submit CYBA{...}"; exit 1; fi',
           "h=$(printf '%s' \"$1\" | sha256sum | cut -d' ' -f1)",
           "n=0",
           "for p in %s; do" % pts,
           "  n=$((n + 1))",
           '  if [ "$h" = "$(cat /etc/quest/$n)" ]; then',
           '    echo "Correct! +$p points   [quest] mission $n complete"',
           "    exit 0", "  fi", "done",
           'case "$1" in',
           '  "CYBA{"*"}") echo "Incorrect flag. Keep hunting!" ;;',
           '  *) echo "That doesn\'t look like a flag. Copy the whole thing, CYBA{ to }." ;;',
           "esac", "exit 1", ""]
    open(os.path.join(HERE, "submit"), "w").write("\n".join(sub))
    d = os.path.join(HERE, "readme"); os.makedirs(d, exist_ok=True)
    for k, t in readmes(WEB_LOG).items():
        open(os.path.join(d, k + ".txt"), "w").write(t)

def patch(path, start, end, new):
    s = open(path).read()
    a = s.index(start); b = s.index(end, a) + len(end)
    open(path, "w").write(s[:a] + new + s[b:])

def write_lite():
    p = os.path.join(ROOT, "public", "forensics", "lite.js")
    texts = {str(i + 1): brief(i, WEB_LOG) for i in range(N)}
    hints = {i + 1: [plain(t) for t in m["hints"]] for i, m in enumerate(MISSIONS)}
    block = ("  // Mission briefs and hints. Generated by guest-forensics/make-forensics.py.\n"
             "  const MISSION_TEXT = " + json.dumps(texts, indent=0) + ";\n"
             "  const MISSION_OVERVIEW = " + json.dumps(overview()) + ";\n"
             "  const HINTS = " + json.dumps(hints, indent=0).replace('"', '"') + ";\n"
             "  const MISSION_COUNT = " + str(N) + ";\n"
             "  const README_TEXT = " + json.dumps(readmes(WEB_LOG), indent=0) + ";\n"
             "  const HINT_COST = " + json.dumps({i + 1: hint_cost(m) for i, m in enumerate(MISSIONS)}) + ";\n"
             "  const MISSION_POINTS = " + json.dumps(dict([(i + 1, m["points"]) for i, m in enumerate(MISSIONS)])) + ";\n"
             "  // End of generated briefs.\n")
    s = open(p).read()
    if "// Mission briefs and hints. Generated" in s:
        patch(p, "  // Mission briefs and hints. Generated", "  // End of generated briefs.\n", block)
    else:
        a = s.index("  // Same briefs as the panel on the page; see guest/mission.\n")
        b = s.index("  };\n", s.index("  const HINTS = {", a)) + len("  };\n")
        open(p, "w").write(s[:a] + block + s[b:])

# ---------------------------------------------------------------- panel
def write_panel():
    out = []
    for m in MISSIONS:
        notes = [html(fill(b, WEB_LOG)) for b in m["body"] if isinstance(b, str) and not b.endswith(":")]
        out.append(dict(title=m["title"], level=m["level"], points=m["points"], hintCost=hint_cost(m), objective=m["objective"], run=m["run"],
                        ref=[list(r) for r in m["ref"]], notes=notes, hints=[html(t) for t in m["hints"]]))
    block = ("  // Generated by guest-forensics/make-forensics.py: edit that file, not this one.\n"
             "  const MISSIONS = " + json.dumps(out, indent=2).replace("\n", "\n  ") + ";\n"
             "  const LEARNED = " + json.dumps(LEARNED) + ";\n")
    p = os.path.join(ROOT, "public", "forensics", "guide.js")
    s = open(p).read()
    a = s.index("  // Generated by guest-forensics/make-forensics.py") if "// Generated by guest-forensics/make-forensics.py" in s else s.index("  const MISSIONS = [")
    b = s.index("  const N = MISSIONS.length;")
    open(p, "w").write(s[:a] + block + "\n" + s[b:])

write_guest(); write_lite(); write_panel()
print("Wrote %d missions." % N)
