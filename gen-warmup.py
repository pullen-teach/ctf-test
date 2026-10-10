import json, io

# The two warm-ups, in the guide.js schema (title, level, points, hintCost,
# objective, run, ref[[cmd,desc]], notes[], hints[]).
MISSIONS = [
  {
    "title": "Orientation",
    "level": "Warm-up",
    "points": 50,
    "hintCost": 0,
    "objective": "Read the CTF orientation in the terminal with cat, then submit your first flag.",
    "run": ["cat orientation.txt"],
    "ref": [
      ["cat FILE", "print a file on the screen"],
      ["submit CYBA{...}", "check a flag"],
      ["clear", "clear the screen (or Ctrl+L)"],
    ],
    "notes": [
      "Welcome. This module gets you comfortable before you start a real CTF. Your <b>home folder</b> holds <code>orientation.txt</code>: what a CTF is, what a flag looks like, how scoring works and the rules.",
      "<code>cat</code> prints a file on the screen. Click the terminal, type <code>cat orientation.txt</code> and press Enter. The warm-up flag is on the last line.",
      "A flag looks like <code>CYBA{word-1a2b3c4d}</code>. Submit it with <code>submit</code>, a space, then the whole flag, for <b>50 points</b>. These warm-ups are untimed, so there is no rush.",
    ],
    "hints": [
      "The flag is on the last line of <code>orientation.txt</code> in your home folder. Type <code>cat orientation.txt</code>, press Enter, then copy the flag into <code>submit</code>.",
    ],
  },
  {
    "title": "Speed drills",
    "level": "Warm-up",
    "points": 50,
    "hintCost": 0,
    "objective": "Practise the keys that make you fast: Tab, the up arrow, Ctrl+C, and Linux-style copy and paste.",
    "run": ["cd ~/speed", "cat README.txt"],
    "ref": [
      ["Tab", "finish a file or command name for you"],
      ["up arrow", "bring back your last command"],
      ["Ctrl+C", "stop a running command"],
      ["select, then middle-click", "copy and paste, the Linux way (right-click also pastes)"],
      ["history", "list the commands you have typed"],
      ["clear", "clear the screen (or Ctrl+L)"],
    ],
    "notes": [
      "Four drills, four pieces of the flag. Each drill needs one terminal skill, and each piece is 4 characters.",
      "<b>Drill 1, Tab:</b> <code>cd tab</code>, type <code>cat dri</code> and press <b>Tab</b>. The long file name finishes itself.",
      "<b>Drill 2, up arrow:</b> run <code>again</code> 5 times within 15 seconds. After the first one, press <b>up arrow</b> then Enter.",
      "<b>Drill 3, Ctrl+C:</b> run <code>runaway</code>. It never stops by itself. Hold <b>Ctrl</b> and press <b>C</b>.",
      "<b>Drill 4, copy and paste:</b> <code>cd ~/speed/paste</code>, then <code>cat code.txt</code>. <b>Highlight</b> the long code with the mouse or trackpad (that copies it), type <code>pasteit </code> and a space, then <b>middle-click</b> to paste it (<b>right-click</b> also pastes) and press Enter. No Ctrl+C or Ctrl+V needed: in a Linux terminal, selecting is copying and the middle button pastes.",
      "Put the pieces together in order: <code>submit CYBA{speed-PIECE1PIECE2PIECE3PIECE4}</code>. Paste each piece the same way: highlight it, then middle-click (or right-click).",
    ],
    "hints": [
      "Drill 1: in ~/speed/tab type <code>cat dri</code>, then press Tab. Drill 2: type <code>again</code> and Enter, then press the up arrow and Enter four more times, quickly. Drill 3: type <code>runaway</code>, then hold Ctrl and press C. Drill 4: in ~/speed/paste run <code>cat code.txt</code>, highlight the CODE with the mouse, type <code>pasteit </code> then middle-click (or right-click) to paste it. The flag is <code>CYBA{speed-</code> followed by the four pieces in order, then <code>}</code>.",
    ],
  },
]

LEARNED = [
  "Read files with <code>cat</code> and submitted your first flag with <code>submit</code>.",
  "Learned what a CTF is, what a flag looks like, and how scoring works.",
  "Built terminal speed: <code>Tab</code> completion, the up arrow for history, <code>Ctrl+C</code> to stop a command.",
  "Copied and pasted the Linux way: select to copy, middle-click (or right-click) to paste.",
]

with open("guest/make-missions.py") as f:
    pass  # not used; kept for reference

head = ("// The Warm-ups module guide: two untimed warm-ups (Orientation and Speed\n"
        "// drills). Same engine as the CTF games; generated block below, then the\n"
        "// shared engine body. Edit gen-warmup.py, not this file.\n"
        "(function () {\n"
        '  "use strict";\n\n'
        "  const MISSIONS = " + json.dumps(MISSIONS, indent=2) + ";\n"
        "  const LEARNED = " + json.dumps(LEARNED) + ";\n")

with open("/tmp/engine-body.js") as f:
    body = f.read()

with open("public/warmup/guide.js", "w") as f:
    f.write(head + body)

print("wrote public/warmup/guide.js")
