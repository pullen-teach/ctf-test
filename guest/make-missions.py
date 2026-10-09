#!/usr/bin/env python3
"""One place for the mission briefs. Writes every copy of them:

  guest/mission, guest/hint             commands inside the real Linux VM
  public/lite.js                        the same commands in lite mode
  public/guide.js                       the mission panel on the right
  linux-quest-mission-1/stepN/text.md   the Killercoda steps (and index.json)

Usage: python3 guest/make-missions.py [path/to/linux-quest-mission-1]
Markup in the text below: `code` and **bold**. level is Easy, Medium, Hard or Very Hard (CyberQuest's scale).
"""
import json, os, re, sys, textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "linux-quest-mission-1")

MOVES = [("pwd", "where am I?"), ("ls", "what is in this folder?"), ("cd NAME", "move into a folder"),
         ("cd ..", "go back up one level"), ("cd ~", "go home")]

MISSIONS = [
    dict(title="Make your move", objective='Navigate the file system using basic Linux commands to find the flag.', ref=MOVES,
         level="Easy", run=["cd ~/mission1", "ls"],
         body=["Moving around is the first real skill on the command line:", MOVES,
               "A flag is waiting at the end of a trail that starts in `~/mission1`. Nothing on this trail needs opening: "
               "the **file names** are the signposts. Use `ls` to read them and `cd` to follow them. Some turns are dead ends.",
               "At the end of the trail, `ls` shows you the flag itself."],
         useful=["pwd", "ls", "cd"],
         hint="Lost? `pwd` shows where you are and `cd ..` goes back up one level. "
              "Run `ls` in every folder: the names tell you which folder to `cd` into next.",
         hint_cmd=None,
         short="lost? pwd shows where you are, cd .. goes back up, ls reads the signs."),
    dict(title="Let the cat out of the bag", objective='Read files with cat, and use --help to number the lines.', ref=[("cat FILE", "print a file on the screen"), ("cat --help", "list everything cat can do")],
         level="Easy", run=["cd ~/mission2", "cat README.txt"],
         body=["`cat` prints a file on the screen. You just used it to read `README.txt`.",
               "The cat is hiding in `bag.txt`: 100 lines, and every one looks like a flag. Only the line number in "
               "`README.txt` is real. Counting 100 lines by hand is how mistakes happen.",
               "Almost every Linux command can **explain itself**: type its name, a space, then `--help`. Ask `cat` for "
               "its help and look for an option that numbers the lines. You will use `--help` in every mission after this one."],
         useful=["cat"],
         hint="Read the help for `cat` and look for the option that **numbers** the lines. Options go between the command and the file name.",
         hint_cmd="cat --help", short="the command to look up is cat.     Read: cat --help"),
    dict(title="Now you see me", objective='Reveal the hidden files and find the real flag.', ref=[("ls", "list the files in a folder"), ("ls --help", "list everything ls can do"), ("cat FILE", "print a file on the screen")],
         level="Easy", run=["cd ~/mission3", "ls"],
         body=["There is a flag in this folder, but plain `ls` will not show it.",
               "On Linux, a file whose name starts with a dot is **hidden**. Watch out: one hidden file is a decoy."],
         useful=["ls", "cat"],
         hint="Read the help for `ls` and look for an option that also shows names starting with `.`",
         hint_cmd="ls --help", short="the command to look up is ls.      Read: ls --help"),
    dict(title="Needle in the tree", objective='Search a folder tree by file name to find the flag.', ref=[("find", "search a folder tree for files"), ("find --help", "list everything find can do"), ("cat FILE", "print a file on the screen")],
         level="Medium", run=["cd ~/mission4", "cat README.txt"],
         body=["The `archive` folder holds about 80 files in 20 folders. Exactly **one** of them has the file ending named "
               "in `README.txt`, and it holds the flag.",
               "Opening folders one by one is too slow. Let the computer search."],
         useful=["find", "cat"],
         hint="Read the help for `find` and look for a way to match a file's **name** against a pattern. In a pattern, `*` means \"anything\".",
         hint_cmd="find --help", short="the command to look up is find.    Read: find --help"),
    dict(title="Search party", objective="Search a huge log for the intruder's line.", ref=[("grep", "search inside files for text"), ("grep --help", "list everything grep can do"), ("head FILE", "show the first lines of a file"), ("wc -l FILE", "count the lines in a file")],
         level="Medium", run=["cd ~/mission5", "cat README.txt"],
         body=["`access.log` has {LOGLINES} lines. One intruder logged in exactly once.",
               "Their **token** on that line is the flag. Scrolling would take all day."],
         useful=["grep", "head", "wc"],
         hint="Read the help for `grep` and look at the **Usage** line at the top: it shows what goes first and what goes second.",
         hint_cmd="grep --help", short="the command to look up is grep.    Read: grep --help"),
    dict(title="Odd one out", objective="Use a pipe to find the only code that appears once.",
         ref=[("sort FILE", "sort the lines of a file"), ("uniq --help", "list everything uniq can do"),
              ("A | B", "send the output of A into B"), ("wc -l FILE", "count the lines in a file")],
         level="Medium", run=["cd ~/mission7", "head codes.txt"],
         body=["`codes.txt` holds about 900 flags. Every fake one appears **at least twice**. The real flag appears **exactly once**.",
               "Reading 900 lines is no fun. Chain two commands with a **pipe** (`|`): the first one sorts the lines so the "
               "copies sit next to each other, the second one finds the line that has no twin."],
         useful=["sort", "uniq"],
         hint="`uniq` only compares lines that sit **next to each other**, so `sort` the file first and pipe it into `uniq`. "
              "Then read the help for `uniq` and look for the option that prints only the **unique** lines.",
         hint_cmd="uniq --help", short="sort first, then look up uniq.     Read: uniq --help"),
    dict(title="Permission denied", objective="Unlock a script with chmod and run it.",
         ref=[("ls -l", "show files with their permissions"), ("chmod --help", "list everything chmod can do"),
              ("./FILE", "run a script in this folder")],
         level="Medium", run=["cd ~/mission8", "ls -l"],
         body=["The flag is behind a locked door: `unlock.sh`. It is a **script**, a file full of commands that runs when you type `./unlock.sh`.",
               "Try it, and Linux will refuse. `ls -l` shows why: the letters at the start of each line are the file's "
               "**permissions**. `r` means read, `w` means write and `x` means execute (run). This script has no `x`.",
               "You own the file, so you are allowed to change its permissions."],
         useful=["ls", "chmod"],
         hint="Read the help for `chmod`. You want to **add** (`+`) the e**x**ecute permission (`x`) to `unlock.sh`, then run `./unlock.sh` again.",
         hint_cmd="chmod --help", short="the command to look up is chmod.   Read: chmod --help"),
    dict(title="Decoder ring", objective='Decode a base64 message to reveal the flag.', ref=[("cat FILE", "print a file on the screen"), ("base64 --help", "list everything base64 can do")],
         level="Hard", run=["cd ~/mission6", "cat message.b64"],
         body=["It looks like gibberish, but it is not encrypted. It is **encoded** with base64: a way of writing any data "
               "using only letters, digits, `+`, `/` and `=`.",
               "There is no secret key. Anyone can decode it."],
         useful=["base64"],
         hint="Read the help for `base64` and look for the option that turns base64 back into normal text.",
         hint_cmd="base64 --help", short="the command to look up is base64.  Read: base64 --help"),
    dict(title="Layer cake", objective="Peel back every layer of encoding to reveal the flag.",
         ref=[("base64 -d FILE", "decode a base64 file"), ("A | base64 -d", "decode the output of A"),
              ("cat FILE", "print a file on the screen")],
         level="Hard", run=["cd ~/mission9", "cat cake.b64"],
         body=["You decoded base64 in the last mission. This message was encoded, then the result was encoded **again**, and again. "
               "Nobody wrote down how many layers there are.",
               "Copying each result into the next command works, but it is slow. A pipe (`|`) can feed one `base64 -d` "
               "straight into the next. Keep adding layers until you see the flag."],
         useful=["base64"],
         hint="Start with `base64 -d cake.b64`. Still gibberish? Add `| base64 -d` to the end and run it again. Repeat until it says **Flag**.",
         hint_cmd=None, short="decode, then pipe into another decode: base64 -d cake.b64 | base64 -d | ..."),
    dict(title="Endgame", objective="Recover three hidden pieces and put the final flag together.",
         ref=[("find DIR -name PATTERN", "search a folder tree by name"), ("grep TEXT FILE", "show the lines that contain TEXT"),
              ("cut --help", "pull one field out of a line"), ("base64 -d", "decode base64"),
              ("chmod +x FILE", "make a file runnable")],
         level="Very Hard", run=["cd ~/mission10", "cat README.txt"],
         body=["The final mission uses **everything** you have learned. The flag was split into three pieces, and each one "
               "is hidden a different way. `README.txt` tells you where each piece is.",
               "Put the pieces together in order, joined with dashes: `CYBA{piece1-piece2-piece3}`.",
               "There are no new commands here. `find`, `grep`, `cut`, `base64`, `chmod` and pipes are all you need."],
         useful=["find", "grep", "cut", "base64", "chmod"],
         hint="Take one piece at a time. **Piece 1:** hidden file names start with a dot, so search `vault` for names that match `.*`. "
              "**Piece 2:** `grep` the intruder's name, then decode their token (`cut` can pull the token out of the line). "
              "**Piece 3:** you have opened a locked script before.",
         hint_cmd=None, short="one piece at a time: find (1), grep + cut + base64 (2), chmod (3)."),
]
N = len(MISSIONS)

