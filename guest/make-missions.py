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
    dict(title="Make your move", level="Easy", run=["cd ~/mission1", "ls"],
         body=["Moving around is the first real skill on the command line:", MOVES,
               "A flag is waiting at the end of a trail that starts in `~/mission1`. Nothing on this trail needs opening: "
               "the **file names** are the signposts. Use `ls` to read them and `cd` to follow them. Some turns are dead ends.",
               "At the end of the trail, `ls` shows you the flag itself."],
         useful=["pwd", "ls", "cd"],
         hint="Lost? `pwd` shows where you are and `cd ..` goes back up one level. "
              "Run `ls` in every folder: the names tell you which folder to `cd` into next.",
         hint_cmd=None,
         short="lost? pwd shows where you are, cd .. goes back up, ls reads the signs."),
    dict(title="Let the cat out of the bag", level="Easy", run=["cd ~/mission2", "cat README.txt"],
         body=["`cat` prints a file on the screen. You just used it to read `README.txt`.",
               "The cat is hiding in `bag.txt`: 100 lines, and every one looks like a flag. Only the line number in "
               "`README.txt` is real. Counting 100 lines by hand is how mistakes happen.",
               "Almost every Linux command can **explain itself**: type its name, a space, then `--help`. Ask `cat` for "
               "its help and look for an option that numbers the lines. You will use `--help` in every mission after this one."],
         useful=["cat"],
         hint="Read the help for `cat` and look for the option that **numbers** the lines. Options go between the command and the file name.",
         hint_cmd="cat --help", short="the command to look up is cat.     Read: cat --help"),
    dict(title="Now you see me", level="Easy", run=["cd ~/mission3", "ls"],
         body=["There is a flag in this folder, but plain `ls` will not show it.",
               "On Linux, a file whose name starts with a dot is **hidden**. Watch out: one hidden file is a decoy."],
         useful=["ls", "cat"],
         hint="Read the help for `ls` and look for an option that also shows names starting with `.`",
         hint_cmd="ls --help", short="the command to look up is ls.      Read: ls --help"),
    dict(title="Needle in the tree", level="Medium", run=["cd ~/mission4", "cat README.txt"],
         body=["The `archive` folder holds about 80 files in 20 folders. Exactly **one** of them has the file ending named "
               "in `README.txt`, and it holds the flag.",
               "Opening folders one by one is too slow. Let the computer search."],
         useful=["find", "cat"],
         hint="Read the help for `find` and look for a way to match a file's **name** against a pattern. In a pattern, `*` means \"anything\".",
         hint_cmd="find --help", short="the command to look up is find.    Read: find --help"),
    dict(title="Search party", level="Medium", run=["cd ~/mission5", "cat README.txt"],
         body=["`access.log` has {LOGLINES} lines. One intruder logged in exactly once.",
               "Their **token** on that line is the flag. Scrolling would take all day."],
         useful=["grep", "head", "wc"],
         hint="Read the help for `grep` and look at the **Usage** line at the top: it shows what goes first and what goes second.",
         hint_cmd="grep --help", short="the command to look up is grep.    Read: grep --help"),
    dict(title="Decoder ring", level="Hard", run=["cd ~/mission6", "cat message.b64"],
         body=["It looks like gibberish, but it is not encrypted. It is **encoded** with base64: a way of writing any data "
               "using only letters, digits, `+`, `/` and `=`.",
               "There is no secret key. Anyone can decode it."],
         useful=["base64"],
         hint="Read the help for `base64` and look for the option that turns base64 back into normal text.",
         hint_cmd="base64 --help", short="the command to look up is base64.  Read: base64 --help"),
]
N = len(MISSIONS)
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
    out = ["Mission %d: %s   [%s]" % (n, m["title"], m["level"]), ""] + ["  " + c for c in m["run"]] + [""]
    for b in m["body"]:
        if isinstance(b, list):
            out += ["  %-11s %s" % row for row in b] + [""]
        else:
            out += textwrap.wrap(plain(fill(b, loglines)), 72) + [""]
    out += [useful_label(m) + ": " + ", ".join(m["useful"]),
            "When you have the flag: submit CYBA{...}     Stuck? hint %d" % n]
    return "\n".join(out) + "\n"

