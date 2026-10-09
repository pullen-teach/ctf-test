"""Purposeful, per-slide animations for the CyberQuest Linux CTF deck.

Titles never animate. Modes:
  reveal    - each step fades in on a click (everything else is there from the start)
  focus     - everything is visible; the current step is bright, the rest are dimmed;
              each click moves the focus to the next step
  timeline  - step 1 is visible; each click dims the previous step and brings in the next
  onload    - the steps fade in by themselves, one after another, when the slide opens
A step lists block numbers, or "#id" for a single shape (e.g. a marker inside a terminal).
Steps are lists of block numbers from animate.groups_for (cards, terminals, rows).
Every slide also gets a quick fade transition.
"""
import glob, os, re, sys
from lxml import etree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from animate import NS, shapes, groups_for

DIM = "0.25"
FADE_MS = 400

WALK = [[3], [4], [5]]   # mission walkthroughs: the three "What just happened" points
PLAN = {
    2: ("focus", [[0], [1], [2], [3], [4]]),                       # the four parts, then the deal
    3: ("reveal", [[4], [5, 6], [7, 8], [9, 10]]),                 # Read > Find > Submit > Score
    5: ("timeline", [[0, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]]),   # one year at a time
    7: ("onload", [[1], [2], [3], [4], [5], [6], [7], [8], [9]]),  # device cards cascade in, then the Chromebook line
    8: ("focus", [[0], [2], [3], [4], [6]]),                       # You > Terminal > Shell > Kernel > Hardware
    # each click: a description plus its numbered marker (and highlight outline) on the terminal
    9: ("reveal", [[1, "#24", "#25"], [2, "#26", "#27", "#19"], [3, "#28", "#29", "#20"],
                   [4, "#30", "#31", "#21"], [5, "#32", "#33", "#22"], [6, "#34", "#35", "#23"]]),
    10: ("reveal", [[2], [3], [4], [5], [6], [7]]),                # CLI vs GUI, one task at a time
    11: ("reveal", [[0], [1], [2], [3]]),                          # three races, then the conclusion
    13: ("reveal", [[0], [4, 1], [5, 2], [6, 3, 7], [8, 9]]),      # the conversation loop
    14: ("focus", [[0], [1], [2], [3]]),                           # four big ideas
    25: ("focus", [[0], [2], [3], [4]]),                           # ways to discover commands
    30: ("reveal", [[1], [5, 2], [6, 3], [7, 4]]),                 # build the pipeline stage by stage
    34: ("focus", [[0], [1], [2], [3], [4], [5]]),                 # when you are stuck
    38: ("reveal", [[0], [1, 2], [3, 4], [5, 6], [7, 8], [9]]),    # the capture routine
    39: ("focus", [[1], [2], [3], [4], [5], [6], [7], [9]]),       # parts of the competition page
    40: ("reveal", [[0], [2], [3], [4]]),                          # warm-up steps
}
for n in range(44, 63, 2):
    PLAN[n] = ("reveal", WALK)


