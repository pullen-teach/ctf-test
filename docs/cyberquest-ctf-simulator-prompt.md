# Task: Convert the CyberQuest CTF simulator (all four CTFs) to Next.js + AWS

You are working in the CyberQuest Academy repository. CyberQuest is a public-facing
educational cybersecurity site (**Next.js, deployed to AWS ECS in an LM-owned account**).
High-school students and teachers reach it from their own machines: school Chromebooks,
locked-down laptops and home computers.

Your job: take the **entire in-browser CTF demo** — all four CTFs: **Linux, Crypto,
Forensics, and Web** — and rebuild it as a real, server-backed feature of CyberQuest on
**Next.js + AWS**. One shared platform (engine, flags, scoring, events, scoreboard), with the
four CTFs as content on top.

**Start with Linux.** It is the foundation: porting the Linux CTF is what *produces* the shared
platform. Build and prove Linux end-to-end first; Crypto, Forensics and Web are a second phase
that reuses the platform Linux establishes, and do not begin until Linux is working and approved.

**Work on a branch named `simulator-test`.**

## Two decisions are already made — do not revisit them

1. **Ignore Killercoda and the v86 / WebAssembly emulator.** The repo still has Killercoda
   scenarios (`linux-quest-mission-1/`, `test-local.sh`) and an in-browser v86 emulator. Do
   **not** port, extend, or depend on either. The target is the Next.js service, and the
   behaviour to port is the **simulated JS shell** (`public/lite.js`), not the emulator.
2. **Build the shared platform once; the four CTFs are content on top.** Read
   `docs/cyberquest-linux-quest-prompt.md` first — it is the detailed spec for the shared
   engine, two modes, server `submit`, HMAC flags, events and scoreboard. **This document
   generalises that spec to all four CTFs; treat the Linux prompt as the platform blueprint and
   do not duplicate or fork it per-CTF.**
3. **Start with Linux — it is phase 1.** The platform is extracted from the Linux port, so Linux
   and the shared platform are built together, first. Design the engine, flags, scoring, events and
   scoreboard to be CTF-agnostic from day one (carry a `ctf` field throughout), but **do not build
   Crypto, Forensics or Web until Linux works end-to-end and I have approved it.** When you factor
   shared code, pull it *out of* the Linux implementation rather than guessing a generic shape up front.

## Reference material (canonical content — read before designing)

The four decks are the single source of truth for mission text, order, difficulty, points,
hints, and solve paths. The `guest-*` generators are the existing demo's mission/tool source.

| CTF | Deck (mission content) | Existing demo source |
|---|---|---|
| Linux | `slides/build-deck-ctf.js` | `guest/make-missions.py`, `public/lite.js` |
| Crypto | `slides/build-deck-crypto.js` | `guest-crypto/` |
| Forensics | `slides/build-deck-forensics.js` | `guest-forensics/` |
| Web | `slides/build-deck-web.js` | (new; no emulator — see §Web) |

Also read the shared in-browser demo you are porting: `public/lite.js` (the simulated shell),
`public/guide.js` (the mission panel), `public/app.js` (the clock and capture flow),
`public/index.html` / `public/style.css` (layout). If you cannot read these from here, stop and
ask me to attach them — do not reconstruct them from this prompt.

## Step 0: explore, then propose (do not write feature code yet)

1. Read `CLAUDE.md`, `README`, `docs/cyberquest-linux-quest-prompt.md`, and **whatever the Linux
   CTF port already produced in the app** (its `lib/quest/` engine, submit API, scoreboard, event
   model). The other three CTFs reuse that; do not fork it.
2. Confirm: Next.js version and router; auth and how a route gets the current user; DB and ORM and
   migrations; test frameworks; lint/format; `.gitlab-ci.yml` stages; how the ECS deploy works;
   any existing CTF/challenge/event/scoring models to reuse.
3. Reply with a short plan: the shared platform work vs the per-CTF work, files/routes to add,
   data-model changes (ideally just a `ctf` discriminator on the existing mission/capture/event
   tables), any new dependency with its reason, and open questions. **Wait for my approval before
   implementing.**

## The shared platform (build once, all four CTFs use it)

Follow `docs/cyberquest-linux-quest-prompt.md` for the detail. In summary:

