"""Add a fade transition to every slide and an automatic build: the title and the
header strip stay put, then each content block (a card or terminal with everything
inside it, or a row of loose shapes) fades in after the previous one."""
import glob, os, re, sys
from lxml import etree

NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
IN = 914400
HEADER_BOTTOM = 1.3 * IN     # titles, Try it pills, mission chips and the trail live above this
FOOTER_TOP = 6.95 * IN       # footer and slide number


def shapes(spTree):
    out = []
    for el in spTree:
        tag = etree.QName(el).localname
        if tag not in ("sp", "pic", "grpSp", "graphicFrame", "cxnSp"):
            continue
        nv = el.find("./*/p:cNvPr", NS)
        x = el.find("./p:spPr/a:xfrm", NS) if tag in ("sp", "pic", "cxnSp") else \
            el.find("./p:grpSpPr/a:xfrm", NS) if tag == "grpSp" else el.find("./p:xfrm", NS)
        if nv is None or x is None or x.find("a:off", NS) is None:
            continue
        off, ext = x.find("a:off", NS), x.find("a:ext", NS)
        geom = el.find("./p:spPr/a:prstGeom", NS)
        out.append(dict(id=nv.get("id"), tag=tag, x=int(off.get("x")), y=int(off.get("y")),
                        w=int(ext.get("cx")), h=int(ext.get("cy")),
                        geom=geom.get("prst") if geom is not None else None,
                        text=el.find(".//p:txBody", NS) is not None and "".join(el.itertext()).strip() != ""))
    return out


def groups_for(slide_shapes):
    body = [s for s in slide_shapes
            if s["y"] + s["h"] > HEADER_BOTTOM and s["y"] < FOOTER_TOP
            and not (s["w"] >= 12 * IN and s["h"] >= 6.5 * IN)]
    contains = lambda c, s: (c is not s and c["w"] * c["h"] >= s["w"] * s["h"]
                             and c["x"] <= s["x"] + s["w"] / 2 <= c["x"] + c["w"]
                             and c["y"] <= s["y"] + s["h"] / 2 <= c["y"] + c["h"])
    # containers are filled shapes without text (cards, terminals, chips, number circles);
    # a text box sitting exactly on one belongs to it
    containers = [s for s in body if s["tag"] == "sp" and s["geom"] in ("rect", "roundRect", "ellipse") and not s["text"]
                  and s["w"] * s["h"] >= 0.08 * IN * IN]
    parent = {}
    for s in body:
        best = None
        for c in containers:
            if contains(c, s) and (best is None or c["w"] * c["h"] < best["w"] * best["h"]):
                best = c
        if best is not None:
            parent[s["id"]] = best["id"]
    def root(s_id):
        while s_id in parent:
            s_id = parent[s_id]
        return s_id
    by_id = {s["id"]: s for s in body}
    # union-find: contained shapes join their outermost container; loose shapes in the
    # same row (overlapping heights, close horizontally) join each other
    uf = {s["id"]: root(s["id"]) for s in body}
    def find(a):
        while uf[a] != a:
            uf[a] = uf[uf[a]]
            a = uf[a]
        return a
    # loose shapes, and small containers such as number circles and chips, join the shapes beside them
    loose = [s for s in body if root(s["id"]) == s["id"] and
             (s["id"] not in {c["id"] for c in containers} or s["w"] * s["h"] < 0.6 * IN * IN)]
    for i, a in enumerate(loose):
        for b in loose[i + 1:]:
            top, bot = max(a["y"], b["y"]), min(a["y"] + a["h"], b["y"] + b["h"])
            overlap = bot - top
            gap = max(a["x"], b["x"]) - min(a["x"] + a["w"], b["x"] + b["w"])
            if overlap > -0.03 * IN and gap < 0.35 * IN:
                uf[find(a["id"])] = find(b["id"])
    groups = {}
    for s in body:
        groups.setdefault(find(s["id"]), []).append(s)
    # reading order: rows (blocks starting within 0.6" of the row's first block), then left to right
    gl = sorted(groups.values(), key=lambda g: min(s["y"] for s in g))
    rows = []
    for g in gl:
        top = min(s["y"] for s in g)
        if rows and top < rows[-1][0] + 0.6 * IN:
            rows[-1][1].append(g)
        else:
            rows.append([top, [g]])
    return [g for _, r in rows for g in sorted(r, key=lambda g: min(s["x"] for s in g))]


def timing_xml(groups, ids):
    step = 280 if len(groups) <= 10 else 170 if len(groups) <= 18 else 110
    dur = 350
    n = [3]
    def nid():
        n[0] += 1
        return n[0]
    inner = []
    for k, g in enumerate(groups):
        effects = []
        for j, s in enumerate(g):
            c1, c2, c3 = nid(), nid(), nid()
            node = "afterEffect" if (j == 0 and k == 0) else "withEffect"
            effects.append(
                '<p:par><p:cTn id="%d" presetID="10" presetClass="entr" presetSubtype="0" fill="hold"%s nodeType="%s">'
                '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
                '<p:set><p:cBhvr><p:cTn id="%d" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
                '<p:tgtEl><p:spTgt spid="%s"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
                '<p:to><p:strVal val="visible"/></p:to></p:set>'
                '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="%d" dur="%d"/>'
                '<p:tgtEl><p:spTgt spid="%s"/></p:tgtEl></p:cBhvr></p:animEffect>'
                '</p:childTnLst></p:cTn></p:par>'
                % (c1, ' grpId="0"' if s["tag"] == "sp" else "", node, c2, s["id"], c3, dur, s["id"]))
        inner.append('<p:par><p:cTn id="%d" fill="hold"><p:stCondLst><p:cond delay="%d"/></p:stCondLst><p:childTnLst>%s</p:childTnLst></p:cTn></p:par>'
                     % (nid(), k * step, "".join(effects)))
    bld = "".join('<p:bldP spid="%s" grpId="0" animBg="1"/>' % s["id"] for g in groups for s in g if s["tag"] == "sp")
    return ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
            '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
            '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst>'
            '<p:childTnLst>%s</p:childTnLst></p:cTn></p:par>'
            '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
            '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
            '</p:childTnLst></p:cTn></p:par></p:tnLst>%s</p:timing>'
            % ("".join(inner), ("<p:bldLst>" + bld + "</p:bldLst>") if bld else ""))


TRANSITION = '<p:transition spd="med"><p:fade/></p:transition>'

def process(path):
    raw = open(path, encoding="utf-8").read()
    if "<p:timing" in raw or "<p:transition" in raw:
        return "skipped (already animated)"
    tree = etree.fromstring(raw.encode("utf-8"))
    spTree = tree.find("./p:cSld/p:spTree", NS)
    gs = groups_for(shapes(spTree))
    add = TRANSITION + (timing_xml(gs, None) if gs else "")
    # transition and timing go right after clrMapOvr (or cSld), before any extLst
    m = re.search(r"</p:clrMapOvr>", raw) or re.search(r"</p:cSld>", raw)
    out = raw[:m.end()] + add + raw[m.end():]
    open(path, "w", encoding="utf-8").write(out)
    return "%d blocks" % len(gs)

if __name__ == "__main__":
    for f in sorted(glob.glob(os.path.join(sys.argv[1], "ppt/slides/slide*.xml")), key=lambda p: int(re.findall(r"\d+", os.path.basename(p))[0])):
        print(os.path.basename(f), process(f))
