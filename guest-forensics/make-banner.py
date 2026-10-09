#!/usr/bin/env python3
"""Builds the CyberQuest welcome banner shown when the terminal starts.

Forensics CTF version: writes guest-forensics/banner and patches public/forensics/lite.js, plus a compact version for narrow terminals in lite mode.
Needs: pip install pyfiglet
"""
import json, os, re
import pyfiglet

HERE = os.path.dirname(os.path.abspath(__file__))
ESC = "\x1b["
RESET = ESC + "0m"

def rgb(c): return ESC + "38;2;%d;%d;%dm" % c
def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# green -> blue -> violet, top to bottom
STOPS = [(70, 211, 154), (15, 148, 136), (42, 159, 214), (36, 89, 216)]
def grad(t):
    seg = min(int(t * (len(STOPS) - 1)), len(STOPS) - 2)
    return lerp(STOPS[seg], STOPS[seg + 1], t * (len(STOPS) - 1) - seg)

SHADOW = rgb((59, 74, 102))      # the 3-D edge characters
DIM = rgb((139, 152, 173))
WHITE = ESC + "1;97m"
AMBER = rgb((245, 166, 35))
GREEN = rgb((70, 211, 154))

def art(words, font):
    rows = []
    for w in words:
        rows += [l.rstrip() for l in pyfiglet.figlet_format(w, font=font, width=200).split("\n") if l.strip()]
    return rows

def paint(rows, solid="█▄▀"):
    out = []
    for i, row in enumerate(rows):
        c = rgb(grad(i / max(1, len(rows) - 1)))
        line, cur = "", None
        for ch in row:
            want = c if ch in solid else (SHADOW if ch.strip() else None)
            if want and want != cur: line += want; cur = want
            line += ch
        out.append("  " + line + RESET)
    return out

def box(lines, width):
    top = "  " + SHADOW + "╭" + "─" * (width + 4) + "╮" + RESET
    bot = "  " + SHADOW + "╰" + "─" * (width + 4) + "╯" + RESET
    body = []
    for text, styled in lines:
        body.append("  " + SHADOW + "│" + RESET + "  " + styled + " " * (width - len(text)) + "  " + SHADOW + "│" + RESET)
    return [top] + body + [bot]

def banner(compact):
    words = ["CYBER", "QUEST"]
    logo = art(words, "small" if compact else "ansi_shadow")
    solid = "_/\\|()<>'`,.-" if compact else "█▄▀"
    width = max(len(r) for r in logo) - 4
    t1, t2 = "DIGITAL FORENSICS CTF COMPETITION", "Forensics CTF  ·  10 missions  ·  10 flags"
    if compact: t2 = "Forensics CTF · 10 flags"
    width = max(width, len(t1), len(t2))
    out = ["  " + DIM + " ".join("WELCOME TO") + RESET]
    out += paint(logo, solid)
    out += box([(t1, WHITE + t1 + RESET), (t2, DIM + t2 + RESET)], width) + [""]
    arrow = AMBER + "▸" + RESET
    out += [
        "  " + arrow + " Start:  " + GREEN + "mission 1" + RESET + "   (or use the mission panel)",
        "  " + arrow + " Flags look like " + WHITE + "CYBA{word-1a2b3c4d}" + RESET,
        "  " + arrow + " Check one:  " + GREEN + "submit CYBA{...}" + RESET + "    Stuck?  " + GREEN + "hint 1" + RESET,
        "  " + arrow + " Instructions:  " + GREEN + "cat README.txt" + RESET + "  (home and each mission folder)",
        "",
    ] if not compact else [
        "  " + arrow + " Start: " + GREEN + "mission 1" + RESET,
        "  " + arrow + " Check: " + GREEN + "submit CYBA{...}" + RESET,
        "  " + arrow + " Stuck? " + GREEN + "hint 1" + RESET,
        "  " + arrow + " Help:  " + GREEN + "cat README.txt" + RESET,
        "",
    ]
    return "\n".join(out) + "\n"

wide, small = banner(False), banner(True)
open(os.path.join(HERE, "banner"), "w").write(wide)

lite = os.path.join(HERE, "..", "public", "forensics", "lite.js")
s = open(lite).read()
decl = "  const BANNER = " + json.dumps({"wide": wide, "small": small}, ensure_ascii=True) + ";\n"
s = re.sub(r"  const BANNER = .*;\n", lambda m: decl, s) if "const BANNER = " in s else s.replace("  async function start(", decl + "  async function start(", 1)
open(lite, "w").write(s)
print(wide); print(small)