# Mission 0: an optional, untimed warm-up worth bonus points. Its flag is at the bottom of ~/README.txt.
WARMUP = dict(title="Warm-up", level="Warm-up", points=50,
              objective="Read the CTF orientation in the terminal with cat.",
              run=["cat orientation.txt"],
              ref=[("cat FILE", "print a file on the screen"), ("clear", "clear the screen")],
              body=["Get comfortable before the clock starts. Your **home folder** holds `orientation.txt`: how a CTF works, what a flag looks like, scoring and the rules.",
                    "`cat` prints a file on the screen. Click the terminal, type `cat orientation.txt` and press Enter. The warm-up flag is at the bottom.",
                    "Submit it for **50 bonus points**, or skip the warm-up. The competition clock starts when you begin Mission 1."],
              hint="The flag is on the last line of `orientation.txt` in your home folder. Type `cat orientation.txt`, press Enter, then copy the flag into `submit`.",
              short="the flag is at the bottom of ~/orientation.txt.  Read it: cat orientation.txt")
# CyberQuest scoring: points come from the difficulty level.
POINTS = {"Easy": 100, "Medium": 200, "Hard": 400, "Very Hard": 800}
for _m in MISSIONS: _m["points"] = POINTS[_m["level"]]
TOTAL_POINTS = sum(m["points"] for m in MISSIONS)
WEB_LOG, KC_LOG = "12,000", "40,000"

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
            "When you have the flag: submit CYBA{...}     Stuck? cat hint.txt"]
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
    lines = ["Your missions:", "   0  %-28s %-9s %4d pts  (bonus, untimed)" % ("Warm-up (optional)", "Bonus", WARMUP["points"])] + ["  %2d  %-28s %-9s %4d pts" % (i + 1, m["title"], m["level"], m["points"]) for i, m in enumerate(MISSIONS)]
    lines += ["  %s %4d pts" % (" " * 42, TOTAL_POINTS)]
    return "\n".join(lines + ["", "Read one with: mission 1   (up to %d)" % N]) + "\n"