def overview():
    lines = ["Your missions:"] + ["  %d  %-28s %s" % (i + 1, m["title"], m["level"]) for i, m in enumerate(MISSIONS)]
    return "\n".join(lines + ["", "Read one with: mission 1   (up to %d)" % N]) + "\n"

def hint_line(i): return "Mission %d: %s" % (i + 1, MISSIONS[i]["short"])

def write_guest():
    sh = ["#!/bin/sh", "# mission [N]  prints a mission brief, the same text as the panel on the page.",
          "# Generated by guest/make-missions.py: edit that file, not this one.", 'case "$1" in']
    for i in range(N):
        sh += ["  %d) cat <<'EOF'" % (i + 1), brief(i, WEB_LOG) + "EOF", "  ;;"]
    sh += ["  *) cat <<'EOF'", overview() + "EOF", "  ;;", "esac", ""]
    open(os.path.join(HERE, "mission"), "w").write("\n".join(sh))
    h = ["#!/bin/sh", "# Names the command to learn, never the answer. Students read its --help.",
         "# Generated by guest/make-missions.py: edit that file, not this one.", 'case "$1" in']
    h += ['  %d) echo "%s" ;;' % (i + 1, hint_line(i)) for i in range(N)]
    h += ['  *) echo "Usage: hint 1   (up to %d)" ;;' % N, "esac", ""]
    open(os.path.join(HERE, "hint"), "w").write("\n".join(h))

def patch(path, start, end, new):
    s = open(path).read()
    a = s.index(start); b = s.index(end, a) + len(end)
    open(path, "w").write(s[:a] + new + s[b:])

def write_lite():
    p = os.path.join(ROOT, "public", "lite.js")
    texts = {str(i + 1): brief(i, WEB_LOG) for i in range(N)}
    hints = {i + 1: hint_line(i) for i in range(N)}
    block = ("  // Mission briefs and hints. Generated by guest/make-missions.py.\n"
             "  const MISSION_TEXT = " + json.dumps(texts, indent=0) + ";\n"
             "  const MISSION_OVERVIEW = " + json.dumps(overview()) + ";\n"
             "  const HINTS = " + json.dumps(hints, indent=0).replace('"', '"') + ";\n"
             "  const MISSION_COUNT = " + str(N) + ";\n"
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
        body = []
        for b in m["body"]:
            if isinstance(b, list):
                body.append('<span class="moves">' + "<br>".join("<code>%s</code> %s" % (esc(c), esc(d)) for c, d in b) + "</span>")
            else:
                body.append(html(fill(b, WEB_LOG)))
        hint = html(m["hint"]) + ("<pre>%s</pre>" % esc(m["hint_cmd"]) if m["hint_cmd"] else "")
        out.append(dict(title=m["title"], level=m["level"], run=m["run"], body=body, useful=m["useful"], hint=hint))
    block = ("  // Generated by guest/make-missions.py: edit that file, not this one.\n"
             "  const MISSIONS = " + json.dumps(out, indent=2).replace("\n", "\n  ") + ";\n")
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
        md = ["# Mission %d: %s" % (n, m["title"]), "", "**Difficulty:** %s" % m["level"], "", "```"] + m["run"] + ["```{{exec}}", ""]
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
    p = os.path.join(KC, "index.json")
    j = json.load(open(p))
    j["details"]["steps"] = [{"title": "%s (%s)" % (m["title"], m["level"]), "text": "step%d/text.md" % (i + 1), "verify": "step%d/verify.sh" % (i + 1)}
                             for i, m in enumerate(MISSIONS)]
    open(p, "w").write(json.dumps(j, indent=2) + "\n")

write_guest(); write_lite(); write_panel(); write_killercoda()
print("Wrote %d missions." % N)