- **Engine:** port `lite.js` to typed, framework-free TypeScript under `lib/quest/`
  (`parser.ts`, `fs.ts`, `shell.ts`, `commands/*.ts`, `world.ts`, `missions.ts`). No DOM/browser
  APIs, so it runs in Node. **Seeded deterministic worlds** (`buildWorld(seed)` with a seeded PRNG,
  not `Math.random`); an **overlay** holds files the student changes. Rebuild from seed; don't
  store the world.
- **Two modes:** **practice** runs the engine in the browser (only `submit` hits the server);
  **competition** sends each entered line as a `POST` that runs the engine server-side against the
  user's world (seed + overlay, persisted so any ECS task can serve the next request). Flags never
  reach the browser except as command output.
- **Flags & scoring (server):** format `CYBA{word-8hex}`; generate per user/team from
  `HMAC(serverSecret, userId + ctf + missionId + round)` (secret from the existing secrets
  mechanism, never the repo). `submit` → constant-time compare, rate-limited, **once per mission**,
  points **fixed at capture time**; wrong-but-well-formed vs malformed-flag get different messages.
- **Events & scoreboard:** mentor-created events (name, included missions, solo/team, join code,
  open/close, optional end-game freeze, CSV export); ranking by points then lower elapsed time;
  scoreboard polls every 10–15s (**no WebSockets**), projector mode, mentor view with per-mission
  Took/Clock and flag-sharing detection; **no real names on the public board** (competitors are
  often minors).
- **One `ctf` discriminator** threads through missions, captures and events so all four CTFs share
  the same engine, submit API, scoreboard and event system. Do not duplicate those per CTF.
- **UI:** reuse the Linux CTF's shell, mission panel, stat cards (Points / Clock / Flags captured),
  stepper, competition clock, finish scorecard and scoreboard. Add a per-CTF pill in the header
  (**Linux / Crypto / Forensics / Web**).

### Hard constraints (all CTFs)

- **No WebSockets** (schools block them). **No WebAssembly** (managed browsers disable it — must
  work under `--js-flags=--jitless`). **Never execute real commands or `eval` input** — the shell is
  an interpreter over an in-memory model (the Web CTF is the one exception, and is contained; see §Web).
- Cap input length, output size, pipeline length and command time.
- **Minimal data (minors):** store only what scoring needs (user id, ctf, mission, timestamps). Never
  log raw terminal input or raw challenge-page request bodies.
- **No new AWS resources and no infra / Terraform / ECS changes without asking me first.**
  Student-facing infra stays inside the CyberQuest app on AWS — never on the LM corporate network.

## The four CTFs (content on the shared platform)

Each CTF keeps the exact missions, difficulty, points, briefs, hints and solve paths from its deck.
Hints name the command/tool and point to `--help`; they never give the answer. Worlds are randomised
per user so neighbours can't share answers. Difficulty sets points: **Easy 100, Medium 200, Hard 400,
Very Hard 800.** Each CTF has 10 missions; mission content lives only in that CTF's `missions.ts`
(ported from its `build-deck-*.js`), and both the panel and the `mission`/`hint` commands render from it.

### Linux
- **Surface:** the simulated shell. **Follow `docs/cyberquest-linux-quest-prompt.md`** — it already
  specs this CTF in full (missions, two added `curl`/`ssh` missions, UI, tests).

### Crypto
- **Surface:** the same shell, plus crypto helper commands baked into the engine as `commands/*`:
  `caesar`, `morse`, `xor`, `vigenere`, `hashlines`, alongside standard `base64`, `xxd`, `tr`,
  `sha256sum`. Content from `slides/build-deck-crypto.js` / `guest-crypto/`.
- The lesson thread is **"encoding is not encryption"**; randomise the Caesar shift, XOR key and
  Vigenère keyword per world.

### Forensics
- **Surface:** the same shell, plus the forensics tools its `guest-forensics/` generator defines.
  Content from `slides/build-deck-forensics.js`.

### Web
This one is different, and simpler in one key way: **the Web CTF needs no emulator.** Its missions are
real HTTP pages, so serve them for real from the CyberQuest app in an isolated, per-user, **seeded
challenge namespace** (e.g. `/quest/web/<missionId>/...`). Then **both** solve paths work natively:

- **Browser path:** students open DevTools (Elements, Console, Application, Sources, Network) against
  the real pages. Don't simulate DevTools.