# ---------------------------------------------------------------- README.txt files
# The home folder (game instructions) and each mission folder (that mission) get a README.txt.
# Missions 2, 4 and 5 put this run's clue on top (the builders write it), then the brief.
def readme(i, loglines, kc=False):
    t = brief(i, loglines)
    if kc:
        t = t.replace("submit CYBA{...}     Stuck?", "submit CYBA{...}, then press CHECK.     Stuck?")
    return t

def readme_home(kc=False):
    rows = ["  %2d  %-28s %-9s %4d pts" % (i + 1, m["title"], m["level"], m["points"]) for i, m in enumerate(MISSIONS)]
    steps = ["  1. Go to a mission:    cd ~/mission1",
             "  2. Look around:        ls",
             "  3. Read its brief:     cat README.txt" + ("" if kc else "     (or type: mission 1)"),
             "  4. Find the flag. It looks like CYBA{word-1a2b3c4d}",
             "  5. Check it:           submit CYBA{...}" + ("     then press CHECK" if kc else "")]
    if not kc: steps.append("  6. Stuck?              hint 1")
    return "\n".join(["CyberQuest Linux CTF", "====================", "",
                      "This file explains the game. Each mission folder has its own README.txt",
                      "with that mission's instructions. Read one with:  cat README.txt", "", "How to play"] + steps +
                     ["", "Missions"] + rows + ["  %s %4d pts" % (" " * 42, TOTAL_POINTS), "",
                      "Flags change every time the %s." % ("scenario starts" if kc else "page loads"), "",
                      "New to CTFs? Warm up first (optional, %d bonus points):  cat orientation.txt" % WARMUP["points"], ""])

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
    ] + (["  Then ask for a nudge:  hint 1"] if not kc else ["  Then open the Hint in the instructions panel."]) + ["",
        "Scoring",
        "  Easy 100    Medium 200    Hard 400    Very Hard 800",
        "  The most points wins. On a tie, the faster time wins." + ("" if not kc else ""), ""]
    if not kc:
        lines += ["The clock",
        "  The clock starts when you begin Mission 1 and counts up. It stops",
        "  when you capture the last flag.", ""]
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
    r = {"home": readme_home(kc), "orientation": orientation(kc)}
    r.update({"hint%d" % (i + 1): hint_file(i) for i in range(N)})
    r.update({str(i + 1): readme(i, loglines, kc) for i in range(N)})
    return r

