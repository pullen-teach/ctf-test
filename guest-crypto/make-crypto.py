#!/usr/bin/env python3
"""One place for the Crypto CTF mission briefs. Writes every copy of them:

  guest-crypto/mission, hint, submit    commands inside the real Linux VM
  guest-crypto/readme/*.txt             README.txt files and the wordlist
  public/crypto/lite.js                 the same commands in lite mode
  public/crypto/guide.js                the mission panel on the right

Usage: python3 guest-crypto/make-crypto.py
Markup in the text below: `code` and **bold**. level is Easy, Medium, Hard or Very Hard (CyberQuest's scale).
"""
import json, os, re, sys, textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GAME = "Crypto"

MISSIONS = [
    dict(title="Not so secret", objective="Decode a base64 message and learn why encoding is not encryption.",
         ref=[("base64 FILE", "encode a file as base64"), ("base64 --help", "list everything base64 can do"), ("cat FILE", "print a file on the screen")],
         level="Easy", run=["cd ~/mission1", "cat message.b64"],
         body=["`message.b64` looks scrambled, but it is only **encoded** with base64: a way to write any data using letters, digits, `+`, `/` and `=`.",
               "Encoding is not encryption. There is no key: anyone who knows the encoding can turn it back."],
         useful=["base64"]),
    dict(title="Hex marks the spot", objective="Turn hexadecimal back into readable text.",
         ref=[("xxd FILE", "show a file as hex"), ("xxd --help", "list everything xxd can do"), ("cat FILE", "print a file on the screen")],
         level="Easy", run=["cd ~/mission2", "cat secret.hex"],
         body=["`secret.hex` is a long run of digits and the letters a to f. That is **hexadecimal**: every two characters are one byte, one letter of the message.",
               "`xxd` is a hex tool. It turns bytes into hex, and hex back into bytes."],
         useful=["xxd"]),
    dict(title="Thirteen steps", objective="Undo ROT13 by translating letters with tr.",
         ref=[("tr SET1 SET2", "swap each character of SET1 for SET2"), ("A-Z", "a range: every letter from A to Z"), ("tr ... < FILE", "feed a file into tr")],
         level="Easy", run=["cd ~/mission3", "cat message.txt"],
         body=["ROT13 moves every letter 13 places along the alphabet: A becomes N, B becomes O, and so on. Do it twice and you are back where you started.",
               "`tr` (translate) swaps characters: give it the letters to change and the letters to change them into. Feed it the file with `<`."],
         useful=["tr"]),
    dict(title="Hail Caesar", objective="Brute-force a Caesar cipher by trying every shift.",
         ref=[("caesar N FILE", "shift every letter N places"), ("caesar all FILE", "try all 25 shifts"), ("A | grep TEXT", "keep only lines with TEXT")],
         level="Medium", run=["cd ~/mission4", "cat message.txt"],
         body=["Julius Caesar hid messages by shifting every letter the same number of places. This message was shifted, but nobody wrote down how far.",
               "There are only 25 possible shifts. When the key is that small, try them all: that is called **brute force**. The `caesar` tool can shift by one number, or try them all."],
         useful=["caesar", "grep"]),
    dict(title="Mirror, mirror", objective="Reverse the Atbash cipher with a flipped alphabet.",
         ref=[("tr SET1 SET2", "swap each character of SET1 for SET2"), ("tr ... < FILE", "feed a file into tr"), ("cat FILE", "print a file on the screen")],
         level="Medium", run=["cd ~/mission5", "cat mirror.txt"],
         body=["This message uses **Atbash**, one of the oldest known ciphers: the alphabet is flipped, so A becomes Z, B becomes Y, C becomes X, and so on.",
               "Flipping twice gives you back the original. You already know a tool that swaps one set of letters for another."],
         useful=["tr"]),
    dict(title="Dots and dashes", objective="Decode a Morse code signal and build the flag from it.",
         ref=[("morse FILE", "decode Morse code"), ("morse -e FILE", "encode text as Morse"), ("cat FILE", "print a file on the screen")],
         level="Medium", run=["cd ~/mission6", "cat README.txt"],
         body=["Morse code turns letters into short and long signals: `.` is short and `-` is long. Letters are separated by spaces, words by `/`.",
               "Morse has no curly braces, so `README.txt` tells you how to turn the decoded code into a flag."],
         useful=["morse"]),
    dict(title="Fingerprints", objective="Crack a SHA-256 hash by fingerprinting a list of guesses.",
         ref=[("sha256sum FILE", "fingerprint a file"), ("hashlines FILE", "fingerprint every line of a file"), ("A | grep TEXT", "keep only lines with TEXT")],
         level="Medium", run=["cd ~/mission7", "cat target.sha256"],
         body=["A **hash** is a fingerprint of some text. The same text always gives the same hash, but you cannot turn a hash back into the text.",
               "`candidates.txt` holds 100 possible flags. Exactly one has the fingerprint in `target.sha256`. Password crackers work the same way: hash every guess from a list and compare."],
         useful=["hashlines", "grep"]),
    dict(title="XOR marks", objective="Brute-force a single-byte XOR key.",
         ref=[("xor KEY FILE", "XOR hex data with a key from 0 to 255"), ("xor all FILE", "try every key"), ("A | grep TEXT", "keep only lines with TEXT")],
         level="Hard", run=["cd ~/mission8", "cat cipher.hex"],
         body=["XOR is a building block of most modern ciphers. Every byte of this message was XORed with the same secret **key byte**: a number from 1 to 255.",
               "One byte means only 255 possible keys. Same trick as Caesar: try every key and look for the one that gives readable text."],
         useful=["xor", "grep"]),
    dict(title="Keyed up", objective="Find the keyword, then decrypt a Vigenère cipher.",
         ref=[("vigenere -d KEY FILE", "decrypt with a keyword"), ("tr SET1 SET2", "swap characters"), ("cat FILE", "print a file on the screen")],
         level="Hard", run=["cd ~/mission9", "ls"],
         body=["`secret.txt` is encrypted with the **Vigenère** cipher: each letter is shifted by a different amount, set by a keyword that repeats. Brute force won't work here: there are far too many keys.",
               "But somebody left a briefing behind, scrambled with a cipher you already know."],
         useful=["tr", "vigenere"]),
    dict(title="The vault", objective="Crack the keyword's hash, then open the vault.",
         ref=[("hashlines FILE", "fingerprint every line"), ("base64 -d FILE", "decode base64"), ("vigenere -d KEY", "decrypt with a keyword"), ("A | B", "send the output of A into B")],
         level="Very Hard", run=["cd ~/mission10", "cat README.txt"],
         body=["The final vault combines three skills. It was encrypted with a Vigenère keyword, then base64-encoded. Nobody wrote the keyword down: only its SHA-256 fingerprint survived.",
               "Crack the fingerprint against the wordlist, then use the keyword to open the vault."],
         useful=["hashlines", "grep", "base64", "vigenere"]),
]
N = len(MISSIONS)

