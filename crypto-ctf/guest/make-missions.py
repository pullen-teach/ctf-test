#!/usr/bin/env python3
"""One place for the mission briefs. Writes every copy of them:

  guest/mission, guest/hint             commands inside the real Linux VM (Crypto CTF)
  public/lite.js                        the same commands in lite mode
  public/guide.js                       the mission panel on the right
  linux-quest-mission-1/stepN/text.md   the Killercoda steps (and index.json)

Usage: python3 guest/make-missions.py [path/to/linux-quest-mission-1]
Markup in the text below: `code` and **bold**. level is Easy, Medium, Hard or Very Hard (CyberQuest's scale).
"""
import json, os, re, sys, textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "no-killercoda-for-crypto")

MISSIONS = [
    dict(title="Base camp", objective="Recognise base64 and decode it.",
         ref=[("cat FILE", "print a file on the screen"), ("base64 -d FILE", "decode base64"), ("base64 --help", "list everything base64 can do")],
         level="Easy", run=["cd ~/mission1", "cat message.b64"],
         body=["**Encoding** is not encryption: it writes the same data a different way, and **anyone** can undo it. No key needed.",
               "`message.b64` is written in **base64**: upper and lower case letters, digits, `+` and `/`, often ending in `=`. Decode it to read the flag."],
         useful=["cat", "base64"]),
    dict(title="Hex marks the spot", objective="Turn hexadecimal back into text.",
         ref=[("xxd -r -p FILE", "turn plain hex back into text"), ("xxd FILE", "show any file as hex"), ("xxd --help", "list everything xxd can do")],
         level="Easy", run=["cd ~/mission2", "cat signal.hex"],
         body=["Computers store everything as numbers. **Hexadecimal** (hex) writes each byte as two characters from `0-9` and `a-f`: the letter `A` is `41` and a space is `20`.",
               "`signal.hex` is a message written in hex. The `xxd` tool converts between text and hex: read its help to run it in reverse."],
         useful=["xxd"]),
    dict(title="Spin cycle", objective="Undo a ROT13 rotation.",
         ref=[("caesar 13 FILE", "shift every letter 13 places"), ("caesar --help", "how caesar works"), ("tr 'A-Za-z' 'N-ZA-Mn-za-m'", "ROT13, the classic way")],
         level="Easy", run=["cd ~/mission3", "cat note.txt"],
         body=["**ROT13** rotates every letter 13 places along the alphabet: `A` becomes `N` and `B` becomes `O`. The alphabet has 26 letters, so rotating by 13 twice brings you back where you started.",
               "`note.txt` was rotated with ROT13. Rotate it again to read it. This computer has a `caesar` tool for shifting letters."],
         useful=["caesar", "tr"]),
    dict(title="Hail Caesar", objective="Break a Caesar cipher by trying every shift.",
         ref=[("caesar --all FILE", "try all 25 shifts"), ("caesar N FILE", "shift every letter by N"), ("cat FILE", "print a file on the screen")],
         level="Medium", run=["cd ~/mission4", "cat scroll.txt"],
         body=["Julius Caesar hid messages by shifting every letter a few places. `scroll.txt` uses a Caesar shift, but nobody wrote down **which** one.",
               "There are only 25 possible shifts. A computer can try them all in a blink: trying every possible key is called a **brute-force** attack."],
         useful=["caesar"]),
    dict(title="Russian doll", objective="Peel three layers of encoding, one at a time.",
         ref=[("base64 -d", "decode base64"), ("xxd -r -p", "decode hex"), ("caesar 13", "undo ROT13"), ("A | B", "send the output of A into B")],
         level="Medium", run=["cd ~/mission5", "cat doll.txt"],
         body=["Like a set of Russian dolls, this message is wrapped in **three layers**: hex, base64 and ROT13. Working out the order is part of the puzzle.",
               "Look at the text, decide which layer is on the outside, decode it, then look again. Pipes (`|`) chain the steps into one command."],
         useful=["xxd", "base64", "caesar"]),
    dict(title="Fingerprints", objective="Use a SHA-256 fingerprint to find the real key.",
         ref=[("sha256sum FILE...", "fingerprint one or more files"), ("grep TEXT", "keep only lines that contain TEXT"), ("cat FILE", "print a file on the screen")],
         level="Medium", run=["cd ~/mission6", "cat README.txt"],
         body=["A **hash** is a fingerprint for data: the same input always gives the same hash, and changing a single letter changes it completely. You cannot turn a hash back into the data.",
               "The `keys` folder holds a dozen keys that all look alike. `README.txt` gives the SHA-256 fingerprint of the real one."],
         useful=["sha256sum", "grep"]),
    dict(title="Letter detective", objective="Crack a substitution cipher with frequency analysis.",
         ref=[("freq FILE", "count how often each letter appears"), ("tr 'abc' 'XYZ' < FILE", "swap letters to test your guesses"), ("cat FILE", "print a file on the screen")],
         level="Hard", run=["cd ~/mission7", "cat cipher.txt"],
         body=["In a **substitution cipher** every letter is swapped for another one. There are more possible keys than grains of sand on Earth, so trying them all is hopeless.",
               "But language leaves clues. `freq` counts the letters: in English `e` and `t` are the most common, and `the` is the most common word. Test your guesses with `tr`, writing solved letters in CAPITALS.",
               "The last sentence holds a secret word and a number. Submit them as `CYBA{word-number}`."],
         useful=["freq", "tr"]),
    dict(title="Keyword cipher", objective="Find a hidden keyword, then decrypt a Vigenère cipher.",
         ref=[("vigenere -d KEY FILE", "decrypt with a keyword"), ("vigenere --help", "how vigenere works"), ("cat FILE", "print a file on the screen")],
         level="Hard", run=["cd ~/mission8", "cat poem.txt"],
         body=["A **Vigenère cipher** is a Caesar shift that changes with every letter, following a **keyword**: with the key `cab`, the first letter shifts by 2, the next by 0, the next by 1, then the key repeats.",
               "`secret.txt` was encrypted with a keyword. The keyword is hidden in plain sight in `poem.txt`. Find it, then decrypt."],
         useful=["vigenere", "cat"]),
    dict(title="The vault", objective="Recover the keyword, then decode and decrypt the vault.",
         ref=[("caesar --all FILE", "try all 25 shifts"), ("base64 -d FILE", "decode base64"), ("vigenere -d KEY", "decrypt with a keyword"), ("A | B", "send the output of A into B")],
         level="Very Hard", run=["cd ~/mission9", "cat README.txt"],
         body=["The final mission chains everything. `vault.b64` was encrypted with a Vigenère cipher, then encoded in base64.",
               "The keyword is written in `key.txt`, but that note was itself scrambled with a Caesar shift. Recover the keyword, decode the vault, decrypt it."],
         useful=["caesar", "base64", "vigenere"]),
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
# Hints, in tiers: each one gives more direction than the last. Each costs 5% of the
# mission's points, charged once. Easy missions get one hint; harder ones get more.
HINT_TIERS = {
    "Base camp": ["`base64 --help` lists an option that **decodes**. Put it between `base64` and the file name."],
    "Hex marks the spot": ["Read `xxd --help`: `-r` **reverses** hex back into text, and `-p` says the hex is **plain** (no addresses or columns). You need both: `xxd -r -p signal.hex`."],
    "Spin cycle": ["`caesar --help` shows how to shift letters. ROT13 is a shift of 13, and doing it again undoes it: `caesar 13 note.txt`."],
    "Hail Caesar": ["`caesar --all scroll.txt` tries every shift on the first line. Look for the one that reads as English.",
                    "Found the readable line? Note its shift number N, then decode the whole file with `caesar N scroll.txt`. The flag is on the second line."],
    "Russian doll": ["Recognise the outside layer: only `0-9` and `a-f` means **hex** (`xxd -r -p`); mixed-case letters, digits, `+`, `/` and `=` means **base64** (`base64 -d`).",
                     "ROT13 is the innermost layer. Peel the other two first, piping each step into the next, then finish with `| caesar 13`."],
    "Fingerprints": ["`sha256sum keys/*` fingerprints every key at once. Compare each one with the hash in `README.txt`.",
                     "Let the computer compare: `sha256sum keys/* | grep ABCD`, using the first few characters of the hash. Then `cat` the file it names."],
    "Letter detective": ["Run `freq cipher.txt`. The most common letter is probably `e`. Swap it in capitals: `tr 'x' 'E' < cipher.txt`, using your letter instead of x.",
                         "Find the most common three-letter word: it is almost certainly `the`. Add those letters to your `tr`, in the same order: `tr 'xqz' 'ETH' < cipher.txt`. Keep adding pairs.",
                         "Short words help: a one-letter word is `a` or `i`, and `is`, `it`, `of` and `to` are common two-letter words. The secret word comes right after \"the secret word is\"."],
    "Keyword cipher": ["Read only the **first letter** of each line of `poem.txt`, top to bottom. They spell the keyword.",
                       "Decrypt with that keyword: `vigenere -d KEYWORD secret.txt`. If the output is still scrambled, check the spelling of the keyword."],
    "The vault": ["**Step 1:** `caesar --all key.txt` tries every shift. The readable line tells you the keyword.",
                  "**Step 2:** `base64 -d vault.b64` gives scrambled text: that is the Vigenère ciphertext.",
                  "**Step 3:** pipe it into the decryption: `base64 -d vault.b64 | vigenere -d KEYWORD`.",
                  "The flag is on the last line of the decrypted text. Copy it exactly, from `CYBA{` to `}`."],
}
for _m in MISSIONS: _m["hints"] = HINT_TIERS[_m["title"]]
# Each hint costs 5% of the mission's points. The warm-up hint is free.
HINT_RATE = 0.05
def hint_cost(m): return int(round(m["points"] * HINT_RATE))
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
    lines = ["Your missions:", "   0  %-28s %-9s %4d pts  (bonus, untimed)" % ("Warm-up (optional)", "Bonus", WARMUP["points"])] + ["  %2d  %-28s %-9s %4d pts" % (i + 1, m["title"], m["level"], m["points"]) for i, m in enumerate(MISSIONS)]
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
    return "\n".join(["CyberQuest Crypto CTF", "=====================", "",
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
        "  Read the tool's built-in help first:  caesar --help",
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
    def sq(t): return "'" + "\n".join(textwrap.wrap(plain(t), 66)).replace("'", "'\\''") + "'"
    h = ["#!/bin/sh", "# hint N           shows the hints you already have and the price of the next one",
         "# hint N --show    buys the next hint. Each hint costs 5% of the mission's points,",
         "# charged once: the page keeps the score when it sees the [quest] line. The warm-up hint is free.",
         "# Generated by guest/make-missions.py: edit that file, not this one.",
         'case "$1" in',
         "  0) echo %s; exit 0 ;;" % sq("Mission 0: " + WARMUP["hint"])]
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
    hints = {i + 1: [plain(t) for t in m["hints"]] for i, m in enumerate(MISSIONS)}
    hints[0] = "Mission 0: " + plain(WARMUP["hint"])
    block = ("  // Mission briefs and hints. Generated by guest/make-missions.py.\n"
             "  const MISSION_TEXT = " + json.dumps(texts, indent=0) + ";\n"
             "  const MISSION_OVERVIEW = " + json.dumps(overview()) + ";\n"
             "  const HINTS = " + json.dumps(hints, indent=0).replace('"', '"') + ";\n"
             "  const MISSION_COUNT = " + str(N) + ";\n"
             "  const README_TEXT = " + json.dumps(readmes(WEB_LOG), indent=0) + ";\n"
             "  const HINT_COST = " + json.dumps({i + 1: hint_cost(m) for i, m in enumerate(MISSIONS)}) + ";\n"
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
        out.append(dict(title=m["title"], level=m["level"], points=m["points"], hintCost=hint_cost(m), objective=m["objective"], run=m["run"],
                        ref=[list(r) for r in m["ref"]], notes=notes, hints=[html(t) for t in m["hints"]]))
    w = WARMUP
    warm = dict(title=w["title"], level=w["level"], points=w["points"], objective=w["objective"], run=w["run"],
                ref=[list(r) for r in w["ref"]], notes=[html(b) for b in w["body"]], hints=[html(w["hint"])], hintCost=0)
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
               ]
        for k, t in enumerate(m["hints"]):
            md += ["<details><summary>Hint %d of %d</summary>" % (k + 1, len(m["hints"])), "", t, "", "</details>", ""]
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