def hint_line(i): return "Mission %d: %s" % (i + 1, MISSIONS[i]["short"])

def write_guest():
    sh = ["#!/bin/sh", "# mission [N]  prints a mission brief, the same text as the panel on the page.",
          "# Generated by guest/make-missions.py: edit that file, not this one.", 'case "$1" in']
    sh += ["  0) cat <<'EOF'", brief_warmup() + "EOF", "  ;;"]
    for i in range(N):
        sh += ["  %d) cat <<'EOF'" % (i + 1), brief(i, WEB_LOG) + "EOF", "  ;;"]
    sh += ["  *) cat <<'EOF'", overview() + "EOF", "  ;;", "esac", ""]
    open(os.path.join(HERE, "mission"), "w").write("\n".join(sh))
    h = ["#!/bin/sh", "# Names the command to learn, never the answer. Students read its --help.",
         "# Generated by guest/make-missions.py: edit that file, not this one.", 'case "$1" in']
    h += ['  0) echo "Mission 0: %s" ;;' % WARMUP["short"]]
    h += ['  %d) echo "%s" ;;' % (i + 1, hint_line(i)) for i in range(N)]
    h += ['  *) echo "Usage: hint 1   (up to %d)" ;;' % N, "esac", ""]
    open(os.path.join(HERE, "hint"), "w").write("\n".join(h))
    pts = " ".join(str(m["points"]) for m in [WARMUP] + MISSIONS)
    sub = ["#!/bin/sh", "# submit <flag>  checks your flag against every mission and shows its points.",
           "# Generated by guest/make-missions.py: edit that file, not this one.",
           'if [ -z "$1" ]; then echo "Usage: submit CYBA{...}"; exit 1; fi',
           "h=$(printf '%s' \"$1\" | sha256sum | cut -d' ' -f1)",
           "n=-1",
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
    p = os.path.join(ROOT, "public", "lite.js")
    texts = {str(i + 1): brief(i, WEB_LOG) for i in range(N)}
    texts["0"] = brief_warmup()
    hints = {i + 1: hint_line(i) for i in range(N)}
    hints[0] = "Mission 0: " + WARMUP["short"]
    block = ("  // Mission briefs and hints. Generated by guest/make-missions.py.\n"
             "  const MISSION_TEXT = " + json.dumps(texts, indent=0) + ";\n"
             "  const MISSION_OVERVIEW = " + json.dumps(overview()) + ";\n"
             "  const HINTS = " + json.dumps(hints, indent=0).replace('"', '"') + ";\n"
             "  const MISSION_COUNT = " + str(N) + ";\n"
             "  const README_TEXT = " + json.dumps(readmes(WEB_LOG), indent=0) + ";\n"
             "  const MISSION_POINTS = " + json.dumps(dict([(0, WARMUP["points"])] + [(i + 1, m["points"]) for i, m in enumerate(MISSIONS)])) + ";\n"
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
        hint = html(m["hint"]) + ("<pre>%s</pre>" % esc(m["hint_cmd"]) if m["hint_cmd"] else "")
        out.append(dict(title=m["title"], level=m["level"], points=m["points"], objective=m["objective"], run=m["run"],
                        ref=[list(r) for r in m["ref"]], notes=notes, hint=hint))
    w = WARMUP
    warm = dict(title=w["title"], level=w["level"], points=w["points"], objective=w["objective"], run=w["run"],
                ref=[list(r) for r in w["ref"]], notes=[html(b) for b in w["body"]], hint=html(w["hint"]))
    block = ("  // Generated by guest/make-missions.py: edit that file, not this one.\n"
             "  const MISSIONS = " + json.dumps(out, indent=2).replace("\n", "\n  ") + ";\n"
             "  const WARMUP = " + json.dumps(warm) + ";\n")
    p = os.path.join(ROOT, "public", "guide.js")
    s = open(p).read()
    a = s.index("  // Generated by guest/make-missions.py") if "// Generated by guest/make-missions.py" in s else s.index("  const MISSIONS = [")
    b = s.index("  const N = MISSIONS.length;")
    open(p, "w").write(s[:a] + block + "\n" + s[b:])

# ---------------------------------------------------------------- Killercoda
VERIFY = """#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step %d.
# Only a SHA-256 fingerprint of the flag is stored, so there is no answer to read.
want=$(cat /root/.quest/%d)
while IFS= read -r a; do
  [ "$(printf '%%s' "$a" | sha256sum | cut -d' ' -f1)" = "$want" ] && exit 0
done < /home/player/.answers
exit 1
"""

def write_killercoda():
    if not os.path.isdir(KC):
        print("Killercoda folder not found, skipped:", KC); return
    for i, m in enumerate(MISSIONS):
        n = i + 1
        md = ["# Mission %d: %s" % (n, m["title"]), "", "**Difficulty:** %s · **%d points**" % (m["level"], m["points"]), "", "**Objective:** " + m["objective"], "", "```"] + m["run"] + ["```{{exec}}", ""]
        for b in m["body"]:
            if isinstance(b, list):
                md += ["| Command | What it does |", "|---|---|"] + ["| `%s` | %s |" % row for row in b] + [""]
            else:
                md += [fill(b, KC_LOG), ""]
        tools = ", ".join("`%s`" % u for u in m["useful"])
        md += ["**%s:** %s." % (useful_label(m), tools) + (" Use `--help` to discover what they can do." if n > 2 else ""), "",
               "When you have the flag, record it with `submit` and press **CHECK**.", "", "<br>", "",
               "<details><summary>Hint</summary>", "", m["hint"], ""]
        if m["hint_cmd"]:
            cmd = m["hint_cmd"].split()[0]
            md += ["```", m["hint_cmd"], "```", "", "The full manual page has even more: `man %s` (press `q` to quit)." % cmd, ""]
        md += ["</details>", ""]
        d = os.path.join(KC, "step%d" % n); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "text.md"), "w").write("\n".join(md))
        open(os.path.join(d, "verify.sh"), "w").write(VERIFY % (n, n))
        os.chmod(os.path.join(d, "verify.sh"), 0o755)
    bg = os.path.join(KC, "intro", "background.sh")
    fn = ["# >>> README texts. Generated by guest/make-missions.py: edit that file, not this block.", "readme() {", '  case "$1" in']
    for k, t in readmes(KC_LOG, kc=True).items():
        fn += ["    %s) cat <<'EOF'" % k, t.rstrip("\n"), "EOF", "    ;;"]
    fn += ["  esac", "}", "# <<< README texts.", ""]
    s = open(bg).read()
    if "# >>> README texts." in s:
        patch(bg, "# >>> README texts.", "# <<< README texts.\n", "\n".join(fn))
    else:
        a = s.index("# ---- step 1:")
        open(bg, "w").write(s[:a] + "\n".join(fn) + "\n" + s[a:])
    w = WARMUP
    md = ["# Mission 0: Warm-up (optional)", "", "**Bonus:** %d points" % w["points"], "", "**Objective:** " + w["objective"], "",
          "```", "cat orientation.txt", "```{{exec}}", ""] + [b for x in w["body"][:2] for b in (x, "")] + [
          "Record the flag with `submit` if you like, then press **NEXT**. Skipping is fine.", ""]
    d = os.path.join(KC, "step0"); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "text.md"), "w").write("\n".join(md))
    p = os.path.join(KC, "index.json")
    j = json.load(open(p))
    j["details"]["steps"] = [{"title": "Warm-up (optional, %d bonus pts)" % WARMUP["points"], "text": "step0/text.md"}] + [{"title": "%s (%s, %d pts)" % (m["title"], m["level"], m["points"]), "text": "step%d/text.md" % (i + 1), "verify": "step%d/verify.sh" % (i + 1)}
                             for i, m in enumerate(MISSIONS)]
    open(p, "w").write(json.dumps(j, indent=2) + "\n")

write_guest(); write_lite(); write_panel(); write_killercoda()
print("Wrote %d missions." % N)