# Mission 0: an optional, untimed warm-up worth bonus points. Its flag is at the bottom of ~/orientation.txt.
WARMUP = dict(title="Warm-up", level="Warm-up", points=50,
              objective="Read the CTF orientation in the terminal with cat.",
              run=["cat orientation.txt"],
              ref=[("cat FILE", "print a file on the screen"), ("clear", "clear the screen")],
              body=["Get comfortable before the clock starts. Your **home folder** holds `orientation.txt`: how a CTF works, what a flag looks like, scoring and the crypto tools you will use.",
                    "`cat` prints a file on the screen. Click the terminal, type `cat orientation.txt` and press Enter. The warm-up flag is at the bottom.",
                    "Submit it for **50 bonus points**, or skip the warm-up. The competition clock starts when you begin Mission 1."],
              hint="The flag is on the last line of `orientation.txt` in your home folder. Type `cat orientation.txt`, press Enter, then copy the flag into `submit`.",
              short="the flag is at the bottom of ~/orientation.txt.  Read it: cat orientation.txt")
# CyberQuest scoring: points come from the difficulty level.
POINTS = {"Easy": 100, "Medium": 200, "Hard": 400, "Very Hard": 800}
for _m in MISSIONS: _m["points"] = POINTS[_m["level"]]
TOTAL_POINTS = sum(m["points"] for m in MISSIONS)
LEARNED = [
    "Decoded base64 and read raw bytes as hex with <code>xxd</code>.",
    "Shifted letters with ROT13 and the Caesar cipher using <code>tr</code> and <code>caesar</code>.",
    "Reversed the alphabet (Atbash) and decoded Morse code.",
    "Matched a target hash by fingerprinting candidates with <code>sha256sum</code>.",
    "Broke XOR encryption by trying every key with <code>xor all</code>.",
    "Decrypted a Vigen\u00e8re cipher once you recovered its keyword.",
    "Combined hashing, base64 and Vigen\u00e8re to crack the final vault.",
]
# Hints, in tiers: each one gives more direction than the last. Each costs 5% of the
# mission's points, charged once. Easy missions get one hint; harder ones get more.
HINT_TIERS = {
    "Not so secret": ["Read `base64 --help` and look for the option that **decodes**. Options go between the command and the file name."],
    "Hex marks the spot": ["Read `xxd --help`. You need two options together: **-r** (reverse: hex back to bytes) and **-p** (plain hex, no addresses)."],
    "Thirteen steps": ["`tr` needs two sets: every letter, and every letter moved 13 places. A-Z moved 13 places is N-Z followed by A-M. Do the same for lowercase, and feed the file in with `<`."],
    "Hail Caesar": ["Read `caesar --help`. It can try **all** the shifts at once.",
                    "`caesar all message.txt` prints 25 versions. Pipe it into `grep CYBA` to keep the one that makes sense."],
    "Mirror, mirror": ["Use `tr` again. The first set is the alphabet in order; the second set is the alphabet **backwards**: `ZYXWVUTSRQPONMLKJIHGFEDCBA`. Do lowercase too.",
                       "`tr 'A-Za-z' 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba' < mirror.txt`"],
    "Dots and dashes": ["Read `morse --help`: decoding is what it does by default.",
                        "`morse signal.txt` prints the message. Put the code into the flag format from `README.txt`, in lowercase."],
    "Fingerprints": ["You can't reverse a hash, but you can hash every candidate. `hashlines candidates.txt` prints each line's fingerprint next to it.",
                     "Pipe it into `grep` with the first few characters of the target hash, for example `hashlines candidates.txt | grep 3fa9` (use your own hash)."],
    "XOR marks": ["Read `xor --help`. Like `caesar`, it can try every key with **all**.",
                  "`xor all cipher.hex | grep CYBA` keeps the one key that decodes it."],
    "Keyed up": ["`briefing.txt` is ROT13, like Mission 3: `tr 'A-Za-z' 'N-ZA-Mn-za-m' < briefing.txt`.",
                 "The briefing names the keyword. Read `vigenere --help`, then decrypt: `vigenere -d KEYWORD secret.txt`."],
    "The vault": ["**Step 1:** find the keyword. Fingerprint every word in `words.txt` and look for the hash from `key.sha256`, like Mission 7.",
                  "**Step 2:** the vault is base64 on the outside. Decode it first: `base64 -d vault.b64`.",
                  "**Step 3:** pipe the decoded text into the Vigenère tool: `base64 -d vault.b64 | vigenere -d KEYWORD`.",
                  "Still gibberish? Check the keyword is exactly the word from `words.txt` whose hash matched. The opened vault starts with `Vault opened`."],
}
for _m in MISSIONS: _m["hints"] = HINT_TIERS[_m["title"]]
# Each hint costs 5% of the mission's points. The warm-up hint is free.
HINT_RATE = 0.05
def hint_cost(m): return int(round(m["points"] * HINT_RATE))
WEB_LOG, KC_LOG = "", ""