class Timing:
    def __init__(self):
        self.n = 2
        self.clicks = []
        self.anim_sp = set()

    def nid(self):
        self.n += 1
        return self.n

    def _grp(self, s):
        if s["tag"] == "sp":
            self.anim_sp.add(s["id"])
            return ' grpId="0"'
        return ""

    def appear(self, s, node):
        a, b, c = self.nid(), self.nid(), self.nid()
        return ('<p:par><p:cTn id="%d" presetID="10" presetClass="entr" presetSubtype="0" fill="hold"%s nodeType="%s">'
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                '<p:set><p:cBhvr><p:cTn id="%d" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
                '<p:tgtEl><p:spTgt spid="%s"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
                '<p:to><p:strVal val="visible"/></p:to></p:set>'
                '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="%d" dur="%d"/><p:tgtEl><p:spTgt spid="%s"/></p:tgtEl></p:cBhvr></p:animEffect>'
                '</p:childTnLst></p:cTn></p:par>' % (a, self._grp(s), node, b, s["id"], c, FADE_MS, s["id"]))

    def opacity(self, s, val, node, dur=FADE_MS):
        a, b, c = self.nid(), self.nid(), self.nid()
        return ('<p:par><p:cTn id="%d" presetID="9" presetClass="emph" presetSubtype="0" fill="hold"%s nodeType="%s">'
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                '<p:set><p:cBhvr><p:cTn id="%d" dur="%d" fill="hold"/><p:tgtEl><p:spTgt spid="%s"/></p:tgtEl>'
                '<p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="%s"/></p:to></p:set>'
                '<p:animEffect filter="image" prLst="opacity: %s"><p:cBhvr rctx="IE"><p:cTn id="%d" dur="%d" fill="hold"/>'
                '<p:tgtEl><p:spTgt spid="%s"/></p:tgtEl></p:cBhvr></p:animEffect>'
                '</p:childTnLst></p:cTn></p:par>' % (a, self._grp(s), node, b, dur, s["id"], val, val, c, dur, s["id"]))

    def step(self, effects, auto=False):
        """effects: list of callables(node) -> xml; the first is the click (or auto) effect."""
        if not effects:
            return
        outer, inner = self.nid(), self.nid()
        first = "afterEffect" if auto else "clickEffect"
        body = "".join(f(first if i == 0 else "withEffect") for i, f in enumerate(effects))
        cond = ('<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>' if auto
                else '<p:cond delay="indefinite"/>')
        self.clicks.append('<p:par><p:cTn id="%d" fill="hold"><p:stCondLst>%s</p:stCondLst><p:childTnLst>'
                           '<p:par><p:cTn id="%d" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>%s'
                           '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>' % (outer, cond, inner, body))

    def cascade(self, steps, gap=250):
        """Steps fade in one after another, automatically, when the slide opens."""
        outer = self.nid()
        inner = []
        for k, st in enumerate(steps):
            pid = self.nid()
            body = "".join(self.appear(s, "afterEffect" if (j == 0 and k == 0) else "withEffect") for j, s in enumerate(st))
            inner.append('<p:par><p:cTn id="%d" fill="hold"><p:stCondLst><p:cond delay="%d"/></p:stCondLst><p:childTnLst>%s</p:childTnLst></p:cTn></p:par>'
                         % (pid, k * gap, body))
        self.clicks.append('<p:par><p:cTn id="%d" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
                           '</p:stCondLst><p:childTnLst>%s</p:childTnLst></p:cTn></p:par>' % (outer, "".join(inner)))

    def xml(self):
        bld = "".join('<p:bldP spid="%s" grpId="0" animBg="1"/>' % i for i in sorted(self.anim_sp, key=int))
        return ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
                '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>%s</p:childTnLst></p:cTn>'
                '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
                '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
                '</p:childTnLst></p:cTn></p:par></p:tnLst>%s</p:timing>'
                % ("".join(self.clicks), "<p:bldLst>%s</p:bldLst>" % bld if bld else ""))


def build(mode, steps):
    t = Timing()
    if mode == "reveal":
        for st in steps:
            t.step([(lambda node, s=s: t.appear(s, node)) for s in st])
    elif mode == "focus":
        rest = [s for st in steps[1:] for s in st]
        t.step([(lambda node, s=s: t.opacity(s, DIM, node, dur=1)) for s in rest], auto=True)
        for prev, cur in zip(steps, steps[1:]):
            t.step([(lambda node, s=s: t.opacity(s, "1", node)) for s in cur] +
                   [(lambda node, s=s: t.opacity(s, DIM, node)) for s in prev])
    elif mode == "onload":
        t.cascade(steps)
    elif mode == "timeline":
        for prev, cur in zip(steps, steps[1:]):
            t.step([(lambda node, s=s: t.appear(s, node)) for s in cur] +
                   [(lambda node, s=s: t.opacity(s, DIM, node)) for s in prev])
    return t.xml()


TRANSITION = '<p:transition spd="med"><p:fade/></p:transition>'

def process(path, num):
    raw = open(path, encoding="utf-8").read()
    raw = re.sub(r"<p:transition.*?</p:transition>", "", raw, flags=re.S)
    raw = re.sub(r"<p:timing>.*?</p:timing>", "", raw, flags=re.S)
    add, note = TRANSITION, "no animation"
    if num in PLAN:
        mode, idx = PLAN[num]
        tree = etree.fromstring(raw.encode("utf-8"))
        all_shapes = shapes(tree.find("./p:cSld/p:spTree", NS))
        by_id = {s["id"]: s for s in all_shapes}
        gs = groups_for(all_shapes)
        picked = {i[1:] for st in idx for i in st if isinstance(i, str)}
        # a shape named on its own leaves its block, so it only animates in its own step
        steps = [[s for i in st for s in ([by_id[i[1:]]] if isinstance(i, str) else [x for x in gs[i] if x["id"] not in picked])] for st in idx]
        add += build(mode, steps)
        note = "%s, %d steps" % (mode, len(steps))
    m = re.search(r"</p:clrMapOvr>", raw) or re.search(r"</p:cSld>", raw)
    open(path, "w", encoding="utf-8").write(raw[:m.end()] + add + raw[m.end():])
    return note

if __name__ == "__main__":
    root = sys.argv[1]
    # slide order comes from presentation.xml
    pres = open(os.path.join(root, "ppt/presentation.xml"), encoding="utf-8").read()
    rels = open(os.path.join(root, "ppt/_rels/presentation.xml.rels"), encoding="utf-8").read()
    target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="slides/(slide\d+\.xml)"', rels))
    target.update({k: v for v, k in re.findall(r'Target="slides/(slide\d+\.xml)"[^>]*Id="(rId\d+)"', rels)})
    order = [target[r] for r in re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', pres)]
    for num, name in enumerate(order, 1):
        print(num, name, process(os.path.join(root, "ppt/slides", name), num))