- **Terminal path:** add a `curl` command to the shared shell that **server-side-fetches only
  challenge-namespace URLs** (never the open internet — same rule as the Linux CTF's `curl` mission),
  returning status, headers and body, and piping into the shell's `grep`, `cut`, `base64 -d`. Support
  at least `-s`, `-i`/`-I`, `-b`/`--cookie`, `-o`/`>`. Unknown hosts →
  `curl: (6) Could not resolve host`.

The deck already pairs the two paths for every mission (the DevTools move and its `curl` twin).

**The ten Web missions** (exact text from `slides/build-deck-web.js`):

| # | Title | Level | Planted weakness (seeded) | Browser / Terminal |
|---|---|---|---|---|
| 1 | View the source | Easy | Flag in an HTML comment | View Source / `curl -s URL \| grep CYBA` |
| 2 | Hidden in plain sight | Easy | Flag in a `hidden` field / `display:none` | Inspect / `curl \| grep value=` |
| 3 | Check the cookies | Easy | Flag cookie + trusted `role=user` cookie | Application→Cookies / `curl -b 'role=admin'` |
| 4 | Tamper with the URL | Medium | IDOR on `?id=` over seeded fake records | edit the id / `curl "?id=N"` loop |
| 5 | Robots and secret paths | Medium | Seeded hidden path in `robots.txt` | visit it / `curl robots.txt` then the path |
| 6 | The console knows | Medium | Flag built by page JS | Console `getFlag()` / `curl app.js \| grep` |
| 7 | Break the lock | Medium | Client-side login; seeded password in JS | Sources / `curl app.js \| grep 'pw ==='` |
| 8 | Decode the token | Hard | base64/JWT-style token carrying the flag | Storage / `curl \| cut -d. -f2 \| base64 -d` |
| 9 | A little injection | Hard | Reflected input — **contained simulation only** | reflected box / `curl "?q=<b>x</b>"` |
| 10 | The full chain | Very Hard | robots → seeded api `?id=` → base64 token | Network tab / `curl` chain |

Totals: 100+100 + 200×4 + 400×2 + 800 = **2,600 points.** Lesson thread: **"never trust the client."**

**Web safety (this CTF plants vulnerabilities):**
- **Containment:** every weakness is confined to the challenge namespace and seeded fake data. No
  challenge route reads or writes real user data, sessions, auth cookies, or the real DB outside its
  sandbox.
- **Mission 9 (injection) is a simulation, not a real sink.** Reflect the payload only inside a
  sandboxed, throwaway-origin iframe, or detect a well-formed payload shape and return the flag —
  **never create a real XSS or SQL-injection hole in CyberQuest.** Mission 7's "login" is a seeded
  client-side check, not real auth.
- **No real outbound.** `curl` resolves only challenge hosts.

## Tests

- **Per CTF:** solve every mission end-to-end by driving the surface (typing into the terminal; for
  Web, also by driving the real page / DevTools-equivalent DOM + HTTP assertions). Run in practice and
  competition mode, and once with `--js-flags=--jitless`.
- **Engine (shared):** parser (quotes, pipes, redirects, `$(...)`), permissions, each command's
  `--help`, world determinism from a seed; clock (doesn't start on load, starts on first keystroke,
  stops on last capture, survives reload in competition).
- **Submit API:** wrong flag, another competitor's flag (refused + logged for mentors), rate limit,
  replay (no double points), submit after event close.
- **Scoreboard:** ranking + tie-break, team scoring, freeze/unfreeze, display-name hiding, CSV export.
- **Web containment:** a challenge route cannot reach real user data/auth; mission 9 never executes
  injected script in the app origin; `curl` cannot reach a non-challenge host.
- **No regressions:** existing tests, lint and type checks stay green.

## Delivery

- Branch **`simulator-test`**, small commits. **Phase 1 is Linux + the shared platform, delivered
  and approved before anything else.** Then phase 2 adds Crypto, Forensics and Web on top, in that
  order — one MR per stage, each reviewable. Do not start a phase-2 CTF until Linux is working and
  I've signed off.
- Each GitLab MR description covers: what was built; how to try it locally; screenshots (a mission
  solved on its surface — for Web, the same mission solved in the browser *and* with `curl`; the clock
  and score; the finish scorecard; the scoreboard normal + projector); the data-model change; and a
  short security-notes section (flag generation, input limits, and for Web the containment of the
  planted vulns).
- **Do not merge, do not deploy, and do not change ECS or Terraform.** Tell me when each MR is ready
  and list anything you could not finish.