# The Mission 10 wordlist (one of these is the vault keyword on each page load).
WORDS = """acorn amber anchor arrow aspen badger beacon birch blizzard bramble breeze canyon cedar cinder cobalt comet compass coral
cricket crystal cypress dagger delta dragon drift dune eagle eclipse ember falcon fable fern galaxy garnet glacier granite
harbor hazel heron horizon iris island ivory jasper jungle kestrel kiwi lagoon lantern lotus magnet maple marble meadow
meteor mint nebula nectar nova oasis onyx orbit orchid otter pebble phoenix pine prairie quartz quill raven reef ripple
rocket saffron sapphire saturn sierra spruce summit thunder tiger topaz tundra umbra velvet violet vortex walnut willow
wombat yonder zephyr zinnia aurora bison dahlia fjord gecko marlin""".split()
assert len(WORDS) == 100 and len(set(WORDS)) == 100, len(WORDS)

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
    return "\n".join(["CyberQuest Crypto CTF", "=====================", "",
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
    lines += ["Your crypto toolkit",
        "  base64   xxd   tr   sha256sum      real Linux tools",
        "  caesar   morse   xor   vigenere   hashlines   helpers for this CTF",
        "  Every one explains itself:  caesar --help", ""]
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
    r = {"home": readme_home(kc), "words": "\n".join(WORDS) + "\n"}

    r.update({str(i + 1): readme(i, loglines, kc) for i in range(N)})
    return r

def hint_line(i): return "Mission %d: %s" % (i + 1, MISSIONS[i]["short"])

def write_guest():
    sh = ["#!/bin/sh", "# mission [N]  prints a mission brief, the same text as the panel on the page.",
          "# Generated by guest-crypto/make-crypto.py: edit that file, not this one.", 'case "$1" in']
    for i in range(N):
        sh += ["  %d) cat <<'EOF'" % (i + 1), brief(i, WEB_LOG) + "EOF", "  ;;"]
    sh += ["  *) cat <<'EOF'", overview() + "EOF", "  ;;", "esac", ""]
    open(os.path.join(HERE, "mission"), "w").write("\n".join(sh))
    def sq(t): return "'" + "\n".join(textwrap.wrap(plain(t), 66)).replace("'", "'\\''") + "'"
    h = ["#!/bin/sh", "# hint N           shows the hints you already have and the price of the next one",
         "# hint N --show    buys the next hint. Each hint costs 5% of the mission's points,",
         "# charged once: the page keeps the score when it sees the [quest] line. The warm-up hint is free.",
         "# Generated by guest-crypto/make-crypto.py: edit that file, not this one.",
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
           "# Generated by guest-crypto/make-crypto.py: edit that file, not this one.",
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
    p = os.path.join(ROOT, "public", "crypto", "lite.js")
    texts = {str(i + 1): brief(i, WEB_LOG) for i in range(N)}
    hints = {i + 1: [plain(t) for t in m["hints"]] for i, m in enumerate(MISSIONS)}
    block = ("  // Mission briefs and hints. Generated by guest-crypto/make-crypto.py.\n"
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
    block = ("  // Generated by guest-crypto/make-crypto.py: edit that file, not this one.\n"
             "  const MISSIONS = " + json.dumps(out, indent=2).replace("\n", "\n  ") + ";\n"
             "  const LEARNED = " + json.dumps(LEARNED) + ";\n")
    p = os.path.join(ROOT, "public", "crypto", "guide.js")
    s = open(p).read()
    a = s.index("  // Generated by guest-crypto/make-crypto.py") if "// Generated by guest-crypto/make-crypto.py" in s else s.index("  const MISSIONS = [")
    b = s.index("  const N = MISSIONS.length;")
    open(p, "w").write(s[:a] + block + "\n" + s[b:])

write_guest(); write_lite(); write_panel()
print("Wrote %d missions." % N)
