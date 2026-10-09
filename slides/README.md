# CyberQuest Linux CTF teaching deck

`CyberQuest-Linux-CTF.pptx` is the slide deck for the mentorship session. It is
organised into PowerPoint sections (Opening, Part 1 Linux fundamentals, Part 2
Command-line essentials, Part 3 The competition, Part 4 Debrief, Mentor appendix).
The Mentor appendix is mentor reading only: class set-up, how the page works,
and getting students booted. Speaker notes are on every slide.

## Rebuild it

```
cd slides
npm install pptxgenjs react react-dom react-icons sharp
node build-deck-ctf.js          # writes CyberQuest-Linux-CTF.pptx
```

## Refresh the page screenshots

The anatomy slide and the scorecard slide use real screenshots of the CTF page.
After changing the page, serve `public/` and re-shoot them:

```
cd public && python3 -m http.server 8099 &
npm install playwright && node slides/deckshots.mjs
# then crop the sidebar for the scorecard slide:
python3 -c "from PIL import Image; Image.open('slides/img/finish.png').crop((848,48,1360,800)).save('slides/img/sidebar-finish.png')"
node slides/build-deck-ctf.js
```

`img/pins.json` holds the positions of the numbered pins on the anatomy slide;
`deckshots.mjs` writes it from the live page so the pins always match.

## Animations

Animations are used only where they help the talk, and titles never animate.
`animate_plan.py` holds the per-slide plan (`PLAN`) and three patterns:

- **reveal**: each step fades in on a click (slide 3 Read > Find > Submit > Score, the
  terminal layers, the pipeline, the walkthroughs' "What just happened" points)
- **focus**: everything visible, the current step bright and the rest dimmed; each click
  moves the focus (slide 2's four parts, the anatomy legends, the big ideas)
- **timeline**: the first item shows; each click dims the previous one and brings in the
  next (slide 5, one year at a time)

The title slide, section dividers and live-demo slides have no animation. To re-apply
after editing the deck in PowerPoint (it replaces any existing animations):

```
python3 -c "import zipfile; zipfile.ZipFile('slides/CyberQuest-Linux-CTF.pptx').extractall('deck')"
python3 slides/animate_plan.py deck
(cd deck && zip -Xr ../CyberQuest-Linux-CTF.pptx .)
```

Step numbers in `PLAN` refer to the blocks `animate.py` finds on each slide (cards,
terminals, rows), so check them if you move things around on an animated slide.

The .pptx in this folder was edited by hand in PowerPoint after it was generated,
so it is now the source of truth; `build-deck-ctf.js` reproduces the earlier version.
